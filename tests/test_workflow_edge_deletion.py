from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_workflow_edges_have_a_wide_hit_target_and_visible_delete_action():
    html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    stylesheet = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")
    theme_global = (ROOT / "frontend" / "css" / "theme-global.css").read_text(encoding="utf-8")
    theme_audit = (ROOT / "frontend" / "css" / "theme-audit.css").read_text(encoding="utf-8")

    assert 'id="workflow-edge-delete"' in html
    assert 'classList.add("workflow-link-hit")' in script
    assert 'classList.add("workflow-link-visible")' in script
    assert "stroke-width: 18" in stylesheet
    assert ".workflow-edge-delete[hidden]" in stylesheet
    assert "path.workflow-link-hit { stroke: transparent !important; opacity: 0 !important; }" in theme_global
    assert "path:not(.workflow-link-hit)" in theme_audit


def test_mouse_button_and_keyboard_share_one_edge_deletion_path():
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")

    assert "function deleteSelectedWorkflowEdge()" in script
    assert 'workflowEdgeDeleteButton?.addEventListener("click", () => deleteSelectedWorkflowEdge())' in script
    assert 'if (!path || !["Delete", "Backspace"].includes(event.key)) return' in script
    assert script.count("deleteSelectedWorkflowEdge();") >= 2
    assert "syncWorkflowRedrawSources();" in script


def test_workflow_edges_can_be_solid_dashed_or_hidden():
    html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    stylesheet = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")

    assert 'id="workflow-edge-style"' in html
    assert '<option value="solid">实线</option>' in html
    assert '<option value="dashed">虚线</option>' in html
    assert '<option value="hidden">隐藏</option>' in html
    assert 'function setWorkflowEdgeStyle(style)' in script
    assert 'workflowCanvasShell.dataset.edgeStyle = style;' in script
    assert '[data-edge-style="dashed"]' in stylesheet
    assert "stroke-dasharray: 9 7" in stylesheet
    assert '[data-edge-style="hidden"]' in stylesheet
    assert "pointer-events: none" in stylesheet
