from pathlib import Path
import time
import uuid

from fastapi.testclient import TestClient

from backend.huiju.persistence.database import UserDatabase
from backend.huiju.api.app import app
from backend.huiju.api.routes import users


ROOT = Path(__file__).resolve().parents[1]


def database_at(tmp_path: Path) -> UserDatabase:
    return UserDatabase(
        tmp_path / "users.sqlite3",
        tmp_path / "private",
    )


def test_history_deletion_is_owner_scoped(tmp_path: Path):
    database = database_at(tmp_path)
    record_id = "1" * 32
    database.add_history("owner-a", record_id, "histories/owner-a/work.webp", "提示词", "image", time.time())

    assert database.delete_history("owner-b", record_id) is False
    assert len(database.histories_for("owner-a")) == 1
    assert database.delete_history("owner-a", record_id) is True
    assert database.histories_for("owner-a") == []


def test_asset_deletion_is_owner_scoped(tmp_path: Path):
    database = database_at(tmp_path)
    record_id = "2" * 32
    database.create_asset("owner-a", {
        "id": record_id,
        "name": "参考图",
        "category_id": "references",
        "media_path": "assets/owner-a/work.webp",
        "prompt": "",
        "kind": "upload",
        "asset_type": "image",
        "media_type": "image/webp",
        "size_bytes": 12,
        "created_at": time.time(),
    })

    assert database.delete_asset("owner-b", record_id) is False
    assert len(database.assets_for("owner-a")) == 1
    assert database.delete_asset("owner-a", record_id) is True
    assert database.assets_for("owner-a") == []


def test_membership_lookup_does_not_create_a_guest_wallet(tmp_path: Path):
    database = database_at(tmp_path)
    assert database.membership_for("guest-owner") == {
        "membership_tier": "free", "membership_expires_at": None,
    }
    with database._connect() as connection:
        assert connection.execute(
            "SELECT 1 FROM wallets WHERE owner_id=?", ("guest-owner",),
        ).fetchone() is None


def test_delete_routes_hide_malformed_record_ids():
    client = TestClient(app)
    assert client.delete("/api/v1/assets/not-an-id").status_code == 404
    assert client.delete("/api/v1/users/history/not-an-id").status_code == 404


def test_delete_routes_remove_owned_private_files(tmp_path: Path, monkeypatch):
    database = database_at(tmp_path)
    monkeypatch.setattr(users.relay, "database", database)
    client = TestClient(app)
    owner = client.get("/api/v1/users/me").json()["device_id"]

    asset_id = uuid.uuid4().hex
    asset_file = tmp_path / "private" / "assets" / owner / f"{asset_id}.webp"
    asset_file.parent.mkdir(parents=True)
    asset_file.write_bytes(b"asset")
    database.create_asset(owner, {
        "id": asset_id, "name": "待删除资产", "category_id": "references",
        "media_path": asset_file.relative_to(tmp_path / "private").as_posix(),
        "prompt": "", "kind": "upload", "asset_type": "image",
        "media_type": "image/webp", "size_bytes": asset_file.stat().st_size,
        "created_at": time.time(),
    })
    response = client.delete(f"/api/v1/assets/{asset_id}")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert not asset_file.exists()

    history_id = uuid.uuid4().hex
    history_file = tmp_path / "private" / "histories" / owner / f"{history_id}.webp"
    history_file.parent.mkdir(parents=True)
    history_file.write_bytes(b"history")
    database.add_history(
        owner, history_id, history_file.relative_to(tmp_path / "private").as_posix(),
        "提示词", "image", time.time(),
    )
    response = client.delete(f"/api/v1/users/history/{history_id}")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert not history_file.exists()


def test_frontend_uses_inline_confirmation_instead_of_native_confirm():
    app_script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    profile_script = (ROOT / "frontend" / "js" / "profile.js").read_text(encoding="utf-8")
    assert 'remove.className = "asset-delete"' in app_script
    assert 'method: "DELETE"' in app_script
    assert "profile-history-delete" in profile_script
    assert 'method:"DELETE"' in profile_script
    asset_delete_block = app_script.split('remove.className = "asset-delete"', 1)[1].split(
        "actions.append(workflow, download, remove)", 1,
    )[0]
    assert "window.confirm" not in asset_delete_block
    assert "window.confirm" not in profile_script
