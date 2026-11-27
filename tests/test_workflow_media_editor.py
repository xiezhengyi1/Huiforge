from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.huiju.api.app import app


ROOT = Path(__file__).resolve().parents[1]
client = TestClient(app)


def test_workflow_media_nodes_share_preview_first_editor_contract() -> None:
    html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    schema = (ROOT / "frontend" / "js" / "features" / "workflow" / "schema.js").read_text(encoding="utf-8")
    api_client = (ROOT / "frontend" / "js" / "core" / "api-client.js").read_text(encoding="utf-8")
    styles = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")

    assert 'id="workflow-node-editor"' in html
    assert 'id="workflow-node-editor-prompt"' in html
    assert 'id="workflow-node-editor-fields"' in html
    assert 'id="workflow-node-editor-credit"' in html
    assert 'id="workflow-node-editor-expand"' in html
    assert 'id="workflow-node-editor-run"' in html
    assert 'id="workflow-node-editor-title"' in html
    assert 'id="workflow-node-editor-close"' in html
    assert 'label:"图片编辑"' in schema
    assert 'label:"视频编辑"' in schema
    assert 'label:"音频编辑"' in schema
    assert '["extract_frame", "抽帧"]' in schema
    assert '["enhance_video", "画质提升"]' in schema
    assert '["trim_video", "截取片段"]' in schema
    assert '["crop_video", "画面裁剪"]' in schema
    assert '["smart_cutout", "智能抠像"]' in schema
    assert '["segment_reshoot", "片段重拍"]' in schema
    assert 'videoTools: "/api/v1/videos/tools"' in api_client
    assert ".workflow-node-result-empty" in styles
    assert ".workflow-node-editor-fields" in styles
    assert "width: 430px" in styles
    assert "width: 920px" in styles
    assert ".workflow-node-editor.is-compact" in styles
    assert "width: max-content;" in styles
    assert 'workflowNodeEditor.classList.toggle("is-compact", !usesNaturalLanguage);' in script
    assert "workflowViewport.append(workflowNodeEditor)" in script
    assert "workflowNodeEditor.style.transform = `scale(${workflowState.zoom})`" in script
    assert "workflowViewport.clientWidth - scaledWidth - 112" in script
    assert "setWorkflowNodeEditorExpanded" in script
    assert 'workflowNodeEditor.style.removeProperty("left")' in script
    assert "clipPath:\"inset(34% 8% 34% 8% round 24px)\"" in script
    assert ".workflow-node-editor.is-expanded" in styles
    assert "z-index: 2800 !important;" in styles
    assert ".workflow-node-editor-prompt textarea:focus { box-shadow: none; }" in styles
    assert "positionWorkflowNodeEditor(node)" in script
    assert "workflowNodeResultProfile(node)" in script
    assert "bindWorkflowNodeEditorActivation(node)" in script
    assert 'button.append(createWorkflowIcon("run"));' in script
    assert styles.count(".studio-page .workflow-node-run-button {") == 1
    assert 'if (!["video_generator", "video_tool"].includes(node?.dataset.nodeType)) return;' in script
    assert "WORKFLOW_EDITOR_RANGE_UNITS" in script
    assert 'field.classList.add("workflow-node-editor-range")' in script
    assert 'className = "workflow-node-editor-range-trigger"' in script
    assert 'className = "workflow-node-editor-range-popover"' in script
    assert 'control.style.setProperty("--workflow-range-progress"' in script
    assert 'control.setAttribute("aria-valuetext", valueText)' in script
    assert ".workflow-node-editor-range-popover input[type=\"range\"]" in styles


def test_workflow_editor_ranges_follow_theme_and_show_progress() -> None:
    audit = (ROOT / "frontend" / "css" / "theme-audit.css").read_text(encoding="utf-8")

    assert ".workflow-node-editor-range-trigger > span" in audit
    assert ".workflow-node-editor-range-popover" in audit
    assert "var(--tv-primary) var(--workflow-range-progress)" in audit
    assert "var(--tv-border) var(--workflow-range-progress)" in audit
    assert 'input[type="range"]::-webkit-slider-thumb' in audit
    assert "background: var(--tv-primary) !important;" in audit
    assert "color: var(--tv-primary-ink) !important;" in audit


