"""Durable snapshots and offline recovery for exact daily edge analytics."""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from ..core.config import (
    ANALYTICS_BACKUP_DIR,
    ANALYTICS_BACKUP_INTERVAL_SECONDS,
    ANALYTICS_BACKUP_RETENTION_DAYS,
    EDGE_STATS_DB,
)

CHINA_TZ = timezone(timedelta(hours=8))
SNAPSHOT_PREFIX = "edge-stats-"
SNAPSHOT_SUFFIX = ".sqlite3"
REQUIRED_TABLES = frozenset({"counters", "visitors", "metadata", "daily_counters", "daily_visitors"})


def _snapshot_files(backup_dir: Path) -> list[Path]:
    if not backup_dir.is_dir():
        return []
    return sorted(
        path for path in backup_dir.iterdir()
        if path.is_file() and path.name.startswith(SNAPSHOT_PREFIX) and path.name.endswith(SNAPSHOT_SUFFIX)
    )


def validate_snapshot(path: Path) -> dict[str, Any]:
    """Validate integrity and the minimum recoverable schema without exposing visitor IDs."""
    resolved = path.resolve(strict=True)
    with contextlib.closing(sqlite3.connect(
        f"file:{resolved.as_posix()}?mode=ro&immutable=1", uri=True, timeout=30,
    )) as connection:
        integrity = str(connection.execute("PRAGMA integrity_check").fetchone()[0])
        tables = {
            str(row[0]) for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'",
            )
        }
        missing = sorted(REQUIRED_TABLES - tables)
        if integrity != "ok" or missing:
            raise ValueError("analytics_snapshot_invalid")
        day_range = connection.execute(
            "SELECT MIN(day),MAX(day),COUNT(*) FROM daily_counters",
        ).fetchone()
    return {
        "integrity": integrity,
        "bytes": resolved.stat().st_size,
        "daily_start": day_range[0],
        "daily_end": day_range[1],
        "daily_rows": int(day_range[2] or 0),
    }


def snapshot_status(
    backup_dir: Path = ANALYTICS_BACKUP_DIR,
    *,
    now: float | None = None,
) -> dict[str, Any]:
    timestamp = time.time() if now is None else now
    files = _snapshot_files(backup_dir)
    if not files:
        return {
            "state": "missing", "integrity": "unknown", "restore_points": 0,
            "last_snapshot_at": None, "oldest_day": None, "newest_day": None,
            "retention_days": ANALYTICS_BACKUP_RETENTION_DAYS,
        }
    newest = max(files, key=lambda path: path.stat().st_mtime)
    try:
        validation = validate_snapshot(newest)
        integrity = validation["integrity"]
    except (OSError, sqlite3.Error, ValueError):
        integrity = "failed"
    modified = newest.stat().st_mtime
    age = max(0, timestamp - modified)
    state = "corrupt" if integrity != "ok" else (
        "stale" if age > max(ANALYTICS_BACKUP_INTERVAL_SECONDS * 3, 6 * 3600) else "healthy"
    )
    return {
        "state": state,
        "integrity": integrity,
        "restore_points": len(files),
        "last_snapshot_at": modified,
        "oldest_day": files[0].stem.removeprefix(SNAPSHOT_PREFIX),
        "newest_day": files[-1].stem.removeprefix(SNAPSHOT_PREFIX),
        "retention_days": ANALYTICS_BACKUP_RETENTION_DAYS,
    }


def traffic_snapshot(database: Path = EDGE_STATS_DB) -> dict[str, int | float]:
    if not database.is_file():
        return {"page_views": 0, "clicks": 0, "visitors": 0, "started_at": 0.0}
    with contextlib.closing(sqlite3.connect(database, timeout=30)) as connection:
        counters = dict(connection.execute("SELECT key,value FROM counters"))
        visitors = int(connection.execute("SELECT COUNT(*) FROM visitors").fetchone()[0])
        started_at = connection.execute("SELECT value FROM metadata WHERE key='started_at'").fetchone()
    return {
        "page_views": int(counters.get("page_views", 0)),
        "clicks": int(counters.get("clicks", 0)),
        "visitors": visitors,
        "started_at": float(started_at[0]) if started_at else 0.0,
    }


