from fastapi.testclient import TestClient

from backend.huiju.api.app import app
from backend.huiju.api.routes import system


def test_video_workflows_expose_executable_actions_with_existing_credentials(monkeypatch):
    monkeypatch.setattr(system, "DASHSCOPE_API_KEY", "test-key")
    monkeypatch.setattr(system, "ARK_AGENT_API_KEY", "test-key")
    monkeypatch.setattr(system, "MEDIA_WORKER_ENABLED", True)
    monkeypatch.setattr(system.shutil, "which", lambda name: name)
    items = {item["id"]: item for group in TestClient(app).get("/api/v1/capabilities").json()["groups"] for item in group["items"]}
    for kind in ("viral-remake", "video-dubbing"):
        assert items[kind]["action"] == "video_workflow"
        assert items[kind]["ready"] is True


def test_video_workflows_do_not_claim_ready_without_speech_credentials(monkeypatch):
    monkeypatch.setattr(system, "DASHSCOPE_API_KEY", "")
    items = {item["id"]: item for group in TestClient(app).get("/api/v1/capabilities").json()["groups"] for item in group["items"]}
    assert items["viral-remake"]["ready"] is False
    assert items["video-dubbing"]["ready"] is False
