from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
SCRIPT = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
CSS = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")
DESIGN_REFRESH_CSS = (ROOT / "frontend" / "css" / "design-refresh.css").read_text(encoding="utf-8")
THREE_MODULE = (ROOT / "frontend" / "js" / "vendor" / "three.module.js").read_text(encoding="utf-8")
THREE_CORE = (ROOT / "frontend" / "js" / "vendor" / "three.core.js").read_text(encoding="utf-8")


def test_unified_media_composers_keep_the_source_upload_and_instruction_panel() -> None:
    assert 'id="source-image-group"' in HTML
    assert 'id="source-image" type="file"' in HTML
    assert 'class="tool-command-panel"' in HTML
    assert 'document.querySelector(".tool-command-panel")?.toggleAttribute("hidden", isAudioMode(mode) && !AUDIO_SOURCE_MODES.has(mode));' in SCRIPT
    assert 'document.querySelector(".tool-command-panel")?.toggleAttribute("hidden", unified ||' not in SCRIPT


def test_unified_media_uses_the_visible_source_instruction_as_its_prompt() -> None:
    assert 'if (UNIFIED_MODES.has(activeMode)) return toolPromptInput?.value.trim() || promptInput.value.trim();' in SCRIPT


def test_unified_image_prompt_matches_the_flat_reference_composer() -> None:
    assert 'min-height: 196px !important' not in DESIGN_REFRESH_CSS
    assert 'padding: 18px !important' not in DESIGN_REFRESH_CSS
    assert 'min-height: 168px !important' in DESIGN_REFRESH_CSS
    assert 'padding: 10px 2px !important' in DESIGN_REFRESH_CSS
    assert 'background: transparent !important' in DESIGN_REFRESH_CSS


def test_studio_account_controls_use_a_transparent_chrome() -> None:
    assert '.studio-page .studio-topbar { min-height: 0; padding: 0; border: 0; background: transparent;' in DESIGN_REFRESH_CSS
    assert '.studio-page .studio-topbar :is(.theme-picker-trigger,.credits-button)' in DESIGN_REFRESH_CSS


def test_community_publish_actions_remain_primary_controls() -> None:
    assert ':is(#plaza-open-history,#workflow-discovery-publish)' in DESIGN_REFRESH_CSS
    assert 'background: var(--tv-primary) !important' in DESIGN_REFRESH_CSS


def test_unified_media_composer_has_no_route_banner_or_unified_entry_tag() -> None:
    assert 'id="unified-route-note"' not in HTML
    for label in ('AI 生图 · 统一入口', 'AI 生视频 · 统一入口', 'AI 配音 · 统一入口'):
        assert label not in SCRIPT


def test_studio_loads_the_source_upload_composer_from_the_module_directory() -> None:
    assert 'js/app.js?v=20260909-workflow-svg-v43' in HTML


def test_workflow_discovery_deep_link_waits_for_its_module_constants() -> None:
    early = 'showDiscovery(requestedDiscovery === "workflows" ? "skills" : (requestedDiscovery || "skills"));'
    late = 'if (requestedDiscovery === "workflows") showDiscovery("workflows");'
    assert early in SCRIPT
    assert late in SCRIPT
    assert SCRIPT.index("const workflowDiscoveryGrid") < SCRIPT.index(late)


def test_multiangle_stage_uses_the_threejs_coordinate_workspace() -> None:
    assert 'id="camera-stage"' in HTML
    assert 'class="camera-axis-legend"' in HTML
    for label in ("X · 正面", "Y · 右侧", "Z · 上方"):
        assert label in HTML
    assert 'import("./vendor/three.module.js?v=20260904-threejs-r185-1")' in SCRIPT
    assert 'import("./vendor/OrbitControls.js?v=20260904-threejs-r185-1")' in SCRIPT
    assert "new THREE.GridHelper" in SCRIPT
    assert "new THREE.ArrowHelper" in SCRIPT
    assert "new OrbitControls" in SCRIPT
    assert "depthWrite: false" in SCRIPT
    assert "previewPlane.renderOrder = 1;" in SCRIPT
    assert "const render = () => renderer.render(scene, viewCamera);" in SCRIPT
    assert "controls.enableDamping" not in SCRIPT
    assert "from './three.core.js?v=20260904-threejs-r185-1'" in THREE_MODULE
    assert "class Vector3" in THREE_CORE
    assert "const planarRadius = radius * Math.cos(elevationRadians);" in SCRIPT
    assert "planarRadius * Math.cos(radians)" in SCRIPT
    assert "planarRadius * Math.sin(radians)" in SCRIPT
    assert "cameraWorkspace.previewPlane.visible = isImage;" in SCRIPT
    assert "syncCameraSourcePreview();\n  resize();" in SCRIPT
    assert 'if (mode === "multiangle") void initializeCameraWorkspace().then(updateCamera);' in SCRIPT
    assert "new ResizeObserver(resize).observe(cameraStage);" in SCRIPT
    assert "  resize();" in SCRIPT
    assert "requestAnimationFrame(resize);" in SCRIPT
    assert 'renderer.domElement.addEventListener("pointercancel", finishCameraDrag, true);' in SCRIPT
    assert 'renderer.domElement.addEventListener("lostpointercapture", finishCameraDrag, true);' in SCRIPT
    assert "event.stopImmediatePropagation();" in SCRIPT
    assert "const dragPlane = new THREE.Plane();" in SCRIPT
    assert "dragPlane.setFromNormalAndCoplanarPoint(dragPlane.normal, cameraRig.position);" in SCRIPT
    assert "const azimuth = Math.atan2(orbitVector.y, orbitVector.x) * 180 / Math.PI;" in SCRIPT
    assert "Number(cameraAzimuth.value) + (event.clientX - lastPointer.x)" not in SCRIPT
    assert "const targetSurfaceDistance = .85 / Math.max" in SCRIPT
    assert "cameraWorkspace.beam.position.x = beamStart + beamLength / 2;" in SCRIPT
    assert "viewCamera.position.set(7, 8, 6.4);" in SCRIPT
    assert "#camera-stage.camera-stage-viewport" in CSS
    assert ".camera-axis-legend" in CSS
    assert "function applyCameraTheme()" in SCRIPT
    assert 'window.addEventListener("huiju:theme-changed", applyCameraTheme);' in SCRIPT
    assert 'styles.getPropertyValue("--tv-primary")' in SCRIPT
    assert "createCameraGrid(colors)" in SCRIPT
    assert "var(--tv-primary)" in CSS
    assert '.camera-controls input[type="range"] { accent-color: var(--tv-primary); }' in (ROOT / "frontend" / "css" / "theme-variant-base.css").read_text(encoding="utf-8")


def test_workflow_image_tool_selects_its_capability_and_opens_three_dimensional_multiangle_controls_on_the_node() -> None:
    assert "function createWorkflowInlineToolPicker(article)" in SCRIPT
    assert "data-workflow-inline-tool" in SCRIPT
    assert "function syncWorkflowCameraWorkbench(node)" in SCRIPT
    assert "workflowCameraWorkspaces" in SCRIPT
    assert "function createWorkflowCameraWorkbench(node)" in SCRIPT
    assert "function openWorkflowCameraWorkbenchFocus(workspace)" in SCRIPT
    assert '"放大三维机位"' in SCRIPT
    assert 'value === "multiangle"' in SCRIPT
    assert ".workflow-camera-workbench" in CSS
    assert ".workflow-camera-focus-dialog" in CSS
    assert 'workflow-node-dynamic[data-node-type="image_tool"] > .workflow-inline-tool-picker' in CSS


