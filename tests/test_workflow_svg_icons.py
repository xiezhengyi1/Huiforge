from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
SCRIPT = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
SCHEMA = (ROOT / "frontend" / "js" / "features" / "workflow" / "schema.js").read_text(encoding="utf-8")
CSS = (ROOT / "frontend" / "css" / "design-refresh.css").read_text(encoding="utf-8")


def test_workflow_template_icons_use_semantic_svg_names() -> None:
    for icon in (
        "input",
        "image-generate",
        "image-edit",
        "video-generate",
        "video-edit",
        "audio-generate",
        "audio-edit",
        "output",
        "text",
    ):
        assert f'icon:"{icon}"' in SCHEMA
    for glyph in ("＋", "✦", "◩", "▶", "⌁", "⇩", "T"):
        assert f'icon:"{glyph}"' not in SCHEMA


def test_dynamic_workflow_nodes_render_svg_icons() -> None:
    assert "const WORKFLOW_ICON_SVGS = Object.freeze({" in SCRIPT
    assert 'document.createElementNS("http://www.w3.org/2000/svg", "svg")' in SCRIPT
    assert "icon.append(createWorkflowIcon(template.icon));" in SCRIPT
    assert 'remove.append(createWorkflowIcon("close"));' in SCRIPT
    assert 'button.append(createWorkflowIcon("run"));' in SCRIPT
    assert "icon.textContent = template.icon;" not in SCRIPT


def test_initial_workflow_nodes_have_no_character_icons() -> None:
    canvas = HTML.split('class="workflow-board"', 1)[1].split('class="workflow-node-picker"', 1)[0]
    assert canvas.count('data-workflow-icon="drag"') == 4
    for icon in ("input", "image-edit", "upscale", "output", "spark"):
        assert f'data-workflow-icon="{icon}"' in canvas
    for glyph in (">＋<", ">◩<", ">↗<", ">⇩<", ">⠿<", ">✦<"):
        assert glyph not in canvas


def test_workflow_svg_icons_share_one_visual_language() -> None:
    assert ".studio-page .workflow-svg-icon {" in CSS
    assert "stroke-width:1.7" in CSS
    assert ".studio-page .workflow-svg-icon-drag circle { fill:currentColor; stroke:none; }" in CSS
    assert 'data-workflow-icon="close"' in HTML
    assert 'data-workflow-icon="run"' in HTML
