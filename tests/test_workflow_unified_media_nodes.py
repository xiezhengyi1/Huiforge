from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.huiju.api.schemas import WorkflowGraphInput


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
SCHEMA = (ROOT / "frontend" / "js" / "features" / "workflow" / "schema.js").read_text(encoding="utf-8")
STYLES = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")


def test_workflow_picker_exposes_one_media_input_and_one_media_output() -> None:
    templates = SCHEMA.split("export const WORKFLOW_NODE_TEMPLATES", 1)[1].split("export const WORKFLOW_NODE_TYPES", 1)[0]
    assert templates.count('type:"media_input"') == 1
    assert templates.count('type:"media_output"') == 1
    for legacy_type in (
        "image_input", "asset_image", "video_input", "audio_input",
        "image_output", "video_output", "audio_output",
    ):
        assert f'type:"{legacy_type}"' not in templates
    assert 'label:"输入"' in templates
    assert 'label:"输出"' in templates
    assert 'key:"input_type"' in templates
    assert 'key:"output_type"' in templates


def test_image_generation_and_editing_share_the_image_category() -> None:
    assert 'image: { label:"图片"' in SCHEMA
    assert 'type:"image_generator", category:"image"' in SCHEMA
    assert 'type:"image_tool", category:"image"' in SCHEMA
    assert '[data-node-category="image"]' in STYLES


def test_unified_media_nodes_switch_ports_previews_and_formats() -> None:
    assert 'function syncWorkflowStructuralMediaNode(node)' in SCRIPT
    assert 'branch.dataset.workflowInputBranch !== mediaType' in SCRIPT
    assert 'port.dataset.portName !== mediaType' in SCRIPT
    assert 'image:new Set(["png", "webp", "jpg"])' in SCRIPT
    assert 'video:new Set(["mp4", "webm"])' in SCRIPT
    assert 'audio:new Set(["wav"])' in SCRIPT
    assert 'createWorkflowUnifiedInputBody(article)' in SCRIPT


def test_workflow_accepts_only_the_current_node_schema() -> None:
    assert "WORKFLOW_LEGACY_NODE_MAP" not in SCRIPT
    assert "migrateLegacyWorkflowGraph" not in SCRIPT
    assert 'type:"text_to_image"' not in SCHEMA
    assert 'type:"text_to_video"' not in SCHEMA
    assert 'type:"video_depth"' not in SCHEMA


def test_workflow_api_schema_accepts_the_current_graph_only() -> None:
    graph = WorkflowGraphInput.model_validate({
        "version": 6,
        "nodes": [{
            "id": "image-input", "type": "media_input", "category": "input",
            "x": 0, "y": 0, "config": {"input_type": "image"},
        }],
    })
    assert graph.version == 6
    assert graph.nodes[0].type == "media_input"
    with pytest.raises(ValidationError):
        WorkflowGraphInput.model_validate({
            "version": 4,
            "nodes": [{
                "id": "old-input", "type": "image_input", "category": "input",
                "x": 0, "y": 0,
            }],
        })


def test_runtime_dispatches_by_selected_input_and_output_type() -> None:
    assert 'if (type === "media_input")' in SCRIPT
    assert 'config.input_type' in SCRIPT
    assert 'if (type === "media_output")' in SCRIPT
    assert 'config.output_type' in SCRIPT
    assert 'renderWorkflowMediaOutput(node, outputValue, outputType)' in SCRIPT
    assert 'nodeConfig.output_type = sourceType' in SCRIPT
