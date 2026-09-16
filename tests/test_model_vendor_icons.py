from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OFFICIAL_ICONS = {
    "alibaba-ai.png",
    "black-forest-labs.png",
    "bytedance.png",
    "google.jpg",
    "minimax.jpg",
    "openai.png",
}
OLD_ICONS = {
    "bytedance.svg",
    "flux.svg",
    "googlegemini.svg",
    "minimax.svg",
    "openai.svg",
    "qwen.svg",
    "wan.svg",
    "zimage.svg",
}


def test_only_official_vendor_icons_are_referenced() -> None:
    icon_dir = ROOT / "frontend" / "static" / "icons"
    source = "\n".join(path.read_text(encoding="utf-8") for path in (
        ROOT / "frontend" / "js" / "app.js",
        ROOT / "frontend" / "pages" / "index.html",
        ROOT / "frontend" / "pages" / "pricing.html",
        ROOT / "frontend" / "pages" / "profile.html",
        ROOT / "frontend" / "pages" / "studio.html",
    ))
    for filename in OFFICIAL_ICONS:
        assert (icon_dir / filename).is_file()
        assert filename in source
    for filename in OLD_ICONS:
        assert not (icon_dir / filename).exists()
        assert filename not in source


def test_model_catalogs_stay_in_the_composer_not_the_sidebar() -> None:
    app = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    catalog = (ROOT / "backend" / "huiju" / "catalog" / "models.py").read_text(encoding="utf-8")
    studio = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    assert '{"id": "image-models", "name": "图像模型"' in catalog
    drawing_group, image_group = catalog.split('{"id": "image-models", "name": "图像模型"', 1)
    assert '"model":' not in drawing_group.rsplit('{"id": "drawing-models"', 1)[1]
    assert '"model":' in image_group.split('{"id": "image-edit"', 1)[0]
    sidebar = app.split("const SIDEBAR_ARCHITECTURE", 1)[1].split("function renderCapabilitySidebar", 1)[0]
    assert '"image-models"' not in sidebar
    assert '"video-models"' not in sidebar
    assert 'data-capability-group="image-models"' not in studio
    assert "<b>图像模型</b>" not in studio
    assert "model-select-trigger" in studio
    assert "drawing-available-models" not in app
    assert "data-model-list-toggle" not in app


def test_video_model_sidebar_uses_official_vendor_icons() -> None:
    app = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    expected = {
        "minimax_h3_max": "/icons/minimax.jpg",
        "seedance_2_0": "/icons/bytedance.png",
        "seedance_2_0_mini": "/icons/bytedance.png",
        "seedance_2_0_fast": "/icons/bytedance.png",
        "seedance_2_5": "/icons/bytedance.png",
        "'wan2.7-t2v-2026-06-12'": "/icons/alibaba-ai.png",
        "'wan2.7-i2v-2026-04-25'": "/icons/alibaba-ai.png",
        "'wan2.7-r2v-2026-06-12'": "/icons/alibaba-ai.png",
    }
    for model, icon in expected.items():
        assert f"{model}: '{icon}'" in app
    assert 'return `<div class="model-select-item${available ? "" : " disabled"}"' in app
    assert '<img src="${escapeMarkup(icon)}" alt="" />' in app


def test_sidebar_is_capability_first() -> None:
    app = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    sidebar = app.split("const SIDEBAR_ARCHITECTURE", 1)[1].split("function renderCapabilitySidebar", 1)[0]
    for group in ("visual-creation", "professional-scenes", "video-creation", "narrative-production", "projects", "help"):
        assert f'id:"{group}"' in sidebar
    assert "sidebarCapabilityGroups" in app
