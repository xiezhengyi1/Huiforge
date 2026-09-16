import asyncio
import sqlite3
import time
from pathlib import Path

from fastapi.testclient import TestClient

from backend.huiju.api import dependencies
from backend.huiju.core.config import FRONTEND_ASSETS
from backend.huiju.edge.app import EdgeState
from backend.huiju.persistence.analytics import (
    create_edge_snapshot,
    restore_edge_snapshot,
    snapshot_status,
)
from backend.huiju.api.app import app
from backend.huiju.api.routes import system
from backend.huiju.runtime import relay


ROOT = Path(__file__).resolve().parents[1]
client = TestClient(app)


def _edge_database(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("CREATE TABLE counters (key TEXT PRIMARY KEY,value INTEGER NOT NULL)")
        connection.executemany("INSERT INTO counters(key,value) VALUES(?,?)", [("page_views", 31), ("clicks", 9)])
        connection.execute("CREATE TABLE visitors (session_id TEXT PRIMARY KEY)")
        connection.executemany("INSERT INTO visitors(session_id) VALUES(?)", [("a",), ("b",), ("c",)])
        connection.execute("CREATE TABLE metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL)")
        connection.execute("INSERT INTO metadata(key,value) VALUES('daily_tracking_started_at',?)", (str(time.time() - 86400),))
        connection.execute("CREATE TABLE daily_counters (day TEXT PRIMARY KEY,page_views INTEGER,api_writes INTEGER)")
        connection.execute("CREATE TABLE daily_visitors (day TEXT,session_id TEXT,PRIMARY KEY(day,session_id))")
        today = system.datetime.now(system.CHINA_TZ).strftime("%Y-%m-%d")
        connection.execute("INSERT INTO daily_counters(day,page_views,api_writes) VALUES(?,?,?)", (today, 12, 4))
        connection.executemany("INSERT INTO daily_visitors(day,session_id) VALUES(?,?)", [(today, "a"), (today, "b")])


def test_analytics_dashboard_is_local_only_and_separate_from_public_assets():
    assert {"analytics.html", "analytics.css", "analytics.js"}.isdisjoint(FRONTEND_ASSETS)
    dashboard = ROOT / "ops-dashboard"
    html = (dashboard / "index.html").read_text(encoding="utf-8")
    assert '<meta name="huiju-dashboard-version" content="1.0.0"' in html
    assert "app.css?v=1.0.0" in html
    assert "app.js?v=1.0.0" in html
    assert (dashboard / "server.py").is_file()
    assert client.get("/analytics.html").status_code == 404


def test_edge_daily_stats_count_page_visitors_once(monkeypatch, tmp_path: Path):
    database = tmp_path / "edge.sqlite3"
    monkeypatch.setattr("backend.huiju.edge.app.EDGE_STATS_DB", database)
    monkeypatch.setattr("backend.huiju.edge.app.ANALYTICS_BACKUP_DIR", tmp_path / "backups")
    state = EdgeState()
    state.record("GET", "/studio.html", "a" * 32)
    state.record("GET", "/studio.html", "a" * 32)
    state.record("POST", "/api/v1/images/generations", "a" * 32)
    asyncio.run(state.flush())
    with sqlite3.connect(database) as connection:
        counters = connection.execute("SELECT page_views,api_writes FROM daily_counters").fetchone()
        visitors = connection.execute("SELECT COUNT(*) FROM daily_visitors").fetchone()[0]
    assert counters == (2, 1)
    assert visitors == 1


def test_admin_analytics_requires_token_and_returns_detailed_snapshot(monkeypatch, tmp_path: Path):
    edge_database = tmp_path / "edge.sqlite3"
    _edge_database(edge_database)
    monkeypatch.setattr(system, "EDGE_STATS_DB", edge_database)
    monkeypatch.setattr(system, "snapshot_status", lambda: {
        "state": "healthy", "integrity": "ok", "restore_points": 2,
        "last_snapshot_at": now - 30, "oldest_day": "2026-08-26",
        "newest_day": "2026-08-27", "retention_days": 120,
    })
    monkeypatch.setattr(dependencies, "ADMIN_USAGE_TOKEN", "dashboard-secret")
    now = time.time()
    events = [
        {
            "created_at": now - 120,
            "job_id": "job-completed",
            "model": "qwen_image",
            "model_label": "Qwen Image",
            "provider": "google",
            "operation": "text",
            "media_kind": "image",
            "status": "completed",
            "request_count": 2,
            "image_count": 1,
            "credits_charged": 4,
            "provider_cost_usd": 0.04,
            "duration_ms": 2400,
            "error_code": "",
        },
        {
            "created_at": now - 60,
            "job_id": "job-failed",
            "model": "seedream_4_0",
            "model_label": "Seedream 4.0",
            "provider": "ark",
            "operation": "text",
            "media_kind": "image",
            "status": "failed",
            "request_count": 1,
            "image_count": 0,
            "credits_charged": 0,
            "provider_cost_usd": None,
            "duration_ms": 6000,
            "error_code": "upstream_timeout",
        },
    ]
    monkeypatch.setattr(relay, "model_usage_events", lambda: events)
    monkeypatch.setattr(relay.database, "analytics_snapshot", lambda start, end: {
        "registered_users": 20,
        "wallet_owners": 35,
        "active_members": 5,
        "member_rate": 25.0,
        "membership_tiers": [{"tier": "pro", "members": 5}],
        "new_users_daily": [],
        "content": {"histories": 10, "assets": 8, "workflows": 3, "media_jobs": 2},
    })
    unauthorized = client.get("/api/v1/admin/analytics?days=7")
    response = client.get(
        "/api/v1/admin/analytics?days=7",
        headers={"Authorization": "Bearer dashboard-secret"},
    )
    assert unauthorized.status_code == 401
    assert response.status_code == 200
    payload = response.json()
    assert payload["traffic"]["today"] == {"page_views": 12, "api_writes": 4, "visitors": 2}
    assert payload["accounts"]["active_members"] == 5
    assert payload["usage"]["range"]["jobs"] == 2
    assert payload["usage"]["range"]["success_rate"] == 50.0
    assert payload["usage"]["range"]["provider_cost_usd"] == 0.04
    assert payload["usage"]["range"]["avg_duration_ms"] == 4200
    assert len(payload["traffic"]["daily"]) == 7
    assert payload["traffic"]["coverage"]["exact_from_day"]
    assert payload["traffic"]["daily"][-1]["coverage"] in {"partial", "tracked"}
    assert payload["usage"]["error_breakdown"] == [
        {"code": "upstream_timeout", "count": 1, "share": 100.0},
    ]
    assert payload["recovery"]["integrity"] == "ok"
    assert payload["usage"]["recent_events"][0]["error_code"] == "upstream_timeout"
    assert "visitor" in payload["definitions"]


def test_admin_analytics_csv_export_and_snapshot_action(monkeypatch, tmp_path: Path):
    edge_database = tmp_path / "edge.sqlite3"
    _edge_database(edge_database)
    monkeypatch.setattr(system, "EDGE_STATS_DB", edge_database)
    monkeypatch.setattr(dependencies, "ADMIN_USAGE_TOKEN", "dashboard-secret")
    monkeypatch.setattr(relay, "model_usage_events", lambda: [])
    monkeypatch.setattr(relay.database, "analytics_snapshot", lambda start, end: {
        "registered_users": 0, "wallet_owners": 0, "active_members": 0,
        "member_rate": 0.0, "membership_tiers": [], "new_users_daily": [],
        "content": {"histories": 0, "assets": 0, "workflows": 0, "media_jobs": 0},
    })
    monkeypatch.setattr(system, "snapshot_status", lambda: {
        "state": "missing", "integrity": "unknown", "restore_points": 0,
        "last_snapshot_at": None, "oldest_day": None, "newest_day": None,
        "retention_days": 120,
    })
    monkeypatch.setattr(system, "create_edge_snapshot", lambda force=False: {
        "created": True, "reason": "created", "state": "healthy", "integrity": "ok",
    })
    headers = {"Authorization": "Bearer dashboard-secret"}
    exported = client.get("/api/v1/admin/analytics/export?days=7&format=csv", headers=headers)
    snapshot = client.post("/api/v1/admin/analytics/snapshot", headers=headers)
    assert exported.status_code == 200
    assert exported.content.startswith(b"\xef\xbb\xbfday,coverage,visitors")
    assert "attachment" in exported.headers["content-disposition"]
    assert b"session_id" not in exported.content
    assert snapshot.status_code == 200
    assert snapshot.json()["created"] is True


def test_daily_snapshot_is_integrity_checked_and_offline_restore_is_explicit(tmp_path: Path):
    source = tmp_path / "edge.sqlite3"
    backup_dir = tmp_path / "analytics-backups"
    _edge_database(source)
    created = create_edge_snapshot(source, backup_dir, force=True, now=1_788_000_000)
    assert created["created"] is True
    assert created["integrity"] == "ok"
    assert snapshot_status(backup_dir, now=1_788_000_010)["restore_points"] == 1
    snapshot_file = next(backup_dir.glob("edge-stats-*.sqlite3"))
    assert not list(backup_dir.glob("*-wal"))
    assert not list(backup_dir.glob("*-shm"))
    validation = restore_edge_snapshot(snapshot_file, tmp_path / "restored.sqlite3")
    assert validation["applied"] is False
    try:
        restore_edge_snapshot(snapshot_file, tmp_path / "restored.sqlite3", apply=True)
    except ValueError as error:
        assert str(error) == "offline_confirmation_required"
    else:
        raise AssertionError("restore must require explicit offline confirmation")
    applied = restore_edge_snapshot(
        snapshot_file, tmp_path / "restored.sqlite3", apply=True, confirm_offline=True,
    )
    assert applied["applied"] is True
    with sqlite3.connect(tmp_path / "restored.sqlite3") as connection:
        assert connection.execute("SELECT COUNT(*) FROM daily_counters").fetchone()[0] == 1

