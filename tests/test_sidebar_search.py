from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_sidebar_search_covers_workspaces_discovery_and_capabilities():
    html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    stylesheet = (ROOT / "frontend" / "css" / "design-refresh.css").read_text(encoding="utf-8")

    assert 'id="sidebar-search-input"' in html
    assert 'aria-label="搜索功能或页面"' in html
    assert 'id="sidebar-search-results"' in html
    for label in ("主页面", "工作流幕布", "技能推荐", "共绘广场", "工作流分享", "模型说明"):
        assert f'name:"{label}"' in script
    assert "sidebarCapabilityGroups().flatMap" in script
    assert 'sidebarSearchInput?.addEventListener("input", renderSidebarSearch)' in script
    assert 'sidebarSearchInput?.addEventListener("keydown"' in script
    assert 'sidebarSearchResults?.addEventListener("click"' in script
    assert ".sidebar-search-mobile-open .sidebar-search" in stylesheet
