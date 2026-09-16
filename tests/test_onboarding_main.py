from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def test_main_onboarding_registers_without_auto_starting():
    script = (ROOT / "frontend" / "js" / "onboarding-main.js").read_text(encoding="utf-8")
    assert "window.HuijuOnboardingFlows" not in script  # Uses the CSP-safe IIFE argument.
    assert "global.HuijuOnboardingFlows" in script
    assert "registry.main = flow" in script
    assert 'id: "main-workspace"' in script
    assert 'storageKey: "huiju:onboarding:main-workspace:v1"' in script
    assert "onboarding.start" not in script
    assert ".start()" not in script


def test_main_onboarding_covers_the_complete_creation_journey():
    script = (ROOT / "frontend" / "js" / "onboarding-main.js").read_text(encoding="utf-8")
    step_ids = re.findall(r'^\s{6}id: "([^"]+)",$', script, flags=re.MULTILINE)
    assert step_ids == [
        "capabilities",
        "task-input",
        "model-and-parameters",
        "generate",
        "results",
        "history",
        "credits",
    ]
    for contract in (
        "selector:",
        "fallbackSelectors:",
        "title:",
        "description:",
        "placement:",
        "mobilePlacement:",
        "spotlightPadding:",
        "spotlightRadius:",
    ):
        assert script.count(contract) >= len(step_ids), contract


def test_main_onboarding_primary_selectors_exist_in_studio_markup():
    script = (ROOT / "frontend" / "js" / "onboarding-main.js").read_text(encoding="utf-8")
    html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    selectors = re.findall(r'^\s{6}selector: "([^"]+)",$', script, flags=re.MULTILINE)
    expected_fragments = {
        ".studio-sidebar .capability-nav": 'class="capability-nav"',
        "#generation-form": 'id="generation-form"',
        "#generation-form .prompt-tools": 'class="prompt-tools"',
        "#generate-button": 'id="generate-button"',
        "#quick-workspace .results-panel": 'class="results-panel"',
        "#history-trigger-button": 'id="history-trigger-button"',
        ".studio-topbar .credits-button": 'class="credits-button credits-link"',
    }
    assert selectors == list(expected_fragments)
    for selector, fragment in expected_fragments.items():
        assert fragment in html, selector


def test_main_onboarding_handles_hidden_and_responsive_targets_accessibly():
    script = (ROOT / "frontend" / "js" / "onboarding-main.js").read_text(encoding="utf-8")
    assert "firstVisible" in script
    assert 'element.getAttribute("aria-hidden") === "true"' in script
    assert 'style.display !== "none"' in script
    assert 'style.visibility !== "hidden"' in script
    assert "mobilePlacement" in script
    assert 'ariaLabel: "主工作区新手引导"' in script
    assert 'doc.body.classList.contains("workflow-active")' in script
    assert 'detail: { key: "main", flow }' in script
