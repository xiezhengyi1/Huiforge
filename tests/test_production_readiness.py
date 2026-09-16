from pathlib import Path
import re

from fastapi.testclient import TestClient

from backend.huiju.core.config import MAX_FEEDBACK_SCREENSHOT_BODY_BYTES, RELEASE_ID
from backend.huiju.api.app import app
from backend.huiju.core import preflight
from backend.huiju.core.preflight import main as preflight_main, production_checks


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
client = TestClient(app)


def test_liveness_is_lightweight_versioned_and_cookie_free():
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "2.2.0", "release": RELEASE_ID}
    assert response.headers["x-request-id"]
    assert "huiju_session" not in response.headers.get("set-cookie", "")


def test_workspace_bootstrap_combines_first_paint_data():
    response = client.get("/api/v1/bootstrap")
    assert response.status_code == 200
    payload = response.json()
    assert payload["release"] == RELEASE_ID
    assert {"pricing", "models", "capabilities", "tool_presets", "credits", "user"} <= payload.keys()


def test_readiness_reports_named_checks_without_internal_paths():
    response = client.get("/api/v1/health/ready")
    assert response.status_code in {200, 503}
    payload = response.json()
    assert payload["status"] in {"ready", "starting"}
    assert payload["release"] == RELEASE_ID
    assert set(payload["checks"]) == {
        "database", "generated_storage", "private_storage", "runtime", "workers",
    }
    assert all(isinstance(value, bool) for value in payload["checks"].values())
    assert str(ROOT) not in response.text


def test_cross_site_writes_are_rejected_with_full_security_headers():
    response = client.post(
        "/api/v1/users/logout",
        headers={"Origin": "https://attacker.example", "Sec-Fetch-Site": "cross-site"},
    )
    assert response.status_code == 403
    assert response.json() == {"error": "cross_site_request_blocked"}
    assert response.headers["x-request-id"]
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "huiju_session" not in response.headers.get("set-cookie", "")


