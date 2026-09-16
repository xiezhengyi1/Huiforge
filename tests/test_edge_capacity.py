from fastapi.testclient import TestClient

from backend.huiju.core.config import RELEASE_ID
from backend.huiju.edge.app import _backend_index, _cookie_header, app


def test_edge_serves_frontend_from_memory_and_issues_session_cookie():
    with TestClient(app) as client:
        response = client.get("/studio.html")
    assert response.status_code == 200
    assert RELEASE_ID in response.text
    assert "huiju_session=" in response.headers["set-cookie"]
    assert response.headers["x-content-type-options"] == "nosniff"


def test_stateful_generation_routes_are_always_pinned_to_backend_zero():
    sessions = [f"{index:032x}" for index in range(100)]
    for session in sessions:
        assert _backend_index("/api/v1/images/generations", session) == 0
        assert _backend_index("/api/v1/videos/generations", session) == 0
        assert _backend_index("/api/v1/audio/tts", session) == 0
        assert _backend_index("/api/v1/private-media/video/job-id", session) == 0
        assert _backend_index("/api/v1/provider-uploads/token", session) == 0


def test_cookie_replacement_keeps_other_cookies_without_duplicate_session():
    header = _cookie_header("theme=green; huiju_session=bad; mode=wide", "a" * 32)
    assert header == f"theme=green; mode=wide; huiju_session={'a' * 32}"
    assert header.count("huiju_session=") == 1