def create_edge_snapshot(
    source: Path = EDGE_STATS_DB,
    backup_dir: Path = ANALYTICS_BACKUP_DIR,
    *,
    force: bool = False,
    now: float | None = None,
) -> dict[str, Any]:
    """Atomically refresh today's restore point using SQLite's online backup API."""
    timestamp = time.time() if now is None else now
    if not source.is_file():
        return {"created": False, "reason": "source_missing", **snapshot_status(backup_dir, now=timestamp)}
    existing = snapshot_status(backup_dir, now=timestamp)
    last_snapshot = existing.get("last_snapshot_at")
    if not force and isinstance(last_snapshot, (int, float)) and timestamp - last_snapshot < ANALYTICS_BACKUP_INTERVAL_SECONDS:
        return {"created": False, "reason": "fresh", **existing}

    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    day = datetime.fromtimestamp(timestamp, CHINA_TZ).strftime("%Y-%m-%d")
    target = backup_dir / f"{SNAPSHOT_PREFIX}{day}{SNAPSHOT_SUFFIX}"
    temporary = backup_dir / f".{target.name}.{os.getpid()}.tmp"
    try:
        with contextlib.closing(sqlite3.connect(source, timeout=30)) as source_connection:
            with contextlib.closing(sqlite3.connect(temporary, timeout=30)) as target_connection:
                source_connection.backup(target_connection)
                target_connection.execute("PRAGMA journal_mode=DELETE")
        validate_snapshot(temporary)
        os.replace(temporary, target)
        with contextlib.suppress(OSError):
            target.chmod(0o600)
        cutoff = datetime.fromtimestamp(timestamp, CHINA_TZ).date() - timedelta(
            days=ANALYTICS_BACKUP_RETENTION_DAYS - 1,
        )
        for candidate in _snapshot_files(backup_dir):
            try:
                candidate_day = datetime.strptime(
                    candidate.stem.removeprefix(SNAPSHOT_PREFIX), "%Y-%m-%d",
                ).date()
            except ValueError:
                continue
            if candidate_day < cutoff:
                candidate.unlink(missing_ok=True)
        manifest = {
            "schema": 1,
            "updated_at": timestamp,
            "latest": target.name,
            "retention_days": ANALYTICS_BACKUP_RETENTION_DAYS,
        }
        manifest_tmp = backup_dir / ".manifest.json.tmp"
        manifest_tmp.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        os.replace(manifest_tmp, backup_dir / "manifest.json")
    except (OSError, sqlite3.Error, ValueError):
        with contextlib.suppress(OSError):
            temporary.unlink(missing_ok=True)
        return {"created": False, "reason": "snapshot_failed", **snapshot_status(backup_dir, now=timestamp)}
    return {"created": True, "reason": "created", **snapshot_status(backup_dir, now=timestamp)}


def restore_edge_snapshot(
    source: Path,
    target: Path = EDGE_STATS_DB,
    *,
    apply: bool = False,
    confirm_offline: bool = False,
) -> dict[str, Any]:
    """Validate by default; replace the edge database only with explicit offline confirmation."""
    validation = validate_snapshot(source)
    if not apply:
        return {"applied": False, "validation": validation}
    if not confirm_offline:
        raise ValueError("offline_confirmation_required")
    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if target.is_file():
        pre_restore_dir = ANALYTICS_BACKUP_DIR / "pre-restore"
        pre_restore_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        stamp = datetime.now(CHINA_TZ).strftime("%Y%m%d-%H%M%S")
        pre_restore = pre_restore_dir / f"edge-stats-before-restore-{stamp}.sqlite3"
        with contextlib.closing(sqlite3.connect(target, timeout=30)) as current_connection:
            with contextlib.closing(sqlite3.connect(pre_restore, timeout=30)) as backup_connection:
                current_connection.backup(backup_connection)
        validate_snapshot(pre_restore)
    temporary = target.with_name(f".{target.name}.{os.getpid()}.restore")
    resolved_source = source.resolve(strict=True)
    with contextlib.closing(sqlite3.connect(
        f"file:{resolved_source.as_posix()}?mode=ro&immutable=1", uri=True, timeout=30,
    )) as source_connection:
        with contextlib.closing(sqlite3.connect(temporary, timeout=30)) as target_connection:
            source_connection.backup(target_connection)
    validate_snapshot(temporary)
    os.replace(temporary, target)
    return {"applied": True, "validation": validation}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate or restore 绘域 daily analytics snapshots.")
    parser.add_argument("--source", type=Path, required=True, help="Snapshot .sqlite3 file")
    parser.add_argument("--target", type=Path, default=EDGE_STATS_DB, help="Edge analytics database")
    parser.add_argument("--apply", action="store_true", help="Apply the restore; default is validation only")
    parser.add_argument("--confirm-offline", action="store_true", help="Confirm the edge service is stopped")
    args = parser.parse_args()
    result = restore_edge_snapshot(
        args.source, args.target, apply=args.apply, confirm_offline=args.confirm_offline,
    )
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
