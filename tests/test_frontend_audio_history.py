import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FrontendAudioHistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
        cls.css = (ROOT / "frontend" / "css" / "studio.css").read_text(encoding="utf-8")
        cls.mode_rules = (ROOT / "frontend" / "js" / "features" / "generation" / "mode-rules.js").read_text(encoding="utf-8")
        cls.workflow_schema = (ROOT / "frontend" / "js" / "features" / "workflow" / "schema.js").read_text(encoding="utf-8")

    def test_history_supports_scroll_and_pointer_drag(self):
        self.assertIn('historyList.addEventListener("pointerdown"', self.app)
        self.assertIn('historyList.addEventListener("pointermove"', self.app)
        self.assertIn("historyList.scrollTop", self.app)
        self.assertIn("overflow-y: auto", self.css)
        self.assertIn(".history-list.is-drag-scrolling", self.css)
        self.assertIn("grid-auto-rows: max-content", self.css)
        self.assertIn(".history-panel .history-preview { display: block; width: 100%; height: 150px", self.css)

    def test_floating_dropdown_stays_open_during_internal_scroll(self):
        self.assertIn("const insideFloatingMenu = target instanceof Node", self.app)
        self.assertIn("modelSelectMenu?.contains(target) || outputSettingsMenu?.contains(target)", self.app)
        self.assertIn("if (insideFloatingMenu) return;", self.app)

    def test_audio_sidebar_routes_to_main_composer(self):
        self.assertIn("item.action === \"audio_mode\"", self.app)
        self.assertIn("AUDIO_SOURCE_MODES.has(item.mode)", self.app)
        self.assertIn('[data-mode="audio_reference"]', self.css)
        self.assertIn('[data-mode="audio_custom_voice"]', self.css)
        self.assertIn('[data-mode="audio_image"]', self.css)

    def test_workflow_audio_node_binds_all_three_abilities(self):
        for ability in ("text_dubbing", "custom_voice", "image_dubbing", "reference_audio"):
            self.assertIn(ability, self.app)
        self.assertIn('[data-node-field="ability"]', self.app)
        self.assertIn('showPorts(ability === "image_dubbing" ? ["text","image"]', self.app)
        self.assertIn('ability === "reference_audio" ? ["text","audio"]', self.app)

    def test_uploaded_audio_and_video_are_playable_in_both_surfaces(self):
        self.assertIn('sourceVideoPreview?.removeAttribute("muted")', self.app)
        self.assertIn('sourceAudioPreview.controls = true', self.app)
        self.assertIn('preview.controls = true', self.app)
        self.assertIn('preview.addEventListener("pointerdown", (event) => event.stopPropagation())', self.app)
        self.assertIn('.workflow-node-upload-video.has-image > span', self.css)
        self.assertIn('.workflow-node-upload-audio.has-image > span', self.css)
        self.assertIn('sourceVideoPreview.load()', self.app)
        self.assertIn('preview.load()', self.app)
        self.assertIn('uploadMediaPreviewBlob(file, file.name)', self.app)
        media_router = (ROOT / "backend" / "huiju" / "api" / "routes" / "media.py").read_text(encoding="utf-8")
        self.assertIn('/api/v1/media/uploads/{upload_id}/preview', media_router)
        self.assertIn('"preview_url":', media_router)

    def test_video_and_audio_outputs_accept_generated_uploaded_and_local_media(self):
        self.assertIn('function safeWorkflowMediaUrl(value)', self.app)
        self.assertIn('/media\\/uploads\\/[a-f0-9]{32}\\/preview$', self.app)
        self.assertIn('url.protocol === "blob:"', self.app)
        self.assertIn('const mediaUrl = safeWorkflowMediaUrl(value?.url || value || "")', self.app)
        self.assertIn('media.addEventListener("error"', self.app)
        self.assertIn('media.load()', self.app)

    def test_capability_media_is_cached_and_custom_voices_are_assets(self):
        self.assertIn('const sourceStateByCapability = new Map()', self.app)
        self.assertIn('cacheCurrentSourceState()', self.app)
        self.assertIn('restoreCachedSourceState(nextKey, maxSourceFiles)', self.app)
        self.assertIn('previewUrls:sourcePreviewUrls.map', self.app)
        self.assertIn('cached.previewUrls?.[index] || URL.createObjectURL(file)', self.app)
        self.assertIn('assetType:"voice"', self.app)
        self.assertIn("asset.assetType === 'voice'", self.app)
        self.assertIn("selectedVoice.startsWith('asset:')", self.app)

    def test_all_image_to_image_modes_keep_the_source_input_visible(self):
        self.assertIn('function modeUsesSourceInput(mode)', self.app)
        self.assertIn('if (mode === "text" || mode === "video_text") return false', self.app)
        self.assertIn('if (AUDIO_MODES.has(mode)) return AUDIO_SOURCE_MODES.has(mode)', self.app)
        self.assertIn('sourceImageGroup.hidden = !modeUsesSourceInput(mode)', self.app)
        self.assertNotIn('sourceImageGroup.hidden = !VIDEO_IMAGE_MODES.has(mode)', self.app)

    def test_text_to_audio_uses_the_same_composer_shape_as_text_to_video(self):
        self.assertIn(':is([data-mode="video_text"],[data-mode="audio_tts"])', self.css)
        self.assertIn('.source-save-voice-button', self.css)
        self.assertIn('sourceSaveVoiceButton.textContent = "保存音色"', self.app)

    def test_source_audio_uses_two_column_media_and_text_composer(self):
        self.assertIn('function configureToolPrompt(mode)', self.app)
        self.assertIn('label:"配音文字"', self.app)
        self.assertIn('label:"旁白文字（选填）"', self.app)
        self.assertIn('if (AUDIO_SOURCE_MODES.has(activeMode)) return toolPromptInput?.value.trim() || ""', self.app)
        self.assertIn('isAudioMode(mode) && !AUDIO_SOURCE_MODES.has(mode)', self.app)
        self.assertIn(':is([data-mode="audio_reference"],[data-mode="audio_custom_voice"],[data-mode="audio_image"]) .prompt-group', self.css)
        self.assertIn(':is([data-mode="audio_reference"],[data-mode="audio_custom_voice"],[data-mode="audio_image"]) .tool-command-panel', self.css)
        self.assertIn('grid-template-columns: 1fr', self.css)

    def test_custom_voice_is_text_described_with_optional_reference_audio(self):
        html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
        self.assertIn('id="custom-voice-preview-text"', html)
        self.assertIn('value="欢迎使用绘域"', html)
        self.assertIn('label:"音色描述"', self.app)
        self.assertIn('AUDIO_REQUIRED_SOURCE_MODES = new Set(["audio_reference", "audio_image"])', self.mode_rules)
        self.assertIn('AUDIO_REFERENCE_MODES = new Set(["audio_reference", "audio_custom_voice"])', self.mode_rules)
        self.assertIn("speechText = customVoicePreviewInput?.value.trim() || DEFAULT_CUSTOM_VOICE_PREVIEW", self.app)
        self.assertIn("activeMode === 'audio_custom_voice'\n            ? prompt", self.app)
        self.assertIn('{ key:"voice_description", label:"音色描述"', self.workflow_schema)
        self.assertIn('{ key:"preview_text", label:"试听文案", kind:"text", value:"欢迎使用绘域" }', self.workflow_schema)

    def test_generated_audio_can_be_saved_as_voice_preset(self):
        self.assertIn("saveVoicePreset", self.app)
        self.assertIn("设为预设音色", self.app)
        self.assertIn("assetType:'voice'", self.app)
        self.assertIn("kind:'generated_voice'", self.app)
        self.assertIn("updateAudioVoiceOptions()", self.app)

    def test_image_editor_can_save_canvas_to_assets(self):
        html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
        self.assertIn('id="local-tool-save-asset"', html)
        self.assertIn('localToolSaveAsset?.addEventListener("click"', self.app)
        self.assertIn('localToolCanvas.toBlob(resolve, format, quality)', self.app)
        self.assertIn('kind:`image_editor_${activeClientTool}`', self.app)

    def test_csp_allows_local_media_previews(self):
        middleware = (ROOT / "backend" / "huiju" / "api" / "middleware.py").read_text(encoding="utf-8")
        self.assertIn("media-src 'self' blob: data:", middleware)

    def test_workflow_overlay_controls_do_not_collide(self):
        self.assertIn(".studio-page dialog > .dialog-close", self.css)
        self.assertIn("padding-right: 54px", self.css)
        self.assertIn("min-width: max-content", self.css)
        self.assertIn("white-space: nowrap", self.css)
        self.assertIn(".workflow-node-dynamic .workflow-output-preview", self.css)
        self.assertIn("margin-top: 12px", self.css)

    def test_workflow_model_select_uses_clean_workspace_labels(self):
        self.assertIn("return option.dataset.baseLabel || option.textContent || option.value;", self.app)
        self.assertNotIn('return [base, ...tags, rate].filter(Boolean).join(" · ");', self.app)
        self.assertIn(".workflow-model-field > select", self.css)
        self.assertIn("appearance: none", self.css)

    def test_history_image_click_opens_detail_and_can_save_asset(self):
        html = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
        self.assertIn('id="history-dialog-save-asset"', html)
        self.assertIn('previewButton.addEventListener("click", () => openHistoryDetail(entry))', self.app)
        self.assertIn('const preview = target?.closest(".history-preview") || null', self.app)
        self.assertIn('if (shouldOpenPreview && drag.preview?.isConnected) drag.preview.click()', self.app)
        self.assertIn('historyDialogSaveAsset?.addEventListener("click"', self.app)
        self.assertIn("historyDialog?.close()", self.app)
        self.assertIn('kind:activeHistoryEntry.kind || "history"', self.app)

    def test_workflow_form_wheel_does_not_move_canvas(self):
        self.assertIn('const workflowCanvasFields = "input, textarea, select, [contenteditable]', self.app)
        wheel_handler = self.app.split('workflowViewport?.addEventListener("wheel",', 1)[1]
        self.assertLess(
            wheel_handler.index("event.target.closest(workflowCanvasFields)"),
            wheel_handler.index("event.preventDefault()"),
        )

    def test_asset_download_link_is_centered_like_button(self):
        self.assertIn(".asset-page-card footer a", self.css)
        self.assertIn("display: inline-flex", self.css)
        self.assertIn("align-items: center", self.css)

    def test_collage_requires_two_images_and_can_append_more(self):
        self.assertIn("data-collage-add-images", self.app)
        self.assertIn("至少再添加 1 张", self.app)
        self.assertIn('activeClientTool === "collage" && localToolImages.length < 2', self.app)
        self.assertIn("async function appendLocalEditorFiles(files)", self.app)
        self.assertIn('localToolImages = [...localToolImages, ...images]', self.app)
        self.assertIn('localToolInput.dataset.appendMode = "true"', self.app)
        self.assertIn(".collage-add-images", self.css)


if __name__ == "__main__":
    unittest.main()
