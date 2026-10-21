from pathlib import Path

from backend.huiju.core.config import FRONTEND_ASSETS


ROOT = Path(__file__).resolve().parents[1]


def test_onboarding_assets_are_public_and_loaded_after_workspace_code():
    required = {"css/onboarding.css", "js/onboarding.js", "js/onboarding-main.js", "js/onboarding-workflow.js"}
    assert required <= FRONTEND_ASSETS
    html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    assert 'href="css/onboarding.css?v=' in html
    assert html.index('src="js/app.js?') < html.index('src="js/onboarding-main.js?')
    assert html.index('src="js/onboarding-main.js?') < html.index('src="js/onboarding-workflow.js?')
    assert html.index('src="js/onboarding-workflow.js?') < html.index('src="js/onboarding.js?')


def test_onboarding_controller_has_first_run_state_accessibility_and_replay():
    script = (ROOT / "frontend" / "js" / "onboarding.js").read_text(encoding="utf-8")
    stylesheet = (ROOT / "frontend" / "css" / "onboarding.css").read_text(encoding="utf-8")
    for contract in (
        "localStorage.getItem",
        "localStorage.setItem",
        'role="dialog"',
        'aria-modal="true"',
        "ArrowRight",
        "ArrowLeft",
        "Escape",
        "huiju:onboarding-identity",
        "huiju:workspace-view",
        "onboarding-replay",
        "state.transitioning",
        "nextButton.disabled",
        'popover.addEventListener("click"',
        'event.target.closest("button")',
    ):
        assert contract in script
    assert "onboarding-focus-ring" in stylesheet
    assert "9999px" in stylesheet
    assert "onboarding-popover::before" in stylesheet
    assert "onboarding-click-hint" in stylesheet
    assert "prefers-reduced-motion" in stylesheet


def test_workspace_emits_view_and_per_user_identity_events():
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    assert 'new CustomEvent("huiju:workspace-view"' in script
    assert 'new CustomEvent("huiju:onboarding-identity"' in script
    assert "body?.profile?.user_id || body?.device_id" in script


def test_asset_library_blends_into_the_workspace_canvas():
    audit = (ROOT / "frontend" / "css" / "theme-audit.css").read_text(encoding="utf-8")
    global_theme = (ROOT / "frontend" / "css" / "theme-global.css").read_text(encoding="utf-8")
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    assert ".studio-page.asset-active" in audit
    assert ".studio-content, .asset-workspace, .asset-library-layout, .asset-library-content" in audit
    assert "background: transparent !important;" in audit
    assert ".asset-workspace,.asset-workspace-head,.asset-library-toolbar,.asset-card," not in audit
    assert "  .capability-center, .capability-tool-workspace,\n  .workflow-library-panel" in global_theme
    assert 'workspace") === "assets")' in script


def test_asset_categories_are_a_top_navigation_menu():
    html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    stylesheet = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")
    layout = (ROOT / "frontend" / "css" / "layout.css").read_text(encoding="utf-8")
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    assert '<nav class="asset-category-menu" aria-label="资产分类">' in html
    assert "asset-category-rail" not in html
    assert ".asset-category-menu { display: flex;" in stylesheet
    assert ".asset-library-layout { min-height:" in stylesheet
    assert "assetCategoryIconMarkup" not in script
    assert '@import url("studio.css?v=' in layout
    assert '") layer(base);' in layout


