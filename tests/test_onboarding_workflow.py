from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "js" / "onboarding-workflow.js"


def test_workflow_onboarding_is_a_standalone_registered_flow():
    text = SOURCE.read_text(encoding="utf-8")

    assert "global.HuijuOnboardingFlows" in text
    assert "registry.workflow = workflow" in text
    assert 'id: FLOW_ID' in text
    assert "version: FLOW_VERSION" in text
    assert "prepare: prepareWorkflow" in text
    assert "onExit: finishWorkflowOnboarding" in text
    assert "module.exports = workflow" in text
    assert "DOMContentLoaded" not in text


def test_workflow_onboarding_covers_the_required_journey_with_stable_targets():
    text = SOURCE.read_text(encoding="utf-8")
    required_selectors = {
        '"#workflow-canvas-shell"',
        '"#workflow-node-picker"',
        '"#workflow-import"',
        'data-workflow-library-tab="shared"',
        'workflow-node-dynamic:not([data-node-category=',
        'data-workflow-run-node',
        '[data-port-direction="output"]',
        '"#workflow-run"',
        '"#workflow-share"',
        '".studio-topbar .credits-button.credits-link"',
    }

    for selector in required_selectors:
        assert selector in text

    assert text.count("title:") >= 10
    assert text.count("description:") >= 10
    assert text.count("placement:") >= 10
    assert text.count("mobilePlacement:") >= 10
    assert text.count("optional:") >= 10
    assert text.count("targetMissing:") >= 10

    assert text.index('id: "workflow-import-json"') < text.index('id: "workflow-community-library"')
    assert text.index('id: "workflow-community-library"') < text.index('id: "workflow-node-library"')
    assert text.index('id: "workflow-node-options"') < text.index('id: "workflow-run-node"')
    assert text.index('id: "workflow-run-node"') < text.index('id: "workflow-run"')


def test_node_picker_is_revealed_without_mutating_the_workflow_graph():
    text = SOURCE.read_text(encoding="utf-8")

    assert "beforeShow: revealNodePicker" in text
    assert 'new MouseEvent("dblclick"' in text
    assert "pickerOpenedByTour" in text
    assert "closeTourPicker" in text
    assert "revealNodeControls" in text
    assert 'querySelector("#workflow-fit")?.click()' in text
    assert "createDynamicWorkflowNode" not in text
    assert "workflowEdges" not in text


def test_workflow_onboarding_defensively_handles_missing_and_responsive_targets():
    text = SOURCE.read_text(encoding="utf-8")

    assert "if (!workspace) return false" in text
    assert "if (!picker) return false" in text
    assert "if (!visible(viewport)) return false" in text
    assert 'targetMissing: "skip"' in text
    assert 'targetMissing: "use-fallback"' in text
    assert "fallbackSelector" in text
    assert 'ariaLabel: "工作流幕布新手引导"' in text