def test_same_origin_write_remains_available():
    response = client.post("/api/v1/users/logout", headers={"Origin": "http://testserver"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_large_multipart_body_is_rejected_before_parsing():
    response = client.post(
        "/api/v1/feedback/screenshots",
        headers={
            "Content-Type": "multipart/form-data; boundary=launch-check",
            "Content-Length": str(MAX_FEEDBACK_SCREENSHOT_BODY_BYTES + 1),
        },
        content=b"x",
    )
    assert response.status_code == 413
    assert response.json() == {"error": "request_too_large"}
    assert response.headers["x-request-id"]


def test_all_pages_allow_blob_media_and_publish_the_same_release():
    for name in ("index.html", "studio.html", "profile.html", "pricing.html"):
        html = (FRONTEND / "pages" / name).read_text(encoding="utf-8")
        assert f'<meta name="huiju-release" content="{RELEASE_ID}"' in html, name
        assert "media-src 'self' blob: data:" in html, name


def test_global_service_notice_uses_the_shared_theme_contract():
    script = (FRONTEND / "js" / "theme.js").read_text(encoding="utf-8")
    css = (FRONTEND / "css" / "theme-audit.css").read_text(encoding="utf-8")
    theme_shell = (FRONTEND / "css" / "theme.css").read_text(encoding="utf-8")
    assert 'fetch("/api/v1/health/ready"' in script
    assert 'window.location.protocol === "file:"' in script
    assert "service-health-banner" in script
    assert 'new CustomEvent("huiju:theme-changed"' in script
    assert ".service-health-banner" in css
    assert "var(--tv-surface-raised)" in css
    assert "var(--tv-radius-card)" in css
    assert f'@import url("theme-audit.css?v={RELEASE_ID}") layer(theme);' in theme_shell


def test_theme_set_uses_distinct_semantic_palettes():
    theme_files = {
        "jade": FRONTEND / "css" / "theme.css",
        "indigo": FRONTEND / "css" / "theme-indigo.css",
        "cinnabar": FRONTEND / "css" / "theme-cinnabar.css",
        "monochrome-blue": FRONTEND / "css" / "theme-monochrome-blue.css",
        "monochrome-accent": FRONTEND / "css" / "theme-monochrome-accent.css",
        "graphite-amber": FRONTEND / "css" / "theme-graphite-amber.css",
    }
    expected_primary = {
        "jade": "#315a4a",
        "indigo": "#5d8dff",
        "cinnabar": "#2563eb",
        "monochrome-blue": "#232832",
        "monochrome-accent": "#66b49a",
        "graphite-amber": "#d3a451",
    }
    for theme, path in theme_files.items():
        stylesheet = path.read_text(encoding="utf-8")
        assert "--tv-canvas:" in stylesheet
        assert f"--tv-primary: {expected_primary[theme]};" in stylesheet
        assert "--tv-accent:" in stylesheet
        assert "--tv-sidebar:" in stylesheet

    studio_html = (FRONTEND / "pages" / "studio.html").read_text(encoding="utf-8")
    for label in ("雾松墨绿", "墨蓝珊瑚", "冰川钴蓝", "瓷白石墨", "炭黑鼠尾草", "铁灰琥珀"):
        assert label in studio_html
    assert '"graphite-amber"' in (FRONTEND / "js" / "theme.js").read_text(encoding="utf-8")


def test_preflight_is_secret_safe_and_release_aware():
    result = production_checks()
    assert result["status"] in {"ready", "blocked"}
    assert result["release"] == RELEASE_ID
    assert result["blocking"]["release_consistent"] is True
    assert result["blocking"]["showcase_assets"] is True
    serialized = str(result).lower()
    assert "api_key" not in serialized
    assert str(ROOT).lower() not in serialized
    assert all(isinstance(value, bool) for value in result["blocking"].values())
    assert all(isinstance(value, bool) for value in result["optional"].values())


def test_preflight_blocks_a_release_that_omits_showcase_assets(tmp_path, monkeypatch):
    monkeypatch.setattr(preflight, "STATIC_DIR", tmp_path)
    result = production_checks()
    assert result["blocking"]["showcase_assets"] is False
    assert result["status"] == "blocked"


def test_production_edge_cannot_start_before_preflight_passes():
    script = (ROOT / "deploy" / "run_edge.sh").read_text(encoding="utf-8")
    command = "python -m backend.huiju.core.preflight --static-assets-only"
    assert command in script
    assert script.index(command) < script.index("python -m uvicorn")


def test_static_only_preflight_passes_for_the_complete_release(capsys):
    assert preflight_main(["--static-assets-only"]) == 0
    assert '"showcase_assets": true' in capsys.readouterr().out


def test_versioned_assets_are_browser_cacheable():
    response = client.get(f"/js/app.js?v={RELEASE_ID}")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_showcase_assets_are_static_complete_and_browser_cacheable():
    sources = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (
            FRONTEND / "pages" / "index.html",
            FRONTEND / "pages" / "studio.html",
            FRONTEND / "js" / "app.js",
            FRONTEND / "css" / "home-surface.css",
        )
    )
    references = set(re.findall(r"/static/showcase/v167/[a-z0-9_./-]+\.webp", sources))
    assert len(references) >= 24
    assert "/generated/skill-covers" not in sources
    assert "/generated/plaza-v70" not in sources
    assert len(tuple((FRONTEND / "static/showcase/v167/skills").glob("*.webp"))) == 31
    assert len(tuple((FRONTEND / "static/showcase/v167/plaza").glob("*.webp"))) == 16
    for reference in references:
        assert (FRONTEND / reference.removeprefix("/")).is_file(), reference

    response = client.get("/static/showcase/v167/plaza/tea-still-life.webp")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    video = client.get("/static/showcase/v167/plaza/ocean-cliff-motion.mp4")
    assert video.status_code == 200
    assert video.headers["content-type"] == "video/mp4"
    assert video.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_html_revalidates_while_api_responses_remain_private():
    page = client.get("/studio.html")
    models = client.get("/api/v1/models")
    assert page.headers["cache-control"] == "no-cache, max-age=0, must-revalidate"
    assert models.headers["cache-control"] == "private, no-store"



def test_frontend_etag_supports_zero_body_revalidation():
    first = client.get("/studio.html")
    second = client.get("/studio.html", headers={"If-None-Match": first.headers["etag"]})
    assert first.status_code == 200
    assert second.status_code == 304
    assert second.content == b""
    assert second.headers["etag"] == first.headers["etag"]


def test_workflow_drag_updates_are_coalesced_per_animation_frame():
    script = (FRONTEND / "js" / "app.js").read_text(encoding="utf-8")
    assert "function scheduleWorkflowNodeMove" in script
    assert "function refreshWorkflowLineGeometry" in script
    assert "workflowNodeMoveFrame = requestAnimationFrame" in script
    assert "workflowTransformFrame = requestAnimationFrame" in script
