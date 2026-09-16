from pathlib import Path
import time
import uuid

from fastapi.testclient import TestClient

from backend.huiju.api.app import app
from backend.huiju.api.routes import plaza
from backend.huiju.api.schemas import PlazaPostCreateInput
from backend.huiju.persistence.database import UserDatabase


ROOT = Path(__file__).resolve().parents[1]


def test_plaza_post_copies_owned_history_and_serves_only_public_url(tmp_path: Path, monkeypatch):
    database = UserDatabase(tmp_path / "users.sqlite3", tmp_path / "private")
    monkeypatch.setattr(plaza.relay, "database", database)
    monkeypatch.setattr(plaza, "PRIVATE_MEDIA_DIR", tmp_path / "private")
    client = TestClient(app)
    owner = client.get("/api/v1/users/me").json()["device_id"]
    history_id = uuid.uuid4().hex
    source = tmp_path / "private" / "histories" / owner / f"{history_id}.webp"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"RIFFplaza-webp")
    database.add_history(owner, history_id, source.relative_to(tmp_path / "private").as_posix(), "雨夜霓虹", "image", time.time())

    response = client.post("/api/v1/plaza", json={
        "title": "雨夜", "url": f"/api/v1/private-media/history/{history_id}",
        "prompt": "雨夜霓虹", "model": "Qwen", "tags": ["电影"],
    })

    assert response.status_code == 200
    post = response.json()["post"]
    assert post["url"] == f"/api/v1/plaza/{post['id']}/media"
    assert "/private-media/" not in post["url"]
    source.unlink()
    assert client.get(post["url"]).content == b"RIFFplaza-webp"
    assert client.post(f"/api/v1/plaza/{post['id']}/like").json()["liked"] is True
    assert client.get("/api/v1/plaza").json()["items"][0]["likes_count"] == 1


def test_plaza_rejects_non_owner_history_asset_and_video(tmp_path: Path, monkeypatch):
    database = UserDatabase(tmp_path / "users.sqlite3", tmp_path / "private")
    monkeypatch.setattr(plaza.relay, "database", database)
    monkeypatch.setattr(plaza, "PRIVATE_MEDIA_DIR", tmp_path / "private")
    first = TestClient(app)
    second = TestClient(app)
    owner = first.get("/api/v1/users/me").json()["device_id"]
    sources = []
    history_id = uuid.uuid4().hex
    history_path = tmp_path / "private" / "histories" / owner / f"{history_id}.webp"
    sources.append(("history", history_id, history_path))
    asset_id = uuid.uuid4().hex
    asset_path = tmp_path / "private" / "assets" / owner / f"{asset_id}.webp"
    sources.append(("asset", asset_id, asset_path))
    video_id = uuid.uuid4().hex
    video_path = tmp_path / "private" / "videos" / owner / f"{video_id}.mp4"
    sources.append(("video", video_id, video_path))
    for _, _, path in sources:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"owned-media")
    database.add_history(owner, history_id, history_path.relative_to(tmp_path / "private").as_posix(), "", "image", time.time())
    database.create_asset(owner, {
        "id": asset_id, "name": "私人资产", "category_id": "references",
        "media_path": asset_path.relative_to(tmp_path / "private").as_posix(), "prompt": "", "kind": "upload",
        "asset_type": "image", "media_type": "image/webp", "size_bytes": asset_path.stat().st_size, "created_at": time.time(),
    })
    database.create_media_job(owner, video_id, "video", "text_to_video", "seedance_2_0", "", {})
    database.update_media_job(
        video_id, owner, status="completed", media_path=video_path.relative_to(tmp_path / "private").as_posix(), mime_type="video/mp4",
    )

    for kind, source_id, _ in sources:
        response = second.post("/api/v1/plaza", json={
            "title": "别人的作品", "url": f"/api/v1/private-media/{kind}/{source_id}", "model": "绘域",
        })
        assert response.status_code == 404


def test_plaza_contract_accepts_only_owner_scoped_sources():
    assert PlazaPostCreateInput.model_validate({
        "title": "我的视频", "url": f"/api/v1/private-media/video/{'a' * 32}", "model": "Seedance",
    }).title == "我的视频"
    try:
        PlazaPostCreateInput.model_validate({
            "title": "生成图", "url": "/generated/anything.webp", "model": "绘域",
        })
    except ValueError:
        pass
    else:
        raise AssertionError("public generated URLs must not be accepted as plaza sources")
    try:
        PlazaPostCreateInput.model_validate({
            "title": "音频", "url": f"/api/v1/private-media/audio/{'b' * 32}", "model": "绘域",
        })
    except ValueError:
        pass
    else:
        raise AssertionError("audio must not be accepted as a plaza source")


def test_frontend_exposes_workflow_local_publish_and_artwork_publish_contract():
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    page = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    assert 'data-publish-local-workflow' in script
    assert 'publishSavedWorkflow(record)' in script
    saved_workflow_publish = script.split("async function publishSavedWorkflow(record)", 1)[1].split("\n}\n", 1)[0]
    assert "JSON.stringify(record)" not in saved_workflow_publish
    assert "name:record.name, description:record.description, tags:record.tags, graph:record.graph" in saved_workflow_publish
    assert 'openPlazaPublishDialog' in script
    assert 'history_url' in script
    assert 'id="plaza-publish-dialog"' in page