def test_image_tool_prompt_is_only_present_for_natural_language_operations() -> None:
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    schema = (ROOT / "frontend" / "js" / "features" / "workflow" / "schema.js").read_text(encoding="utf-8")

    assert 'WORKFLOW_IMAGE_TOOLS_WITH_NATURAL_LANGUAGE = new Set(["edit", "redraw", "interactive"])' in schema
    assert 'const needsPrompt = WORKFLOW_IMAGE_TOOLS_WITH_NATURAL_LANGUAGE.has(tool);' in script
    assert 'if (!needsPrompt && promptControl) promptControl.value = "";' in script
    assert 'promptField.hidden = !usesNaturalLanguage;' in script
    assert 'workflowNodeEditorPrompt.disabled = !usesNaturalLanguage;' in script
    assert 'workflowNodeEditorExpand.hidden = !usesNaturalLanguage;' in script
    assert 'const prompt = WORKFLOW_IMAGE_TOOLS_WITH_NATURAL_LANGUAGE.has(tool) ? String(config.prompt || "").trim() : "";' in script
    assert 'upscale:["resolution"]' in script
    assert '"AI 超分 · 细节增强"' in script


def test_workflow_nodes_share_one_compact_visual_system() -> None:
    script = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    styles = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")

    assert ".workflow-node-dynamic { width:300px; border-top:1px solid" in styles
    assert "width: 430px;\n  padding: 15px;\n  border-top-width: 1px;\n  border-radius: 20px;" in styles
    assert "width:300px; padding:14px; border:1px solid #cbd7ce; border-radius:20px" in styles
    assert "border:1px dashed #aebfb2; border-radius:14px" in styles
    assert ".workflow-node-output { width:300px; }" in styles
    assert "border:1px solid #d5dfd7; border-radius:14px; background:#f4f7f3" in styles
    assert "WORKFLOW_STRUCTURAL_NODE_TYPES.has(node.dataset.nodeType) || node.dataset.editorActivationBound" in script
    assert "article.tabIndex = WORKFLOW_STRUCTURAL_NODE_TYPES.has(type) ? -1 : 0;" in script


def test_reference_composer_keeps_only_the_upload_border() -> None:
    html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    styles = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")
    audit = (ROOT / "frontend" / "css" / "theme-audit.css").read_text(encoding="utf-8")

    assert ".image-tool-grid { display: grid" in styles
    assert "gap: 14px; overflow: visible; border: 0" in styles
    assert ".source-upload-surface { border: 0; }" in styles
    assert "border: 1px dashed #b7cbc0" in styles
    assert ".tool-command-panel textarea" in styles
    assert "min-height: 128px; height: 100%; margin: 0" in styles
    assert "resize: none; border: 0; outline: 0; border-radius: 0; background: transparent" in styles
    assert "border: 1px dashed var(--tv-border-strong) !important;" in audit
    assert "border-top: 0 !important;" in audit
    assert html.index('class="tool-preset-field"') < html.index('class="prompt-actions"')
    command_panel = html[html.index('<div class="tool-command-panel">'):html.index('<div class="source-meta">')]
    assert "tool-preset-field" not in command_panel
    assert 'id="tool-prompt-label" hidden' in command_panel


def test_local_video_frame_extraction_returns_previewable_image() -> None:
    async def fake_create_subprocess_exec(*command: str, **_: object):
        Path(command[-1]).write_bytes(b"\x89PNG\r\n\x1a\nworkflow-frame")

        class Process:
            returncode = 0

            async def communicate(self) -> tuple[bytes, bytes]:
                return b"", b""

        return Process()

    mp4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 64
    with (
        patch("backend.huiju.api.routes.media.shutil.which", return_value="ffmpeg"),
        patch("backend.huiju.api.routes.media.asyncio.create_subprocess_exec", new=fake_create_subprocess_exec),
    ):
        response = client.post(
            "/api/v1/videos/tools",
            data={"operation": "extract_frame", "frame_time": "1"},
            files={"video": ("source.mp4", mp4, "video/mp4")},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert response.content.startswith(b"\x89PNG")


def test_local_video_tool_rejects_non_video_payload() -> None:
    response = client.post(
        "/api/v1/videos/tools",
        data={"operation": "crop_video", "crop_ratio": "16:9"},
        files={"video": ("fake.mp4", b"not-a-video", "video/mp4")},
    )

    assert response.status_code == 415
    assert response.json()["detail"] == "invalid_video"
