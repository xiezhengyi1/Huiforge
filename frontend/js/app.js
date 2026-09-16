import { API, fetchJson } from "./core/api-client.js";
import {
  AUDIO_MODES,
  AUDIO_REFERENCE_MODES,
  AUDIO_REQUIRED_SOURCE_MODES,
  AUDIO_SOURCE_MODES,
  IMAGE_EDIT_MODES,
  SEEDANCE_MODEL_IDS,
  SEEDANCE_VIDEO_MODELS,
  UNIFIED_MODES,
  WAN3_VIDEO_MODEL_IDS,
  WAN3_VIDEO_MODELS,
  VIDEO_IMAGE_MODES,
  VIDEO_MODES,
  resolveUnifiedMode as resolveGenerationMode,
  sourceMediaLimits as resolveSourceMediaLimits,
  sourceMediaRule as resolveSourceMediaRule,
} from "./features/generation/mode-rules.js?v=20260908-member-access-v41";
import {
  WORKFLOW_CANONICAL_NODE_TYPES,
  WORKFLOW_GENERATION_NODE_TYPES,
  WORKFLOW_IMAGE_TOOLS_WITH_NATURAL_LANGUAGE,
  WORKFLOW_IMAGE_TOOL_OPTIONS,
  WORKFLOW_NODE_CATEGORIES,
  WORKFLOW_NODE_TEMPLATES,
  WORKFLOW_NODE_TYPES,
  WORKFLOW_VIDEO_REFERENCE_PORTS,
  WORKFLOW_VIDEO_TOOL_OPTIONS,
  workflowVideoReferenceLimit,
} from "./features/workflow/schema.js?v=20260909-workflow-svg-v42";

// All first-paint consumers share one request.  Individual endpoints remain
// as graceful fallbacks so a partial rollout never leaves the workspace blank.
const workspaceBootstrapPromise = fetchJson(API.bootstrap, { method: "GET" }, 8000)
  .then(({ body }) => body && typeof body === "object" ? body : null)
  .catch(() => null);

const catalog = window.HUIJU_CATALOG?.styles && window.HUIJU_CATALOG?.presets
  ? window.HUIJU_CATALOG
  : { styles: [], presets: [] };
const form = document.querySelector("#generation-form");
const promptInput = document.querySelector("#prompt");
const charCount = document.querySelector("#char-count");
const generateButton = document.querySelector("#generate-button");
const cancelButton = document.querySelector("#cancel-button");
const resetButton = document.querySelector("#reset-button");
const formError = document.querySelector("#form-error");
const resultGrid = document.querySelector("#result-grid");
const resultPlaceholder = document.querySelector("#result-placeholder");
const resultStage = document.querySelector("#result-stage");
const statusPill = document.querySelector("#status-pill");
const resultsTitle = document.querySelector("#results-title");
const resultTip = document.querySelector("#result-tip");
const presetSelect = document.querySelector("#preset-select");
const styleSelect = document.querySelector("#style-select");
const presetSelectTrigger = document.querySelector("#preset-select-trigger");
const presetSelectMenu = document.querySelector("#preset-select-menu");
const presetSelectLabel = document.querySelector("#preset-select-label");
const presetSelectWrap = document.querySelector("#preset-select-wrap");
const styleSelectTrigger = document.querySelector("#style-select-trigger");
const styleSelectMenu = document.querySelector("#style-select-menu");
const styleSelectLabel = document.querySelector("#style-select-label");
const styleSelectWrap = document.querySelector("#style-select-wrap");
const modelSelect = document.querySelector("#model-select");
const modelSelectTrigger = document.querySelector("#model-select-trigger");
const modelSelectMenu = document.querySelector("#model-select-menu");
const modelSelectIcon = document.querySelector("#model-select-icon");
const modelSelectLabel = document.querySelector("#model-select-label");
const outputSettingsTrigger = document.querySelector("#output-settings-trigger");
const outputSettingsMenu = document.querySelector("#output-settings-menu");
const outputSettingsSummary = document.querySelector("#output-settings-summary");
const outputCountSection = document.querySelector("#output-count-section");
const outputRatioSection = document.querySelector("#output-ratio-section");
const outputResolutionSection = document.querySelector("#output-resolution-section");
const outputQualitySection = document.querySelector("#output-quality-section");
const videoDurationSection = document.querySelector("#video-duration-section");
const videoDurationInput = document.querySelector("#video-duration");
const videoDurationValue = document.querySelector("#video-duration-value");
const audioVoiceSection = document.querySelector("#audio-voice-section");
const audioLanguageSection = document.querySelector("#audio-language-section");
const audioSpeedSection = document.querySelector("#audio-speed-section");
const audioEmotionSection = document.querySelector("#audio-emotion-section");
const audioVoiceInput = document.querySelector("#audio-voice");
const audioLanguageInput = document.querySelector("#audio-language");
const audioSpeedInput = document.querySelector("#audio-speed");
const audioSpeedValue = document.querySelector("#audio-speed-value");
const audioEmotionInput = document.querySelector("#audio-emotion");
const customVoicePreviewField = document.querySelector(".custom-voice-preview-field");
const customVoicePreviewInput = document.querySelector("#custom-voice-preview-text");
const DEFAULT_CUSTOM_VOICE_PREVIEW = "欢迎使用绘域";
const generateCreditCost = document.querySelector("#generate-credit-cost");
const sidebarServiceStatus = document.querySelector("#sidebar-service-status");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const clearHistoryButton = document.querySelector("#clear-history-button");
const historyToggle = document.querySelector("#history-toggle");
const studioGrid = document.querySelector(".studio-grid");
const historyDialog = document.querySelector("#history-dialog");
const historyDialogClose = document.querySelector("#history-dialog-close");
const historyDialogImage = document.querySelector("#history-dialog-image");
const historyDialogTime = document.querySelector("#history-dialog-time");
const historyDialogPrompt = document.querySelector("#history-dialog-prompt");
const historyDialogUse = document.querySelector("#history-dialog-use");
const historyDialogSaveAsset = document.querySelector("#history-dialog-save-asset");
const historyDialogPublish = document.querySelector("#history-dialog-publish");
let activeHistoryEntry = null;
const historyPanel = document.querySelector("#history-panel");
const historyTriggerButton = document.querySelector("#history-trigger-button");
const historyDrawerClose = document.querySelector("#history-drawer-close");
const sidebarModelTrigger = document.querySelector("#sidebar-model-trigger");
const sidebarModelMenu = document.querySelector("#sidebar-model-menu");
const sidebarModelIcon = document.querySelector("#sidebar-model-icon");
const sidebarModelLabel = document.querySelector("#sidebar-model-label");
const sidebarToolTrigger = document.querySelector("#sidebar-tool-trigger");
const sidebarToolMenu = document.querySelector("#sidebar-tool-menu");
const sidebarToolLabel = document.querySelector("#sidebar-tool-label");
const feedbackButton = document.querySelector("#feedback-button");
const promptGroup = document.querySelector(".prompt-group");
const activeCapabilityChip = document.querySelector("#active-capability-chip");
const activeCapabilityName = document.querySelector("#active-capability-name");
const creationIntro = document.querySelector(".creation-intro");
const modelGuideGrid = document.querySelector("#model-guide-grid");
const capabilityCenter = document.querySelector("#capability-center");
const capabilityClose = document.querySelector("#capability-close");
const capabilityTabs = document.querySelector("#capability-tabs");
const capabilityContent = document.querySelector("#capability-content");
const capabilitySearch = document.querySelector("#capability-search");
const capabilityNotice = document.querySelector("#capability-notice");
const capabilityProviderStrip = document.querySelector("#capability-provider-strip");
const capabilityNav = document.querySelector(".capability-nav");
const quickAccessPins = document.querySelector("#quick-access-pins");
const discoverToggle = document.querySelector("#discover-toggle");
const discoverNav = document.querySelector("#discover-nav");
const capabilityToolWorkspace = document.querySelector("#capability-tool-workspace");
const capabilityWorkspaceBack = document.querySelector("#capability-workspace-back");
const capabilityWorkspaceEyebrow = document.querySelector("#capability-workspace-eyebrow");
const capabilityWorkspaceTitle = document.querySelector("#capability-workspace-title");
const capabilityWorkspaceNote = document.querySelector("#capability-workspace-note");
const localToolView = document.querySelector("#local-tool-view");
const analysisToolView = document.querySelector("#analysis-tool-view");
const localToolInput = document.querySelector("#local-tool-input");
const localToolOptions = document.querySelector("#local-tool-options");
const localToolRun = document.querySelector("#local-tool-run");
const localToolDownload = document.querySelector("#local-tool-download");
const localToolSaveAsset = document.querySelector("#local-tool-save-asset");
const localToolCanvas = document.querySelector("#local-tool-canvas");
const localToolEmpty = document.querySelector("#local-tool-empty");
const localToolStage = document.querySelector("#local-tool-stage");
const localToolError = document.querySelector("#local-tool-error");
const localEditorOpenLocal = document.querySelector("#local-editor-open-local");
const localEditorOpenAssets = document.querySelector("#local-editor-open-assets");
const localEditorAssetDialog = document.querySelector("#local-editor-asset-dialog");
const localEditorAssetClose = document.querySelector("#local-editor-asset-close");
const localEditorAssetSearch = document.querySelector("#local-editor-asset-search");
const localEditorAssetGrid = document.querySelector("#local-editor-asset-grid");
const localEditorAssetEmpty = document.querySelector("#local-editor-asset-empty");
const localEditorTabs = document.querySelector("#local-editor-tabs");
const localEditorUndo = document.querySelector("#local-editor-undo");
const localEditorRedo = document.querySelector("#local-editor-redo");
const localEditorToolTitle = document.querySelector("#local-editor-tool-title");
const localEditorToolHelp = document.querySelector("#local-editor-tool-help");
const localEditorInspector = document.querySelector("#local-editor-inspector");
const localEditorInspectorClose = document.querySelector("#local-editor-inspector-close");
const localEditorCanvasShell = document.querySelector("#local-editor-canvas-shell");
const localEditorCropFrame = document.querySelector("#local-editor-crop-frame");
const informationDialog = document.querySelector("#information-dialog");
const informationDialogClose = document.querySelector("#information-dialog-close");
const informationDialogEyebrow = document.querySelector("#information-dialog-eyebrow");
const informationDialogTitle = document.querySelector("#information-dialog-title");
const informationDialogSummary = document.querySelector("#information-dialog-summary");
const informationDialogBody = document.querySelector("#information-dialog-body");
const analysisImageInput = document.querySelector("#analysis-image");
const analysisPreview = document.querySelector("#analysis-preview");
const analysisFocus = document.querySelector("#analysis-focus");
const analysisRun = document.querySelector("#analysis-run");
const analysisStatus = document.querySelector("#analysis-status");
const analysisEmpty = document.querySelector("#analysis-empty");
const analysisResult = document.querySelector("#analysis-result");
const analysisUsePrompt = document.querySelector("#analysis-use-prompt");
const assetWorkspace = document.querySelector("#asset-workspace");
const assetWorkspaceBack = document.querySelector("#asset-workspace-back");
const assetNewCategory = document.querySelector("#asset-new-category");
const assetUploadButton = document.querySelector("#asset-upload");
const assetUploadInput = document.querySelector("#asset-upload-input");
const assetCategoryList = document.querySelector("#asset-category-list");
const assetPageGrid = document.querySelector("#asset-page-grid");
const assetPageEmpty = document.querySelector("#asset-page-empty");
const assetTotalCount = document.querySelector("#asset-total-count");
const assetCategoryTitle = document.querySelector("#asset-category-title");
const assetCategorySummary = document.querySelector("#asset-category-summary");
const assetSearch = document.querySelector("#asset-search");
const assetSaveDialog = document.querySelector("#asset-save-dialog");
const assetSaveClose = document.querySelector("#asset-save-close");
const assetSaveCancel = document.querySelector("#asset-save-cancel");
const assetSaveForm = document.querySelector("#asset-save-form");
const assetSavePreview = document.querySelector("#asset-save-preview");
const assetSaveVideo = document.querySelector("#asset-save-video");
const assetSaveAudio = document.querySelector("#asset-save-audio");
const assetSaveMediaLabel = document.querySelector("#asset-save-media-label");
const assetSaveTypeRow = document.querySelector("#asset-save-type-row");
const assetSaveType = document.querySelector("#asset-save-type");
const assetSaveName = document.querySelector("#asset-save-name");
const assetSaveCategory = document.querySelector("#asset-save-category");
const assetSaveStatus = document.querySelector("#asset-save-status");
const assetDialogNewCategory = document.querySelector("#asset-dialog-new-category");
const assetCategoryDialog = document.querySelector("#asset-category-dialog");
const assetCategoryClose = document.querySelector("#asset-category-close");
const assetCategoryCancel = document.querySelector("#asset-category-cancel");
const assetCategoryForm = document.querySelector("#asset-category-form");
const assetCategoryName = document.querySelector("#asset-category-name");
const assetCategoryStatus = document.querySelector("#asset-category-status");

// History remains beside the workspace in the document so its fixed drawer
// cannot inherit composer grid rules or be clipped by the generation form.
const toolNavItems = document.querySelectorAll(".tool-item[data-mode]");
const modeEyebrow = document.querySelector("#mode-eyebrow");
const sourceImageGroup = document.querySelector("#source-image-group");
const sourceImageInput = document.querySelector("#source-image");
const sourcePreview = document.querySelector("#source-preview");
const sourceVideoPreview = document.querySelector("#source-video-preview");
const sourcePreviewShell = document.querySelector("#source-preview-shell");
sourceVideoPreview?.removeAttribute("muted");
if (sourceVideoPreview) sourceVideoPreview.muted = false;
const sourceAudioPreview = document.createElement("audio");
sourceAudioPreview.id = "source-audio-preview";
sourceAudioPreview.controls = true;
sourceAudioPreview.hidden = true;
sourcePreviewShell?.append(sourceAudioPreview);
[sourceVideoPreview, sourceAudioPreview].forEach((media) => {
  media?.addEventListener("pointerdown", (event) => event.stopPropagation());
  media?.addEventListener("click", (event) => event.stopPropagation());
});
const sourceMeta = document.querySelector("#source-meta");
const sourceFileHelp = document.querySelector("#source-file-help");
const toolPresetSelect = document.querySelector("#tool-preset-select");
const toolPromptInput = document.querySelector("#tool-prompt");
const toolPromptField = toolPromptInput?.closest(".tool-prompt-field");
const toolPromptLabel = document.querySelector("#tool-prompt-label");
const viewsControl = document.querySelector("#views-control");
const viewsInput = document.querySelector("#views");
const promptHelp = document.querySelector("#prompt-help");
const promptLabel = document.querySelector("#prompt-label");
const sourceAction = document.querySelector("#source-action");
const maskEditor = document.querySelector("#mask-editor");
const maskCanvas = document.querySelector("#mask-canvas");
const maskBrush = document.querySelector("#mask-brush");
const maskBrushValue = document.querySelector("#mask-brush-value");
const maskBrushSummary = document.querySelector("#mask-brush-summary");
const maskBrushTrigger = document.querySelector("#mask-brush-trigger");
const maskBrushPopover = document.querySelector("#mask-brush-popover");
const maskClear = document.querySelector("#mask-clear");
const maskToolbarActions = document.querySelector("#mask-toolbar-actions");
const maskFocusTrigger = document.querySelector("#mask-focus-trigger");
const maskFocusDialog = document.querySelector("#mask-focus-dialog");
const maskFocusToolbarHost = document.querySelector("#mask-focus-toolbar-host");
const maskFocusStage = document.querySelector("#mask-focus-stage");
const maskFocusCanvasHost = document.querySelector("#mask-focus-canvas-host");
const maskFocusDone = document.querySelector("#mask-focus-done");
const maskZoomOut = document.querySelector("#mask-zoom-out");
const maskZoomIn = document.querySelector("#mask-zoom-in");
const maskZoomFit = document.querySelector("#mask-zoom-fit");
const maskZoomValue = document.querySelector("#mask-zoom-value");
const cameraEditor = document.querySelector("#camera-editor");
const cameraPrompt = document.querySelector("#camera-prompt");
const cameraStage = document.querySelector("#camera-stage");
const cameraAzimuth = document.querySelector("#camera-azimuth");
const cameraElevation = document.querySelector("#camera-elevation");
const cameraDistance = document.querySelector("#camera-distance");
const cameraAzimuthValue = document.querySelector("#camera-azimuth-value");
const cameraElevationValue = document.querySelector("#camera-elevation-value");
const cameraDistanceValue = document.querySelector("#camera-distance-value");
const cameraReset = document.querySelector("#camera-reset");
const cameraOffsetValue = document.querySelector("#camera-offset-value");
const cameraPresetButtons = [...document.querySelectorAll("[data-camera-preset]")];
let cameraWorkspace = null;
const workflowCameraWorkspaces = new Map();
let workflowCameraFocusWorkspace = null;
let THREE = null;
let OrbitControls = null;
const hasToolingUI = Boolean(sourceImageGroup && sourceImageInput && sourcePreview && sourceMeta && viewsControl && modeEyebrow && sourceAction);
let sourceUploadSurface = null;
let interactiveEditor = null;
let annotationOverlay = null;
let referenceStrip = null;
let promptMentionPicker = null;
let promptMentionStrip = null;
let annotationSummary = null;
let layerModeNote = null;
let annotationMode = "point";
let annotationDraft = null;
let imageAnnotations = [];
let sourceFiles = [];
let sourcePreviewUrls = [];
let activeReferenceIndex = 0;
const sourceStateByCapability = new Map();
let sourceSaveVoiceButton = null;
let promptReferenceMentions = [];
let activeMentionRange = null;
let activeMentionIndex = 0;
let mentionAssetsLoading = false;
let mentionAssetsLoaded = false;

// The preview owns the same visual slot as the original upload affordance.
// In redraw mode the alpha brush canvas replaces the static preview so users
// paint directly on the image instead of moving to a second editor below it.
if (hasToolingUI && sourcePreviewShell && maskCanvas) {
  sourceImageInput.multiple = true;
  const uploadDrop = sourceImageInput.closest(".upload-drop");
  if (uploadDrop?.parentElement) {
    sourceUploadSurface = document.createElement("div");
    sourceUploadSurface.className = "source-upload-surface";
    uploadDrop.before(sourceUploadSurface);
    sourceUploadSurface.append(uploadDrop, sourcePreviewShell);
    sourcePreviewShell.append(maskCanvas);
    const replaceButton = document.createElement("button");
    replaceButton.type = "button";
    replaceButton.className = "source-replace-button";
    replaceButton.textContent = "更换图片";
    replaceButton.addEventListener("click", (event) => {
      event.stopPropagation();
      sourceImageInput.value = "";
      sourceImageInput.click();
    });
    sourcePreviewShell.append(replaceButton);
    sourceSaveVoiceButton = document.createElement("button");
    sourceSaveVoiceButton.type = "button";
    sourceSaveVoiceButton.className = "source-save-voice-button";
    sourceSaveVoiceButton.textContent = "保存音色";
    sourceSaveVoiceButton.hidden = true;
    sourceSaveVoiceButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      const file = sourceFiles[activeReferenceIndex];
      if (!file?.type?.startsWith("audio/")) return;
      const confirmed = window.confirm("请确认：该声音属于本人，或已获得权利人的明确授权。确认后可保存为个人音色资产。");
      if (!confirmed) return;
      await openAssetSaveDialog({
        file, mediaType:file.type, assetType:"voice",
        suggestedName:file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "定制音色",
        prompt:"已授权的定制音色", kind:"voice_clone",
      });
    });
    sourcePreviewShell.append(sourceSaveVoiceButton);
    referenceStrip = document.createElement("div");
    referenceStrip.className = "source-thumbnail-tray";
    referenceStrip.setAttribute("aria-label", "已上传的参考图片");
    sourcePreviewShell.append(referenceStrip);
  }
  annotationOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  annotationOverlay.id = "annotation-overlay";
  annotationOverlay.classList.add("annotation-overlay");
  annotationOverlay.setAttribute("viewBox", "0 0 999 999");
  annotationOverlay.setAttribute("preserveAspectRatio", "none");
  annotationOverlay.setAttribute("aria-label", "点选或框选编辑区域");
  annotationOverlay.setAttribute("hidden", "");
  sourcePreviewShell.append(annotationOverlay);

  interactiveEditor = document.createElement("section");
  interactiveEditor.className = "interactive-editor";
  interactiveEditor.hidden = true;
  interactiveEditor.innerHTML = '<div class="interactive-toolbar"><div><b>在参考图上点选或框选</b><span>坐标由后端按官方格式组装，不会写入输入框</span></div><div role="group" aria-label="标注工具"><button class="active" data-annotation-tool="point" type="button">点选</button><button data-annotation-tool="bbox" type="button">框选</button><button data-annotation-action="undo" type="button">撤销</button><button data-annotation-action="clear" type="button">清空</button></div></div><p class="annotation-summary">尚未添加标注</p>';
  annotationSummary = interactiveEditor.querySelector(".annotation-summary");
  sourceImageGroup.append(interactiveEditor);

  layerModeNote = document.createElement("section");
  layerModeNote.className = "layer-mode-note";
  layerModeNote.hidden = true;
  layerModeNote.innerHTML = '<span aria-hidden="true">▱</span><div><b>分层输出</b><p>输出完整底图与最多 16 个透明 PNG 图层，可逐层显隐、下载或加入资产。</p></div>';
  sourceImageGroup.append(layerModeNote);

  const promptField = toolPromptInput?.closest(".tool-prompt-field");
  if (promptField) {
    promptMentionPicker = document.createElement("div");
    promptMentionPicker.className = "prompt-mention-picker";
    promptMentionPicker.hidden = true;
    promptMentionPicker.setAttribute("role", "listbox");
    promptMentionPicker.setAttribute("aria-label", "选择参考图片或资产");
    promptMentionStrip = document.createElement("div");
    promptMentionStrip.className = "prompt-mention-strip";
    promptMentionStrip.hidden = true;
    promptField.append(promptMentionPicker, promptMentionStrip);
  }
}

const HISTORY_STORAGE_KEY = "huiju.generated-history.v1";
const HISTORY_COLLAPSED_STORAGE_KEY = "huiju.history-collapsed.v1";
const PENDING_JOB_STORAGE_KEY = "huiju.pending-image-job.v1";
const QUICK_ACCESS_STORAGE_KEY = "huiju.quick-access.v1";
const DISCOVER_COLLAPSED_STORAGE_KEY = "huiju.discover-collapsed.v1";
const PENDING_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let activeRequest = null;
let activeSessionTurn = null;
let activeJobStatusPath = null;
let cancellationNotice = "";
let selectedStyle = "natural";
let selectedPreset = null;
let activeMode = "unified_image";
let selectedCapabilityId = "";
let capabilityGroups = [];
let capabilityProviderState = {};
let quickAccessIds = [];
let sidebarPinContextItemId = "";
let sourcePreviewUrl = null;
let sourcePreviewToken = 0;
let maskLayer = null;
let maskTintLayer = null;
let maskHasPaint = false;
let maskIsDrawing = false;
let maskFocusZoom = 1;
let maskFocusBaseWidth = 0;
let maskFocusBaseHeight = 0;
let maskCanvasHomeParent = null;
let maskCanvasHomeNext = null;
let maskToolbarHomeParent = null;
let maskToolbarHomeNext = null;
let lastSubmittedPrompt = "";
let modelCatalog = [];

const FALLBACK_TOOL_PRESETS = Object.freeze({
  edit: [
    { id: "edit-faithful", label: "忠实编辑", prompt: "只修改明确要求改变的内容，未提及区域保持不变；透视、光线、材质和颗粒自然衔接。" },
    { id: "edit-product", label: "商品精修", prompt: "保持商品造型、比例、标签和材质准确，完成商业级精修与自然布光。" },
    { id: "edit-portrait", label: "人像精修", prompt: "保持人物身份、五官比例和真实皮肤纹理，进行自然克制的人像精修。" },
    { id: "edit-restore", label: "照片修复", prompt: "修复划痕、折痕、噪点、褪色和模糊，保留人物身份、年代特征与原始构图。" },
    { id: "edit-style", label: "风格迁移", prompt: "保持主体身份、姿态、构图和空间关系，只转换整体视觉风格。" },
  ],
  redraw: [
    { id: "redraw-natural", label: "自然补绘", prompt: "只修改蒙版覆盖区域，使新内容与原图的透视、光线、材质和颗粒自然衔接；蒙版外区域保持不变。" },
    { id: "redraw-remove", label: "移除物体", prompt: "移除蒙版区域内的主体，并依据周围结构、纹理、阴影与透视自然补全背景；不要改变蒙版外内容。" },
    { id: "redraw-material", label: "替换材质", prompt: "仅替换蒙版区域的材质与颜色，保留原始形状、结构、构图和光照方向，边缘过渡自然。" },
  ],
  multiview: [
    { id: "multiview-product", label: "产品标准视图", prompt: "保持主体身份、比例、材质和关键细节一致，生成正面、左侧、右侧与背面标准视图；白色无缝背景，同一焦段与等距构图。" },
    { id: "multiview-character", label: "角色设定视图", prompt: "保持角色脸型、发型、服装、配饰和体型完全一致，生成正面、侧面与背面设定视图；中性站姿，白色背景，均匀柔光。" },
    { id: "multiview-object", label: "物体结构视图", prompt: "保持物体几何结构、尺度与材质一致，从多个标准方位展示完整结构；视图之间不增加或遗漏部件。" },
  ],
  multiangle: [
    { id: "multiangle-faithful", label: "忠实换机位", prompt: "保持主体身份、造型、颜色、材质和场景内容一致，只改变相机机位与取景距离；遵循指定水平角、俯仰角和景别。" },
    { id: "multiangle-product", label: "产品环绕机位", prompt: "产品造型、比例、标签位置与材质完全不变，使用干净棚拍背景和一致柔光，仅按相机参数改变观察角度。" },
    { id: "multiangle-character", label: "角色环绕机位", prompt: "人物身份、五官、发型、服装和姿态保持一致，仅转换摄像机方位、俯仰和距离，避免新增人物或改变动作。" },
  ],
  panorama: [
    { id: "panorama-interior", label: "室内 360° 全景", prompt: "生成严格 2:1 等距柱状 360° 室内全景，水平视场 360°、垂直视场 180°，地平线居中，左右边缘无缝衔接。" },
    { id: "panorama-landscape", label: "自然环境 360° 全景", prompt: "生成严格 2:1 等距柱状 360° 自然环境全景，天空、地面和地貌连续，左右边缘无缝衔接。" },
    { id: "panorama-concept", label: "概念空间 360° 全景", prompt: "生成严格 2:1 等距柱状 360° 概念空间全景，补足前后左右、头顶与地面，左右边缘无缝衔接。" },
  ],
  upscale: [
    { id: "upscale-faithful", label: "忠实超分", prompt: "只增强清晰度、边缘、纹理和微小细节，不改变画面内容。" },
  ],
  cutout: [
    { id: "cutout-alpha", label: "透明背景", prompt: "准确分离前景主体，保留自然发丝、透明物和半透明边缘，输出透明 Alpha 背景 PNG。" },
  ],
  interactive: [
    { id: "interactive-precise", label: "精准交互编辑", prompt: "只修改点选或框选的目标与区域，未标注内容保持不变。" },
  ],
  layers: [
    { id: "layers-standard", label: "标准图层拆分", prompt: "拆分为完整底图与语义清晰的透明图层。" },
  ],
});
let toolPresets = FALLBACK_TOOL_PRESETS;

const MODE_COPY = {
  text: {
    eyebrow: "文生图工作台",
    title: "把脑海中的画面说出来。",
    action: "生成",
    help: "先写创作目标，再依次补充场景、主体动作、构图机位、光线色彩、媒介材质与硬性约束；每一段只控制一个维度。",
    promptLabel: "画面描述",
    placeholder: "描述主体、场景、机位、光线与质感。例如：雨后旧城区，风衣女性回头，低机位中景，霓虹倒影，35mm 胶片，无文字水印。",
  },
  edit: {
    eyebrow: "图生图工作台",
    title: "从一张图，继续向前创作。",
    action: "开始编辑",
    help: "上传参考图，选择后端预设，再补充要改变和必须保留的内容；无需画蒙版。",
    promptLabel: "编辑指令",
    placeholder: "例如：保持商品造型和标签不变，将背景改为暖灰色摄影棚，增加柔和侧逆光。",
    sourceAction: "选择需要编辑的图片",
  },
  redraw: {
    eyebrow: "图像重绘工作台",
    title: "让一张图，生出新的表达。",
    action: "开始重绘",
    help: "上传参考图，再描述你希望改变、保留或重新绘制的内容。",
    promptLabel: "重绘指令",
    placeholder: "例如：保留人物姿态与构图，将服装改为深红色礼服，背景变为雨夜霓虹街道。",
    sourceAction: "选择需要重绘的图片",
  },
  multiview: {
    eyebrow: "多视角工作台",
    title: "从一个主体，展开多个角度。",
    action: "生成多视角",
    help: "上传参考图，描述主体与材质；系统会生成前、侧、背等视角。",
    promptLabel: "主体补充描述",
    placeholder: "例如：白色科幻摩托车，磨砂金属与发光轮毂，产品级细节，干净背景。",
    sourceAction: "选择主体参考图",
  },
  multiangle: {
    eyebrow: "多角度绘图工作台",
    title: "用相机机位，重新定义这个角度。",
    action: "生成该角度",
    help: "上传参考图并调节相机机位，系统将把水平、垂直和距离转化为角度提示词。",
    promptLabel: "主体补充描述",
    placeholder: "例如：保留主体造型与材质，产品摄影级细节，干净背景。",
    sourceAction: "选择主体参考图",
  },
  panorama: {
    eyebrow: "360° 全景工作台",
    title: "把一个场景，扩展为可环视一周的空间。",
    action: "生成 360° 全景",
    help: "输出固定为 2:1 等距柱状投影，可在全景查看器中水平环视 360°。",
    promptLabel: "空间延展指令",
    placeholder: "例如：延展为黄昏海边度假酒店的完整 360° 空间，柔和金色光线，远处可见海面。",
    sourceAction: "选择场景参考图",
  },
  upscale: {
    eyebrow: "AI 超分工作台",
    title: "把细节放大，不改变画面。",
    action: "开始超分",
    help: "上传图片并在输出设置里选择 2K 或 4K；服务器会使用 AI 超分模型增强细节。",
    promptLabel: "超分要求",
    placeholder: "例如：忠实增强材质、发丝与边缘，不改变色彩和构图。",
    sourceAction: "选择需要放大的图片",
  },
  cutout: {
    eyebrow: "AI 抠图工作台",
    title: "把主体干净地从背景中分离出来。",
    action: "开始抠图",
    help: "上传一张图片，服务器会输出保留透明通道的 PNG；适合商品、人像与单主体素材。",
    promptLabel: "抠图要求",
    placeholder: "例如：保留玻璃瓶、标签与自然投影边缘，输出透明背景 PNG。",
    sourceAction: "选择需要抠图的图片",
  },
  interactive: {
    eyebrow: "Seedream 交互编辑",
    title: "点一下，或框出你要修改的位置。",
    action: "精准编辑",
    help: "最多上传 10 张参考图，在任一图片上点选目标或框选区域，再用自然语言描述修改要求。",
    promptLabel: "编辑要求",
    placeholder: "例如：将框选区域替换为玻璃花房，保持画面其余部分、构图和光线不变。",
    sourceAction: "选择 1–10 张参考图",
  },
  layers: {
    eyebrow: "Seedream 图层拆分",
    title: "把成片拆成真正可复用的图层。",
    action: "拆分图层",
    help: "上传一张图片，系统会返回完整底图与最多 16 个带透明通道的语义图层。",
    promptLabel: "图层拆分要求",
    placeholder: "可选：说明希望优先识别的主体、文字、装饰或背景元素。",
    sourceAction: "选择一张需要拆分的图片",
  },
  video_text: {
    eyebrow: "文生视频",
    title: "用一句话，生成一段完整镜头。",
    action: "生成视频",
    help: "描述主体、场景、动作、运镜、光线和时间节奏；输出时长在设置中滑动选择。",
    promptLabel: "视频描述",
    placeholder: "例如：雨夜街角，一位风衣女性转身看向镜头，镜头缓慢推进，霓虹倒影流动，电影质感。",
  },
  video_image: {
    eyebrow: "图生视频",
    title: "让一张静态画面开始运动。",
    action: "生成视频",
    help: "上传首帧，在补充要求中描述主体动作、镜头运动和环境变化。",
    promptLabel: "动态描述",
    placeholder: "例如：人物轻轻回头，发丝随风摆动，镜头缓慢向前推进，背景灯光自然闪烁。",
    sourceAction: "选择视频首帧",
  },
  video_first_last: {
    eyebrow: "首尾帧生视频",
    title: "用两张画面，控制镜头的开始与结束。",
    action: "生成视频",
    help: "依次上传首帧与尾帧，系统按缩略图顺序组装，不会跳转到幕布。",
    promptLabel: "过渡描述",
    placeholder: "例如：镜头平稳环绕主体，人物从站立自然转为坐下，动作连续，光线方向保持一致。",
    sourceAction: "选择首帧与尾帧",
  },
  video_reference: {
    eyebrow: "视频参考生视频",
    title: "参考人物、道具和风格，生成新镜头。",
    action: "生成视频",
    help: "最多上传五张参考图，可用 @ 指定图像或资产在提示词中的用途。",
    promptLabel: "镜头描述",
    placeholder: "例如：图1中的人物拿起图2中的产品，走进图3的空间，镜头从中景缓慢推至特写。",
    sourceAction: "选择 1–5 张参考图",
  },
  video_edit: {
    eyebrow: "AI 视频编辑", title: "用一句话修改现有视频。", action: "开始编辑",
    help: "上传视频，可再附一张参考图；描述需要替换、增加、删除或迁移的内容。",
    promptLabel: "编辑指令", placeholder: "例如：把天空改成日落，保持人物动作、对白和镜头运动不变。", sourceAction: "选择视频与可选参考图",
  },
  video_extension: {
    eyebrow: "视频延展", title: "让镜头自然延续。", action: "开始延展",
    help: "上传一段视频或首帧；Wan VACE 固定 5 秒，Seedance 可按模型范围选择时长。",
    promptLabel: "延展要求", placeholder: "例如：人物继续向窗边走去，镜头平稳跟随，光线和运动方向保持一致。", sourceAction: "选择视频或首帧",
  },
  video_style: {
    eyebrow: "视频风格化", title: "保留动作，重塑视觉风格。", action: "转换风格",
    help: "上传视频，在输出设置中选择清晰度；系统使用所选风格完成整段重绘。",
    promptLabel: "风格说明", placeholder: "例如：国风水墨，保留原镜头动作、人物身份和节奏。", sourceAction: "选择需要风格化的视频",
  },
  video_lip_sync: {
    eyebrow: "口型同步", title: "让人物口型准确跟随配音。", action: "同步口型",
    help: "上传人物视频和人声音频，顺序不限；可再附一张人脸参考图。",
    promptLabel: "同步说明", placeholder: "例如：自然同步口型和表情，保留原视频构图与人物身份。", sourceAction: "选择人物视频与音频",
  },
  video_character_swap: {
    eyebrow: "视频角色替换", title: "替换人物，保留动作与场景。", action: "替换角色",
    help: "上传已获授权的人物图片和参考视频；提交即确认拥有素材与肖像使用权。",
    promptLabel: "替换说明", placeholder: "例如：自然替换主角，完整保留动作、表情、场景、光照和镜头。", sourceAction: "选择授权人物图片与参考视频",
  },
  video_digital_human: {
    eyebrow: "数字人播报", title: "用照片和音频生成口播视频。", action: "生成口播",
    help: "上传一张清晰正面人物图与一段人声音频，生成自然口型与表情。",
    promptLabel: "播报要求", placeholder: "例如：自然克制的新闻播报状态，口型准确，眼神稳定。", sourceAction: "选择人物图片与音频",
  },
  audio_tts: {
    eyebrow: "文生配音",
    title: "把文字变成自然、有表现力的声音。",
    action: "生成配音",
    help: "输入需要朗读的正文，在输出设置中选择音色与语言。",
    promptLabel: "配音文本",
    placeholder: "输入需要合成的旁白、对白或广告文案。",
  },
  audio_reference: {
    eyebrow: "参考音频配声",
    title: "参考一段声音，生成新的配音。",
    action: "生成配音",
    help: "上传 10–20 秒清晰人声，输入新的旁白或对白；样本仅用于本次临时音色复刻。",
    promptLabel: "配音文本",
    placeholder: "输入需要用参考音色朗读的新旁白、对白或广告文案。",
    sourceAction: "选择已授权的参考音频",
  },
  audio_custom_voice: {
    eyebrow: "定制音色",
    title: "用一句描述，设计你的专属音色。",
    action: "生成音色",
    help: "描述声音的年龄感、音色、语气和节奏。试听文案默认“欢迎使用绘域”；参考音频选填，上传时须确认授权。",
    promptLabel: "音色描述",
    placeholder: "例如：温暖明亮的青年女声，咬字清晰，语速舒缓，带轻微微笑感。",
    sourceAction: "上传参考音频（选填）",
  },
  audio_image: {
    eyebrow: "图片配音",
    title: "看懂画面，自动生成旁白与配音。",
    action: "生成图片配音",
    help: "上传一张图片，可补充旁白风格；系统先生成简洁旁白，再用所选音色合成配音。",
    promptLabel: "旁白要求",
    placeholder: "可选：例如纪录片口吻，简洁自然，突出人物动作与现场氛围。",
    sourceAction: "选择需要配音的图片",
  },
  unified_image: {
    eyebrow: "AI 生图",
    title: "描述画面；上传参考图就沿着它继续创作。",
    action: "生成图片",
    help: "不上传素材时按文字从零生成；上传一张或多张参考图后，改为在参考图基础上编辑或再创作，未描述的部分会尽量保持原样。",
    promptLabel: "画面描述",
    placeholder: "描述主体、场景、机位、光线与质感；上传参考图后可改为描述要改变什么、保留什么。",
    sourceAction: "选择参考图（选填，最多 10 张）",
  },
  unified_video: {
    eyebrow: "AI 生视频",
    title: "描述镜头；上传一张图就让它动起来。",
    action: "生成视频",
    help: "不上传素材时按文字生成整段镜头；上传一张图片后，以它作为首帧驱动画面运动。需要首尾帧、多参考图、口型同步或数字人时，请从左侧对应能力进入。",
    promptLabel: "镜头描述",
    placeholder: "例如：雨夜街角，风衣女性转身看向镜头，镜头缓慢推进，霓虹倒影流动，电影质感。",
    sourceAction: "选择首帧图片（选填）",
  },
  unified_audio: {
    eyebrow: "AI 配音",
    title: "输入文案；上传一段声音就沿用它的音色。",
    action: "生成配音",
    help: "不上传素材时使用所选音色朗读文案；上传 10–20 秒清晰人声后，改用参考音色朗读新文案，样本仅用于本次临时复刻。",
    promptLabel: "配音文本",
    placeholder: "输入需要合成的旁白、对白或广告文案。",
    sourceAction: "选择参考音频（选填，10–20 秒清晰人声）",
  },
};

const CAPABILITY_MODE_ICONS = Object.freeze({
  text: "✦",
  edit: "◫",
  redraw: "◌",
  multiview: "▦",
  multiangle: "◒",
  panorama: "◎",
  upscale: "↗",
  cutout: "◇",
  interactive: "⌖",
  layers: "▱",
  video_text: "▷",
  video_image: "▶",
  video_first_last: "◇",
  video_reference: "◫",
  video_edit: "✎",
  video_extension: "↦",
  video_style: "◈",
  video_lip_sync: "◖",
  video_character_swap: "⇄",
  video_digital_human: "◉",
  audio_tts: "◖",
  audio_reference: "◖",
  audio_custom_voice: "◖",
  audio_image: "▣",
  unified_image: "✦",
  unified_video: "▶",
  unified_audio: "◖",
});

function updateActiveCapabilityIndicator(mode, capabilityId = "", labelOverride = "") {
  if (!activeCapabilityChip || !activeCapabilityName) return;
  const matchedGroup = capabilityGroups.find((group) =>
    (group.items || []).some((item) => item.id === capabilityId));
  const matchedItem = matchedGroup?.items?.find((item) => item.id === capabilityId);
  const fallbackLabel = TOOL_SELECTOR_CHOICES.find(([id]) => id === mode)?.[1] || MODE_COPY[mode]?.eyebrow || "图像创作";
  const label = String(labelOverride || matchedItem?.name || fallbackLabel).trim();
  activeCapabilityName.textContent = label;
  activeCapabilityChip.dataset.mode = mode;
  activeCapabilityChip.title = label;
  activeCapabilityChip.classList.remove("is-switching");
  // Restart the compact transition even when two abilities use the same mode.
  void activeCapabilityChip.offsetWidth;
  activeCapabilityChip.classList.add("is-switching");
  window.setTimeout(() => activeCapabilityChip.classList.remove("is-switching"), 320);
}

function setStatus(label, state = "idle") {
  statusPill.textContent = label;
  statusPill.dataset.state = state;
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  cancelButton.hidden = !isBusy;
  if (isBusy) cancelButton.disabled = false;
  resultStage.setAttribute("aria-busy", String(isBusy));
  generateButton.querySelector(".button-label").textContent = isBusy ? "正在处理" : MODE_COPY[activeMode].action;
}

function setError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}

function createSessionTurn() {
  const turn = document.createElement("article");
  turn.className = "session-turn is-pending";
  const header = document.createElement("header");
  const identity = document.createElement("div");
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = CAPABILITY_MODE_ICONS[activeMode] || "✦";
  const name = document.createElement("strong");
  name.textContent = activeCapabilityName?.textContent || MODE_COPY[activeMode]?.eyebrow || "图像创作";
  identity.append(icon, name);
  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  const state = document.createElement("em");
  state.className = "session-turn-state";
  state.textContent = "生成中";
  header.append(identity, time, state);
  const prompt = document.createElement("p");
  prompt.className = "session-turn-prompt";
  prompt.textContent = lastSubmittedPrompt || currentPrompt() || "图像处理";
  const images = document.createElement("div");
  images.className = "session-image-grid";
  const loader = document.createElement("div");
  loader.className = "session-image-loader";
  loader.setAttribute("aria-label", "图像正在生成");
  images.append(loader);
  turn.append(header, prompt, images);
  resultGrid.append(turn);
  resultGrid.hidden = false;
  resultPlaceholder.hidden = true;
  requestAnimationFrame(() => resultStage.scrollTo({ top: resultStage.scrollHeight, behavior: "smooth" }));
  return turn;
}

function failSessionTurn(message) {
  if (!activeSessionTurn) return;
  activeSessionTurn.classList.remove("is-pending");
  activeSessionTurn.classList.add("is-error");
  const state = activeSessionTurn.querySelector(".session-turn-state");
  if (state) state.textContent = "未完成";
  const imageGrid = activeSessionTurn.querySelector(".session-image-grid");
  if (imageGrid) {
    const error = document.createElement("div");
    error.className = "session-turn-error";
    error.innerHTML = `<span aria-hidden="true">!</span><div><strong>这次没有生成成功</strong><p>${escapeMarkup(message)}</p></div>`;
    imageGrid.replaceChildren(error);
  }
  activeSessionTurn = null;
}

function setPending() {
  const previousComposerRect = form.getBoundingClientRect();
  document.body.classList.add("studio-has-output");
  const nextComposerRect = form.getBoundingClientRect();
  const offsetY = previousComposerRect.top - nextComposerRect.top;
  const offsetX = previousComposerRect.left - nextComposerRect.left;
  if (offsetX || offsetY) {
    form.animate([
      { transform: `translate(${offsetX}px, ${offsetY}px)` },
      { transform: "translate(0, 0)" },
    ], { duration: 620, easing: "cubic-bezier(.22,.78,.2,1)", fill: "both" });
  }
  resultPlaceholder.hidden = true;
  resultPlaceholder.classList.add("is-pending");
  activeSessionTurn = createSessionTurn();
  resultsTitle.textContent = "会话记录";
  resultTip.textContent = "同模型任务会连续处理；切换模型时会短暂等待。";
  setStatus("处理中", "working");
}

function setIdle() {
  const hasSession = Boolean(resultGrid.querySelector(".session-turn"));
  const needsSource = VIDEO_IMAGE_MODES.has(activeMode) || AUDIO_SOURCE_MODES.has(activeMode);
  const isTextDriven = !needsSource && (activeMode === "text" || activeMode === "video_text" || isAudioMode());
  const isMedia = isVideoMode() || isAudioMode();
  resultGrid.hidden = !hasSession;
  resultPlaceholder.hidden = hasSession;
  resultPlaceholder.classList.remove("is-pending");
  resultPlaceholder.querySelector("strong").textContent = isTextDriven ? "一个清晰的描述，正在等待发生。" : "上传参考图，开始下一次创作。";
  resultPlaceholder.querySelector("p").textContent = isMedia ? "生成的视频或音频会显示在这里，并可直接播放和下载。" : "生成的图像会显示在这里，并可直接下载。";
  resultsTitle.textContent = hasSession ? "会话记录" : isTextDriven ? "等待你的描述" : "等待参考素材";
  resultTip.textContent = isTextDriven ? "先确定创作目标，再补充主体、场景、镜头、节奏、声音或视觉约束。" : "参考素材只用于当前任务，具体改动由你输入的要求决定。";
  setStatus("准备就绪");
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function safeImageUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" || url.origin === window.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

function safeSameOriginPath(value) {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

function safeGeneratedImageUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    const allowedPath = url.pathname.startsWith("/generated/")
      || url.pathname.startsWith("/api/v1/private-media/")
      || url.pathname === "/api/v1/users/avatar/content";
    if (url.origin !== window.location.origin || !allowedPath) return null;
    return url.href;
  } catch {
    return null;
  }
}

function safeWorkflowMediaUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === "blob:") return url.href;
    const allowedPath = /^\/api\/v1\/private-media\/(?:asset|video|audio)\/[a-f0-9]{32}$/.test(url.pathname)
      || /^\/api\/v1\/media\/uploads\/[a-f0-9]{32}\/preview$/.test(url.pathname);
    if (url.origin !== window.location.origin || !allowedPath) return null;
    return url.href;
  } catch {
    return null;
  }
}

function imageExtension(url) {
  try {
    const extension = new URL(url).pathname.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase();
    return extension === "jpeg" ? "jpg" : extension || "png";
  } catch {
    return "png";
  }
}

function readHistory() {
  try {
    const value = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item) => (
      item && typeof item.id === "string" && Number.isFinite(item.createdAt) && item.createdAt > 0
      && safeGeneratedImageUrl(item.url)
    )).map((item) => ({
      ...item,
      prompt: typeof item.prompt === "string" ? item.prompt : "",
    }));
  } catch {
    return [];
  }
}

function writeHistory(entries) {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    // Storage can be disabled or full; generation and download must still work without history.
    return false;
  }
}

function formatHistoryTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(new Date(timestamp));
}

function openHistoryDetail(entry) {
  const imageUrl = safeGeneratedImageUrl(entry.url);
  if (!imageUrl || !historyDialog || !historyDialogImage || !historyDialogTime || !historyDialogPrompt || !historyDialogUse) return;
  const prompt = typeof entry.prompt === "string" ? entry.prompt.trim() : "";
  activeHistoryEntry = { ...entry, url:imageUrl, prompt };
  historyDialogImage.src = imageUrl;
  historyDialogTime.textContent = `生成于 ${formatHistoryTime(entry.createdAt)}`;
  historyDialogPrompt.textContent = prompt || "这条旧记录创建时尚未保存提示词。";
  if (historyDialogPublish) historyDialogPublish.disabled = !plazaSourcePath(entry.historyUrl || imageUrl);
  const studioUrl = new URL("studio.html", window.location.href);
  if (prompt) studioUrl.searchParams.set("prompt", prompt);
  historyDialogUse.href = `${studioUrl.pathname}${studioUrl.search}`;
  if (!historyDialog.open) historyDialog.showModal();
}

function renderHistory() {
  if (!historyList || !historyEmpty || !clearHistoryButton) return;
  const entries = readHistory();
  const items = entries.map((entry) => {
    const url = safeGeneratedImageUrl(entry.url);
    if (!url) return null;
    const item = document.createElement("article");
    item.className = "history-item";
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "history-preview";
    previewButton.setAttribute("aria-label", "查看此作品的大图与提示词");
    const preview = document.createElement("img");
    preview.src = url;
    preview.alt = "已生成图像缩略图";
    preview.loading = "lazy";
    preview.referrerPolicy = "no-referrer";
    previewButton.append(preview);
    previewButton.addEventListener("click", () => openHistoryDetail(entry));
    const meta = document.createElement("div");
    const time = document.createElement("time");
    time.dateTime = new Date(entry.createdAt).toISOString();
    time.textContent = formatHistoryTime(entry.createdAt);
    const actions = document.createElement("div");
    const download = document.createElement("a");
    download.href = url;
    download.download = `huiju-${entry.createdAt}.${imageExtension(url)}`;
    download.textContent = "下载";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "移除";
    remove.setAttribute("aria-label", "从已生成记录中移除此图像");
    remove.addEventListener("click", () => {
      writeHistory(readHistory().filter((current) => current.id !== entry.id));
      renderHistory();
    });
    actions.append(download, remove);
    meta.append(time, actions);
    item.append(previewButton, meta);
    return item;
  }).filter(Boolean);
  historyList.replaceChildren(...items);
  historyEmpty.hidden = items.length > 0;
  clearHistoryButton.hidden = items.length === 0;
}

function saveHistory(images, createdAt, prompt) {
  const savedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const newEntries = images.map((image, index) => {
    const url = typeof image === "string" ? image : image?.url;
    const safeUrl = safeGeneratedImageUrl(url);
    const historyUrl = safeSameOriginPath(typeof image === "string" ? "" : image?.history_url);
    return safeUrl ? { id: `${createdAt}-${index}-${crypto.randomUUID()}`, url: safeUrl, historyUrl, createdAt, prompt: savedPrompt, kind: activeMode } : null;
  }).filter(Boolean);
  if (!newEntries.length) return;
  if (!writeHistory([...newEntries, ...readHistory()])) {
    setError("本机浏览器的记录空间已满，本次图像仍可下载；清理部分历史记录后将继续保存。");
  }
  renderHistory();
}

const FALLBACK_ASSET_CATEGORIES = Object.freeze([
  { id: "characters", name: "角色", custom: false },
  { id: "scenes", name: "场景", custom: false },
  { id: "designs", name: "设计图", custom: false },
  { id: "products", name: "商品", custom: false },
  { id: "storyboards", name: "分镜", custom: false },
  { id: "references", name: "参考图", custom: false },
  { id: "videos", name: "视频", custom: false },
  { id: "voices", name: "音色", custom: false },
  { id: "music", name: "音乐", custom: false },
  { id: "audio", name: "音频", custom: false },
]);
let assetCategories = [...FALLBACK_ASSET_CATEGORIES];
let assetItems = [];
let activeAssetCategory = "all";
let pendingAssetCandidate = null;
let pendingAssetPreviewUrl = "";

function normalizedAsset(item) {
  if (!item || typeof item !== "object") return null;
  const url = safeGeneratedImageUrl(item.url || "");
  if (!url) return null;
  const rawTime = Number(item.created_at || item.createdAt || Date.now());
  const mediaType = String(item.media_type || item.mediaType || "image/webp").toLowerCase();
  const inferredType = mediaType.startsWith("video/") ? "video" : mediaType.startsWith("audio/") ? "audio" : "image";
  const assetType = ["image", "video", "audio", "voice", "music"].includes(String(item.asset_type || item.assetType))
    ? String(item.asset_type || item.assetType) : inferredType;
  return {
    id: String(item.id || "").slice(0, 100),
    name: String(item.name || "未命名资产").slice(0, 40),
    categoryId: String(item.category_id || "references").slice(0, 64),
    url,
    prompt: String(item.prompt || "").slice(0, 8000),
    kind: String(item.kind || "text").slice(0, 64),
    assetType,
    mediaType,
    sizeBytes: Math.max(0, Number(item.size_bytes || item.sizeBytes || 0)),
    createdAt: rawTime < 1e12 ? rawTime * 1000 : rawTime,
  };
}

function renderAssetCategoryOptions(selectedId = "") {
  if (!assetSaveCategory) return;
  assetSaveCategory.replaceChildren(...assetCategories.map((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    option.selected = category.id === selectedId;
    return option;
  }));
}

function assetTypeLabel(asset) {
  return ({ image:"图片", video:"视频", audio:"音频", voice:"音色", music:"音乐" })[asset?.assetType] || "媒体";
}

function mediaDownloadExtension(asset) {
  const mime = String(asset?.mediaType || "").toLowerCase();
  return ({ "video/mp4":"mp4", "video/quicktime":"mov", "video/webm":"webm", "audio/wav":"wav", "audio/mpeg":"mp3", "audio/mp4":"m4a", "audio/ogg":"ogg" })[mime]
    || (asset?.assetType === "video" ? "mp4" : ["audio", "voice", "music"].includes(asset?.assetType) ? "wav" : imageExtension(asset?.url || ""));
}

function createAssetMediaPreview(asset, compact = false) {
  if (asset.assetType === "video") {
    const video = document.createElement("video");
    video.src = asset.url;
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    if (!compact) video.controls = true;
    return video;
  }
  if (["audio", "voice", "music"].includes(asset.assetType)) {
    const art = document.createElement("span");
    art.className = "asset-audio-art";
    art.setAttribute("aria-hidden", "true");
    art.textContent = asset.assetType === "voice" ? "声" : asset.assetType === "music" ? "♫" : "≋";
    return art;
  }
  const image = document.createElement("img");
  image.src = asset.url;
  image.alt = asset.name;
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  return image;
}

function renderAssetLibrary() {
  if (!assetPageGrid || !assetPageEmpty || !assetCategoryList) return;
  const counts = assetItems.reduce((result, item) => {
    result[item.categoryId] = (result[item.categoryId] || 0) + 1;
    return result;
  }, {});
  assetTotalCount.textContent = String(assetItems.length);
  assetCategoryList.replaceChildren(...assetCategories.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.assetPageCategory = category.id;
    button.classList.toggle("active", activeAssetCategory === category.id);
    const name = document.createElement("b");
    name.textContent = category.name;
    const count = document.createElement("em");
    count.textContent = String(counts[category.id] || 0);
    button.append(name, count);
    return button;
  }));
  document.querySelector('[data-asset-page-category="all"]')?.classList.toggle("active", activeAssetCategory === "all");
  const query = assetSearch?.value.trim().toLocaleLowerCase("zh-CN") || "";
  const visibleItems = assetItems.filter((item) => (
    (activeAssetCategory === "all" || item.categoryId === activeAssetCategory)
    && (!query || `${item.name} ${item.prompt}`.toLocaleLowerCase("zh-CN").includes(query))
  ));
  const category = assetCategories.find((item) => item.id === activeAssetCategory);
  assetCategoryTitle.textContent = category?.name || "全部资产";
  assetCategorySummary.textContent = `${visibleItems.length} 项 · 可加入工作流继续创作`;
  const cards = visibleItems.map((asset) => {
    const article = document.createElement("article");
    article.className = "asset-page-card";
    const preview = document.createElement("div");
    preview.className = "asset-page-preview";
    preview.classList.toggle("is-audio", ["audio", "voice", "music"].includes(asset.assetType));
    preview.append(createAssetMediaPreview(asset));
    if (["audio", "voice", "music"].includes(asset.assetType)) {
      const player = document.createElement("audio");
      player.src = asset.url;
      player.controls = true;
      player.preload = "metadata";
      preview.append(player);
    } else if (asset.assetType === "image") {
      preview.tabIndex = 0;
      preview.setAttribute("role", "button");
      preview.setAttribute("aria-label", `查看资产：${asset.name}`);
      preview.addEventListener("click", () => openHistoryDetail(asset));
      preview.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) openHistoryDetail(asset); });
    }
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = asset.name;
    const meta = document.createElement("span");
    const categoryName = assetCategories.find((item) => item.id === asset.categoryId)?.name || "未分类";
    meta.textContent = `${assetTypeLabel(asset)} · ${categoryName} · ${formatHistoryTime(asset.createdAt)}`;
    copy.append(title, meta);
    const actions = document.createElement("footer");
    const workflow = document.createElement("button");
    workflow.type = "button";
    workflow.textContent = "加入幕布";
    workflow.addEventListener("click", () => {
      setWorkspaceView("workflow");
      window.setTimeout(() => addWorkflowAssetNode({ ...asset, kind: asset.categoryId }), 360);
    });
    const download = document.createElement("a");
    download.href = asset.url;
    download.download = `huiju-asset-${asset.id}.${mediaDownloadExtension(asset)}`;
    download.textContent = "下载";
    const publish = document.createElement("button");
    publish.type = "button";
    publish.textContent = "发布广场";
    publish.hidden = !["image", "video"].includes(asset.assetType);
    publish.addEventListener("click", () => openPlazaPublishDialog({
      url:asset.url, prompt:asset.prompt, model:"绘域", title:asset.name,
    }));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "asset-delete";
    remove.textContent = "删除";
    let confirmationTimer = 0;
    remove.addEventListener("click", async () => {
      if (!remove.classList.contains("is-confirming")) {
        remove.classList.add("is-confirming");
        remove.textContent = "再次删除";
        confirmationTimer = window.setTimeout(() => {
          remove.classList.remove("is-confirming");
          remove.textContent = "删除";
        }, 3200);
        return;
      }
      window.clearTimeout(confirmationTimer);
      remove.disabled = true;
      remove.textContent = "删除中";
      try {
        await fetchJson(`${API.assets}/${encodeURIComponent(asset.id)}`, { method: "DELETE" }, 8000);
        assetItems = assetItems.filter((item) => item.id !== asset.id);
        renderAssetLibrary();
        showSidebarToast("资产已删除");
      } catch {
        remove.disabled = false;
        remove.classList.remove("is-confirming");
        remove.textContent = "重试删除";
        showSidebarToast("删除失败，请稍后重试");
      }
    });
    actions.append(workflow, download, remove);
    actions.insertBefore(publish, download);
    article.append(preview, copy, actions);
    return article;
  });
  assetPageGrid.replaceChildren(...cards);
  assetPageEmpty.hidden = cards.length > 0;
  assetPageGrid.hidden = cards.length === 0;
  renderAssetCategoryOptions(assetSaveCategory?.value || "");
}

async function loadAssetLibrary() {
  if (assetCategorySummary) assetCategorySummary.textContent = "正在读取资产…";
  try {
    const { body } = await fetchJson(API.assets, { method: "GET" }, 7000);
    assetCategories = Array.isArray(body.categories) && body.categories.length ? body.categories : [...FALLBACK_ASSET_CATEGORIES];
    assetItems = (Array.isArray(body.items) ? body.items : []).map(normalizedAsset).filter(Boolean);
  } catch {
    assetCategories = [...FALLBACK_ASSET_CATEGORIES];
    assetItems = [];
    if (assetCategorySummary) assetCategorySummary.textContent = "资产服务暂时不可用";
  }
  if (activeAssetCategory !== "all" && !assetCategories.some((item) => item.id === activeAssetCategory)) activeAssetCategory = "all";
  mentionAssetsLoaded = true;
  renderAssetLibrary();
}

function mentionToken(value, fallback = "素材") {
  const compact = String(value || fallback).trim().replace(/\s+/g, "-").replace(/[^0-9A-Za-z\u3400-\u9fff_-]/g, "").slice(0, 28);
  return `@${compact || fallback}`;
}

function promptReferenceCandidates() {
  const uploads = sourceFiles.map((file, index) => ({
    key: `upload:${index}`,
    type: "upload",
    index,
    name: `上传图 ${index + 1}`,
    detail: file.name || `参考图片 ${index + 1}`,
    url: sourcePreviewUrls[index] || "",
    token: `@上传图${index + 1}`,
  }));
  const assets = assetItems.filter((asset) => asset.assetType === "image").map((asset) => ({
    key: `asset:${asset.id}`,
    type: "asset",
    assetId: asset.id,
    name: asset.name,
    detail: assetCategories.find((category) => category.id === asset.categoryId)?.name || "资产库",
    url: asset.url,
    token: mentionToken(asset.name, "资产"),
  }));
  return [...uploads, ...assets];
}

function activePromptMention() {
  if (!toolPromptInput) return null;
  const caret = toolPromptInput.selectionStart ?? toolPromptInput.value.length;
  const before = toolPromptInput.value.slice(0, caret);
  const match = before.match(/(^|[\s，。；：、（(])@([^@\s，。；：、（）()]*)$/);
  if (!match) return null;
  const prefixLength = match[1]?.length || 0;
  return { start: (match.index || 0) + prefixLength, end: caret, query: match[2] || "" };
}

function reconcilePromptReferences() {
  if (!toolPromptInput) return;
  promptReferenceMentions = promptReferenceMentions.filter((item) => (
    toolPromptInput.value.includes(item.token)
    && (item.type !== "upload" || item.index < sourceFiles.length)
    && (item.type !== "asset" || assetItems.some((asset) => asset.id === item.assetId))
  ));
  renderPromptMentionStrip();
}

function renderPromptMentionStrip() {
  if (!promptMentionStrip) return;
  promptMentionStrip.hidden = promptReferenceMentions.length === 0;
  promptMentionStrip.replaceChildren(...promptReferenceMentions.map((reference) => {
    const chip = document.createElement("span");
    const image = document.createElement("img");
    image.src = reference.url;
    image.alt = "";
    const label = document.createElement("b");
    label.textContent = reference.token;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `移除 ${reference.token}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      toolPromptInput.value = toolPromptInput.value.replace(reference.token, "").replace(/ {2,}/g, " ");
      promptReferenceMentions = promptReferenceMentions.filter((item) => item.key !== reference.key);
      renderPromptMentionStrip();
      if (!sourceFiles.length && reference.type === "asset") {
        const nextAsset = promptReferenceMentions.find((item) => item.type === "asset");
        if (nextAsset) showMentionedAssetPreview(nextAsset);
        else clearSourcePreview();
      }
      toolPromptInput.focus();
    });
    chip.append(image, label, remove);
    return chip;
  }));
}

function showMentionedAssetPreview(reference) {
  if (!reference?.url || sourceFiles.length || !sourcePreview || !sourcePreviewShell) return;
  sourcePreviewUrl = reference.url;
  sourcePreview.onload = () => {
    sourcePreview.hidden = false;
    sourcePreviewShell.hidden = false;
    sourceUploadSurface?.classList.add("has-preview");
  };
  sourcePreview.onerror = () => setError("这项资产暂时无法预览，请换一项资产。");
  sourcePreview.src = reference.url;
  sourceMeta.textContent = `资产库 · ${reference.name}`;
  if (referenceStrip) referenceStrip.hidden = true;
}

function closePromptMentionPicker() {
  activeMentionRange = null;
  activeMentionIndex = 0;
  if (promptMentionPicker) {
    promptMentionPicker.hidden = true;
    promptMentionPicker.replaceChildren();
  }
}

function insertPromptReference(reference) {
  if (!toolPromptInput || !activeMentionRange) return;
  const existing = promptReferenceMentions.find((item) => item.key === reference.key);
  if (!existing && reference.type === "asset") {
    const currentReferenceCount = sourceFiles.length
      + promptReferenceMentions.filter((item) => item.type === "asset").length;
    if (currentReferenceCount >= 10) {
      setError("一次最多使用 10 张图片或资产，请先移除一张。");
      closePromptMentionPicker();
      return;
    }
  }
  const before = toolPromptInput.value.slice(0, activeMentionRange.start);
  const after = toolPromptInput.value.slice(activeMentionRange.end);
  toolPromptInput.value = `${before}${reference.token} ${after}`;
  const caret = before.length + reference.token.length + 1;
  toolPromptInput.setSelectionRange(caret, caret);
  if (!existing) promptReferenceMentions.push({ ...reference });
  renderPromptMentionStrip();
  if (reference.type === "asset" && !sourceFiles.length) showMentionedAssetPreview(reference);
  closePromptMentionPicker();
  toolPromptInput.focus();
}

function renderPromptMentionPicker() {
  if (!promptMentionPicker || !toolPromptInput) return;
  activeMentionRange = activePromptMention();
  if (!activeMentionRange) {
    closePromptMentionPicker();
    return;
  }
  const query = activeMentionRange.query.toLocaleLowerCase("zh-CN");
  const candidates = promptReferenceCandidates().filter((item) => (
    !query || `${item.name} ${item.detail} ${item.token}`.toLocaleLowerCase("zh-CN").includes(query)
  )).slice(0, 16);
  activeMentionIndex = Math.min(activeMentionIndex, Math.max(0, candidates.length - 1));
  const heading = document.createElement("div");
  heading.className = "prompt-mention-heading";
  heading.innerHTML = `<b>引用素材</b><span>${mentionAssetsLoading ? "正在读取资产库…" : "上传图片与个人资产"}</span>`;
  const options = candidates.map((reference, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === activeMentionIndex ? "is-active" : "";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === activeMentionIndex));
    const image = document.createElement("img");
    image.src = reference.url;
    image.alt = "";
    const copy = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = reference.name;
    const detail = document.createElement("small");
    detail.textContent = `${reference.type === "upload" ? "本次上传" : "个人资产"} · ${reference.detail}`;
    copy.append(name, detail);
    const token = document.createElement("em");
    token.textContent = reference.token;
    button.append(image, copy, token);
    button.addEventListener("mouseenter", () => {
      activeMentionIndex = index;
      promptMentionPicker.querySelectorAll('button[role="option"]').forEach((option, optionIndex) => {
        option.classList.toggle("is-active", optionIndex === index);
        option.setAttribute("aria-selected", String(optionIndex === index));
      });
    });
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => insertPromptReference(reference));
    return button;
  });
  if (!options.length) {
    const empty = document.createElement("p");
    empty.className = "prompt-mention-empty";
    empty.textContent = sourceFiles.length || assetItems.length ? "没有匹配的素材" : "请先上传图片或把作品加入资产库";
    promptMentionPicker.replaceChildren(heading, empty);
  } else {
    promptMentionPicker.replaceChildren(heading, ...options);
  }
  promptMentionPicker.hidden = false;
  if (!mentionAssetsLoaded && !mentionAssetsLoading) {
    mentionAssetsLoading = true;
    renderPromptMentionPicker();
    loadAssetLibrary().finally(() => {
      mentionAssetsLoading = false;
      if (activePromptMention()) renderPromptMentionPicker();
    });
  }
}

async function openAssetSaveDialog(candidate) {
  const file = candidate?.file instanceof File || candidate?.file instanceof Blob ? candidate.file : null;
  const url = file ? "" : safeGeneratedImageUrl(candidate?.url || "");
  if ((!url && !file) || !assetSaveDialog || !assetSavePreview || !assetSaveName) return;
  const mediaType = String(candidate.mediaType || file?.type || (candidate.assetType === "video" ? "video/mp4" : candidate.assetType === "audio" ? "audio/wav" : "image/webp")).toLowerCase();
  const inferredType = mediaType.startsWith("video/") ? "video" : mediaType.startsWith("audio/") ? "audio" : "image";
  pendingAssetCandidate = { ...candidate, url, file, mediaType, assetType:candidate.assetType || inferredType };
  if (!assetCategories.length || !assetSaveCategory?.options.length) await loadAssetLibrary();
  if (pendingAssetPreviewUrl) URL.revokeObjectURL(pendingAssetPreviewUrl);
  pendingAssetPreviewUrl = file ? URL.createObjectURL(file) : url;
  [assetSavePreview, assetSaveVideo, assetSaveAudio].forEach((media) => {
    if (!media) return;
    media.hidden = true;
    media.removeAttribute("src");
  });
  const preview = inferredType === "video" ? assetSaveVideo : inferredType === "audio" ? assetSaveAudio : assetSavePreview;
  if (preview) { preview.src = pendingAssetPreviewUrl; preview.hidden = false; }
  if (assetSaveMediaLabel) {
    assetSaveMediaLabel.hidden = false;
    assetSaveMediaLabel.textContent = inferredType === "video" ? "视频资产" : inferredType === "audio" ? "音频资产" : "图片资产";
  }
  if (assetSaveTypeRow) assetSaveTypeRow.hidden = inferredType !== "audio";
  if (assetSaveType) assetSaveType.value = ["voice", "music"].includes(candidate.assetType) ? candidate.assetType : "audio";
  assetSaveName.value = String(candidate.suggestedName || "未命名资产").slice(0, 40);
  const defaultCategory = inferredType === "video" ? "videos" : inferredType === "audio" ? (candidate.assetType === "voice" ? "voices" : candidate.assetType === "music" ? "music" : "audio") : "references";
  renderAssetCategoryOptions(defaultCategory);
  assetSaveStatus.textContent = "";
  if (!assetSaveDialog.open) assetSaveDialog.showModal();
  window.setTimeout(() => assetSaveName.select(), 80);
}

function closeAssetSaveDialog() {
  if (assetSaveDialog?.open) assetSaveDialog.close();
  [assetSavePreview, assetSaveVideo, assetSaveAudio].forEach((media) => media?.removeAttribute("src"));
  if (pendingAssetPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(pendingAssetPreviewUrl);
  pendingAssetPreviewUrl = "";
  pendingAssetCandidate = null;
}

function openAssetCategoryDialog() {
  if (!assetCategoryDialog || !assetCategoryName) return;
  assetCategoryName.value = "";
  assetCategoryStatus.textContent = "";
  if (!assetCategoryDialog.open) assetCategoryDialog.showModal();
  window.setTimeout(() => assetCategoryName.focus(), 80);
}

assetSaveClose?.addEventListener("click", closeAssetSaveDialog);
assetSaveCancel?.addEventListener("click", closeAssetSaveDialog);
assetSaveDialog?.addEventListener("click", (event) => { if (event.target === assetSaveDialog) closeAssetSaveDialog(); });
assetUploadButton?.addEventListener("click", () => assetUploadInput?.click());
assetUploadInput?.addEventListener("change", () => {
  const file = assetUploadInput.files?.[0];
  if (!file) return;
  const family = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : "";
  if (!family) return setError("请选择 PNG、JPG、WebP、MP4、WebM、MOV、WAV、MP3、M4A 或 OGG 文件。");
  const limit = family === "video" ? 200 : family === "audio" ? 30 : 15;
  if (file.size > limit * 1024 * 1024) return setError(`${family === "video" ? "视频" : family === "audio" ? "音频" : "图片"}不能超过 ${limit}MB。`);
  openAssetSaveDialog({ file, mediaType:file.type, assetType:family, suggestedName:file.name.replace(/\.[^.]+$/, "").slice(0, 40), prompt:"", kind:"upload" });
  assetUploadInput.value = "";
});
assetSaveForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingAssetCandidate || !assetSaveName.value.trim() || !assetSaveCategory.value) return;
  const submit = assetSaveForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  assetSaveStatus.textContent = "正在加入资产…";
  try {
    const assetType = pendingAssetCandidate.assetType === "audio" ? (assetSaveType?.value || "audio") : pendingAssetCandidate.assetType;
    let response;
    if (pendingAssetCandidate.file) {
      const payload = new FormData();
      payload.append("media", pendingAssetCandidate.file, pendingAssetCandidate.file.name || `asset.${mediaDownloadExtension(pendingAssetCandidate)}`);
      payload.append("name", assetSaveName.value.trim());
      payload.append("category_id", assetSaveCategory.value);
      payload.append("asset_type", assetType);
      payload.append("prompt", String(pendingAssetCandidate.prompt || ""));
      response = await fetchJson(API.assetUpload, { method:"POST", body:payload }, 180000);
    } else {
      const sourceUrl = new URL(pendingAssetCandidate.url, window.location.origin);
      response = await fetchJson(API.assets, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetSaveName.value.trim(), category_id: assetSaveCategory.value,
          url: sourceUrl.pathname, prompt: String(pendingAssetCandidate.prompt || ""),
          kind: String(pendingAssetCandidate.kind || "text").replace(/[^a-z0-9_-]/gi, "").slice(0, 64) || "text",
          asset_type: assetType,
        }),
      }, 15000);
    }
    const { body } = response;
    const asset = normalizedAsset(body.asset);
    if (asset) assetItems.unshift(asset);
    updateAudioVoiceOptions();
    assetSaveStatus.textContent = assetType === "voice" ? "已加入资产库和音色预设" : "已加入资产库";
    renderAssetLibrary();
    window.setTimeout(closeAssetSaveDialog, 420);
  } catch (error) {
    assetSaveStatus.textContent = error.status === 409 ? "资产数量已达到上限。" : error.status === 404 ? "原图已过期，请重新生成后加入。" : "加入失败，请稍后重试。";
  } finally {
    submit.disabled = false;
  }
});

assetCategoryClose?.addEventListener("click", () => assetCategoryDialog?.close());
assetCategoryCancel?.addEventListener("click", () => assetCategoryDialog?.close());
assetCategoryDialog?.addEventListener("click", (event) => { if (event.target === assetCategoryDialog) assetCategoryDialog.close(); });
assetCategoryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = assetCategoryName?.value.trim();
  if (!name) return;
  const submit = assetCategoryForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  assetCategoryStatus.textContent = "正在创建…";
  try {
    const { body } = await fetchJson(API.assetCategories, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }, 8000);
    if (body.category) assetCategories.push(body.category);
    renderAssetLibrary();
    renderAssetCategoryOptions(body.category?.id || "");
    assetCategoryStatus.textContent = "分类已创建";
    window.setTimeout(() => assetCategoryDialog.close(), 320);
  } catch (error) {
    assetCategoryStatus.textContent = error.status === 409 ? "分类已存在或数量已达上限。" : "创建失败，请稍后重试。";
  } finally {
    submit.disabled = false;
  }
});

assetNewCategory?.addEventListener("click", openAssetCategoryDialog);
assetDialogNewCategory?.addEventListener("click", openAssetCategoryDialog);
document.querySelector(".asset-category-rail")?.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-asset-page-category]") : null;
  if (!button) return;
  activeAssetCategory = button.dataset.assetPageCategory || "all";
  renderAssetLibrary();
});
assetSearch?.addEventListener("input", renderAssetLibrary);
assetWorkspaceBack?.addEventListener("click", () => setWorkspaceView("quick"));

async function waitForJob(statusUrl, signal) {
  const path = safeSameOriginPath(statusUrl);
  if (!path) throw new Error("invalid_status_url");

  for (let attempt = 0; attempt < API.maxPolls; attempt += 1) {
    if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
    const response = await fetchJson(path, { method: "GET", signal }, 15000);
    if (response.body.status === "completed") return response.body;
    if (response.body.status === "failed" || response.body.status === "cancelled") throw new Error("generation_failed");
    await sleep(API.pollIntervalMs);
  }
  throw new Error("poll_timeout");
}

function rememberPendingJob(statusPath) {
  const safePath = safeSameOriginPath(statusPath);
  if (!safePath) return;
  const state = {
    statusPath: safePath,
    mode: activeMode,
    prompt: lastSubmittedPrompt,
    startedAt: Date.now(),
  };
  try { window.localStorage.setItem(PENDING_JOB_STORAGE_KEY, JSON.stringify(state)); } catch { /* Resume remains unavailable only in this browser. */ }
}

function forgetPendingJob() {
  try { window.localStorage.removeItem(PENDING_JOB_STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
}

function readPendingJob() {
  try {
    const state = JSON.parse(window.localStorage.getItem(PENDING_JOB_STORAGE_KEY) || "null");
    if (!state || typeof state !== "object" || Date.now() - Number(state.startedAt) > PENDING_JOB_MAX_AGE_MS) {
      forgetPendingJob();
      return null;
    }
    const statusPath = safeSameOriginPath(state.statusPath);
    if (!statusPath || !/^\/api\/v1\/(?:images|videos|audio)\/jobs\/[a-zA-Z0-9_-]{6,64}$/.test(statusPath)) {
      forgetPendingJob();
      return null;
    }
    return { ...state, statusPath };
  } catch {
    forgetPendingJob();
    return null;
  }
}

async function resumePendingJob() {
  const pending = readPendingJob();
  if (!pending || activeRequest) return;
  if (hasToolingUI && MODE_COPY[pending.mode]) setMode(pending.mode);
  lastSubmittedPrompt = String(pending.prompt || "").slice(0, 12000);
  if (lastSubmittedPrompt) {
    const target = activeMode === "text" || activeMode === "video_text" || isAudioMode() ? promptInput : toolPromptInput;
    if (target) target.value = lastSubmittedPrompt;
    updatePromptMeta();
  }
  activeRequest = new AbortController();
  activeJobStatusPath = pending.statusPath;
  setError("");
  setBusy(true);
  setPending();
  try {
    const result = await waitForJob(pending.statusPath, activeRequest.signal);
    if (isVideoMode()) showMedia(result, "video");
    else if (isAudioMode()) showMedia(result, "audio");
    else showImages(result.images);
    forgetPendingJob();
  } catch (error) {
    if (error.name === "AbortError") {
      failSessionTurn(cancellationNotice || "已停止等待本次请求。");
      return;
    }
    if (error.message === "generation_failed" || error.status === 404) forgetPendingJob();
    const message = errorMessage(error);
    setError(message);
    failSessionTurn(message);
    setStatus("未完成", "error");
  } finally {
    activeRequest = null;
    activeJobStatusPath = null;
    setBusy(false);
  }
}

async function cancelActiveGeneration() {
  if (!activeRequest) return;
  const request = activeRequest;
  cancelButton.disabled = true;
  cancellationNotice = "已停止等待本次请求。";
  if (activeJobStatusPath) {
    try {
      const response = await fetchJson(activeJobStatusPath, { method: "DELETE" }, 8000);
      cancellationNotice = response.body.status === "cancelled"
        ? "已取消仍在排队的任务。"
        : "已停止等待本次请求。";
    } catch (error) {
      if (error.status === 409) cancellationNotice = "任务已开始生成，已停止等待；结果可能仍会在后台完成。";
    }
  }
  request.abort();
  forgetPendingJob();
}

function normalizedLayerBox(value) {
  const normalized = value?.normalized ?? value;
  if (Array.isArray(normalized) && normalized.length === 4) return normalized.map(Number);
  if (normalized && typeof normalized === "object") {
    const x1 = Number(normalized.x1 ?? normalized.left ?? normalized.x ?? 0);
    const y1 = Number(normalized.y1 ?? normalized.top ?? normalized.y ?? 0);
    const x2 = Number(normalized.x2 ?? normalized.right ?? (x1 + Number(normalized.width ?? 999)));
    const y2 = Number(normalized.y2 ?? normalized.bottom ?? (y1 + Number(normalized.height ?? 999)));
    return [x1, y1, x2, y2];
  }
  return [0, 0, 999, 999];
}

function createLayerWorkbench(items, savedPrompt, timestamp) {
  const workbench = document.createElement("section");
  workbench.className = "layer-result-workbench";
  const stage = document.createElement("div");
  stage.className = "layer-composite-stage";
  const stack = document.createElement("div");
  stack.className = "layer-stack-list";
  items.slice().sort((a, b) => Number(a.z_index || 0) - Number(b.z_index || 0)).forEach((item, index) => {
    const layer = document.createElement("img");
    layer.src = item.url;
    layer.alt = item.name || (Number(item.z_index || 0) === 0 ? "完整底图" : `图层 ${index}`);
    layer.loading = "lazy";
    layer.referrerPolicy = "no-referrer";
    layer.dataset.layerIndex = String(index);
    const [x1, y1, x2, y2] = normalizedLayerBox(item.bounding_box);
    Object.assign(layer.style, {
      left: `${Math.max(0, x1) / 9.99}%`, top: `${Math.max(0, y1) / 9.99}%`,
      width: `${Math.max(1, x2 - x1) / 9.99}%`, height: `${Math.max(1, y2 - y1) / 9.99}%`,
      zIndex: String(Number(item.z_index ?? index)),
    });
    stage.append(layer);

    const row = document.createElement("article");
    row.className = "layer-stack-item";
    const visibility = document.createElement("input");
    visibility.type = "checkbox";
    visibility.checked = true;
    visibility.setAttribute("aria-label", `显示${layer.alt}`);
    visibility.addEventListener("change", () => { layer.hidden = !visibility.checked; });
    const thumb = document.createElement("img");
    thumb.src = item.url;
    thumb.alt = "";
    const copy = document.createElement("div");
    copy.innerHTML = `<b>${escapeMarkup(layer.alt)}</b><span>${escapeMarkup(item.description || (index === 0 ? "完整画面" : "透明 PNG 图层"))}</span>`;
    const download = document.createElement("a");
    download.href = item.url;
    download.download = `huiju-layer-${timestamp}-${index + 1}.${imageExtension(item.url)}`;
    download.textContent = "下载";
    const addAsset = document.createElement("button");
    addAsset.type = "button";
    addAsset.textContent = "加入资产";
    addAsset.addEventListener("click", () => openAssetSaveDialog({ url:item.url, prompt:savedPrompt, kind:"layers", suggestedName:layer.alt }));
    row.append(visibility, thumb, copy, addAsset, download);
    stack.append(row);
  });
  const heading = document.createElement("header");
  heading.innerHTML = `<div><b>图层工作台</b><span>${items.length} 个可独立使用的图层</span></div>`;
  workbench.append(heading, stage, stack);
  return workbench;
}

function showImages(images) {
  const validItems = Array.isArray(images)
    ? images.map((image) => ({ ...image, url: safeImageUrl(image?.url), historyUrl:safeSameOriginPath(image?.history_url) })).filter((image) => image.url).slice(0, 17)
    : [];
  const isLayerResult = validItems.some((image) => image.kind === "layer" || Number.isFinite(Number(image.z_index)));
  const displayItems = isLayerResult ? validItems : validItems.slice(0, 4);
  const validImages = displayItems.map((image) => image.url);
  if (!validImages.length) throw new Error("missing_images");

  const createdAt = Date.now();
  const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, "-");
  const savedPrompt = lastSubmittedPrompt || currentPrompt() || promptInput.value;
  const cards = isLayerResult ? [createLayerWorkbench(displayItems, savedPrompt, timestamp)] : displayItems.map((item, index) => {
    const url = item.url;
    const card = document.createElement("figure");
    card.className = "result-card";
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "session-image-preview";
    preview.setAttribute("aria-label", `查看本次生成图像 ${index + 1} 的大图与提示词`);
    const image = document.createElement("img");
    image.src = url;
    image.alt = `本次生成图像 ${index + 1}`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    preview.append(image);
    preview.addEventListener("click", () => openHistoryDetail({ url, historyUrl:item.historyUrl, prompt: savedPrompt, createdAt }));
    const actions = document.createElement("figcaption");
    const addAsset = document.createElement("button");
    addAsset.type = "button";
    addAsset.className = "result-asset-action";
    addAsset.innerHTML = '<span aria-hidden="true">＋</span> 加入资产';
    addAsset.addEventListener("click", () => openAssetSaveDialog({
      url,
      prompt: savedPrompt,
      kind: activeMode,
      suggestedName: `${activeCapabilityName?.textContent || "创作"} ${index + 1}`,
    }));
    const publish = document.createElement("button");
    publish.type = "button";
    publish.className = "result-asset-action";
    publish.textContent = "发布到广场";
    publish.disabled = !item.historyUrl;
    publish.addEventListener("click", () => openPlazaPublishDialog({
      url:item.historyUrl, prompt:savedPrompt,
      model:activeCapabilityName?.textContent || "绘域", title:`创作 ${index + 1}`,
    }));
    const download = document.createElement("a");
    download.href = url;
    download.download = `huiju-${timestamp}-${index + 1}.${imageExtension(url)}`;
    download.innerHTML = '<span aria-hidden="true">↓</span> 下载';
    download.setAttribute("aria-label", `下载本次生成图像 ${index + 1}`);
    actions.append(addAsset, publish, download);
    card.append(preview, actions);
    return card;
  });

  const turn = activeSessionTurn || createSessionTurn();
  turn.classList.remove("is-pending", "is-error");
  const state = turn.querySelector(".session-turn-state");
  if (state) state.textContent = isLayerResult ? `${validImages.length} 个图层完成` : `${validImages.length} 张完成`;
  const imageGrid = turn.querySelector(".session-image-grid");
  if (imageGrid) imageGrid.replaceChildren(...cards);
  activeSessionTurn = null;
  saveHistory(displayItems, createdAt, savedPrompt);
  resultPlaceholder.hidden = true;
  resultPlaceholder.classList.remove("is-pending");
  resultGrid.hidden = false;
  resultsTitle.textContent = "会话记录";
  resultTip.textContent = isLayerResult ? "可逐层显隐、下载，或命名后加入个人资产。" : "每张图片都可以下载，或命名后加入个人资产长期复用。";
  setStatus("已完成");
  requestAnimationFrame(() => resultStage.scrollTo({ top: resultStage.scrollHeight, behavior: "smooth" }));
}

function showMedia(result, kind) {
  const url = safeImageUrl(result?.url);
  if (!url) throw new Error('missing_media');
  const turn = activeSessionTurn || createSessionTurn();
  turn.classList.remove('is-pending', 'is-error');
  turn.classList.add('is-media-turn');
  const state = turn.querySelector('.session-turn-state');
  if (state) state.textContent = kind === 'video' ? '视频完成' : '配音完成';
  const shell = document.createElement('figure');
  shell.className = `result-card media-result-card ${kind}-result-card`;
  const media = document.createElement(kind === 'video' ? 'video' : 'audio');
  media.src = url;
  media.controls = true;
  media.preload = 'metadata';
  if (kind === 'video') media.playsInline = true;
  const actions = document.createElement('figcaption');
  const download = document.createElement('a');
  download.href = url;
  download.download = `huiju-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.${kind === 'video' ? 'mp4' : 'wav'}`;
  download.innerHTML = '<span aria-hidden="true">↓</span> 下载';
  const saveAsset = document.createElement('button');
  saveAsset.type = 'button';
  saveAsset.innerHTML = '<span aria-hidden="true">＋</span> 存入资产库';
  saveAsset.addEventListener('click', () => openAssetSaveDialog({
    url, assetType:kind, mediaType:kind === 'video' ? 'video/mp4' : 'audio/wav',
    suggestedName:kind === 'video' ? '未命名视频' : '未命名音频',
    prompt:String(isAudioMode() ? currentPrompt() : (promptInput?.value || toolPromptInput?.value || '')),
    kind:activeMode || kind,
  }));
  const publish = document.createElement('button');
  publish.type = 'button';
  publish.className = 'result-asset-action';
  publish.textContent = '发布到广场';
  publish.hidden = kind !== 'video';
  publish.addEventListener('click', () => openPlazaPublishDialog({
    url:new URL(url).pathname, prompt:String(promptInput?.value || toolPromptInput?.value || ''),
    model:activeCapabilityName?.textContent || '绘域', title:'我的视频作品',
  }));
  const saveVoicePreset = document.createElement('button');
  saveVoicePreset.type = 'button';
  saveVoicePreset.innerHTML = '<span aria-hidden="true">♫</span> 设为预设音色';
  saveVoicePreset.addEventListener('click', () => openAssetSaveDialog({
    url, assetType:'voice', mediaType:'audio/wav',
    suggestedName:`生成音色 ${new Intl.DateTimeFormat('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date())}`,
    prompt:String(currentPrompt()), kind:'generated_voice',
  }));
  actions.append(download, saveAsset, publish);
  if (kind === 'audio') actions.append(saveVoicePreset);
  shell.append(media, actions);
  turn.querySelector('.session-image-grid')?.replaceChildren(shell);
  activeSessionTurn = null;
  resultPlaceholder.hidden = true;
  resultGrid.hidden = false;
  resultsTitle.textContent = '会话记录';
  resultTip.textContent = kind === 'video' ? '视频已保存在你的私有生成记录中，可播放、下载或存入资产库。' : '配音可试听、下载、存入资产库，也可设为下拉框中的预设音色。';
  setStatus('已完成');
  requestAnimationFrame(() => resultStage.scrollTo({ top: resultStage.scrollHeight, behavior: 'smooth' }));
}

function errorMessage(error) {
  if (error.name === "AbortError") return "已取消本次生成。";
  if (error.message === "voice_rights_confirmation_required") return "未确认声音授权，本次参考音频不会上传或处理。";
  if (error.message === "analysis_empty") return "图片旁白生成失败，请更换图片或补充旁白要求后重试。";
  if (error.message === "source_image_missing") return "请先上传参考图，或在补充要求中输入 @ 选择个人资产。";
  if (error.status === 429 && modelSelect?.value === "qwen_image") return "Qwen-Image-2512 每分钟最多生成 10 次，请稍后再试。";
  if (error.status === 429) return "当前请求较多，请稍后再试。";
  if (error.status === 401 || error.status === 403) return "当前没有生成权限，请联系管理员。";
  if (error.status === 402) return "可用额度不足，请缩短内容或补充额度后再试。";
  if (error.status === 413) return "文件或输入内容过大，请缩小图片或缩短描述后再试。";
  if (error.status === 415) return "请上传 PNG、JPG 或 WebP 格式的图片。";
  if (error.status === 422) return "当前参数组合暂不支持，请调整视角数量或分辨率后重试。";
  if (error.status === 503 || error.status === 504 || error.message === "poll_timeout") return "生成服务暂时繁忙，请稍后再试。";
  return "本次生成未完成，请调整描述后重新提交。";
}

function selectedValue(name) {
  return form.querySelector(`select[name="${name}"], input[name="${name}"]:checked, input[type="hidden"][name="${name}"]`)?.value;
}

function newIdempotencyKey() {
  return crypto.randomUUID();
}

function clearSourcePreview() {
  if (!hasToolingUI) return;
  sourcePreviewToken += 1;
  sourcePreview.onload = null;
  sourcePreview.onerror = null;
  if (sourcePreviewUrls.length) sourcePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  else if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
  sourcePreviewUrl = null;
  sourcePreviewUrls = [];
  sourceFiles = [];
  activeReferenceIndex = 0;
  syncCameraSourcePreview();
  imageAnnotations = [];
  sourcePreview.removeAttribute("src");
  sourcePreview.hidden = true;
  if (sourceVideoPreview) {
    sourceVideoPreview.pause();
    sourceVideoPreview.removeAttribute("src");
    sourceVideoPreview.hidden = true;
  }
  sourceAudioPreview.pause();
  sourceAudioPreview.removeAttribute("src");
  sourceAudioPreview.hidden = true;
  if (sourceSaveVoiceButton) sourceSaveVoiceButton.hidden = true;
  if (sourcePreviewShell) sourcePreviewShell.hidden = true;
  sourceUploadSurface?.classList.remove("has-preview");
  if (maskEditor) maskEditor.hidden = true;
  maskLayer = null;
  maskTintLayer = null;
  maskHasPaint = false;
  maskClear.disabled = true;
  maskFocusTrigger.disabled = true;
  maskBrushPopover.hidden = true;
  maskBrushTrigger.setAttribute("aria-expanded", "false");
  sourceMeta.textContent = "尚未选择素材";
  if (referenceStrip) referenceStrip.replaceChildren();
  reconcilePromptReferences();
  renderImageAnnotations();
}

function sourceCapabilityKey(mode = activeMode, capabilityId = selectedCapabilityId) {
  return `${mode}::${capabilityId || mode}`;
}

function cacheCurrentSourceState() {
  if (!sourceFiles.length) return;
  sourceStateByCapability.set(sourceCapabilityKey(), {
    files:[...sourceFiles],
    previewUrls:sourcePreviewUrls.map((url) => url?.startsWith("blob:") ? "" : url),
    activeIndex:activeReferenceIndex,
    annotations:imageAnnotations.map((item) => ({ ...item, coordinates:[...(item.coordinates || [])] })),
  });
}

function restoreCachedSourceState(key, maxFiles) {
  const cached = sourceStateByCapability.get(key);
  if (!cached?.files?.length) return;
  sourceFiles = cached.files.slice(0, maxFiles);
  sourcePreviewUrls = sourceFiles.map((file, index) => cached.previewUrls?.[index] || URL.createObjectURL(file));
  imageAnnotations = cached.annotations || [];
  activeReferenceIndex = Math.min(Number(cached.activeIndex || 0), sourceFiles.length - 1);
  renderReferenceStrip();
  showActiveReference(activeReferenceIndex);
  const totalMb = sourceFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024;
  sourceMeta.textContent = sourceFiles.length === 1
    ? `${sourceFiles[0].name} · ${totalMb.toFixed(1)}MB · 已恢复`
    : `${sourceFiles.length} 项缓存素材 · ${totalMb.toFixed(1)}MB`;
  sourceFiles.forEach((file, index) => {
    if ((file.type.startsWith("video/") || file.type.startsWith("audio/")) && sourcePreviewUrls[index]?.startsWith("blob:")) {
      upgradeSourceMediaPreview(file, index);
    }
  });
}

function normalizedPointer(event) {
  if (!annotationOverlay) return null;
  const rect = annotationOverlay.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.max(0, Math.min(999, Math.round((event.clientX - rect.left) / rect.width * 999))),
    y: Math.max(0, Math.min(999, Math.round((event.clientY - rect.top) / rect.height * 999))),
  };
}

function positionAnnotationOverlay() {
  if (!annotationOverlay || !sourcePreviewShell || !sourcePreview || activeMode !== "interactive") return;
  const shellRect = sourcePreviewShell.getBoundingClientRect();
  const imageRect = sourcePreview.getBoundingClientRect();
  annotationOverlay.style.left = `${imageRect.left - shellRect.left}px`;
  annotationOverlay.style.top = `${imageRect.top - shellRect.top}px`;
  annotationOverlay.style.width = `${imageRect.width}px`;
  annotationOverlay.style.height = `${imageRect.height}px`;
}

function renderImageAnnotations() {
  if (!annotationOverlay) return;
  annotationOverlay.replaceChildren();
  imageAnnotations.filter((item) => item.image_index === activeReferenceIndex + 1).forEach((item, index) => {
    if (item.kind === "point") {
      const [x, y] = item.coordinates;
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.innerHTML = `<circle cx="${x}" cy="${y}" r="27"/><path d="M${x - 40} ${y}h80M${x} ${y - 40}v80"/><text x="${x + 34}" y="${y - 28}">${index + 1}</text>`;
      annotationOverlay.append(group);
    } else {
      const [x1, y1, x2, y2] = item.coordinates;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(Math.min(x1, x2)));
      rect.setAttribute("y", String(Math.min(y1, y2)));
      rect.setAttribute("width", String(Math.max(1, Math.abs(x2 - x1))));
      rect.setAttribute("height", String(Math.max(1, Math.abs(y2 - y1))));
      annotationOverlay.append(rect);
    }
  });
  if (annotationDraft?.kind === "bbox" && annotationDraft.image_index === activeReferenceIndex + 1) {
    const [x1, y1, x2, y2] = annotationDraft.coordinates;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.classList.add("is-draft");
    rect.setAttribute("x", String(Math.min(x1, x2)));
    rect.setAttribute("y", String(Math.min(y1, y2)));
    rect.setAttribute("width", String(Math.max(1, Math.abs(x2 - x1))));
    rect.setAttribute("height", String(Math.max(1, Math.abs(y2 - y1))));
    annotationOverlay.append(rect);
  }
  if (annotationSummary) annotationSummary.textContent = imageAnnotations.length
    ? `已添加 ${imageAnnotations.length} 个标注 · 当前为图 ${activeReferenceIndex + 1}`
    : "尚未添加标注";
}

function showActiveReference(index) {
  if (!sourcePreviewUrls[index]) return;
  activeReferenceIndex = index;
  sourcePreviewUrl = sourcePreviewUrls[index];
  const file = sourceFiles[index];
  const isVideo = Boolean(file?.type?.startsWith("video/"));
  const isAudio = Boolean(file?.type?.startsWith("audio/"));
  syncCameraSourcePreview();
  if (isAudio) {
    sourcePreview.hidden = true;
    sourcePreview.removeAttribute('src');
    if (sourceVideoPreview) { sourceVideoPreview.pause(); sourceVideoPreview.hidden = true; sourceVideoPreview.removeAttribute('src'); }
    sourceAudioPreview.src = sourcePreviewUrl;
    sourceAudioPreview.hidden = false;
    sourceAudioPreview.load();
    if (sourceSaveVoiceButton) sourceSaveVoiceButton.hidden = !AUDIO_REFERENCE_MODES.has(activeMode);
    sourcePreviewShell.hidden = false;
    sourceUploadSurface?.classList.add("has-preview");
    sourcePreviewShell.querySelector(".source-replace-button")?.replaceChildren(document.createTextNode("更换音频"));
    sourceMeta.textContent = `${file.name} · 音频素材`;
    [...(referenceStrip?.children || [])].forEach((button, itemIndex) => button.classList.toggle("active", itemIndex === index));
    return;
  }
  if (isVideo && sourceVideoPreview) {
    sourceAudioPreview.pause();
    sourceAudioPreview.removeAttribute("src");
    sourceAudioPreview.hidden = true;
    sourcePreview.onload = null;
    sourcePreview.onerror = null;
    sourcePreview.hidden = true;
    sourcePreview.removeAttribute("src");
    sourceVideoPreview.onerror = () => setError("该视频编码无法在浏览器中播放。请使用 H.264 编码的 MP4 或 WebM；文件仍可用于支持它的生成能力。");
    sourceVideoPreview.onloadedmetadata = () => setError("");
    sourceVideoPreview.src = sourcePreviewUrl;
    sourceVideoPreview.hidden = false;
    sourceVideoPreview.load();
    sourcePreviewShell.hidden = false;
    sourceUploadSurface?.classList.add("has-preview");
    sourcePreviewShell.querySelector(".source-replace-button")?.replaceChildren(document.createTextNode("更换视频"));
    [...(referenceStrip?.children || [])].forEach((button, itemIndex) => button.classList.toggle("active", itemIndex === index));
    return;
  }
  if (sourceVideoPreview) {
    sourceVideoPreview.pause();
    sourceVideoPreview.removeAttribute("src");
    sourceVideoPreview.hidden = true;
  }
  sourceAudioPreview.pause();
  sourceAudioPreview.removeAttribute("src");
  sourceAudioPreview.hidden = true;
  sourcePreview.onload = () => {
    sourcePreview.hidden = false;
    sourcePreviewShell.hidden = false;
    sourceUploadSurface?.classList.add("has-preview");
    sourcePreviewShell.querySelector(".source-replace-button")?.replaceChildren(document.createTextNode("更换图片"));
    if (activeMode === "redraw") { maskEditor.hidden = false; initializeMaskCanvas(); }
    requestAnimationFrame(() => { positionAnnotationOverlay(); renderImageAnnotations(); });
  };
  sourcePreview.onerror = () => setError("这张图片无法预览，请换一张 PNG、JPG 或 WebP 图片。");
  sourcePreview.src = sourcePreviewUrl;
  [...(referenceStrip?.children || [])].forEach((button, itemIndex) => button.classList.toggle("active", itemIndex === index));
  renderImageAnnotations();
}

function renderReferenceStrip() {
  if (!referenceStrip) return;
  referenceStrip.replaceChildren(...sourceFiles.map((file, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === activeReferenceIndex ? "active" : "";
    button.setAttribute("aria-label", `查看参考图 ${index + 1}：${file.name}`);
    const isAudio = sourceFiles[index]?.type?.startsWith('audio/');
    const image = sourceFiles[index]?.type?.startsWith("video/")
      ? document.createElement("video")
      : isAudio ? document.createElement('span') : document.createElement("img");
    if (!isAudio) image.src = sourcePreviewUrls[index];
    else { image.textContent = '♫'; image.className = 'reference-audio-icon'; }
    if (image instanceof HTMLVideoElement) { image.muted = true; image.preload = "metadata"; }
    image.setAttribute("aria-hidden", "true");
    const indexLabel = document.createElement("span");
    indexLabel.textContent = String(index + 1);
    button.append(image, indexLabel);
    button.addEventListener("click", () => showActiveReference(index));
    return button;
  }));
  referenceStrip.hidden = sourceFiles.length < 2;
}

function renderToolPresets(mode) {
  if (!toolPresetSelect || mode === "text") return;
  const presets = toolPresets[mode] || FALLBACK_TOOL_PRESETS[mode] || [];
  const previous = toolPresetSelect.value;
  toolPresetSelect.replaceChildren(...presets.map((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    return option;
  }));
  if (presets.some((item) => item.id === previous)) toolPresetSelect.value = previous;
  if (toolPromptInput) toolPromptInput.placeholder = "描述希望改变或保留的细节；系统会先应用任务预设。";
}

function configureToolPrompt(mode) {
  if (!toolPromptInput || !toolPromptField || !toolPromptLabel) return;
  const audioCopy = UNIFIED_MODES.has(mode)
    ? { label:"", placeholder: MODE_COPY[mode].placeholder }
    : mode === "audio_reference"
    ? { label:"配音文字", placeholder:"输入要用参考音色朗读的新旁白、对白或广告文案。" }
    : mode === "audio_custom_voice"
    ? { label:"音色描述", placeholder:"例如：温暖明亮的青年女声，咬字清晰，语速舒缓，带轻微微笑感。" }
    : mode === "audio_image"
    ? { label:"旁白文字（选填）", placeholder:"可选：输入旁白要求；留空则根据图片自动生成。" }
    : { label:"编辑要求（选填）", placeholder:"描述希望改变或保留的细节；系统会先应用任务预设。" };
  toolPromptLabel.textContent = audioCopy.label;
  toolPromptLabel.hidden = !AUDIO_SOURCE_MODES.has(mode);
  toolPromptInput.placeholder = audioCopy.placeholder;
  toolPromptInput.required = mode === "audio_reference" || mode === "audio_custom_voice";
  toolPromptInput.setAttribute("aria-label", audioCopy.label);
  if (customVoicePreviewField) customVoicePreviewField.hidden = mode !== "audio_custom_voice";
  if (mode === "audio_custom_voice" && customVoicePreviewInput && !customVoicePreviewInput.value.trim()) {
    customVoicePreviewInput.value = DEFAULT_CUSTOM_VOICE_PREVIEW;
  }
}

function currentPrompt() {
  if (UNIFIED_MODES.has(activeMode)) return toolPromptInput?.value.trim() || promptInput.value.trim();
  if (activeMode === "text" || activeMode === "video_text" || activeMode === "audio_tts") return promptInput.value.trim();
  if (AUDIO_SOURCE_MODES.has(activeMode)) return toolPromptInput?.value.trim() || "";
  const preset = (toolPresets[activeMode] || []).find((item) => item.id === toolPresetSelect?.value);
  const extra = toolPromptInput?.value.trim() || "";
  return [preset?.label, extra].filter(Boolean).join(" · ") || MODE_COPY[activeMode]?.title || "图像处理";
}

function modeUsesSourceInput(mode) {
  if (UNIFIED_MODES.has(mode)) return true;
  if (mode === "text" || mode === "video_text") return false;
  if (AUDIO_MODES.has(mode)) return AUDIO_SOURCE_MODES.has(mode);
  return true;
}

async function loadToolPresets() {
  try {
    const bootstrap = await workspaceBootstrapPromise;
    const body = bootstrap?.tool_presets || (await fetchJson(API.toolPresets, { method: "GET" }, 5000)).body;
    if (body?.presets && typeof body.presets === "object") toolPresets = body.presets;
  } catch {
    toolPresets = FALLBACK_TOOL_PRESETS;
  }
  renderToolPresets(activeMode);
}

function setMode(mode, capabilityId = "", capabilityLabel = "") {
  if (!hasToolingUI || !MODE_COPY[mode] || activeRequest) return;
  const nextKey = sourceCapabilityKey(mode, capabilityId);
  const capabilityChanged = nextKey !== sourceCapabilityKey();
  if (capabilityChanged) {
    cacheCurrentSourceState();
    clearSourcePreview();
    if (sourceImageInput) sourceImageInput.value = "";
  }
  activeMode = mode;
  selectedCapabilityId = capabilityId;
  const compatibleModels = modelChoicesForMode(mode);
  const selectedIsCompatible = compatibleModels.some((item) => item.id === modelSelect?.value && item.available);
  if (!selectedIsCompatible) {
    const fallbackModel = compatibleModels.find((item) => item.available) || compatibleModels[0];
    if (fallbackModel) setModelSelectValue(fallbackModel.id, fallbackModel.label);
  }
  if (mode === "interactive" || mode === "layers") {
    setModelSelectValue("seedream_5_0_pro", "Seedream 5.0 Pro");
  }
  form.dataset.mode = mode;
  const unified = UNIFIED_MODES.has(mode);
  const imageEditingMode = IMAGE_EDIT_MODES.has(mode);
  presetSelectWrap.hidden = imageEditingMode || unified || isVideoMode(mode) || isAudioMode(mode);
  styleSelectWrap.hidden = imageEditingMode;
  maskToolbarActions.hidden = mode !== "redraw";
  if (imageEditingMode) {
    presetSelectMenu.hidden = true;
    styleSelectMenu.hidden = true;
    presetSelectTrigger.setAttribute("aria-expanded", "false");
    styleSelectTrigger.setAttribute("aria-expanded", "false");
  }
  if (mode !== "redraw") {
    maskBrushPopover.hidden = true;
    maskBrushTrigger.setAttribute("aria-expanded", "false");
  }
  document.querySelectorAll('.generator-tab').forEach((tab) => {
    const tabMode = tab.dataset.modeTab;
    const active = tabMode === 'text' ? mode === 'text' : tabMode === 'edit' ? mode !== 'text' : false;
    tab.classList.toggle('active', active);
  });
  const copy = MODE_COPY[mode];
  updateActiveCapabilityIndicator(mode, capabilityId, capabilityLabel);
  const selectedTool = TOOL_SELECTOR_CHOICES.find(([id]) => id === mode);
  if (sidebarToolLabel && selectedTool) sidebarToolLabel.textContent = selectedTool[1];
  if (creationIntro) {
    const lead = creationIntro.querySelector("p");
    const note = creationIntro.querySelector("span");
    if (lead) {
      lead.replaceChildren();
      if (mode === "text") {
        lead.append("开启你的 ");
        const strong = document.createElement("strong");
        strong.textContent = "图片生成";
        lead.append(strong, " 绘梦之旅。");
      } else {
        lead.textContent = copy.title;
      }
    }
    if (note) note.textContent = mode === "text" ? "用一句话描述你想看到的画面；图像编辑请从左侧“图片编辑”分类进入。" : copy.help;
  }
  modeEyebrow.replaceChildren();
  const indicator = document.createElement("span");
  indicator.setAttribute("aria-hidden", "true");
  modeEyebrow.append(indicator, ` ${copy.eyebrow}`);
  // Unified modes keep the ordinary prompt box; material is optional, so never demand it.
  resultsTitle.textContent = unified || (!VIDEO_IMAGE_MODES.has(mode) && !AUDIO_SOURCE_MODES.has(mode)
    && (VIDEO_MODES.has(mode) || AUDIO_MODES.has(mode) || mode === "text")) ? "等待你的描述" : "等待参考素材";
  document.querySelector("#studio-title").textContent = copy.title;
  if (promptHelp) promptHelp.textContent = copy.help;
  if (promptLabel) promptLabel.textContent = copy.promptLabel;
  promptInput.placeholder = copy.placeholder;
  configureToolPrompt(mode);
  generateButton.querySelector(".button-label").textContent = copy.action;
  sourceImageGroup.hidden = !modeUsesSourceInput(mode);
  maskEditor.hidden = mode !== "redraw" || !sourceImageInput.files?.length;
  if (mode === "redraw" && sourcePreview.complete && sourcePreview.naturalWidth) initializeMaskCanvas();
  cameraEditor.hidden = mode !== "multiangle";
  if (mode === "multiangle") void initializeCameraWorkspace().then(updateCamera);
  if (interactiveEditor) interactiveEditor.hidden = mode !== "interactive";
  if (layerModeNote) layerModeNote.hidden = mode !== "layers";
  sourcePreviewShell?.classList.toggle("is-interactive", mode === "interactive");
  if (annotationOverlay) annotationOverlay.toggleAttribute("hidden", mode !== "interactive");
  if (unified) {
    sourceAction.textContent = copy.sourceAction;
  } else if (AUDIO_SOURCE_MODES.has(mode)) {
    sourceAction.textContent = copy.sourceAction;
  } else if (mode !== "text" && mode !== "video_text" && !AUDIO_MODES.has(mode)) {
    sourceAction.textContent = copy.sourceAction;
    renderToolPresets(mode);
    if (mode === "upscale") {
      const resolutionSelect = form.querySelector('select[name="resolution"]');
      if (resolutionSelect && !["2k", "4k"].includes(resolutionSelect.value)) {
        resolutionSelect.value = "2k";
        updateOutputSummary();
      }
    }
  }
  const limits = sourceMediaLimits(mode);
  const acceptsVideoReference = limits.video;
  const acceptsAudioReference = limits.audio;
  const acceptsImageReference = limits.image;
  const unifiedHelp = {
    unified_image: "PNG、JPG、WebP · 选填，最多 10 张",
    unified_video: "PNG、JPG、WebP · 选填，作为视频首帧",
    unified_audio: "WAV、MP3、M4A、OGG · 选填，建议 10–20 秒清晰人声",
  }[mode];
  if (sourceImageInput) sourceImageInput.accept = [
    acceptsImageReference ? "image/png,image/jpeg,image/webp" : "",
    acceptsVideoReference ? "video/mp4,video/webm,video/quicktime" : "",
    acceptsAudioReference ? (AUDIO_REFERENCE_MODES.has(mode) ? "audio/wav,audio/mpeg,audio/mp4" : "audio/wav,audio/mpeg,audio/mp4,audio/ogg") : "",
  ].filter(Boolean).join(',');
  if (sourceFileHelp) sourceFileHelp.textContent = unifiedHelp
    || (mode === 'audio_custom_voice'
      ? "WAV、MP3、M4A · 选填，建议 10–20 秒清晰人声"
      : mode === 'audio_reference'
      ? "WAV、MP3、M4A · 建议 10–20 秒清晰人声"
      : acceptsAudioReference
      ? "图片、视频或音频 · 按当前能力选择 2–3 项"
      : acceptsVideoReference ? "图片或 MP4、WebM、MOV" : "PNG、JPG、WebP · 最大 15MB");
  document.querySelector(".tool-preset-field")?.toggleAttribute("hidden", mode === "text" || unified || isVideoMode(mode) || isAudioMode(mode));
  document.querySelector(".tool-command-panel")?.toggleAttribute("hidden", isAudioMode(mode) && !AUDIO_SOURCE_MODES.has(mode));
  document.querySelectorAll("[data-text-only]").forEach((section) => { section.hidden = mode !== "text"; });
  const fixedOutputTool = mode === "upscale" || mode === "cutout";
  if (outputCountSection) outputCountSection.hidden = isVideoMode(mode) || isAudioMode(mode) || fixedOutputTool;
  if (outputRatioSection) outputRatioSection.hidden = isAudioMode(mode) || fixedOutputTool;
  if (outputResolutionSection) outputResolutionSection.hidden = isAudioMode(mode) || mode === "cutout";
  if (outputQualitySection) outputQualitySection.hidden = isVideoMode(mode) || isAudioMode(mode) || fixedOutputTool;
  if (outputSettingsTrigger) outputSettingsTrigger.hidden = mode === "cutout";
  if (videoDurationSection) videoDurationSection.hidden = !isVideoMode(mode);
  if (audioVoiceSection) audioVoiceSection.hidden = !isAudioMode(mode) || mode === 'audio_custom_voice';
  if (audioLanguageSection) audioLanguageSection.hidden = !isAudioMode(mode);
  if (audioSpeedSection) audioSpeedSection.hidden = !isAudioMode(mode);
  if (audioEmotionSection) audioEmotionSection.hidden = !isAudioMode(mode) || modelSelect?.value !== 'doubao-tts-2.0';
  if (isAudioMode(mode)) {
    loadAssetLibrary().then(() => updateAudioVoiceOptions(modelSelect?.value));
  }
  syncVideoResolutionOptions();
  viewsControl.hidden = mode !== "multiview";
  const maxSourceFiles = limits.max;
  if (sourceImageInput) sourceImageInput.multiple = maxSourceFiles > 1;
  if (capabilityChanged) {
    restoreCachedSourceState(nextKey, maxSourceFiles);
  } else if (sourceFiles.length > maxSourceFiles) {
    sourceFiles = sourceFiles.slice(0, maxSourceFiles);
    sourcePreviewUrls = sourcePreviewUrls.slice(0, maxSourceFiles);
    imageAnnotations = [];
    activeReferenceIndex = 0;
    renderReferenceStrip();
    showActiveReference(0);
    reconcilePromptReferences();
  }
  requestAnimationFrame(positionAnnotationOverlay);
  toolNavItems.forEach((item) => {
    const active = item.dataset.mode === mode;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  setError("");
  updateVideoDurationBounds();
  updateOutputSummary();
  setIdle();
  syncComposerSelector();
  syncSidebarModelSelector();
  syncUnifiedRoute();
}

function updateChoiceStyles() {
  // Native selects provide their own selected-state affordance.
}

function setStyle(styleId) {
  const style = catalog.styles.find((item) => item.id === styleId);
  if (!style) return;
  selectedStyle = style.id;
  if (styleSelect) styleSelect.value = style.id;
  syncToolbarSelectMenus();
}

function renderStyles() {
  if (!styleSelect) return;
  const options = catalog.styles.map((style) => {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = style.label;
    return option;
  });
  styleSelect.replaceChildren(...options);
  styleSelect.addEventListener("change", () => setStyle(styleSelect.value));
  setStyle(selectedStyle);
  syncToolbarSelectMenus();
}

function updatePromptMeta() {
  if (charCount) charCount.textContent = String(promptInput.value.length);
}

function applyPreset(preset) {
  const current = promptInput.value.trim();
  const alreadyStructured = /^(创作目标|场景与背景|主体、动作与关系|主体|场景与关系|镜头与景深)[：:]/m.test(current);
  const subjectHint = current && !alreadyStructured ? current : "请在这里补充具体主体、数量与动作";
  promptInput.value = preset.prompt.replaceAll("【主体内容】", subjectHint);
  selectedPreset = preset.id;
  if (presetSelect) presetSelect.value = preset.id;
  const ratio = form.querySelector('select[name="aspect_ratio"]');
  if (ratio) ratio.value = preset.ratio;
  setStyle(preset.style);
  updatePromptMeta();
  setError("");
  syncToolbarSelectMenus();
}

function renderPresets() {
  if (!presetSelect) return;
  const grouped = new Map();
  catalog.presets.forEach((preset) => {
    const group = grouped.get(preset.category) || [];
    group.push(preset);
    grouped.set(preset.category, group);
  });
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "不使用预设";
  const groups = [...grouped.entries()].map(([category, presets]) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = category;
    presets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      optgroup.append(option);
    });
    return optgroup;
  });
  presetSelect.replaceChildren(placeholder, ...groups);
  presetSelect.value = selectedPreset || "";
  syncToolbarSelectMenus();
}

function createToolbarSelectItem(option) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "toolbar-select-item";
  button.dataset.value = option.value;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(option.selected));
  button.textContent = option.textContent;
  return button;
}

function renderToolbarSelectMenu(select, menu, labelNode, fallbackLabel) {
  if (!select || !menu || !labelNode) return;
  const fragment = document.createDocumentFragment();
  [...select.children].forEach((child) => {
    if (child instanceof HTMLOptGroupElement) {
      const section = document.createElement("section");
      section.className = "toolbar-select-section";
      const heading = document.createElement("span");
      heading.className = "toolbar-select-section-title";
      heading.textContent = child.label;
      section.append(heading, ...[...child.children].map(createToolbarSelectItem));
      fragment.append(section);
      return;
    }
    if (child instanceof HTMLOptionElement) fragment.append(createToolbarSelectItem(child));
  });
  menu.replaceChildren(fragment);
  labelNode.textContent = select.selectedOptions[0]?.textContent || fallbackLabel;
}

function syncToolbarSelectMenus() {
  renderToolbarSelectMenu(presetSelect, presetSelectMenu, presetSelectLabel, "不使用预设");
  renderToolbarSelectMenu(styleSelect, styleSelectMenu, styleSelectLabel, "自然写实");
}

function closeToolbarSelectMenus() {
  [
    [presetSelectMenu, presetSelectTrigger],
    [styleSelectMenu, styleSelectTrigger],
  ].forEach(([menu, trigger]) => {
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

function setupToolbarSelectMenus() {
  [
    [presetSelect, presetSelectTrigger, presetSelectMenu],
    [styleSelect, styleSelectTrigger, styleSelectMenu],
  ].forEach(([select, trigger, menu]) => {
    if (!select || !trigger || !menu || trigger.dataset.menuBound) return;
    trigger.dataset.menuBound = "true";
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closeModelMenu();
      closeOutputSettings();
      closeToolbarSelectMenus();
      if (willOpen) {
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        placeFloatingMenu(menu, trigger);
      }
    });
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = event.target instanceof Element ? event.target.closest(".toolbar-select-item") : null;
      if (!item) return;
      select.value = item.dataset.value || "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncToolbarSelectMenus();
      closeToolbarSelectMenus();
    });
  });
  document.addEventListener("click", closeToolbarSelectMenus);
  syncToolbarSelectMenus();
}

function setupCatalog() {
  if (!catalog.styles.length || !catalog.presets.length) {
    setError("预设库未能加载；仍可以直接输入描述生成图像。");
    return;
  }
  presetSelect.addEventListener("change", () => {
    const preset = catalog.presets.find((item) => item.id === presetSelect.value);
    if (preset) applyPreset(preset);
    else selectedPreset = null;
  });
  renderPresets();
  renderStyles();
}

function updateQualityOptions(label) {
  const select = document.querySelector('select[name="quality"]');
  if (!select) return;
  const l = (label || '').toLowerCase();
  const previous = select.value;
  if (l.includes('gpt image 2')) {
    select.innerHTML = [
      '<option value="standard">标准 · Low</option>',
      '<option value="fine">精细 · Medium</option>',
      '<option value="ultra">极致精细 · High</option>'
    ].join('');
    select.value = previous;
    updateCreditCost();
    return;
  }
  let steps;
  if (l.includes('qwen')) {
    steps = { standard: 20, fine: 24, ultra: 28 };
  } else if (l.includes('flux')) {
    steps = { standard: 20, fine: 28, ultra: 32 };
  } else {
    steps = { standard: 3, fine: 4, ultra: 8 };
  }
  select.innerHTML = [
    '<option value="standard">普通 · ' + steps.standard + ' 步</option>',
    '<option value="fine">精细 · ' + steps.fine + ' 步</option>',
    '<option value="ultra">极致精细 · ' + steps.ultra + ' 步</option>'
  ].join('');
  select.value = previous;
  updateCreditCost();
}

const MODEL_ICON_PATHS = {
  qwen_image: '/icons/alibaba-ai.png',
  qwen_image_edit: '/icons/alibaba-ai.png',
  server_ultrasharp: '/icons/alibaba-ai.png',
  zimage_turbo: '/icons/alibaba-ai.png',
  zimage: '/icons/alibaba-ai.png',
  flux: '/icons/black-forest-labs.png',
  flux2: '/icons/black-forest-labs.png',
  seedream_4_0: '/icons/bytedance.png',
  seedream_4_5: '/icons/bytedance.png',
  seedream_5_0: '/icons/bytedance.png',
  seedream_5_0_pro: '/icons/bytedance.png',
  bailian_qwen_3: '/icons/alibaba-ai.png',
  bailian_qwen_3_pro: '/icons/alibaba-ai.png',
  bailian_wan_2_7: '/icons/alibaba-ai.png',
  bailian_wan_2_7_pro: '/icons/alibaba-ai.png',
  gpt_image: '/icons/openai.png',
  google_nano_banana: '/icons/google.jpg',
  google_nano_banana_pro: '/icons/google.jpg',
  google_nano_banana_2: '/icons/google.jpg',
  google_nano_banana_2_lite: '/icons/google.jpg',
  minimax_h3_max: '/icons/minimax.jpg',
  'wan2.7-t2v-2026-06-12': '/icons/alibaba-ai.png',
  'wan2.7-i2v-2026-04-25': '/icons/alibaba-ai.png',
  'wan2.7-r2v-2026-06-12': '/icons/alibaba-ai.png',
  'wan3.0-video': '/icons/alibaba-ai.png',
  'wan3.0-video-prime': '/icons/alibaba-ai.png',
  seedance_2_0: '/icons/bytedance.png',
  seedance_2_0_mini: '/icons/bytedance.png',
  seedance_2_0_fast: '/icons/bytedance.png',
  seedance_2_5: '/icons/bytedance.png',
  'wan2.7-videoedit': '/icons/alibaba-ai.png',
  'wanx2.1-vace-plus': '/icons/alibaba-ai.png',
  'video-style-transform': '/icons/alibaba-ai.png',
  videoretalk: '/icons/alibaba-ai.png',
  'wan2.2-animate-mix': '/icons/alibaba-ai.png',
  'wan2.2-s2v': '/icons/alibaba-ai.png',
  'qwen3-tts-flash': '/icons/alibaba-ai.png',
  'qwen3-tts-instruct-flash': '/icons/alibaba-ai.png',
  'qwen-audio-3.0-tts-flash': '/icons/alibaba-ai.png',
  'qwen-audio-3.0-tts-plus': '/icons/alibaba-ai.png',
  'doubao-tts-2.0': '/icons/bytedance.png'
};

const MODEL_UI_DECORATIONS = Object.freeze({
  qwen_image:{ tags:["热门"], access:"FREE" }, qwen_image_edit:{ tags:["本地编辑"], access:"FREE" }, zimage_turbo:{ tags:["热门"], access:"FREE" },
  zimage:{ tags:["高质"], access:"VIP" }, seedream_4_0:{ tags:["经典"] }, seedream_4_5:{ tags:["热门"], access:"VIP" },
  seedream_5_0:{ tags:["NEW"] }, seedream_5_0_pro:{ tags:["NEW"], access:"VIP" },
  bailian_qwen_3:{ tags:["热门"] }, bailian_qwen_3_pro:{ tags:["推荐"], access:"VIP" },
  bailian_wan_2_7:{ tags:["多参考"] }, bailian_wan_2_7_pro:{ tags:["4K"], access:"VIP" },
  gpt_image:{ tags:["NEW","文字","4K"], access:"VIP" },
  google_nano_banana_2:{ tags:["NEW"], access:"VIP" }, google_nano_banana_2_lite:{ tags:["NEW"] },
  minimax_h3_max:{ tags:["NEW","极速","有声"], access:"VIP" },
  "wan2.7-t2v-2026-06-12":{ tags:["NEW"], access:"VIP" }, "wan2.7-i2v-2026-04-25":{ tags:["热门"], access:"VIP" },
  "wan2.7-r2v-2026-06-12":{ tags:["多参考"], access:"VIP" }, seedance_2_0:{ tags:["NEW"] },
  "wan3.0-video":{ tags:["NEW","全能参考"], access:"VIP" }, "wan3.0-video-prime":{ tags:["NEW","优速"], access:"VIP" },
  seedance_2_0_mini:{ tags:["NEW"] }, seedance_2_0_fast:{ tags:["NEW","极速"] }, seedance_2_5:{ tags:["NEW","推荐"], access:"VIP" },
  "wan2.7-videoedit":{ tags:["NEW"], access:"VIP" }, "wanx2.1-vace-plus":{ tags:["延展"], access:"VIP" },
  "video-style-transform":{ tags:["风格"], access:"VIP" }, videoretalk:{ tags:["口型"], access:"VIP" },
  "wan2.2-animate-mix":{ tags:["角色"], access:"VIP" }, "wan2.2-s2v":{ tags:["数字人"], access:"VIP" },
  "doubao-tts-2.0":{ tags:["NEW","推荐"], access:"VIP" }, "qwen3-tts-flash":{ tags:["热门"] },
  "qwen3-tts-instruct-flash":{ tags:["情绪"], access:"VIP" }, "qwen-audio-3.0-tts-flash":{ tags:["NEW","极速"] },
  "qwen-audio-3.0-tts-plus":{ tags:["NEW","高表现力"], access:"VIP" },
});
const MODEL_FAVORITES_KEY = "huiju:model-favorites:v1";
const MODEL_HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 9.5c0 4.7-8.5 9-8.5 9s-8.5-4.3-8.5-9a4.5 4.5 0 0 1 8.5-2.3 4.5 4.5 0 0 1 8.5 2.3Z"/></svg>';

function readModelFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem(MODEL_FAVORITES_KEY) || "[]").filter((id) => typeof id === "string")); }
  catch { return new Set(); }
}

function isModelFavorite(id) { return readModelFavorites().has(String(id || "")); }

function modelStatusTagsMarkup(id, { compact = false } = {}) {
  const tags = modelStatusTagList(id).slice(0, compact ? 2 : 3);
  const labels = { FREE:"免费", VIP:"会员", NEW:"新品" };
  return tags.map((tag) => `<small class="model-status-tag model-status-${String(tag).toLowerCase()}">${escapeMarkup(labels[tag] || tag)}</small>`).join("");
}

function modelStatusTagList(id) {
  const decoration = MODEL_UI_DECORATIONS[id] || {};
  return [...(decoration.tags || []), ...(decoration.access ? [decoration.access] : [])];
}

function modelFavoriteMarkup(id, { interactive = true } = {}) {
  const active = isModelFavorite(id);
  return interactive
    ? `<button class="model-favorite${active ? " active" : ""}" type="button" data-model-favorite="${escapeMarkup(id)}" aria-pressed="${String(active)}" aria-label="${active ? "取消收藏" : "收藏"}该模型" title="${active ? "取消收藏" : "收藏模型"}">${MODEL_HEART_SVG}</button>`
    : `<span class="model-favorite-static${active ? " active" : ""}" data-model-favorite-view="${escapeMarkup(id)}" aria-label="${active ? "已收藏" : "可收藏"}">${MODEL_HEART_SVG}</span>`;
}

function toggleModelFavorite(id) {
  const favorites = readModelFavorites();
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  try { localStorage.setItem(MODEL_FAVORITES_KEY, JSON.stringify([...favorites].slice(0, 80))); } catch {}
  document.querySelectorAll(`[data-model-favorite="${window.CSS?.escape ? CSS.escape(id) : id.replace(/[^a-z0-9_.-]/gi, "")}"]`).forEach((button) => {
    const active = favorites.has(id);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", `${active ? "取消收藏" : "收藏"}该模型`);
    button.title = active ? "取消收藏" : "收藏模型";
  });
  document.querySelectorAll(`[data-model-favorite-view="${window.CSS?.escape ? CSS.escape(id) : id.replace(/[^a-z0-9_.-]/gi, "")}"]`).forEach((icon) => {
    icon.classList.toggle("active", favorites.has(id));
    icon.setAttribute("aria-label", favorites.has(id) ? "已收藏" : "可收藏");
  });
}

const CAPABILITY_GROUP_ICONS = {
  "visual-creation": '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="m6.5 16 4-4 3 3 2.3-2.3 2.7 3.3M17.5 6.5v3m-1.5-1.5h3"/></svg>',
  "professional-scenes": '<svg viewBox="0 0 24 24"><path d="M4 20V8l8-4 8 4v12M8 20v-5h8v5M8 9h.01M12 9h.01M16 9h.01"/><circle cx="17" cy="7" r="2.2"/></svg>',
  "video-creation": '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2.5"/><path d="m17 10 4-2v8l-4-2zM9.5 9l4 3-4 3z"/></svg>',
  "narrative-production": '<svg viewBox="0 0 24 24"><path d="M4 8h16v12H4zM4 8l2-4h15l-2 4M8 4 6 8m7-4-2 4m7-4-2 4"/><path d="M8 14h2m4 0h2"/></svg>',
  projects: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m8.2 7.2 3 8.3m4.6-8.3-3 8.3M8.5 6h7"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.2a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.8 1.3-1.8 2.7m0 3.1h.01"/></svg>',
  "drawing-models": '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="m6.5 16 4-4 3 3 2.3-2.3 2.7 3.3M16.5 7.5h.01"/></svg>',
  "image-models": '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="m6.5 16 4-4 3 3 2.3-2.3 2.7 3.3M17.5 6.5v3m-1.5-1.5h3"/></svg>',
  "image-edit": '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="13.5" height="13.5" rx="2.3"/><path d="m7 14 3.1-3.1 2.2 2.2m3.2 6.4 4.8-4.8 1.7 1.7-4.8 4.8-2.4.7z"/></svg>',
  commerce: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6zm3 0a4 4 0 0 1 8 0"/></svg>',
  architecture: '<svg viewBox="0 0 24 24"><path d="M4 20V8l8-4 8 4v12M8 20v-5h8v5M8 9h.01M12 9h.01M16 9h.01"/></svg>',
  portrait: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4.1 3-6 7-6s6.2 1.9 7 6"/></svg>',
  "game-anime": '<svg viewBox="0 0 24 24"><path d="M7.2 8h9.6a4.2 4.2 0 0 1 4 5.3l-1.2 4.2a2 2 0 0 1-3.2 1l-2.2-1.7H9.8l-2.2 1.7a2 2 0 0 1-3.2-1l-1.2-4.2A4.2 4.2 0 0 1 7.2 8Z"/><path d="M8 11v4m-2-2h4m6-1h.01m2 2h.01"/></svg>',
  creative: '<svg viewBox="0 0 24 24"><path d="M9 18h6m-5 3h4M8.6 15.5A7 7 0 1 1 15.4 15.5c-.9.7-1.4 1.3-1.4 2.5h-4c0-1.2-.5-1.8-1.4-2.5Z"/></svg>',
  "video-models": '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2.5"/><path d="m17 10 4-2v8l-4-2zM9.5 9l4 3-4 3z"/></svg>',
  "ai-video": '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="m10 8 5.5 4-5.5 4zm-3-4v16m10-16v16"/></svg>',
  "video-tools": '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 9h16M8 5v4m4-4v4m4-4v4"/><path d="m9 13 6 4m0-4-6 4"/></svg>',
  "short-drama": '<svg viewBox="0 0 24 24"><path d="M4 8h16v12H4zM4 8l2-4h15l-2 4M8 4 6 8m7-4-2 4m7-4-2 4"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 14v-4m4 7V7m4 13V4m4 13V7m4 7v-4"/></svg>',
  workspace: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m8.2 7.2 3 8.3m4.6-8.3-3 8.3M8.5 6h7"/></svg>',
};

function capabilityGroupIcon(groupId) {
  return CAPABILITY_GROUP_ICONS[groupId] || CAPABILITY_GROUP_ICONS.creative;
}

const CAPABILITY_ITEM_ICONS = {
  model: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="m6.5 16 4-4 3 3 2.4-2.4 2.6 3.4M17.5 6.5v3m-1.5-1.5h3"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 19.5 5.2 15 15.8 4.4a2.1 2.1 0 0 1 3 3L8.2 18zM13.8 6.4l3 3M4 20h16"/></svg>',
  redraw: '<svg viewBox="0 0 24 24"><path d="m14.5 4 5.5 5.5-8.8 8.8a4 4 0 0 1-5.6 0 4 4 0 0 1 0-5.6zM12 6.5l5.5 5.5M4 20c2.1.5 4 .2 5.7-.9"/></svg>',
  multiview: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/></svg>',
  multiangle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M4 12a8 5 0 0 0 16 0 8 5 0 0 0-16 0Zm8-8v3m0 10v3"/></svg>',
  panorama: '<svg viewBox="0 0 24 24"><path d="M3 7.5c5-2 13-2 18 0v9c-5 2-13 2-18 0zM6 15l3.2-3.5 2.6 2.4 2.2-2.2 4 3.3M7.5 9h.01"/></svg>',
  upscale: '<svg viewBox="0 0 24 24"><path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5M8 8l8 8m0-8-8 8"/></svg>',
  cutout: '<svg viewBox="0 0 24 24"><path d="M12 3 5 7v10l7 4 7-4V7zM8 9.2 12 7l4 2.2v5.6l-4 2.2-4-2.2z"/></svg>',
  interactive: '<svg viewBox="0 0 24 24"><path d="M12 3v4m0 10v4M3 12h4m10 0h4"/><circle cx="12" cy="12" r="4"/><path d="M18.5 5.5 21 3m-2.5 15.5L21 21M5.5 5.5 3 3m2.5 15.5L3 21"/></svg>',
  layers: '<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
  collage: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12H12"/></svg>',
  editor: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M7 8h10M7 12h6m-6 4h4M16 14l3 3m0-3-3 3"/></svg>',
  resize: '<svg viewBox="0 0 24 24"><path d="M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4M8 8l8 8m0-8-8 8"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M5.5 8A8 8 0 1 1 4 13M5.5 8H10M5.5 8V3.5"/></svg>',
  crop: '<svg viewBox="0 0 24 24"><path d="M7 3v14h14M3 7h14v14"/></svg>',
  convert: '<svg viewBox="0 0 24 24"><path d="M4 8h14m-3-3 3 3-3 3M20 16H6m3 3-3-3 3-3"/></svg>',
  watermark: '<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M9 15c.5 1.3 1.5 2 3 2"/></svg>',
  workflow: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="6" rx="1.5"/><path d="M10 7h3a4 4 0 0 1 4 4v3M14 17h-3a4 4 0 0 1-4-4v-3"/></svg>',
  assets: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2.3"/><path d="m7 16 3.5-3.5 2.8 2.8 2.2-2.2L19 16.5M8 9h.01M7 2.8h10"/></svg>',
  history: '<svg viewBox="0 0 24 24"><path d="M5.3 7.2A8 8 0 1 1 4 12M4 5v5h5M12 7.5V12l3 2"/></svg>',
  page: '<svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4V20H6zM14 3.5v4h4M9 12h6m-6 3h6"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5m0-8h.01"/></svg>',
  analysis: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="13" height="13" rx="2"/><path d="m6.5 14 3-3 2.5 2.5 2-2 2.5 2.5M19 15v6m-3-3h6"/></svg>',
};

function capabilityItemIcon(item, groupId = "") {
  if (!item) return CAPABILITY_ITEM_ICONS.info;
  if (item.action === "model") return CAPABILITY_ITEM_ICONS.model;
  if (item.action === "compose") return CAPABILITY_ITEM_ICONS[item.mode] || CAPABILITY_ITEM_ICONS.edit;
  if (item.action === "client") return CAPABILITY_ITEM_ICONS[item.client_tool] || CAPABILITY_ITEM_ICONS.edit;
  if (item.action === "workspace") return CAPABILITY_ITEM_ICONS.workflow;
  if (item.action === "assets") return CAPABILITY_ITEM_ICONS.assets;
  if (item.action === "history") return CAPABILITY_ITEM_ICONS.history;
  if (item.action === "page") return CAPABILITY_ITEM_ICONS.page;
  if (item.action === "info") return CAPABILITY_ITEM_ICONS.info;
  if (item.action === "analysis") return CAPABILITY_ITEM_ICONS.analysis;
  if (item.action === "workflow_node") return CAPABILITY_ITEM_ICONS.workflow;
  if (item.action === "video_mode") return CAPABILITY_GROUP_ICONS["ai-video"];
  if (item.action === "audio_mode") return CAPABILITY_GROUP_ICONS.sound;
  return capabilityGroupIcon(groupId);
}

const FALLBACK_MODEL_CHOICES = [
  ['qwen_image', 'Qwen-Image-2512'],
  ['zimage_turbo', 'Z-Image Turbo'],
  ['zimage', 'Z-Image'],
  ['seedream_4_0', 'Seedream 4.0'],
  ['seedream_4_5', 'Seedream 4.5'],
  ['seedream_5_0', 'Seedream 5.0'],
  ['seedream_5_0_pro', 'Seedream 5.0 Pro'],
  ['bailian_qwen_3', 'Qwen-Image 3.0'],
  ['bailian_qwen_3_pro', 'Qwen-Image 3.0 Pro'],
  ['bailian_wan_2_7', 'Wan 2.7 Image'],
  ['bailian_wan_2_7_pro', 'Wan 2.7 Image Pro'],
  ['google_nano_banana', 'Nano Banana'],
  ['google_nano_banana_pro', 'Nano Banana Pro'],
  ['google_nano_banana_2', 'Nano Banana 2'],
  ['google_nano_banana_2_lite', 'Nano Banana 2 Lite'],
];
const TOOL_SELECTOR_CHOICES = [
  ['unified_image', 'AI 生图'],
  ['unified_video', 'AI 生视频'],
  ['unified_audio', 'AI 配音'],
  ['text', '文生图'],
  ['edit', '图生图'],
  ['redraw', '重绘'],
  ['multiview', '多视角'],
  ['multiangle', '多角度绘图'],
  ['panorama', '360° 全景'],
  ['upscale', 'AI 超分'],
  ['cutout', 'AI 抠图'],
  ['interactive', '交互编辑'],
  ['layers', '图层拆分'],
  ['video_text', '文生视频'],
  ['video_image', '图生视频'],
  ['video_first_last', '首尾帧生视频'],
  ['video_reference', '视频参考生视频'],
  ['video_edit', 'AI 视频编辑'],
  ['video_extension', '视频延展'],
  ['video_style', '视频风格化'],
  ['video_lip_sync', '口型同步'],
  ['video_character_swap', '视频角色替换'],
  ['video_digital_human', '数字人播报'],
  ['audio_tts', '文生配音'],
];
const UPSCALER_MODEL = { id: 'server_ultrasharp', label: '4x-UltraSharp 服务器轻量超分', available: true, badges: ['本地', '轻量', '忠实放大'] };
const CUTOUT_MODEL = { id: 'server_u2netp', label: 'U2NetP 服务器轻量抠图', available: true, badges: ['本地', '透明 PNG', '主体分离'] };
let selectorContext = 'tool-zone';
let pricingData = null;
let modelMenuMarkup = '';
let toolModelMenuMarkup = '';
let selectedModelLabel = 'Qwen-Image-2512';
let sidebarModelChoices = FALLBACK_MODEL_CHOICES.map(([id, label]) => ({ id, label, available: true, badges: [] }));
let toolModelChoices = [{ id: 'bailian_wan_2_7', label: 'Wan 2.7 Image', available: true, badges: ['百炼 API', '图像编辑'] }];
let videoModelChoices = [
  { id: 'minimax_h3_max', label: 'MiniMax H3 Max', available: false, badges: ['fal.ai', '内置音频', '5–15 秒'] },
  { id: 'wan2.7-t2v-2026-06-12', label: 'Wan 2.7 文生视频', available: true, badges: ['文生视频', '2–15 秒'] },
  { id: 'wan2.7-i2v-2026-04-25', label: 'Wan 2.7 图生视频', available: true, badges: ['首帧/首尾帧', '2–15 秒'] },
  { id: 'wan2.7-r2v-2026-06-12', label: 'Wan 2.7 参考生视频', available: true, badges: ['最多 5 张参考', '2–15 秒'] },
  { id: 'wan3.0-video', label: 'Wan 3.0 视频', available: true, badges: ['全能参考', '2–30 秒', '30 FPS'] },
  { id: 'wan3.0-video-prime', label: 'Wan 3.0 视频 Prime', available: true, badges: ['全能参考', '优速', '2–30 秒'] },
  { id: 'seedance_2_0', label: 'Seedance 2.0', available: false, badges: ['多模态', '4–15 秒'] },
  { id: 'seedance_2_0_mini', label: 'Seedance 2.0 Mini', available: false, badges: ['轻量快速', '4–15 秒'] },
  { id: 'seedance_2_0_fast', label: 'Seedance 2.0 Fast', available: false, badges: ['快速队列', '4–15 秒'] },
  { id: 'seedance_2_5', label: 'Seedance 2.5', available: false, badges: ['火山方舟接入点', '0–30 秒'] },
  { id: 'wan2.7-videoedit', label: 'Wan 2.7 视频编辑', available: false, badges: ['指令编辑', '2–10 秒'] },
  { id: 'wanx2.1-vace-plus', label: 'VACE 视频延展', available: false, badges: ['固定 5 秒'] },
  { id: 'video-style-transform', label: '视频风格化', available: false, badges: ['8 种风格'] },
  { id: 'videoretalk', label: 'VideoRetalk 口型同步', available: false, badges: ['视频+音频'] },
  { id: 'wan2.2-animate-mix', label: 'Wan 视频角色替换', available: false, badges: ['需肖像授权'] },
  { id: 'wan2.2-s2v', label: 'Wan 数字人播报', available: false, badges: ['图片+音频'] },
];
let audioModelChoices = [
  { id: 'doubao-tts-2.0', label: '豆包语音合成 2.0', available: false, badges: ['火山引擎', '自然情感', '多语种'] },
  { id: 'qwen3-tts-flash', label: 'Qwen3-TTS Flash', available: true, badges: ['多语言', '自然音色'] },
  { id: 'qwen3-tts-instruct-flash', label: 'Qwen3-TTS 指令版', available: true, badges: ['情绪指令', '多语言'] },
  { id: 'qwen-audio-3.0-tts-flash', label: 'Qwen-Audio 3.0 TTS Flash', available: true, badges: ['低延迟', '系统音色'] },
  { id: 'qwen-audio-3.0-tts-plus', label: 'Qwen-Audio 3.0 TTS Plus', available: true, badges: ['高表现力', '系统音色'] },
];
let videoModelMenuMarkup = '';
let audioModelMenuMarkup = '';

function isUnifiedMode(mode = activeMode) { return UNIFIED_MODES.has(mode); }
function hasSourceMaterial() {
  return sourceFiles.length > 0 || promptReferenceMentions.some((item) => item.type === 'asset');
}
/** Collapse a unified mode onto the concrete backend route implied by the current attachments. */
function resolveUnifiedMode(mode = activeMode) {
  return resolveGenerationMode(mode, hasSourceMaterial());
}
function sourceMediaRule(mode = activeMode) { return resolveSourceMediaRule(mode); }

/**
 * Unified modes show one input surface; the real backend route follows the attachments.
 * Keep the note, the model list and the button label in step with that decision.
 */
function syncUnifiedRoute() {
  if (!isUnifiedMode()) return;
  const resolved = resolveUnifiedMode();
  // The concrete route owns a different model family, so re-derive the list and selection.
  const choices = modelChoicesForMode(resolved);
  const current = choices.find((item) => item.id === modelSelect?.value && item.available);
  if (!current) {
    const fallback = choices.find((item) => item.available) || choices[0];
    if (fallback) setModelSelectValue(fallback.id, fallback.label);
  }
  syncComposerSelector();
  syncSidebarModelSelector();
  updateOutputSummary();
}
/** Single source of truth for how many and what kind of files a mode accepts. */
function sourceMediaLimits(mode = activeMode) {
  return resolveSourceMediaLimits(mode);
}
const VIDEO_TOOL_MODEL_IDS = Object.freeze({
  video_edit: ['wan2.7-videoedit', ...WAN3_VIDEO_MODELS, ...SEEDANCE_VIDEO_MODELS],
  video_extension: ['wanx2.1-vace-plus', ...WAN3_VIDEO_MODELS, ...SEEDANCE_VIDEO_MODELS],
  video_style: ['video-style-transform', ...SEEDANCE_VIDEO_MODELS],
  video_lip_sync: ['videoretalk', ...SEEDANCE_VIDEO_MODELS],
  video_character_swap: ['wan2.2-animate-mix', ...SEEDANCE_VIDEO_MODELS],
  video_digital_human: ['wan2.2-s2v', ...SEEDANCE_VIDEO_MODELS],
});

function isVideoMode(mode = activeMode) { return VIDEO_MODES.has(mode); }
function isAudioMode(mode = activeMode) { return AUDIO_MODES.has(mode); }
function videoChoicesForMode(mode = activeMode) {
  if (VIDEO_TOOL_MODEL_IDS[mode]) return VIDEO_TOOL_MODEL_IDS[mode].map((id) => videoModelChoices.find((item) => item.id === id)).filter(Boolean);
  const accepted = mode === 'video_text'
    ? new Set(['minimax_h3_max', 'wan2.7-t2v-2026-06-12', ...WAN3_VIDEO_MODELS, ...SEEDANCE_VIDEO_MODELS])
    : mode === 'video_reference'
      ? new Set(['wan2.7-r2v-2026-06-12', ...WAN3_VIDEO_MODELS, ...SEEDANCE_VIDEO_MODELS])
      : new Set(['minimax_h3_max', 'wan2.7-i2v-2026-04-25', ...WAN3_VIDEO_MODELS, ...SEEDANCE_VIDEO_MODELS]);
  return videoModelChoices.filter((item) => accepted.has(item.id));
}
function modelChoicesForMode(mode = activeMode) {
  // A unified mode offers the model family of whichever route its attachments imply.
  if (UNIFIED_MODES.has(mode)) return modelChoicesForMode(resolveUnifiedMode(mode));
  if (VIDEO_MODES.has(mode)) return videoChoicesForMode(mode);
  if (AUDIO_MODES.has(mode)) return audioModelChoices;
  if (mode === 'upscale') return [UPSCALER_MODEL];
  if (mode === 'cutout') return [CUTOUT_MODEL];
  return mode === 'text' ? sidebarModelChoices : toolModelChoices;
}

function modelMarkupForMode(mode = activeMode) {
  if (UNIFIED_MODES.has(mode)) return modelMarkupForMode(resolveUnifiedMode(mode));
  if (VIDEO_MODES.has(mode)) return videoChoicesForMode(mode).map((item) => modelOptionMarkup(item.id, item, item.available, item.member_only ? '会员专享' : '接入点未配置')).join('');
  if (AUDIO_MODES.has(mode)) return audioModelMenuMarkup;
  if (mode === 'upscale') return modelOptionMarkup(UPSCALER_MODEL.id, UPSCALER_MODEL, UPSCALER_MODEL.available);
  if (mode === 'cutout') return modelOptionMarkup(CUTOUT_MODEL.id, CUTOUT_MODEL, CUTOUT_MODEL.available);
  return mode === 'text' ? modelMenuMarkup : toolModelMenuMarkup;
}

function escapeMarkup(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function modelBadgesMarkup(badges = [], limit = 3) {
  return badges.slice(0, limit).map((badge) => `<small class="model-badge">${escapeMarkup(badge)}</small>`).join("");
}

function modelOptionMarkup(id, model, available = true, reason = "") {
  const icon = MODEL_ICON_PATHS[id];
  const label = model.label || model.name || id;
  const badges = Array.isArray(model.badges) ? model.badges : [];
  const state = available ? "可用" : reason || "未启用";
  const isMediaModel = videoModelChoices.some((item) => item.id === id) || audioModelChoices.some((item) => item.id === id);
  const credit = unitCreditCost(id, "1k");
  const creditMarkup = available && !isMediaModel ? `<span class="model-credit-cost" title="每张基础消耗 ${credit} 额度" aria-label="每张基础消耗 ${credit} 额度"><span aria-hidden="true">✦</span><b>${credit}</b></span>` : "";
  return `<div class="model-select-item${available ? "" : " disabled"}" data-value="${escapeMarkup(id)}" data-label="${escapeMarkup(label)}" role="option" aria-disabled="${String(!available)}"><img src="${escapeMarkup(icon)}" alt="" /><span class="model-option-copy"><span class="model-option-heading"><b class="model-option-name">${escapeMarkup(label)}</b><span class="model-status-tags">${modelStatusTagsMarkup(id)}</span>${creditMarkup}</span><span class="model-option-meta">${modelBadgesMarkup(badges)}<small class="model-availability${available ? " available" : ""}">${escapeMarkup(state)}</small></span></span>${modelFavoriteMarkup(id)}</div>`;
}

function syncSidebarModelSelector() {
  if (!sidebarModelMenu) return;
  const choices = modelChoicesForMode();
  sidebarModelMenu.innerHTML = choices.map(({ id, label, available, badges }) => {
    const icon = MODEL_ICON_PATHS[id];
    return `<button type="button" class="sidebar-select-option${available ? "" : " disabled"}" data-value="${escapeMarkup(id)}" role="option" aria-disabled="${String(!available)}"><img src="${escapeMarkup(icon)}" alt="" /><span><b>${escapeMarkup(label)}</b><span class="sidebar-model-meta"><span class="model-status-tags">${modelStatusTagsMarkup(id, { compact:true })}</span>${modelBadgesMarkup(badges, 2)}${available ? "" : '<i>未启用</i>'}</span></span>${modelFavoriteMarkup(id, { interactive:false })}</button>`;
  }).join('') || '<span class="sidebar-select-empty">暂无可用模型</span>';
  if (sidebarModelLabel) sidebarModelLabel.textContent = selectedModelLabel;
  if (sidebarModelIcon) sidebarModelIcon.src = MODEL_ICON_PATHS[modelSelect?.value];
}

function syncComposerSelector() {
  if (!modelSelectMenu || !modelSelectTrigger) return;
  const isModelZone = selectorContext === 'model-zone';
  modelSelectTrigger.setAttribute('aria-label', isModelZone ? '选择创作工具' : '选择模型');
  modelSelectTrigger.dataset.selectorContext = isModelZone ? 'tools' : 'models';
  if (isModelZone) {
    modelSelectMenu.innerHTML = TOOL_SELECTOR_CHOICES.map(([value, label]) =>
      '<div class="model-select-item" data-selector-kind="tool" data-value="' + value + '" role="option"><span>' + label + '</span></div>'
    ).join('');
    if (modelSelectLabel) modelSelectLabel.textContent = MODE_COPY[activeMode]?.eyebrow || '选择工具';
    if (modelSelectIcon) modelSelectIcon.alt = '';
  } else {
    modelSelectMenu.innerHTML = modelMarkupForMode() || '<div class="model-select-empty">暂无可用模型</div>';
    if (modelSelectLabel) modelSelectLabel.textContent = selectedModelLabel;
    if (modelSelectIcon) modelSelectIcon.src = MODEL_ICON_PATHS[modelSelect?.value];
  }
}

function setSelectorContext(context) {
  selectorContext = context === 'model-zone' ? 'model-zone' : 'tool-zone';
  closeModelMenu();
  syncComposerSelector();
}

function renderFallbackModelChoices() {
  if (modelMenuMarkup) return;
  modelMenuMarkup = FALLBACK_MODEL_CHOICES.map(([id, label]) => modelOptionMarkup(id, { label, badges: [] }, true)).join('');
  syncComposerSelector();
  syncSidebarModelSelector();
  if (modelSelectLabel?.textContent === '正在加载模型…') {
    setModelSelectValue(modelSelect?.value || 'qwen_image', 'Qwen-Image-2512');
  }
}

function setModelSelectValue(value, label) {
  if (!modelSelect || !modelSelectTrigger) return;
  modelSelect.value = value;
  selectedModelLabel = label || value;
  updateAudioVoiceOptions(value);
  syncVideoResolutionOptions();
  if (selectorContext === 'tool-zone') syncComposerSelector();
  syncSidebarModelSelector();
  updateVideoDurationBounds();
  updateOutputSummary();
  updateCreditCost();
}

function updateAudioVoiceOptions(model = modelSelect?.value || '') {
  if (!audioVoiceInput || !String(model).includes('tts')) return;
  const previous = audioVoiceInput.value;
  const doubaoAudio = model === 'doubao-tts-2.0';
  const qwenAudio = String(model).startsWith('qwen-audio-');
  const choices = doubaoAudio
    ? [
        ['zh_female_vv_uranus_bigtts', 'Vivi 2.0 · 灵动女声'],
        ['zh_male_dayi_saturn_bigtts', '大壹 · 视频男声'],
        ['zh_female_meilinvyou_saturn_bigtts', '魅力女友 · 表现力女声'],
        ['zh_male_ruyayichen_saturn_bigtts', '儒雅逸辰 · 温润男声'],
        ['zh_female_xueayi_saturn_bigtts', '儿童绘本 · 亲切女声'],
      ]
    : qwenAudio
    ? [['longanhuan_v3.6', '龙安焕 · 自然中文'], ['longanfengyue', '龙安风悦 · 亲切女声'], ['longanlingxi', '龙安灵希 · 甜美女声']]
    : [['Cherry', '芊悦 · 自然女声'], ['Serena', '苏瑶 · 温柔女声'], ['Ethan', '晨煦 · 沉稳男声']];
  const customVoices = assetItems.filter((asset) => asset.assetType === 'voice')
    .map((asset) => [`asset:${asset.id}`, `定制音色 · ${asset.name}`]);
  audioVoiceInput.replaceChildren(...[...choices, ...customVoices].map(([value, label]) => {
    const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
  }));
  if ([...audioVoiceInput.options].some((option) => option.value === previous)) audioVoiceInput.value = previous;
  if (audioEmotionSection) audioEmotionSection.hidden = !isAudioMode() || !doubaoAudio;
}

audioVoiceInput?.addEventListener("change", () => {
  const selected = audioVoiceInput.value;
  if (!selected.startsWith("asset:") || modelSelect?.value === "qwen3-tts-flash") return;
  setModelSelectValue("qwen3-tts-flash", "Qwen3-TTS Flash");
  audioVoiceInput.value = selected;
  updateOutputSummary();
});

function updateVideoDurationBounds() {
  if (!videoDurationInput) return;
  const model = modelSelect?.value || '';
  const seedance25 = model === 'seedance_2_5';
  const seedance2 = SEEDANCE_MODEL_IDS.has(model) && !seedance25;
  const wan3 = WAN3_VIDEO_MODEL_IDS.has(model);
  const h3Max = model === 'minimax_h3_max';
  const fixedVace = model === 'wanx2.1-vace-plus';
  videoDurationInput.min = fixedVace || h3Max ? '5' : (seedance25 ? '0' : (seedance2 ? '4' : '2'));
  videoDurationInput.max = fixedVace ? '5' : ((seedance25 || wan3) ? '30' : (model === 'wan2.7-videoedit' ? '10' : '15'));
  const current = Number(videoDurationInput.value || 5);
  videoDurationInput.value = String(Math.min(Number(videoDurationInput.max), Math.max(Number(videoDurationInput.min), current)));
  if (videoDurationValue) {
    const seconds = Number(videoDurationInput.value);
    videoDurationValue.textContent = seedance25 && seconds === 0 ? '自动' : `${seconds} 秒`;
  }
}

function syncVideoResolutionOptions() {
  const resolutionSelect = form?.querySelector('select[name="resolution"]');
  if (!resolutionSelect) return;
  const videoMode = isVideoMode();
  const h3Max = videoMode && modelSelect?.value === 'minimax_h3_max';
  const allowed = h3Max ? new Set(['480p', '720p']) : new Set(['480p', '720p', '1k']);
  [...resolutionSelect.options].forEach((option) => {
    if (!option.dataset.originalLabel) option.dataset.originalLabel = option.textContent;
    option.hidden = videoMode && !allowed.has(option.value);
    option.disabled = videoMode && !allowed.has(option.value);
    option.textContent = h3Max && option.value === '720p'
      ? '768P'
      : option.value === '1k' && videoMode ? '1080P' : option.dataset.originalLabel;
  });
  if (videoMode && !allowed.has(resolutionSelect.value)) resolutionSelect.value = '720p';
  const h3ImageMode = h3Max && activeMode === 'video_image';
  if (outputRatioSection) outputRatioSection.hidden = isAudioMode() || h3ImageMode;
  const ratioSelect = form.querySelector('select[name="aspect_ratio"]');
  if (ratioSelect) {
    const ratios = h3Max && activeMode === 'video_text'
      ? new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'])
      : new Set(['16:9', '9:16', '1:1', '4:3', '3:4']);
    [...ratioSelect.options].forEach((option) => {
      option.hidden = videoMode && !ratios.has(option.value);
      option.disabled = videoMode && !ratios.has(option.value);
    });
    if (videoMode && !ratios.has(ratioSelect.value)) ratioSelect.value = '16:9';
  }
}

function selectedVideoResolution() {
  const selected = String(selectedValue('resolution') || '720p').toUpperCase();
  if (modelSelect?.value === 'minimax_h3_max') return selected === '480P' ? '480P' : '768P';
  return selected === '1K' ? '1080P' : selected;
}

function unitCreditCost(model, resolution, quality = "standard") {
  if (model === "qwen_image") return 0;
  const priced = pricingData?.image?.[model];
  const byQualityResolution = priced?.by_quality_resolution?.[quality] || {};
  if (Number.isFinite(Number(byQualityResolution[String(resolution || '1k').toLowerCase()]))) {
    return Number(byQualityResolution[String(resolution || '1k').toLowerCase()]);
  }
  const byResolution = priced?.by_resolution || {};
  if (Number.isFinite(Number(byResolution[String(resolution || '1k').toLowerCase()]))) {
    return Number(byResolution[String(resolution || '1k').toLowerCase()]);
  }
  if (Number.isFinite(Number(priced?.unit_credits))) return Number(priced.unit_credits);
  if (model === "zimage" || model === "zimage_turbo") return 0;
  if (model === "bailian_qwen_3") return 8;
  if (model === "bailian_qwen_3_pro") return ["2k", "4k"].includes(resolution) ? 20 : 11;
  if (model === "bailian_wan_2_7") return 9;
  if (model === "bailian_wan_2_7_pro") return ["2k", "4k"].includes(resolution) ? 24 : 12;
  if (model === "seedream_5_0_pro") return ["2k", "4k"].includes(resolution) ? 24 : 12;
  if (model === "seedream_5_0") return 9;
  if (model === "google_nano_banana") return 6;
  if (model === "google_nano_banana_pro") return 20;
  if (model === "google_nano_banana_2") return 10;
  if (model === "google_nano_banana_2_lite") return 5;
  return 8;
}

const VIDEO_CREDITS_PER_SECOND = Object.freeze({
  minimax_h3_max: 12,
  'wan3.0-video': 10,
  'wan3.0-video-prime': 15,
  seedance_2_0: 14,
  seedance_2_0_mini: 4,
  seedance_2_0_fast: 11,
  seedance_2_5: 47,
  default: 10,
});

function videoCreditCost(model, duration, resolution = '720P') {
  const seconds = Math.max(0, Number(duration) || 0);
  const inputKey = sourceFiles.some((file) => file.type?.startsWith('video/')) ? 'video' : 'no_video';
  const rawResolution = String(resolution).toUpperCase();
  const normalizedResolution = model === 'minimax_h3_max' && rawResolution === '720P'
    ? '768P' : rawResolution === '1K' ? '1080P' : rawResolution;
  const rate = pricingData?.video?.[model]?.[`${normalizedResolution}:${inputKey}`]
    || pricingData?.video?.[model]?.[`${normalizedResolution}:no_video`]
    || pricingData?.video?.[model]?.[`${normalizedResolution}:video`];
  const tier = pricingData?.member ? 'member' : 'public';
  const perSecond = Number(rate?.[tier] ?? VIDEO_CREDITS_PER_SECOND[model] ?? VIDEO_CREDITS_PER_SECOND.default);
  const billedSeconds = model === 'seedance_2_5' && seconds === 0 ? 30 : Math.max(1, seconds);
  return Math.ceil(billedSeconds * perSecond);
}

function estimatedAudioSeconds(text) {
  const value = String(text || '');
  const cjk = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (value.match(/[A-Za-z0-9]+/g) || []).length;
  const punctuation = (value.match(/[，。！？；：,.!?;:]/g) || []).length;
  return Math.max(1, Math.ceil(cjk / 4 + words / 2.5 + punctuation * 0.12));
}

function updateCreditCost() {
  if (!generateCreditCost) return;
  generateCreditCost.hidden = false;
  if (isAudioMode()) {
    const model = modelSelect?.value || 'qwen3-tts-flash';
    const rate = pricingData?.audio?.[model];
    const tier = pricingData?.member ? 'member' : 'public';
    const estimatedSeconds = activeMode === 'audio_image'
      ? Math.max(15, estimatedAudioSeconds(promptInput?.value))
      : estimatedAudioSeconds(promptInput?.value);
    const total = estimatedSeconds * Number(rate?.[tier] || 2);
    const number = generateCreditCost.querySelector('b');
    if (number) number.textContent = String(total);
    const label = `本次配音预计消耗 ${total} 额度，按预估音频时长结算`;
    generateCreditCost.setAttribute('aria-label', label);
    generateCreditCost.title = label;
    return;
  }
  const model = activeMode === "upscale" ? UPSCALER_MODEL.id : activeMode === "cutout" ? CUTOUT_MODEL.id : (modelSelect?.value || "qwen_image");
  const duration = Number(videoDurationInput?.value || 0);
  const total = isVideoMode()
    ? videoCreditCost(model, duration, selectedValue('resolution') || '720p')
    : unitCreditCost(
        model,
        selectedValue("resolution") || "720p",
        selectedValue("quality") || "standard",
      ) * Number(selectedValue("count") || 1);
  const number = generateCreditCost.querySelector("b");
  if (number) number.textContent = String(total);
  const label = isVideoMode()
    ? (duration === 0 ? "自动时长将在生成后按实际秒数结算额度" : (WAN3_VIDEO_MODEL_IDS.has(model) && sourceFiles.some((file) => file.type?.startsWith('video/'))
      ? `本次生成预计消耗 ${total} 额度；Wan 3.0 会再按输入视频实际秒数计费`
      : `本次生成预计消耗 ${total} 额度，共 ${duration} 秒`))
    : (model === "qwen_image" ? "Qwen-Image-2512 免费使用，每分钟最多 10 次" : (total ? `本次生成预计消耗 ${total} 额度` : "本次生成不消耗额度"));
  generateCreditCost.setAttribute("aria-label", label);
  generateCreditCost.title = label;
}

function updateOutputSummary() {
  if (!outputSettingsSummary) return;
  if (isAudioMode()) {
    if (activeMode === 'audio_custom_voice') {
      const language = audioLanguageInput?.selectedOptions?.[0]?.textContent || '自动识别';
      const speed = Number(audioSpeedInput?.value || 1).toFixed(1);
      outputSettingsSummary.textContent = `文字定制音色 · ${language} · ${speed}×`;
      updateCreditCost();
      return;
    }
    const voice = audioVoiceInput?.selectedOptions?.[0]?.textContent || '默认音色';
    const language = audioLanguageInput?.selectedOptions?.[0]?.textContent || '自动识别';
    const speed = Number(audioSpeedInput?.value || 1).toFixed(1);
    outputSettingsSummary.textContent = `${voice} · ${language} · ${speed}×`;
    updateCreditCost();
    return;
  }
  const ratio = selectedValue("aspect_ratio") || "1:1";
  const res = selectedValue("resolution") || "720p";
  if (activeMode === "cutout") {
    outputSettingsSummary.textContent = "透明 PNG · 保留原始尺寸";
    updateCreditCost();
    return;
  }
  if (isVideoMode()) {
    updateVideoDurationBounds();
    const seconds = Number(videoDurationInput?.value || 5);
    const duration = modelSelect?.value === 'seedance_2_5' && seconds === 0 ? '自动时长' : `${seconds} 秒`;
    const resolutionLabel = document.querySelector('select[name="resolution"] option:checked')?.textContent || res.toUpperCase();
    const ratioLabel = modelSelect?.value === 'minimax_h3_max' && activeMode === 'video_image' ? '跟随首帧' : ratio;
    outputSettingsSummary.textContent = `${ratioLabel} · ${resolutionLabel} · ${duration}`;
    updateCreditCost();
    return;
  }
  const count = selectedValue("count") || "1";
  const ratioLabel = document.querySelector('select[name="aspect_ratio"] option:checked')?.textContent || ratio;
  const relatedSeries = ["seedream_4_0", "seedream_4_5", "seedream_5_0"].includes(modelSelect?.value) && Number(count) > 1;
  outputSettingsSummary.textContent = ratio + " · " + res + " · " + count + (relatedSeries ? " 张组图" : " 张");
  updateCreditCost();
}

function closeOutputSettings() {
  if (outputSettingsMenu) outputSettingsMenu.hidden = true;
  if (outputSettingsTrigger) outputSettingsTrigger.setAttribute('aria-expanded', 'false');
}

function closeModelMenu() {
  if (modelSelectMenu) modelSelectMenu.hidden = true;
  if (modelSelectTrigger) modelSelectTrigger.setAttribute('aria-expanded', 'false');
}

function placeFloatingMenu(menu, trigger) {
  if (!menu || !trigger) return;
  if (menu.parentElement !== document.body) document.body.append(menu);
  const viewportGap = 12;
  menu.style.maxHeight = '';
  const triggerRect = trigger.getBoundingClientRect();
  let menuRect = menu.getBoundingClientRect();
  const width = Math.min(menuRect.width, window.innerWidth - viewportGap * 2);
  const left = Math.min(
    Math.max(viewportGap, triggerRect.left),
    Math.max(viewportGap, window.innerWidth - width - viewportGap),
  );
  const roomBelow = window.innerHeight - triggerRect.bottom - viewportGap;
  const roomAbove = triggerRect.top - viewportGap;
  const openAbove = roomBelow < menuRect.height && roomAbove > roomBelow;
  const availableHeight = Math.max(120, openAbove ? roomAbove : roomBelow);
  menu.style.maxHeight = `${Math.floor(availableHeight)}px`;
  menuRect = menu.getBoundingClientRect();
  const top = openAbove
    ? Math.max(viewportGap, triggerRect.top - menuRect.height - 7)
    : triggerRect.bottom + 7;
  menu.style.position = 'fixed';
  menu.style.inset = 'auto';
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(Math.max(viewportGap, top))}px`;
  menu.style.maxWidth = `calc(100vw - ${viewportGap * 2}px)`;
}

function bindCompactMenus() {
  if (modelSelectTrigger && modelSelectMenu && !modelSelectTrigger.dataset.menuBound) {
    modelSelectTrigger.dataset.menuBound = "true";
    modelSelectTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = modelSelectMenu.hidden;
      closeOutputSettings();
      closeToolbarSelectMenus();
      closeModelMenu();
      if (willOpen) {
        modelSelectMenu.hidden = false;
        placeFloatingMenu(modelSelectMenu, modelSelectTrigger);
        modelSelectTrigger.setAttribute('aria-expanded', 'true');
      }
    });
    modelSelectMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const favorite = event.target.closest('[data-model-favorite]');
      if (favorite) { toggleModelFavorite(favorite.dataset.modelFavorite); return; }
      const item = event.target.closest('.model-select-item');
      if (!item || item.classList.contains('disabled')) return;
      const value = item.dataset.value;
      if (item.dataset.selectorKind === 'tool') {
        setMode(value);
        syncComposerSelector();
        closeModelMenu();
        return;
      }
      const label = item.dataset.label || item.querySelector('.model-option-name')?.textContent || value;
      setModelSelectValue(value, label);
      closeModelMenu();
      updateQualityOptions(label);
    });
    document.addEventListener("click", closeModelMenu);
  }
  if (outputSettingsTrigger && outputSettingsMenu && !outputSettingsTrigger.dataset.menuBound) {
    outputSettingsTrigger.dataset.menuBound = "true";
    outputSettingsTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = outputSettingsMenu.hidden;
      closeModelMenu();
      closeToolbarSelectMenus();
      closeOutputSettings();
      if (willOpen) {
        outputSettingsMenu.hidden = false;
        placeFloatingMenu(outputSettingsMenu, outputSettingsTrigger);
        outputSettingsTrigger.setAttribute('aria-expanded', 'true');
      }
    });
    outputSettingsMenu.addEventListener("click", (event) => { event.stopPropagation(); });
    outputSettingsMenu.addEventListener("change", (event) => {
      if (event.target.matches('select[name="aspect_ratio"], select[name="resolution"], select[name="quality"], select[name="count"], select[name="audio_voice"], select[name="audio_language"], select[name="audio_emotion"]')) {
        updateOutputSummary();
      }
    });
    videoDurationInput?.addEventListener('input', updateOutputSummary);
    audioSpeedInput?.addEventListener('input', () => {
      if (audioSpeedValue) audioSpeedValue.textContent = `${Number(audioSpeedInput.value).toFixed(1)}×`;
      updateOutputSummary();
    });
    document.addEventListener("click", closeOutputSettings);
    updateOutputSummary();
  }
  if (!document.body.dataset.compactMenuViewportBound) {
    document.body.dataset.compactMenuViewportBound = 'true';
    window.addEventListener('resize', () => { closeModelMenu(); closeOutputSettings(); closeToolbarSelectMenus(); });
    window.addEventListener('scroll', (event) => {
      const target = event.target;
      const insideFloatingMenu = target instanceof Node && (
        modelSelectMenu?.contains(target) || outputSettingsMenu?.contains(target)
        || presetSelectMenu?.contains(target) || styleSelectMenu?.contains(target)
      );
      if (insideFloatingMenu) return;
      closeModelMenu();
      closeOutputSettings();
      closeToolbarSelectMenus();
    }, true);
  }
}

function closeSidebarModelMenu() {
  if (sidebarModelMenu) sidebarModelMenu.hidden = true;
  if (sidebarModelTrigger) sidebarModelTrigger.setAttribute('aria-expanded', 'false');
}

function bindSidebarSelectors() {
  sidebarModelTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = sidebarModelMenu?.hidden;
    closeSidebarModelMenu();
    if (willOpen && sidebarModelMenu) {
      sidebarModelMenu.hidden = false;
      sidebarModelTrigger.setAttribute('aria-expanded', 'true');
    }
  });
  sidebarModelMenu?.addEventListener('click', (event) => {
    const option = event.target.closest('.sidebar-select-option');
    if (!option || option.classList.contains('disabled')) return;
    const choices = modelChoicesForMode();
    const choice = choices.find((item) => item.id === option.dataset.value);
    if (!choice) return;
    setModelSelectValue(choice.id, choice.label);
    updateQualityOptions(choice.label);
    closeSidebarModelMenu();
  });
  sidebarToolTrigger?.addEventListener('click', () => {
    const willOpen = sidebarToolMenu?.hidden;
    if (sidebarToolMenu) sidebarToolMenu.hidden = !willOpen;
    sidebarToolTrigger.setAttribute('aria-expanded', String(Boolean(willOpen)));
  });
  document.addEventListener('click', closeSidebarModelMenu);
}

async function loadModelAvailability() {
  try {
    const bootstrap = await workspaceBootstrapPromise;
    const body = bootstrap?.models || (await fetchJson(API.models, { method: "GET" }, 4000)).body;
    const models = body.models || {};
    const toolModels = body.tool_models || {};
    const videoModels = body.video_models || {};
    const audioModels = body.audio_models || {};
    const generationAvailable = Boolean(models.zimage?.available);
    UPSCALER_MODEL.available = Boolean(body.upscaler_model?.available);
    CUTOUT_MODEL.available = Boolean(body.background_removal_model?.available);
    modelCatalog = Array.isArray(body.catalog) ? body.catalog : [];
    if (modelSelect && modelSelectMenu) {
      const availableModels = Object.entries(models).filter(([, m]) => m.available);
      const items = modelCatalog.filter((item) => !item.tool_only).map((item) => {
        const runtime = models[item.id] || {};
        const reason = runtime.member_only ? "会员专享" : (item.api ? "未配置" : "未启用");
        return modelOptionMarkup(item.id, { ...item, ...runtime, label: runtime.label || item.name }, Boolean(runtime.available), reason);
      });
      Object.entries(models).forEach(([id, runtime]) => {
        if (!modelCatalog.some((item) => item.id === id)) items.push(modelOptionMarkup(id, runtime, Boolean(runtime.available)));
      });
      modelMenuMarkup = items.join('') || '<div class="model-select-empty">暂无可用模型</div>';
      sidebarModelChoices = modelCatalog.filter((item) => !item.tool_only).map((item) => ({
        id: item.id, label: models[item.id]?.label || item.name, available: Boolean(models[item.id]?.available), badges: models[item.id]?.badges || item.badges || [], member_only: Boolean(models[item.id]?.member_only),
      }));
      toolModelChoices = Object.entries(toolModels).map(([id, runtime]) => ({
        id, label: runtime.label || id, available: Boolean(runtime.available), badges: Array.isArray(runtime.badges) ? runtime.badges : [], member_only: Boolean(runtime.member_only),
      }));
      toolModelMenuMarkup = toolModelChoices.map((item) => modelOptionMarkup(item.id, item, item.available, item.member_only ? "会员专享" : "未配置或未启用")).join('');
      videoModelChoices = Object.entries(videoModels).map(([id, runtime]) => ({
        id, label: runtime.label || id, available: Boolean(runtime.available), badges: Array.isArray(runtime.badges) ? runtime.badges : [], member_only: Boolean(runtime.member_only),
      }));
      audioModelChoices = Object.entries(audioModels).map(([id, runtime]) => ({
        id, label: runtime.label || id, available: Boolean(runtime.available), badges: Array.isArray(runtime.badges) ? runtime.badges : [],
      }));
      videoModelMenuMarkup = videoModelChoices.map((item) => modelOptionMarkup(item.id, item, item.available, item.member_only ? "会员专享" : "接入点未配置")).join('');
      audioModelMenuMarkup = audioModelChoices.map((item) => modelOptionMarkup(item.id, item, item.available, "语音服务未配置")).join('');
      const activeChoices = modelChoicesForMode();
      const selected = activeChoices.find((item) => item.id === modelSelect.value && item.available)
        || activeChoices.find((item) => item.available)
        || activeChoices[0];
      if (selected) setModelSelectValue(selected.id, selected.label);
      syncComposerSelector();
      syncSidebarModelSelector();
    }
    renderModelGuide(modelCatalog, models, body.tools || {});
    updateQualityOptions((models[modelSelect?.value] || {}).label || '');
    const tools = body.tools || {};
    toolNavItems.forEach((item) => {
      item.disabled = false;
      item.title = "";
    });
    if (sidebarServiceStatus) sidebarServiceStatus.textContent = generationAvailable ? "生成服务已就绪" : "服务暂不可用";
    updateChoiceStyles();
  if (modelSelectTrigger && modelSelectMenu && !modelSelectTrigger.dataset.menuBound) {
    modelSelectTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = modelSelectMenu.hidden;
      closeModelMenu();
      if (willOpen) {
        modelSelectMenu.hidden = false;
        modelSelectTrigger.setAttribute('aria-expanded', 'true');
      }
    });
    modelSelectMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const favorite = event.target.closest('[data-model-favorite]');
      if (favorite) { toggleModelFavorite(favorite.dataset.modelFavorite); return; }
      const item = event.target.closest('.model-select-item');
      if (!item || item.classList.contains('disabled')) return;
      const value = item.dataset.value;
      const label = item.dataset.label || item.querySelector('.model-option-name')?.textContent || value;
      setModelSelectValue(value, label);
      closeModelMenu();
      updateQualityOptions(label);
    });
    document.addEventListener("click", closeModelMenu);
  }
  if (outputSettingsTrigger && outputSettingsMenu && !outputSettingsTrigger.dataset.menuBound) {
    outputSettingsTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = outputSettingsMenu.hidden;
      closeOutputSettings();
      if (willOpen) {
        outputSettingsMenu.hidden = false;
        outputSettingsTrigger.setAttribute('aria-expanded', 'true');
      }
    });
    outputSettingsMenu.addEventListener("click", (event) => { event.stopPropagation(); });
    outputSettingsMenu.addEventListener("change", (event) => {
      if (event.target.matches('select[name="aspect_ratio"], select[name="resolution"], select[name="quality"], select[name="count"]')) {
        updateOutputSummary();
      }
    });
    document.addEventListener("click", closeOutputSettings);
    updateOutputSummary();
  }
  } catch {
    if (sidebarServiceStatus) sidebarServiceStatus.textContent = "等待连接";
  }
}

async function loadPricing() {
  try {
    const bootstrap = await workspaceBootstrapPromise;
    const body = bootstrap?.pricing || (await fetchJson(API.pricing, { method: 'GET' }, 5000)).body;
    if (body && typeof body === 'object') pricingData = body;
  } catch {
    pricingData = null;
  }
  updateCreditCost();
  syncWorkflowModelDecorations(workflowBoard);
  syncWorkflowGenerationCredits(workflowBoard);
}

async function uploadSourceImage(signal) {
  const file = sourceFiles[0] || sourceImageInput?.files?.[0];
  if (!file) {
    const reference = promptReferenceMentions.find((item) => item.type === "asset");
    if (!reference) throw new Error("source_image_missing");
    return {
      uploadId: await uploadAssetImage(reference, signal),
      sourceAssetReference: { ...reference, imageIndex: 1 },
    };
  }
  if (file.size > 15 * 1024 * 1024) {
    const error = new Error("upload_too_large");
    error.status = 413;
    throw error;
  }
  const body = new FormData();
  body.append("image", file, file.name);
  const response = await fetchJson(API.upload, { method: "POST", signal, body }, 90000);
  if (!response.body.upload_id) throw new Error("upload_failed");
  return { uploadId: response.body.upload_id, sourceAssetReference: null };
}

async function uploadImageBlob(blob, filename, signal) {
  if (!(blob instanceof Blob) || blob.size > 15 * 1024 * 1024) {
    const error = new Error("upload_too_large");
    error.status = 413;
    throw error;
  }
  const body = new FormData();
  body.append("image", blob, filename);
  const response = await fetchJson(API.upload, { method: "POST", signal, body }, 90000);
  if (!response.body.upload_id) throw new Error("upload_failed");
  return response.body.upload_id;
}

async function uploadReferenceMediaBlob(blob, filename, signal) {
  if (!(blob instanceof Blob)) throw new Error("upload_failed");
  if (!blob.type.startsWith("video/") && !blob.type.startsWith("audio/")) return uploadImageBlob(blob, filename, signal);
  const body = new FormData();
  body.append("media", blob, filename);
  const response = await fetchJson(API.mediaUpload, { method: "POST", signal, body }, 120000);
  if (!response.body.upload_id) throw new Error("upload_failed");
  return response.body.upload_id;
}

async function uploadMediaPreviewBlob(blob, filename) {
  if (!(blob instanceof Blob) || (!blob.type.startsWith("video/") && !blob.type.startsWith("audio/"))) return "";
  const body = new FormData();
  body.append("media", blob, filename);
  const response = await fetchJson(API.mediaUpload, { method:"POST", body }, 120000);
  return String(response.body.preview_url || "");
}

async function upgradeSourceMediaPreview(file, index) {
  const localUrl = sourcePreviewUrls[index];
  try {
    const previewUrl = await uploadMediaPreviewBlob(file, file.name);
    if (!previewUrl || sourceFiles[index] !== file) return;
    if (localUrl?.startsWith("blob:")) URL.revokeObjectURL(localUrl);
    sourcePreviewUrls[index] = new URL(previewUrl, window.location.origin).href;
    if (activeReferenceIndex === index) showActiveReference(index);
  } catch {
    // Keep the immediate blob preview and surface codec errors through the player.
  }
}

async function uploadAssetImage(reference, signal) {
  const asset = assetItems.find((item) => item.id === reference.assetId);
  if (!asset) throw new Error("source_image_missing");
  const response = await fetch(asset.url, { method: "GET", credentials: "same-origin", signal });
  if (!response.ok) {
    const error = new Error("asset_download_failed");
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  if (!/^image\/(png|jpeg|webp)$/i.test(blob.type)) {
    const error = new Error("unsupported_asset_type");
    error.status = 415;
    throw error;
  }
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return uploadImageBlob(blob, `asset-${asset.id}.${extension}`, signal);
}

async function uploadAssetMedia(reference, signal) {
  const asset = assetItems.find((item) => item.id === reference.assetId);
  if (!asset) throw new Error('source_media_missing');
  const response = await fetch(asset.url, { method: 'GET', credentials: 'same-origin', signal });
  if (!response.ok) throw new Error('asset_download_failed');
  const blob = await response.blob();
  if (!/^(image\/(png|jpeg|webp)|video\/(mp4|webm|quicktime)|audio\/(wav|x-wav|mpeg|mp4|ogg))$/i.test(blob.type)) {
    const error = new Error('unsupported_asset_type'); error.status = 415; throw error;
  }
  const extension = asset.name?.split('.').pop() || (blob.type.startsWith('video/') ? 'mp4' : blob.type.startsWith('audio/') ? 'wav' : 'png');
  return uploadReferenceMediaBlob(blob, `asset-${asset.id}.${extension}`, signal);
}

async function uploadReferenceImages(signal, sourceAssetReference = null) {
  if (!['edit', 'interactive'].includes(activeMode)) return { uploadIds: [], assetReferences: [] };
  const uploads = [];
  for (const file of sourceFiles.slice(1, 10)) {
    uploads.push(await uploadImageBlob(file, file.name, signal));
  }
  const assetReferences = [];
  const selectedAssets = promptReferenceMentions.filter((item) => (
    item.type === "asset" && item.key !== sourceAssetReference?.key
  )).slice(0, Math.max(0, 9 - uploads.length));
  for (const reference of selectedAssets) {
    uploads.push(await uploadAssetImage(reference, signal));
    assetReferences.push({ ...reference, imageIndex: uploads.length + 1 });
  }
  return { uploadIds: uploads, assetReferences };
}

async function uploadVideoImages(signal) {
  const maximum = activeMode === 'video_first_last' ? 2
    : activeMode === 'video_reference' ? 5
    : ['video_edit','video_lip_sync'].includes(activeMode) ? 3
    : ['video_character_swap','video_digital_human'].includes(activeMode) ? 2 : 1;
  const uploadIds = [];
  const assetReferences = [];
  for (const file of sourceFiles.slice(0, maximum)) {
    uploadIds.push(await uploadReferenceMediaBlob(file, file.name, signal));
  }
  const selectedAssets = promptReferenceMentions.filter((item) => item.type === 'asset').slice(0, maximum - uploadIds.length);
  for (const reference of selectedAssets) {
    uploadIds.push(await uploadAssetMedia(reference, signal));
    assetReferences.push({ ...reference, imageIndex: uploadIds.length });
  }
  return { uploadIds, assetReferences };
}

function promptWithReferenceMap(assetReferences = []) {
  const prompt = toolPromptInput?.value.trim() || "";
  const mappings = promptReferenceMentions.flatMap((reference) => {
    if (reference.type === "upload" && reference.index < sourceFiles.length) {
      return [`图 ${reference.index + 1} 对应 ${reference.token}`];
    }
    if (reference.type === "asset") {
      const uploaded = assetReferences.find((item) => item.key === reference.key);
      return uploaded ? [`图 ${uploaded.imageIndex} 对应 ${reference.token}`] : [];
    }
    return [];
  });
  return mappings.length ? `${prompt}\n\n参考素材对应关系：${mappings.join("；")}。` : prompt;
}

function repaintMask() {
  if (!maskCanvas || !maskLayer || !maskTintLayer || !sourcePreview.complete) return;
  const context = maskCanvas.getContext("2d");
  context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  context.drawImage(sourcePreview, 0, 0, maskCanvas.width, maskCanvas.height);
  const tint = maskTintLayer.getContext("2d");
  tint.clearRect(0, 0, maskTintLayer.width, maskTintLayer.height);
  tint.fillStyle = "#ff3b91";
  tint.fillRect(0, 0, maskTintLayer.width, maskTintLayer.height);
  tint.globalCompositeOperation = "destination-in";
  tint.drawImage(maskLayer, 0, 0);
  tint.globalCompositeOperation = "source-over";
  context.save();
  context.globalAlpha = 0.48;
  context.drawImage(maskTintLayer, 0, 0);
  context.restore();
}

function updateMaskBrushControl() {
  const value = Number(maskBrush.value);
  const minimum = Number(maskBrush.min);
  const maximum = Number(maskBrush.max);
  const valueText = `${value} px`;
  const progress = ((value - minimum) / (maximum - minimum)) * 100;
  maskBrush.style.setProperty("--mask-range-progress", `${progress}%`);
  maskBrush.setAttribute("aria-valuetext", valueText);
  maskBrushValue.value = valueText;
  maskBrushValue.textContent = valueText;
  maskBrushSummary.textContent = valueText;
}

function initializeMaskCanvas() {
  if (!maskCanvas || !sourcePreview.naturalWidth) return;
  const scale = Math.min(1, 3072 / Math.max(sourcePreview.naturalWidth, sourcePreview.naturalHeight));
  maskCanvas.width = Math.round(sourcePreview.naturalWidth * scale);
  maskCanvas.height = Math.round(sourcePreview.naturalHeight * scale);
  maskLayer = document.createElement("canvas");
  maskLayer.width = maskCanvas.width;
  maskLayer.height = maskCanvas.height;
  maskTintLayer = document.createElement("canvas");
  maskTintLayer.width = maskCanvas.width;
  maskTintLayer.height = maskCanvas.height;
  maskHasPaint = false;
  maskClear.disabled = true;
  maskFocusTrigger.disabled = false;
  repaintMask();
}

function applyMaskFocusZoom(nextZoom) {
  const previousWidth = maskFocusCanvasHost.scrollWidth;
  const previousHeight = maskFocusCanvasHost.scrollHeight;
  const centerX = (maskFocusStage.scrollLeft + maskFocusStage.clientWidth / 2) / previousWidth;
  const centerY = (maskFocusStage.scrollTop + maskFocusStage.clientHeight / 2) / previousHeight;
  maskFocusZoom = Math.max(1, Math.min(4, nextZoom));
  const displayWidth = Math.round(maskFocusBaseWidth * maskFocusZoom);
  const displayHeight = Math.round(maskFocusBaseHeight * maskFocusZoom);
  maskCanvas.style.width = `${displayWidth}px`;
  maskCanvas.style.height = `${displayHeight}px`;
  maskFocusCanvasHost.style.width = `${Math.max(maskFocusStage.clientWidth, displayWidth + 48)}px`;
  maskFocusCanvasHost.style.height = `${Math.max(maskFocusStage.clientHeight, displayHeight + 48)}px`;
  maskZoomValue.value = `${Math.round(maskFocusZoom * 100)}%`;
  maskZoomValue.textContent = maskZoomValue.value;
  maskZoomOut.disabled = maskFocusZoom === 1;
  maskZoomIn.disabled = maskFocusZoom === 4;
  requestAnimationFrame(() => {
    maskFocusStage.scrollLeft = centerX * maskFocusCanvasHost.scrollWidth - maskFocusStage.clientWidth / 2;
    maskFocusStage.scrollTop = centerY * maskFocusCanvasHost.scrollHeight - maskFocusStage.clientHeight / 2;
  });
}

function fitMaskFocusCanvas() {
  const availableWidth = maskFocusStage.clientWidth - 48;
  const availableHeight = maskFocusStage.clientHeight - 48;
  const fitScale = Math.min(1, availableWidth / maskCanvas.width, availableHeight / maskCanvas.height);
  maskFocusBaseWidth = Math.round(maskCanvas.width * fitScale);
  maskFocusBaseHeight = Math.round(maskCanvas.height * fitScale);
  applyMaskFocusZoom(1);
  maskFocusStage.scrollLeft = 0;
  maskFocusStage.scrollTop = 0;
}

function openMaskFocusEditor() {
  maskCanvasHomeParent = maskCanvas.parentElement;
  maskCanvasHomeNext = maskCanvas.nextSibling;
  maskToolbarHomeParent = maskToolbarActions.parentElement;
  maskToolbarHomeNext = maskToolbarActions.nextSibling;
  maskFocusCanvasHost.append(maskCanvas);
  maskFocusToolbarHost.append(maskToolbarActions);
  maskFocusTrigger.hidden = true;
  maskBrushPopover.hidden = true;
  maskBrushTrigger.setAttribute("aria-expanded", "false");
  maskFocusDialog.showModal();
  document.body.classList.add("mask-focus-open");
  requestAnimationFrame(() => {
    fitMaskFocusCanvas();
    maskFocusStage.focus({ preventScroll: true });
  });
}

function restoreMaskFocusEditor() {
  maskCanvasHomeParent.insertBefore(maskCanvas, maskCanvasHomeNext);
  maskToolbarHomeParent.insertBefore(maskToolbarActions, maskToolbarHomeNext);
  maskCanvas.style.width = "";
  maskCanvas.style.height = "";
  maskFocusCanvasHost.style.width = "";
  maskFocusCanvasHost.style.height = "";
  maskFocusTrigger.hidden = false;
  document.body.classList.remove("mask-focus-open");
  repaintMask();
}

function paintMask(event) {
  if (!maskLayer || !maskCanvas) return;
  const rect = maskCanvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (maskCanvas.width / rect.width);
  const y = (event.clientY - rect.top) * (maskCanvas.height / rect.height);
  const brush = Number(maskBrush.value) * (maskCanvas.width / rect.width);
  const context = maskLayer.getContext("2d");
  context.fillStyle = "rgba(255,255,255,1)";
  context.beginPath();
  context.arc(x, y, brush / 2, 0, Math.PI * 2);
  context.fill();
  maskHasPaint = true;
  maskClear.disabled = false;
  repaintMask();
}

async function uploadMaskImage(signal) {
  if (!maskLayer || !maskHasPaint) throw new Error("redraw_mask_required");
  const blob = await new Promise((resolve) => maskLayer.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("mask_export_failed");
  const body = new FormData();
  body.append("mask", blob, "redraw-alpha-mask.png");
  const response = await fetchJson("/api/v1/images/masks", { method: "POST", signal, body }, 90000);
  if (!response.body.upload_id) throw new Error("mask_upload_failed");
  return response.body.upload_id;
}

function cameraValues() {
  return { azimuth: Number(cameraAzimuth.value), elevation: Number(cameraElevation.value), distance: Number(cameraDistance.value) };
}

function cameraThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    surface: styles.getPropertyValue("--tv-surface-raised").trim(),
    canvas: styles.getPropertyValue("--tv-editor-canvas").trim(),
    gridMajor: styles.getPropertyValue("--tv-border-strong").trim(),
    gridMinor: styles.getPropertyValue("--tv-border").trim(),
    primary: styles.getPropertyValue("--tv-primary").trim(),
    primarySoft: styles.getPropertyValue("--tv-primary-soft").trim(),
    primaryInk: styles.getPropertyValue("--tv-primary-ink").trim(),
    accent: styles.getPropertyValue("--tv-accent").trim(),
    info: styles.getPropertyValue("--tv-info").trim(),
  };
}

function createCameraGrid(colors) {
  const grid = new THREE.GridHelper(12, 12, colors.gridMajor, colors.gridMinor);
  grid.rotation.x = Math.PI / 2;
  grid.material.transparent = true;
  grid.material.opacity = .82;
  return grid;
}

async function loadCameraModules() {
  if (THREE && OrbitControls) return;
  const [threeModule, orbitModule] = await Promise.all([
    import("./vendor/three.module.js?v=20260904-threejs-r185-1"),
    import("./vendor/OrbitControls.js?v=20260904-threejs-r185-1"),
  ]);
  THREE = threeModule;
  OrbitControls = orbitModule.OrbitControls;
}

function cameraAxisLabel(text, color, fill, position) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 52;
  const context = canvas.getContext("2d");
  context.font = "800 30px ui-monospace, SFMono-Regular, Consolas, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = fill;
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.strokeText(text, 48, 26);
  context.fillText(text, 48, 26);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    depthTest: false,
    transparent: true,
  }));
  sprite.position.copy(position);
  sprite.scale.set(.72, .39, 1);
  return sprite;
}

function applyCameraWorkspaceTheme(workspace, colors) {
  workspace.scene.background = null;
  workspace.scene.remove(workspace.grid);
  workspace.grid.dispose();
  workspace.grid = createCameraGrid(colors);
  workspace.scene.add(workspace.grid);
  workspace.orbit.material.color.set(colors.primary);
  workspace.cubeMaterial.color.set(colors.primarySoft);
  workspace.cubeEdgesMaterial.color.set(colors.primaryInk);
  workspace.previewMaterial.color.set(colors.surface);
  workspace.previewFrameMaterial.color.set(colors.primary);
  workspace.beamMaterial.color.set(colors.accent);
  workspace.cameraLight.color.set(colors.accent);
  workspace.hemisphereLight.color.set(colors.surface);
  workspace.hemisphereLight.groundColor.set(colors.primaryInk);
  workspace.keyLight.color.set(colors.surface);
  workspace.axisEntries.forEach((entry) => {
    entry.arrow.setColor(colors[entry.colorKey]);
    workspace.axisGroup.remove(entry.labelSprite);
    entry.labelSprite.material.map.dispose();
    entry.labelSprite.material.dispose();
    entry.labelSprite = cameraAxisLabel(entry.text, colors[entry.colorKey], colors.surface, entry.position);
    workspace.axisGroup.add(entry.labelSprite);
  });
  workspace.render();
}

function applyCameraTheme() {
  const colors = cameraThemeColors();
  if (cameraWorkspace) applyCameraWorkspaceTheme(cameraWorkspace, colors);
  workflowCameraWorkspaces.forEach((workspace) => {
    if (workspace.ready) applyCameraWorkspaceTheme(workspace, colors);
  });
}

window.addEventListener("huiju:theme-changed", applyCameraTheme);

async function initializeCameraWorkspace() {
  if (!cameraStage || cameraWorkspace) return;
  await loadCameraModules();
  const scene = new THREE.Scene();
  const colors = cameraThemeColors();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  cameraStage.append(renderer.domElement);

  const viewCamera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  viewCamera.up.set(0, 0, 1);
  viewCamera.position.set(7, 8, 6.4);
  const controls = new OrbitControls(viewCamera, renderer.domElement);
  controls.target.set(0, 0, .7);
  controls.minDistance = 4.4;
  controls.maxDistance = 17;
  controls.update();

  const render = () => renderer.render(scene, viewCamera);
  controls.addEventListener("change", render);
  const resize = () => {
    const { width, height } = cameraStage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    viewCamera.aspect = width / height;
    viewCamera.updateProjectionMatrix();
    render();
  };
  new ResizeObserver(resize).observe(cameraStage);

  const hemisphereLight = new THREE.HemisphereLight(colors.surface, colors.primaryInk, 2.1);
  scene.add(hemisphereLight);
  const keyLight = new THREE.DirectionalLight(colors.surface, 2.8);
  keyLight.position.set(4, -5, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const grid = createCameraGrid(colors);
  scene.add(grid);

  const origin = new THREE.Vector3(0, 0, 0);
  const axisGroup = new THREE.Group();
  const axisDefinitions = [
    { direction: new THREE.Vector3(1, 0, 0), colorKey: "accent", text: "X", position: new THREE.Vector3(2.45, 0, .12) },
    { direction: new THREE.Vector3(0, 1, 0), colorKey: "primary", text: "Y", position: new THREE.Vector3(0, 2.45, .12) },
    { direction: new THREE.Vector3(0, 0, 1), colorKey: "info", text: "Z", position: new THREE.Vector3(0, 0, 2.55) },
  ];
  const axisEntries = axisDefinitions.map((definition) => {
    const arrow = new THREE.ArrowHelper(definition.direction, origin, 2.15, colors[definition.colorKey], .26, .12);
    const labelSprite = cameraAxisLabel(definition.text, colors[definition.colorKey], colors.surface, definition.position);
    axisGroup.add(arrow, labelSprite);
    return { ...definition, arrow, labelSprite };
  });
  scene.add(axisGroup);

  const orbit = new THREE.Mesh(
    new THREE.RingGeometry(3.85, 3.91, 96),
    new THREE.MeshBasicMaterial({ color: colors.primary, transparent: true, opacity: .48, side: THREE.DoubleSide }),
  );
  scene.add(orbit);

  const target = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.7, 1.7),
    new THREE.MeshStandardMaterial({ color: colors.primarySoft, transparent: true, opacity: .12, depthWrite: false, roughness: .64, metalness: .05 }),
  );
  cube.position.z = .85;
  cube.castShadow = true;
  target.add(cube);
  const cubeEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineDashedMaterial({ color: colors.primaryInk, dashSize: .14, gapSize: .1, linewidth: 1 }),
  );
  cubeEdges.position.copy(cube.position);
  cubeEdges.computeLineDistances();
  target.add(cubeEdges);

  const planeBasis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 0),
  );
  const previewPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3),
    new THREE.MeshBasicMaterial({ color: colors.surface, transparent: true, opacity: .9, side: THREE.DoubleSide }),
  );
  previewPlane.quaternion.setFromRotationMatrix(planeBasis);
  previewPlane.position.z = .85;
  previewPlane.renderOrder = 1;
  previewPlane.visible = false;
  target.add(previewPlane);
  const previewFrame = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.7, -.7, 0), new THREE.Vector3(.7, -.7, 0),
      new THREE.Vector3(.7, .7, 0), new THREE.Vector3(-.7, .7, 0),
    ]),
    new THREE.LineBasicMaterial({ color: colors.primary, linewidth: 1.5 }),
  );
  previewFrame.quaternion.setFromRotationMatrix(planeBasis);
  previewFrame.position.z = .85;
  previewFrame.renderOrder = 2;
  previewFrame.visible = false;
  target.add(previewFrame);
  scene.add(target);

  const cameraRig = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(.68, 1, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: colors.accent, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2;
  cameraRig.add(beam);
  const cameraBody = new THREE.Mesh(
    new THREE.BoxGeometry(.92, .65, .55),
    new THREE.MeshStandardMaterial({ color: 0x0c0f0e, roughness: .32, metalness: .5 }),
  );
  cameraBody.position.x = -.28;
  cameraBody.castShadow = true;
  cameraRig.add(cameraBody);
  const cameraTop = new THREE.Mesh(
    new THREE.BoxGeometry(.36, .28, .18),
    new THREE.MeshStandardMaterial({ color: 0x171c1a, roughness: .3, metalness: .44 }),
  );
  cameraTop.position.set(-.32, 0, .34);
  cameraTop.castShadow = true;
  cameraRig.add(cameraTop);
  const cameraLens = new THREE.Mesh(
    new THREE.ConeGeometry(.4, .72, 4),
    new THREE.MeshStandardMaterial({ color: 0x050706, roughness: .24, metalness: .62 }),
  );
  cameraLens.rotation.z = -Math.PI / 2;
  cameraLens.position.x = .48;
  cameraLens.castShadow = true;
  cameraRig.add(cameraLens);
  const lensRim = new THREE.Mesh(
    new THREE.BoxGeometry(.08, .52, .52),
    new THREE.MeshStandardMaterial({ color: 0x2c3430, roughness: .28, metalness: .7 }),
  );
  lensRim.position.x = .66;
  cameraRig.add(lensRim);
  const cameraLight = new THREE.PointLight(colors.accent, 2.5, 5);
  cameraLight.position.x = .72;
  cameraRig.add(cameraLight);
  scene.add(cameraRig);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cameraParts = [];
  cameraRig.traverse((item) => { if (item.isMesh && item !== beam) cameraParts.push(item); });
  let draggingCamera = false;
  let dragPointerId = null;
  const dragPlane = new THREE.Plane();
  const dragOrigin = new THREE.Vector3();
  const dragStartPoint = new THREE.Vector3();
  const dragPoint = new THREE.Vector3();
  const pointerPosition = (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
  };
  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerPosition(event);
    raycaster.setFromCamera(pointer, viewCamera);
    if (!raycaster.intersectObjects(cameraParts, false).length) return;
    viewCamera.getWorldDirection(dragPlane.normal);
    dragPlane.setFromNormalAndCoplanarPoint(dragPlane.normal, cameraRig.position);
    if (!raycaster.ray.intersectPlane(dragPlane, dragStartPoint)) return;
    draggingCamera = true;
    dragPointerId = event.pointerId;
    dragOrigin.copy(cameraRig.position);
    controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!draggingCamera) return;
    pointerPosition(event);
    raycaster.setFromCamera(pointer, viewCamera);
    if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return;
    const orbitVector = dragOrigin.clone().add(dragPoint).sub(dragStartPoint).normalize();
    const azimuth = Math.atan2(orbitVector.y, orbitVector.x) * 180 / Math.PI;
    const elevation = Math.asin(orbitVector.z) * 180 / Math.PI;
    cameraAzimuth.value = String(azimuth);
    cameraElevation.value = String(Math.max(-30, Math.min(75, elevation)));
    updateCamera();
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  const finishCameraDrag = () => {
    if (!draggingCamera) return;
    draggingCamera = false;
    controls.enabled = true;
    if (dragPointerId !== null && renderer.domElement.hasPointerCapture(dragPointerId)) renderer.domElement.releasePointerCapture(dragPointerId);
    dragPointerId = null;
  };
  renderer.domElement.addEventListener("pointerup", finishCameraDrag, true);
  renderer.domElement.addEventListener("pointercancel", finishCameraDrag, true);
  renderer.domElement.addEventListener("lostpointercapture", finishCameraDrag, true);
  window.addEventListener("pointerup", finishCameraDrag, true);

  cameraWorkspace = {
    render,
    scene,
    grid,
    orbit,
    axisGroup,
    axisEntries,
    cubeMaterial: cube.material,
    cubeEdgesMaterial: cubeEdges.material,
    cameraRig,
    beam,
    beamMaterial: beam.material,
    cameraLight,
    hemisphereLight,
    keyLight,
    previewPlane,
    previewFrame,
    previewMaterial: previewPlane.material,
    previewFrameMaterial: previewFrame.material,
    target: new THREE.Vector3(0, 0, .85),
  };
  applyCameraTheme();
  syncCameraSourcePreview();
  resize();
  requestAnimationFrame(resize);
  render();
}

function syncCameraSourcePreview() {
  const source = sourcePreviewUrls[activeReferenceIndex] || "";
  const file = sourceFiles[activeReferenceIndex];
  const isImage = Boolean(source && (file?.type?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file?.name || "")));
  if (!cameraWorkspace) return;
  cameraWorkspace.previewPlane.visible = isImage;
  cameraWorkspace.previewFrame.visible = isImage;
  if (!isImage) {
    cameraWorkspace.previewMaterial.map = null;
    cameraWorkspace.previewMaterial.needsUpdate = true;
    cameraWorkspace.render();
    return;
  }
  new THREE.TextureLoader().load(source, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    cameraWorkspace.previewMaterial.map = texture;
    cameraWorkspace.previewMaterial.needsUpdate = true;
    cameraWorkspace.render();
  });
}

function updateCamera() {
  if (!cameraEditor) return;
  const { azimuth, elevation, distance } = cameraValues();
  const radians = azimuth * Math.PI / 180;
  const elevationRadians = elevation * Math.PI / 180;
  const radius = 1.15 + distance * .56;
  const planarRadius = radius * Math.cos(elevationRadians);
  if (cameraWorkspace) {
    const position = new THREE.Vector3(
      planarRadius * Math.cos(radians),
      planarRadius * Math.sin(radians),
      radius * Math.sin(elevationRadians),
    );
    const direction = cameraWorkspace.target.clone().sub(position);
    const targetDistance = direction.length();
    const targetDirection = direction.normalize();
    const targetSurfaceDistance = .85 / Math.max(Math.abs(targetDirection.x), Math.abs(targetDirection.y), Math.abs(targetDirection.z));
    const beamStart = .72;
    const beamLength = Math.max(.1, targetDistance - targetSurfaceDistance - beamStart);
    cameraWorkspace.cameraRig.position.copy(position);
    cameraWorkspace.cameraRig.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), targetDirection);
    cameraWorkspace.beam.scale.y = beamLength;
    cameraWorkspace.beam.position.x = beamStart + beamLength / 2;
    cameraWorkspace.render();
  }
  const normalizedAzimuth = ((azimuth + 180) % 360 + 360) % 360 - 180;
  const horizontal = Math.abs(normalizedAzimuth) <= 22 ? "front view" : normalizedAzimuth > 0 && normalizedAzimuth < 75 ? "front-right three-quarter view" : normalizedAzimuth < 0 && normalizedAzimuth > -75 ? "front-left three-quarter view" : normalizedAzimuth >= 75 && normalizedAzimuth < 120 ? "right side view" : normalizedAzimuth <= -75 && normalizedAzimuth > -120 ? "left side view" : "rear three-quarter view";
  const vertical = elevation < 8 ? "low-angle" : elevation < 25 ? "eye-level" : elevation < 55 ? "elevated" : "high-angle";
  const framing = distance < 4 ? "close-up" : distance < 7.5 ? "medium shot" : "wide shot";
  const offsetCosine = Math.cos(azimuth * Math.PI / 180) * Math.cos(elevation * Math.PI / 180);
  const offsetAngle = Math.acos(Math.max(-1, Math.min(1, offsetCosine))) * 180 / Math.PI;
  cameraPrompt.value = `${horizontal}, ${vertical} shot, ${framing}`;
  cameraPrompt.textContent = cameraPrompt.value;
  cameraAzimuthValue.value = `${azimuth}°`; cameraAzimuthValue.textContent = `${azimuth}°`;
  cameraElevationValue.value = `${elevation}°`; cameraElevationValue.textContent = `${elevation}°`;
  cameraDistanceValue.value = distance.toFixed(1); cameraDistanceValue.textContent = distance.toFixed(1);
  if (cameraOffsetValue) {
    const offsetCopy = `偏移 ${Math.round(offsetAngle)}°`;
    cameraOffsetValue.value = offsetCopy;
    cameraOffsetValue.textContent = offsetCopy;
  }
  cameraEditor.dataset.offsetAngle = offsetAngle.toFixed(1);
  cameraPresetButtons.forEach((button) => {
    const presetAzimuth = Number(button.dataset.azimuth || 0);
    const azimuthDifference = Math.abs(((azimuth - presetAzimuth + 180) % 360 + 360) % 360 - 180);
    const matches = azimuthDifference <= 1
      && Math.abs(elevation - Number(button.dataset.elevation || 0)) <= 1
      && Math.abs(distance - Number(button.dataset.distance || 5.4)) <= .11;
    button.setAttribute("aria-pressed", String(matches));
  });
}

function updateSourcePreview() {
  if (!hasToolingUI) return;
  const selectedFiles = [...(sourceImageInput.files || [])];
  clearSourcePreview();
  if (!selectedFiles.length) {
    syncUnifiedRoute();
    updateOutputSummary();
    return;
  }
  const limits = sourceMediaLimits(activeMode);
  const maxFiles = limits.max;
  sourceFiles = selectedFiles.slice(0, maxFiles);
  const acceptsVideo = limits.video;
  const acceptsAudio = limits.audio;
  const acceptsImage = limits.image;
  const supportedImage = (file) => acceptsImage && (/^image\/(png|jpeg|webp)$/.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name));
  const supportedVideo = (file) => acceptsVideo && (/^video\/(mp4|webm|quicktime)$/.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name));
  const supportedAudio = (file) => acceptsAudio && (/^audio\/(wav|x-wav|mpeg|mp4|ogg)$/.test(file.type) || /\.(wav|mp3|m4a|ogg)$/i.test(file.name));
  const unsupported = sourceFiles.find((file) => !(supportedImage(file) || supportedVideo(file) || supportedAudio(file)));
  if (unsupported) {
    const rule = sourceMediaRule(activeMode);
    setError(AUDIO_REFERENCE_MODES.has(activeMode) ? "请选择 WAV、MP3 或 M4A 格式的参考音频。"
      : rule?.audio ? "请选择 WAV、MP3、M4A 或 OGG 格式的参考音频。"
      : acceptsAudio ? "请选择受支持的图片、视频或 WAV、MP3、M4A、OGG 音频。"
      : acceptsVideo ? "请选择 PNG、JPG、WebP、MP4、WebM 或 MOV 格式的参考素材。"
      : "请选择 PNG、JPG 或 WebP 格式的参考图。");
    sourceImageInput.value = "";
    sourceFiles = [];
    updateOutputSummary();
    return;
  }
  sourcePreviewUrls = sourceFiles.map((file) => URL.createObjectURL(file));
  renderReferenceStrip();
  showActiveReference(0);
  sourceFiles.forEach((file, index) => {
    if (file.type.startsWith("video/") || file.type.startsWith("audio/")) upgradeSourceMediaPreview(file, index);
  });
  const totalMb = sourceFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024;
  sourceMeta.textContent = sourceFiles.length === 1
    ? `${sourceFiles[0].name} · ${totalMb.toFixed(1)}MB`
    : `${sourceFiles.length} 项参考素材 · ${totalMb.toFixed(1)}MB`;
  if (selectedFiles.length > maxFiles) setError(`当前能力最多使用 ${maxFiles} 项素材，已忽略其余素材。`);
  else setError("");
  syncUnifiedRoute();
  updateOutputSummary();
}

promptInput.addEventListener("input", () => {
  updatePromptMeta();
  if (isAudioMode()) updateCreditCost();
  setError("");
});

form.querySelectorAll('select[name="aspect_ratio"], select[name="quality"], select[name="resolution"]').forEach((input) => {
  input.addEventListener("change", updateChoiceStyles);
});

if (hasToolingUI) {
  sourceImageInput.addEventListener("change", updateSourcePreview);
  toolPromptInput?.addEventListener("input", () => {
    reconcilePromptReferences();
    activeMentionIndex = 0;
    renderPromptMentionPicker();
    setError("");
  });
  toolPromptInput?.addEventListener("click", renderPromptMentionPicker);
  toolPromptInput?.addEventListener("keydown", (event) => {
    if (!promptMentionPicker || promptMentionPicker.hidden) return;
    const options = [...promptMentionPicker.querySelectorAll('button[role="option"]')];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      activeMentionIndex = (activeMentionIndex + direction + Math.max(1, options.length)) % Math.max(1, options.length);
      renderPromptMentionPicker();
      promptMentionPicker.querySelector('button[role="option"].is-active')?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && options.length) {
      event.preventDefault();
      options[activeMentionIndex]?.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePromptMentionPicker();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".tool-prompt-field")) closePromptMentionPicker();
  });
  interactiveEditor?.addEventListener("click", (event) => {
    const tool = event.target.closest("[data-annotation-tool]")?.dataset.annotationTool;
    if (tool) {
      annotationMode = tool;
      interactiveEditor.querySelectorAll("[data-annotation-tool]").forEach((button) => button.classList.toggle("active", button.dataset.annotationTool === tool));
      return;
    }
    const action = event.target.closest("[data-annotation-action]")?.dataset.annotationAction;
    if (action === "undo") imageAnnotations.pop();
    if (action === "clear") imageAnnotations = [];
    renderImageAnnotations();
  });
  annotationOverlay?.addEventListener("pointerdown", (event) => {
    if (activeMode !== "interactive") return;
    const point = normalizedPointer(event);
    if (!point) return;
    annotationOverlay.setPointerCapture(event.pointerId);
    if (annotationMode === "point") {
      imageAnnotations.push({ image_index: activeReferenceIndex + 1, kind: "point", coordinates: [point.x, point.y] });
      renderImageAnnotations();
    } else {
      annotationDraft = { image_index: activeReferenceIndex + 1, kind: "bbox", coordinates: [point.x, point.y, point.x, point.y] };
      renderImageAnnotations();
    }
  });
  annotationOverlay?.addEventListener("pointermove", (event) => {
    if (!annotationDraft) return;
    const point = normalizedPointer(event);
    if (!point) return;
    annotationDraft.coordinates[2] = point.x;
    annotationDraft.coordinates[3] = point.y;
    renderImageAnnotations();
  });
  annotationOverlay?.addEventListener("pointerup", () => {
    if (!annotationDraft) return;
    const [x1, y1, x2, y2] = annotationDraft.coordinates;
    if (Math.abs(x2 - x1) >= 8 && Math.abs(y2 - y1) >= 8) imageAnnotations.push(annotationDraft);
    annotationDraft = null;
    renderImageAnnotations();
  });
  window.addEventListener("resize", positionAnnotationOverlay, { passive: true });
  maskBrush.addEventListener("input", updateMaskBrushControl);
  maskBrushTrigger.addEventListener("click", () => {
    const willOpen = maskBrushPopover.hidden;
    maskBrushPopover.hidden = !willOpen;
    maskBrushTrigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) maskBrush.focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (maskBrushPopover.hidden || event.target.closest(".mask-brush-menu")) return;
    maskBrushPopover.hidden = true;
    maskBrushTrigger.setAttribute("aria-expanded", "false");
  });
  maskClear.addEventListener("click", () => {
    maskLayer.getContext("2d").clearRect(0, 0, maskLayer.width, maskLayer.height);
    maskHasPaint = false;
    maskClear.disabled = true;
    repaintMask();
  });
  maskFocusTrigger.addEventListener("click", openMaskFocusEditor);
  maskFocusDone.addEventListener("click", () => maskFocusDialog.close());
  maskFocusDialog.addEventListener("close", restoreMaskFocusEditor);
  maskZoomOut.addEventListener("click", () => applyMaskFocusZoom(maskFocusZoom - .25));
  maskZoomIn.addEventListener("click", () => applyMaskFocusZoom(maskFocusZoom + .25));
  maskZoomFit.addEventListener("click", fitMaskFocusCanvas);
  maskFocusStage.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    applyMaskFocusZoom(maskFocusZoom + (event.deltaY < 0 ? .25 : -.25));
  }, { passive:false });
  updateMaskBrushControl();
  maskCanvas.addEventListener("pointerdown", (event) => { maskIsDrawing = true; maskCanvas.setPointerCapture(event.pointerId); paintMask(event); });
  maskCanvas.addEventListener("pointermove", (event) => { if (maskIsDrawing) paintMask(event); });
  maskCanvas.addEventListener("pointerup", () => { maskIsDrawing = false; });
  [cameraAzimuth, cameraElevation, cameraDistance].forEach((input) => input.addEventListener("input", updateCamera));
  cameraPresetButtons.forEach((button) => button.addEventListener("click", () => {
    cameraAzimuth.value = button.dataset.azimuth || "0";
    cameraElevation.value = button.dataset.elevation || "12";
    cameraDistance.value = button.dataset.distance || "5.4";
    updateCamera();
    cameraStage?.focus({ preventScroll: true });
  }));
  cameraReset.addEventListener("click", () => { cameraAzimuth.value = 45; cameraElevation.value = 30; cameraDistance.value = 5.4; updateCamera(); });
  cameraStage.addEventListener("keydown", (event) => {
    const handled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
    if (!handled) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") cameraAzimuth.value = String(Math.max(-180, Number(cameraAzimuth.value) - 2));
    if (event.key === "ArrowRight") cameraAzimuth.value = String(Math.min(180, Number(cameraAzimuth.value) + 2));
    if (event.key === "ArrowUp") cameraElevation.value = String(Math.min(75, Number(cameraElevation.value) + 2));
    if (event.key === "ArrowDown") cameraElevation.value = String(Math.max(-30, Number(cameraElevation.value) - 2));
    updateCamera();
  });
  updateCamera();
  toolNavItems.forEach((item) => {
    item.addEventListener("click", () => {
      setSelectorContext('tool-zone');
      setMode(item.dataset.mode);
      const selectedTool = TOOL_SELECTOR_CHOICES.find(([id]) => id === item.dataset.mode);
      if (sidebarToolLabel && selectedTool) sidebarToolLabel.textContent = selectedTool[1];
      if (sidebarToolMenu) sidebarToolMenu.hidden = true;
      if (sidebarToolTrigger) sidebarToolTrigger.setAttribute('aria-expanded', 'false');
    });
  });
  document.querySelectorAll('.generator-tab').forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.modeTab === "text") setMode("text");
      else if (tab.dataset.modeTab === "edit") setMode("redraw");
    });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (activeRequest) return;
  // Unified modes hand off to the concrete route implied by the attachments. Every
  // branch below (and the upload helpers they call) then works off a real mode.
  const unifiedMode = UNIFIED_MODES.has(activeMode) ? activeMode : "";
  if (unifiedMode && toolPromptInput) {
    // The reference-based image route reads the tool prompt; mirror the main box into it.
    toolPromptInput.value = promptInput.value.trim();
  }
  if (unifiedMode) activeMode = resolveUnifiedMode(unifiedMode);
  // Safety net: the resolved route may need a different model family (t2v vs i2v,
  // text-to-image vs edit). Never submit a model the route cannot honour.
  const routeModels = modelChoicesForMode(activeMode);
  if (routeModels.length && !routeModels.some((item) => item.id === modelSelect?.value && item.available)) {
    const routeModel = routeModels.find((item) => item.available) || routeModels[0];
    if (routeModel) setModelSelectValue(routeModel.id, routeModel.label);
  }
  const prompt = currentPrompt();
  if ((activeMode === "text" || isVideoMode()) && prompt.length < 3) {
    setError("请至少输入 3 个字符，描述一个清晰的画面。");
    promptInput.focus();
    return;
  }
  if (activeMode === "interactive" && !imageAnnotations.length) {
    setError("请先在参考图上点选目标或框选需要修改的区域。");
    return;
  }
  if (isAudioMode() && activeMode !== 'audio_image' && !prompt.length) {
    setError(activeMode === 'audio_custom_voice' ? '请输入音色描述。' : '请输入需要合成的配音文本。');
    (AUDIO_SOURCE_MODES.has(activeMode) ? toolPromptInput : promptInput)?.focus();
    return;
  }
  if (AUDIO_REQUIRED_SOURCE_MODES.has(activeMode) && !sourceFiles.length) {
    setError(activeMode === 'audio_image' ? '请先上传需要配音的图片。' : '请先上传 10–20 秒清晰参考音频。');
    sourceImageInput?.focus();
    return;
  }
  if (VIDEO_IMAGE_MODES.has(activeMode)) {
    const required = ['video_first_last','video_lip_sync','video_character_swap','video_digital_human'].includes(activeMode) ? 2 : 1;
    const available = sourceFiles.length + promptReferenceMentions.filter((item) => item.type === 'asset').length;
    if (available < required) {
      setError(activeMode === 'video_first_last' ? '请依次上传首帧与尾帧两张图片。' : required === 2 ? '当前能力需要两项输入素材。' : '请先上传至少一项参考素材。');
      sourceImageInput?.focus();
      return;
    }
  }
  activeRequest = new AbortController();
  lastSubmittedPrompt = prompt;
  setError("");
  setBusy(true);
  setPending();
  try {
    let response;
    if (activeMode === "text") {
      response = await fetchJson(API.create, {
        method: "POST",
        signal: activeRequest.signal,
        headers: { "Content-Type": "application/json", "Idempotency-Key": newIdempotencyKey() },
        body: JSON.stringify({
          prompt,
          aspect_ratio: selectedValue("aspect_ratio"),
          model: modelSelect ? modelSelect.value : "qwen_image",
          quality: selectedValue("quality"),
          resolution: selectedValue("resolution"),
          style: selectedStyle,
          count: Number(selectedValue("count")),
          output_mode: "auto",
          ...(selectedCapabilityId ? { capability_id: selectedCapabilityId } : {}),
        }),
      });
    } else if (isVideoMode()) {
      const { uploadIds, assetReferences } = VIDEO_IMAGE_MODES.has(activeMode)
        ? await uploadVideoImages(activeRequest.signal)
        : { uploadIds: [], assetReferences: [] };
      const operation = ({
        video_text: 'text_to_video', video_image: 'image_to_video',
        video_first_last: 'first_last_to_video', video_reference: 'reference_to_video',
        video_edit: 'video_edit', video_extension: 'video_extension', video_style: 'video_style',
        video_lip_sync: 'lip_sync', video_character_swap: 'character_swap_video',
        video_digital_human: 'digital_human',
      })[activeMode];
      let rightsConfirmed = false;
      if (activeMode === 'video_character_swap') {
        rightsConfirmed = window.confirm('请确认：您拥有上传人物图片和视频的肖像权及使用授权。确认后继续提交。');
        if (!rightsConfirmed) throw new Error('portrait_rights_confirmation_required');
      }
      response = await fetchJson(API.video, {
        method: 'POST', signal: activeRequest.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify({
          prompt: VIDEO_IMAGE_MODES.has(activeMode) ? promptWithReferenceMap(assetReferences) : prompt,
          operation,
          model: modelSelect?.value,
          upload_ids: uploadIds,
          ratio: selectedValue('aspect_ratio') || '16:9',
          resolution: selectedVideoResolution(),
          duration: Number(videoDurationInput?.value || 5),
          style_id: 0,
          rights_confirmed: rightsConfirmed,
        }),
      }, 90000);
    } else if (isAudioMode()) {
      let speechText = prompt;
      let referenceUploadId = null;
      let rightsConfirmed = false;
      if (activeMode === 'audio_custom_voice') {
        speechText = customVoicePreviewInput?.value.trim() || DEFAULT_CUSTOM_VOICE_PREVIEW;
      } else if (activeMode === 'audio_image') {
        const { uploadId } = await uploadSourceImage(activeRequest.signal);
        const analysis = await fetchJson(API.analyze, {
          method:'POST', signal:activeRequest.signal,
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ upload_id:uploadId, focus:'narration', instruction:prompt }),
        }, 120000);
        speechText = String(analysis.body.analysis || '').trim();
        if (!speechText) throw new Error('analysis_empty');
      }
      if (AUDIO_REFERENCE_MODES.has(activeMode) && sourceFiles.length) {
        rightsConfirmed = window.confirm('请确认：参考音频是您本人的声音，或已获得权利人的明确授权。样本仅用于本次临时音色复刻。');
        if (!rightsConfirmed) throw new Error('voice_rights_confirmation_required');
        const referenceFile = sourceFiles[0];
        referenceUploadId = await uploadReferenceMediaBlob(referenceFile, referenceFile.name, activeRequest.signal);
      }
      const selectedVoice = audioVoiceInput?.value || 'Cherry';
      if (activeMode === 'audio_tts' && selectedVoice.startsWith('asset:')) {
        const assetId = selectedVoice.slice(6);
        if (!assetItems.some((asset) => asset.id === assetId && asset.assetType === 'voice')) throw new Error('source_media_missing');
        referenceUploadId = await uploadAssetMedia({ assetId }, activeRequest.signal);
        rightsConfirmed = true;
      }
      const speechModel = activeMode === 'audio_custom_voice'
        ? 'qwen3-tts-instruct-flash'
        : selectedVoice.startsWith('asset:') ? 'qwen3-tts-flash' : (modelSelect?.value || 'qwen3-tts-flash');
      response = await fetchJson(API.audioTts, {
        method: 'POST', signal: activeRequest.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key':newIdempotencyKey() },
        body: JSON.stringify({
          text: speechText,
          model: speechModel,
          voice: selectedVoice.startsWith('asset:') ? 'Cherry' : selectedVoice,
          language_type: audioLanguageInput?.value || 'Auto',
          instructions: activeMode === 'audio_custom_voice'
            ? prompt
            : modelSelect?.value === 'qwen3-tts-instruct-flash' ? '自然、清晰地朗读，保持适合文本内容的情绪与节奏。' : '',
          speed_ratio: Number(audioSpeedInput?.value || 1),
          emotion: modelSelect?.value === 'doubao-tts-2.0' ? (audioEmotionInput?.value || '') : '',
          emotion_scale: 4,
          format: 'wav', sample_rate: 24000,
          ...(referenceUploadId ? { reference_upload_id:referenceUploadId, rights_confirmed:rightsConfirmed } : {}),
        }),
      }, 90000);
    } else {
      const { uploadId, sourceAssetReference } = await uploadSourceImage(activeRequest.signal);
      const { uploadIds: referenceUploadIds, assetReferences } = await uploadReferenceImages(activeRequest.signal, sourceAssetReference);
      const maskUploadId = activeMode === "redraw" ? await uploadMaskImage(activeRequest.signal) : null;
      response = await fetchJson(API.tool, {
        method: "POST",
        signal: activeRequest.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: activeMode,
          model: activeMode === "upscale" ? UPSCALER_MODEL.id : activeMode === "cutout" ? CUTOUT_MODEL.id : (modelSelect?.value || "bailian_wan_2_7"),
          upload_id: uploadId,
          ...(referenceUploadIds.length ? { reference_upload_ids: referenceUploadIds } : {}),
          ...(activeMode === "interactive" ? { annotations: imageAnnotations } : {}),
          ...(maskUploadId ? { mask_upload_id: maskUploadId } : {}),
          prompt: promptWithReferenceMap([sourceAssetReference, ...assetReferences].filter(Boolean)),
          preset_id: toolPresetSelect?.value || null,
          resolution: selectedValue("resolution"),
          quality: selectedValue("quality") || "standard",
          views: Number(viewsInput.value),
          ...(selectedCapabilityId ? { capability_id: selectedCapabilityId } : {}),
          ...(activeMode === "multiangle" ? { camera: cameraValues() } : {}),
        }),
      });
    }
    activeJobStatusPath = response.status === 202 || response.body.status === "queued"
      ? safeSameOriginPath(response.body.status_url)
      : null;
    if (activeJobStatusPath) rememberPendingJob(activeJobStatusPath);
    const result = response.status === 202 || response.body.status === "queued"
      ? await waitForJob(response.body.status_url, activeRequest.signal)
      : response.body;
    if (isVideoMode()) showMedia(result, 'video');
    else if (isAudioMode()) showMedia(result, 'audio');
    else showImages(result.images);
    forgetPendingJob();
  } catch (error) {
    const wasCancelled = error.name === "AbortError";
    const message = wasCancelled ? cancellationNotice : errorMessage(error);
    failSessionTurn(message);
    resultPlaceholder.hidden = Boolean(resultGrid.querySelector(".session-turn"));
    resultGrid.hidden = !resultPlaceholder.hidden;
    resultsTitle.textContent = "会话记录";
    resultTip.textContent = wasCancelled ? "排队中的任务会被取消；已开始的推理无法安全中断。" : "我们不会自动重复提交生成请求。";
    setStatus(wasCancelled ? "已停止" : "未完成", wasCancelled ? "idle" : "error");
    setError(wasCancelled ? "" : message);
    if (wasCancelled || error.message === "generation_failed" || error.status === 404) forgetPendingJob();
  } finally {
    // Hand back the unified surface so the next prompt starts from the same entry point.
    if (unifiedMode) {
      activeMode = unifiedMode;
      syncUnifiedRoute();
    }
    activeRequest = null;
    activeJobStatusPath = null;
    cancellationNotice = "";
    setBusy(false);
  }
});

cancelButton.addEventListener("click", cancelActiveGeneration);
function setHistoryCollapsed(collapsed) {
  if (!studioGrid || !historyToggle) return;
  studioGrid.classList.toggle("history-collapsed", collapsed);
  historyToggle.setAttribute("aria-expanded", String(!collapsed));
  historyToggle.title = collapsed ? "展开历史记录" : "收起历史记录";
  historyToggle.textContent = collapsed ? "展开" : "收起";
  try { window.localStorage.setItem(HISTORY_COLLAPSED_STORAGE_KEY, String(collapsed)); } catch { /* Preference remains session-only. */ }
}
if (historyToggle && studioGrid) {
  try { setHistoryCollapsed(window.localStorage.getItem(HISTORY_COLLAPSED_STORAGE_KEY) === "true"); } catch { setHistoryCollapsed(false); }
  historyToggle.addEventListener("click", () => setHistoryCollapsed(!studioGrid.classList.contains("history-collapsed")));
}
if (clearHistoryButton) {
  clearHistoryButton.addEventListener("click", () => {
    if (!window.confirm("仅清除本浏览器中的已生成记录，不会删除服务器上的图片。是否继续？")) return;
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // The visible list is still cleared even if storage access has become unavailable.
    }
    renderHistory();
  });
}
if (historyDialogClose && historyDialog) {
  historyDialogClose.addEventListener("click", () => historyDialog.close());
  historyDialog.addEventListener("click", (event) => {
    if (event.target === historyDialog) historyDialog.close();
  });
}
historyDialogSaveAsset?.addEventListener("click", () => {
  if (!activeHistoryEntry) return;
  historyDialog?.close();
  openAssetSaveDialog({
    url:activeHistoryEntry.url,
    prompt:activeHistoryEntry.prompt,
    kind:activeHistoryEntry.kind || "history",
    suggestedName:`历史作品 · ${formatHistoryTime(activeHistoryEntry.createdAt)}`,
  });
});
historyDialogPublish?.addEventListener("click", () => {
  if (!activeHistoryEntry) return;
  openPlazaPublishDialog({
    url:activeHistoryEntry.historyUrl || activeHistoryEntry.url,
    prompt:activeHistoryEntry.prompt,
    model:activeCapabilityName?.textContent || "绘域",
    title:"我的作品",
  });
});
function setHistoryDrawer(open) {
  document.body.classList.toggle("history-drawer-open", open);
  if (historyPanel) historyPanel.setAttribute("aria-hidden", String(!open));
  if (historyTriggerButton) historyTriggerButton.setAttribute("aria-expanded", String(open));
}
function openHistoryPanel({ returnToQuick = false } = {}) {
  if (returnToQuick) setWorkspaceView("quick");
  renderHistory();
  setHistoryDrawer(true);
  window.requestAnimationFrame(() => historyPanel?.focus({ preventScroll:true }));
}
historyTriggerButton?.addEventListener("click", () => {
  if (document.body.classList.contains("history-drawer-open")) setHistoryDrawer(false);
  else openHistoryPanel();
});
historyDrawerClose?.addEventListener("click", () => setHistoryDrawer(false));
if (historyList) {
  let historyDrag = null;
  let suppressHistoryClick = false;
  historyList.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const preview = target?.closest(".history-preview") || null;
    if (event.button !== 0 || (target?.closest("a, button") && !preview) || historyList.scrollHeight <= historyList.clientHeight) return;
    historyDrag = { pointerId:event.pointerId, startY:event.clientY, startScrollTop:historyList.scrollTop, moved:false, preview };
    historyList.setPointerCapture(event.pointerId);
  });
  historyList.addEventListener("pointermove", (event) => {
    if (!historyDrag || historyDrag.pointerId !== event.pointerId) return;
    const distance = event.clientY - historyDrag.startY;
    if (!historyDrag.moved && Math.abs(distance) < 5) return;
    historyDrag.moved = true;
    event.preventDefault();
    historyList.classList.add("is-drag-scrolling");
    historyList.scrollTop = historyDrag.startScrollTop - distance;
  });
  const finishHistoryDrag = (event) => {
    if (!historyDrag || historyDrag.pointerId !== event.pointerId) return;
    const drag = historyDrag;
    const shouldOpenPreview = event.type === "pointerup" && !drag.moved && drag.preview;
    historyDrag = null;
    suppressHistoryClick = Boolean(drag.moved || shouldOpenPreview);
    historyList.classList.remove("is-drag-scrolling");
    if (historyList.hasPointerCapture(event.pointerId)) historyList.releasePointerCapture(event.pointerId);
    window.setTimeout(() => {
      suppressHistoryClick = false;
      if (shouldOpenPreview && drag.preview?.isConnected) drag.preview.click();
    }, 0);
  };
  historyList.addEventListener("pointerup", finishHistoryDrag);
  historyList.addEventListener("pointercancel", finishHistoryDrag);
  historyList.addEventListener("lostpointercapture", (event) => {
    if (historyDrag?.pointerId !== event.pointerId) return;
    suppressHistoryClick = historyDrag.moved;
    historyList.classList.remove("is-drag-scrolling");
    historyDrag = null;
    window.setTimeout(() => { suppressHistoryClick = false; }, 0);
  });
  historyList.addEventListener("click", (event) => {
    if (!suppressHistoryClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("history-drawer-open")) setHistoryDrawer(false);
});
const feedbackDialog = document.querySelector("#feedback-dialog");
const feedbackDialogClose = document.querySelector("#feedback-dialog-close");
const feedbackCancel = document.querySelector("#feedback-cancel");
const feedbackForm = document.querySelector("#feedback-form");
const feedbackMessage = document.querySelector("#feedback-message");
const feedbackCategory = document.querySelector("#feedback-category");
const feedbackCount = document.querySelector("#feedback-count");
const feedbackScreenshot = document.querySelector("#feedback-screenshot");
const feedbackScreenshotLabel = document.querySelector("#feedback-screenshot-label");
const feedbackScreenshotPreview = document.querySelector("#feedback-screenshot-preview");
const feedbackStatus = document.querySelector("#feedback-status");
const feedbackSubmit = document.querySelector("#feedback-submit");
let feedbackPreviewUrl = "";

function closeFeedbackDialog() {
  feedbackDialog?.close();
}
feedbackButton?.addEventListener("click", () => {
  if (!feedbackDialog) return;
  let draft = "";
  try { draft = window.localStorage.getItem("huiju.feedback.draft") || ""; } catch { /* Storage may be unavailable. */ }
  if (feedbackMessage && !feedbackMessage.value) feedbackMessage.value = draft.slice(0, 1000);
  if (feedbackCount) feedbackCount.textContent = String(feedbackMessage?.value.length || 0);
  if (feedbackStatus) feedbackStatus.textContent = "";
  feedbackDialog.showModal();
  window.setTimeout(() => feedbackMessage?.focus(), 80);
});
feedbackDialogClose?.addEventListener("click", closeFeedbackDialog);
feedbackCancel?.addEventListener("click", closeFeedbackDialog);
feedbackDialog?.addEventListener("click", (event) => { if (event.target === feedbackDialog) closeFeedbackDialog(); });
feedbackMessage?.addEventListener("input", () => {
  if (feedbackCount) feedbackCount.textContent = String(feedbackMessage.value.length);
});
feedbackScreenshot?.addEventListener("change", () => {
  const file = feedbackScreenshot.files?.[0];
  if (feedbackPreviewUrl) URL.revokeObjectURL(feedbackPreviewUrl);
  feedbackPreviewUrl = "";
  if (!file) {
    if (feedbackScreenshotPreview) feedbackScreenshotPreview.hidden = true;
    if (feedbackScreenshotLabel) feedbackScreenshotLabel.textContent = "上传截图";
    return;
  }
  if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    feedbackScreenshot.value = "";
    if (feedbackStatus) feedbackStatus.textContent = "截图仅支持 PNG、JPG、WebP，且不能超过 5MB。";
    return;
  }
  feedbackPreviewUrl = URL.createObjectURL(file);
  if (feedbackScreenshotPreview) { feedbackScreenshotPreview.src = feedbackPreviewUrl; feedbackScreenshotPreview.hidden = false; }
  if (feedbackScreenshotLabel) feedbackScreenshotLabel.textContent = file.name.slice(0, 42);
  if (feedbackStatus) feedbackStatus.textContent = "";
});
feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = feedbackMessage?.value.trim() || "";
  if (message.length < 2) { if (feedbackStatus) feedbackStatus.textContent = "请至少写两个字，帮助我们理解你的想法。"; return; }
  if (feedbackSubmit) feedbackSubmit.disabled = true;
  if (feedbackStatus) feedbackStatus.textContent = "正在提交…";
  try {
    let screenshotId = null;
    const file = feedbackScreenshot?.files?.[0];
    if (file) {
      const body = new FormData();
      body.append("image", file);
      const uploaded = await fetchJson(API.feedbackScreenshot, { method:"POST", body }, 15000);
      screenshotId = uploaded.screenshot_id || null;
    }
    await fetchJson(API.feedback, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: feedbackCategory?.value || "other", message, screenshot_id: screenshotId }),
    }, 10000);
    try { window.localStorage.removeItem("huiju.feedback.draft"); } catch { /* No persistence required after success. */ }
    feedbackForm.reset();
    if (feedbackScreenshotPreview) feedbackScreenshotPreview.hidden = true;
    if (feedbackScreenshotLabel) feedbackScreenshotLabel.textContent = "上传截图";
    if (feedbackCount) feedbackCount.textContent = "0";
    if (feedbackStatus) feedbackStatus.textContent = "已收到，谢谢你帮助绘域变得更好。";
    window.setTimeout(closeFeedbackDialog, 900);
  } catch {
    try { window.localStorage.setItem("huiju.feedback.draft", message.slice(0, 1000)); } catch { /* Storage may be unavailable. */ }
    if (feedbackStatus) feedbackStatus.textContent = "暂时无法提交，内容已保存在此浏览器，请稍后重试。";
  } finally {
    if (feedbackSubmit) feedbackSubmit.disabled = false;
  }
});
resetButton?.addEventListener("click", () => {
  activeRequest?.abort();
  form.reset();
  clearSourcePreview();
  selectedStyle = "natural";
  selectedPreset = null;
  setStyle(selectedStyle);
  renderPresets();
  updatePromptMeta();
  updateChoiceStyles();
  setMode("unified_image");
  setError("");
  setIdle();
  promptInput.focus();
});

bindCompactMenus();
bindSidebarSelectors();
renderFallbackModelChoices();
setupCatalog();
setupToolbarSelectMenus();
const requestedPreset = new URLSearchParams(window.location.search).get("preset");
const initialPreset = catalog?.presets?.find((preset) => preset.id === requestedPreset);
if (initialPreset) applyPreset(initialPreset);
const requestedPrompt = new URLSearchParams(window.location.search).get("prompt");
if (requestedPrompt) promptInput.value = requestedPrompt;
updatePromptMeta();
renderHistory();
const requestedTool = new URLSearchParams(window.location.search).get("tool");
if (hasToolingUI) setMode(TOOL_SELECTOR_CHOICES.some(([id]) => id === requestedTool) ? requestedTool : "unified_image");
Promise.allSettled([loadPricing().then(loadModelAvailability), loadToolPresets()]).then(resumePendingJob);

async function refreshCredits() {
  try {
    const bootstrap = await workspaceBootstrapPromise;
    const body = bootstrap?.credits || (await fetchJson(API.credits, { method: "GET" }, 5000)).body;
    const total = body.total ?? 0;
    const totalNode = document.querySelector("#credits-total");
    if (totalNode) totalNode.textContent = total;
  } catch { /* Keep the workspace usable if the balance endpoint is temporarily unavailable. */ }
}
refreshCredits();

async function refreshSidebarUser() {
  const nameNode = document.querySelector("#sidebar-user-name");
  const avatarNode = document.querySelector("#sidebar-user-avatar");
  try {
    const bootstrap = await workspaceBootstrapPromise;
    const body = bootstrap?.user || (await fetchJson(API.currentUser, { method: "GET" }, 5000)).body;
    const onboardingIdentity = String(body?.profile?.user_id || body?.device_id || "anonymous-device");
    window.HuijuOnboardingIdentity = onboardingIdentity;
    window.dispatchEvent(new CustomEvent("huiju:onboarding-identity", { detail: { key: onboardingIdentity } }));
    const displayName = String(body?.profile?.display_name || "神秘画家").trim().slice(0, 24) || "神秘画家";
    if (nameNode) nameNode.textContent = displayName;
    if (avatarNode) avatarNode.textContent = displayName.slice(0, 1);
  } catch {
    window.HuijuOnboardingIdentity = window.HuijuOnboardingIdentity || "anonymous-device";
    window.dispatchEvent(new CustomEvent("huiju:onboarding-identity", { detail: { key: window.HuijuOnboardingIdentity } }));
    if (nameNode) nameNode.textContent = "神秘画家";
    if (avatarNode) avatarNode.textContent = "神";
  }
}
refreshSidebarUser();

let activeCapabilityGroup = "drawing-models";
let activeSidebarCapabilityGroup = "visual-creation";
let activeClientTool = "";
let localToolResultUrl = "";
let localToolImages = [];
let localResizeHistory = [];
let localResizeRedoHistory = [];
let localResizeCommitted = null;
let localResizePreviewFrame = 0;
let localToolExportVersion = 0;
let localEditorUndoStack = [];
let localEditorRedoStack = [];
let localCropDrag = null;
let localCropState = { x:0, y:0, width:1, height:1, ratio:"free", angle:0, quarterTurns:0, flipX:false, flipY:false };

const LOCAL_EDITOR_TOOLS = Object.freeze({
  collage: { title:"拼图" },
  resize: { title:"尺寸" },
  rotate: { title:"裁剪" },
  crop: { title:"裁剪" },
  convert: { title:"格式" },
  watermark: { title:"水印" },
});

function showCapabilityNotice(message) {
  if (!capabilityNotice) return;
  capabilityNotice.textContent = message;
  capabilityNotice.hidden = false;
  window.clearTimeout(showCapabilityNotice.timer);
  showCapabilityNotice.timer = window.setTimeout(() => { capabilityNotice.hidden = true; }, 7000);
}

function providerLabel(key) {
  return ({
    local_image: "本地文生图", local_edit: "本地图像编辑", local_upscale: "本地 AI 超分", local_cutout: "本地 AI 抠图",
    cloud_edit: "云端图像编辑", volcano_engine: "火山引擎", aliyun_bailian: "阿里云百炼",
    google_gemini: "Google Gemini", visual_understanding: "视觉理解",
    bailian_video: "百炼视频", bailian_audio: "百炼音频",
  })[key] || key;
}

function renderCapabilityProviders(providers = {}) {
  if (!capabilityProviderStrip) return;
  capabilityProviderStrip.replaceChildren(...Object.entries(providers).map(([key, value]) => {
    const span = document.createElement("span");
    span.className = `provider-chip${value ? " ready" : ""}`;
    span.textContent = `${providerLabel(key)} · ${value ? "已连接" : "未连接"}`;
    return span;
  }));
}

function capabilityStateLabel(item) {
  if (item.ready && item.action === "info") return "查看";
  if (item.ready) return item.availability === "browser" ? "本机处理" : "可直接用";
  if (item.member_only) return "会员专享";
  if (item.provider_configured) return "已配置 · 待接路由";
  return item.requires ? "需要 API" : "暂未启用";
}

function renderCapabilityTabs() {
  if (!capabilityTabs) return;
  capabilityTabs.replaceChildren(...capabilityGroups.map((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "tab";
    button.dataset.capabilityTab = group.id;
    button.classList.toggle("active", group.id === activeCapabilityGroup);
    button.setAttribute("aria-selected", String(group.id === activeCapabilityGroup));
    button.textContent = group.name;
    return button;
  }));
}

function renderCapabilityCards() {
  if (!capabilityContent) return;
  const query = capabilitySearch?.value.trim().toLowerCase() || "";
  const group = capabilityGroups.find((item) => item.id === activeCapabilityGroup) || capabilityGroups[0];
  const items = (group?.items || []).filter((item) => !query || `${item.name} ${item.description || ""} ${item.requires || ""}`.toLowerCase().includes(query));
  capabilityContent.replaceChildren(...items.map((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `capability-card${item.ready ? "" : " is-unavailable"}${item.state === "route_needed" ? " is-route-needed" : ""}`;
    card.dataset.capabilityId = item.id;
    const icon = document.createElement("span");
    icon.className = "capability-card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = group.icon || "✦";
    const copy = document.createElement("span");
    copy.className = "capability-card-copy";
    const title = document.createElement("b");
    title.textContent = item.name;
    const description = document.createElement("p");
    description.textContent = item.description || "";
    copy.append(title, description);
    const state = document.createElement("span");
    state.className = "capability-state";
    state.textContent = capabilityStateLabel(item);
    card.append(icon, copy, state);
    return card;
  }));
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "gallery-empty";
    empty.textContent = "没有匹配的能力。";
    capabilityContent.append(empty);
  }
}

function capabilityEntryById(itemId) {
  for (const group of capabilityGroups) {
    const item = (group.items || []).find((entry) => entry.id === itemId);
    if (item) return { item, group };
  }
  return null;
}

function loadQuickAccessIds() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(QUICK_ACCESS_STORAGE_KEY) || "[]");
    quickAccessIds = Array.isArray(stored) ? stored.filter((id) => typeof id === "string").slice(0, 6) : [];
  } catch {
    quickAccessIds = [];
  }
}

function saveQuickAccessIds() {
  try { window.localStorage.setItem(QUICK_ACCESS_STORAGE_KEY, JSON.stringify(quickAccessIds)); } catch { /* Pins remain available for this page. */ }
}

let sidebarToastTimer = 0;
function showSidebarToast(message) {
  let toast = document.querySelector("#sidebar-pin-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "sidebar-pin-toast";
    toast.className = "sidebar-pin-toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(sidebarToastTimer);
  sidebarToastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function renderQuickAccessPins() {
  if (!quickAccessPins) return;
  const entries = quickAccessIds.map(capabilityEntryById).filter(Boolean);
  quickAccessIds = entries.map(({ item }) => item.id);
  if (!entries.length) {
    const hint = document.createElement("span");
    hint.className = "quick-access-empty";
    hint.textContent = "右键二级功能可固定到这里";
    quickAccessPins.replaceChildren(hint);
    return;
  }
  quickAccessPins.replaceChildren(...entries.map(({ item, group }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-access-pin";
    button.dataset.quickCapability = item.id;
    button.title = `${item.name} · 右键移除`;
    button.setAttribute("aria-label", item.name);
    button.innerHTML = `<span aria-hidden="true">${capabilityItemIcon(item, group.id)}</span><b>${escapeMarkup(item.name)}</b>`;
    return button;
  }));
}

function toggleQuickAccessPin(itemId) {
  const entry = capabilityEntryById(itemId);
  if (!entry) return;
  const existingIndex = quickAccessIds.indexOf(itemId);
  if (existingIndex >= 0) {
    quickAccessIds.splice(existingIndex, 1);
    showSidebarToast(`已从快速访问移除「${entry.item.name}」`);
  } else {
    if (quickAccessIds.length >= 6) quickAccessIds.shift();
    quickAccessIds.push(itemId);
    showSidebarToast(`已加入快速访问「${entry.item.name}」`);
  }
  saveQuickAccessIds();
  renderQuickAccessPins();
}

const sidebarPinMenu = document.createElement("div");
sidebarPinMenu.className = "sidebar-pin-menu";
sidebarPinMenu.hidden = true;
sidebarPinMenu.setAttribute("role", "menu");
const sidebarPinMenuButton = document.createElement("button");
sidebarPinMenuButton.type = "button";
sidebarPinMenuButton.setAttribute("role", "menuitem");
sidebarPinMenu.append(sidebarPinMenuButton);
document.body.append(sidebarPinMenu);

function closeSidebarPinMenu() {
  sidebarPinMenu.hidden = true;
  sidebarPinContextItemId = "";
}

function openSidebarPinMenu(itemId, clientX, clientY) {
  const entry = capabilityEntryById(itemId);
  if (!entry) return;
  sidebarPinContextItemId = itemId;
  const pinned = quickAccessIds.includes(itemId);
  sidebarPinMenuButton.innerHTML = `<span aria-hidden="true">${pinned ? "−" : "+"}</span>${pinned ? "从快速访问移除" : "加入快速访问"}`;
  sidebarPinMenu.hidden = false;
  const bounds = sidebarPinMenu.getBoundingClientRect();
  sidebarPinMenu.style.left = `${Math.max(8, Math.min(clientX, window.innerWidth - bounds.width - 8))}px`;
  sidebarPinMenu.style.top = `${Math.max(8, Math.min(clientY, window.innerHeight - bounds.height - 8))}px`;
  sidebarPinMenuButton.focus({ preventScroll: true });
}

const SIDEBAR_ARCHITECTURE = Object.freeze([
  { id:"visual-creation", name:"图像创作", icon:"✦", sections:[
    ["开始创作", "drawing-models"], ["编辑与修复", "image-edit"], ["高级创作", "creative"],
  ]},
  { id:"professional-scenes", name:"专业场景", icon:"◇", sections:[
    ["电商", "commerce"], ["建筑与室内", "architecture"], ["人像", "portrait"], ["游戏与动漫", "game-anime"],
  ]},
  { id:"video-creation", name:"视频创作", icon:"▶", sections:[
    ["生成", "ai-video"], ["处理", "video-tools"],
  ]},
  { id:"narrative-production", name:"叙事制作", icon:"▤", sections:[
    ["短剧", "short-drama"], ["声音", "sound"],
  ]},
  { id:"projects", name:"项目", icon:"⌘", sections:[
    ["工作内容", "workspace", new Set(["workflow-canvas", "personal-assets", "generation-history"])],
  ]},
  { id:"help", name:"帮助", icon:"?", sections:[
    ["使用与状态", "workspace", new Set(["api-platform", "tutorials", "changelog"])],
  ]},
]);

function sidebarCapabilityGroups() {
  const groupsById = new Map(capabilityGroups.map((group) => [group.id, group]));
  return SIDEBAR_ARCHITECTURE.map((sidebarGroup) => ({
    ...sidebarGroup,
    sourceGroupIds: sidebarGroup.sections.map(([, groupId]) => groupId),
    items: sidebarGroup.sections.flatMap(([section, groupId, itemIds]) =>
      (groupsById.get(groupId)?.items || [])
        .filter((item) => !itemIds || itemIds.has(item.id))
        .map((item) => ({ ...item, sidebarSection:section })),
    ),
  }));
}

function renderCapabilitySidebar() {
  if (!capabilityNav || !capabilityGroups.length) return;
  capabilityNav.replaceChildren(...sidebarCapabilityGroups().map((group) => {
    const section = document.createElement("section");
    section.className = `capability-menu-group${group.id === activeSidebarCapabilityGroup ? " is-open" : ""}`;
    section.dataset.capabilityMenuGroup = group.id;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "capability-menu-trigger";
    trigger.dataset.capabilityGroup = group.id;
    trigger.setAttribute("aria-expanded", String(group.id === activeSidebarCapabilityGroup));
    trigger.innerHTML = `<span aria-hidden="true">${capabilityGroupIcon(group.id)}</span><b>${escapeMarkup(group.name)}</b><i aria-hidden="true">›</i>`;
    const subnav = document.createElement("div");
    subnav.className = "capability-subnav";
    subnav.setAttribute("aria-label", `${group.name}二级能力`);
    subnav.hidden = group.id !== activeSidebarCapabilityGroup;
    let currentSection = "";
    const appendCapabilityButton = (item, target = subnav) => {
      if (item.sidebarSection && item.sidebarSection !== currentSection) {
        currentSection = item.sidebarSection;
        const heading = document.createElement("p");
        heading.className = "capability-subnav-heading";
        heading.textContent = currentSection;
        target.append(heading);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = `capability-subitem${item.ready ? " is-ready" : ""}`;
      button.dataset.capabilitySidebarItem = item.id;
      button.title = `${item.name} · ${capabilityStateLabel(item)} · 右键加入快速访问`;
      button.innerHTML = `<span class="capability-item-icon" aria-hidden="true">${capabilityItemIcon(item, group.id)}</span><b>${escapeMarkup(item.name)}</b><small>${escapeMarkup(capabilityStateLabel(item))}</small>`;
      target.append(button);
      return button;
    };
    (group.items || []).forEach((item) => appendCapabilityButton(item));
    section.append(trigger, subnav);
    return section;
  }));
}

function openCapabilityCenter(groupId = activeCapabilityGroup) {
  if (!capabilityCenter) return;
  if (capabilityGroups.some((group) => group.id === groupId)) activeCapabilityGroup = groupId;
  capabilityCenter.hidden = false;
  document.body.classList.add("capability-center-open");
  renderCapabilityTabs();
  renderCapabilityCards();
  capabilityClose?.focus();
}

function closeCapabilityCenter() {
  if (!capabilityCenter) return;
  capabilityCenter.hidden = true;
  document.body.classList.remove("capability-center-open");
  if (capabilityNotice) capabilityNotice.hidden = true;
}

async function loadCapabilities() {
  try {
    const bootstrap = await workspaceBootstrapPromise;
    const body = bootstrap?.capabilities || (await fetchJson(API.capabilities, { method: "GET" }, 6000)).body;
    capabilityGroups = Array.isArray(body.groups) ? body.groups : [];
    capabilityProviderState = body.providers || {};
    renderCapabilityProviders(capabilityProviderState);
  } catch {
    capabilityGroups = [];
    capabilityProviderState = { local_image: false, local_edit: false, cloud_edit: false, local_upscale: false, local_cutout: false, volcano_engine: false, aliyun_bailian: false, visual_understanding: false };
    renderCapabilityProviders(capabilityProviderState);
  }
  renderCapabilitySidebar();
  renderQuickAccessPins();
  renderCapabilityTabs();
  renderCapabilityCards();
  if (typeof renderWorkflowNodePicker === "function") renderWorkflowNodePicker(workflowPickerSourceType || "");
}

const INFORMATION_VIEWS = {
  api: {
    eyebrow: "服务目录",
    title: "API 状态与文档",
    summary: "这里展示本站真实开放的同源接口和当前接入状态；不提供尚未实现的密钥签发或虚构调用日志。",
  },
  tutorials: {
    eyebrow: "创作说明",
    title: "教程中心",
    summary: "从清晰描述到蒙版重绘，再到无界工作流，把每一步都变成可以直接照做的方法。",
  },
  changelog: {
    eyebrow: "更新记录",
    title: "更新日志",
    summary: "只记录已经进入服务器版本的变化，方便判断界面、能力和接口是否真的同步。",
  },
  "short-drama-agent": {
    eyebrow: "短剧助手",
    title: "短剧编辑助手",
    summary: "通过火山方舟函数调用，把剧本拆解、图像、视频、配音与深度图任务编排为可追踪的站内异步任务。",
  },
};

const API_DIRECTORY = [
  ["GET", "/api/v1/health/live", "进程存活探针；不创建访客会话"],
  ["GET", "/api/v1/health/ready", "数据库、私有存储、任务队列与运行时就绪状态"],
  ["GET", "/api/v1/models", "模型、图标标识、可用状态与额度信息"],
  ["GET", "/api/v1/capabilities", "86 项能力及其真实运行状态"],
  ["POST", "/api/v1/images/generations", "文生图入队；支持幂等键与 8 个外部排队位"],
  ["POST", "/api/v1/images/uploads", "校验并规范化 PNG、JPG、WebP 参考图"],
  ["POST", "/api/v1/images/tools", "重绘、多视角、多角度、全景、AI 超分与透明背景抠图"],
  ["POST", "/api/v1/images/analyze", "Qwen3-VL 图片解析；只接受本站上传 ID"],
  ["GET", "/api/v1/images/jobs/{id}", "查看当前任务进度并恢复跨页面生成状态"],
  ["POST/GET", "/api/v1/videos/generations · /jobs/{id}", "Wan 2.7 文生视频；登录用户、异步任务、私有结果"],
  ["POST/GET", "/api/v1/audio/tts · /jobs/{id}", "豆包 / 千问文生配音；登录用户、私有结果"],
  ["POST/GET", "/api/v1/videos/depth · /jobs/{id}", "Video Depth Anything 视频深度图；登录用户、异步任务、私有结果"],
  ["POST/GET", "/api/v1/agents/short-drama/sessions", "创建短剧助手会话并查看用户隔离的会话记录"],
  ["POST", "/api/v1/agents/short-drama/sessions/{id}/messages", "发送创作消息；助手通过白名单函数提交站内模型任务"],
  ["GET", "/api/v1/users/history", "读取当前账号的全部持久化生成资产"],
  ["DELETE", "/api/v1/users/history/{id}", "删除当前账号的一条云端生成记录与私有文件"],
  ["GET/POST/DELETE", "/api/v1/assets", "读取、保存或删除当前账号的复用资产"],
  ["GET/POST", "/api/v1/workflows", "读取、保存与分享无界幕布工作流"],
];

function informationMarkup(view) {
  const allItems = capabilityGroups.flatMap((group) => group.items || []);
  const readyCount = allItems.filter((item) => item.ready).length;
  const routeCount = allItems.filter((item) => item.state === "route_needed").length;
  const missingCount = allItems.length - readyCount - routeCount;
  if (view === "api") return `
    <section class="info-metrics" aria-label="能力状态统计"><article><b>${readyCount}</b><span>当前可直接使用</span></article><article><b>${routeCount}</b><span>已有供应商 · 待接路由</span></article><article><b>${missingCount}</b><span>需要新增 API 或安全能力</span></article></section>
    <section class="info-section"><h3>同源接口目录</h3><p>浏览器永远只调用本站路径，第三方密钥不会下发到前端。</p><div class="api-endpoint-list">${API_DIRECTORY.map(([method, path, description]) => `<article class="api-endpoint"><code>${escapeMarkup(method)}</code><span><b>${escapeMarkup(path)}</b><span>${escapeMarkup(description)}</span></span></article>`).join("")}</div></section>`;
  if (view === "tutorials") return `
    <section class="info-card-grid">
      <article><b>01 · 文生图六维描述</b><p>先写目标，再按“场景、主体、构图与机位、光色、材质、限制”补齐。把必须保留和必须避免的内容写清楚，比堆砌画质词更稳定。</p></article>
      <article><b>02 · 指令编辑</b><p>用“只改变什么 / 必须保留什么 / 如何自然融合”三段式描述。身份、几何、机位、光线方向和背景关系都可以成为硬性保留项。</p></article>
      <article><b>03 · 蒙版局部重绘</b><p>上传原图后直接在图上涂白色蒙版。提示词只描述蒙版内的新内容，同时要求边缘、透视、材质与周围像素自然衔接。</p></article>
      <article><b>04 · 多角度相机台</b><p>拖动相机点或调整水平、垂直、距离；系统会把机位转换为明确英文镜头提示，并与主体一致性约束一起提交。</p></article>
      <article><b>05 · 多视角与全景</b><p>多视角强调同一主体的身份、部件和比例一致；全景固定 2:1 等距柱状投影，并明确左右边缘无缝衔接。</p></article>
      <article><b>06 · 工作流幕布</b><p>从输出端连接到下游输入端；双击空白添加节点。运行前检查是否存在从场景/提示词到输出的完整路径，资产可从左下角资源组件拖入。</p></article>
    </section>`;
  if (view === "short-drama-agent") return `
    <section class="info-card-grid">
      <article><b>对话式分镜规划</b><p>输入题材、时长、角色与情绪，助手会先拆解场次和镜头，再按最少可复用素材规划生成任务。</p></article>
      <article><b>站内函数调用</b><p>可调用文生图、图片编辑、Seedream 交互编辑与图层拆分、Wan 文生视频、Qwen 配音和视频转深度图；供应商密钥不会交给模型。</p></article>
      <article><b>异步与可恢复</b><p>生成函数只返回站内任务编号，随后可查询进度。页面刷新不会把供应商临时地址或任务标识暴露给用户。</p></article>
      <article><b>额度与安全</b><p>执行沿用当前账号的额度、并发限制、内容安全和用户数据隔离；每次函数参数和结果都会写入审计记录。</p></article>
    </section>`;
  return `<section class="change-log-list">
    <article class="change-log-entry"><time>v144</time><span><b>上线可靠性加固</b><span>新增双健康探针、同源写保护、上传体积门禁、统一安全响应头、服务异常提示、发布预检，以及资产与云端记录删除。</span></span></article>
    <article class="change-log-entry"><time>v57</time><span><b>能力真实性收口</b><span>图片解析接入 Qwen3-VL；API 状态、教程和更新日志成为真实交互面板；新增 79 项能力契约检查。</span></span></article>
    <article class="change-log-entry"><time>v56</time><span><b>侧栏结构重建</b><span>快速访问仅保留主页面与工作流幕布；13 个业务分类升为一级，模型条目增加品牌图标与说明。</span></span></article>
    <article class="change-log-entry"><time>v55</time><span><b>能力状态纠偏</b><span>已配置但缺路由的功能明确标记，不再用跳转或提示冒充完成。</span></span></article>
    <article class="change-log-entry"><time>v53</time><span><b>无界幕布与资产</b><span>资源组件移至左下角；支持节点自由连接、双击添加、个人资产和工作流分享。</span></span></article>
  </section>`;
}

function openInformationView(view) {
  const copy = INFORMATION_VIEWS[view];
  if (!copy || !informationDialog || !informationDialogBody) return;
  informationDialogEyebrow.textContent = copy.eyebrow;
  informationDialogTitle.textContent = copy.title;
  informationDialogSummary.textContent = copy.summary;
  informationDialogBody.innerHTML = informationMarkup(view);
  closeCapabilityCenter();
  informationDialog.showModal();
}

let analysisPreviewUrl = "";
let currentAnalysisText = "";

function setAnalysisStatus(message, isError = false) {
  if (!analysisStatus) return;
  analysisStatus.textContent = message;
  analysisStatus.classList.toggle("is-error", isError);
}

function openCapabilityToolPage(view, title, note) {
  if (!capabilityToolWorkspace) return;
  capabilityToolWorkspace.classList.toggle("is-local-editor", view === "local");
  if (capabilityWorkspaceEyebrow) capabilityWorkspaceEyebrow.textContent = view === "analysis" ? "QWEN3-VL" : "";
  if (capabilityWorkspaceTitle) capabilityWorkspaceTitle.textContent = title || "图片工具";
  if (capabilityWorkspaceNote) capabilityWorkspaceNote.textContent = note || "选择图片后在右侧工作区完成处理。";
  if (localToolView) localToolView.hidden = view !== "local";
  if (analysisToolView) analysisToolView.hidden = view !== "analysis";
  closeCapabilityCenter();
  setWorkspaceView("capability");
  capabilityToolWorkspace.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openImageAnalysis() {
  openCapabilityToolPage("analysis", "图片解析", "识别主体、构图、光色、风格与可见文字；图片经由本站后端发送至已配置的阿里云百炼。 ");
  window.setTimeout(() => analysisImageInput?.focus(), 80);
}

analysisImageInput?.addEventListener("change", () => {
  const file = analysisImageInput.files?.[0];
  if (analysisPreviewUrl) URL.revokeObjectURL(analysisPreviewUrl);
  analysisPreviewUrl = "";
  currentAnalysisText = "";
  if (analysisResult) { analysisResult.hidden = true; analysisResult.textContent = ""; }
  if (analysisUsePrompt) analysisUsePrompt.hidden = true;
  if (analysisEmpty) analysisEmpty.hidden = false;
  const upload = analysisImageInput.closest(".analysis-upload");
  if (!file) {
    if (analysisPreview) { analysisPreview.hidden = true; analysisPreview.removeAttribute("src"); }
    upload?.classList.remove("has-preview");
    setAnalysisStatus("请选择一张图片。");
    return;
  }
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) {
    analysisImageInput.value = "";
    if (analysisPreview) analysisPreview.hidden = true;
    upload?.classList.remove("has-preview");
    setAnalysisStatus("请选择 15MB 以内的 PNG、JPG 或 WebP 图片。", true);
    return;
  }
  analysisPreviewUrl = URL.createObjectURL(file);
  if (analysisPreview) { analysisPreview.src = analysisPreviewUrl; analysisPreview.hidden = false; }
  upload?.classList.add("has-preview");
  setAnalysisStatus(`${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB`);
});

analysisRun?.addEventListener("click", async () => {
  const file = analysisImageInput?.files?.[0];
  if (!file) { setAnalysisStatus("请先选择需要解析的图片。", true); return; }
  analysisRun.disabled = true;
  analysisRun.textContent = "正在解析…";
  setAnalysisStatus("正在安全上传并调用视觉理解模型，请稍候。");
  try {
    const formData = new FormData();
    formData.append("image", file, file.name);
    const uploaded = await fetchJson(API.upload, { method: "POST", body: formData }, 90000);
    const response = await fetchJson(API.analyze, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_id: uploaded.body.upload_id, focus: analysisFocus?.value || "complete" }),
    }, 120000);
    currentAnalysisText = String(response.body.analysis || "").trim();
    if (!currentAnalysisText) throw new Error("analysis_empty");
    analysisResult.textContent = currentAnalysisText;
    analysisResult.hidden = false;
    analysisEmpty.hidden = true;
    analysisUsePrompt.hidden = false;
    setAnalysisStatus(`解析完成 · ${response.body.model || "Qwen3-VL"}`);
  } catch (error) {
    const message = error?.status === 409 ? "视觉理解服务尚未配置。" : error?.status === 429 ? "请求过于频繁，请稍后再试。" : "图片解析失败，请稍后重试。";
    setAnalysisStatus(message, true);
  } finally {
    analysisRun.disabled = false;
    analysisRun.textContent = "开始解析";
  }
});

analysisUsePrompt?.addEventListener("click", () => {
  if (!currentAnalysisText) return;
  setWorkspaceView("quick");
  setMode("text");
  promptInput.value = currentAnalysisText;
  updatePromptMeta();
  setWorkspaceView("quick");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => promptInput.focus(), 260);
});

function openImageDubbingWorkflow(item) {
  closeCapabilityCenter();
  setWorkspaceView("workflow");
  window.setTimeout(() => {
    const worldX = ((workflowViewport?.clientWidth || 1200) / 2 - workflowState.panX) / workflowState.zoom;
    const worldY = ((workflowViewport?.clientHeight || 720) / 2 - workflowState.panY) / workflowState.zoom;
    const image = createDynamicWorkflowNode("media_input", worldX - 650, worldY - 140, "", { input_type:"image" });
    const speech = createDynamicWorkflowNode("audio_generator", worldX - 235, worldY - 140, "", { ability:"image_dubbing", model:"doubao-tts-2.0" });
    const output = createDynamicWorkflowNode("media_output", worldX + 175, worldY - 140, "", { output_type:"audio", format:"wav" });
    if (![image, speech, output].every(Boolean)) return showWorkflowToast("图片配音工作流创建失败");
    const connect = (fromNode, fromPort, toNode, toPort) => workflowEdges.push({
      id:`edge-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      from_node:fromNode.dataset.nodeId, from_port:fromPort,
      to_node:toNode.dataset.nodeId, to_port:toPort,
    });
    connect(image, "image", speech, "image");
    connect(speech, "audio", output, "audio");
    updateWorkflowLines();
    syncWorkflowGenerationCredits(speech);
    showWorkflowToast(`已创建${item?.name || "图片配音"}工作流，选择图片后即可运行`);
  }, 180);
}

function openReferenceAudioWorkflow(item) {
  closeCapabilityCenter();
  setWorkspaceView("workflow");
  window.setTimeout(() => {
    const worldX = ((workflowViewport?.clientWidth || 1200) / 2 - workflowState.panX) / workflowState.zoom;
    const worldY = ((workflowViewport?.clientHeight || 720) / 2 - workflowState.panY) / workflowState.zoom;
    const input = createDynamicWorkflowNode("media_input", worldX - 470, worldY - 140, "", { input_type:"audio" });
    const speech = createDynamicWorkflowNode("audio_generator", worldX - 90, worldY - 140, "", { ability:"reference_audio", model:"qwen3-tts-flash" });
    const output = createDynamicWorkflowNode("media_output", worldX + 300, worldY - 140, "", { output_type:"audio", format:"wav" });
    if (![input, speech, output].every(Boolean)) return showWorkflowToast("参考音频工作流创建失败");
    const connect = (fromNode, fromPort, toNode, toPort) => workflowEdges.push({
      id:`edge-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      from_node:fromNode.dataset.nodeId, from_port:fromPort,
      to_node:toNode.dataset.nodeId, to_port:toPort,
    });
    connect(input, "audio", speech, "audio");
    connect(speech, "audio", output, "audio");
    updateWorkflowLines();
    syncWorkflowGenerationCredits(speech);
    showWorkflowToast(`已创建${item?.name || "参考音频配声"}工作流，请上传本人或已获授权的清晰人声`);
  }, 180);
}

informationDialogClose?.addEventListener("click", () => informationDialog?.close());
informationDialog?.addEventListener("click", (event) => {
  const dialog = informationDialog;
  if (event.target === dialog) dialog.close();
});
capabilityWorkspaceBack?.addEventListener("click", () => setWorkspaceView("quick"));

function activateCapabilityItem(item) {
  if (!item) return;
  if (!item.ready && !["capability"].includes(item.action)) {
    showCapabilityNotice(item.requires || "该能力当前未启用；页面不会用空按钮冒充可用功能。");
    return;
  }
  if (item.action === "model") selectCapabilityModel(item);
  else if (item.action === "video_mode" && VIDEO_MODES.has(item.mode)) {
    setWorkspaceView('quick');
    setMode(item.mode, item.id, item.name);
    const choice = modelChoicesForMode(item.mode).find((entry) => entry.id === item.model && entry.available)
      || modelChoicesForMode(item.mode).find((entry) => entry.available);
    if (choice) setModelSelectValue(choice.id, choice.label);
    closeCapabilityCenter();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => (VIDEO_IMAGE_MODES.has(item.mode) ? sourceImageInput : promptInput)?.focus(), 260);
  }
  else if (item.action === "audio_mode" && AUDIO_MODES.has(item.mode)) {
    setWorkspaceView('quick');
    setMode(item.mode, item.id, item.name);
    const choice = audioModelChoices.find((entry) => entry.id === item.model && entry.available)
      || audioModelChoices.find((entry) => entry.available);
    if (choice) setModelSelectValue(choice.id, choice.label);
    closeCapabilityCenter();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => (AUDIO_SOURCE_MODES.has(item.mode) ? sourceImageInput : promptInput)?.focus(), 260);
  }
  else if (item.action === "drawing-mode") {
    setWorkspaceView("quick");
    setMode(item.mode || "text", item.id, item.name);
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => (item.mode === "edit" ? sourceImageInput : promptInput)?.focus(), 260);
  }
  else if (item.action === "compose") selectCapabilityComposer(item);
  else if (item.action === "client") openLocalTool(item.client_tool, item.name);
  else if (item.action === "workspace") { closeCapabilityCenter(); setWorkspaceView("workflow"); }
  else if (item.action === "assets") { closeCapabilityCenter(); setWorkspaceView("assets"); loadAssetLibrary(); }
  else if (item.action === "history") { closeCapabilityCenter(); openHistoryPanel({ returnToQuick:true }); }
  else if (item.action === "info") openInformationView(item.info_view);
  else if (item.action === "analysis") openImageAnalysis();
  else if (item.action === "workflow_recipe" && item.recipe === "image_dubbing") openImageDubbingWorkflow(item);
  else if (item.action === "workflow_recipe" && item.recipe === "reference_audio") openReferenceAudioWorkflow(item);
  else if (item.action === "workflow_node" && WORKFLOW_CANONICAL_NODE_TYPES.has(item.node_type)) {
    closeCapabilityCenter();
    setWorkspaceView("workflow");
    window.setTimeout(() => {
      const x = (workflowViewport?.clientWidth || 1200) / 2 - workflowState.panX;
      const y = (workflowViewport?.clientHeight || 720) / 2 - workflowState.panY;
      createDynamicWorkflowNode(item.node_type, x / workflowState.zoom, y / workflowState.zoom, "", {
        capability_id:item.id,
        ...(item.model ? { model:item.model } : {}),
        ...(item.node_config || {}),
      });
      updateWorkflowLines();
      showWorkflowToast(`已添加${item.name}节点`);
    }, 180);
  }
  else if (item.action === "page" && /^[a-z0-9-]+\.html$/i.test(item.href || "")) window.location.assign(item.href);
  else if (item.action === "capability") showCapabilityNotice(item.requires || "该功能需要补充服务端 API 后才能开放。");
}

capabilityNav?.addEventListener("click", (event) => {
  const groupButton = event.target.closest(".capability-menu-trigger");
  if (groupButton) {
    const groupId = groupButton.dataset.capabilityGroup;
    const section = groupButton.closest(".capability-menu-group");
    const willOpen = !section.classList.contains("is-open");
    capabilityNav.querySelectorAll(".capability-menu-group").forEach((entry) => {
      const open = entry === section && willOpen;
      entry.classList.toggle("is-open", open);
      entry.querySelector(".capability-menu-trigger")?.setAttribute("aria-expanded", String(open));
      const subnav = entry.querySelector(".capability-subnav");
      if (subnav) subnav.hidden = !open;
    });
    if (willOpen) {
      activeSidebarCapabilityGroup = groupId;
      const sidebarGroup = sidebarCapabilityGroups().find((group) => group.id === groupId);
      activeCapabilityGroup = sidebarGroup?.sourceGroupIds?.[0] || groupId;
      window.requestAnimationFrame(() => section.scrollIntoView({ block: "nearest" }));
    }
    return;
  }
  const drawingModeButton = event.target.closest("[data-drawing-mode]");
  if (drawingModeButton) {
    const mode = drawingModeButton.dataset.drawingMode;
    if (mode === "edit" && !(capabilityProviderState.local_edit || capabilityProviderState.cloud_edit)) {
      showCapabilityNotice("图片编辑当前没有可用的本地基座模型或云端编辑接口。");
      return;
    }
    setWorkspaceView("quick");
    setMode(UNIFIED_MODES.has(mode) ? mode : mode === "edit" ? "edit" : "text");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => (mode === "edit" ? sourceImageInput : promptInput)?.focus(), 260);
    return;
  }
  const itemButton = event.target.closest("[data-capability-sidebar-item]");
  if (!itemButton) return;
  const item = capabilityGroups.flatMap((group) => group.items || []).find((entry) => entry.id === itemButton.dataset.capabilitySidebarItem);
  activateCapabilityItem(item);
});
capabilityNav?.addEventListener("contextmenu", (event) => {
  const itemButton = event.target.closest("[data-capability-sidebar-item]");
  if (!itemButton) return;
  event.preventDefault();
  openSidebarPinMenu(itemButton.dataset.capabilitySidebarItem, event.clientX, event.clientY);
});
quickAccessPins?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-capability]");
  if (!button) return;
  const entry = capabilityEntryById(button.dataset.quickCapability);
  if (entry) activateCapabilityItem(entry.item);
});
quickAccessPins?.addEventListener("contextmenu", (event) => {
  const button = event.target.closest("[data-quick-capability]");
  if (!button) return;
  event.preventDefault();
  openSidebarPinMenu(button.dataset.quickCapability, event.clientX, event.clientY);
});
sidebarPinMenuButton.addEventListener("click", () => {
  if (sidebarPinContextItemId) toggleQuickAccessPin(sidebarPinContextItemId);
  closeSidebarPinMenu();
});
document.addEventListener("pointerdown", (event) => {
  if (!sidebarPinMenu.hidden && !sidebarPinMenu.contains(event.target)) closeSidebarPinMenu();
});
window.addEventListener("resize", closeSidebarPinMenu);
capabilityClose?.addEventListener("click", closeCapabilityCenter);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && capabilityCenter && !capabilityCenter.hidden) closeCapabilityCenter();
  if (event.key === "Escape" && !sidebarPinMenu.hidden) closeSidebarPinMenu();
});
capabilityTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-capability-tab]");
  if (!(button instanceof HTMLButtonElement)) return;
  activeCapabilityGroup = button.dataset.capabilityTab;
  renderCapabilityTabs();
  renderCapabilityCards();
});
capabilitySearch?.addEventListener("input", renderCapabilityCards);

function selectCapabilityModel(item) {
  const choice = sidebarModelChoices.find((model) => model.id === item.model && model.available)
    || (item.availability === "image_generation" ? sidebarModelChoices.find((model) => model.available) : null);
  if (!choice?.available) {
    showCapabilityNotice(item.requires || "这个模型当前未启用。");
    return;
  }
  setWorkspaceView("quick");
  setMode("text", item.id);
  setModelSelectValue(choice.id, choice.label);
  updateQualityOptions(choice.label);
  if (item.input_hint) promptInput.placeholder = item.input_hint;
  if (item.input_help && promptHelp) promptHelp.textContent = item.input_help;
  updatePromptMeta();
  closeCapabilityCenter();
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => promptInput.focus(), 260);
}

function selectCapabilityComposer(item) {
  if (!MODE_COPY[item.mode]) return;
  setWorkspaceView("quick");
  setMode(item.mode, item.id, item.name);
  const preferredPreset = {
    "product-multiangle": "multiangle-product",
    "portrait-multiangle": "multiangle-character",
    "multiangle-character": "multiangle-character",
    "architecture-multiangle": "multiangle-faithful",
  }[item.id];
  if (preferredPreset && toolPresetSelect?.querySelector(`option[value="${preferredPreset}"]`)) {
    toolPresetSelect.value = preferredPreset;
  }
  closeCapabilityCenter();
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => sourceImageInput?.focus(), 260);
}

capabilityContent?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-capability-id]");
  if (!(card instanceof HTMLButtonElement)) return;
  const item = capabilityGroups.flatMap((group) => group.items || []).find((entry) => entry.id === card.dataset.capabilityId);
  activateCapabilityItem(item);
});

function localToolOptionsMarkup(tool) {
  if (tool === "resize") return '<div class="image-editor-size-grid"><label>宽度<input name="width" type="number" inputmode="numeric" min="16" max="4096" step="1" value="1600" /></label><label>高度<input name="height" type="number" inputmode="numeric" min="16" max="4096" step="1" value="1200" /></label></div>';
  if (tool === "crop") return '<div class="crop-editor-controls"><div class="crop-angle-control"><button type="button" data-crop-action="rotate-left" title="向左旋转 90°" aria-label="向左旋转 90°">↶</button><label><span><b id="local-crop-angle-value">0°</b></span><input name="angle" type="range" min="-45" max="45" step="1" value="0" aria-label="微调旋转角度" /></label><button type="button" data-crop-action="rotate-right" title="向右旋转 90°" aria-label="向右旋转 90°">↷</button></div><div class="crop-inline-actions"><label class="crop-ratio-field"><span>比例</span><select name="ratio"><option value="free">自由</option><option value="1">1:1</option><option value="0.8">4:5</option><option value="0.75">3:4</option><option value="1.5">3:2</option><option value="1.7777778">16:9</option><option value="0.5625">9:16</option></select></label><button type="button" data-crop-action="flip-x" title="水平翻转" aria-label="水平翻转">⇄</button><button type="button" data-crop-action="flip-y" title="垂直翻转" aria-label="垂直翻转">⇅</button><button type="button" data-crop-action="reset" title="重置裁剪" aria-label="重置裁剪">重置</button></div></div>';
  if (tool === "convert") return '<label>格式<select name="format"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label><label>质量<input name="quality" type="range" min="60" max="100" value="92" /></label>';
  if (tool === "watermark") return '<label>水印文字<input name="text" maxlength="80" value="绘域创作" /></label><label>位置<select name="position"><option value="bottom-right">右下</option><option value="bottom-left">左下</option><option value="center">居中</option></select></label><label>透明度<input name="opacity" type="range" min="10" max="100" value="55" /></label>';
  if (tool === "collage") return '<button class="collage-add-images" type="button" data-collage-add-images><span aria-hidden="true">＋</span><b>添加图片</b><small>可继续选择或拖入图片，最多 12 张</small></button><p class="collage-image-status" data-collage-image-status role="status"></p><label>列数<select name="columns"><option value="1">1 列</option><option value="2" selected>2 列</option><option value="3">3 列</option><option value="4">4 列</option></select></label><label>间距<input name="gap" type="number" min="0" max="80" value="16" /></label>';
  return "";
}

function updateLocalCollageControls() {
  if (activeClientTool !== "collage") return;
  const count = localToolImages.length;
  const status = localToolOptions?.querySelector("[data-collage-image-status]");
  const addButton = localToolOptions?.querySelector("[data-collage-add-images]");
  if (status) {
    status.classList.toggle("is-ready", count >= 2);
    status.textContent = count >= 2 ? `已选 ${count} 张图片，可以拼图` : count ? "已选 1 张，至少再添加 1 张" : "至少添加 2 张图片后才能拼图";
  }
  if (addButton) addButton.disabled = count >= 12;
}

function updateLocalToolRunState() {
  if (!localToolRun) return;
  localToolRun.disabled = !localToolImages.length || (activeClientTool === "collage" && localToolImages.length < 2);
  updateLocalCollageControls();
}

function resetLocalCropState(ratio = "free") {
  localCropState = { x:0, y:0, width:1, height:1, ratio:String(ratio), angle:0, quarterTurns:0, flipX:false, flipY:false };
  fitLocalCropToRatio(String(ratio));
}

function fitLocalCropToRatio(ratio) {
  localCropState.ratio = String(ratio || "free");
  const target = Number(ratio);
  if (!Number.isFinite(target) || target <= 0 || !localToolCanvas?.width || !localToolCanvas?.height) {
    localCropState.x = 0; localCropState.y = 0; localCropState.width = 1; localCropState.height = 1;
    updateLocalCropOverlay();
    return;
  }
  const canvasRatio = localToolCanvas.width / localToolCanvas.height;
  let width = 1, height = 1;
  if (target > canvasRatio) height = width * canvasRatio / target;
  else width = height * target / canvasRatio;
  localCropState.width = Math.max(.08, Math.min(1, width));
  localCropState.height = Math.max(.08, Math.min(1, height));
  localCropState.x = (1 - localCropState.width) / 2;
  localCropState.y = (1 - localCropState.height) / 2;
  updateLocalCropOverlay();
}

function updateLocalCropOverlay() {
  if (!localEditorCropFrame) return;
  const visible = activeClientTool === "crop" && Boolean(localToolImages.length);
  localEditorCropFrame.hidden = !visible;
  if (!visible) return;
  const canvasLeft = localToolCanvas?.offsetLeft || 0;
  const canvasTop = localToolCanvas?.offsetTop || 0;
  const canvasWidth = localToolCanvas?.clientWidth || 0;
  const canvasHeight = localToolCanvas?.clientHeight || 0;
  localEditorCropFrame.style.left = `${canvasLeft + localCropState.x * canvasWidth}px`;
  localEditorCropFrame.style.top = `${canvasTop + localCropState.y * canvasHeight}px`;
  localEditorCropFrame.style.width = `${localCropState.width * canvasWidth}px`;
  localEditorCropFrame.style.height = `${localCropState.height * canvasHeight}px`;
  const angleOutput = localToolOptions?.querySelector("#local-crop-angle-value");
  if (angleOutput) angleOutput.textContent = `${localCropState.angle}°`;
}

function clearLocalToolImages() {
  if (localResizePreviewFrame) cancelAnimationFrame(localResizePreviewFrame);
  localResizePreviewFrame = 0;
  const allImages = [localToolImages, ...localEditorUndoStack, ...localEditorRedoStack].flat();
  [...new Set(allImages.map((image) => image?.src).filter((src) => src?.startsWith("blob:")))].forEach((src) => URL.revokeObjectURL(src));
  localToolImages = [];
  localResizeHistory = [];
  localResizeRedoHistory = [];
  localResizeCommitted = null;
  localEditorUndoStack = [];
  localEditorRedoStack = [];
  localToolExportVersion += 1;
  if (localToolResultUrl) URL.revokeObjectURL(localToolResultUrl);
  localToolResultUrl = "";
  if (localToolDownload) {
    localToolDownload.removeAttribute("href");
    localToolDownload.hidden = true;
  }
  if (localToolSaveAsset) localToolSaveAsset.disabled = true;
  if (localToolRun) localToolRun.disabled = true;
  updateLocalEditorHistoryButtons();
}

function updateLocalEditorHistoryButtons() {
  if (localEditorUndo) localEditorUndo.disabled = !localResizeHistory.length && !localEditorUndoStack.length;
  if (localEditorRedo) localEditorRedo.disabled = !localResizeRedoHistory.length && !localEditorRedoStack.length;
}

function discardLocalImageStates(states) {
  const retained = new Set([localToolImages, ...localEditorUndoStack, ...localEditorRedoStack].flat().map((image) => image?.src));
  states.flat().forEach((image) => {
    if (image?.src?.startsWith("blob:") && !retained.has(image.src)) URL.revokeObjectURL(image.src);
  });
}

function setLocalEditorTool(tool, { redraw = true } = {}) {
  if (tool === "rotate") tool = "crop";
  if (!LOCAL_EDITOR_TOOLS[tool]) tool = "resize";
  activeClientTool = tool;
  localToolOptions.innerHTML = localToolOptionsMarkup(tool);
  localEditorInspector?.classList.toggle("is-embedded", tool === "crop");
  localEditorInspector?.classList.toggle("is-open", tool !== "crop");
  if (localEditorInspectorClose) localEditorInspectorClose.hidden = tool === "crop";
  if (localToolRun) localToolRun.textContent = tool === "crop" ? "完成" : "应用";
  if (localToolView) localToolView.dataset.editorTool = tool;
  localEditorTabs?.querySelectorAll("[data-editor-tool]").forEach((button) => {
    const active = button.dataset.editorTool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (localEditorToolTitle) localEditorToolTitle.textContent = LOCAL_EDITOR_TOOLS[tool].title;
  if (localEditorToolHelp) localEditorToolHelp.textContent = "";
  if (tool === "resize" && localToolImages[0]) {
    const image = localToolImages[0];
    writeResizeSize({ width:image.naturalWidth, height:image.naturalHeight });
    localResizeCommitted = { width:image.naturalWidth, height:image.naturalHeight };
  } else {
    localResizeCommitted = null;
  }
  if (tool === "crop") resetLocalCropState("free");
  else if (localEditorCropFrame) localEditorCropFrame.hidden = true;
  localResizeHistory = [];
  localResizeRedoHistory = [];
  updateLocalEditorHistoryButtons();
  updateLocalToolRunState();
  if (redraw && localToolImages.length) {
    drawLocalResult(localToolImages);
    if (tool !== "crop") exportLocalToolResult().catch(() => {});
  }
}

function readValidResizeSize() {
  const widthInput = localToolOptions?.querySelector('[name="width"]');
  const heightInput = localToolOptions?.querySelector('[name="height"]');
  if (!(widthInput instanceof HTMLInputElement) || !(heightInput instanceof HTMLInputElement)) return null;
  const values = [widthInput.value.trim(), heightInput.value.trim()];
  if (values.some((value) => !/^\d+$/.test(value))) return null;
  const [width, height] = values.map(Number);
  if (![width, height].every((value) => Number.isSafeInteger(value) && value >= 16 && value <= 4096)) return null;
  return { width, height };
}

function writeResizeSize(size) {
  if (!size) return;
  const widthInput = localToolOptions?.querySelector('[name="width"]');
  const heightInput = localToolOptions?.querySelector('[name="height"]');
  if (widthInput) widthInput.value = String(size.width);
  if (heightInput) heightInput.value = String(size.height);
}

function updateResizeUndoButton() {
  updateLocalEditorHistoryButtons();
}

async function exportLocalToolResult() {
  if (!localToolCanvas || !localToolDownload) return;
  const exportVersion = ++localToolExportVersion;
  const format = activeClientTool === "convert" ? localOption("format", "image/png") : "image/png";
  const quality = Math.max(.6, Math.min(1, Number(localOption("quality", "92")) / 100));
  const blob = await new Promise((resolve) => localToolCanvas.toBlob(resolve, format, quality));
  if (!blob) throw new Error("浏览器无法导出这个格式，请改用 PNG。");
  if (exportVersion !== localToolExportVersion) return;
  if (localToolResultUrl) URL.revokeObjectURL(localToolResultUrl);
  localToolResultUrl = URL.createObjectURL(blob);
  localToolDownload.href = localToolResultUrl;
  localToolDownload.download = `huiju-${activeClientTool}.${format === "image/jpeg" ? "jpg" : format.split("/")[1]}`;
  localToolDownload.hidden = false;
  if (localToolSaveAsset) localToolSaveAsset.disabled = false;
}

localToolSaveAsset?.addEventListener("click", async () => {
  if (!localToolImages.length || !localToolCanvas?.width || !localToolCanvas?.height) return;
  const format = activeClientTool === "convert" ? localOption("format", "image/png") : "image/png";
  const quality = Math.max(.6, Math.min(1, Number(localOption("quality", "92")) / 100));
  localToolSaveAsset.disabled = true;
  try {
    const blob = await new Promise((resolve) => localToolCanvas.toBlob(resolve, format, quality));
    if (!blob) throw new Error("canvas_export_failed");
    const extension = format === "image/jpeg" ? "jpg" : format.split("/")[1];
    const file = new File([blob], `huiju-${activeClientTool}.${extension}`, { type:format });
    await openAssetSaveDialog({
      file, mediaType:format, assetType:"image", kind:`image_editor_${activeClientTool}`,
      suggestedName:`图片编辑 · ${LOCAL_EDITOR_TOOLS[activeClientTool]?.title || "作品"}`,
      prompt:`图片编辑：${LOCAL_EDITOR_TOOLS[activeClientTool]?.title || activeClientTool}`,
    });
  } catch {
    setError("当前图片无法存入资产库，请先保存到本地后重新上传。");
  } finally {
    localToolSaveAsset.disabled = !localToolImages.length;
  }
});

function scheduleResizePreview() {
  if (activeClientTool !== "resize" || !localToolImages.length || !readValidResizeSize()) return;
  if (localResizePreviewFrame) cancelAnimationFrame(localResizePreviewFrame);
  localResizePreviewFrame = requestAnimationFrame(() => {
    localResizePreviewFrame = 0;
    drawLocalResult(localToolImages);
    localToolEmpty.hidden = true;
  });
}

async function commitResizeSize() {
  if (activeClientTool !== "resize" || !localToolImages.length) return;
  const next = readValidResizeSize();
  if (!next) {
    writeResizeSize(localResizeCommitted);
    scheduleResizePreview();
    return;
  }
  if (!localResizeCommitted) {
    localResizeCommitted = next;
  } else if (next.width !== localResizeCommitted.width || next.height !== localResizeCommitted.height) {
    localResizeHistory.push({ ...localResizeCommitted });
    localResizeRedoHistory = [];
    localResizeCommitted = next;
  }
  updateResizeUndoButton();
  drawLocalResult(localToolImages);
  await exportLocalToolResult();
}

function openLocalTool(tool, name) {
  if (!capabilityToolWorkspace || !localToolInput || !localToolOptions) return;
  clearLocalToolImages();
  setLocalEditorTool(LOCAL_EDITOR_TOOLS[tool] ? tool : "resize", { redraw:false });
  localToolInput.multiple = true;
  localToolInput.value = "";
  localToolDownload.hidden = true;
  if (localToolSaveAsset) localToolSaveAsset.disabled = true;
  localToolEmpty.hidden = false;
  localToolError.hidden = true;
  const context = localToolCanvas?.getContext("2d");
  context?.clearRect(0, 0, localToolCanvas.width, localToolCanvas.height);
  openCapabilityToolPage("local", "图片编辑", "");
  window.setTimeout(() => localToolEmpty?.focus(), 80);
}

function localOption(name, fallback = "") {
  return localToolOptions?.querySelector(`[name="${name}"]`)?.value || fallback;
}

async function loadLocalBitmap(file) {
  if (!(file instanceof File) || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) throw new Error("请选择 15MB 以内的 PNG、JPG 或 WebP 图片。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 16_000_000) throw new Error("图片尺寸过大，最多支持 1600 万像素。");
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function localImageFromCanvas() {
  const blob = await new Promise((resolve) => localToolCanvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("无法保存当前编辑结果。");
  return loadLocalBitmap(new File([blob], "edited.png", { type:"image/png" }));
}

async function setLocalEditorFiles(files) {
  localToolError.hidden = true;
  const selectedFiles = [...(files || [])].slice(0, 12);
  if (!selectedFiles.length) return;
  const images = await Promise.all(selectedFiles.map(loadLocalBitmap));
  clearLocalToolImages();
  localToolImages = images;
  if (images.length > 1) setLocalEditorTool("collage", { redraw:false });
  else setLocalEditorTool(activeClientTool || "resize", { redraw:false });
  drawLocalResult(localToolImages);
  await exportLocalToolResult();
  localToolEmpty.hidden = true;
  updateLocalToolRunState();
  updateLocalEditorHistoryButtons();
}

async function loadLocalEditorFiles() {
  const append = localToolInput.dataset.appendMode === "true";
  delete localToolInput.dataset.appendMode;
  const files = localToolInput.files || [];
  const result = append ? await appendLocalEditorFiles(files) : await setLocalEditorFiles(files);
  localToolInput.value = "";
  return result;
}

async function appendLocalEditorFiles(files) {
  const available = Math.max(0, 12 - localToolImages.length);
  const selectedFiles = [...(files || [])].slice(0, available);
  if (!selectedFiles.length) return;
  const images = await Promise.all(selectedFiles.map(loadLocalBitmap));
  localEditorUndoStack.push([...localToolImages]);
  if (localEditorUndoStack.length > 10) discardLocalImageStates([localEditorUndoStack.splice(0, 1)[0]]);
  const discardedRedo = localEditorRedoStack;
  localEditorRedoStack = [];
  discardLocalImageStates(discardedRedo);
  localToolImages = [...localToolImages, ...images];
  setLocalEditorTool("collage", { redraw:false });
  drawLocalResult(localToolImages);
  await exportLocalToolResult();
  localToolEmpty.hidden = true;
  updateLocalToolRunState();
  updateLocalEditorHistoryButtons();
}

async function commitLocalEditorPreview() {
  if (!localToolImages.length) throw new Error("请先打开图片。");
  if (activeClientTool === "collage" && localToolImages.length < 2) throw new Error("拼图至少需要两张图片，请先添加图片。");
  if (activeClientTool === "convert") {
    await exportLocalToolResult();
    return;
  }
  const committedTool = activeClientTool;
  if (committedTool === "crop") renderLocalCropCommit();
  const previous = localToolImages;
  const committed = await localImageFromCanvas();
  localEditorUndoStack.push(previous);
  if (localEditorUndoStack.length > 10) discardLocalImageStates([localEditorUndoStack.splice(0, 1)[0]]);
  const discardedRedo = localEditorRedoStack;
  localEditorRedoStack = [];
  discardLocalImageStates(discardedRedo);
  localToolImages = [committed];
  localResizeHistory = [];
  localResizeRedoHistory = [];
  setLocalEditorTool(committedTool === "collage" ? "resize" : committedTool, { redraw:false });
  drawLocalResult(localToolImages);
  await exportLocalToolResult();
  updateLocalEditorHistoryButtons();
}

function drawLocalCropPreview(image, context) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const degrees = localCropState.quarterTurns * 90 + localCropState.angle;
  const radians = degrees * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const outputWidth = Math.max(1, Math.round(width * cosine + height * sine));
  const outputHeight = Math.max(1, Math.round(width * sine + height * cosine));
  localToolCanvas.width = outputWidth;
  localToolCanvas.height = outputHeight;
  context.translate(outputWidth / 2, outputHeight / 2);
  context.scale(localCropState.flipX ? -1 : 1, localCropState.flipY ? -1 : 1);
  context.rotate(radians);
  context.drawImage(image, -width / 2, -height / 2);
  requestAnimationFrame(updateLocalCropOverlay);
}

function renderLocalCropCommit() {
  const source = document.createElement("canvas");
  source.width = localToolCanvas.width;
  source.height = localToolCanvas.height;
  source.getContext("2d").drawImage(localToolCanvas, 0, 0);
  const sx = Math.max(0, Math.round(localCropState.x * source.width));
  const sy = Math.max(0, Math.round(localCropState.y * source.height));
  const width = Math.max(1, Math.min(source.width - sx, Math.round(localCropState.width * source.width)));
  const height = Math.max(1, Math.min(source.height - sy, Math.round(localCropState.height * source.height)));
  localToolCanvas.width = width;
  localToolCanvas.height = height;
  localToolCanvas.getContext("2d").drawImage(source, sx, sy, width, height, 0, 0, width, height);
}

function drawLocalResult(images) {
  const image = images[0];
  const context = localToolCanvas.getContext("2d");
  let width = image.naturalWidth;
  let height = image.naturalHeight;
  context.save();
  if (activeClientTool === "resize") {
    width = Math.min(4096, Math.max(16, Number(localOption("width", width))));
    height = Math.min(4096, Math.max(16, Number(localOption("height", height))));
    localToolCanvas.width = width; localToolCanvas.height = height;
    context.drawImage(image, 0, 0, width, height);
  } else if (activeClientTool === "crop") {
    drawLocalCropPreview(image, context);
  } else if (activeClientTool === "collage") {
    const columns = Math.max(1, Math.min(4, Number(localOption("columns", "2"))));
    const gap = Math.max(0, Math.min(80, Number(localOption("gap", "16"))));
    const cell = 640;
    const rows = Math.ceil(images.length / columns);
    localToolCanvas.width = columns * cell + (columns - 1) * gap;
    localToolCanvas.height = rows * cell + (rows - 1) * gap;
    context.fillStyle = "#f7f7f2"; context.fillRect(0, 0, localToolCanvas.width, localToolCanvas.height);
    images.forEach((entry, index) => {
      const x = (index % columns) * (cell + gap), y = Math.floor(index / columns) * (cell + gap);
      const scale = Math.max(cell / entry.naturalWidth, cell / entry.naturalHeight);
      const drawWidth = entry.naturalWidth * scale, drawHeight = entry.naturalHeight * scale;
      context.drawImage(entry, (cell - drawWidth) / 2 + x, (cell - drawHeight) / 2 + y, drawWidth, drawHeight);
    });
  } else {
    localToolCanvas.width = width; localToolCanvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    if (activeClientTool === "watermark") {
      const text = localOption("text", "绘域创作").slice(0, 80);
      const opacity = Math.max(.1, Math.min(1, Number(localOption("opacity", "55")) / 100));
      const fontSize = Math.max(18, Math.round(Math.min(width, height) * .045));
      context.font = `700 ${fontSize}px sans-serif`;
      context.textBaseline = "bottom";
      const metrics = context.measureText(text);
      const pad = fontSize;
      const position = localOption("position", "bottom-right");
      const x = position === "bottom-left" ? pad : position === "center" ? (width - metrics.width) / 2 : width - metrics.width - pad;
      const y = position === "center" ? height / 2 + fontSize / 2 : height - pad;
      context.fillStyle = `rgba(0,0,0,${opacity * .55})`; context.fillText(text, x + 2, y + 2);
      context.fillStyle = `rgba(255,255,255,${opacity})`; context.fillText(text, x, y);
    }
  }
  context.restore();
}

localToolInput?.addEventListener("change", () => {
  loadLocalEditorFiles().catch((error) => {
    localToolError.textContent = error.message || "无法打开图片，请换一张图片。";
    localToolError.hidden = false;
  });
});

function renderLocalEditorAssetChoices() {
  if (!localEditorAssetGrid || !localEditorAssetEmpty) return;
  const query = localEditorAssetSearch?.value.trim().toLocaleLowerCase("zh-CN") || "";
  const images = assetItems.filter((asset) => asset.assetType === "image" && (!query || `${asset.name} ${asset.prompt || ""}`.toLocaleLowerCase("zh-CN").includes(query)));
  const cards = images.map((asset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.localEditorAsset = asset.id;
    const image = document.createElement("img");
    image.src = asset.url;
    image.alt = "";
    image.loading = "lazy";
    const copy = document.createElement("span");
    const title = document.createElement("b");
    title.textContent = asset.name;
    copy.append(title);
    button.append(image, copy);
    return button;
  });
  localEditorAssetGrid.replaceChildren(...cards);
  localEditorAssetGrid.hidden = cards.length === 0;
  localEditorAssetEmpty.hidden = cards.length > 0;
}

async function openLocalEditorAssetPicker() {
  if (!localEditorAssetDialog) return;
  await loadAssetLibrary();
  if (localEditorAssetSearch) localEditorAssetSearch.value = "";
  renderLocalEditorAssetChoices();
  if (!localEditorAssetDialog.open) localEditorAssetDialog.showModal();
  window.setTimeout(() => localEditorAssetSearch?.focus(), 60);
}

async function loadLocalEditorAsset(assetId) {
  const asset = assetItems.find((item) => item.id === assetId && item.assetType === "image");
  if (!asset) throw new Error("这项图片资产已不存在，请刷新后重试。");
  const response = await fetch(asset.url, { credentials:"same-origin" });
  if (!response.ok) throw new Error("无法读取这项图片资产，请稍后重试。");
  const blob = await response.blob();
  const type = /^image\/(png|jpeg|webp)$/.test(blob.type) ? blob.type : String(asset.mediaType || "image/png");
  const extension = type === "image/jpeg" ? "jpg" : type.split("/")[1] || "png";
  await setLocalEditorFiles([new File([blob], `${asset.name}.${extension}`, { type })]);
}

localEditorOpenLocal?.addEventListener("click", (event) => { event.stopPropagation(); localToolInput?.click(); });
localEditorOpenAssets?.addEventListener("click", (event) => {
  event.stopPropagation();
  openLocalEditorAssetPicker().catch((error) => {
    localToolError.textContent = error.message || "资产库暂时无法打开。";
    localToolError.hidden = false;
  });
});
localToolEmpty?.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  localToolInput?.click();
});
localToolEmpty?.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  localToolInput?.click();
});
localToolStage?.addEventListener("dragover", (event) => {
  if (![...(event.dataTransfer?.items || [])].some((item) => item.kind === "file")) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  localToolStage.classList.add("is-dragging-file");
});
localToolStage?.addEventListener("dragleave", (event) => {
  if (!localToolStage.contains(event.relatedTarget)) localToolStage.classList.remove("is-dragging-file");
});
localToolStage?.addEventListener("drop", (event) => {
  event.preventDefault();
  localToolStage.classList.remove("is-dragging-file");
  const files = [...(event.dataTransfer?.files || [])].filter((file) => /^image\/(png|jpeg|webp)$/.test(file.type));
  const loadFiles = activeClientTool === "collage" && localToolImages.length ? appendLocalEditorFiles : setLocalEditorFiles;
  loadFiles(files).catch((error) => {
    localToolError.textContent = error.message || "无法打开拖入的图片。";
    localToolError.hidden = false;
  });
});
localEditorAssetClose?.addEventListener("click", () => localEditorAssetDialog?.close());
localEditorAssetSearch?.addEventListener("input", renderLocalEditorAssetChoices);
localEditorAssetDialog?.addEventListener("click", (event) => { if (event.target === localEditorAssetDialog) localEditorAssetDialog.close(); });
localEditorAssetGrid?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-local-editor-asset]");
  if (!(button instanceof HTMLButtonElement)) return;
  button.disabled = true;
  try {
    await loadLocalEditorAsset(button.dataset.localEditorAsset);
    localEditorAssetDialog?.close();
  } catch (error) {
    localToolError.textContent = error.message || "无法打开这项图片资产。";
    localToolError.hidden = false;
    localEditorAssetDialog?.close();
  } finally {
    button.disabled = false;
  }
});

localToolRun?.addEventListener("click", async () => {
  localToolError.hidden = true;
  localToolRun.disabled = true;
  try {
    await commitLocalEditorPreview();
  } catch (error) {
    localToolError.textContent = error.message || "处理失败，请换一张图片。";
    localToolError.hidden = false;
  } finally {
    updateLocalToolRunState();
  }
});

localToolOptions?.addEventListener("input", (event) => {
  if (!localToolImages.length) return;
  if (activeClientTool === "resize" && event.target.matches('[name="width"], [name="height"]')) {
    scheduleResizePreview();
    return;
  }
  if (activeClientTool === "crop") {
    if (event.target.matches('[name="angle"]')) {
      localCropState.angle = Number(event.target.value) || 0;
      drawLocalResult(localToolImages);
      fitLocalCropToRatio(localCropState.ratio);
    } else if (event.target.matches('[name="ratio"]')) {
      fitLocalCropToRatio(event.target.value);
    }
    return;
  }
  drawLocalResult(localToolImages);
  exportLocalToolResult().catch(() => {});
});

localToolOptions?.addEventListener("change", (event) => {
  if (!localToolImages.length || activeClientTool === "resize") return;
  if (activeClientTool === "crop") {
    if (event.target.matches('[name="ratio"]')) fitLocalCropToRatio(event.target.value);
    return;
  }
  drawLocalResult(localToolImages);
  exportLocalToolResult().catch(() => {});
});

localToolOptions?.addEventListener("click", (event) => {
  const collageAddButton = event.target.closest("[data-collage-add-images]");
  if (collageAddButton && activeClientTool === "collage") {
    localToolInput.dataset.appendMode = "true";
    localToolInput.click();
    return;
  }
  const button = event.target.closest("[data-crop-action]");
  if (!button || activeClientTool !== "crop" || !localToolImages.length) return;
  const action = button.dataset.cropAction;
  if (action === "rotate-left") localCropState.quarterTurns -= 1;
  if (action === "rotate-right") localCropState.quarterTurns += 1;
  if (action === "flip-x") localCropState.flipX = !localCropState.flipX;
  if (action === "flip-y") localCropState.flipY = !localCropState.flipY;
  if (action === "reset") {
    resetLocalCropState(localOption("ratio", "free"));
    const angle = localToolOptions.querySelector('[name="angle"]');
    if (angle) angle.value = "0";
  }
  button.classList.toggle("active", (action === "flip-x" && localCropState.flipX) || (action === "flip-y" && localCropState.flipY));
  drawLocalResult(localToolImages);
  fitLocalCropToRatio(localCropState.ratio);
});

function constrainLocalCropToRatio(next, handle) {
  const target = Number(localCropState.ratio);
  if (!Number.isFinite(target) || target <= 0 || !localToolCanvas.width || !localToolCanvas.height) return next;
  const normalizedRatio = target * localToolCanvas.height / localToolCanvas.width;
  const anchorRight = next.x + next.width;
  const anchorBottom = next.y + next.height;
  if (handle === "n" || handle === "s") {
    const centerX = next.x + next.width / 2;
    next.width = Math.max(.04, next.height * normalizedRatio);
    next.x = centerX - next.width / 2;
  } else {
    next.height = Math.max(.04, next.width / normalizedRatio);
    if (handle.includes("n")) next.y = anchorBottom - next.height;
    if (handle.includes("w")) next.x = anchorRight - next.width;
  }
  return next;
}

function clampLocalCrop(next) {
  const minimum = .04;
  next.width = Math.max(minimum, Math.min(1, next.width));
  next.height = Math.max(minimum, Math.min(1, next.height));
  next.x = Math.max(0, Math.min(1 - next.width, next.x));
  next.y = Math.max(0, Math.min(1 - next.height, next.y));
  return next;
}

localEditorCropFrame?.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-crop-handle]");
  if (!localEditorCanvasShell) return;
  const dragTarget = handle ? handle.dataset.cropHandle : "move";
  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  localCropDrag = {
    handle:dragTarget,
    pointerId:event.pointerId,
    x:event.clientX,
    y:event.clientY,
    start:{ ...localCropState },
    bounds:localToolCanvas.getBoundingClientRect(),
  };
});

window.addEventListener("pointermove", (event) => {
  if (!localCropDrag || event.pointerId !== localCropDrag.pointerId) return;
  const dx = (event.clientX - localCropDrag.x) / Math.max(1, localCropDrag.bounds.width);
  const dy = (event.clientY - localCropDrag.y) / Math.max(1, localCropDrag.bounds.height);
  const handle = localCropDrag.handle;
  const start = localCropDrag.start;
  const next = { ...start };
  if (handle === "move") {
    next.x = start.x + dx;
    next.y = start.y + dy;
  } else {
    if (handle.includes("e")) next.width = start.width + dx;
    if (handle.includes("s")) next.height = start.height + dy;
    if (handle.includes("w")) { next.x = start.x + dx; next.width = start.width - dx; }
    if (handle.includes("n")) { next.y = start.y + dy; next.height = start.height - dy; }
  }
  const constrained = handle === "move" ? next : constrainLocalCropToRatio(next, handle);
  localCropState = { ...localCropState, ...clampLocalCrop(constrained) };
  updateLocalCropOverlay();
});

window.addEventListener("pointerup", (event) => {
  if (localCropDrag?.pointerId === event.pointerId) localCropDrag = null;
});

window.addEventListener("resize", () => requestAnimationFrame(updateLocalCropOverlay), { passive:true });

localToolOptions?.addEventListener("focusout", (event) => {
  if (activeClientTool !== "resize" || !event.target.matches('[name="width"], [name="height"]')) return;
  commitResizeSize().catch((error) => {
    localToolError.textContent = error.message || "无法保存当前尺寸。";
    localToolError.hidden = false;
  });
});

localEditorTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-editor-tool]");
  if (!button) return;
  setLocalEditorTool(button.dataset.editorTool);
});

localEditorInspectorClose?.addEventListener("click", () => localEditorInspector?.classList.remove("is-open"));

localEditorUndo?.addEventListener("click", async () => {
  try {
    if (activeClientTool === "resize" && localResizeHistory.length) {
      const current = readValidResizeSize();
      if (current) localResizeRedoHistory.push(current);
      const previous = localResizeHistory.pop();
      localResizeCommitted = previous;
      writeResizeSize(previous);
    } else if (localEditorUndoStack.length) {
      localEditorRedoStack.push(localToolImages);
      localToolImages = localEditorUndoStack.pop();
      setLocalEditorTool(localToolImages.length > 1 ? "collage" : activeClientTool, { redraw:false });
    } else return;
    drawLocalResult(localToolImages);
    await exportLocalToolResult();
    updateLocalEditorHistoryButtons();
  } catch (error) {
    localToolError.textContent = error.message || "撤销失败。";
    localToolError.hidden = false;
  }
});

localEditorRedo?.addEventListener("click", async () => {
  try {
    if (activeClientTool === "resize" && localResizeRedoHistory.length) {
      const current = readValidResizeSize();
      if (current) localResizeHistory.push(current);
      const next = localResizeRedoHistory.pop();
      localResizeCommitted = next;
      writeResizeSize(next);
    } else if (localEditorRedoStack.length) {
      localEditorUndoStack.push(localToolImages);
      localToolImages = localEditorRedoStack.pop();
      setLocalEditorTool(localToolImages.length > 1 ? "collage" : "resize", { redraw:false });
    } else return;
    drawLocalResult(localToolImages);
    await exportLocalToolResult();
    updateLocalEditorHistoryButtons();
  } catch (error) {
    localToolError.textContent = error.message || "重做失败。";
    localToolError.hidden = false;
  }
});
const requestedCapability = new URLSearchParams(window.location.search).get("capability");
const requestedDiscovery = new URLSearchParams(window.location.search).get("discover");
loadQuickAccessIds();
loadCapabilities().then(() => {
  if (requestedCapability) openCapabilityCenter(requestedCapability);
});

const sidebarCollapse = document.querySelector("#sidebar-collapse");

function setDiscoverCollapsed(collapsed) {
  if (!discoverToggle || !discoverNav) return;
  discoverNav.hidden = collapsed;
  discoverToggle.setAttribute("aria-expanded", String(!collapsed));
  discoverToggle.classList.toggle("is-collapsed", collapsed);
}

if (discoverToggle && discoverNav) {
  let initiallyCollapsed = false;
  try { initiallyCollapsed = window.localStorage.getItem(DISCOVER_COLLAPSED_STORAGE_KEY) === "1"; } catch { /* Default to expanded. */ }
  setDiscoverCollapsed(initiallyCollapsed);
  discoverToggle.addEventListener("click", () => {
    const collapsed = discoverToggle.getAttribute("aria-expanded") === "true";
    setDiscoverCollapsed(collapsed);
    try { window.localStorage.setItem(DISCOVER_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0"); } catch { /* Keep the toggle functional. */ }
  });
}

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  if (!sidebarCollapse) return;
  sidebarCollapse.setAttribute("aria-expanded", String(!collapsed));
  sidebarCollapse.setAttribute("aria-label", collapsed ? "展开侧栏" : "收起侧栏");
}

if (sidebarCollapse) {
  let initiallyCollapsed = false;
  try { initiallyCollapsed = localStorage.getItem("huiju-sidebar-collapsed") === "1"; } catch { /* Storage may be disabled. */ }
  setSidebarCollapsed(initiallyCollapsed);
  sidebarCollapse.addEventListener("click", () => {
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    setSidebarCollapsed(collapsed);
    try { localStorage.setItem("huiju-sidebar-collapsed", collapsed ? "1" : "0"); } catch { /* Keep navigation functional. */ }
  });
}

const SKILL_CATALOG = [
  { name: "商业产品图", note: "干净布光 · 品牌质感", category: "commercial", mode: "text", icon: "◈", image: "commercial-product", prompt: "高级商业产品摄影，产品置于极简展台中央，柔和轮廓光与克制反射，高级品牌广告构图，真实材质，高细节，无文字无水印。" },
  { name: "电商主视觉", note: "动势构图 · 商品聚焦", category: "commercial", mode: "text", icon: "◇", image: "ecommerce-poster", prompt: "高级电商视觉海报，产品悬浮在几何空间中，动势构图，强烈但克制的商业主视觉，留有排版空间，无文字无水印。" },
  { name: "美妆质感图", note: "通透柔光 · 护肤广告", category: "commercial", mode: "text", icon: "✦", image: "beauty-cosmetics", prompt: "高级美妆广告摄影，护肤玻璃瓶与水滴花瓣置于石材上，通透柔光，细腻反射，商业视觉，无文字无水印。" },
  { name: "食物广告", note: "自然光 · 食欲氛围", category: "commercial", mode: "text", icon: "◉", image: "food-advertising", prompt: "高级食物广告摄影，精致甜点与新鲜食材在温暖自然光下，层次丰富，食欲感强，无文字无水印。" },
  { name: "珠宝微距", note: "奢华高光 · 材质细节", category: "commercial", mode: "text", icon: "◆", image: "jewelry-macro", prompt: "奢华珠宝微距摄影，现代首饰与透明水晶置于深色丝绒，细腻高光，极致材质，高级商业摄影，无文字无水印。" },
  { name: "包装样机", note: "品牌陈列 · 纸张肌理", category: "commercial", mode: "text", icon: "▣", image: "packaging-mockup", prompt: "高级品牌包装样机，礼盒、纸袋与瓶罐组合陈列，真实纸张和印刷肌理，摄影棚柔光，无文字无标志无水印。" },
  { name: "质感人像", note: "自然抓拍 · 胶片氛围", category: "portrait", mode: "text", icon: "◎", image: "editorial-portrait", prompt: "真人写实人像摄影，自然抓拍姿态，柔和侧光勾勒轮廓，胶片颗粒，真实皮肤质感，克制高级的色彩。" },
  { name: "电影感人像", note: "情绪侧光 · 35mm胶片", category: "portrait", mode: "text", icon: "◐", image: "cinematic-portrait", prompt: "电影感成年人物肖像，雨夜窗边，冷暖侧光，35mm胶片颗粒，克制情绪，真实摄影，无文字无水印。" },
  { name: "随手抓拍", note: "低像素 · 朦胧噪点", category: "portrait", mode: "text", icon: "⌁", image: "instant-snapshot", prompt: "低像素生活随手抓拍风格，前置摄像头视角，室内日常场景，明显噪点、轻微失焦和暧昧梦幻氛围，无文字无水印。" },
  { name: "新中式写真", note: "东方留白 · 含蓄光影", category: "portrait", mode: "text", icon: "❋", image: "oriental-portrait", prompt: "新中式成年女性人像摄影，现代东方服装，简洁发饰，竹影与夕阳，含蓄高级，真实细节，无文字无水印。" },
  { name: "商务形象照", note: "自然可信 · 专业棚拍", category: "portrait", mode: "text", icon: "◍", image: "business-headshot", prompt: "专业商务形象照，成年职场人物自然自信，简洁背景，柔和棚拍光，真实可信，高级企业摄影，无文字无水印。" },
  { name: "多角度设定", note: "调节机位 · 主体一致", category: "character", mode: "multiangle", icon: "◒", image: "multi-angle", prompt: "保持参考主体身份、服装与比例一致，生成指定相机方位的专业角色画面，干净背景，真实光影，高细节。" },
  { name: "角色设定表", note: "三视图 · 细节拆解", category: "character", mode: "text", icon: "⌘", image: "character-sheet", prompt: "专业原创角色设定表，包含正面全身、侧面、背面和局部细节，所有视角身份与服装完全一致，干净背景，无文字无水印。" },
  { name: "动画角色", note: "电影赛璐璐 · 精致线条", category: "character", mode: "text", icon: "✧", image: "anime-character", prompt: "原创动画电影角色，清透赛璐璐上色，精致线条，富有层次的环境光，人物设计完整，无文字无水印。" },
  { name: "表情设定", note: "同一角色 · 四种情绪", category: "character", mode: "text", icon: "☻", image: "expression-sheet", prompt: "原创角色表情设定，同一角色的开心、疑惑、惊讶和冷静四种面部表情整齐呈现，身份完全一致，干净背景，无文字。" },
  { name: "电影分镜", note: "连续镜头 · 叙事节奏", category: "character", mode: "text", icon: "▤", image: "cinematic-storyboard", prompt: "电影分镜设计，同一人物和场景的远景、中景、近景与特写连续呈现，镜头衔接自然，电影摄影，高级叙事感，无文字。" },
  { name: "手绘注解", note: "生活摄影 · 涂鸦装饰", category: "design", mode: "redraw", icon: "✎", image: "handwritten-notes", prompt: "观察参考图中的元素，用简洁手绘箭头、虚线、星星和小图形添加自然注解装饰，保留主体，杂志随手笔记感。" },
  { name: "品牌主视觉", note: "玻璃材质 · 三维设计", category: "design", mode: "text", icon: "◫", image: "brand-key-visual", prompt: "高级品牌主视觉，半透明玻璃几何体在极简空间中悬浮流动，细腻反射，现代三维设计，无文字无水印。" },
  { name: "界面概念图", note: "悬浮卡片 · 产品美学", category: "design", mode: "text", icon: "▦", image: "ui-concept", prompt: "未来感创意应用界面概念，多层半透明卡片悬浮在柔和空间，精致现代产品设计，不出现可读文字，无水印。" },
  { name: "照片转插画", note: "真实融合 · 绘本质感", category: "design", mode: "redraw", icon: "◩", image: "illustration-conversion", prompt: "将参考照片自然转化为细腻绘本插画，保留主体轮廓、构图与关键特征，色彩干净，纸张肌理细腻。" },
  { name: "水彩海报", note: "高级留白 · 水彩晕染", category: "design", mode: "text", icon: "❉", image: "watercolor-poster", prompt: "现代水彩艺术海报，抽象花卉和人物剪影，高级留白、自然水彩晕染和纸张肌理，无文字无水印。" },
  { name: "室内设计", note: "空间材质 · 自然天光", category: "scene", mode: "text", icon: "▱", image: "interior-design", prompt: "高级现代室内设计，安静完整的居住空间，真实石材、原木与织物，自然天光，建筑摄影，无人物无文字。" },
  { name: "建筑概念", note: "极简体块 · 环境融合", category: "scene", mode: "text", icon: "△", image: "architecture-concept", prompt: "现代建筑概念，极简美术馆位于薄雾自然景观，弧形结构与水面倒影，专业建筑可视化，无文字无水印。" },
  { name: "360° 全景空间", note: "2:1 投影 · 无缝环视", category: "scene", mode: "panorama", icon: "◫", image: "panorama-scene", prompt: "将参考画面扩展为严格 2:1 等距柱状 360° 全景，水平视场 360°、垂直视场 180°，地平线居中，最左与最右边缘无缝衔接。" },
  { name: "幻想概念", note: "史诗空间 · 超现实叙事", category: "scene", mode: "text", icon: "✺", image: "fantasy-concept", prompt: "史诗幻想概念艺术，云海上的东方宫殿与悬浮星球，广角大纵深，震撼而克制的电影氛围，无文字无水印。" },
  { name: "局部重绘", note: "画笔蒙版 · 精准修改", category: "edit", mode: "redraw", icon: "◌", image: "local-redraw", prompt: "仅重绘画笔蒙版选中的区域，严格保留未选区域，修改内容与原图光线、透视、材质和颗粒自然融合。" },
  { name: "重新布光", note: "保留人物 · 改变光线", category: "edit", mode: "redraw", icon: "☼", image: "photo-relighting", prompt: "保持参考图人物身份、构图与背景不变，将选中区域调整为高级电影侧光，阴影与轮廓光自然，肤色真实。" },
  { name: "智能换装", note: "身份锁定 · 服装替换", category: "edit", mode: "redraw", icon: "♢", image: "outfit-change", prompt: "保持参考图人物身份、脸部、姿态和背景不变，仅替换选中区域的服装，剪裁自然，材质真实，光影完全匹配。" },
];

const skillGrid = document.querySelector("#skill-grid");
const AVAILABLE_SKILL_COVERS = new Set(SKILL_CATALOG.map((skill) => skill.image));
function createSkillCard(skill, index) {
  const button = document.createElement("button");
  button.className = "skill-card";
  button.type = "button";
  button.dataset.skillMode = skill.mode;
  button.dataset.skillName = skill.name;
  button.dataset.skillPrompt = skill.prompt;
  button.dataset.skillCategory = skill.category;
  const fallbackCover = {
    commercial: "commercial-product",
    portrait: "editorial-portrait",
    character: "character-sheet",
    design: "watercolor-poster",
    scene: "interior-design",
    edit: "local-redraw",
  }[skill.category];
  const image = document.createElement("img");
  image.className = "skill-cover";
  image.src = `/static/showcase/v167/skills/${AVAILABLE_SKILL_COVERS.has(skill.image) ? skill.image : fallbackCover}.webp`;
  image.alt = `${skill.name}技能示例`;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    if (fallbackCover && image.dataset.fallbackApplied !== "1") {
      image.dataset.fallbackApplied = "1";
      image.src = `/static/showcase/v167/skills/${fallbackCover}.webp`;
      return;
    }
    image.remove();
    button.classList.add("cover-fallback");
  });
  const number = document.createElement("span");
  number.textContent = String(index + 1).padStart(2, "0");
  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = skill.icon;
  const copy = document.createElement("div");
  const title = document.createElement("b");
  title.textContent = skill.name;
  const note = document.createElement("small");
  note.textContent = skill.note;
  copy.append(title, note);
  const action = document.createElement("em");
  action.textContent = "使用技能 ↗";
  button.append(image, number, icon, copy, action);
  return button;
}

function renderSkillCatalog(category = "all") {
  if (!skillGrid) return;
  const visibleSkills = category === "all" ? SKILL_CATALOG : SKILL_CATALOG.filter((skill) => skill.category === category);
  skillGrid.replaceChildren(...visibleSkills.map(createSkillCard));
}

renderSkillCatalog();
document.querySelectorAll("[data-skill-filter]").forEach((filterButton) => filterButton.addEventListener("click", () => {
  document.querySelectorAll("[data-skill-filter]").forEach((button) => button.classList.toggle("active", button === filterButton));
  renderSkillCatalog(filterButton.dataset.skillFilter);
}));

skillGrid?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const card = event.target.closest("[data-skill-mode]");
  if (!(card instanceof HTMLButtonElement)) return;
  setSelectorContext("tool-zone");
  setMode(card.dataset.skillMode, "", card.dataset.skillName || "");
  const suggestedPrompt = card.dataset.skillPrompt;
  if (suggestedPrompt) {
    promptInput.value = suggestedPrompt;
    updatePromptMeta();
  }
  document.querySelector("#generation-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => promptInput.focus(), 320);
});

const discoveryTabs = [...document.querySelectorAll("[data-discovery-tab]")];
const discoverySearchWrap = document.querySelector("#discovery-search-wrap");

function renderModelGuide(items, runtimeModels, tools) {
  if (!modelGuideGrid) return;
  const fragment = document.createDocumentFragment();
  items.forEach((model) => {
    const runtime = runtimeModels[model.id] || {};
    const toolAvailable = model.tool_only && Boolean(tools.redraw || tools.multiangle || tools.multiview || tools.panorama);
    const available = Boolean(runtime.available || toolAvailable);
    const article = document.createElement("article");
    article.className = `model-guide-card${available ? " is-available" : ""}`;
    article.dataset.family = model.family || "其他";
    const icon = MODEL_ICON_PATHS[model.id];
    const bestFor = Array.isArray(model.best_for) ? model.best_for : [];
    const strengths = Array.isArray(model.strengths) ? model.strengths : [];
    const limitations = Array.isArray(model.limitations) ? model.limitations : [];
    article.innerHTML = `
      <header><img src="${escapeMarkup(icon)}" alt="" /><div><span>${escapeMarkup(model.family || "图像模型")}</span><h4>${escapeMarkup(model.name || model.id)}</h4></div><em>${available ? "当前可用" : "暂未启用"}</em></header>
      <div class="model-guide-badges"><span class="model-status-tags">${modelStatusTagsMarkup(model.id)}</span>${modelBadgesMarkup(model.badges || [], 5)}${modelFavoriteMarkup(model.id, { interactive:false })}</div>
      <p class="model-guide-tagline">${escapeMarkup(model.tagline || "等待补充模型说明")}</p>
      <dl><div><dt>速度</dt><dd>${escapeMarkup(model.speed || "—")}</dd></div><div><dt>最大输出</dt><dd>${escapeMarkup(model.max_resolution || "—")}</dd></div><div><dt>消耗</dt><dd>${escapeMarkup(model.credit_note || "—")}</dd></div></dl>
      <section><b>适合</b><p>${bestFor.map(escapeMarkup).join(" · ") || "通用图像创作"}</p></section>
      <details><summary>优势与限制</summary><div><strong>优势</strong><ul>${strengths.map((text) => `<li>${escapeMarkup(text)}</li>`).join("")}</ul><strong>注意</strong><ul>${limitations.map((text) => `<li>${escapeMarkup(text)}</li>`).join("")}</ul></div></details>`;
    fragment.append(article);
  });
  modelGuideGrid.replaceChildren(fragment);
}

function showDiscovery(name, shouldScroll = false) {
  const next = ["skills", "plaza", "workflows", "models"].includes(name) ? name : "skills";
  discoveryTabs.forEach((tab) => {
    const selected = tab.dataset.discoveryTab === next;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  document.querySelectorAll("[data-discovery-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.discoveryPanel !== next;
  });
  if (discoverySearchWrap) discoverySearchWrap.hidden = !["plaza", "workflows"].includes(next);
  if (discoverySearch) {
    discoverySearch.value = "";
    discoverySearch.placeholder = next === "workflows" ? "搜索名称、作者、标签或用途" : "搜索风格、场景或作品";
  }
  if (next === "workflows") loadWorkflowDiscovery();
  else if (next === "plaza") loadCommunityPlaza();
  if (shouldScroll) document.querySelector("#studio-discovery")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

discoveryTabs.forEach((tab) => tab.addEventListener("click", () => showDiscovery(tab.dataset.discoveryTab)));
document.querySelectorAll("[data-open-discovery]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  setWorkspaceView("quick");
  showDiscovery(link.dataset.openDiscovery, true);
}));

const discoverySearch = document.querySelector("#discovery-search");
const plazaSearchStatus = document.querySelector("#plaza-search-status");
const plazaTagBar = document.querySelector("#plaza-tag-bar");
const PLAZA_INTEREST_STORAGE_KEY = "huiju.plaza.interests.v1";
const PLAZA_TAG_SUGGESTIONS = ["推荐", "人像", "商业", "建筑", "东方", "电影", "室内", "霓虹", "超现实"];
const PLAZA_QUERY_EXPANSIONS = {
  国风: ["东方", "新中式"], 古风: ["东方", "新中式"], 写真: ["人像", "摄影"], 美女: ["人像", "女性"],
  产品: ["商业", "静物"], 广告: ["商业", "产品"], 家装: ["室内", "家居"], 房间: ["室内", "空间"],
  赛博朋克: ["未来", "霓虹", "城市"], 科技: ["未来", "科幻"], 风景: ["自然", "海洋"], 梦幻: ["超现实", "幻想"],
  夜景: ["夜", "霓虹", "城市"], 二次元: ["幻想", "角色"], 电影感: ["电影", "胶片"], 极简主义: ["极简", "建筑"],
};

function normalizePlazaText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[，。；：、/|·_\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function plazaTags(card) {
  return normalizePlazaText(card?.dataset.galleryTags).split(" ").filter(Boolean);
}

function plazaCardFields(card) {
  return {
    title: normalizePlazaText(card.dataset.plazaTitle),
    tags: plazaTags(card),
    subtitle: normalizePlazaText(card.dataset.plazaSubtitle),
    author: normalizePlazaText(card.dataset.plazaUser),
    prompt: normalizePlazaText(card.dataset.plazaPrompt),
    model: normalizePlazaText(card.dataset.plazaModel),
  };
}

function plazaQueryTerms(query, cards) {
  const normalized = normalizePlazaText(query);
  if (!normalized) return [];
  const knownTags = new Set(cards.flatMap(plazaTags));
  const terms = new Set(normalized.split(" ").filter(Boolean));
  knownTags.forEach((tag) => { if (normalized.includes(tag)) terms.add(tag); });
  Object.entries(PLAZA_QUERY_EXPANSIONS).forEach(([source, expansions]) => {
    if (normalized.includes(source)) expansions.forEach((term) => terms.add(term));
  });
  const compact = normalized.replace(/\s/g, "");
  if (/^[\u3400-\u9fff]{3,}$/.test(compact)) {
    for (let index = 0; index < compact.length - 1; index += 1) {
      const gram = compact.slice(index, index + 2);
      if (!new Set(["一个", "一种", "这个", "图片", "画面"]).has(gram)) terms.add(gram);
    }
  }
  return [...terms].filter((term) => term.length > 0);
}

function plazaSearchScore(card, query, terms) {
  const fields = plazaCardFields(card);
  const normalizedQuery = normalizePlazaText(query);
  let score = 0;
  if (fields.title === normalizedQuery) score += 60;
  if (fields.title.includes(normalizedQuery)) score += 24;
  if (fields.tags.includes(normalizedQuery)) score += 22;
  if (fields.prompt.includes(normalizedQuery)) score += 10;
  if (fields.model.includes(normalizedQuery)) score += 10;
  terms.forEach((term) => {
    if (fields.title.includes(term)) score += 12;
    if (fields.tags.some((tag) => tag === term)) score += 10;
    else if (fields.tags.some((tag) => tag.includes(term) || term.includes(tag))) score += 6;
    if (fields.subtitle.includes(term)) score += 5;
    if (fields.author.includes(term)) score += 4;
    if (fields.prompt.includes(term)) score += 2;
    if (fields.model.includes(term)) score += 4;
  });
  return score;
}

function loadPlazaInterests() {
  try {
    const value = JSON.parse(window.localStorage.getItem(PLAZA_INTEREST_STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch { return {}; }
}

function recordPlazaInterest(card, strength = 1) {
  if (!card) return;
  const interests = loadPlazaInterests();
  Object.keys(interests).forEach((tag) => { interests[tag] = Math.max(0, Number(interests[tag] || 0) * .985); });
  plazaTags(card).forEach((tag) => { interests[tag] = Math.min(20, Number(interests[tag] || 0) + strength); });
  try { window.localStorage.setItem(PLAZA_INTEREST_STORAGE_KEY, JSON.stringify(interests)); } catch { /* Recommendations remain non-personalized. */ }
}

function plazaTagSimilarity(left, right) {
  const a = new Set(plazaTags(left));
  const b = new Set(plazaTags(right));
  const union = new Set([...a, ...b]).size || 1;
  return [...a].filter((tag) => b.has(tag)).length / union;
}

function recommendedPlazaOrder(cards) {
  const interests = loadPlazaInterests();
  const relevance = new Map(cards.map((card, index) => {
    const affinity = plazaTags(card).reduce((sum, tag) => sum + Number(interests[tag] || 0), 0);
    const popularity = Math.log1p(Number(card.dataset.plazaLikes || 0));
    const explorationSeed = (cards.length - index) / Math.max(cards.length, 1);
    return [card, affinity * 1.8 + popularity + explorationSeed * .35];
  }));
  const pending = [...cards];
  const selected = [];
  while (pending.length) {
    pending.sort((left, right) => {
      const leftDuplication = selected.length ? Math.max(...selected.map((item) => plazaTagSimilarity(left, item))) : 0;
      const rightDuplication = selected.length ? Math.max(...selected.map((item) => plazaTagSimilarity(right, item))) : 0;
      return (relevance.get(right) - rightDuplication * 2.4) - (relevance.get(left) - leftDuplication * 2.4);
    });
    selected.push(pending.shift());
  }
  return selected;
}

function renderPlazaSearch() {
  const grid = document.querySelector(".plaza-preview-grid");
  if (!grid) return;
  const cards = [...grid.querySelectorAll(".plaza-preview-card")];
  const query = discoverySearch?.value.trim() || "";
  const terms = plazaQueryTerms(query, cards);
  const scored = cards.map((card) => ({ card, score: query ? plazaSearchScore(card, query, terms) : 0 }));
  const visible = query
    ? scored.filter((item) => item.score > 0).sort((left, right) => right.score - left.score || Number(right.card.dataset.plazaLikes || 0) - Number(left.card.dataset.plazaLikes || 0)).map((item) => item.card)
    : recommendedPlazaOrder(cards);
  const visibleSet = new Set(visible);
  cards.forEach((card) => { card.hidden = !visibleSet.has(card); });
  grid.append(...visible, ...cards.filter((card) => !visibleSet.has(card)));
  const empty = document.querySelector("#gallery-empty");
  if (empty) empty.hidden = visible.length !== 0;
  if (plazaSearchStatus) plazaSearchStatus.textContent = query ? `找到 ${visible.length} 件与“${query}”相关的作品` : Object.keys(loadPlazaInterests()).length ? "根据你查看和点赞的作品进行推荐，并自动保持风格多样" : "综合热度与风格多样性推荐";
  plazaTagBar?.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.plazaQuery === (query || "推荐")));
}

if (plazaTagBar) {
  plazaTagBar.replaceChildren(...PLAZA_TAG_SUGGESTIONS.map((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.plazaQuery = tag;
    button.textContent = tag;
    button.classList.toggle("active", tag === "推荐");
    return button;
  }));
  plazaTagBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-plaza-query]");
    if (!(button instanceof HTMLButtonElement) || !discoverySearch) return;
    discoverySearch.value = button.dataset.plazaQuery === "推荐" ? "" : button.dataset.plazaQuery;
    renderPlazaSearch();
  });
}
let workflowDiscoverySearchTimer = 0;
discoverySearch?.addEventListener("input", () => {
  const active = discoveryTabs.find((tab) => tab.classList.contains("active"))?.dataset.discoveryTab;
  if (active === "workflows") {
    window.clearTimeout(workflowDiscoverySearchTimer);
    workflowDiscoverySearchTimer = window.setTimeout(loadWorkflowDiscovery, 220);
  } else renderPlazaSearch();
});

const modelFamilyButtons = [...document.querySelectorAll("[data-model-family]")];
const modelFamilyPages = [...document.querySelectorAll("[data-model-family-page]")];
modelFamilyButtons.forEach((button) => button.addEventListener("click", () => {
  const family = button.dataset.modelFamily;
  modelFamilyButtons.forEach((item) => item.classList.toggle("active", item === button));
  modelFamilyPages.forEach((page) => { page.hidden = page.dataset.modelFamilyPage !== family; });
}));

const plazaDetailDialog = document.querySelector("#plaza-detail-dialog");
const plazaDetailClose = document.querySelector("#plaza-detail-close");
const plazaDetailImage = document.querySelector("#plaza-detail-image");
const plazaDetailVideo = document.querySelector("#plaza-detail-video");
const plazaDetailTitle = document.querySelector("#plaza-detail-title");
const plazaDetailUser = document.querySelector("#plaza-detail-user");
const plazaAuthorAvatar = document.querySelector("#plaza-author-avatar");
const plazaDetailPrompt = document.querySelector("#plaza-detail-prompt");
const plazaDetailPromptLabel = document.querySelector("#plaza-detail-prompt-label");
const plazaDetailModel = document.querySelector("#plaza-detail-model");
const plazaDetailTags = document.querySelector("#plaza-detail-tags");
const plazaDetailLikes = document.querySelector("#plaza-detail-likes");
const plazaDetailLike = document.querySelector("#plaza-detail-like");
const plazaDetailUse = document.querySelector("#plaza-detail-use");
const plazaPublishDialog = document.querySelector("#plaza-publish-dialog");
const plazaPublishName = document.querySelector("#plaza-publish-name");
const plazaPublishTags = document.querySelector("#plaza-publish-tags");
const plazaPublishStatus = document.querySelector("#plaza-publish-status");
const plazaPublishSubmit = document.querySelector("#plaza-publish-submit");
let activePlazaPrompt = "";
let activePlazaMode = "text";
let activePlazaLikeKey = "";
let activePlazaCard = null;
let activePlazaPostId = "";
let activePlazaPublishCandidate = null;

const plazaPreviewGrid = document.querySelector(".plaza-preview-grid");

function plazaSourcePath(value) {
  const path = safeSameOriginPath(value);
  return /^\/api\/v1\/private-media\/(?:history|asset|video)\/[a-f0-9]{32}$/.test(path || "") ? path : "";
}

function openPlazaPublishDialog(candidate) {
  const url = plazaSourcePath(candidate?.url);
  if (!url || !plazaPublishDialog) return;
  activePlazaPublishCandidate = { ...candidate, url };
  plazaPublishName.value = String(candidate.title || "我的作品").slice(0, 40);
  plazaPublishTags.value = "";
  plazaPublishStatus.textContent = "";
  if (!plazaPublishDialog.open) plazaPublishDialog.showModal();
  plazaPublishName.focus();
}

async function publishPlazaPost() {
  if (!activePlazaPublishCandidate) return;
  const title = plazaPublishName.value.trim();
  if (!title) return;
  const tags = plazaPublishTags.value.split(/[，,、\s]+/).map((tag) => tag.replace(/^[#＃]+/, "").trim()).filter(Boolean);
  plazaPublishSubmit.disabled = true;
  plazaPublishStatus.textContent = "正在发布…";
  try {
    await fetchJson(API.plaza, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        title, url:activePlazaPublishCandidate.url, prompt:String(activePlazaPublishCandidate.prompt || ""),
        model:String(activePlazaPublishCandidate.model || "绘域"), tags,
      }),
    }, 15000);
    plazaPublishStatus.textContent = "已发布到共绘广场。";
    await loadCommunityPlaza();
    window.setTimeout(() => plazaPublishDialog.close(), 420);
  } catch {
    plazaPublishStatus.textContent = "发布失败，请稍后重试。";
  } finally { plazaPublishSubmit.disabled = false; }
}

function createCommunityPlazaCard(post) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `plaza-preview-card ${post.media_type === "video" ? "plaza-ratio-16-9 is-video" : "plaza-ratio-4-3"} is-community`;
  card.dataset.plazaPostId = post.id;
  card.dataset.plazaMedia = post.media_type;
  card.dataset.plazaTitle = post.title;
  card.dataset.plazaModel = post.model;
  card.dataset.galleryTags = (post.tags || []).join(" ");
  card.dataset.plazaUser = post.author;
  card.dataset.plazaLikes = String(post.likes_count || 0);
  card.dataset.plazaPrompt = post.prompt || "";
  card.dataset.plazaLiked = String(Boolean(post.liked_by_viewer));
  card.setAttribute("aria-label", `${post.title}，作者 ${post.author}`);
  const media = document.createElement(post.media_type === "video" ? "video" : "img");
  media.src = post.url;
  media.loading = "lazy";
  if (media instanceof HTMLVideoElement) {
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.preload = "metadata";
    card.addEventListener("pointerenter", () => media.play());
    card.addEventListener("pointerleave", () => { media.pause(); media.currentTime = 0; });
  } else {
    media.alt = post.title;
  }
  const meta = document.createElement("span");
  meta.className = "plaza-card-meta";
  const author = document.createElement("small");
  author.className = "plaza-card-author";
  author.textContent = post.author;
  const likes = document.createElement("small");
  likes.className = "plaza-card-likes";
  likes.textContent = String(post.likes_count || 0);
  meta.append(author, likes);
  const model = document.createElement("small");
  model.className = "plaza-card-model";
  model.textContent = post.model;
  card.append(media, meta, model);
  return card;
}

async function loadCommunityPlaza() {
  if (!plazaPreviewGrid) return;
  try {
    const { body } = await fetchJson(`${API.plaza}?limit=24`, { method:"GET" }, 7000);
    plazaPreviewGrid.querySelectorAll(".is-community").forEach((card) => card.remove());
    const posts = Array.isArray(body.items) ? body.items : [];
    plazaPreviewGrid.prepend(...posts.map(createCommunityPlazaCard));
    renderPlazaSearch();
  } catch {
    renderPlazaSearch();
  }
}

if (plazaPreviewGrid) {
  const ratioClasses = ["plaza-ratio-4-3", "plaza-ratio-3-4", "plaza-ratio-16-9", "plaza-ratio-9-16"];
  const buckets = new Map(ratioClasses.map((ratioClass) => [ratioClass, []]));
  [...plazaPreviewGrid.querySelectorAll(".plaza-preview-card")].forEach((card) => {
    const title = card.querySelector("b")?.textContent?.trim() || "共绘作品";
    const subtitle = card.querySelector(":scope > span small")?.textContent?.trim() || "";
    const user = card.dataset.plazaUser || "神秘画家";
    const baseLikes = Number(card.dataset.plazaLikes || 0);
    const likeKey = `huiju.plaza.like.${title}`;
    const liked = (() => { try { return window.localStorage.getItem(likeKey) === "1"; } catch { return false; } })();
    card.dataset.plazaTitle = title;
    card.dataset.plazaSubtitle = subtitle;
    card.setAttribute("aria-label", `${title}，作者 ${user}，${baseLikes + (liked ? 1 : 0)} 次点赞`);
    const meta = card.querySelector(":scope > span");
    if (meta) {
      meta.className = "plaza-card-meta";
      meta.innerHTML = '<small class="plaza-card-author"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25"></circle><path d="M5.8 19c.7-4 2.8-6 6.2-6s5.5 2 6.2 6"></path></svg><span></span></small><small class="plaza-card-likes"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 9.5c0 4.7-8.5 9-8.5 9s-8.5-4.3-8.5-9a4.5 4.5 0 0 1 8.5-2.3 4.5 4.5 0 0 1 8.5 2.3Z"></path></svg><span></span></small>';
      meta.querySelector(".plaza-card-author span").textContent = user;
      meta.querySelector(".plaza-card-likes span").textContent = String(baseLikes + (liked ? 1 : 0));
    }
    const modelBadge = document.createElement("small");
    modelBadge.className = "plaza-card-model";
    modelBadge.textContent = card.dataset.plazaModel;
    card.append(modelBadge);
    const video = card.querySelector("video");
    if (video) {
      card.classList.add("is-video");
      const playPreview = () => video.play();
      const resetPreview = () => { video.pause(); video.currentTime = 0; };
      card.addEventListener("pointerenter", playPreview);
      card.addEventListener("pointerleave", resetPreview);
      card.addEventListener("focusin", playPreview);
      card.addEventListener("focusout", resetPreview);
    }
    const ratioClass = ratioClasses.find((name) => card.classList.contains(name));
    if (ratioClass) buckets.get(ratioClass).push(card);
  });
  const shuffledCards = [];
  let previousRatio = "";
  while ([...buckets.values()].some((cards) => cards.length)) {
    const availableRatios = ratioClasses.filter((ratioClass) => buckets.get(ratioClass).length && ratioClass !== previousRatio);
    const candidates = availableRatios.length ? availableRatios : ratioClasses.filter((ratioClass) => buckets.get(ratioClass).length);
    const ratioClass = candidates[Math.floor(Math.random() * candidates.length)];
    const cards = buckets.get(ratioClass);
    const cardIndex = Math.floor(Math.random() * cards.length);
    shuffledCards.push(cards.splice(cardIndex, 1)[0]);
    previousRatio = ratioClass;
  }
  plazaPreviewGrid.append(...shuffledCards);
  renderPlazaSearch();
}

plazaPreviewGrid?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const card = event.target.closest(".plaza-preview-card");
  if (!(card instanceof HTMLButtonElement) || !plazaDetailDialog) return;
  const sourceMedia = card.querySelector("img, video");
  const mediaType = card.dataset.plazaMedia;
  const title = card.dataset.plazaTitle;
  const user = card.dataset.plazaUser || "神秘画家";
  activePlazaCard = card;
  activePlazaPostId = card.dataset.plazaPostId || "";
  recordPlazaInterest(card, 1);
  activePlazaPrompt = card.dataset.plazaPrompt || "";
  activePlazaMode = mediaType === "video" ? "video_text" : "text";
  activePlazaLikeKey = `huiju.plaza.like.${title}`;
  const liked = activePlazaPostId ? card.dataset.plazaLiked === "true" : (() => { try { return window.localStorage.getItem(activePlazaLikeKey) === "1"; } catch { return false; } })();
  if (plazaDetailImage) {
    plazaDetailImage.hidden = mediaType === "video";
    if (mediaType === "image") { plazaDetailImage.src = sourceMedia.currentSrc || sourceMedia.src; plazaDetailImage.alt = sourceMedia.alt; }
  }
  if (plazaDetailVideo) {
    plazaDetailVideo.hidden = mediaType === "image";
    if (mediaType === "video") { plazaDetailVideo.src = sourceMedia.currentSrc || sourceMedia.src; plazaDetailVideo.poster = sourceMedia.poster; }
    plazaDetailVideo.parentElement.classList.toggle("is-video", mediaType === "video");
  }
  if (plazaDetailTitle) plazaDetailTitle.textContent = title;
  if (plazaDetailUser) plazaDetailUser.textContent = user;
  if (plazaAuthorAvatar) plazaAuthorAvatar.textContent = user.slice(0, 1);
  if (plazaDetailPrompt) plazaDetailPrompt.textContent = activePlazaPrompt;
  if (plazaDetailPromptLabel) plazaDetailPromptLabel.textContent = mediaType === "video" ? "视频提示词" : "创作提示词";
  if (plazaDetailModel) plazaDetailModel.textContent = card.dataset.plazaModel;
  if (plazaDetailTags) {
    plazaDetailTags.replaceChildren(...plazaTags(card).map((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `# ${tag}`;
      button.addEventListener("click", () => {
        if (discoverySearch) discoverySearch.value = tag;
        plazaDetailDialog.close();
        showDiscovery("plaza", true);
        renderPlazaSearch();
      });
      return button;
    }));
  }
  if (plazaDetailLikes) plazaDetailLikes.textContent = String(Number(card.dataset.plazaLikes || 0) + (activePlazaPostId ? 0 : liked ? 1 : 0));
  plazaDetailLike?.setAttribute("aria-pressed", String(liked));
  if (plazaDetailLike?.firstElementChild) plazaDetailLike.firstElementChild.textContent = liked ? "♥" : "♡";
  plazaDetailDialog.showModal();
});
plazaDetailClose?.addEventListener("click", () => plazaDetailDialog?.close());
plazaDetailDialog?.addEventListener("click", (event) => { if (event.target === plazaDetailDialog) plazaDetailDialog.close(); });
plazaDetailDialog?.addEventListener("close", () => { plazaDetailVideo?.pause(); });
plazaPublishDialog?.addEventListener("click", (event) => { if (event.target === plazaPublishDialog) plazaPublishDialog.close(); });
document.querySelector("#plaza-publish-close")?.addEventListener("click", () => plazaPublishDialog?.close());
plazaPublishSubmit?.addEventListener("click", publishPlazaPost);
document.querySelector("#plaza-open-history")?.addEventListener("click", () => {
  setWorkspaceView("quick");
  openHistoryPanel();
});
plazaDetailLike?.addEventListener("click", async () => {
  const next = plazaDetailLike.getAttribute("aria-pressed") !== "true";
  if (activePlazaPostId) {
    const { body } = await fetchJson(`${API.plaza}/${encodeURIComponent(activePlazaPostId)}/like`, { method:"POST" }, 6000);
    plazaDetailLike.setAttribute("aria-pressed", String(body.liked));
    if (plazaDetailLike.firstElementChild) plazaDetailLike.firstElementChild.textContent = body.liked ? "♥" : "♡";
    if (plazaDetailLikes) plazaDetailLikes.textContent = String(body.likes_count);
    activePlazaCard.dataset.plazaLikes = String(body.likes_count);
    activePlazaCard.dataset.plazaLiked = String(body.liked);
    const cardLikes = activePlazaCard?.querySelector(".plaza-card-likes");
    if (cardLikes) cardLikes.textContent = String(body.likes_count);
    return;
  }
  plazaDetailLike.setAttribute("aria-pressed", String(next));
  if (plazaDetailLike.firstElementChild) plazaDetailLike.firstElementChild.textContent = next ? "♥" : "♡";
  if (plazaDetailLikes) plazaDetailLikes.textContent = String(Math.max(0, Number(plazaDetailLikes.textContent || 0) + (next ? 1 : -1)));
  const cardLikes = activePlazaCard?.querySelector(".plaza-card-likes span");
  if (cardLikes && plazaDetailLikes) cardLikes.textContent = plazaDetailLikes.textContent;
  if (next) recordPlazaInterest(activePlazaCard, 2);
  try { window.localStorage.setItem(activePlazaLikeKey, next ? "1" : "0"); } catch { /* The detail remains usable without persistence. */ }
});
plazaDetailUse?.addEventListener("click", () => {
  if (!activePlazaPrompt) return;
  recordPlazaInterest(activePlazaCard, 2.5);
  setWorkspaceView("quick");
  setMode(activePlazaMode);
  promptInput.value = activePlazaPrompt;
  updatePromptMeta();
  plazaDetailDialog?.close();
  document.querySelector("#generation-form")?.scrollIntoView({ behavior:"smooth", block:"center" });
  window.setTimeout(() => promptInput.focus(), 320);
});

showDiscovery(requestedDiscovery === "workflows" ? "skills" : (requestedDiscovery || "skills"));

/* v44: scene-first workflow canvas. It composes the existing, audited generation form
   instead of creating a second API path, so queuing, Credits and history stay consistent. */
const quickWorkspace = document.querySelector("#quick-workspace");
const discoveryWorkspace = document.querySelector("#studio-discovery");
const workflowWorkspace = document.querySelector("#workflow-workspace");
const workspaceButtons = [...document.querySelectorAll("[data-workspace-view]")];
const workflowCanvasShell = document.querySelector("#workflow-canvas-shell");
const workflowViewport = document.querySelector("#workflow-viewport");
const workflowBoard = document.querySelector("#workflow-board");
const workflowLines = document.querySelector("#workflow-lines");
const workflowPrompt = document.querySelector("#workflow-prompt");
const workflowStyle = document.querySelector("#workflow-style");
const workflowRatio = document.querySelector("#workflow-ratio");
const workflowResolution = document.querySelector("#workflow-resolution");
const workflowZoomValue = document.querySelector("#workflow-zoom-value");
const workflowOutputSummary = document.querySelector("#workflow-output-summary");
const scenarioList = document.querySelector("#scenario-list");
const scenarioCount = document.querySelector("#scenario-count");
const workflowSceneCover = document.querySelector("#workflow-scene-cover");
const workflowSceneName = document.querySelector("#workflow-scene-name");
const workflowSceneNote = document.querySelector("#workflow-scene-note");
const mobileWorkspaceToggle = document.querySelector("#mobile-workspace-toggle");
let restoreSidebarAfterWorkflow = null;

const SCENE_WORKFLOWS = Object.freeze([
  { name:"商业产品主图", note:"干净棚拍 · 准确材质", category:"commercial", preset:"product-studio", cover:"commercial-product" },
  { name:"白底电商图", note:"完整轮廓 · 柔和接触影", category:"commercial", preset:"product-white", cover:"commercial-product" },
  { name:"电商活动主视觉", note:"动势构图 · 预留排版区", category:"commercial", preset:"product-poster", cover:"ecommerce-poster" },
  { name:"美妆护肤广告", note:"通透高光 · 精致陈列", category:"commercial", preset:"product-cosmetic", cover:"commercial-product" },
  { name:"科技产品发布", note:"结构清晰 · 冷色轮廓光", category:"commercial", preset:"product-tech", cover:"ecommerce-poster" },
  { name:"珠宝微距视觉", note:"奢华高光 · 微观材质", category:"commercial", preset:"trend-clean-brand", cover:"commercial-product" },
  { name:"甜点广告摄影", note:"切面细节 · 食欲光线", category:"commercial", preset:"food-dessert", cover:"commercial-product" },
  { name:"中式美食摄影", note:"热气油亮 · 暖色侧逆光", category:"commercial", preset:"food-chinese", cover:"commercial-product" },
  { name:"饮品海报", note:"透明液体 · 冰块水珠", category:"commercial", preset:"food-drink", cover:"ecommerce-poster" },
  { name:"现代室内设计", note:"空间动线 · 自然天光", category:"architecture", preset:"architecture-interior", cover:"interior-design" },
  { name:"建筑外观可视化", note:"尺度可信 · 垂直线端正", category:"architecture", preset:"architecture-exterior", cover:"interior-design" },
  { name:"中式庭院", note:"白墙黛瓦 · 竹影水景", category:"architecture", preset:"architecture-courtyard", cover:"interior-design" },
  { name:"城市夜景", note:"雨后反射 · 真实街道层次", category:"architecture", preset:"landscape-city", cover:"interior-design" },
  { name:"自然山野", note:"前中远景 · 清晨薄雾", category:"architecture", preset:"landscape-nature", cover:"interior-design" },
  { name:"沉浸空间概念", note:"连续环境 · 宽幅叙事", category:"architecture", preset:"scifi-city", cover:"interior-design" },
  { name:"情绪肖像", note:"眼神中心 · 真实肤质", category:"portrait", preset:"portrait-emotion", cover:"editorial-portrait" },
  { name:"时尚杂志大片", note:"造型姿态 · 封面留白", category:"portrait", preset:"portrait-fashion", cover:"editorial-portrait" },
  { name:"复古胶片人像", note:"旧城抓拍 · 35mm 颗粒", category:"portrait", preset:"portrait-film", cover:"editorial-portrait" },
  { name:"城市街拍", note:"自然动作 · 环境层次", category:"portrait", preset:"portrait-street", cover:"editorial-portrait" },
  { name:"双人故事", note:"关系距离 · 日落逆光", category:"portrait", preset:"portrait-couple", cover:"editorial-portrait" },
  { name:"梦核随拍", note:"前置视角 · 低像素噪点", category:"portrait", preset:"trend-dreamy-snapshot", cover:"editorial-portrait" },
  { name:"角色三视图", note:"身份一致 · 结构完整", category:"character", preset:"character-sheet", cover:"character-sheet" },
  { name:"表情与配饰表", note:"同一角色 · 细节拆解", category:"character", preset:"character-expression", cover:"character-sheet" },
  { name:"Q 版角色", note:"圆润比例 · 赛璐璐上色", category:"character", preset:"illustration-chibi", cover:"character-sheet" },
  { name:"像素游戏角色", note:"统一网格 · 复古像素", category:"character", preset:"illustration-pixel", cover:"character-sheet" },
  { name:"机甲设定", note:"关节可信 · 低机位全身", category:"character", preset:"scifi-mech", cover:"character-sheet" },
  { name:"电影分镜", note:"景别连续 · 动作可读", category:"character", preset:"drama-middle", cover:"character-sheet" },
  { name:"现代扁平插画", note:"清晰几何 · 有限色板", category:"design", preset:"illustration-flat", cover:"watercolor-poster" },
  { name:"国潮海报", note:"东方纹样 · 现代版式", category:"design", preset:"illustration-guochao", cover:"watercolor-poster" },
  { name:"艺术海报", note:"大胆构图 · 密度对比", category:"design", preset:"illustration-poster", cover:"watercolor-poster" },
  { name:"儿童绘本", note:"动作易懂 · 手绘纸感", category:"design", preset:"illustration-child", cover:"watercolor-poster" },
  { name:"半调印刷", note:"专色对比 · 网点肌理", category:"design", preset:"trend-halftone-poster", cover:"watercolor-poster" },
  { name:"手作拼贴", note:"撕纸织物 · 层叠阴影", category:"design", preset:"trend-handmade-collage", cover:"watercolor-poster" },
  { name:"耀变抽象", note:"虹彩反射 · 空灵轮廓", category:"design", preset:"trend-iridescent-abstract", cover:"watercolor-poster" },
  { name:"微缩世界", note:"移轴微距 · 手工模型", category:"design", preset:"trend-miniature-diorama", cover:"watercolor-poster" },
]);

const frozenAnimations = new WeakMap();
function freezeTransform(element, transform) {
  if (!element?.animate) return;
  let animation = frozenAnimations.get(element);
  if (!animation) {
    animation = element.animate([{ transform }, { transform }], { duration: 1000, fill: "both" });
    animation.pause();
    frozenAnimations.set(element, animation);
  } else {
    animation.effect.setKeyframes([{ transform }, { transform }]);
  }
  animation.currentTime = 500;
}

const workflowState = { zoom: .82, panX: 34, panY: 34 };
function applyWorkflowTransform() {
  if (!workflowBoard) return;
  freezeTransform(workflowBoard, `translate(${workflowState.panX}px, ${workflowState.panY}px) scale(${workflowState.zoom})`);
  if (workflowViewport) {
    workflowViewport.style.setProperty("--canvas-grid-size", `${24 * workflowState.zoom}px`);
    workflowViewport.style.setProperty("--canvas-pan-x", `${workflowState.panX}px`);
    workflowViewport.style.setProperty("--canvas-pan-y", `${workflowState.panY}px`);
  }
  if (workflowZoomValue) workflowZoomValue.textContent = `${Math.round(workflowState.zoom * 100)}%`;
  if (activeWorkflowEditorNode) positionWorkflowNodeEditor(activeWorkflowEditorNode);
}

function positionWorkflowNode(node) {
  const x = Number(node.dataset.x || 0);
  const y = Number(node.dataset.y || 0);
  freezeTransform(node, `translate(${x}px, ${y}px)`);
}

function updateWorkflowLines() {
  if (!workflowLines) return;
  const pairs = {
    "scene-prompt": ["scene", "prompt"],
    "prompt-style": ["prompt", "style"],
    "style-output": ["style", "output"],
  };
  Object.entries(pairs).forEach(([id, names]) => {
    const from = document.querySelector(`[data-workflow-node="${names[0]}"]`);
    const to = document.querySelector(`[data-workflow-node="${names[1]}"]`);
    const path = workflowLines.querySelector(`[data-link="${id}"]`);
    if (!from || !to || !path) return;
    const x1 = Number(from.dataset.x) + from.offsetWidth;
    const y1 = Number(from.dataset.y) + from.offsetHeight / 2;
    const x2 = Number(to.dataset.x);
    const y2 = Number(to.dataset.y) + to.offsetHeight / 2;
    const bend = Math.max(70, Math.abs(x2 - x1) * .45);
    path.setAttribute("d", `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
  });
}

function renderWorkflowStyles() {
  if (!workflowStyle) return;
  workflowStyle.replaceChildren(...catalog.styles.map((style) => {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = style.label;
    return option;
  }));
  workflowStyle.value = selectedStyle;
}

function renderScenarios(category = "all") {
  if (!scenarioList) return;
  const items = category === "all" ? SCENE_WORKFLOWS : SCENE_WORKFLOWS.filter((item) => item.category === category);
  const cards = items.map((scene) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-card";
    button.dataset.scenePreset = scene.preset;
    const image = document.createElement("img");
    image.src = `/static/showcase/v167/skills/${scene.cover}.webp`;
    image.alt = `${scene.name}场景示例`;
    image.loading = "lazy";
    const copy = document.createElement("span");
    const title = document.createElement("b");
    title.textContent = scene.name;
    const note = document.createElement("small");
    note.textContent = scene.note;
    copy.append(title, note);
    button.append(image, copy);
    return button;
  });
  scenarioList.replaceChildren(...cards);
  if (scenarioCount) scenarioCount.textContent = String(items.length);
}

function selectWorkflowScenario(scene) {
  const preset = catalog.presets.find((item) => item.id === scene.preset);
  if (!preset) return;
  scenarioList?.querySelectorAll(".scenario-card").forEach((card) => card.classList.toggle("selected", card.dataset.scenePreset === scene.preset));
  const inlinePrompt = workflowPrompt || workflowBoard?.querySelector('[data-node-type="image_generator"] [data-node-field="prompt"], [data-node-type="video_generator"] [data-node-field="prompt"], [data-node-type="image_tool"] [data-node-field="prompt"]');
  if (inlinePrompt) inlinePrompt.value = preset.prompt;
  if (workflowStyle) workflowStyle.value = preset.style;
  if (workflowRatio) workflowRatio.value = [...workflowRatio.options].some((option) => option.value === preset.ratio) ? preset.ratio : "1:1";
  if (workflowSceneCover) {
    workflowSceneCover.src = `/static/showcase/v167/skills/${scene.cover}.webp`;
    workflowSceneCover.alt = `${scene.name}场景示例`;
  }
  if (workflowSceneName) workflowSceneName.textContent = scene.name;
  if (workflowSceneNote) workflowSceneNote.textContent = scene.note;
  updateWorkflowOutputSummary();
}

function updateWorkflowOutputSummary() {
  if (workflowOutputSummary) workflowOutputSummary.textContent = `重绘 → AI 超分至 ${workflowResolution?.value?.toUpperCase() || "2K"}`;
}

function setWorkspaceView(view) {
  if (view !== "quick") setHistoryDrawer(false);
  const workflow = view === "workflow";
  const capability = view === "capability";
  const assets = view === "assets";
  const wasWorkflow = document.body.classList.contains("workflow-active");
  const wasCapability = document.body.classList.contains("capability-tool-active");
  if (workflow && !wasWorkflow && window.innerWidth > 800) {
    restoreSidebarAfterWorkflow = document.body.classList.contains("sidebar-collapsed");
    setSidebarCollapsed(true);
  } else if (!workflow && wasWorkflow && restoreSidebarAfterWorkflow !== null) {
    setSidebarCollapsed(restoreSidebarAfterWorkflow);
    restoreSidebarAfterWorkflow = null;
  }
  document.body.classList.toggle("workflow-active", workflow);
  document.body.classList.toggle("capability-tool-active", capability);
  document.body.classList.toggle("asset-active", assets);
  if (quickWorkspace) quickWorkspace.hidden = workflow || capability || assets;
  if (discoveryWorkspace) discoveryWorkspace.hidden = workflow || capability || assets;
  if (workflowWorkspace) workflowWorkspace.hidden = !workflow;
  if (capabilityToolWorkspace) capabilityToolWorkspace.hidden = !capability;
  if (assetWorkspace) assetWorkspace.hidden = !assets;
  if (wasCapability && !capability) clearLocalToolImages();
  workspaceButtons.forEach((button) => {
    const active = !capability && !assets && button.dataset.workspaceView === (workflow ? "workflow" : "quick");
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
  if (mobileWorkspaceToggle) {
    mobileWorkspaceToggle.classList.toggle("active", workflow);
    mobileWorkspaceToggle.setAttribute("aria-pressed", String(workflow));
    mobileWorkspaceToggle.setAttribute("aria-label", workflow ? "返回快速创作" : "打开工作流幕布");
    mobileWorkspaceToggle.querySelector("span").textContent = workflow ? "⌂" : "⌘";
  }
  if (workflow) {
    modeEyebrow.replaceChildren();
    const indicator = document.createElement("span");
    indicator.setAttribute("aria-hidden", "true");
    modeEyebrow.append(indicator, " 工作流幕布");
    document.querySelector("#studio-title").textContent = "把复杂创意，铺在一块幕布上。";
    requestAnimationFrame(() => {
      applyWorkflowTransform();
      updateWorkflowLines();
      window.setTimeout(() => {
        if (document.body.classList.contains("workflow-active")) fitWorkflowCanvas();
      }, 320);
    });
  } else if (assets) {
    window.scrollTo({ top: 0, behavior: "instant" });
    modeEyebrow.replaceChildren();
    const indicator = document.createElement("span");
    indicator.setAttribute("aria-hidden", "true");
    modeEyebrow.append(indicator, " 个人资产");
    document.querySelector("#studio-title").textContent = "整理并复用你的视觉资产。";
  } else if (!capability) {
    const copy = MODE_COPY[activeMode];
    modeEyebrow.replaceChildren();
    const indicator = document.createElement("span");
    indicator.setAttribute("aria-hidden", "true");
    modeEyebrow.append(indicator, ` ${copy.eyebrow}`);
    document.querySelector("#studio-title").textContent = copy.title;
  }
  window.dispatchEvent(new CustomEvent("huiju:workspace-view", {
    detail: { view: workflow ? "workflow" : (capability ? "capability" : (assets ? "assets" : "main")) },
  }));
}

function fitWorkflowCanvas() {
  if (!workflowViewport) return;
  const nodes = [...(workflowBoard?.querySelectorAll("[data-node-id]") || [])];
  if (!nodes.length) return;
  const compactCanvas = workflowViewport.clientWidth <= 520;
  const margin = compactCanvas ? 24 : 64;
  const minX = Math.min(...nodes.map((node) => Number(node.dataset.x) || 0));
  const minY = Math.min(...nodes.map((node) => Number(node.dataset.y) || 0));
  const maxX = Math.max(...nodes.map((node) => (Number(node.dataset.x) || 0) + node.offsetWidth));
  const maxY = Math.max(...nodes.map((node) => (Number(node.dataset.y) || 0) + node.offsetHeight));
  const width = Math.max(320, maxX - minX);
  const height = Math.max(240, maxY - minY);
  const fittedZoom = Math.min(1.15, (workflowViewport.clientWidth - margin * 2) / width, (workflowViewport.clientHeight - margin * 2) / height);
  workflowState.zoom = Math.max(compactCanvas ? .32 : .18, fittedZoom);
  workflowState.panX = (workflowViewport.clientWidth - width * workflowState.zoom) / 2 - minX * workflowState.zoom;
  workflowState.panY = (workflowViewport.clientHeight - height * workflowState.zoom) / 2 - minY * workflowState.zoom;
  applyWorkflowTransform();
}

function workflowTopologicalOrder() {
  const nodes = [...(workflowBoard?.querySelectorAll("[data-node-id]") || [])];
  const byId = new Map(nodes.map((node) => [node.dataset.nodeId, node]));
  const indegree = new Map(nodes.map((node) => [node.dataset.nodeId, 0]));
  const adjacency = new Map(nodes.map((node) => [node.dataset.nodeId, []]));
  workflowEdges.forEach((edge) => {
    if (!byId.has(edge.from_node) || !byId.has(edge.to_node)) return;
    indegree.set(edge.to_node, (indegree.get(edge.to_node) || 0) + 1);
    adjacency.get(edge.from_node).push(edge.to_node);
  });
  const queue = nodes.filter((node) => indegree.get(node.dataset.nodeId) === 0);
  const ordered = [];
  while (queue.length) {
    const node = queue.shift();
    ordered.push(node);
    (adjacency.get(node.dataset.nodeId) || []).forEach((id) => {
      indegree.set(id, indegree.get(id) - 1);
      if (indegree.get(id) === 0) queue.push(byId.get(id));
    });
  }
  if (ordered.length !== nodes.length) throw new Error("workflow_cycle");
  return ordered;
}

function workflowIncomingValue(values, nodeId, portName) {
  const edge = workflowEdges.find((item) => item.to_node === nodeId && item.to_port === portName);
  return edge ? values.get(`${edge.from_node}:${edge.from_port}`) : undefined;
}

async function workflowImageBlob(value, signal) {
  if (value?.file instanceof File || value?.file instanceof Blob) return value.file;
  const image = Array.isArray(value?.images) ? value.images[0] : value;
  const candidate = image?.url || image?.src || value?.url || "";
  const url = safeGeneratedImageUrl(candidate) || safeImageUrl(candidate);
  if (!url) throw new Error("workflow_image_missing");
  const response = await fetch(url, { credentials:"same-origin", signal });
  if (!response.ok) throw new Error("workflow_image_fetch_failed");
  return response.blob();
}

async function uploadWorkflowImage(value, signal) {
  const blob = await workflowImageBlob(value, signal);
  const body = new FormData();
  body.append("image", blob, "workflow-input.png");
  const response = await fetchJson(API.upload, { method:"POST", signal, body }, 90000);
  if (!response.body.upload_id) throw new Error("upload_failed");
  return response.body.upload_id;
}

async function workflowMediaBlob(value, signal) {
  if (value?.file instanceof File || value?.file instanceof Blob) return value.file;
  const url = safeWorkflowMediaUrl(value?.url || "");
  if (!url) throw new Error("workflow_media_missing");
  const response = await fetch(url, { credentials:"same-origin", signal });
  if (!response.ok) throw new Error("workflow_media_fetch_failed");
  return response.blob();
}

async function uploadWorkflowReference(value, signal) {
  const blob = await workflowMediaBlob(value, signal);
  const extension = blob.type.startsWith("video/") ? (blob.type === "video/webm" ? "webm" : blob.type === "video/quicktime" ? "mov" : "mp4") : "png";
  return uploadReferenceMediaBlob(blob, `workflow-reference.${extension}`, signal);
}

async function uploadWorkflowMask(node, signal) {
  const state = workflowMaskStates.get(node);
  if (!state?.hasPaint) throw new Error("redraw_mask_required");
  const blob = await new Promise((resolve) => state.mask.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("mask_export_failed");
  const body = new FormData();
  body.append("mask", blob, "workflow-redraw-alpha-mask.png");
  const response = await fetchJson("/api/v1/images/masks", { method:"POST", signal, body }, 90000);
  if (!response.body.upload_id) throw new Error("mask_upload_failed");
  return response.body.upload_id;
}

async function resolveWorkflowJob(response, signal) {
  const queued = response.status === 202 || response.body.status === "queued";
  if (!queued) return response.body;
  const statusPath = safeSameOriginPath(response.body.status_url);
  if (statusPath) {
    activeJobStatusPath = statusPath;
    rememberPendingJob(statusPath);
  }
  return waitForJob(response.body.status_url, signal);
}

function setWorkflowOutputState(message, detail = "") {
  workflowBoard?.querySelectorAll("[data-workflow-output-preview]").forEach((preview) => {
    preview.classList.toggle("is-running", message.includes("运行"));
    const title = preview.querySelector("b");
    const note = preview.querySelector("small");
    if (title) title.textContent = message;
    if (note) note.textContent = detail;
  });
}

function renderWorkflowOutput(node, images, prompt) {
  const preview = node.querySelector("[data-workflow-output-preview]");
  const urls = (Array.isArray(images) ? images : []).map((item) => safeImageUrl(item?.url || item)).filter(Boolean).slice(0, 4);
  if (!preview || !urls.length) throw new Error("missing_images");
  const gallery = document.createElement("div");
  gallery.className = "workflow-output-gallery";
  urls.forEach((url, index) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `huiju-workflow-${Date.now()}-${index + 1}.${imageExtension(url)}`;
    const image = document.createElement("img");
    image.src = url;
    image.alt = `工作流输出 ${index + 1}`;
    link.append(image);
    gallery.append(link);
  });
  const note = document.createElement("small");
  note.textContent = `${urls.length} 张 · 点击下载`;
  preview.replaceChildren(gallery, note);
  preview.classList.remove("is-running");
  const saveControl = node.querySelector('[data-node-field="save_history"]');
  const saveMode = saveControl instanceof HTMLInputElement && saveControl.type === "checkbox"
    ? (saveControl.checked ? "auto" : "manual")
    : (saveControl?.value || "auto");
  if (saveMode === "auto") saveHistory(urls, Date.now(), prompt);
}

function renderWorkflowTextOutput(node, text) {
  const preview = node.querySelector("[data-workflow-output-preview]");
  if (!preview || !String(text || "").trim()) throw new Error("workflow_output_missing");
  const content = document.createElement("pre");
  content.className = "workflow-text-output";
  content.textContent = String(text).trim();
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "复制文字";
  copy.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(content.textContent || "");
    showWorkflowToast("已复制文字结果");
  });
  preview.replaceChildren(content, copy);
  preview.classList.remove("is-running");
}

function renderWorkflowMediaOutput(node, value, kind) {
  const preview = node.querySelector("[data-workflow-output-preview]");
  const mediaUrl = safeWorkflowMediaUrl(value?.url || value || "");
  if (!preview || !mediaUrl) throw new Error("workflow_output_missing");
  const media = document.createElement(kind);
  media.controls = true;
  media.preload = "metadata";
  media.src = mediaUrl;
  if (kind === "video") media.playsInline = true;
  media.addEventListener("pointerdown", (event) => event.stopPropagation());
  media.addEventListener("click", (event) => event.stopPropagation());
  media.addEventListener("error", () => showWorkflowToast(kind === "video" ? "视频预览失败，请检查编码格式" : "音频预览失败，请检查文件格式"));
  const download = document.createElement("a");
  download.href = mediaUrl;
  download.download = `huiju-workflow-${Date.now()}.${kind === "video" ? "mp4" : "wav"}`;
  download.textContent = kind === "video" ? "下载视频" : "下载音频";
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "加入资产";
  save.addEventListener("click", () => openAssetSaveDialog({
    url:mediaUrl, assetType:kind, mediaType:kind === "video" ? "video/mp4" : "audio/wav",
    suggestedName:kind === "video" ? "工作流视频" : "工作流音频", kind:"workflow",
  }));
  preview.replaceChildren(media, download, save);
  preview.classList.remove("is-running");
  media.load();
}

async function workflowBitmap(value, signal) {
  const blob = await workflowImageBlob(value, signal);
  return createImageBitmap(blob);
}

function workflowCanvasBlob(canvas, format = "png", quality = .92) {
  const mime = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("canvas_export_failed")), mime, quality));
}

async function runWorkflowClientImageTool(type, node, values, signal) {
  const config = workflowNodeConfig(node);
  const unifiedEditor = type === "image_editor";
  if (unifiedEditor) type = ({
    collage:"collage", resize:"resize_image", rotate:"rotate_image",
    crop:"crop_image", convert:"convert_image", watermark:"watermark_image",
  })[config.operation || config.tool] || "resize_image";
  const inputs = type === "collage"
    ? ["image1", "image2", "image3", "image4"].map((port) => workflowIncomingValue(values, node.dataset.nodeId, port)).filter(Boolean)
    : [workflowIncomingValue(values, node.dataset.nodeId, unifiedEditor ? "image1" : "image")].filter(Boolean);
  if (!inputs.length) throw new Error("workflow_image_missing");
  const bitmaps = [];
  for (const input of inputs) bitmaps.push(await workflowBitmap(input, signal));
  const source = bitmaps[0];
  let width = source.width;
  let height = source.height;
  if (type === "resize_image") {
    width = Math.max(16, Math.min(8192, Number(config.width || 1024)));
    height = Math.max(16, Math.min(8192, Number(config.height || 1024)));
  } else if (type === "rotate_image" && [90,270].includes(Number(config.degrees))) {
    [width, height] = [height, width];
  } else if (type === "crop_image") {
    const [rw, rh] = String(config.ratio || "1:1").split(":").map(Number);
    const target = rw / rh;
    if (source.width / source.height > target) width = Math.round(source.height * target);
    else height = Math.round(source.width / target);
  } else if (type === "collage") {
    const columns = Math.max(1, Math.min(4, Number(config.columns || 2)));
    const rows = Math.ceil(bitmaps.length / columns);
    const cellWidth = Math.max(...bitmaps.map((item) => item.width));
    const cellHeight = Math.max(...bitmaps.map((item) => item.height));
    const gap = Math.max(0, Math.min(200, Number(config.gap || 16)));
    width = columns * cellWidth + (columns - 1) * gap;
    height = rows * cellHeight + (rows - 1) * gap;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { alpha:true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (type === "collage") {
    const columns = Math.max(1, Math.min(4, Number(config.columns || 2)));
    const gap = Math.max(0, Math.min(200, Number(config.gap || 16)));
    const cellWidth = (canvas.width - gap * (columns - 1)) / columns;
    const rows = Math.ceil(bitmaps.length / columns);
    const cellHeight = (canvas.height - gap * (rows - 1)) / rows;
    context.fillStyle = /^#[0-9a-f]{6}$/i.test(String(config.background || "")) ? config.background : "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    bitmaps.forEach((bitmap, index) => {
      const x = (index % columns) * (cellWidth + gap);
      const y = Math.floor(index / columns) * (cellHeight + gap);
      const scale = Math.min(cellWidth / bitmap.width, cellHeight / bitmap.height);
      const drawWidth = bitmap.width * scale;
      const drawHeight = bitmap.height * scale;
      context.drawImage(bitmap, x + (cellWidth - drawWidth) / 2, y + (cellHeight - drawHeight) / 2, drawWidth, drawHeight);
    });
  } else if (type === "rotate_image") {
    const degrees = Number(config.degrees || 90);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(degrees * Math.PI / 180);
    context.drawImage(source, -source.width / 2, -source.height / 2);
  } else if (type === "crop_image") {
    const sx = Math.max(0, (source.width - canvas.width) / 2);
    const sy = Math.max(0, (source.height - canvas.height) / 2);
    context.drawImage(source, sx, sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  } else if (type === "resize_image") {
    const fit = config.fit || "contain";
    if (fit === "stretch") context.drawImage(source, 0, 0, canvas.width, canvas.height);
    else {
      const scale = fit === "cover" ? Math.max(canvas.width / source.width, canvas.height / source.height) : Math.min(canvas.width / source.width, canvas.height / source.height);
      const drawWidth = source.width * scale;
      const drawHeight = source.height * scale;
      context.drawImage(source, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
    }
  } else {
    context.drawImage(source, 0, 0);
    if (type === "watermark_image") {
      const text = String(config.text || "绘域").slice(0, 80);
      const opacity = Math.max(.1, Math.min(1, Number(config.opacity || 55) / 100));
      const size = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * .045));
      context.font = `700 ${size}px sans-serif`;
      context.textBaseline = "middle";
      const metrics = context.measureText(text);
      const pad = size * .8;
      const positions = {
        "top-left":[pad, pad], "top-right":[canvas.width - metrics.width - pad, pad],
        "bottom-left":[pad, canvas.height - pad], "bottom-right":[canvas.width - metrics.width - pad, canvas.height - pad],
        center:[(canvas.width - metrics.width) / 2, canvas.height / 2],
      };
      const [x,y] = positions[config.position] || positions["bottom-right"];
      context.globalAlpha = opacity;
      context.lineWidth = Math.max(2, size * .08);
      context.strokeStyle = "rgba(0,0,0,.7)";
      context.fillStyle = "#ffffff";
      context.strokeText(text, x, y);
      context.fillText(text, x, y);
      context.globalAlpha = 1;
    }
  }
  bitmaps.forEach((bitmap) => bitmap.close?.());
  const format = type === "convert_image" ? String(config.format || "png") : "png";
  const quality = Math.max(.1, Math.min(1, Number(config.quality || 92) / 100));
  const blob = await workflowCanvasBlob(canvas, format, quality);
  const url = URL.createObjectURL(blob);
  return { file:blob, url, images:[{ url }] };
}

function workflowEncodeWav(channels, sampleRate) {
  const frameCount = channels[0]?.length || 0;
  const channelCount = channels.length;
  const buffer = new ArrayBuffer(44 + frameCount * channelCount * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + frameCount * channelCount * 2, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true); view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, frameCount * channelCount * 2, true);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type:"audio/wav" });
}

async function runWorkflowClientAudioTool(node, values, signal) {
  const source = workflowIncomingValue(values, node.dataset.nodeId, "audio");
  if (!source) throw new Error("workflow_audio_missing");
  const blob = await workflowMediaBlob(source, signal);
  const context = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const config = workflowNodeConfig(node);
    const tool = config.tool || "trim";
    const start = tool === "trim" ? Math.max(0, Math.min(decoded.duration, Number(config.start || 0))) : 0;
    const requestedEnd = Number(config.end || 0);
    const end = tool === "trim" && requestedEnd > start ? Math.min(decoded.duration, requestedEnd) : decoded.duration;
    const firstFrame = Math.floor(start * decoded.sampleRate);
    const lastFrame = Math.max(firstFrame + 1, Math.floor(end * decoded.sampleRate));
    const channels = Array.from({ length:decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index).slice(firstFrame, lastFrame));
    if (tool === "normalize") {
      let peak = 0;
      channels.forEach((channel) => channel.forEach((sample) => { peak = Math.max(peak, Math.abs(sample)); }));
      const gain = peak > 0 ? .98 / peak : 1;
      channels.forEach((channel) => { for (let index = 0; index < channel.length; index += 1) channel[index] *= gain; });
    }
    const output = workflowEncodeWav(channels, decoded.sampleRate);
    return { file:output, url:URL.createObjectURL(output) };
  } finally { await context.close(); }
}

async function runWorkflow(targetNodeId = "") {
  if (activeRequest) return showWorkflowToast("已有任务正在执行，请稍候");
  const requestedNodeId = typeof targetNodeId === "string" ? targetNodeId : "";
  let ordered;
  try { ordered = workflowTopologicalOrder(); }
  catch { return showWorkflowToast("工作流存在循环连接，请先断开循环"); }
  const supportedTypes = new Set([
    "media_input", "media_output", "text_output",
    ...WORKFLOW_CANONICAL_NODE_TYPES,
  ]);
  const supported = ordered.filter((node) => supportedTypes.has(node.dataset.nodeType));
  const outputs = supported.filter((node) => ["media_output", "text_output"].includes(node.dataset.nodeType));
  const targetNode = requestedNodeId ? supported.find((node) => node.dataset.nodeId === requestedNodeId) : null;
  if (requestedNodeId && (!targetNode || ["media_input", "media_output", "text_output"].includes(targetNode.dataset.nodeType))) return showWorkflowToast("这个节点不需要单独运行");
  if (!requestedNodeId && !outputs.length) return showWorkflowToast("请添加并连接一个输出节点");
  const activeIds = new Set((targetNode ? [targetNode] : outputs).map((node) => node.dataset.nodeId));
  let changed = true;
  while (changed) {
    changed = false;
    workflowEdges.forEach((edge) => {
      if (activeIds.has(edge.to_node) && !activeIds.has(edge.from_node)) { activeIds.add(edge.from_node); changed = true; }
    });
  }
  const activeNodes = supported.filter((node) => activeIds.has(node.dataset.nodeId));
  activeRequest = new AbortController();
  const values = new Map();
  let workflowPromptText = "";
  setBusy(true);
  const targetRunButton = targetNode?.querySelector("[data-workflow-run-node]");
  if (targetNode) {
    targetNode.dataset.runStatus = "running";
    targetNode.querySelector("[data-workflow-node-result]")?.setAttribute("data-state", "running");
    updateWorkflowNodeSummary(targetNode);
  }
  if (targetRunButton) { targetRunButton.disabled = true; targetRunButton.textContent = "运行中…"; }
  if (targetNode === activeWorkflowEditorNode && workflowNodeEditorRun) workflowNodeEditorRun.disabled = true;
  setWorkflowOutputState(targetNode ? `正在运行${targetNode.querySelector("header b")?.textContent || "节点"}` : "正在运行工作流", targetNode ? "处理本节点及必要的上游输入" : "按节点顺序处理");
  try {
    for (const node of activeNodes) {
      const type = node.dataset.nodeType;
      const nodeId = node.dataset.nodeId;
      const config = workflowNodeConfig(node);
      if (type === "media_input") {
        const inputType = ["image", "video", "audio"].includes(config.input_type) ? config.input_type : "image";
        const state = workflowNodeImageStates.get(nodeId);
        const url = state?.url || (inputType === "image" ? workflowImageUrlForNode(node) : "");
        if (state?.file || url) values.set(`${nodeId}:${inputType}`, { ...state, url });
        continue;
      }
      if (type === "image_generator") {
        const prompt = String(config.prompt || "").trim();
        if (prompt.length < 3) throw new Error("workflow_prompt_missing");
        workflowPromptText = prompt;
        const references = ["image1", "image2"].map((port) => workflowIncomingValue(values, nodeId, port)).filter(Boolean);
        setWorkflowOutputState("正在运行 AI 生图", config.model || "qwen_image");
        let response;
        if (!references.length) {
          response = await fetchJson(API.create, { method:"POST", signal:activeRequest.signal, headers:{ "Content-Type":"application/json", "Idempotency-Key":newIdempotencyKey() }, body:JSON.stringify({ prompt, model:config.model || "qwen_image", aspect_ratio:config.ratio || "1:1", quality:config.quality || "standard", resolution:config.resolution || "720p", style:"natural", count:Number(config.count || 1), ...(config.capability_id ? { capability_id:config.capability_id } : {}) }) });
        } else {
          const ids = [];
          for (const reference of references) ids.push(await uploadWorkflowImage(reference, activeRequest.signal));
          const referenceModel = ["qwen_image", "zimage_turbo", "zimage"].includes(config.model) ? "bailian_wan_2_7" : (config.model || "bailian_wan_2_7");
          response = await fetchJson(API.tool, { method:"POST", signal:activeRequest.signal, headers:{ "Content-Type":"application/json", "Idempotency-Key":newIdempotencyKey() }, body:JSON.stringify({ operation:"edit", model:referenceModel, upload_id:ids[0], reference_upload_ids:ids.slice(1), prompt, resolution:config.resolution || "720p", quality:config.quality || "standard", ...(config.capability_id ? { capability_id:config.capability_id } : {}) }) });
        }
        const result = await resolveWorkflowJob(response, activeRequest.signal);
        values.set(`${nodeId}:image`, { images:result.images });
        continue;
      }
      if (type === "image_tool") {
        const tool = config.tool || "edit";
        const localTools = new Set(["resize","rotate","crop","collage","watermark","convert"]);
        if (localTools.has(tool)) {
          setWorkflowOutputState(`正在运行${WORKFLOW_IMAGE_TOOL_OPTIONS.find(([id]) => id === tool)?.[1] || "图像工具"}`, "浏览器本地处理");
          const result = await runWorkflowClientImageTool("image_editor", node, values, activeRequest.signal);
          values.set(`${nodeId}:image`, result);
          continue;
        }
        const imageValue = workflowIncomingValue(values, nodeId, "image1");
        if (!imageValue) throw new Error("workflow_image_missing");
        const prompt = WORKFLOW_IMAGE_TOOLS_WITH_NATURAL_LANGUAGE.has(tool) ? String(config.prompt || "").trim() : "";
        if (prompt) workflowPromptText = prompt;
        const uploadId = await uploadWorkflowImage(imageValue, activeRequest.signal);
        const operation = ({ restore:"edit" })[tool] || tool;
        const maskUploadId = tool === "redraw" ? await uploadWorkflowMask(node, activeRequest.signal) : null;
        const toolPrompt = tool === "multiangle" ? `${prompt} ${node.dataset.cameraPrompt || ""}`.trim()
          : tool === "panorama" ? `${prompt} 输出严格 2:1 等距柱状 360° 全景，水平视场 360°、垂直视场 180°，左右边缘无缝衔接。`.trim() : prompt;
        setWorkflowOutputState(`正在运行${WORKFLOW_IMAGE_TOOL_OPTIONS.find(([id]) => id === tool)?.[1] || "图像工具"}`, config.model || "");
        const response = await fetchJson(API.tool, { method:"POST", signal:activeRequest.signal, headers:{ "Content-Type":"application/json", "Idempotency-Key":newIdempotencyKey() }, body:JSON.stringify({ operation, model:operation === "upscale" ? UPSCALER_MODEL.id : operation === "cutout" ? CUTOUT_MODEL.id : (config.model || "bailian_wan_2_7"), upload_id:uploadId, ...(maskUploadId ? { mask_upload_id:maskUploadId } : {}), ...(tool === "restore" ? { preset_id:"edit-restore" } : {}), ...(operation === "interactive" ? { annotations:[{ image_index:1, kind:config.selection === "bbox" ? "bbox" : "point", coordinates:config.selection === "bbox" ? [250,250,750,750] : [500,500] }] } : {}), prompt:toolPrompt, resolution:config.resolution || (operation === "upscale" ? "2k" : "720p"), views:Number(config.views || 3), ...(tool === "multiangle" ? { camera:{ azimuth:Number(config.azimuth || 45), elevation:Number(config.elevation || 30), distance:Number(config.distance || 5.4) } } : {}), ...(config.capability_id ? { capability_id:config.capability_id } : {}) }) });
        const result = await resolveWorkflowJob(response, activeRequest.signal);
        values.set(`${nodeId}:image`, { images:result.images });
        continue;
      }
      if (type === "video_generator") {
        const prompt = String(config.prompt || "").trim();
        if (prompt.length < 3) throw new Error("workflow_prompt_missing");
        workflowPromptText = prompt;
        const selectedOperation = config.mode || "text_to_video";
        const mediaPorts = selectedOperation === "text_to_video" ? [] : selectedOperation === "first_last_to_video" ? WORKFLOW_VIDEO_REFERENCE_PORTS.slice(0, 2) : WORKFLOW_VIDEO_REFERENCE_PORTS;
        const mediaValues = mediaPorts.map((port) => workflowIncomingValue(values, nodeId, port)).filter(Boolean);
        const required = selectedOperation === "text_to_video" ? 0 : selectedOperation === "first_last_to_video" ? 2 : 1;
        if (mediaValues.length < required) throw new Error("workflow_image_missing");
        const referenceLimit = workflowVideoReferenceLimit(config.model || "wan2.7-t2v-2026-06-12", selectedOperation);
        if (mediaValues.length > referenceLimit) throw new Error(`workflow_reference_limit:${referenceLimit}`);
        const uploadIds = [];
        for (const value of mediaValues) uploadIds.push(await uploadWorkflowReference(value, activeRequest.signal));
        const operation = selectedOperation === "image_to_video" && uploadIds.length > 1 ? "reference_to_video" : selectedOperation;
        let model = config.model || "wan2.7-t2v-2026-06-12";
        if (model.startsWith("wan2.7-") && operation !== "text_to_video") model = operation === "reference_to_video" ? "wan2.7-r2v-2026-06-12" : "wan2.7-i2v-2026-04-25";
        setWorkflowOutputState("正在运行 AI 生成视频", `${model} · 异步任务`);
        const response = await fetchJson(API.video, { method:"POST", signal:activeRequest.signal, headers:{ "Content-Type":"application/json", "Idempotency-Key":newIdempotencyKey() }, body:JSON.stringify({ prompt, operation, model, upload_ids:uploadIds, ratio:config.ratio || "16:9", resolution:config.resolution || "720P", duration:Number(config.duration || 5) }) }, 90000);
        const result = await resolveWorkflowJob(response, activeRequest.signal);
        values.set(`${nodeId}:video`, { url:result.url });
        continue;
      }
      if (type === "video_tool") {
        const tool = config.tool || "video_edit";
        const videoValue = workflowIncomingValue(values, nodeId, "video");
        const localTools = new Set(["extract_frame","enhance_video","trim_video","crop_video"]);
        if (localTools.has(tool)) {
          if (!videoValue) throw new Error("workflow_video_missing");
          const videoBlob = await workflowMediaBlob(videoValue, activeRequest.signal);
          const body = new FormData();
          body.append("video", videoBlob, videoValue.file?.name || "workflow-video.mp4");
          body.append("operation", tool);
          body.append("frame_time", String(Number(config.frame_time || 1)));
          body.append("start_time", String(Number(config.start_time || 0)));
          body.append("end_time", String(Number(config.end_time || 5)));
          body.append("crop_ratio", config.crop_ratio || "16:9");
          body.append("enhance_scale", String(Number(config.enhance_scale || 1.5)));
          setWorkflowOutputState(`正在运行${WORKFLOW_VIDEO_TOOL_OPTIONS.find(([id]) => id === tool)?.[1]}`, "本地 FFmpeg 无损工作流");
          const response = await fetch(API.videoTools, { method:"POST", signal:activeRequest.signal, body });
          if (!response.ok) {
            const detail = await response.json();
            const error = new Error(String(detail.detail || "workflow_video_tool_failed"));
            error.status = response.status;
            throw error;
          }
          const output = await response.blob();
          const url = URL.createObjectURL(output);
          const outputKind = tool === "extract_frame" ? "image" : "video";
          values.set(`${nodeId}:${outputKind}`, { file:output, url, objectUrl:url });
          continue;
        }
        if (tool === "video_depth") {
          if (!videoValue) throw new Error("workflow_video_missing");
          const videoBlob = await workflowMediaBlob(videoValue, activeRequest.signal);
          const body = new FormData();
          body.append("video", videoBlob, videoValue.file?.name || "workflow-video.mp4");
          body.append("grayscale", String(config.palette !== "color"));
          body.append("target_fps", String(Number(config.target_fps || 24)));
          body.append("max_frames", String(Number(config.max_frames || 900)));
          const response = await fetchJson("/api/v1/videos/depth", { method:"POST", signal:activeRequest.signal, body }, 120000);
          const result = await resolveWorkflowJob(response, activeRequest.signal);
          values.set(`${nodeId}:video`, { url:result.url });
          continue;
        }
        const operation = ({ smart_cutout:"video_edit", segment_reshoot:"video_edit" })[tool] || tool;
        const route = {
          smart_cutout:{ model:"wan2.7-videoedit", ports:["video"] }, segment_reshoot:{ model:"wan2.7-videoedit", ports:["video","image"] },
          video_edit:{ model:"wan2.7-videoedit", ports:["video","image"] }, video_extension:{ model:"wanx2.1-vace-plus", ports:["video","image"] },
          video_style:{ model:"video-style-transform", ports:["video"] }, lip_sync:{ model:"videoretalk", ports:["video","audio","image"] },
          character_swap_video:{ model:"wan2.2-animate-mix", ports:["video","image"] },
          digital_human:{ model:"wan2.2-s2v", ports:["image","audio"] },
        }[tool];
        const selectedVideoToolModel = config.model || route.model;
        const uploadIds = [];
        for (const port of route.ports) {
          const value = workflowIncomingValue(values, nodeId, port);
          if (value) uploadIds.push(await uploadWorkflowReference(value, activeRequest.signal));
        }
        if (uploadIds.length < (["lip_sync","character_swap_video","digital_human"].includes(tool) ? 2 : 1)) throw new Error(["lip_sync","digital_human"].includes(tool) ? "workflow_audio_missing" : "workflow_video_missing");
        const basePrompt = String(config.prompt || "自然处理视频").trim();
        const prompt = tool === "smart_cutout"
          ? `${basePrompt}。准确识别并保留前景主体，移除原背景，输出${({ transparent:"透明背景", green:"纯绿幕背景", white:"纯白背景" })[config.background || "transparent"]}。`
          : tool === "segment_reshoot"
            ? `${basePrompt}。仅重拍 ${Number(config.start_time || 0)} 秒至 ${Number(config.end_time || 5)} 秒片段，保持片段前后人物、场景、光线和运动连续。`
            : basePrompt;
        setWorkflowOutputState(`正在运行${WORKFLOW_VIDEO_TOOL_OPTIONS.find(([id]) => id === tool)?.[1] || "视频工具"}`, selectedVideoToolModel);
        const duration = tool === "segment_reshoot" ? Math.max(2, Number(config.end_time || 5) - Number(config.start_time || 0)) : Number(config.duration || 5);
        const response = await fetchJson(API.video, { method:"POST", signal:activeRequest.signal, headers:{ "Content-Type":"application/json", "Idempotency-Key":newIdempotencyKey() }, body:JSON.stringify({ prompt, operation, model:selectedVideoToolModel, upload_ids:uploadIds, ratio:"16:9", resolution:config.resolution || "720P", duration:selectedVideoToolModel === "wanx2.1-vace-plus" ? 5 : duration, style_id:Number(config.style_id || 0), rights_confirmed:tool === "character_swap_video" && config.consent === "required" }) }, 90000);
        const result = await resolveWorkflowJob(response, activeRequest.signal);
        values.set(`${nodeId}:video`, { url:result.url });
        continue;
      }
      if (type === "audio_generator") {
        const ability = config.ability || "text_dubbing";
        let text = String(workflowIncomingValue(values, nodeId, "text") || config.text || "").trim();
        let instructions = "";
        if (ability === "custom_voice") {
          instructions = String(config.voice_description || "").trim();
          if (!instructions) throw new Error("workflow_voice_description_missing");
          text = String(config.preview_text || DEFAULT_CUSTOM_VOICE_PREVIEW).trim() || DEFAULT_CUSTOM_VOICE_PREVIEW;
        }
        if (ability === "image_dubbing") {
          const imageValue = workflowIncomingValue(values, nodeId, "image");
          if (!imageValue) throw new Error("workflow_image_missing");
          setWorkflowOutputState("正在生成图片旁白", "图片理解 · 配音");
          const uploadId = await uploadWorkflowImage(imageValue, activeRequest.signal);
          const analysis = await fetchJson(API.analyze, {
            method:"POST", signal:activeRequest.signal,
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify({ upload_id:uploadId, focus:"narration", instruction:text }),
          }, 120000);
          text = String(analysis.body.analysis || "").trim();
        }
        if (!text) throw new Error("workflow_prompt_missing");
        const speechModel = ability === "custom_voice" ? "qwen3-tts-instruct-flash" : (config.model || "doubao-tts-2.0");
        const reference = ["reference_audio","custom_voice"].includes(ability) ? workflowIncomingValue(values, nodeId, "audio") : null;
        if (ability === "reference_audio" && !reference) throw new Error("workflow_audio_missing");
        if (reference && config.consent !== "confirmed") throw new Error("workflow_voice_rights_missing");
        const referenceUploadId = reference ? await uploadWorkflowReference(reference, activeRequest.signal) : null;
        const response = await fetchJson(API.audioTts, { method:"POST", signal:activeRequest.signal, headers:{ "Content-Type":"application/json", "Idempotency-Key":newIdempotencyKey() }, body:JSON.stringify({ text, model:speechModel, voice:config.voice || (speechModel === "doubao-tts-2.0" ? "zh_female_vv_uranus_bigtts" : "Cherry"), language_type:config.language_type || "Auto", instructions, speed_ratio:Number(config.speed_ratio || 1), emotion:config.emotion || "", emotion_scale:4, format:"wav", sample_rate:24000, ...(referenceUploadId ? { reference_upload_id:referenceUploadId, rights_confirmed:true } : {}) }) }, 90000);
        const result = await resolveWorkflowJob(response, activeRequest.signal);
        values.set(`${nodeId}:audio`, { url:result.url });
        continue;
      }
      if (type === "audio_tool") {
        setWorkflowOutputState("正在运行音频工具", "浏览器本地处理");
        values.set(`${nodeId}:audio`, await runWorkflowClientAudioTool(node, values, activeRequest.signal));
        continue;
      }
      if (type === "text_output") {
        renderWorkflowTextOutput(node, workflowIncomingValue(values, nodeId, "text"));
        continue;
      }
      if (type === "media_output") {
        const outputType = ["image", "video", "audio"].includes(config.output_type) ? config.output_type : "image";
        const outputValue = workflowIncomingValue(values, nodeId, outputType);
        if (outputType === "image") {
          const images = outputValue?.images || (outputValue?.url ? [{ url:outputValue.url }] : []);
          if (!images.length) throw new Error("workflow_output_missing");
          renderWorkflowOutput(node, images, workflowPromptText);
        } else {
          renderWorkflowMediaOutput(node, outputValue, outputType);
        }
        continue;
      }
    }
    lastSubmittedPrompt = workflowPromptText;
    forgetPendingJob();
    if (targetNode) {
      renderWorkflowNodeRunResult(targetNode, values);
      targetNode.dataset.runStatus = "completed";
      updateWorkflowNodeSummary(targetNode);
      showWorkflowToast(`${targetNode.querySelector("header b")?.textContent || "节点"}已完成`);
    } else {
      showWorkflowToast("工作流已完成，结果已写入输出节点");
    }
  } catch (error) {
    if (targetNode) {
      targetNode.dataset.runStatus = "failed";
      targetNode.querySelector("[data-workflow-node-result]")?.setAttribute("data-state", "failed");
      updateWorkflowNodeSummary(targetNode);
    }
    if (error.message === "workflow_prompt_missing") showWorkflowToast("提示词输入节点还没有内容");
    else if (error.message === "workflow_voice_description_missing") showWorkflowToast("请先填写希望生成的音色描述");
    else if (error.message === "workflow_image_missing") showWorkflowToast("能力节点没有收到图像输入");
    else if (error.message.startsWith("workflow_reference_limit:")) showWorkflowToast(`当前模型最多参考 ${error.message.split(":")[1]} 张图片`);
    else if (error.message === "workflow_video_missing") showWorkflowToast("视频编辑节点没有收到视频输入");
    else if (error.message === "redraw_mask_required") showWorkflowToast("请在重绘节点的原图上涂抹重绘区域");
    else if (error.message === "workflow_audio_missing") showWorkflowToast("口型同步节点需要同时连接人物视频与人声音频");
    else if (error.message === "workflow_voice_rights_missing") showWorkflowToast("请先确认参考声音属于本人，或已获得权利人明确授权");
    else if (error.status === 401) showWorkflowToast("视频与音频生成需要先登录，以保护用量与个人资产");
    else showWorkflowToast(error.name === "AbortError" ? "已停止工作流" : "工作流未完成，请检查节点设置与服务状态");
    setWorkflowOutputState("运行未完成", "检查连线、输入和节点参数");
  } finally {
    if (targetRunButton) { targetRunButton.disabled = false; targetRunButton.textContent = "运行"; }
    if (targetNode === activeWorkflowEditorNode && workflowNodeEditorRun) workflowNodeEditorRun.disabled = false;
    activeRequest = null;
    activeJobStatusPath = null;
    setBusy(false);
  }
}

workspaceButtons.forEach((button) => button.addEventListener("click", () => setWorkspaceView(button.dataset.workspaceView)));
mobileWorkspaceToggle?.addEventListener("click", () => setWorkspaceView(document.body.classList.contains("workflow-active") ? "quick" : "workflow"));
toolNavItems.forEach((item) => item.addEventListener("click", () => setWorkspaceView("quick")));
document.querySelectorAll("[data-scene-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-scene-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderScenarios(button.dataset.sceneFilter);
}));
scenarioList?.addEventListener("click", (event) => {
  const card = event.target instanceof Element ? event.target.closest(".scenario-card") : null;
  if (!card) return;
  const scene = SCENE_WORKFLOWS.find((item) => item.preset === card.dataset.scenePreset);
  if (scene) selectWorkflowScenario(scene);
});
[workflowRatio, workflowResolution].forEach((select) => select?.addEventListener("change", updateWorkflowOutputSummary));
document.querySelector("#workflow-run")?.addEventListener("click", () => runWorkflow());
document.querySelector("#workflow-fit")?.addEventListener("click", fitWorkflowCanvas);
document.querySelector("#workflow-zoom-in")?.addEventListener("click", () => { workflowState.zoom = Math.min(1.35, workflowState.zoom + .1); applyWorkflowTransform(); });
document.querySelector("#workflow-zoom-out")?.addEventListener("click", () => { workflowState.zoom = Math.max(.18, workflowState.zoom - .1); applyWorkflowTransform(); });

const WORKFLOW_STRUCTURAL_NODE_TYPES = new Set([
  "media_input", "media_output", "text_output",
]);
function resetWorkflowNodes() {
  clearWorkflowConnectionState();
  selectedWorkflowEdgeId = "";
  loadWorkflowGraph(defaultWorkflowGraph());
}

let workflowTransformFrame = 0;
function scheduleWorkflowTransform() {
  if (workflowTransformFrame) return;
  workflowTransformFrame = requestAnimationFrame(() => {
    workflowTransformFrame = 0;
    applyWorkflowTransform();
  });
}

let workflowNodeMoveFrame = 0;
let pendingWorkflowNodeMove = null;
function flushWorkflowNodeMove() {
  if (workflowNodeMoveFrame) cancelAnimationFrame(workflowNodeMoveFrame);
  workflowNodeMoveFrame = 0;
  const pending = pendingWorkflowNodeMove;
  pendingWorkflowNodeMove = null;
  if (!pending) return;
  pending.node.dataset.x = String(pending.x);
  pending.node.dataset.y = String(pending.y);
  positionWorkflowNode(pending.node);
  if (activeWorkflowEditorNode === pending.node) positionWorkflowNodeEditor(pending.node);
  refreshWorkflowLineGeometry();
}
function scheduleWorkflowNodeMove(node, x, y) {
  pendingWorkflowNodeMove = { node, x, y };
  if (workflowNodeMoveFrame) return;
  workflowNodeMoveFrame = requestAnimationFrame(flushWorkflowNodeMove);
}

document.querySelectorAll("[data-workflow-node]").forEach((node) => {
  positionWorkflowNode(node);
  bindWorkflowNodeEditorActivation(node);
  const handle = node.querySelector("header");
  handle?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = Number(node.dataset.x);
    const originY = Number(node.dataset.y);
    let dragged = false;
    node.classList.add("is-dragging");
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      if (!dragged && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
      dragged = true;
      const nextX = originX + (moveEvent.clientX - startX) / workflowState.zoom;
      const nextY = originY + (moveEvent.clientY - startY) / workflowState.zoom;
      scheduleWorkflowNodeMove(
        node,
        Math.max(-50000, Math.min(50000, nextX)),
        Math.max(-50000, Math.min(50000, nextY)),
      );
    };
    const end = (upEvent) => {
      flushWorkflowNodeMove();
      updateWorkflowLines();
      if (dragged) {
        node.dataset.suppressEditorClick = "true";
        requestAnimationFrame(() => { delete node.dataset.suppressEditorClick; });
      }
      node.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      if (handle.hasPointerCapture(upEvent.pointerId)) handle.releasePointerCapture(upEvent.pointerId);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end, { once:true });
  });
});

workflowViewport?.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (event.button !== 0 || target?.closest(".workflow-node,.workflow-node-editor,.workflow-canvas-toolbar")) return;
  closeWorkflowNodeEditor();
  event.preventDefault();
  window.getSelection()?.removeAllRanges();
  const startX = event.clientX;
  const startY = event.clientY;
  const originX = workflowState.panX;
  const originY = workflowState.panY;
  workflowViewport.classList.add("is-panning");
  workflowViewport.setPointerCapture(event.pointerId);
  const preventSelection = (selectionEvent) => selectionEvent.preventDefault();
  document.addEventListener("selectstart", preventSelection);
  const move = (moveEvent) => {
    moveEvent.preventDefault();
    workflowState.panX = originX + moveEvent.clientX - startX;
    workflowState.panY = originY + moveEvent.clientY - startY;
    scheduleWorkflowTransform();
  };
  const end = (upEvent) => {
    if (workflowTransformFrame) {
      cancelAnimationFrame(workflowTransformFrame);
      workflowTransformFrame = 0;
      applyWorkflowTransform();
    }
    workflowViewport.classList.remove("is-panning");
    document.removeEventListener("selectstart", preventSelection);
    workflowViewport.removeEventListener("pointermove", move);
    workflowViewport.removeEventListener("pointerup", end);
    workflowViewport.removeEventListener("pointercancel", end);
    workflowViewport.removeEventListener("lostpointercapture", end);
    if (workflowViewport.hasPointerCapture(upEvent.pointerId)) workflowViewport.releasePointerCapture(upEvent.pointerId);
  };
  workflowViewport.addEventListener("pointermove", move);
  workflowViewport.addEventListener("pointerup", end);
  workflowViewport.addEventListener("pointercancel", end, { once:true });
  workflowViewport.addEventListener("lostpointercapture", end, { once:true });
});
workflowViewport?.addEventListener("wheel", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
  event.preventDefault();
  const rect = workflowViewport.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const worldX = (pointerX - workflowState.panX) / workflowState.zoom;
  const worldY = (pointerY - workflowState.panY) / workflowState.zoom;
  const nextZoom = Math.max(.18, Math.min(1.35, workflowState.zoom * (event.deltaY > 0 ? .92 : 1.08)));
  workflowState.panX = pointerX - worldX * nextZoom;
  workflowState.panY = pointerY - worldY * nextZoom;
  workflowState.zoom = nextZoom;
  scheduleWorkflowTransform();
}, { passive:false });

renderWorkflowStyles();
renderScenarios();
updateWorkflowOutputSummary();
selectWorkflowScenario(SCENE_WORKFLOWS[0]);
requestAnimationFrame(() => { applyWorkflowTransform(); updateWorkflowLines(); });

/* v46: reusable workflow graphs. Complexity stays behind the canvas entry: users can
   begin from a scene, then reveal categorized nodes only when they double-click. */
const WORKFLOW_LOCAL_KEY = "huiju.workflows.local.v1";
const workflowLibraryTabs = [...document.querySelectorAll("[data-workflow-library-tab]")];
const workflowLibraryPanels = [...document.querySelectorAll("[data-workflow-library-panel]")];
const sharedWorkflowList = document.querySelector("#shared-workflow-list");
const sharedWorkflowScopes = [...document.querySelectorAll("[data-workflow-scope]")];
const workflowNodePicker = document.querySelector("#workflow-node-picker");
const workflowNodeGroups = document.querySelector("#workflow-node-groups");
const workflowNodeCategoryTabs = document.querySelector("#workflow-node-category-tabs");
const workflowNodeEditor = document.querySelector("#workflow-node-editor");
const workflowNodeEditorPromptLabel = document.querySelector("#workflow-node-editor-prompt-label");
const workflowNodeEditorPrompt = document.querySelector("#workflow-node-editor-prompt");
const workflowNodeEditorFields = document.querySelector("#workflow-node-editor-fields");
const workflowNodeEditorCredit = document.querySelector("#workflow-node-editor-credit");
const workflowNodeEditorRun = document.querySelector("#workflow-node-editor-run");
const workflowNodeEditorExpand = document.querySelector("#workflow-node-editor-expand");
const workflowShareDialog = document.querySelector("#workflow-share-dialog");
const workflowShareName = document.querySelector("#workflow-share-name");
const workflowShareDescription = document.querySelector("#workflow-share-description");
const workflowShareTags = document.querySelector("#workflow-share-tags");
const workflowShareStatus = document.querySelector("#workflow-share-status");
const workflowShareLink = document.querySelector("#workflow-share-link");
const workflowShareLinkInput = document.querySelector("#workflow-share-link-input");
const workflowImportFile = document.querySelector("#workflow-import-file");
const workflowToast = document.querySelector("#workflow-toast");
const workflowEdgeDeleteButton = document.querySelector("#workflow-edge-delete");
const workflowEdgeStyleSelect = document.querySelector("#workflow-edge-style");
const workflowAssetList = document.querySelector("#workflow-asset-list");
const workflowAssetFilterContainer = document.querySelector("#workflow-asset-filters");
const workflowResourceDrawer = document.querySelector("#workflow-resource-drawer");
const workflowDiscoveryGrid = document.querySelector("#workflow-discovery-grid");
const workflowDiscoveryStatus = document.querySelector("#workflow-discovery-status");
const workflowSortTabs = [...document.querySelectorAll("[data-workflow-sort]")];
const workflowCommunityDialog = document.querySelector("#workflow-community-dialog");
const workflowCommentsList = document.querySelector("#workflow-comments-list");
let workflowPickerWorldPoint = { x: 560, y: 340 };
let activeWorkflowScenePreset = SCENE_WORKFLOWS[0]?.preset || "";
let activeWorkflowScope = "community";
let communityWorkflows = [];
let activeWorkflowSort = "recommended";
let activeCommunityWorkflow = null;
let workflowToastTimer = 0;
let activeWorkflowAssetFilter = "all";
let personalWorkflowAssets = [];
let selectedWorkflowEdgeId = "";
let pendingWorkflowSource = null;
let workflowPickerAutoConnectSource = null;
let workflowPickerSourceType = "";
let activeWorkflowNodeCategory = "all";
let suppressWorkflowPortClick = false;
let activeWorkflowEditorNode = null;

const WORKFLOW_ICON_SVGS = Object.freeze({
  input: '<path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 19h14"/>',
  "image-generate": '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m7 16 3-3 2 2 2-2 3 3"/><path d="M16.5 2.5v5M14 5h5"/>',
  "image-edit": '<rect x="4" y="5" width="13" height="14" rx="2"/><path d="m7 16 3-3 2 2"/><path d="m14 15 5-5 2 2-5 5-3 1z"/>',
  "video-generate": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  "video-edit": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/>',
  "audio-generate": '<path d="M4 13h2l2-5 3 9 3-12 3 8h3"/><path d="M18.5 3v4M16.5 5h4"/>',
  "audio-edit": '<path d="M4 8h5M13 8h7M4 16h9M17 16h3"/><circle cx="11" cy="8" r="2"/><circle cx="15" cy="16" r="2"/>',
  output: '<path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 19h14"/>',
  text: '<path d="M5 6h14M12 6v12M8 18h8"/>',
  drag: '<circle cx="8" cy="6" r="1"/><circle cx="16" cy="6" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  run: '<path d="M12 20V5m-6 6 6-6 6 6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m6 17 4-4 3 3 2-2 3 3"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  audio: '<path d="M5 13h2l2-6 3 11 3-13 3 8h2"/>',
  spark: '<path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z"/>',
  upscale: '<path d="M7 17 17 7M9 7h8v8"/><path d="M5 11v8h8"/>',
});

function createWorkflowIcon(name) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("workflow-svg-icon", `workflow-svg-icon-${name}`);
  icon.dataset.workflowIcon = name;
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = WORKFLOW_ICON_SVGS[name];
  return icon;
}

function workflowIconMarkup(name) {
  return `<svg class="workflow-svg-icon workflow-svg-icon-${name}" data-workflow-icon="${name}" viewBox="0 0 24 24" aria-hidden="true">${WORKFLOW_ICON_SVGS[name]}</svg>`;
}

const WORKFLOW_EDGE_STYLE_STORAGE_KEY = "huiju.workflow.edge-style.v1";
function setWorkflowEdgeStyle(style) {
  workflowCanvasShell.dataset.edgeStyle = style;
  window.localStorage.setItem(WORKFLOW_EDGE_STYLE_STORAGE_KEY, style);
  if (style === "hidden") {
    selectedWorkflowEdgeId = "";
    hideWorkflowEdgeDeleteButton();
  }
}
workflowEdgeStyleSelect.value = window.localStorage.getItem(WORKFLOW_EDGE_STYLE_STORAGE_KEY) || "solid";
setWorkflowEdgeStyle(workflowEdgeStyleSelect.value);
workflowEdgeStyleSelect.addEventListener("change", () => setWorkflowEdgeStyle(workflowEdgeStyleSelect.value));

const DEFAULT_WORKFLOW_EDGES = Object.freeze([
  { id:"edge-image-redraw", from_node:"image-input-base", to_node:"redraw-base", from_port:"image", to_port:"image1" },
  { id:"edge-redraw-upscale", from_node:"redraw-base", to_node:"upscale-base", from_port:"image", to_port:"image1" },
  { id:"edge-upscale-output", from_node:"upscale-base", to_node:"output-base", from_port:"image", to_port:"image" },
]);
let workflowEdges = DEFAULT_WORKFLOW_EDGES.map((edge) => ({ ...edge }));

function workflowCapabilityTemplates() {
  // 幕布只暴露稳定的媒体级节点。具体能力来自节点内下拉框，避免能力中心
  // 每新增一个入口就在幕布复制一套节点、端口和执行逻辑。
  return WORKFLOW_NODE_TEMPLATES
    .filter((template) => WORKFLOW_STRUCTURAL_NODE_TYPES.has(template.type) || WORKFLOW_CANONICAL_NODE_TYPES.has(template.type))
    .map((template) => ({ ...template, capabilityId:"", ready:true }));
}

function showWorkflowToast(message) {
  if (!workflowToast) return;
  window.clearTimeout(workflowToastTimer);
  workflowToast.textContent = message;
  workflowToast.hidden = false;
  workflowToastTimer = window.setTimeout(() => { workflowToast.hidden = true; }, 2800);
}

function workflowPortTypesCompatible(sourceType, targetType) {
  return sourceType === targetType || sourceType === "any" || targetType === "any"
    || (targetType === "media" && ["image", "video"].includes(sourceType))
    || (sourceType === "media" && ["image", "video"].includes(targetType));
}

function workflowTemplateAcceptsType(template, sourceType = "") {
  return !sourceType || (template.inputs || []).some((input) => workflowPortTypesCompatible(sourceType, input.type || "any"));
}

function renderWorkflowNodePicker(sourceType = "") {
  if (!workflowNodeGroups || !workflowNodeCategoryTabs) return;
  workflowPickerSourceType = sourceType;
  const nodeRegistry = workflowCapabilityTemplates();
  const availableCategories = Object.keys(WORKFLOW_NODE_CATEGORIES).filter((category) =>
    nodeRegistry.some((item) => item.category === category && workflowTemplateAcceptsType(item, sourceType))
  );
  if (activeWorkflowNodeCategory !== "all" && !availableCategories.includes(activeWorkflowNodeCategory)) {
    activeWorkflowNodeCategory = "all";
  }
  const tabs = [["all", "全部"], ...availableCategories.map((category) => [category, WORKFLOW_NODE_CATEGORIES[category].label])];
  workflowNodeCategoryTabs.replaceChildren(...tabs.map(([category, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "tab";
    button.dataset.workflowNodeCategory = category;
    button.setAttribute("aria-selected", String(activeWorkflowNodeCategory === category));
    button.textContent = label;
    return button;
  }));
  const groups = Object.entries(WORKFLOW_NODE_CATEGORIES).map(([category, metadata]) => {
    if (activeWorkflowNodeCategory !== "all" && activeWorkflowNodeCategory !== category) return null;
    const templates = nodeRegistry.filter((item) => item.category === category && workflowTemplateAcceptsType(item, sourceType));
    if (!templates.length) return null;
    const section = document.createElement("section");
    section.className = "workflow-node-group";
    section.style.setProperty("--node-accent", metadata.accent);
    const heading = document.createElement("h4");
    heading.textContent = metadata.label;
    const options = document.createElement("div");
    options.className = "workflow-node-options";
    templates.forEach((template) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workflow-node-option";
      button.dataset.nodeTemplate = template.type;
      button.dataset.nodeCapability = template.capabilityId || "";
      button.disabled = !template.ready;
      button.setAttribute("aria-disabled", String(!template.ready));
      const icon = document.createElement("span");
      icon.append(createWorkflowIcon(template.icon));
      const copy = document.createElement("span");
      const title = document.createElement("b");
      title.textContent = template.label;
      const note = document.createElement("small");
      note.textContent = template.ready ? template.note : `${template.note} · 当前未接入`;
      copy.append(title, note);
      button.append(icon, copy);
      options.append(button);
    });
    section.append(heading, options);
    return section;
  }).filter(Boolean);
  workflowNodeGroups.replaceChildren(...groups);
  workflowNodeGroups.scrollTop = 0;
}

function createWorkflowField(field) {
  const label = document.createElement("label");
  label.append(document.createTextNode(field.label));
  let control;
  if (field.kind === "textarea") {
    control = document.createElement("textarea");
  } else if (field.kind === "select") {
    control = document.createElement("select");
    (field.options || []).forEach(([value, copy]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = copy;
      option.dataset.baseLabel = copy;
      control.append(option);
    });
  } else if (field.kind === "range") {
    control = document.createElement("input");
    control.type = "range";
    if (field.min !== undefined) control.min = field.min;
    if (field.max !== undefined) control.max = field.max;
    if (field.step !== undefined) control.step = field.step;
    label.classList.add("workflow-range-field");
    const value = document.createElement("output");
    value.textContent = field.value ?? control.value;
    control.addEventListener("input", () => {
      const node = label.closest(".workflow-node");
      value.value = control.value;
      value.textContent = control.value;
      updateWorkflowCameraSummary(node);
      syncWorkflowCameraWorkbench(node);
    });
    label.append(control, value);
  } else {
    control = document.createElement("input");
    control.type = field.kind === "number" ? "number" : "text";
  }
  control.dataset.nodeField = field.key;
  if (field.placeholder) control.placeholder = field.placeholder;
  if (field.value !== undefined) control.value = field.value;
  if (!control.parentElement) label.append(control);
  if (field.key === "model") {
    label.classList.add("workflow-model-field");
    const meta = document.createElement("span");
    meta.className = "workflow-model-meta";
    meta.dataset.workflowModelMeta = "true";
    label.append(meta);
    const sync = () => {
      const node = label.closest("[data-node-id]");
      if (node) syncWorkflowModelDecorations(node);
      else meta.innerHTML = `<span class="model-status-tags">${modelStatusTagsMarkup(control.value)}</span>${modelFavoriteMarkup(control.value, { interactive:false })}`;
    };
    control.addEventListener("change", sync);
    sync();
  }
  return label;
}

const WORKFLOW_IMAGE_CREDIT_FALLBACK = Object.freeze({
  qwen_image:0, zimage_turbo:3, zimage:4, bailian_qwen_3:5, bailian_qwen_3_pro:7,
  seedream_5_0:6, seedream_5_0_pro:8, gpt_image:3,
});
const WORKFLOW_VIDEO_CREDIT_FALLBACK = Object.freeze({
  minimax_h3_max:{ "480P:no_video":9, "768P:no_video":12 },
  "wan2.7-t2v-2026-06-12":{ "720P:no_video":12, "1080P:no_video":19 },
  "wan2.7-i2v-2026-04-25":{ "720P:no_video":12, "1080P:no_video":19 },
  "wan2.7-r2v-2026-06-12":{ "720P:no_video":12, "1080P:no_video":19 },
  "wan3.0-video":{ "480P:no_video":6, "720P:no_video":10, "1080P:no_video":19 },
  "wan3.0-video-prime":{ "480P:no_video":8, "720P:no_video":15, "1080P:no_video":27 },
  seedance_2_0:{ "720P:video":12, "720P:no_video":19, "1080P:video":22, "1080P:no_video":34 },
  seedance_2_0_mini:{ "720P:video":6, "720P:no_video":9, "1080P:video":11, "1080P:no_video":16 },
  seedance_2_0_fast:{ "720P:video":9, "720P:no_video":14, "1080P:video":16, "1080P:no_video":25 },
  seedance_2_5:{ "720P:video":28, "720P:no_video":47, "1080P:video":39, "1080P:no_video":66 },
});

function workflowGenerationNodes(root = workflowBoard) {
  if (!root) return [];
  if (root.matches?.("[data-node-type]") && WORKFLOW_GENERATION_NODE_TYPES.has(root.dataset.nodeType)) return [root];
  return [...root.querySelectorAll?.('[data-node-type="image_generator"], [data-node-type="video_generator"], [data-node-type="audio_generator"]') || []];
}

function workflowHasVideoInput(node) {
  return workflowEdges.some((edge) => {
    if (edge.to_node !== node.dataset.nodeId) return false;
    const source = workflowBoard?.querySelector(`[data-node-id="${edge.from_node}"]`);
    const port = source?.querySelector(`[data-port-direction="output"][data-port-name="${edge.from_port}"]`);
    return port?.dataset.portType === "video";
  });
}

function workflowImageUnitCredits(model, resolution, quality = "standard") {
  const key = String(resolution || "1k").toLowerCase();
  const priced = pricingData?.image?.[model];
  const quoted = Number(priced?.by_quality_resolution?.[quality]?.[key] ?? priced?.by_resolution?.[key] ?? priced?.unit_credits);
  if (Number.isFinite(quoted)) return quoted;
  if (["2k", "4k"].includes(key) && model === "bailian_qwen_3_pro") return 13;
  if (["2k", "4k"].includes(key) && model === "seedream_5_0_pro") return 15;
  return WORKFLOW_IMAGE_CREDIT_FALLBACK[model] ?? 8;
}

function workflowImageReferenceCount(node) {
  return workflowEdges.filter((edge) => edge.to_node === node.dataset.nodeId && /^image[12]$/.test(edge.to_port)).length;
}

function workflowImageUnitCreditsForNode(node, model) {
  const references = workflowImageReferenceCount(node);
  const effectiveModel = references && ["qwen_image", "zimage_turbo", "zimage"].includes(model) ? "bailian_wan_2_7" : model;
  const resolution = node.querySelector('[data-node-field="resolution"]')?.value || "720p";
  const quality = node.querySelector('[data-node-field="quality"]')?.value || "standard";
  const referenceFee = references > 1 && ["bailian_qwen_3_pro", "seedream_5_0_pro", "bailian_wan_2_7_pro"].includes(effectiveModel) ? references - 1 : 0;
  return workflowImageUnitCredits(effectiveModel, resolution, quality) + referenceFee;
}

function workflowVideoUnitCredits(model, resolution, hasVideoInput) {
  const normalized = String(resolution || "720P").toUpperCase() === "1K" ? "1080P" : String(resolution || "720P").toUpperCase();
  const input = hasVideoInput ? "video" : "no_video";
  const rules = pricingData?.video?.[model] || {};
  const rate = rules[`${normalized}:${input}`] || rules[`${normalized}:no_video`] || rules[`${normalized}:video`];
  const tier = pricingData?.member ? "member" : "public";
  const quoted = Number(rate?.[tier]);
  if (Number.isFinite(quoted)) return quoted;
  const fallback = WORKFLOW_VIDEO_CREDIT_FALLBACK[model] || {};
  return Number(fallback[`${normalized}:${input}`] ?? fallback[`${normalized}:no_video`] ?? fallback[`${normalized}:video`] ?? 12);
}

function workflowAudioUnitCredits(model) {
  const tier = pricingData?.member ? "member" : "public";
  const quoted = Number(pricingData?.audio?.[model]?.[tier]);
  return Number.isFinite(quoted) ? quoted : 3;
}

function workflowPromptTextForNode(node) {
  const inline = node?.querySelector('[data-node-field="prompt"], [data-node-field="text"]');
  if (inline) return String(inline.value || "");
  const edge = workflowEdges.find((item) => item.to_node === node.dataset.nodeId && ["prompt", "text"].includes(item.to_port));
  const source = edge ? workflowBoard?.querySelector(`[data-node-id="${edge.from_node}"]`) : null;
  return String(source?.querySelector('[data-node-field="prompt"]')?.value || "");
}

function workflowModelRateLabel(node, model) {
  if (!node || !model) return "";
  const resolution = node.querySelector('[data-node-field="resolution"]')?.value || "720p";
  if (node.dataset.nodeType === "image_generator") return `${workflowImageUnitCreditsForNode(node, model)} 点/张`;
  if (node.dataset.nodeType === "video_generator") return `${workflowVideoUnitCredits(model, resolution, workflowHasVideoInput(node))} 点/秒`;
  if (node.dataset.nodeType === "audio_generator") return `${workflowAudioUnitCredits(model)} 点/秒`;
  return "";
}

function workflowModelOptionLabel(node, option) {
  return option.dataset.baseLabel || option.textContent || option.value;
}

function syncWorkflowModelDecorations(root) {
  root?.querySelectorAll('.workflow-model-field').forEach((field) => {
    const select = field.querySelector('[data-node-field="model"]');
    const meta = field.querySelector('[data-workflow-model-meta]');
    const node = field.closest("[data-node-id]");
    if (!select || !meta || !node) return;
    [...select.options].forEach((option) => { option.textContent = workflowModelOptionLabel(node, option); });
    const rate = workflowModelRateLabel(node, select.value);
    meta.innerHTML = `<span class="model-status-tags">${modelStatusTagsMarkup(select.value)}</span>${rate ? `<span class="workflow-model-credit">${workflowIconMarkup("spark")}${escapeMarkup(rate)}</span>` : ""}${modelFavoriteMarkup(select.value, { interactive:false })}`;
  });
}

function createWorkflowCreditSummary() {
  const summary = document.createElement("div");
  summary.className = "workflow-credit-summary";
  summary.dataset.workflowCreditSummary = "true";
  summary.setAttribute("role", "status");
  summary.setAttribute("aria-live", "polite");
  const icon = document.createElement("span");
  icon.append(createWorkflowIcon("spark"));
  const copy = document.createElement("span");
  const label = document.createElement("small");
  label.textContent = "预计额度";
  const value = document.createElement("b");
  value.textContent = "正在计算";
  copy.append(label, value, document.createElement("em"));
  summary.append(icon, copy);
  return summary;
}

function workflowGenerationCreditDetails(node) {
  const model = node.querySelector('[data-node-field="model"]')?.value || "";
  const resolution = node.querySelector('[data-node-field="resolution"]')?.value || "720p";
  if (node.dataset.nodeType === "image_generator") {
    const references = workflowImageReferenceCount(node);
    const count = Math.max(1, Number(node.querySelector('[data-node-field="count"]')?.value || 1));
    const unit = workflowImageUnitCreditsForNode(node, model);
    return references
      ? { total:unit, detail:`${unit} 点/张 · 参考编辑输出 1 张` }
      : { total:unit * count, detail:`${unit} 点/张 × ${count} 张` };
  }
  if (node.dataset.nodeType === "video_generator") {
    const duration = Math.max(0, Number(node.querySelector('[data-node-field="duration"]')?.value || 0));
    const unit = workflowVideoUnitCredits(model, resolution, workflowHasVideoInput(node));
    const billedSeconds = model === "seedance_2_5" && duration === 0 ? 30 : Math.max(1, duration);
    const videoInputNote = WAN3_VIDEO_MODEL_IDS.has(model) && workflowHasVideoInput(node) ? "；输入视频按实际秒数另计" : "";
    return { total:unit * billedSeconds, detail:(duration === 0 ? `${unit} 点/秒 · 自动时长按实际结算` : `${unit} 点/秒 × ${duration} 秒`) + videoInputNote, maximum:duration === 0 };
  }
  const prompt = workflowPromptTextForNode(node);
  const seconds = estimatedAudioSeconds(prompt);
  const unit = workflowAudioUnitCredits(model);
  return { total:unit * seconds, detail:prompt ? `${unit} 点/秒 × 约 ${seconds} 秒` : `${unit} 点/秒 · 连接文本后自动估算`, minimum:!prompt };
}

function syncWorkflowGenerationCredits(root = workflowBoard) {
  workflowGenerationNodes(root).forEach((node) => {
    const summary = node.querySelector('[data-workflow-credit-summary]');
    if (!summary) return;
    const quote = workflowGenerationCreditDetails(node);
    const total = summary.querySelector("b");
    const detail = summary.querySelector("em");
    const prefix = quote.maximum ? "最多 " : quote.minimum ? "至少 " : "";
    if (total) total.textContent = `${prefix}${quote.total} 点`;
    if (detail) detail.textContent = quote.detail;
    summary.title = `${prefix}需要 ${quote.total} 点；${quote.detail}`;
    summary.setAttribute("aria-label", summary.title);
  });
}

const workflowNodeImageStates = new Map();
const workflowMaskStates = new WeakMap();

function workflowImageUrlForNode(node) {
  if (!node) return "";
  const state = workflowNodeImageStates.get(node.dataset.nodeId);
  if (state?.url) return state.url;
  const assetUrl = safeGeneratedImageUrl(node.dataset.assetUrl || "");
  if (assetUrl) return assetUrl;
  const preview = node.querySelector(".workflow-node-upload img, .workflow-asset-node-image");
  return preview?.src && /^blob:|^data:image\//.test(preview.src) ? preview.src : safeGeneratedImageUrl(preview?.src || "") || "";
}

const workflowPromptMentionStates = new WeakMap();

function activeWorkflowPromptMention(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement) || textarea.selectionStart !== textarea.selectionEnd) return null;
  const cursor = textarea.selectionStart;
  const before = textarea.value.slice(0, cursor);
  const match = before.match(/(?:^|[\s，。；：、（(])@([^@\s，。；：、（）()]*)$/);
  if (!match) return null;
  const start = before.lastIndexOf("@");
  return { start, end:cursor, query:match[1].trim().toLowerCase() };
}

function workflowPromptImageCandidates(target) {
  if (!workflowBoard || !target || !["image_generator", "video_generator"].includes(target.dataset.nodeType)) return [];
  const candidates = [];
  const targetType = target.dataset.nodeType;
  let allowedPorts = ["image1", "image2"];
  if (targetType === "video_generator") {
    const mode = target.querySelector('[data-node-field="mode"]')?.value || "text_to_video";
    const model = target.querySelector('[data-node-field="model"]')?.value || "wan2.7-t2v-2026-06-12";
    const limit = workflowVideoReferenceLimit(model, mode);
    allowedPorts = mode === "text_to_video" ? []
      : mode === "first_last_to_video" ? WORKFLOW_VIDEO_REFERENCE_PORTS.slice(0, Math.min(2, limit))
        : WORKFLOW_VIDEO_REFERENCE_PORTS.slice(0, limit);
  }
  const imageEdges = workflowEdges
    .filter((edge) => edge.to_node === target.dataset.nodeId && allowedPorts.includes(edge.to_port))
    .sort((a, b) => allowedPorts.indexOf(a.to_port) - allowedPorts.indexOf(b.to_port))
    .filter((edge) => {
      const source = workflowBoard.querySelector(`[data-node-id="${edge.from_node}"]`);
      const output = source?.querySelector(`[data-port-direction="output"][data-port-name="${edge.from_port}"]`);
      return output?.dataset.portType === "image";
    });
  imageEdges.forEach((edge, index) => {
    const source = workflowBoard.querySelector(`[data-node-id="${edge.from_node}"]`);
    candidates.push({
      key:`${target.dataset.nodeId}:${edge.from_node}:${index + 1}`,
      token:`@图片${index + 1}`,
      name:`图片 ${index + 1}`,
      detail:source?.querySelector("header b")?.textContent || "图像输入",
      url:workflowImageUrlForNode(source),
    });
  });
  return candidates;
}

function closeWorkflowPromptMentionPicker(promptNode) {
  const state = workflowPromptMentionStates.get(promptNode);
  if (!state) return;
  state.picker.hidden = true;
  state.activeIndex = 0;
}

function insertWorkflowPromptMention(promptNode, candidate) {
  const state = workflowPromptMentionStates.get(promptNode);
  const active = state && activeWorkflowPromptMention(state.textarea);
  if (!state || !active || !candidate) return;
  const before = state.textarea.value.slice(0, active.start);
  const after = state.textarea.value.slice(active.end);
  const suffix = after.startsWith(" ") || !after ? "" : " ";
  state.textarea.value = `${before}${candidate.token}${suffix}${after}`;
  const cursor = before.length + candidate.token.length + (suffix ? 1 : 0);
  state.textarea.setSelectionRange(cursor, cursor);
  state.textarea.dispatchEvent(new Event("input", { bubbles:true }));
  state.textarea.focus();
  closeWorkflowPromptMentionPicker(promptNode);
}

function renderWorkflowPromptMentionPicker(promptNode) {
  const state = workflowPromptMentionStates.get(promptNode);
  const active = state && activeWorkflowPromptMention(state.textarea);
  if (!state || !active) return closeWorkflowPromptMentionPicker(promptNode);
  const allCandidates = workflowPromptImageCandidates(promptNode);
  const candidates = allCandidates.filter((item) => !active.query || `${item.name} ${item.detail} ${item.token}`.toLowerCase().includes(active.query));
  state.candidates = candidates;
  state.activeIndex = Math.min(state.activeIndex, Math.max(0, candidates.length - 1));
  const heading = document.createElement("div");
  heading.className = "prompt-mention-heading";
  heading.innerHTML = `<b>引用图片</b><span>${allCandidates.length} 张已连接</span>`;
  if (!candidates.length) {
    const empty = document.createElement("p");
    empty.className = "prompt-mention-empty";
    empty.textContent = allCandidates.length ? "没有匹配图片" : "请先把图片和提示词连接到同一生成节点";
    state.picker.replaceChildren(heading, empty);
  } else {
    const options = candidates.map((candidate, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.classList.toggle("is-active", index === state.activeIndex);
      if (candidate.url) {
        const image = document.createElement("img");
        image.src = candidate.url;
        image.alt = "";
        button.append(image);
      } else {
        const placeholder = document.createElement("i");
        placeholder.className = "workflow-prompt-image-placeholder";
        placeholder.textContent = "图";
        button.append(placeholder);
      }
      const copy = document.createElement("span");
      const title = document.createElement("b");
      title.textContent = candidate.name;
      const detail = document.createElement("small");
      detail.textContent = candidate.detail;
      copy.append(title, detail);
      const token = document.createElement("em");
      token.textContent = candidate.token;
      button.append(copy, token);
      button.addEventListener("pointerenter", () => {
        state.activeIndex = index;
        state.picker.querySelectorAll('button[role="option"]').forEach((option, optionIndex) => option.classList.toggle("is-active", optionIndex === index));
      });
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => insertWorkflowPromptMention(promptNode, candidate));
      return button;
    });
    state.picker.replaceChildren(heading, ...options);
  }
  state.picker.hidden = false;
}

function createWorkflowPromptMentionPicker(promptNode) {
  const textarea = promptNode?.querySelector('textarea[data-node-field="prompt"]');
  if (!textarea || workflowPromptMentionStates.has(promptNode)) return;
  let field = textarea.closest("label");
  if (!field) {
    field = document.createElement("label");
    textarea.before(field);
    field.append(textarea);
  }
  field.classList.add("workflow-prompt-field");
  const picker = document.createElement("div");
  picker.className = "prompt-mention-picker workflow-prompt-mention-picker";
  picker.hidden = true;
  picker.setAttribute("role", "listbox");
  picker.setAttribute("aria-label", "选择已连接图片");
  field.append(picker);
  workflowPromptMentionStates.set(promptNode, { textarea, picker, candidates:[], activeIndex:0 });
  const render = () => renderWorkflowPromptMentionPicker(promptNode);
  textarea.addEventListener("input", render);
  textarea.addEventListener("click", render);
  textarea.addEventListener("keyup", (event) => { if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) render(); });
  textarea.addEventListener("keydown", (event) => {
    const state = workflowPromptMentionStates.get(promptNode);
    if (!state || state.picker.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); closeWorkflowPromptMentionPicker(promptNode); return; }
    if (!state.candidates.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      state.activeIndex = (state.activeIndex + step + state.candidates.length) % state.candidates.length;
      renderWorkflowPromptMentionPicker(promptNode);
    } else if (event.key === "Enter") {
      event.preventDefault();
      insertWorkflowPromptMention(promptNode, state.candidates[state.activeIndex]);
    }
  });
  textarea.addEventListener("blur", () => window.setTimeout(() => closeWorkflowPromptMentionPicker(promptNode), 120));
}

function syncWorkflowPromptMentionPickers() {
  workflowBoard?.querySelectorAll('[data-node-type="image_generator"], [data-node-type="video_generator"]').forEach((node) => {
    createWorkflowPromptMentionPicker(node);
    const state = workflowPromptMentionStates.get(node);
    if (state && !state.picker.hidden) renderWorkflowPromptMentionPicker(node);
  });
}

function setWorkflowNodeImage(node, file, preview) {
  if (!node || !file || !preview) return;
  const previous = workflowNodeImageStates.get(node.dataset.nodeId);
  if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
  const objectUrl = URL.createObjectURL(file);
  workflowNodeImageStates.set(node.dataset.nodeId, { file, url:objectUrl, objectUrl, kind:"image" });
  preview.src = objectUrl;
  preview.hidden = false;
  preview.closest(".workflow-node-upload")?.classList.add("has-image");
  syncWorkflowRedrawSources();
  syncWorkflowPromptMentionPickers();
}

function createWorkflowUploadBody(article, labelText = "选择原图") {
  const label = document.createElement("label");
  label.className = "workflow-node-upload";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.hidden = true;
  input.dataset.workflowFile = "image";
  const image = document.createElement("img");
  image.alt = "输入图像预览";
  image.hidden = true;
  const copy = document.createElement("span");
  copy.innerHTML = `<b>${labelText}</b><small>PNG / JPG / WebP</small>`;
  label.append(input, image, copy);
  article.append(label);
  return label;
}

function createWorkflowMediaUploadBody(article, kind) {
  const isVideo = kind === "video";
  const mediaShell = document.createElement("div");
  mediaShell.className = `workflow-node-upload workflow-node-upload-${kind}`;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = isVideo ? "video/mp4,video/webm,video/quicktime" : "audio/wav,audio/mpeg,audio/mp4,audio/ogg";
  input.hidden = true;
  input.dataset.workflowFile = kind;
  const preview = document.createElement(isVideo ? "video" : "audio");
  preview.controls = true;
  preview.hidden = true;
  preview.preload = "metadata";
  if (isVideo) preview.playsInline = true;
  preview.setAttribute("aria-label", isVideo ? "已上传视频预览" : "已上传音频预览");
  preview.addEventListener("error", () => showWorkflowToast(isVideo
    ? "该视频编码无法预览，请使用 H.264 MP4 或 WebM"
    : "该音频编码无法预览，请使用 WAV、MP3、M4A 或 OGG"));
  preview.addEventListener("pointerdown", (event) => event.stopPropagation());
  preview.addEventListener("click", (event) => event.stopPropagation());
  const copy = document.createElement("span");
  copy.innerHTML = isVideo
    ? "<b>选择视频</b><small>MP4 / WebM / MOV · 最大 200MB</small>"
    : "<b>选择音频</b><small>WAV / MP3 / M4A / OGG · 最大 30MB</small>";
  mediaShell.append(input, preview, copy);
  const source = document.createElement("div");
  source.className = "workflow-media-source";
  const select = document.createElement("select");
  select.dataset.workflowAssetSelect = kind;
  select.setAttribute("aria-label", kind === "video" ? "从资产库选择视频" : "从资产库选择音色、音乐或音频");
  select.append(new Option(kind === "video" ? "从资产库选择视频" : "从资产库选择音色 / 音乐", ""));
  const upload = document.createElement("button");
  upload.type = "button";
  upload.textContent = "上传本地文件";
  upload.addEventListener("click", () => input.click());
  source.append(select, upload);
  article.append(mediaShell, source);
  return { mediaShell, source };
}

function createWorkflowUnifiedInputBody(article) {
  const imageBranch = createWorkflowUploadBody(article, "选择图片");
  imageBranch.dataset.workflowInputBranch = "image";
  const videoBranch = createWorkflowMediaUploadBody(article, "video");
  videoBranch.mediaShell.dataset.workflowInputBranch = "video";
  videoBranch.source.dataset.workflowInputBranch = "video";
  const audioBranch = createWorkflowMediaUploadBody(article, "audio");
  audioBranch.mediaShell.dataset.workflowInputBranch = "audio";
  audioBranch.source.dataset.workflowInputBranch = "audio";
}

function populateWorkflowAssetSelect(select, kind) {
  if (!select) return;
  const selected = select.value;
  const compatible = assetItems.filter((asset) => kind === "video"
    ? asset.assetType === "video" : ["audio", "voice", "music"].includes(asset.assetType));
  const first = new Option(kind === "video" ? "从资产库选择视频" : "从资产库选择音色 / 音乐", "");
  select.replaceChildren(first, ...compatible.map((asset) => new Option(`${assetTypeLabel(asset)} · ${asset.name}`, asset.id)));
  if (compatible.some((asset) => asset.id === selected)) select.value = selected;
}

function createWorkflowMaskBody(article) {
  const panel = document.createElement("div");
  panel.className = "workflow-mask-panel";
  panel.dataset.workflowConditional = "redraw-mask";
  const stage = document.createElement("div");
  stage.className = "workflow-mask-stage";
  stage.dataset.workflowMaskStage = "true";
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = 176;
  canvas.setAttribute("aria-label", "在原图上绘制重绘区域");
  const empty = document.createElement("span");
  empty.dataset.maskEmpty = "true";
  empty.textContent = "连接或选择一张原图后，在画面上涂抹";
  stage.append(canvas, empty);
  const controls = document.createElement("div");
  controls.className = "workflow-mask-controls";
  const brushLabel = document.createElement("label");
  brushLabel.append(document.createTextNode("画笔 "));
  const brush = document.createElement("input");
  brush.type = "range";
  brush.min = "8";
  brush.max = "100";
  brush.value = "36";
  brush.dataset.nodeField = "brush";
  brush.dataset.maskBrush = "true";
  const brushValue = document.createElement("output");
  brushValue.dataset.maskBrushValue = "true";
  brushValue.value = brush.value;
  brushValue.textContent = `${brush.value}px`;
  brushLabel.append(brush, brushValue);
  const choose = document.createElement("button");
  choose.type = "button";
  choose.dataset.maskSource = "true";
  choose.textContent = "选择原图";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.dataset.maskClear = "true";
  clear.textContent = "清除";
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp";
  file.hidden = true;
  file.dataset.workflowFile = "redraw";
  controls.append(brushLabel, choose, clear, file);
  panel.append(stage, controls);
  article.append(panel);
}

function createWorkflowOutputBody(article) {
  const preview = document.createElement("div");
  preview.className = "workflow-output-preview";
  preview.dataset.workflowOutputPreview = "true";
  article.append(preview);
  createWorkflowOutputBodyPlaceholder(article);
}

function createWorkflowOutputBodyPlaceholder(article) {
  const preview = article.querySelector("[data-workflow-output-preview]");
  if (!preview) return;
  const icon = document.createElement("span");
  icon.append(createWorkflowIcon("spark"));
  const title = document.createElement("b");
  title.textContent = "等待运行";
  const copy = document.createElement("small");
  copy.textContent = "连接能力节点后运行";
  preview.replaceChildren(icon, title, copy);
}

function renderWorkflowNodeRunResult(node, values) {
  if (!node) return;
  const nodeId = node.dataset.nodeId;
  const result = node.querySelector("[data-workflow-node-result]");
  if (!result) return;
  const candidates = ["image", "video", "audio", "text"].map((kind) => [kind, values.get(`${nodeId}:${kind}`)]).filter(([, value]) => value !== undefined);
  const [kind, value] = candidates[0] || [];
  result.replaceChildren();
  if (!kind) {
    createWorkflowNodeResultPlaceholder(result, node);
    return;
  }
  if (kind === "image") {
    const imageValue = Array.isArray(value?.images) ? value.images[0] : value;
    const candidate = imageValue?.url || imageValue?.src || value?.url || "";
    const url = safeGeneratedImageUrl(candidate) || safeImageUrl(candidate);
    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = "节点运行结果";
      image.referrerPolicy = "no-referrer";
      result.append(image);
    }
  } else if (kind === "video" || kind === "audio") {
    const url = safeWorkflowMediaUrl(value?.url || "");
    if (url) {
      const media = document.createElement(kind);
      media.src = url;
      media.controls = true;
      if (kind === "video") media.playsInline = true;
      result.append(media);
      media.load();
    }
  } else {
    const text = document.createElement("p");
    text.textContent = String(value || "").slice(0, 600);
    result.append(text);
  }
  result.dataset.state = "completed";
  result.hidden = false;
}

function workflowNodeResultProfile(node) {
  const nodeType = node?.dataset.nodeType || "";
  if (nodeType === "audio_generator" || nodeType === "audio_tool") return { icon:"audio", title:"音频结果将在这里预览" };
  if (nodeType === "video_tool" && node.querySelector('[data-node-field="tool"]')?.value === "extract_frame") return { icon:"image", title:"抽帧结果将在这里预览" };
  if (nodeType === "video_generator" || nodeType === "video_tool") return { icon:"video", title:"视频结果将在这里预览" };
  return { icon:"image", title:"图片结果将在这里预览" };
}

function createWorkflowNodeResultPlaceholder(result, node) {
  result.dataset.state = "empty";
  result.hidden = false;
  const profile = workflowNodeResultProfile(node);
  const empty = document.createElement("div");
  empty.className = "workflow-node-result-empty";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.append(createWorkflowIcon(profile.icon));
  const title = document.createElement("b");
  title.textContent = profile.title;
  const copy = document.createElement("small");
  copy.textContent = workflowNodeUsesNaturalLanguagePrompt(node) ? "点击节点编辑提示词与参数" : "点击节点设置参数";
  empty.append(icon, title, copy);
  result.replaceChildren(empty);
}

function workflowSelectedFieldLabel(node, key) {
  const control = node?.querySelector(`[data-node-field="${key}"]`);
  if (!(control instanceof HTMLSelectElement)) return "";
  return control.selectedOptions[0]?.textContent?.trim() || "";
}

function updateWorkflowNodeSummary(node) {
  if (!node) return;
  const title = node.querySelector("[data-workflow-node-summary-title]");
  const detail = node.querySelector("[data-workflow-node-summary-detail]");
  const status = node.querySelector("[data-workflow-node-status]");
  const nodeType = node.dataset.nodeType || "";
  const selectorKey = nodeType === "video_generator" ? "mode" : nodeType === "audio_generator" ? "ability" : "tool";
  const selectedTool = node.querySelector('[data-node-field="tool"]')?.value || "";
  if (title) title.textContent = workflowSelectedFieldLabel(node, selectorKey) || node.querySelector("header b")?.textContent || "能力节点";
  if (detail) detail.textContent = nodeType === "image_tool" && selectedTool === "upscale"
    ? "AI 超分 · 细节增强"
    : nodeType === "image_tool" && selectedTool === "cutout"
      ? "AI 抠图 · 透明 PNG"
    : workflowSelectedFieldLabel(node, "model") || ({ image_tool:"图片编辑", video_tool:"视频编辑", audio_tool:"音频编辑" })[nodeType] || "可单独运行";
  const statusCopy = ({ running:"运行中", completed:"已完成", failed:"未完成" })[node.dataset.runStatus] || "待运行";
  if (status) status.textContent = statusCopy;
  const result = node.querySelector("[data-workflow-node-result]");
  if (result?.dataset.state === "empty") createWorkflowNodeResultPlaceholder(result, node);
  node.setAttribute("aria-label", workflowNodeUsesNaturalLanguagePrompt(node)
    ? `${node.querySelector("header b")?.textContent || "能力"}节点，按回车编辑提示词与参数`
    : `${node.querySelector("header b")?.textContent || "能力"}节点，按回车设置参数`);
  if (activeWorkflowEditorNode === node) updateWorkflowNodeEditorCredit(node);
}

function ensureWorkflowNodeRunButton(node) {
  if (!node || node.querySelector("[data-workflow-run-node]")) return;
  if (WORKFLOW_STRUCTURAL_NODE_TYPES.has(node.dataset.nodeType)) return;
  const result = document.createElement("div");
  result.className = "workflow-node-run-result";
  result.dataset.workflowNodeResult = "true";
  createWorkflowNodeResultPlaceholder(result, node);
  const footer = document.createElement("footer");
  footer.className = "workflow-node-footer";
  const summary = document.createElement("div");
  summary.className = "workflow-node-compact-meta";
  const summaryTitle = document.createElement("b");
  summaryTitle.dataset.workflowNodeSummaryTitle = "true";
  const summaryDetail = document.createElement("small");
  summaryDetail.dataset.workflowNodeSummaryDetail = "true";
  summary.append(summaryTitle, summaryDetail);
  const status = document.createElement("span");
  status.className = "workflow-node-status";
  status.dataset.workflowNodeStatus = "true";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "workflow-node-run-button";
  button.dataset.workflowRunNode = "true";
  button.setAttribute("aria-label", "运行此节点");
  button.title = "运行此节点";
  button.append(createWorkflowIcon("run"));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    runWorkflow(node.dataset.nodeId);
  });
  footer.append(summary, status, button);
  node.querySelector(":scope > header")?.after(result);
  node.append(footer);
  updateWorkflowNodeSummary(node);
}

function workflowNodeTemplate(node) {
  return WORKFLOW_NODE_TEMPLATES.find((item) => item.type === node?.dataset.nodeType) || null;
}

function workflowNodePrimaryPromptKey(node) {
  if (node?.dataset.nodeType === "audio_generator") return node.querySelector('[data-node-field="ability"]')?.value === "custom_voice" ? "voice_description" : "text";
  return "prompt";
}

function workflowNodeUsesNaturalLanguagePrompt(node) {
  if (!node || WORKFLOW_STRUCTURAL_NODE_TYPES.has(node.dataset.nodeType)) return false;
  if (node.dataset.nodeType === "image_tool") {
    const tool = node.querySelector('[data-node-field="tool"]')?.value || "edit";
    return WORKFLOW_IMAGE_TOOLS_WITH_NATURAL_LANGUAGE.has(tool);
  }
  const key = workflowNodePrimaryPromptKey(node);
  const control = node.querySelector(`[data-node-field="${key}"]`);
  const field = control?.closest("label");
  return Boolean(control && field && !field.hidden);
}

function ensureWorkflowNodePromptState(node) {
  const key = workflowNodePrimaryPromptKey(node);
  let control = node.querySelector(`[data-node-field="${key}"]`);
  if (control) return control;
  const label = document.createElement("label");
  label.hidden = true;
  label.append(document.createTextNode("处理要求"));
  control = document.createElement("textarea");
  control.dataset.nodeField = key;
  label.append(control);
  node.append(label);
  return control;
}

function workflowNodeFieldDefinition(node, key) {
  return workflowNodeTemplate(node)?.fields.find((field) => field.key === key) || null;
}

const WORKFLOW_EDITOR_RANGE_UNITS = Object.freeze({
  duration:"second",
  speed_ratio:"multiple",
  opacity:"percent",
  azimuth:"degree",
  elevation:"degree",
  brush:"pixel",
});

function workflowEditorRangeText(key, rawValue) {
  const value = String(rawValue);
  if (key === "duration" && value === "0") return "自动";
  const unit = WORKFLOW_EDITOR_RANGE_UNITS[key];
  if (unit === "second") return `${value} 秒`;
  if (unit === "multiple") return `${Number(value).toFixed(1)}×`;
  if (unit === "percent") return `${value}%`;
  if (unit === "degree") return `${value}°`;
  if (unit === "pixel") return `${value} px`;
  return value;
}

function updateWorkflowEditorRange(control, output, key, field, caption, triggerValue) {
  const min = Number(control.min);
  const max = Number(control.max);
  const current = Number(control.value);
  const progress = max === min ? 100 : Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100));
  const valueText = workflowEditorRangeText(key, control.value);
  control.style.setProperty("--workflow-range-progress", `${progress}%`);
  control.setAttribute("aria-valuetext", valueText);
  output.textContent = valueText;
  triggerValue.textContent = valueText;
  field.title = `${caption.textContent}：${valueText}`;
}

function renderWorkflowNodeEditorFields(node) {
  if (!workflowNodeEditorFields) return;
  const primaryKey = workflowNodePrimaryPromptKey(node);
  const controls = [...node.querySelectorAll("[data-node-field]")].filter((control) => {
    const label = control.closest("label");
    return control.dataset.nodeField !== primaryKey && label && !label.hidden;
  });
  const fields = controls.map((source) => {
    const key = source.dataset.nodeField;
    const definition = workflowNodeFieldDefinition(node, key);
    const isRange = source instanceof HTMLInputElement && source.type === "range";
    const field = document.createElement(isRange ? "div" : "label");
    const caption = document.createElement("span");
    caption.textContent = definition?.label || ({ brush:"画笔" })[key] || key;
    const control = source.cloneNode(true);
    control.removeAttribute("id");
    control.removeAttribute("name");
    control.removeAttribute("data-node-field");
    control.setAttribute("aria-label", caption.textContent);
    control.value = source.value;
    const sync = (event) => {
      source.value = control.value;
      source.dispatchEvent(new Event(event.type, { bubbles:true }));
      updateWorkflowNodeSummary(node);
      if (event.type === "change" && ["tool","mode","ability","model"].includes(key)) {
        renderWorkflowNodeEditor(node, { focusPrompt:false });
      }
    };
    control.addEventListener("input", sync);
    control.addEventListener("change", sync);
    if (isRange) {
      field.classList.add("workflow-node-editor-range");
      field.dataset.rangeKey = key;
      caption.textContent = caption.textContent.replace(/（[^）]+）/g, "");
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "workflow-node-editor-range-trigger";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", "false");
      const triggerLabel = document.createElement("span");
      triggerLabel.textContent = caption.textContent;
      const triggerValue = document.createElement("b");
      const chevron = document.createElement("i");
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "⌄";
      trigger.append(triggerLabel, triggerValue, chevron);
      const popover = document.createElement("div");
      popover.className = "workflow-node-editor-range-popover";
      popover.id = `workflow-range-${node.dataset.nodeId}-${key}`;
      popover.hidden = true;
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-label", caption.textContent);
      trigger.setAttribute("aria-controls", popover.id);
      const heading = document.createElement("div");
      const value = document.createElement("output");
      heading.append(caption, value);
      const bounds = document.createElement("div");
      bounds.className = "workflow-node-editor-range-bounds";
      const minimum = document.createElement("span");
      const maximum = document.createElement("span");
      minimum.textContent = workflowEditorRangeText(key, control.min);
      maximum.textContent = workflowEditorRangeText(key, control.max);
      bounds.append(minimum, maximum);
      popover.append(heading, control, bounds);
      field.append(trigger, popover);
      const updateRange = () => updateWorkflowEditorRange(control, value, key, field, caption, triggerValue);
      control.addEventListener("input", updateRange);
      trigger.addEventListener("click", () => {
        const willOpen = popover.hidden;
        workflowNodeEditorFields.querySelectorAll(".workflow-node-editor-range-popover:not([hidden])").forEach((openPopover) => {
          openPopover.hidden = true;
          openPopover.parentElement?.querySelector(".workflow-node-editor-range-trigger")?.setAttribute("aria-expanded", "false");
        });
        popover.hidden = !willOpen;
        trigger.setAttribute("aria-expanded", String(willOpen));
        if (willOpen) control.focus();
      });
      updateRange();
    } else {
      field.append(caption, control);
      field.title = caption.textContent;
    }
    return field;
  });
  workflowNodeEditorFields.replaceChildren(...fields);
}

function workflowNodeEditorCreditDetails(node) {
  if (WORKFLOW_GENERATION_NODE_TYPES.has(node.dataset.nodeType)) {
    const quote = workflowGenerationCreditDetails(node);
    const prefix = quote.maximum ? "最多 " : quote.minimum ? "至少 " : "";
    return { value:`${prefix}${quote.total}`, label:`${prefix}预计消耗 ${quote.total} Credits；${quote.detail}` };
  }
  const tool = node.querySelector('[data-node-field="tool"]')?.value || "";
  const localVideoTools = new Set(["extract_frame", "enhance_video", "trim_video", "crop_video"]);
  const localAudioTools = new Set(["trim", "normalize"]);
  if (node.dataset.nodeType === "video_tool" && localVideoTools.has(tool) || node.dataset.nodeType === "audio_tool" && localAudioTools.has(tool)) {
    return { value:"0", label:"本地处理，不消耗 Credits" };
  }
  return { value:"按实际", label:"按所选能力与模型的实际用量结算" };
}

function updateWorkflowNodeEditorCredit(node) {
  if (!workflowNodeEditorCredit || !node) return;
  const credit = workflowNodeEditorCreditDetails(node);
  const value = workflowNodeEditorCredit.querySelector("b");
  if (value) value.textContent = credit.value;
  workflowNodeEditorCredit.title = credit.label;
  workflowNodeEditorCredit.setAttribute("aria-label", credit.label);
}

function positionWorkflowNodeEditor(node) {
  if (!workflowNodeEditor || !workflowViewport || !node) return;
  if (workflowNodeEditor.classList.contains("is-expanded")) return;
  if (workflowNodeEditor.parentElement !== workflowViewport) workflowViewport.append(workflowNodeEditor);
  const scaledWidth = workflowNodeEditor.offsetWidth * workflowState.zoom;
  const nodeX = Number(node.dataset.x || 0);
  const nodeY = Number(node.dataset.y || 0);
  const nodeScreenLeft = workflowState.panX + nodeX * workflowState.zoom;
  const left = Math.max(12, Math.min(workflowViewport.clientWidth - scaledWidth - 112, nodeScreenLeft));
  const top = workflowState.panY + (nodeY + node.offsetHeight + 18) * workflowState.zoom;
  workflowNodeEditor.style.left = `${left}px`;
  workflowNodeEditor.style.top = `${top}px`;
  workflowNodeEditor.style.transform = `scale(${workflowState.zoom})`;
  workflowNodeEditor.style.transformOrigin = "top left";
}

function bindWorkflowNodeEditorActivation(node) {
  if (!node || WORKFLOW_STRUCTURAL_NODE_TYPES.has(node.dataset.nodeType) || node.dataset.editorActivationBound === "true") return;
  node.dataset.editorActivationBound = "true";
  node.tabIndex = 0;
  node.setAttribute("aria-label", workflowNodeUsesNaturalLanguagePrompt(node)
    ? `${node.querySelector("header b")?.textContent || "能力"}节点，按回车编辑提示词与参数`
    : `${node.querySelector("header b")?.textContent || "能力"}节点，按回车设置参数`);
  node.addEventListener("keydown", (event) => {
    if (event.target !== node || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    renderWorkflowNodeEditor(node);
  });
}

function renderWorkflowNodeEditor(node, { focusPrompt = true } = {}) {
  if (!workflowNodeEditor || !node || WORKFLOW_STRUCTURAL_NODE_TYPES.has(node.dataset.nodeType)) return;
  activeWorkflowEditorNode?.classList.remove("is-editor-active");
  activeWorkflowEditorNode = node;
  node.classList.add("is-editor-active");
  const usesNaturalLanguage = workflowNodeUsesNaturalLanguagePrompt(node);
  workflowNodeEditor.classList.toggle("is-compact", !usesNaturalLanguage);
  const promptSource = usesNaturalLanguage ? ensureWorkflowNodePromptState(node) : null;
  const promptKey = workflowNodePrimaryPromptKey(node);
  const promptDefinition = usesNaturalLanguage ? workflowNodeFieldDefinition(node, promptKey) : null;
  const promptField = workflowNodeEditorPrompt?.closest("label");
  if (promptField) promptField.hidden = !usesNaturalLanguage;
  if (workflowNodeEditorExpand) workflowNodeEditorExpand.hidden = !usesNaturalLanguage;
  if (!usesNaturalLanguage) workflowNodeEditor.classList.remove("is-expanded");
  workflowNodeEditor.setAttribute("aria-label", usesNaturalLanguage ? "节点提示词与参数" : "节点参数");
  if (workflowNodeEditorPromptLabel) workflowNodeEditorPromptLabel.textContent = promptDefinition?.label || "提示词 / 处理要求";
  if (workflowNodeEditorPrompt) {
    workflowNodeEditorPrompt.disabled = !usesNaturalLanguage;
    workflowNodeEditorPrompt.placeholder = promptSource?.placeholder || "描述希望生成或处理的内容";
    workflowNodeEditorPrompt.value = promptSource?.value || "";
  }
  renderWorkflowNodeEditorFields(node);
  updateWorkflowNodeSummary(node);
  workflowNodeEditor.hidden = false;
  updateWorkflowNodeEditorCredit(node);
  positionWorkflowNodeEditor(node);
  if (focusPrompt && usesNaturalLanguage) requestAnimationFrame(() => workflowNodeEditorPrompt?.focus());
}

function closeWorkflowNodeEditor() {
  activeWorkflowEditorNode?.classList.remove("is-editor-active");
  activeWorkflowEditorNode = null;
  if (workflowNodeEditor) {
    workflowNodeEditor.classList.remove("is-expanded");
    workflowNodeEditor.hidden = true;
  }
  if (workflowNodeEditorExpand) {
    workflowNodeEditorExpand.setAttribute("aria-expanded", "false");
    workflowNodeEditorExpand.setAttribute("aria-label", "全屏编辑");
    workflowNodeEditorExpand.title = "全屏编辑";
  }
}

async function setWorkflowNodeEditorExpanded(expanded) {
  workflowNodeEditorExpand.disabled = true;
  if (expanded) {
    workflowNodeEditor.style.removeProperty("left");
    workflowNodeEditor.style.removeProperty("top");
    workflowNodeEditor.classList.add("is-expanded");
    workflowNodeEditorExpand.setAttribute("aria-expanded", "true");
    workflowNodeEditorExpand.setAttribute("aria-label", "还原编辑器");
    workflowNodeEditorExpand.title = "还原编辑器";
    await workflowNodeEditor.animate(
      [{ opacity:.55, clipPath:"inset(34% 8% 34% 8% round 24px)" }, { opacity:1, clipPath:"inset(0 0 0 0 round 24px)" }],
      { duration:260, easing:"cubic-bezier(.2,.8,.2,1)" },
    ).finished;
  } else {
    await workflowNodeEditor.animate(
      [{ opacity:1, clipPath:"inset(0 0 0 0 round 24px)" }, { opacity:.55, clipPath:"inset(34% 8% 34% 8% round 24px)" }],
      { duration:210, easing:"cubic-bezier(.4,0,.2,1)" },
    ).finished;
    workflowNodeEditor.classList.remove("is-expanded");
    workflowNodeEditorExpand.setAttribute("aria-expanded", "false");
    workflowNodeEditorExpand.setAttribute("aria-label", "全屏编辑");
    workflowNodeEditorExpand.title = "全屏编辑";
    positionWorkflowNodeEditor(activeWorkflowEditorNode);
  }
  workflowNodeEditorExpand.disabled = false;
}

function createWorkflowCameraSummary(article) {
  const summary = document.createElement("div");
  summary.className = "workflow-camera-summary";
  summary.dataset.cameraSummary = "true";
  article.append(summary);
}

function createDynamicWorkflowNode(type, x, y, providedId = "", config = {}) {
  const baseTemplate = WORKFLOW_NODE_TEMPLATES.find((item) => item.type === type);
  const capabilityId = String(config?.capability_id || "").slice(0, 64);
  const capabilityTemplate = capabilityId
    ? workflowCapabilityTemplates().find((item) => item.capabilityId === capabilityId && item.type === type)
    : null;
  const template = capabilityTemplate || baseTemplate;
  if (!template || !workflowBoard || template.ready === false) return null;
  const safeId = /^[a-z0-9-]{1,64}$/.test(providedId) ? providedId : `node-${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`;
  const article = document.createElement("article");
  article.className = "workflow-node workflow-node-dynamic";
  article.dataset.workflowNode = type;
  article.dataset.nodeId = safeId;
  article.dataset.nodeType = type;
  article.dataset.nodeCategory = template.category;
  article.tabIndex = WORKFLOW_STRUCTURAL_NODE_TYPES.has(type) ? -1 : 0;
  if (capabilityId) article.dataset.capabilityId = capabilityId;
  article.dataset.dynamic = "true";
  if (type === "media_input") {
    article.dataset.assetUrl = String(config?.url || "").slice(0, 500);
    article.dataset.assetPrompt = String(config?.prompt || "").slice(0, 1000);
    article.dataset.assetKind = String(config?.kind || "text").slice(0, 32);
    article.dataset.assetId = String(config?.asset_id || "").slice(0, 100);
    article.dataset.assetType = String(config?.asset_type || config?.input_type || "image").slice(0, 16);
  }
  if (template.defaultModel && !config.model) config = { ...config, model:template.defaultModel };
  article.classList.add(`workflow-node-${type}`);
  if (["media-output", "text-output"].includes(template.custom)) article.classList.add("workflow-node-output");
  article.dataset.x = String(Math.max(-50000, Math.min(50000, Number(x) || 520)));
  article.dataset.y = String(Math.max(-50000, Math.min(50000, Number(y) || 320)));
  const header = document.createElement("header");
  const icon = document.createElement("span");
  icon.append(createWorkflowIcon(template.icon));
  const copy = document.createElement("div");
  const title = document.createElement("b");
  title.textContent = template.label;
  copy.append(title);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "workflow-node-remove";
  remove.setAttribute("aria-label", `删除${template.label}节点`);
  remove.append(createWorkflowIcon("close"));
  header.append(icon, copy, remove);
  article.append(header);
  (template.inputs || []).forEach((port, index) => article.append(createWorkflowPort("input", safeId, template.label, port, index, template.inputs.length)));
  if (template.custom === "media-input") createWorkflowUnifiedInputBody(article);
  if (template.custom === "image") createWorkflowUploadBody(article);
  if (template.custom === "video" || template.custom === "audio") createWorkflowMediaUploadBody(article, template.custom);
  if (template.custom === "mask") createWorkflowMaskBody(article);
  if (template.custom === "image-tool") createWorkflowMaskBody(article);
  template.fields.forEach((field) => article.append(createWorkflowField(field)));
  if (type === "image_tool") createWorkflowInlineToolPicker(article);
  if (["image_generator", "video_generator"].includes(type)) createWorkflowPromptMentionPicker(article);
  if (WORKFLOW_GENERATION_NODE_TYPES.has(type)) article.append(createWorkflowCreditSummary());
  if (template.custom === "camera") createWorkflowCameraSummary(article);
  if (["media-output", "text-output"].includes(template.custom)) createWorkflowOutputBody(article);
  ensureWorkflowNodeRunButton(article);
  (template.outputs || []).forEach((port, index) => article.append(createWorkflowPort("output", safeId, template.label, port, index, template.outputs.length)));
  Object.entries(config && typeof config === "object" ? config : {}).forEach(([key, value]) => {
    const control = [...article.querySelectorAll("[data-node-field]")].find((item) => item.dataset.nodeField === key);
    if (!control || !["string", "number", "boolean"].includes(typeof value)) return;
    if (control instanceof HTMLSelectElement && ![...control.options].some((option) => option.value === String(value))) return;
    if (control instanceof HTMLInputElement && control.type === "checkbox") control.checked = Boolean(value);
    else control.value = String(value);
  });
  const inlineTool = article.querySelector("[data-workflow-inline-tool]");
  const toolControl = article.querySelector('[data-node-field="tool"]');
  if (inlineTool instanceof HTMLSelectElement && toolControl instanceof HTMLSelectElement) inlineTool.value = toolControl.value;
  syncWorkflowModelDecorations(article);
  syncWorkflowGenerationCredits(article);
  if (type === "media_input") {
    const assetUrl = safeGeneratedImageUrl(config?.url || "");
    const kind = ["image", "video", "audio"].includes(config?.input_type) ? config.input_type : "image";
    if (assetUrl) {
      workflowNodeImageStates.set(safeId, { url:assetUrl, kind, assetId:String(config?.asset_id || ""), assetType:String(config?.asset_type || kind), mediaType:String(config?.media_type || `${kind}/${kind === "video" ? "mp4" : kind === "audio" ? "wav" : "png"}`) });
      const preview = kind === "image" ? article.querySelector('[data-workflow-input-branch="image"] img') : article.querySelector(`.workflow-node-upload-${kind} ${kind}`);
      if (preview) {
        preview.src = assetUrl;
        preview.hidden = false;
        if (kind !== "image") preview.load();
        preview.closest(".workflow-node-upload")?.classList.add("has-image");
      }
      if (kind !== "image") {
        const assetSelect = article.querySelector(`[data-workflow-asset-select="${kind}"]`);
        populateWorkflowAssetSelect(assetSelect, kind);
        if (assetSelect && [...assetSelect.options].some((option) => option.value === String(config?.asset_id || ""))) assetSelect.value = String(config.asset_id);
      }
    }
  }
  remove.addEventListener("click", () => {
    if (activeWorkflowEditorNode === article) closeWorkflowNodeEditor();
    disposeWorkflowCameraWorkbench(article);
    const mediaState = workflowNodeImageStates.get(safeId);
    if (mediaState?.objectUrl) URL.revokeObjectURL(mediaState.objectUrl);
    workflowNodeImageStates.delete(safeId);
    workflowEdges = workflowEdges.filter((edge) => edge.from_node !== safeId && edge.to_node !== safeId);
    article.remove();
    updateWorkflowLines();
  });
  workflowBoard.append(article);
  positionWorkflowNode(article);
  bindWorkflowNodeEditorActivation(article);
  bindDynamicWorkflowNode(article);
  bindWorkflowNodeControls(article);
  syncCanonicalWorkflowNode(article);
  updateWorkflowCameraSummary(article);
  updateWorkflowLines();
  return article;
}

function bindDynamicWorkflowNode(node) {
  const handle = node.querySelector("header");
  if (!handle || handle.dataset.dragBound === "true") return;
  handle.dataset.dragBound = "true";
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target instanceof Element && event.target.closest("button")) return;
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = Number(node.dataset.x);
    const originY = Number(node.dataset.y);
    let dragged = false;
    node.classList.add("is-dragging");
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      if (!dragged && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
      dragged = true;
      node.dataset.x = String(Math.max(-50000, Math.min(50000, originX + (moveEvent.clientX - startX) / workflowState.zoom)));
      node.dataset.y = String(Math.max(-50000, Math.min(50000, originY + (moveEvent.clientY - startY) / workflowState.zoom)));
      positionWorkflowNode(node);
      if (activeWorkflowEditorNode === node) positionWorkflowNodeEditor(node);
      updateWorkflowLines();
    };
    const end = (upEvent) => {
      node.classList.remove("is-dragging");
      if (dragged) {
        node.dataset.suppressEditorClick = "true";
        requestAnimationFrame(() => { delete node.dataset.suppressEditorClick; });
      }
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      if (handle.hasPointerCapture(upEvent.pointerId)) handle.releasePointerCapture(upEvent.pointerId);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end, { once:true });
  });
}

function createWorkflowPort(direction, nodeId, label, definition = {}, index = 0, total = 1) {
  const port = document.createElement("button");
  port.type = "button";
  port.className = `workflow-port workflow-port-${direction === "input" ? "in" : "out"}`;
  port.dataset.portDirection = direction;
  port.dataset.portNode = nodeId;
  port.dataset.portName = definition.name || (direction === "input" ? "input" : "output");
  port.dataset.portType = definition.type || "any";
  port.dataset.portLabel = definition.label || (direction === "input" ? "输入" : "输出");
  if (total > 1) {
    port.dataset.portIndex = String(index);
    port.style.setProperty("--port-top", `${82 + index * 38}px`);
  }
  port.setAttribute("aria-label", `${direction === "input" ? "连接到" : "从"}${label}的${port.dataset.portLabel}${direction === "input" ? "输入" : "输出"}`);
  return port;
}

function updateWorkflowCameraSummary(node) {
  if (!node || !(node.dataset.nodeType === "multiangle" || node.dataset.nodeType === "image_tool" && node.querySelector('[data-node-field="tool"]')?.value === "multiangle")) return;
  const value = (key, fallback) => Number(node.querySelector(`[data-node-field="${key}"]`)?.value ?? fallback);
  const azimuth = value("azimuth", 45);
  const elevation = value("elevation", 30);
  const distance = value("distance", 5.4);
  const normalized = ((azimuth + 180) % 360 + 360) % 360 - 180;
  const horizontal = Math.abs(normalized) <= 22 ? "正面" : normalized > 0 && normalized < 75 ? "右前四分之三" : normalized < 0 && normalized > -75 ? "左前四分之三" : normalized >= 75 && normalized < 120 ? "右侧面" : normalized <= -75 && normalized > -120 ? "左侧面" : "后侧";
  const vertical = elevation < 8 ? "低机位" : elevation < 25 ? "平视" : elevation < 55 ? "高机位" : "俯拍";
  const framing = distance < 4 ? "近景" : distance < 7.5 ? "中景" : "远景";
  const summary = node.querySelector("[data-camera-summary]");
  if (summary) summary.textContent = `${horizontal} · ${vertical} · ${framing}`;
  node.dataset.cameraPrompt = `${horizontal}视角，${vertical}，${framing}`;
}

function createWorkflowInlineToolPicker(article) {
  const source = article.querySelector('[data-node-field="tool"]');
  if (!(source instanceof HTMLSelectElement)) return;
  const picker = document.createElement("label");
  picker.className = "workflow-inline-tool-picker";
  picker.dataset.workflowInlineTool = "true";
  const caption = document.createElement("span");
  caption.textContent = "图片能力";
  const select = source.cloneNode(true);
  select.removeAttribute("data-node-field");
  select.removeAttribute("id");
  select.removeAttribute("name");
  select.value = source.value;
  select.addEventListener("change", () => {
    source.value = select.value;
    source.dispatchEvent(new Event("change", { bubbles:true }));
  });
  source.addEventListener("change", () => { select.value = source.value; });
  picker.append(caption, select);
  article.querySelector(":scope > header")?.after(picker);
}

function workflowCameraSourceUrl(node) {
  const own = workflowImageUrlForNode(node);
  if (own) return own;
  const edge = workflowEdges.find((item) => item.to_node === node.dataset.nodeId && item.to_port === "image1");
  return workflowImageUrlForNode(edge ? workflowBoard?.querySelector(`[data-node-id="${edge.from_node}"]`) : null);
}

function createWorkflowCameraWorkbench(node) {
  const panel = document.createElement("section");
  panel.className = "workflow-camera-workbench";
  panel.dataset.workflowCameraWorkbench = "true";
  const heading = document.createElement("div");
  heading.className = "workflow-camera-workbench-heading";
  const title = document.createElement("b");
  title.textContent = "三维机位";
  const summary = document.createElement("output");
  summary.dataset.workflowCameraSummary = "true";
  const expand = document.createElement("button");
  expand.type = "button";
  expand.className = "workflow-camera-workbench-expand";
  expand.setAttribute("aria-label", "放大三维机位");
  expand.title = "放大三维机位";
  expand.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /></svg>';
  heading.append(title, summary, expand);
  const stage = document.createElement("div");
  stage.className = "workflow-camera-stage";
  stage.dataset.workflowCameraStage = "true";
  const hint = document.createElement("small");
  hint.textContent = "拖动黑色摄像机调整机位 · 拖动空白处旋转场景 · 滚轮缩放";
  panel.append(heading, stage, hint);
  node.querySelector("[data-workflow-inline-tool]")?.after(panel);
  return { node, panel, stage, expand };
}

function openWorkflowCameraWorkbenchFocus(workspace) {
  workflowCameraFocusWorkspace?.focusDialog?.close();
  const dialog = document.createElement("dialog");
  dialog.className = "workflow-camera-focus-dialog";
  dialog.setAttribute("aria-label", "放大三维机位");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "workflow-camera-focus-close";
  close.setAttribute("aria-label", "关闭放大三维机位");
  close.append(createWorkflowIcon("close"));
  close.addEventListener("click", () => dialog.close());
  workspace.focusDialog = dialog;
  workflowCameraFocusWorkspace = workspace;
  workspace.expand.setAttribute("aria-expanded", "true");
  dialog.append(close, workspace.panel);
  dialog.addEventListener("close", () => {
    workspace.node.querySelector("[data-workflow-inline-tool]")?.after(workspace.panel);
    workspace.focusDialog = null;
    workspace.expand.setAttribute("aria-expanded", "false");
    workflowCameraFocusWorkspace = null;
    requestAnimationFrame(() => workspace.resize());
    dialog.remove();
  }, { once:true });
  document.body.append(dialog);
  dialog.showModal();
  requestAnimationFrame(() => workspace.resize());
}

function disposeWorkflowCameraWorkbench(node) {
  const workspace = workflowCameraWorkspaces.get(node);
  if (!workspace) return;
  workspace.focusDialog?.close();
  workspace.resizeObserver?.disconnect();
  workspace.controls?.dispose();
  workspace.renderer?.dispose();
  workspace.panel.remove();
  workflowCameraWorkspaces.delete(node);
}

function updateWorkflowCameraWorkbench(workspace) {
  const { node } = workspace;
  const value = (key, fallback) => Number(node.querySelector(`[data-node-field="${key}"]`)?.value ?? fallback);
  const azimuth = value("azimuth", 45);
  const elevation = value("elevation", 30);
  const distance = value("distance", 5.4);
  const radians = azimuth * Math.PI / 180;
  const elevationRadians = elevation * Math.PI / 180;
  const radius = 1.15 + distance * .56;
  const planarRadius = radius * Math.cos(elevationRadians);
  const position = new THREE.Vector3(
    planarRadius * Math.cos(radians),
    planarRadius * Math.sin(radians),
    radius * Math.sin(elevationRadians),
  );
  const direction = workspace.target.clone().sub(position);
  const targetDistance = direction.length();
  const targetDirection = direction.normalize();
  const targetSurfaceDistance = .85 / Math.max(Math.abs(targetDirection.x), Math.abs(targetDirection.y), Math.abs(targetDirection.z));
  const beamStart = .72;
  const beamLength = Math.max(.1, targetDistance - targetSurfaceDistance - beamStart);
  workspace.cameraRig.position.copy(position);
  workspace.cameraRig.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), targetDirection);
  workspace.beam.scale.y = beamLength;
  workspace.beam.position.x = beamStart + beamLength / 2;
  const source = workflowCameraSourceUrl(node);
  if (source !== workspace.previewUrl) {
    workspace.previewUrl = source;
    workspace.previewPlane.visible = Boolean(source);
    workspace.previewFrame.visible = Boolean(source);
    workspace.previewMaterial.map = null;
    if (source) {
      new THREE.TextureLoader().load(source, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        workspace.previewMaterial.map = texture;
        workspace.previewMaterial.needsUpdate = true;
        workspace.render();
      });
    }
  }
  const normalized = ((azimuth + 180) % 360 + 360) % 360 - 180;
  const horizontal = Math.abs(normalized) <= 22 ? "正面" : normalized > 0 && normalized < 75 ? "右前 3/4" : normalized < 0 && normalized > -75 ? "左前 3/4" : normalized >= 75 && normalized < 120 ? "右侧" : normalized <= -75 && normalized > -120 ? "左侧" : "背面";
  const vertical = elevation < 8 ? "低机位" : elevation < 25 ? "平视" : elevation < 55 ? "高机位" : "俯拍";
  workspace.summary.textContent = `${horizontal} · ${vertical} · ${distance.toFixed(1)}`;
  workspace.render();
}

async function initializeWorkflowCameraWorkbench(node, seed) {
  await loadCameraModules();
  if (workflowCameraWorkspaces.get(node) !== seed) return;
  const { stage } = seed;
  const colors = cameraThemeColors();
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.append(renderer.domElement);
  const viewCamera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  viewCamera.up.set(0, 0, 1);
  viewCamera.position.set(7, 8, 6.4);
  const controls = new OrbitControls(viewCamera, renderer.domElement);
  controls.target.set(0, 0, .7);
  controls.minDistance = 4.4;
  controls.maxDistance = 17;
  controls.update();
  const render = () => renderer.render(scene, viewCamera);
  controls.addEventListener("change", render);
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    viewCamera.aspect = width / height;
    viewCamera.updateProjectionMatrix();
    render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  const hemisphereLight = new THREE.HemisphereLight(colors.surface, colors.primaryInk, 2.1);
  const keyLight = new THREE.DirectionalLight(colors.surface, 2.8);
  keyLight.position.set(4, -5, 8);
  scene.add(hemisphereLight, keyLight);
  const grid = createCameraGrid(colors);
  scene.add(grid);
  const axisGroup = new THREE.Group();
  const axisEntries = [
    { direction:new THREE.Vector3(1, 0, 0), colorKey:"accent", text:"X", position:new THREE.Vector3(2.45, 0, .12) },
    { direction:new THREE.Vector3(0, 1, 0), colorKey:"primary", text:"Y", position:new THREE.Vector3(0, 2.45, .12) },
    { direction:new THREE.Vector3(0, 0, 1), colorKey:"info", text:"Z", position:new THREE.Vector3(0, 0, 2.55) },
  ].map((definition) => {
    const arrow = new THREE.ArrowHelper(definition.direction, new THREE.Vector3(), 2.15, colors[definition.colorKey], .26, .12);
    const labelSprite = cameraAxisLabel(definition.text, colors[definition.colorKey], colors.surface, definition.position);
    axisGroup.add(arrow, labelSprite);
    return { ...definition, arrow, labelSprite };
  });
  scene.add(axisGroup);
  const orbit = new THREE.Mesh(
    new THREE.RingGeometry(3.85, 3.91, 96),
    new THREE.MeshBasicMaterial({ color:colors.primary, transparent:true, opacity:.48, side:THREE.DoubleSide }),
  );
  scene.add(orbit);
  const target = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.7, 1.7),
    new THREE.MeshStandardMaterial({ color:colors.primarySoft, transparent:true, opacity:.12, depthWrite:false, roughness:.64, metalness:.05 }),
  );
  cube.position.z = .85;
  target.add(cube);
  const cubeEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineDashedMaterial({ color:colors.primaryInk, dashSize:.14, gapSize:.1 }),
  );
  cubeEdges.position.copy(cube.position);
  cubeEdges.computeLineDistances();
  target.add(cubeEdges);
  const planeBasis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
  const previewPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3),
    new THREE.MeshBasicMaterial({ color:colors.surface, transparent:true, opacity:.9, side:THREE.DoubleSide }),
  );
  previewPlane.quaternion.setFromRotationMatrix(planeBasis);
  previewPlane.position.z = .85;
  previewPlane.visible = false;
  target.add(previewPlane);
  const previewFrame = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.7, -.7, 0), new THREE.Vector3(.7, -.7, 0), new THREE.Vector3(.7, .7, 0), new THREE.Vector3(-.7, .7, 0)]),
    new THREE.LineBasicMaterial({ color:colors.primary }),
  );
  previewFrame.quaternion.setFromRotationMatrix(planeBasis);
  previewFrame.position.z = .85;
  previewFrame.visible = false;
  target.add(previewFrame);
  scene.add(target);
  const cameraRig = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(.68, 1, 32, 1, true),
    new THREE.MeshBasicMaterial({ color:colors.accent, transparent:true, opacity:.28, side:THREE.DoubleSide, depthWrite:false }),
  );
  beam.rotation.z = Math.PI / 2;
  cameraRig.add(beam);
  const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(.92, .65, .55), new THREE.MeshStandardMaterial({ color:0x0c0f0e, roughness:.32, metalness:.5 }));
  cameraBody.position.x = -.28;
  const cameraTop = new THREE.Mesh(new THREE.BoxGeometry(.36, .28, .18), new THREE.MeshStandardMaterial({ color:0x171c1a, roughness:.3, metalness:.44 }));
  cameraTop.position.set(-.32, 0, .34);
  const cameraLens = new THREE.Mesh(new THREE.ConeGeometry(.4, .72, 4), new THREE.MeshStandardMaterial({ color:0x050706, roughness:.24, metalness:.62 }));
  cameraLens.rotation.z = -Math.PI / 2;
  cameraLens.position.x = .48;
  const lensRim = new THREE.Mesh(new THREE.BoxGeometry(.08, .52, .52), new THREE.MeshStandardMaterial({ color:0x2c3430, roughness:.28, metalness:.7 }));
  lensRim.position.x = .66;
  const cameraLight = new THREE.PointLight(colors.accent, 2.5, 5);
  cameraLight.position.x = .72;
  cameraRig.add(cameraBody, cameraTop, cameraLens, lensRim, cameraLight);
  scene.add(cameraRig);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cameraParts = [cameraBody, cameraTop, cameraLens, lensRim];
  const dragPlane = new THREE.Plane();
  const dragOrigin = new THREE.Vector3();
  const dragStartPoint = new THREE.Vector3();
  const dragPoint = new THREE.Vector3();
  let draggingCamera = false;
  let dragPointerId = null;
  const pointerPosition = (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
  };
  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerPosition(event);
    raycaster.setFromCamera(pointer, viewCamera);
    if (!raycaster.intersectObjects(cameraParts, false).length) return;
    viewCamera.getWorldDirection(dragPlane.normal);
    dragPlane.setFromNormalAndCoplanarPoint(dragPlane.normal, cameraRig.position);
    if (!raycaster.ray.intersectPlane(dragPlane, dragStartPoint)) return;
    draggingCamera = true;
    dragPointerId = event.pointerId;
    dragOrigin.copy(cameraRig.position);
    controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!draggingCamera) return;
    pointerPosition(event);
    raycaster.setFromCamera(pointer, viewCamera);
    if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return;
    const orbitVector = dragOrigin.clone().add(dragPoint).sub(dragStartPoint).normalize();
    const azimuth = Math.atan2(orbitVector.y, orbitVector.x) * 180 / Math.PI;
    const elevation = Math.asin(orbitVector.z) * 180 / Math.PI;
    const azimuthControl = node.querySelector('[data-node-field="azimuth"]');
    const elevationControl = node.querySelector('[data-node-field="elevation"]');
    azimuthControl.value = String(azimuth);
    elevationControl.value = String(Math.max(-30, Math.min(75, elevation)));
    azimuthControl.dispatchEvent(new Event("input", { bubbles:true }));
    elevationControl.dispatchEvent(new Event("input", { bubbles:true }));
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  const finishCameraDrag = () => {
    if (!draggingCamera) return;
    draggingCamera = false;
    controls.enabled = true;
    if (renderer.domElement.hasPointerCapture(dragPointerId)) renderer.domElement.releasePointerCapture(dragPointerId);
    dragPointerId = null;
  };
  renderer.domElement.addEventListener("pointerup", finishCameraDrag, true);
  renderer.domElement.addEventListener("pointercancel", finishCameraDrag, true);
  renderer.domElement.addEventListener("lostpointercapture", finishCameraDrag, true);
  window.addEventListener("pointerup", finishCameraDrag, true);
  Object.assign(seed, {
    ready:true, scene, renderer, controls, render, resize, resizeObserver, grid, orbit, axisGroup, axisEntries,
    cubeMaterial:cube.material, cubeEdgesMaterial:cubeEdges.material, previewPlane, previewFrame,
    previewMaterial:previewPlane.material, previewFrameMaterial:previewFrame.material,
    cameraRig, beam, beamMaterial:beam.material, cameraLight, hemisphereLight, keyLight,
    target:new THREE.Vector3(0, 0, .85), summary:seed.panel.querySelector("[data-workflow-camera-summary]"),
  });
  seed.expand.addEventListener("click", () => openWorkflowCameraWorkbenchFocus(seed));
  applyCameraWorkspaceTheme(seed, colors);
  resize();
  updateWorkflowCameraWorkbench(seed);
}

function syncWorkflowCameraWorkbench(node) {
  const isMultiangle = node?.dataset.nodeType === "image_tool" && node.querySelector('[data-node-field="tool"]')?.value === "multiangle";
  if (!isMultiangle) {
    disposeWorkflowCameraWorkbench(node);
    return;
  }
  const existing = workflowCameraWorkspaces.get(node);
  if (existing) {
    if (existing.ready) updateWorkflowCameraWorkbench(existing);
    return;
  }
  const seed = createWorkflowCameraWorkbench(node);
  workflowCameraWorkspaces.set(node, seed);
  void initializeWorkflowCameraWorkbench(node, seed);
}

function repaintWorkflowMask(node) {
  const state = workflowMaskStates.get(node);
  const canvas = node.querySelector("[data-workflow-mask-stage] canvas");
  if (!state || !canvas || !state.image?.complete) return;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  context.save();
  context.globalAlpha = .48;
  context.fillStyle = "#f0447d";
  context.globalCompositeOperation = "source-over";
  const tint = document.createElement("canvas");
  tint.width = canvas.width;
  tint.height = canvas.height;
  const tintContext = tint.getContext("2d");
  tintContext.fillStyle = "#f0447d";
  tintContext.fillRect(0, 0, tint.width, tint.height);
  tintContext.globalCompositeOperation = "destination-in";
  tintContext.drawImage(state.mask, 0, 0);
  context.drawImage(tint, 0, 0);
  context.restore();
}

function initializeWorkflowMaskNode(node, sourceUrl) {
  const canvas = node?.querySelector("[data-workflow-mask-stage] canvas");
  if (!node || !canvas || !sourceUrl) return;
  const previous = workflowMaskStates.get(node);
  if (previous?.sourceUrl === sourceUrl && previous.image?.complete) return;
  const image = new Image();
  image.referrerPolicy = "no-referrer";
  image.onload = () => {
    const maxWidth = 760;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    const mask = document.createElement("canvas");
    mask.width = canvas.width;
    mask.height = canvas.height;
    workflowMaskStates.set(node, { sourceUrl, image, mask, hasPaint:false, drawing:false });
    node.querySelector("[data-mask-empty]")?.setAttribute("hidden", "");
    repaintWorkflowMask(node);
  };
  image.onerror = () => showWorkflowToast("这张原图无法载入重绘画笔");
  image.src = sourceUrl;
}

function syncWorkflowRedrawSources() {
  workflowBoard?.querySelectorAll('[data-node-type="redraw"], [data-node-type="image_tool"]').forEach((node) => {
    if (node.dataset.nodeType === "image_tool" && node.querySelector('[data-node-field="tool"]')?.value !== "redraw") return;
    const own = workflowNodeImageStates.get(node.dataset.nodeId)?.url;
    const inputPort = node.dataset.nodeType === "image_tool" ? "image1" : "image";
    const edge = workflowEdges.find((item) => item.to_node === node.dataset.nodeId && item.to_port === inputPort);
    const upstream = edge ? workflowBoard.querySelector(`[data-node-id="${edge.from_node}"]`) : null;
    const sourceUrl = own || workflowImageUrlForNode(upstream);
    if (sourceUrl) initializeWorkflowMaskNode(node, sourceUrl);
  });
}

function syncWorkflowVideoReferencePorts(node) {
  if (!node || node.dataset.nodeType !== "video_generator") return;
  node.style.minHeight = "";
  const naturalHeight = node.offsetHeight;
  const mode = node.querySelector('[data-node-field="mode"]')?.value || "text_to_video";
  const modelControl = node.querySelector('[data-node-field="model"]');
  const h3Allowed = ["text_to_video", "image_to_video"].includes(mode);
  const h3Option = modelControl?.querySelector('option[value="minimax_h3_max"]');
  if (h3Option) {
    h3Option.hidden = !h3Allowed;
    h3Option.disabled = !h3Allowed;
  }
  if (!h3Allowed && modelControl?.value === "minimax_h3_max") {
    modelControl.value = [...modelControl.options].find((option) => !option.disabled)?.value || "";
  }
  const model = modelControl?.value || "wan2.7-t2v-2026-06-12";
  const referenceLimit = workflowVideoReferenceLimit(model, mode);
  const connected = new Set(workflowEdges
    .filter((edge) => edge.to_node === node.dataset.nodeId)
    .map((edge) => edge.to_port));
  let visibleReferences = [];
  if (mode === "first_last_to_video") {
    visibleReferences = WORKFLOW_VIDEO_REFERENCE_PORTS.slice(0, 2);
  } else if (["image_to_video", "reference_to_video"].includes(mode)) {
    const highestConnected = WORKFLOW_VIDEO_REFERENCE_PORTS.slice(0, referenceLimit).reduce((highest, name, index) => connected.has(name) ? index : highest, -1);
    visibleReferences = WORKFLOW_VIDEO_REFERENCE_PORTS.slice(0, Math.min(referenceLimit, Math.max(1, highestConnected + 2)));
  }
  const visible = new Set(visibleReferences);
  WORKFLOW_VIDEO_REFERENCE_PORTS.slice(referenceLimit).forEach((name) => { if (connected.has(name)) visible.add(name); });
  const portGap = referenceLimit <= 5 ? 38 : referenceLimit <= 9 ? 28 : 20;
  let highestVisibleIndex = -1;
  node.querySelectorAll('[data-port-direction="input"]').forEach((port) => {
    const progressive = WORKFLOW_VIDEO_REFERENCE_PORTS.includes(port.dataset.portName);
    port.toggleAttribute("data-progressive-reference", progressive);
    port.classList.toggle("is-connected", connected.has(port.dataset.portName));
    const portIndex = progressive ? WORKFLOW_VIDEO_REFERENCE_PORTS.indexOf(port.dataset.portName) : -1;
    const overLimit = progressive && portIndex >= referenceLimit && connected.has(port.dataset.portName);
    port.classList.toggle("is-over-limit", overLimit);
    if (progressive) {
      port.style.top = `${82 + portIndex * portGap}px`;
      port.style.setProperty("--port-hit-inset", `${-(portGap - 16) / 2}px`);
      if (visible.has(port.dataset.portName)) highestVisibleIndex = Math.max(highestVisibleIndex, portIndex);
      port.title = overLimit ? `当前模型最多参考 ${referenceLimit} 张图片，请删除这条连线` : `${port.dataset.portLabel} · 当前模型最多 ${referenceLimit} 张`;
    }
    port.hidden = !visible.has(port.dataset.portName);
  });
  node.dataset.referenceLimit = String(referenceLimit);
  const lastReferenceTop = highestVisibleIndex >= 0 ? 82 + highestVisibleIndex * portGap : 0;
  const requiredHeight = highestVisibleIndex >= 0 ? lastReferenceTop + 28 : naturalHeight;
  if (requiredHeight > naturalHeight) node.style.minHeight = `${requiredHeight}px`;
}

function syncWorkflowVideoResolutionOptions(node) {
  if (!["video_generator", "video_tool"].includes(node?.dataset.nodeType)) return;
  const model = node.querySelector('[data-node-field="model"]')?.value || "";
  const resolution = node.querySelector('[data-node-field="resolution"]');
  if (!(resolution instanceof HTMLSelectElement)) return;
  const h3Max = model === "minimax_h3_max";
  const allowed = h3Max ? new Set(["480P", "768P"]) : new Set(["480P", "720P", "1080P"]);
  [...resolution.options].forEach((option) => {
    option.hidden = !allowed.has(option.value);
    option.disabled = !allowed.has(option.value);
  });
  if (!allowed.has(resolution.value)) resolution.value = h3Max ? "768P" : "720P";
}

function syncWorkflowStructuralMediaNode(node) {
  if (!node || !["media_input", "media_output"].includes(node.dataset.nodeType)) return;
  const fieldName = node.dataset.nodeType === "media_input" ? "input_type" : "output_type";
  const typeControl = node.querySelector(`[data-node-field="${fieldName}"]`);
  const mediaType = ["image", "video", "audio"].includes(typeControl?.value) ? typeControl.value : "image";
  if (node.dataset.nodeType === "media_input") {
    node.querySelectorAll("[data-workflow-input-branch]").forEach((branch) => {
      branch.hidden = branch.dataset.workflowInputBranch !== mediaType;
    });
    node.querySelectorAll('[data-port-direction="output"]').forEach((port) => {
      port.hidden = port.dataset.portName !== mediaType;
      if (!port.hidden) port.style.removeProperty("--port-top");
    });
  } else {
    node.querySelectorAll('[data-port-direction="input"]').forEach((port) => {
      port.hidden = port.dataset.portName !== mediaType;
      if (!port.hidden) port.style.removeProperty("--port-top");
    });
    const format = node.querySelector('[data-node-field="format"]');
    const allowedFormats = {
      image:new Set(["png", "webp", "jpg"]),
      video:new Set(["mp4", "webm"]),
      audio:new Set(["wav"]),
    }[mediaType];
    if (format instanceof HTMLSelectElement) {
      [...format.options].forEach((option) => {
        option.hidden = !allowedFormats.has(option.value);
        option.disabled = !allowedFormats.has(option.value);
      });
      if (!allowedFormats.has(format.value)) format.value = [...allowedFormats][0];
    }
    const saveHistory = node.querySelector('[data-node-field="save_history"]')?.closest("label");
    if (saveHistory) saveHistory.hidden = mediaType !== "image";
  }
  node.dataset.activeMediaType = mediaType;
  requestAnimationFrame(updateWorkflowLines);
}

function syncCanonicalWorkflowNode(node) {
  if (!node || !WORKFLOW_CANONICAL_NODE_TYPES.has(node.dataset.nodeType)) return;
  const value = (key, fallback = "") => node.querySelector(`[data-node-field="${key}"]`)?.value || fallback;
  const showFields = (keys) => {
    const visible = new Set(keys);
    node.querySelectorAll("[data-node-field]").forEach((control) => {
      const label = control.closest("label");
      if (label) label.hidden = control.dataset.nodeField === "tool" && node.querySelector("[data-workflow-inline-tool]") ? true : !visible.has(control.dataset.nodeField);
    });
  };
  const showPorts = (names) => {
    const visible = new Set(names);
    node.querySelectorAll('[data-port-direction="input"]').forEach((port) => { port.hidden = !visible.has(port.dataset.portName); });
  };
  const showOutputPorts = (names) => {
    const visible = new Set(names);
    node.querySelectorAll('[data-port-direction="output"]').forEach((port) => { port.hidden = !visible.has(port.dataset.portName); });
  };
  if (node.dataset.nodeType === "image_generator") {
    showFields(["prompt", "model", "ratio", "resolution", "count"]);
    showPorts(["image1", "image2"]);
  } else if (node.dataset.nodeType === "image_tool") {
    const tool = value("tool", "edit");
    const localFields = {
      resize:["width","height","fit"], rotate:["degrees"], crop:["ratio"],
      collage:["columns","gap","background"], watermark:["text","position","opacity"], convert:["format","quality"],
    }[tool] || [];
    const specialFields = {
      multiview:["model","resolution","views"], multiangle:["model","resolution","azimuth","elevation","distance"],
      interactive:["model","resolution","selection"], upscale:["resolution"], cutout:[], layers:["model","resolution"],
    }[tool] || ["model","resolution"];
    const needsPrompt = WORKFLOW_IMAGE_TOOLS_WITH_NATURAL_LANGUAGE.has(tool);
    const promptControl = node.querySelector('[data-node-field="prompt"]');
    if (!needsPrompt && promptControl) promptControl.value = "";
    showFields(["tool", ...(needsPrompt ? ["prompt"] : []), ...(localFields.length ? localFields : specialFields), ...(tool === "redraw" ? ["brush"] : [])]);
    showPorts(tool === "collage" ? ["image1","image2","image3","image4"] : ["image1", ...(tool === "edit" ? ["image2"] : [])]);
    const mask = node.querySelector('[data-workflow-conditional="redraw-mask"]');
    if (mask) mask.hidden = tool !== "redraw";
    if (tool === "redraw") syncWorkflowRedrawSources();
  } else if (node.dataset.nodeType === "video_generator") {
    showFields(["prompt","mode","model","resolution","ratio","duration"]);
    syncWorkflowVideoReferencePorts(node);
    syncWorkflowVideoResolutionOptions(node);
  } else if (node.dataset.nodeType === "video_tool") {
    const tool = value("tool", "video_edit");
    const localTools = new Set(["extract_frame","enhance_video","trim_video","crop_video"]);
    const quickMode = ({ smart_cutout:"video_edit", segment_reshoot:"video_edit", lip_sync:"video_lip_sync", character_swap_video:"video_character_swap", digital_human:"video_digital_human" })[tool] || tool;
    const allowedModels = new Set(VIDEO_TOOL_MODEL_IDS[quickMode] || []);
    const modelControl = node.querySelector('[data-node-field="model"]');
    if (modelControl instanceof HTMLSelectElement) {
      [...modelControl.options].forEach((option) => {
        const allowed = localTools.has(tool) || allowedModels.has(option.value);
        option.hidden = !allowed;
        option.disabled = !allowed;
      });
      if (!localTools.has(tool) && !allowedModels.has(modelControl.value)) modelControl.value = [...allowedModels][0] || modelControl.value;
    }
    const fields = {
      extract_frame:["tool","frame_time"], enhance_video:["tool","enhance_scale"],
      trim_video:["tool","start_time","end_time"], crop_video:["tool","crop_ratio"],
      smart_cutout:["tool","prompt","model","resolution","background"],
      segment_reshoot:["tool","prompt","model","resolution","start_time","end_time"],
      video_edit:["tool","prompt","model","resolution","duration"], video_extension:["tool","prompt","model","resolution","duration"],
      video_style:["tool","prompt","model","resolution","style_id","duration"], lip_sync:["tool","model","duration"],
      character_swap_video:["tool","prompt","model","duration","consent"], video_depth:["tool","palette","target_fps","max_frames"],
      digital_human:["tool","prompt","model","duration"],
    }[tool] || ["tool"];
    const ports = {
      extract_frame:["video"], enhance_video:["video"], trim_video:["video"], crop_video:["video"],
      smart_cutout:["video"], segment_reshoot:["video","image"],
      video_edit:["video","image"], video_extension:["video","image"],
      video_style:["video"], lip_sync:["video","audio","image"],
      character_swap_video:["video","image"], video_depth:["video"],
      digital_human:["image","audio"],
    }[tool] || ["video"];
    showFields(fields);
    showPorts(ports);
    showOutputPorts(tool === "extract_frame" ? ["image"] : ["video"]);
  } else if (node.dataset.nodeType === "audio_generator") {
    const ability = value("ability", "text_dubbing");
    const modelControl = node.querySelector('[data-node-field="model"]');
    if (ability === "custom_voice") {
      if (modelControl) modelControl.value = "qwen3-tts-instruct-flash";
    }
    const voiceControl = node.querySelector('[data-node-field="voice"]');
    if (voiceControl instanceof HTMLSelectElement) {
      const doubao = modelControl?.value === "doubao-tts-2.0";
      [...voiceControl.options].forEach((option) => {
        const allowed = doubao ? option.value.startsWith("zh_") : !option.value.startsWith("zh_");
        option.hidden = !allowed;
        option.disabled = !allowed;
      });
      if (voiceControl.selectedOptions[0]?.disabled) voiceControl.value = doubao ? "zh_female_vv_uranus_bigtts" : "Cherry";
    }
    const fields = ability === "custom_voice"
      ? ["ability","voice_description","preview_text","model","language_type","speed_ratio"]
      : ["ability","text","model","voice","language_type","speed_ratio","emotion"];
    if (["reference_audio","custom_voice"].includes(ability)) fields.push("consent");
    showFields(fields);
    showPorts(ability === "image_dubbing" ? ["text","image"]
      : ability === "reference_audio" ? ["text","audio"]
      : ability === "custom_voice" ? ["audio"] : ["text"]);
  } else if (node.dataset.nodeType === "audio_tool") {
    const tool = value("tool", "trim");
    showFields(tool === "trim" ? ["tool","start","end"] : ["tool"]);
    showPorts(["audio"]);
  }
  updateWorkflowNodeSummary(node);
  syncWorkflowCameraWorkbench(node);
  requestAnimationFrame(updateWorkflowLines);
}

function bindWorkflowNodeControls(node) {
  if (!node || node.dataset.controlsBound === "true") return;
  node.dataset.controlsBound = "true";
  const syncWorkflowPricing = () => {
    syncWorkflowModelDecorations(node);
    syncWorkflowGenerationCredits(workflowBoard);
    updateWorkflowNodeSummary(node);
  };
  node.querySelectorAll("[data-node-field]").forEach((control) => {
    control.addEventListener("input", syncWorkflowPricing);
    control.addEventListener("change", syncWorkflowPricing);
  });
  const syncWorkflowImageEditorFields = () => {
    if (node.dataset.nodeType !== "image_editor") return;
    const operation = node.querySelector('[data-node-field="operation"]')?.value || "resize";
    const visible = new Set(({
      resize:["operation","width","height","fit"], rotate:["operation","degrees"],
      crop:["operation","ratio"], collage:["operation","columns","gap","background"],
      watermark:["operation","text","position","opacity"], convert:["operation","format","quality"],
    })[operation] || ["operation"]);
    node.querySelectorAll("[data-node-field]").forEach((control) => {
      const field = control.closest("label");
      if (field) field.hidden = !visible.has(control.dataset.nodeField);
    });
  };
  node.querySelector('[data-node-field="operation"]')?.addEventListener("change", syncWorkflowImageEditorFields);
  syncWorkflowImageEditorFields();
  node.querySelectorAll('[data-node-field="tool"], [data-node-field="mode"], [data-node-field="ability"]').forEach((control) => control.addEventListener("change", () => syncCanonicalWorkflowNode(node)));
  node.querySelectorAll('[data-node-field="input_type"], [data-node-field="output_type"]').forEach((control) => control.addEventListener("change", () => {
    const selectedType = control.value;
    if (node.dataset.nodeType === "media_input") {
      const previous = workflowNodeImageStates.get(node.dataset.nodeId);
      if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
      workflowNodeImageStates.delete(node.dataset.nodeId);
      node.dataset.assetUrl = "";
      node.dataset.assetId = "";
      node.dataset.assetType = selectedType;
      node.querySelectorAll('[data-workflow-input-branch] :is(img,video,audio)').forEach((preview) => {
        preview.removeAttribute("src");
        preview.hidden = true;
        preview.closest(".workflow-node-upload")?.classList.remove("has-image");
      });
      workflowEdges = workflowEdges.filter((edge) => edge.from_node !== node.dataset.nodeId || edge.from_port === selectedType);
    } else {
      workflowEdges = workflowEdges.filter((edge) => edge.to_node !== node.dataset.nodeId || edge.to_port === selectedType);
      createWorkflowOutputBodyPlaceholder(node);
    }
    syncWorkflowStructuralMediaNode(node);
  }));
  syncWorkflowStructuralMediaNode(node);
  syncCanonicalWorkflowNode(node);
  const workflowVideoModel = node.querySelector('[data-node-field="model"]');
  const workflowVideoDuration = node.querySelector('[data-node-field="duration"][type="range"]');
  const syncWorkflowVideoDuration = () => {
    if (!workflowVideoDuration || !workflowVideoModel || !String(node.dataset.nodeType || "").includes("video")) return;
    const model = workflowVideoModel.value;
    const seedance25 = model === "seedance_2_5";
    const seedance2 = SEEDANCE_MODEL_IDS.has(model) && !seedance25;
    const h3Max = model === "minimax_h3_max";
    const fixedVace = model === "wanx2.1-vace-plus";
    workflowVideoDuration.min = fixedVace || h3Max ? "5" : (seedance25 ? "0" : (seedance2 ? "4" : "2"));
    workflowVideoDuration.max = fixedVace ? "5" : (seedance25 ? "30" : (model === "wan2.7-videoedit" ? "10" : "15"));
    workflowVideoDuration.value = String(Math.min(Number(workflowVideoDuration.max), Math.max(Number(workflowVideoDuration.min), Number(workflowVideoDuration.value || 5))));
    const output = workflowVideoDuration.parentElement?.querySelector("output");
    if (output) output.textContent = seedance25 && workflowVideoDuration.value === "0" ? "自动" : workflowVideoDuration.value;
  };
  node.querySelector('[data-node-field="tool"]')?.addEventListener("change", syncWorkflowVideoDuration);
  workflowVideoModel?.addEventListener("change", () => {
    syncWorkflowVideoDuration();
    syncWorkflowVideoResolutionOptions(node);
    syncCanonicalWorkflowNode(node);
    if (node.querySelectorAll('.workflow-port.is-over-limit').length) showWorkflowToast(`当前模型最多参考 ${node.dataset.referenceLimit} 张图片，请删除超出的连线`);
  });
  syncWorkflowVideoDuration();
  if (workflowVideoModel) syncWorkflowVideoResolutionOptions(node);
  const fileInput = node.querySelector('[data-workflow-file="image"]');
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) return showWorkflowToast("请选择 PNG、JPG 或 WebP 图片");
    if (file.size > 15 * 1024 * 1024) return showWorkflowToast("图片不能超过 15MB");
    let preview = node.querySelector(".workflow-node-upload img");
    if (!preview) return;
    setWorkflowNodeImage(node, file, preview);
    node.dataset.assetType = "image";
  });
  ["video", "audio"].forEach((kind) => {
    const mediaInput = node.querySelector(`[data-workflow-file="${kind}"]`);
    mediaInput?.addEventListener("change", () => {
      const file = mediaInput.files?.[0];
      if (!file) return;
      const valid = kind === "video"
        ? (/^video\/(mp4|webm|quicktime)$/.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name))
        : (/^audio\/(wav|x-wav|mpeg|mp4|ogg)$/.test(file.type) || /\.(wav|mp3|m4a|ogg)$/i.test(file.name));
      if (!valid) return showWorkflowToast(kind === "video" ? "请选择 MP4、WebM 或 MOV 视频" : "请选择 WAV、MP3、M4A 或 OGG 音频");
      const limit = kind === "video" ? 200 * 1024 * 1024 : 30 * 1024 * 1024;
      if (file.size > limit) return showWorkflowToast(kind === "video" ? "视频不能超过 200MB" : "音频不能超过 30MB");
      const previous = workflowNodeImageStates.get(node.dataset.nodeId);
      if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
      const objectUrl = URL.createObjectURL(file);
      workflowNodeImageStates.set(node.dataset.nodeId, { file, url:objectUrl, objectUrl, kind });
      node.dataset.assetType = kind;
      const preview = node.querySelector(`.workflow-node-upload-${kind} ${kind}`);
      if (preview) { preview.src = objectUrl; preview.hidden = false; preview.load(); preview.closest(".workflow-node-upload")?.classList.add("has-image"); }
      uploadMediaPreviewBlob(file, file.name).then((previewUrl) => {
        if (!previewUrl || !node.isConnected || workflowNodeImageStates.get(node.dataset.nodeId)?.file !== file) return;
        const state = workflowNodeImageStates.get(node.dataset.nodeId);
        if (state?.objectUrl) URL.revokeObjectURL(state.objectUrl);
        workflowNodeImageStates.set(node.dataset.nodeId, { ...state, url:previewUrl, objectUrl:"" });
        if (preview) { preview.src = previewUrl; preview.load(); }
      }).catch(() => {});
    });
    const assetSelect = node.querySelector(`[data-workflow-asset-select="${kind}"]`);
    const refreshAssets = async () => {
      if (!assetItems.length) await loadWorkflowAssets();
      populateWorkflowAssetSelect(assetSelect, kind);
    };
    assetSelect?.addEventListener("focus", refreshAssets, { once:false });
    assetSelect?.addEventListener("pointerdown", refreshAssets, { once:false });
    assetSelect?.addEventListener("change", () => {
      const asset = assetItems.find((item) => item.id === assetSelect.value);
      if (!asset) return;
      const previous = workflowNodeImageStates.get(node.dataset.nodeId);
      if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
      workflowNodeImageStates.set(node.dataset.nodeId, { url:asset.url, kind, assetId:asset.id, assetType:asset.assetType, mediaType:asset.mediaType });
      node.dataset.assetUrl = new URL(asset.url).pathname;
      node.dataset.assetId = asset.id;
      node.dataset.assetType = asset.assetType;
      const preview = node.querySelector(`.workflow-node-upload-${kind} ${kind}`);
      if (preview) { preview.src = asset.url; preview.hidden = false; preview.load(); preview.closest(".workflow-node-upload")?.classList.add("has-image"); }
      showWorkflowToast(`已选择${assetTypeLabel(asset)}「${asset.name}」`);
    });
  });
  const redrawFile = node.querySelector('[data-workflow-file="redraw"]');
  node.querySelector("[data-mask-source]")?.addEventListener("click", () => redrawFile?.click());
  redrawFile?.addEventListener("change", () => {
    const file = redrawFile.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) return showWorkflowToast("请选择 PNG、JPG 或 WebP 图片");
    if (file.size > 15 * 1024 * 1024) return showWorkflowToast("图片不能超过 15MB");
    const previous = workflowNodeImageStates.get(node.dataset.nodeId);
    if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
    const objectUrl = URL.createObjectURL(file);
    workflowNodeImageStates.set(node.dataset.nodeId, { file, url:objectUrl, objectUrl });
    initializeWorkflowMaskNode(node, objectUrl);
  });
  node.querySelector("[data-mask-clear]")?.addEventListener("click", () => {
    const state = workflowMaskStates.get(node);
    if (!state) return;
    state.mask.getContext("2d").clearRect(0, 0, state.mask.width, state.mask.height);
    state.hasPaint = false;
    repaintWorkflowMask(node);
  });
  const brushControl = node.querySelector("[data-mask-brush]");
  const brushValue = node.querySelector("[data-mask-brush-value]");
  const syncBrushValue = () => {
    if (!brushControl || !brushValue) return;
    brushValue.value = brushControl.value;
    brushValue.textContent = `${brushControl.value}px`;
  };
  brushControl?.addEventListener("input", syncBrushValue);
  syncBrushValue();
  const canvas = node.querySelector("[data-workflow-mask-stage] canvas");
  const paint = (event) => {
    const state = workflowMaskStates.get(node);
    if (!state || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    const brush = Number(node.querySelector("[data-mask-brush]")?.value || 36) * canvas.width / rect.width;
    const context = state.mask.getContext("2d");
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(x, y, brush / 2, 0, Math.PI * 2);
    context.fill();
    state.hasPaint = true;
    repaintWorkflowMask(node);
  };
  canvas?.addEventListener("pointerdown", (event) => {
    const state = workflowMaskStates.get(node);
    if (!state) return showWorkflowToast("请先连接或选择一张原图");
    state.drawing = true;
    canvas.setPointerCapture(event.pointerId);
    paint(event);
  });
  canvas?.addEventListener("pointermove", (event) => { if (workflowMaskStates.get(node)?.drawing) paint(event); });
  canvas?.addEventListener("pointerup", (event) => {
    const state = workflowMaskStates.get(node);
    if (state) state.drawing = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  node.querySelectorAll('[data-node-field="azimuth"],[data-node-field="elevation"],[data-node-field="distance"]').forEach((input) => input.addEventListener("input", () => updateWorkflowCameraSummary(node)));
}

function workflowPortPoint(node, direction, portName = "") {
  const escapedName = window.CSS?.escape ? CSS.escape(portName) : portName.replace(/[^a-z0-9_-]/gi, "");
  const port = portName
    ? node.querySelector(`[data-port-direction="${direction}"][data-port-name="${escapedName}"]`)
    : node.querySelector(`[data-port-direction="${direction}"]`);
  if (port && workflowBoard) {
    const portRect = port.getBoundingClientRect();
    const boardRect = workflowBoard.getBoundingClientRect();
    const zoom = Number(workflowState.zoom) || 1;
    return {
      x:(portRect.left + portRect.width / 2 - boardRect.left) / zoom,
      y:(portRect.top + portRect.height / 2 - boardRect.top) / zoom,
    };
  }
  return {
    x:Number(node.dataset.x) + (direction === "output" ? node.offsetWidth : 0),
    y:Number(node.dataset.y) + node.offsetHeight / 2,
  };
}

function workflowPathData(fromPoint, toPoint) {
  const delta = toPoint.x - fromPoint.x;
  const bend = Math.max(54, Math.min(240, Math.abs(delta) * .46 + (delta < 0 ? 75 : 0)));
  return `M ${fromPoint.x} ${fromPoint.y} C ${fromPoint.x + bend} ${fromPoint.y}, ${toPoint.x - bend} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
}

function hideWorkflowEdgeDeleteButton() {
  if (!workflowEdgeDeleteButton) return;
  workflowEdgeDeleteButton.hidden = true;
  workflowEdgeDeleteButton.style.removeProperty("left");
  workflowEdgeDeleteButton.style.removeProperty("top");
}

function showWorkflowEdgeDeleteButton(path, clientX, clientY) {
  const shell = document.querySelector("#workflow-canvas-shell");
  if (!workflowEdgeDeleteButton || !shell || !path) return;
  const shellRect = shell.getBoundingClientRect();
  const pathRect = path.getBoundingClientRect();
  const anchorX = Number.isFinite(clientX) ? clientX : pathRect.left + pathRect.width / 2;
  const anchorY = Number.isFinite(clientY) ? clientY : pathRect.top + pathRect.height / 2;
  workflowEdgeDeleteButton.hidden = false;
  workflowEdgeDeleteButton.style.left = `${Math.max(62, Math.min(shellRect.width - 62, anchorX - shellRect.left))}px`;
  workflowEdgeDeleteButton.style.top = `${Math.max(52, Math.min(shellRect.height - 34, anchorY - shellRect.top - 24))}px`;
}

function deleteSelectedWorkflowEdge() {
  if (!selectedWorkflowEdgeId) return false;
  const before = workflowEdges.length;
  workflowEdges = workflowEdges.filter((edge) => edge.id !== selectedWorkflowEdgeId);
  selectedWorkflowEdgeId = "";
  hideWorkflowEdgeDeleteButton();
  if (workflowEdges.length === before) return false;
  updateWorkflowLines();
  syncWorkflowRedrawSources();
  showWorkflowToast("连线已删除");
  document.querySelector("#workflow-canvas-shell")?.focus({ preventScroll:true });
  return true;
}

function drawWorkflowLink(edge) {
  if (!workflowLines || !workflowBoard) return;
  const from = workflowBoard.querySelector(`[data-node-id="${edge.from_node}"]`);
  const to = workflowBoard.querySelector(`[data-node-id="${edge.to_node}"]`);
  const fromPort = from?.querySelector(`[data-port-direction="output"][data-port-name="${edge.from_port}"]`) || from?.querySelector('[data-port-direction="output"]');
  const toPort = to?.querySelector(`[data-port-direction="input"][data-port-name="${edge.to_port}"]`) || to?.querySelector('[data-port-direction="input"]');
  if (!from || !to || !fromPort || !toPort) return;
  const pathData = workflowPathData(
    workflowPortPoint(from, "output", fromPort.dataset.portName || "output"),
    workflowPortPoint(to, "input", toPort.dataset.portName || "input"),
  );
  const configurePath = (path) => {
    path.dataset.fromNode = edge.from_node;
    path.dataset.toNode = edge.to_node;
    path.dataset.fromPort = fromPort.dataset.portName || "output";
    path.dataset.toPort = toPort.dataset.portName || "input";
    path.dataset.portType = fromPort.dataset.portType || "any";
    path.setAttribute("d", pathData);
  };
  const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  configurePath(hitPath);
  hitPath.classList.add("workflow-link-hit");
  hitPath.dataset.link = edge.id;
  hitPath.setAttribute("tabindex", "0");
  hitPath.setAttribute("role", "button");
  hitPath.setAttribute("aria-label", `连接：${from.querySelector("header b")?.textContent || "节点"} 到 ${to.querySelector("header b")?.textContent || "节点"}；点击后可删除`);
  const visualPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  configurePath(visualPath);
  visualPath.classList.add("workflow-link-visible");
  visualPath.setAttribute("aria-hidden", "true");
  visualPath.classList.toggle("is-selected", edge.id === selectedWorkflowEdgeId);
  workflowLines.append(hitPath, visualPath);
}

function refreshWorkflowLineGeometry() {
  if (!workflowLines || !workflowBoard) return;
  workflowLines.querySelectorAll("path[data-from-node][data-to-node]").forEach((path) => {
    const from = workflowBoard.querySelector(`[data-node-id="${path.dataset.fromNode}"]`);
    const to = workflowBoard.querySelector(`[data-node-id="${path.dataset.toNode}"]`);
    if (!from || !to) return;
    path.setAttribute(
      "d",
      workflowPathData(
        workflowPortPoint(from, "output", path.dataset.fromPort || "output"),
        workflowPortPoint(to, "input", path.dataset.toPort || "input"),
      ),
    );
  });
}

updateWorkflowLines = function updateWorkflowLinesV47() {
  if (!workflowLines || !workflowBoard) return;
  workflowLines.replaceChildren();
  const nodeIds = new Set([...workflowBoard.querySelectorAll("[data-node-id]")].map((node) => node.dataset.nodeId));
  workflowEdges = workflowEdges.filter((edge) => edge.from_node !== edge.to_node && nodeIds.has(edge.from_node) && nodeIds.has(edge.to_node));
  workflowBoard.querySelectorAll('[data-node-type="video_generator"]').forEach(syncWorkflowVideoReferencePorts);
  syncWorkflowPromptMentionPickers();
  syncWorkflowModelDecorations(workflowBoard);
  syncWorkflowGenerationCredits(workflowBoard);
  workflowEdges.forEach(drawWorkflowLink);
  if (!selectedWorkflowEdgeId) hideWorkflowEdgeDeleteButton();
};

function clearWorkflowConnectionState() {
  pendingWorkflowSource?.classList.remove("is-source");
  pendingWorkflowSource = null;
  workflowBoard?.querySelectorAll(".workflow-port.is-compatible, .workflow-port.is-snap-target").forEach((port) => port.classList.remove("is-compatible", "is-snap-target"));
}

function beginWorkflowConnection(port) {
  clearWorkflowConnectionState();
  pendingWorkflowSource = port;
  port.classList.add("is-source");
  const sourceType = port.dataset.portType || "any";
  workflowBoard?.querySelectorAll('[data-port-direction="input"]').forEach((input) => {
    if (input.hidden) return;
    const inputType = input.dataset.portType || "any";
    if (input.closest("[data-node-id]") !== port.closest("[data-node-id]") && workflowPortTypesCompatible(sourceType, inputType)) input.classList.add("is-compatible");
  });
  showWorkflowToast(`请选择可接收“${port.dataset.portLabel || "数据"}”的输入点`);
}

function nearestCompatibleWorkflowInput(sourcePort, clientX, clientY, maxDistance = 48) {
  if (!sourcePort || !workflowBoard) return null;
  const sourceNode = sourcePort.closest("[data-node-id]");
  const sourceType = sourcePort.dataset.portType || "any";
  let nearest = null;
  workflowBoard.querySelectorAll('[data-port-direction="input"]').forEach((input) => {
    if (input.hidden || input.closest("[data-node-id]") === sourceNode || !workflowPortTypesCompatible(sourceType, input.dataset.portType || "any")) return;
    const rect = input.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);
    if (distance <= maxDistance && (!nearest || distance < nearest.distance)) nearest = { port:input, distance };
  });
  return nearest;
}

function workflowWouldCreateCycle(fromNode, toNode) {
  const adjacency = new Map();
  workflowEdges.forEach((edge) => {
    const next = adjacency.get(edge.from_node) || [];
    next.push(edge.to_node);
    adjacency.set(edge.from_node, next);
  });
  const queue = [toNode];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (node === fromNode) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    queue.push(...(adjacency.get(node) || []));
  }
  return false;
}

function completeWorkflowConnection(inputPort) {
  if (!pendingWorkflowSource) return showWorkflowToast("请先选择一个节点右侧的输出点");
  const fromNode = pendingWorkflowSource.closest("[data-node-id]")?.dataset.nodeId || "";
  const toNode = inputPort.closest("[data-node-id]")?.dataset.nodeId || "";
  if (!fromNode || !toNode || fromNode === toNode) return showWorkflowToast("同一节点不能连接自己");
  const fromPort = pendingWorkflowSource.dataset.portName || "output";
  const toPort = inputPort.dataset.portName || "input";
  const sourceType = pendingWorkflowSource.dataset.portType || "any";
  const targetType = inputPort.dataset.portType || "any";
  const sourceLabel = pendingWorkflowSource.dataset.portLabel || sourceType;
  if (!workflowPortTypesCompatible(sourceType, targetType)) {
    clearWorkflowConnectionState();
    return showWorkflowToast(`不能把“${sourceLabel}”连接到“${inputPort.dataset.portLabel || targetType}”`);
  }
  if (workflowWouldCreateCycle(fromNode, toNode)) {
    clearWorkflowConnectionState();
    return showWorkflowToast("这条连接会形成循环，请调整节点顺序");
  }
  if (workflowEdges.some((edge) => edge.from_node === fromNode && edge.to_node === toNode && edge.from_port === fromPort && edge.to_port === toPort)) {
    clearWorkflowConnectionState();
    return showWorkflowToast("这两个端口已经连接");
  }
  workflowEdges = workflowEdges.filter((edge) => !(edge.to_node === toNode && edge.to_port === toPort));
  const edge = { id:`edge-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`, from_node:fromNode, to_node:toNode, from_port:fromPort, to_port:toPort };
  workflowEdges.push(edge);
  clearWorkflowConnectionState();
  updateWorkflowLines();
  syncWorkflowRedrawSources();
  showWorkflowToast(`已连接${sourceLabel}；点击连线后按 Delete 可删除`);
}

function showWorkflowNodePickerAt(clientX, clientY, sourcePort = null) {
  if (!workflowNodePicker || !workflowViewport) return;
  const viewportRect = workflowViewport.getBoundingClientRect();
  const shell = document.querySelector("#workflow-canvas-shell");
  if (!shell) return;
  const shellRect = shell.getBoundingClientRect();
  const pointerX = clientX - viewportRect.left;
  const pointerY = clientY - viewportRect.top;
  workflowPickerWorldPoint = {
    x: Math.max(-50000, Math.min(50000, (pointerX - workflowState.panX) / workflowState.zoom)),
    y: Math.max(-50000, Math.min(50000, (pointerY - workflowState.panY) / workflowState.zoom)),
  };
  workflowPickerAutoConnectSource = sourcePort;
  const sourceType = sourcePort?.dataset.portType || "";
  renderWorkflowNodePicker(sourceType);
  const pickerTitle = document.querySelector("#workflow-node-picker-title");
  if (pickerTitle) pickerTitle.textContent = sourcePort ? `选择可连接“${sourcePort.dataset.portLabel || "数据"}”的节点` : "添加工作流节点";
  workflowNodePicker.hidden = false;
  const desiredLeft = clientX - shellRect.left + 12;
  const desiredTop = clientY - shellRect.top + 12;
  workflowNodePicker.style.left = `${Math.max(8, Math.min(shellRect.width - workflowNodePicker.offsetWidth - 8, desiredLeft))}px`;
  workflowNodePicker.style.top = `${Math.max(8, Math.min(shellRect.height - workflowNodePicker.offsetHeight - 8, desiredTop))}px`;
  workflowNodePicker.querySelector("button")?.focus();
}

function openWorkflowNodePicker(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(".workflow-node") || target?.closest(".workflow-canvas-toolbar")) return;
  event.preventDefault();
  showWorkflowNodePickerAt(event.clientX, event.clientY);
}

function closeWorkflowNodePicker({ cancelConnection = true } = {}) {
  if (workflowNodePicker) workflowNodePicker.hidden = true;
  if (cancelConnection && workflowPickerAutoConnectSource) clearWorkflowConnectionState();
  workflowPickerAutoConnectSource = null;
}

function workflowNodeConfig(node) {
  const config = {};
  node.querySelectorAll("[data-node-field]").forEach((control) => {
    const key = control.dataset.nodeField;
    if (!key) return;
    config[key] = control instanceof HTMLInputElement && control.type === "checkbox"
      ? control.checked
      : String(control.value || "").slice(0, 4000);
  });
  if (node.dataset.nodeType === "media_input") {
    const url = safeGeneratedImageUrl(node.dataset.assetUrl || "");
    if (url) config.url = `${new URL(url).pathname}${new URL(url).search}`;
    config.prompt = String(node.dataset.assetPrompt || "").slice(0, 1000);
    config.kind = String(node.dataset.assetKind || "text").slice(0, 32);
    if (node.dataset.assetId) config.asset_id = String(node.dataset.assetId).slice(0, 100);
    config.asset_type = String(node.dataset.assetType || config.input_type || "image").slice(0, 16);
    const state = workflowNodeImageStates.get(node.dataset.nodeId);
    if (state?.mediaType) config.media_type = String(state.mediaType).slice(0, 80);
  }
  if (node.dataset.capabilityId) config.capability_id = String(node.dataset.capabilityId).slice(0, 64);
  return config;
}

function serializeWorkflowGraph() {
  const nodes = [...(workflowBoard?.querySelectorAll("[data-node-id]") || [])].slice(0, 30).map((node) => ({
    id: node.dataset.nodeId,
    type: node.dataset.nodeType,
    category: node.dataset.nodeCategory,
    x: Math.round(Number(node.dataset.x) || 0),
    y: Math.round(Number(node.dataset.y) || 0),
    config: workflowNodeConfig(node),
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = workflowEdges.filter((edge) => nodeIds.has(edge.from_node) && nodeIds.has(edge.to_node)).slice(0, 60).map((edge) => ({
    id:edge.id, from_node:edge.from_node, to_node:edge.to_node, from_port:edge.from_port || "output", to_port:edge.to_port || "input",
  }));
  return { version:6, scene_preset:activeWorkflowScenePreset, nodes, edges };
}

function defaultWorkflowGraph() {
  return {
    version:6,
    scene_preset:SCENE_WORKFLOWS[0]?.preset || "",
    nodes:[
      { id:"image-input-base", type:"media_input", category:"input", x:70, y:145, config:{ input_type:"image" } },
      { id:"redraw-base", type:"image_tool", category:"image", x:460, y:105, config:{ tool:"redraw", model:"bailian_wan_2_7", resolution:"720p" } },
      { id:"upscale-base", type:"image_tool", category:"image", x:855, y:245, config:{ tool:"upscale", model:"server_ultrasharp", resolution:"2k" } },
      { id:"output-base", type:"media_output", category:"output", x:1195, y:255, config:{ output_type:"image", format:"png", save_history:"auto" } },
    ],
    edges:DEFAULT_WORKFLOW_EDGES.map((edge) => ({ ...edge })),
  };
}

function loadWorkflowGraph(graph) {
  closeWorkflowNodeEditor();
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) throw new Error("invalid_workflow");
  workflowBoard?.querySelectorAll("[data-node-id]").forEach((node) => node.remove());
  if (typeof graph.scene_preset === "string") {
    const scene = SCENE_WORKFLOWS.find((item) => item.preset === graph.scene_preset);
    if (scene) { activeWorkflowScenePreset = scene.preset; selectWorkflowScenario(scene); }
  }
  graph.nodes.slice(0, 30).forEach((item) => {
    if (!item || typeof item !== "object") return;
    const id = typeof item.id === "string" && /^[a-z0-9-]{1,64}$/.test(item.id) ? item.id : "";
    const x = Math.max(-50000, Math.min(50000, Number(item.x) || 0));
    const y = Math.max(-50000, Math.min(50000, Number(item.y) || 0));
    const base = id ? workflowBoard?.querySelector(`[data-node-id="${id}"]`) : null;
    if (base) {
      base.dataset.x = String(x);
      base.dataset.y = String(y);
      positionWorkflowNode(base);
      Object.entries(item.config && typeof item.config === "object" ? item.config : {}).forEach(([key, value]) => {
        const control = [...base.querySelectorAll("[data-node-field]")].find((entry) => entry.dataset.nodeField === key);
        if (!control || !["string", "number", "boolean"].includes(typeof value)) return;
        if (control instanceof HTMLInputElement && control.type === "checkbox") control.checked = Boolean(value);
        else control.value = String(value).slice(0, 4000);
      });
    } else if (WORKFLOW_NODE_TYPES.has(item.type)) {
      createDynamicWorkflowNode(item.type, x, y, id, item.config);
    }
  });
  const validIds = new Set([...(workflowBoard?.querySelectorAll("[data-node-id]") || [])].map((node) => node.dataset.nodeId));
  workflowEdges = Array.isArray(graph.edges) ? graph.edges.slice(0, 60).flatMap((edge) => {
    if (!edge || typeof edge !== "object") return [];
    const from = typeof edge.from_node === "string" ? edge.from_node : "";
    const to = typeof edge.to_node === "string" ? edge.to_node : "";
    const id = typeof edge.id === "string" && /^[a-z0-9-]{1,64}$/.test(edge.id) ? edge.id : `edge-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    if (from === to || !validIds.has(from) || !validIds.has(to)) return [];
    const fromPort = typeof edge.from_port === "string" ? edge.from_port.slice(0, 24) : "output";
    const toPort = typeof edge.to_port === "string" ? edge.to_port.slice(0, 24) : "input";
    return [{ id, from_node:from, to_node:to, from_port:fromPort, to_port:toPort }];
  }) : DEFAULT_WORKFLOW_EDGES.filter((edge) => validIds.has(edge.from_node) && validIds.has(edge.to_node)).map((edge) => ({ ...edge }));
  updateWorkflowOutputSummary();
  updateWorkflowLines();
  workflowBoard?.querySelectorAll("[data-node-id]").forEach((node) => { bindWorkflowNodeControls(node); updateWorkflowCameraSummary(node); });
  syncWorkflowRedrawSources();
  fitWorkflowCanvas();
}

function readLocalWorkflows() {
  try {
    const value = JSON.parse(window.localStorage.getItem(WORKFLOW_LOCAL_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && item.graph).slice(0, 40) : [];
  } catch { return []; }
}

function writeLocalWorkflows(items) {
  try { window.localStorage.setItem(WORKFLOW_LOCAL_KEY, JSON.stringify(items.slice(0, 40))); return true; }
  catch { return false; }
}

function renderSharedWorkflows() {
  if (!sharedWorkflowList) return;
  const items = activeWorkflowScope === "local" ? readLocalWorkflows() : communityWorkflows;
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "workflow-list-status";
    empty.textContent = activeWorkflowScope === "local" ? "本机还没有保存的工作流。\n在画布右上角点击“保存 / 分享”即可保存。" : "还没有公开工作流，成为第一个分享的人吧。";
    sharedWorkflowList.replaceChildren(empty);
    return;
  }
  const cards = items.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shared-workflow-card";
    button.dataset.workflowId = String(item.id || "");
    button.dataset.workflowSource = activeWorkflowScope;
    const icon = document.createElement("span");
    icon.textContent = "⌘";
    const copy = document.createElement("span");
    const title = document.createElement("b");
    title.textContent = String(item.name || "未命名工作流").slice(0, 40);
    const note = document.createElement("small");
    note.textContent = String(item.description || "点击加载到当前幕布").slice(0, 120);
    const meta = document.createElement("em");
    meta.textContent = `${String(item.author || "本机创作").slice(0, 24)} · ${Number(item.node_count || item.graph?.nodes?.length || 0)} 个节点`;
    copy.append(title, note, meta);
    button.append(icon, copy);
    if (activeWorkflowScope !== "local") return button;
    const row = document.createElement("div");
    row.className = "shared-workflow-local";
    const publish = document.createElement("button");
    publish.type = "button";
    publish.className = "shared-workflow-publish";
    publish.dataset.publishLocalWorkflow = String(item.id || "");
    publish.textContent = "发布";
    row.append(button, publish);
    return row;
  });
  sharedWorkflowList.replaceChildren(...cards);
}

async function loadCommunityWorkflows() {
  if (activeWorkflowScope !== "community" || !sharedWorkflowList) return;
  sharedWorkflowList.replaceChildren(Object.assign(document.createElement("p"), { className:"workflow-list-status", textContent:"正在读取社区工作流…" }));
  try {
    const { body } = await fetchJson(`${API.workflows}?limit=30`, { method:"GET" }, 5000);
    communityWorkflows = Array.isArray(body.items) ? body.items : [];
    renderSharedWorkflows();
  } catch {
    sharedWorkflowList.replaceChildren(Object.assign(document.createElement("p"), { className:"workflow-list-status", textContent:"共享工作流暂时无法读取，请稍后重试。" }));
  }
}

function workflowCommunityPreviewMarkup() {
  return '<div class="workflow-card-preview" aria-hidden="true"><svg viewBox="0 0 320 150" preserveAspectRatio="none"><path d="M72 54 C142 54 145 100 246 100"/></svg><span>入</span><span>出</span></div>';
}

function workflowCommunityStatsMarkup(item) {
  return `<div class="workflow-card-stats" aria-label="互动数据"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 9.5c0 4.7-8.5 9-8.5 9s-8.5-4.3-8.5-9a4.5 4.5 0 0 1 8.5-2.3 4.5 4.5 0 0 1 8.5 2.3Z"/></svg>${Number(item.likes_count || 0)}</span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4z"/></svg>${Number(item.comments_count || 0)}</span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h10v10H8zM5 10H3v10h10v-2"/></svg>${Number(item.uses_count || 0)}</span></div>`;
}

function renderWorkflowDiscovery(items = communityWorkflows) {
  if (!workflowDiscoveryGrid) return;
  if (!items.length) {
    const query = discoverySearch?.value.trim() || "";
    workflowDiscoveryGrid.innerHTML = `<p class="workflow-discovery-empty">${query ? `没有找到与“${escapeMarkup(query)}”相关的工作流。` : "社区还没有公开工作流。你可以成为第一个分享的人。"}</p>`;
    return;
  }
  workflowDiscoveryGrid.innerHTML = items.map((item) => {
    const id = escapeMarkup(item.id || "");
    const author = escapeMarkup(item.author || "神秘画家");
    const tags = [...(Array.isArray(item.media_types) ? item.media_types : []), ...(Array.isArray(item.tags) ? item.tags : [])].slice(0, 5);
    return `<article class="workflow-discovery-card" data-community-workflow="${id}">
      ${workflowCommunityPreviewMarkup()}
      <div class="workflow-card-body"><div class="workflow-card-heading"><h3>${escapeMarkup(item.name || "未命名工作流")}</h3><span>${Number(item.node_count || 0)} 节点</span></div>
      <p>${escapeMarkup(item.description || "一套可以直接复用并继续编辑的创作流程。")}</p>
      <div class="workflow-card-tags">${tags.map((tag) => `<span>${escapeMarkup(tag)}</span>`).join("")}</div>
      <div class="workflow-card-footer"><span class="workflow-card-author"><i>${escapeMarkup(author.slice(0, 1) || "神")}</i>${author}</span>${workflowCommunityStatsMarkup(item)}</div>
      <div class="workflow-card-actions"><button type="button" data-community-details="${id}">查看详情与评论</button><button type="button" data-community-use="${id}">加入幕布</button></div></div></article>`;
  }).join("");
}

async function loadWorkflowDiscovery() {
  if (!workflowDiscoveryGrid) return;
  const query = discoverySearch?.value.trim() || "";
  workflowDiscoveryGrid.innerHTML = '<p class="workflow-discovery-empty">正在读取社区工作流…</p>';
  if (workflowDiscoveryStatus) workflowDiscoveryStatus.textContent = query ? `正在搜索“${query}”…` : "发现创作者公开的工作流";
  try {
    const params = new URLSearchParams({ limit:"48", sort:activeWorkflowSort });
    if (query) params.set("q", query);
    const { body } = await fetchJson(`${API.workflows}?${params}`, { method:"GET" }, 7000);
    communityWorkflows = Array.isArray(body.items) ? body.items : [];
    renderWorkflowDiscovery();
    if (workflowDiscoveryStatus) workflowDiscoveryStatus.textContent = query ? `找到 ${communityWorkflows.length} 个相关工作流` : `社区公开 ${communityWorkflows.length} 个工作流`;
  } catch {
    workflowDiscoveryGrid.innerHTML = '<p class="workflow-discovery-empty">社区工作流暂时无法读取，请稍后重试。</p>';
    if (workflowDiscoveryStatus) workflowDiscoveryStatus.textContent = "连接暂时不可用";
  }
}

function workflowTemplateForType(type) {
  return WORKFLOW_NODE_TEMPLATES.find((item) => item.type === type) || { label:"能力节点", category:"creative" };
}

function renderWorkflowCommunityPreview(graph) {
  const preview = document.querySelector("#workflow-community-preview");
  if (!preview) return;
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes.slice(0, 18) : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges.slice(0, 32) : [];
  if (!nodes.length) { preview.textContent = "这个工作流还没有节点。"; return; }
  const minX = Math.min(...nodes.map((node) => Number(node.x || 0)));
  const maxX = Math.max(...nodes.map((node) => Number(node.x || 0))) + 150;
  const minY = Math.min(...nodes.map((node) => Number(node.y || 0)));
  const maxY = Math.max(...nodes.map((node) => Number(node.y || 0))) + 80;
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const positions = new Map(nodes.map((node) => [node.id, {
    x:22 + ((Number(node.x || 0) - minX) / width) * 240,
    y:34 + ((Number(node.y || 0) - minY) / height) * 500,
  }]));
  const paths = edges.flatMap((edge) => {
    const from = positions.get(edge.from_node); const to = positions.get(edge.to_node);
    if (!from || !to) return [];
    const x1 = from.x + 128; const y1 = from.y + 33; const x2 = to.x; const y2 = to.y + 33;
    return [`<path d="M${x1} ${y1} C${x1 + 45} ${y1} ${x2 - 45} ${y2} ${x2} ${y2}"/>`];
  }).join("");
  preview.innerHTML = `<svg viewBox="0 0 390 620" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
  nodes.forEach((node) => {
    const point = positions.get(node.id); const template = workflowTemplateForType(node.type);
    const card = document.createElement("div");
    card.className = "workflow-detail-node";
    card.style.left = `${point.x}px`; card.style.top = `${point.y}px`;
    const title = document.createElement("b"); title.textContent = template.label;
    const note = document.createElement("small"); note.textContent = WORKFLOW_NODE_CATEGORIES[template.category]?.label || "工作流节点";
    card.append(title, note); preview.append(card);
  });
}

function updateWorkflowCommunityDialog(item) {
  activeCommunityWorkflow = item;
  const author = String(item?.author || "神秘画家");
  document.querySelector("#workflow-community-title").textContent = item?.name || "社区工作流";
  document.querySelector("#workflow-community-description").textContent = item?.description || "一套可以直接复用并继续编辑的创作流程。";
  document.querySelector("#workflow-community-author").textContent = author;
  document.querySelector("#workflow-community-avatar").textContent = author.slice(0, 1) || "神";
  document.querySelector("#workflow-community-likes").textContent = String(Number(item?.likes_count || 0));
  document.querySelector("#workflow-community-comments-count").textContent = String(Number(item?.comments_count || 0));
  document.querySelector("#workflow-community-uses").textContent = String(Number(item?.uses_count || 0));
  const like = document.querySelector("#workflow-community-like");
  like?.setAttribute("aria-pressed", String(Boolean(item?.liked_by_viewer)));
  const tags = [...(item?.media_types || []), ...(item?.tags || [])].slice(0, 8);
  document.querySelector("#workflow-community-tags").innerHTML = tags.map((tag) => `<span>${escapeMarkup(tag)}</span>`).join("");
  renderWorkflowCommunityPreview(item?.graph);
}

function renderWorkflowComments(items) {
  if (!workflowCommentsList) return;
  if (!items.length) { workflowCommentsList.innerHTML = "<p>还没有评论，来说说这套流程是否好用。</p>"; return; }
  workflowCommentsList.innerHTML = items.map((item) => `<article class="workflow-comment"><header><b>${escapeMarkup(item.author || "神秘画家")}</b><time>${new Date(Number(item.created_at || 0) * 1000).toLocaleDateString("zh-CN")}</time></header><p>${escapeMarkup(item.content || "")}</p></article>`).join("");
}

async function openCommunityWorkflow(workflowId) {
  if (!workflowCommunityDialog) return;
  workflowCommentsList.innerHTML = "<p>正在读取评论…</p>";
  if (typeof workflowCommunityDialog.showModal === "function") workflowCommunityDialog.showModal(); else workflowCommunityDialog.setAttribute("open", "");
  try {
    const [{ body:workflowBody }, { body:commentsBody }] = await Promise.all([
      fetchJson(`${API.workflows}/${encodeURIComponent(workflowId)}`, { method:"GET" }, 6000),
      fetchJson(`${API.workflows}/${encodeURIComponent(workflowId)}/comments`, { method:"GET" }, 6000),
    ]);
    updateWorkflowCommunityDialog(workflowBody.workflow);
    renderWorkflowComments(Array.isArray(commentsBody.items) ? commentsBody.items : []);
  } catch {
    document.querySelector("#workflow-comment-status").textContent = "这个工作流暂时无法读取。";
  }
}

async function toggleCommunityWorkflowLike(workflowId) {
  const { body } = await fetchJson(`${API.workflows}/${encodeURIComponent(workflowId)}/like`, { method:"POST" }, 5000);
  const item = communityWorkflows.find((entry) => entry.id === workflowId);
  if (item) { item.liked_by_viewer = Boolean(body.liked); item.likes_count = Number(body.likes_count || 0); }
  if (activeCommunityWorkflow?.id === workflowId) {
    activeCommunityWorkflow.liked_by_viewer = Boolean(body.liked);
    activeCommunityWorkflow.likes_count = Number(body.likes_count || 0);
    updateWorkflowCommunityDialog(activeCommunityWorkflow);
  }
  renderWorkflowDiscovery();
}

async function useCommunityWorkflow(workflowId) {
  try {
    const { body } = await fetchJson(`${API.workflows}/${encodeURIComponent(workflowId)}/use`, { method:"POST" }, 6000);
    loadWorkflowGraph(body.workflow?.graph);
    workflowCommunityDialog?.close();
    setWorkspaceView("workflow");
    showWorkflowToast(`已加入「${String(body.workflow?.name || "社区工作流").slice(0, 30)}」，可继续编辑`);
  } catch { showWorkflowToast("这个工作流暂时无法加入"); }
}

function normalizeWorkflowAsset(item, source = "browser") {
  if (!item || typeof item !== "object") return null;
  const url = safeGeneratedImageUrl(item.url || item.image_url || "");
  if (!url) return null;
  const rawKind = String(item.kind || "text").toLowerCase();
  const kind = /edit|redraw|multiview|multiangle|panorama|重绘|视角|全景/.test(rawKind) ? "edit" : rawKind;
  const assetType = ["image", "video", "audio", "voice", "music"].includes(String(item.assetType || item.asset_type)) ? String(item.assetType || item.asset_type) : "image";
  const rawTime = Number(item.createdAt || item.created_at || Date.now());
  const createdAt = rawTime < 1e12 ? rawTime * 1000 : rawTime;
  return {
    id:String(item.id || `${source}-${createdAt}`).slice(0, 100),
    url,
    name:String(item.name || item.prompt || "未命名资产").slice(0, 80),
    prompt:String(item.prompt || "").slice(0, 1000),
    kind,
    assetType,
    mediaType:String(item.mediaType || item.media_type || (assetType === "video" ? "video/mp4" : ["audio", "voice", "music"].includes(assetType) ? "audio/wav" : "image/webp")),
    categoryId:String(item.categoryId || item.category_id || kind).slice(0, 64),
    createdAt:Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function renderWorkflowAssetFilters() {
  if (!workflowAssetFilterContainer) return;
  if (activeWorkflowAssetFilter !== "all" && !assetCategories.some((item) => item.id === activeWorkflowAssetFilter)) activeWorkflowAssetFilter = "all";
  const filters = [{ id:"all", name:"全部" }, ...assetCategories];
  workflowAssetFilterContainer.replaceChildren(...filters.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.assetFilter = category.id;
    button.classList.toggle("active", category.id === activeWorkflowAssetFilter);
    button.textContent = category.name;
    return button;
  }));
}

function renderWorkflowAssets() {
  if (!workflowAssetList) return;
  renderWorkflowAssetFilters();
  const items = personalWorkflowAssets.filter((item) => activeWorkflowAssetFilter === "all" || item.categoryId === activeWorkflowAssetFilter);
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "workflow-list-status";
    empty.textContent = activeWorkflowAssetFilter === "all" ? "还没有个人资产。完成一次生成后，作品会出现在这里。" : "这个分类还没有作品。";
    workflowAssetList.replaceChildren(empty);
    return;
  }
  const cards = items.map((asset) => {
    const card = document.createElement("article");
    card.className = "workflow-asset-card";
    card.dataset.assetId = asset.id;
    const image = createAssetMediaPreview(asset, true);
    const copy = document.createElement("span");
    const title = document.createElement("b");
    title.textContent = asset.name || "未命名资产";
    const note = document.createElement("small");
    note.textContent = `${assetTypeLabel(asset)} · ${assetCategories.find((item) => item.id === asset.categoryId)?.name || "资产"}`;
    copy.append(title, note);
    const add = document.createElement("button");
    add.type = "button";
    add.dataset.addAssetId = asset.id;
    add.setAttribute("aria-label", "把此资产添加到幕布");
    add.title = "添加到幕布";
    add.textContent = "+";
    card.append(image, copy, add);
    return card;
  });
  workflowAssetList.replaceChildren(...cards);
}

async function loadWorkflowAssets() {
  if (!workflowAssetList) return;
  workflowAssetList.replaceChildren(Object.assign(document.createElement("p"), { className:"workflow-list-status", textContent:"正在读取个人资产…" }));
  try {
    const { body } = await fetchJson(API.assets, { method:"GET" }, 7000);
    assetCategories = Array.isArray(body.categories) && body.categories.length ? body.categories : [...FALLBACK_ASSET_CATEGORIES];
    assetItems = (Array.isArray(body.items) ? body.items : []).map(normalizedAsset).filter(Boolean);
    personalWorkflowAssets = assetItems.map((item) => normalizeWorkflowAsset(item, "asset")).filter(Boolean);
  } catch {
    personalWorkflowAssets = [];
  }
  renderWorkflowAssets();
}

function addWorkflowAssetNode(asset) {
  if (!asset || !workflowViewport) return;
  const centerX = (workflowViewport.clientWidth / 2 - workflowState.panX) / workflowState.zoom - 115;
  const centerY = (workflowViewport.clientHeight / 2 - workflowState.panY) / workflowState.zoom - 145;
  const nodeBoxes = [...(workflowBoard?.querySelectorAll("[data-node-id]") || [])].map((node) => ({
    left:Number(node.dataset.x) - 28,
    top:Number(node.dataset.y) - 28,
    right:Number(node.dataset.x) + node.offsetWidth + 28,
    bottom:Number(node.dataset.y) + node.offsetHeight + 28,
  }));
  const occupied = [...nodeBoxes];
  const viewportRect = workflowViewport.getBoundingClientRect();
  [document.querySelector(".workflow-floating-actions"), document.querySelector(".workflow-canvas-toolbar"), document.querySelector(".workflow-resource-dock"), workflowResourceDrawer].forEach((overlay) => {
    if (!overlay || overlay.hidden) return;
    const rect = overlay.getBoundingClientRect();
    occupied.push({
      left:(rect.left - viewportRect.left - workflowState.panX) / workflowState.zoom - 24,
      top:(rect.top - viewportRect.top - workflowState.panY) / workflowState.zoom - 24,
      right:(rect.right - viewportRect.left - workflowState.panX) / workflowState.zoom + 24,
      bottom:(rect.bottom - viewportRect.top - workflowState.panY) / workflowState.zoom + 24,
    });
  });
  const visible = {
    left:(-workflowState.panX) / workflowState.zoom + 24,
    top:(-workflowState.panY) / workflowState.zoom + 80,
    right:(workflowViewport.clientWidth - workflowState.panX) / workflowState.zoom - 24,
    bottom:(workflowViewport.clientHeight - workflowState.panY) / workflowState.zoom - 76,
  };
  const offsets = [[0,0],[-330,0],[330,0],[0,300],[-330,300],[330,300],[0,-300],[-330,-300],[330,-300]];
  const gridCandidates = [visible.top, (visible.top + visible.bottom - 290) / 2, visible.bottom - 290].flatMap((y) => (
    [visible.left, (visible.left + visible.right - 230) / 2, visible.right - 230].map((x) => ({ x, y }))
  ));
  const candidates = [...offsets.map(([dx, dy]) => ({ x:centerX + dx, y:centerY + dy })), ...gridCandidates];
  const openPoint = candidates.find((candidate) => (
    candidate.x >= visible.left && candidate.x + 230 <= visible.right && candidate.y >= visible.top && candidate.y + 290 <= visible.bottom
    && !occupied.some((box) => candidate.x < box.right && candidate.x + 230 > box.left && candidate.y < box.bottom && candidate.y + 290 > box.top)
  ));
  const point = openPoint || {
    x:centerX,
    y:Math.max(...nodeBoxes.map((box) => box.bottom), centerY) + 36,
  };
  const inputType = asset.assetType === "video" ? "video" : ["audio", "voice", "music"].includes(asset.assetType) ? "audio" : "image";
  const node = createDynamicWorkflowNode("media_input", point.x, point.y, "", {
    input_type:inputType,
    url:new URL(asset.url).pathname + new URL(asset.url).search, prompt:asset.prompt, kind:asset.kind,
    asset_id:asset.id, asset_type:asset.assetType, media_type:asset.mediaType,
  });
  if (node) {
    showWorkflowToast(`${assetTypeLabel(asset)}资产已添加到幕布；从输出点连接到兼容节点`);
    requestAnimationFrame(updateWorkflowLines);
    if (!openPoint) {
      node.querySelector("img,video")?.addEventListener("loadeddata", fitWorkflowCanvas, { once:true });
      window.setTimeout(fitWorkflowCanvas, 320);
    }
  }
}

function openWorkflowShareDialog() {
  if (!workflowShareDialog) return;
  workflowShareStatus.textContent = "";
  workflowShareLink.hidden = true;
  if (typeof workflowShareDialog.showModal === "function") workflowShareDialog.showModal(); else workflowShareDialog.setAttribute("open", "");
  workflowShareName?.focus();
}

function workflowRecordFromDialog() {
  const name = workflowShareName?.value.trim() || "我的图像工作流";
  const description = workflowShareDescription?.value.trim() || "可复用的图像生成工作流";
  const tags = String(workflowShareTags?.value || "").split(/[，,、\s]+/).map((tag) => tag.replace(/^[#＃]+/, "").trim().slice(0, 12)).filter(Boolean);
  return { name:name.slice(0, 40), description:description.slice(0, 120), tags:[...new Set(tags)].slice(0, 8), graph:serializeWorkflowGraph() };
}

function saveWorkflowLocally() {
  const record = { id:`local-${Date.now()}`, ...workflowRecordFromDialog(), author:"本机创作", created_at:Date.now() / 1000 };
  const saved = writeLocalWorkflows([record, ...readLocalWorkflows()]);
  workflowShareStatus.textContent = saved ? "已保存到这台设备。" : "浏览器存储空间不足，建议导出 JSON。";
  if (saved) { showWorkflowToast("工作流已保存到本机"); if (activeWorkflowScope === "local") renderSharedWorkflows(); }
}

function exportWorkflowJson() {
  const record = { ...workflowRecordFromDialog(), exported_at:new Date().toISOString() };
  const blob = new Blob([JSON.stringify(record, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${record.name.replace(/[\\/:*?\"<>|]/g, "-").slice(0, 36) || "workflow"}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  workflowShareStatus.textContent = "工作流 JSON 已导出。";
}

async function publishWorkflow() {
  const record = workflowRecordFromDialog();
  workflowShareStatus.textContent = "正在发布…";
  const publishButton = document.querySelector("#workflow-publish");
  publishButton.disabled = true;
  try {
    const { body } = await fetchJson(API.workflows, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(record) }, 8000);
    const id = String(body.workflow?.id || "");
    if (!/^[a-f0-9]{12}$/.test(id)) throw new Error("invalid_response");
    const link = `${window.location.origin}/studio.html?workspace=workflow&workflow=${id}`;
    workflowShareLinkInput.value = link;
    workflowShareLink.hidden = false;
    workflowShareStatus.textContent = "已发布。拥有链接的人可以打开并复用这套节点。";
    showWorkflowToast("工作流已发布到社区");
    activeWorkflowScope = "community";
    await loadCommunityWorkflows();
  } catch {
    workflowShareStatus.textContent = "发布失败，请检查网络后重试；也可以先保存到本机。";
  } finally { publishButton.disabled = false; }
}

async function publishSavedWorkflow(record) {
  try {
    await fetchJson(API.workflows, {
      method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({
        name:record.name, description:record.description, tags:record.tags, graph:record.graph,
      }),
    }, 8000);
    showWorkflowToast("已发布到社区工作流分享");
    activeWorkflowScope = "community";
    await loadCommunityWorkflows();
  } catch { showWorkflowToast("发布失败，请稍后重试"); }
}

function closeWorkflowResourceDrawer() {
  if (workflowResourceDrawer) {
    workflowResourceDrawer.hidden = true;
    workflowResourceDrawer.setAttribute("aria-hidden", "true");
  }
  workflowLibraryTabs.forEach((entry) => { entry.classList.remove("active"); entry.setAttribute("aria-selected", "false"); });
}

workflowLibraryTabs.forEach((button) => button.addEventListener("click", () => {
  const selected = button.dataset.workflowLibraryTab;
  const shouldClose = !workflowResourceDrawer?.hidden && button.classList.contains("active");
  if (shouldClose) return closeWorkflowResourceDrawer();
  if (workflowResourceDrawer) {
    workflowResourceDrawer.hidden = false;
    workflowResourceDrawer.setAttribute("aria-hidden", "false");
  }
  workflowLibraryTabs.forEach((entry) => { const active = entry === button; entry.classList.toggle("active", active); entry.setAttribute("aria-selected", String(active)); });
  workflowLibraryPanels.forEach((panel) => { panel.hidden = panel.dataset.workflowLibraryPanel !== selected; });
  if (selected === "shared") { if (activeWorkflowScope === "community") loadCommunityWorkflows(); else renderSharedWorkflows(); }
  if (selected === "assets") loadWorkflowAssets();
}));
document.querySelector("#workflow-resource-close")?.addEventListener("click", closeWorkflowResourceDrawer);
sharedWorkflowScopes.forEach((button) => button.addEventListener("click", () => {
  activeWorkflowScope = button.dataset.workflowScope;
  sharedWorkflowScopes.forEach((entry) => entry.classList.toggle("active", entry === button));
  if (activeWorkflowScope === "community") loadCommunityWorkflows(); else renderSharedWorkflows();
}));
document.querySelector("#shared-workflow-refresh")?.addEventListener("click", () => activeWorkflowScope === "community" ? loadCommunityWorkflows() : renderSharedWorkflows());
document.querySelector("#workflow-assets-refresh")?.addEventListener("click", loadWorkflowAssets);
workflowAssetFilterContainer?.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-asset-filter]") : null;
  if (!button) return;
  activeWorkflowAssetFilter = button.dataset.assetFilter || "all";
  renderWorkflowAssets();
});
workflowAssetList?.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-add-asset-id]") : null;
  if (!button) return;
  addWorkflowAssetNode(personalWorkflowAssets.find((item) => item.id === button.dataset.addAssetId));
});
sharedWorkflowList?.addEventListener("click", async (event) => {
  const publish = event.target instanceof Element ? event.target.closest("[data-publish-local-workflow]") : null;
  if (publish) {
    const record = readLocalWorkflows().find((item) => item.id === publish.dataset.publishLocalWorkflow);
    if (record) await publishSavedWorkflow(record);
    return;
  }
  const card = event.target instanceof Element ? event.target.closest(".shared-workflow-card") : null;
  if (!card) return;
  try {
    let record;
    if (card.dataset.workflowSource === "local") record = readLocalWorkflows().find((item) => item.id === card.dataset.workflowId);
    else {
      const { body } = await fetchJson(`${API.workflows}/${encodeURIComponent(card.dataset.workflowId)}`, { method:"GET" }, 5000);
      record = body.workflow;
    }
    loadWorkflowGraph(record?.graph);
    showWorkflowToast(`已加载「${String(record?.name || "共享工作流").slice(0, 30)}」`);
  } catch { showWorkflowToast("这个工作流暂时无法加载"); }
});
workflowSortTabs.forEach((button) => button.addEventListener("click", () => {
  activeWorkflowSort = button.dataset.workflowSort || "recommended";
  workflowSortTabs.forEach((entry) => entry.classList.toggle("active", entry === button));
  loadWorkflowDiscovery();
}));
workflowDiscoveryGrid?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const details = target?.closest("[data-community-details]");
  const use = target?.closest("[data-community-use]");
  if (details) openCommunityWorkflow(details.dataset.communityDetails);
  else if (use) useCommunityWorkflow(use.dataset.communityUse);
});
document.querySelector("#workflow-discovery-publish")?.addEventListener("click", () => {
  setWorkspaceView("workflow");
  window.setTimeout(openWorkflowShareDialog, 120);
});
document.querySelector("#workflow-community-close")?.addEventListener("click", () => workflowCommunityDialog?.close());
document.querySelector("#workflow-community-like")?.addEventListener("click", async () => {
  if (!activeCommunityWorkflow?.id) return;
  try { await toggleCommunityWorkflowLike(activeCommunityWorkflow.id); }
  catch { document.querySelector("#workflow-comment-status").textContent = "点赞失败，请稍后重试。"; }
});
document.querySelector("#workflow-community-use")?.addEventListener("click", () => {
  if (activeCommunityWorkflow?.id) useCommunityWorkflow(activeCommunityWorkflow.id);
});
document.querySelector("#workflow-comment-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeCommunityWorkflow?.id) return;
  const input = document.querySelector("#workflow-comment-input");
  const status = document.querySelector("#workflow-comment-status");
  const content = input?.value.trim() || "";
  if (!content) return;
  status.textContent = "正在发布…";
  try {
    await fetchJson(`${API.workflows}/${encodeURIComponent(activeCommunityWorkflow.id)}/comments`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ content }) }, 6000);
    input.value = "";
    const { body } = await fetchJson(`${API.workflows}/${encodeURIComponent(activeCommunityWorkflow.id)}/comments`, { method:"GET" }, 6000);
    renderWorkflowComments(Array.isArray(body.items) ? body.items : []);
    activeCommunityWorkflow.comments_count = Number(activeCommunityWorkflow.comments_count || 0) + 1;
    updateWorkflowCommunityDialog(activeCommunityWorkflow);
    const listed = communityWorkflows.find((item) => item.id === activeCommunityWorkflow.id);
    if (listed) listed.comments_count = activeCommunityWorkflow.comments_count;
    renderWorkflowDiscovery();
    status.textContent = "评论已发布。";
  } catch { status.textContent = "评论发布失败，请稍后重试。"; }
});

scenarioList?.addEventListener("click", (event) => {
  const card = event.target instanceof Element ? event.target.closest(".scenario-card") : null;
  if (card?.dataset.scenePreset) activeWorkflowScenePreset = card.dataset.scenePreset;
});
workflowViewport?.addEventListener("dblclick", openWorkflowNodePicker);
workflowNodeCategoryTabs?.addEventListener("click", (event) => {
  const tab = event.target instanceof Element ? event.target.closest("[data-workflow-node-category]") : null;
  if (!tab) return;
  activeWorkflowNodeCategory = tab.dataset.workflowNodeCategory || "all";
  renderWorkflowNodePicker(workflowPickerSourceType);
  workflowNodeCategoryTabs.querySelector(`[data-workflow-node-category="${activeWorkflowNodeCategory}"]`)?.focus();
});
workflowNodeGroups?.addEventListener("click", (event) => {
  const option = event.target instanceof Element ? event.target.closest("[data-node-template]") : null;
  if (!option) return;
  const source = workflowPickerAutoConnectSource;
  const sourceType = source?.dataset.portType || "";
  const nodeConfig = option.dataset.nodeCapability ? { capability_id:option.dataset.nodeCapability } : {};
  if (option.dataset.nodeTemplate === "media_output" && ["image", "video", "audio"].includes(sourceType)) {
    nodeConfig.output_type = sourceType;
    nodeConfig.format = sourceType === "video" ? "mp4" : sourceType === "audio" ? "wav" : "png";
  }
  const node = createDynamicWorkflowNode(
    option.dataset.nodeTemplate, workflowPickerWorldPoint.x, workflowPickerWorldPoint.y, "",
    nodeConfig,
  );
  closeWorkflowNodePicker({ cancelConnection:false });
  if (node && source) {
    pendingWorkflowSource = source;
    const input = [...node.querySelectorAll('[data-port-direction="input"]')].find((port) => workflowPortTypesCompatible(sourceType || "any", port.dataset.portType || "any"));
    if (input) completeWorkflowConnection(input);
    else clearWorkflowConnectionState();
  } else if (node) showWorkflowToast(`已添加「${node.querySelector("header b")?.textContent || "节点"}」`);
  else if (source) clearWorkflowConnectionState();
});
document.querySelector("#workflow-node-picker-close")?.addEventListener("click", closeWorkflowNodePicker);
workflowNodeEditorPrompt?.addEventListener("input", () => {
  if (!activeWorkflowEditorNode) return;
  const source = ensureWorkflowNodePromptState(activeWorkflowEditorNode);
  source.value = workflowNodeEditorPrompt.value;
  source.dispatchEvent(new Event("input", { bubbles:true }));
  updateWorkflowNodeSummary(activeWorkflowEditorNode);
});
workflowNodeEditorRun?.addEventListener("click", () => {
  if (activeWorkflowEditorNode) runWorkflow(activeWorkflowEditorNode.dataset.nodeId);
});
workflowNodeEditorExpand?.addEventListener("click", () => {
  setWorkflowNodeEditorExpanded(!workflowNodeEditor.classList.contains("is-expanded"));
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeWorkflowNodePicker();
  closeWorkflowNodeEditor();
});
document.addEventListener("pointerdown", (event) => {
  if (workflowNodePicker?.hidden) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest("#workflow-node-picker")) closeWorkflowNodePicker();
});
document.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(".workflow-node-editor-range")) return;
  workflowNodeEditorFields?.querySelectorAll(".workflow-node-editor-range-popover:not([hidden])").forEach((popover) => {
    popover.hidden = true;
    popover.parentElement?.querySelector(".workflow-node-editor-range-trigger")?.setAttribute("aria-expanded", "false");
  });
});
workflowBoard?.querySelectorAll(".workflow-port").forEach((port) => {
  const direction = port.dataset.portDirection;
  port.dataset.portNode = port.closest("[data-node-id]")?.dataset.nodeId || "";
  if (!port.dataset.portName) port.dataset.portName = direction === "input" ? "input" : "output";
  if (!port.dataset.portType) port.dataset.portType = "any";
  if (!port.dataset.portLabel) port.dataset.portLabel = direction === "input" ? "输入" : "输出";
});
workflowBoard?.addEventListener("click", (event) => {
  const port = event.target instanceof Element ? event.target.closest(".workflow-port") : null;
  if (!port) return;
  event.preventDefault();
  event.stopPropagation();
  if (suppressWorkflowPortClick) { suppressWorkflowPortClick = false; return; }
  if (port.dataset.portDirection === "output") beginWorkflowConnection(port);
  else completeWorkflowConnection(port);
});
workflowBoard?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const node = target?.closest("[data-node-id]");
  if (!node || target.closest("button,input,select,textarea,label,canvas,audio,video,[data-workflow-mask-stage],[data-workflow-file]")) return;
  if (node.dataset.suppressEditorClick === "true") return;
  renderWorkflowNodeEditor(node);
});
workflowBoard?.addEventListener("pointerdown", (event) => {
  const port = event.target instanceof Element ? event.target.closest('[data-port-direction="output"]') : null;
  if (!port || event.button !== 0 || !workflowViewport || !workflowLines) return;
  const start = { x:event.clientX, y:event.clientY };
  let dragging = false;
  let previewPath = null;
  let snapTarget = null;
  const move = (moveEvent) => {
    if (!dragging && Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < 5) return;
    if (!dragging) {
      dragging = true;
      beginWorkflowConnection(port);
      previewPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      previewPath.dataset.previewLink = "true";
      workflowLines.append(previewPath);
    }
    const node = port.closest("[data-node-id]");
    const rect = workflowViewport.getBoundingClientRect();
    snapTarget?.classList.remove("is-snap-target");
    const snapped = nearestCompatibleWorkflowInput(port, moveEvent.clientX, moveEvent.clientY);
    snapTarget = snapped?.port || null;
    snapTarget?.classList.add("is-snap-target");
    const targetNode = snapTarget?.closest("[data-node-id]");
    const target = targetNode ? workflowPortPoint(targetNode, "input", snapTarget.dataset.portName || "") : {
      x:(moveEvent.clientX - rect.left - workflowState.panX) / workflowState.zoom,
      y:(moveEvent.clientY - rect.top - workflowState.panY) / workflowState.zoom,
    };
    previewPath?.setAttribute("d", workflowPathData(workflowPortPoint(node, "output", port.dataset.portName || ""), target));
  };
  const end = (upEvent) => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    previewPath?.remove();
    if (!dragging) return;
    suppressWorkflowPortClick = true;
    window.setTimeout(() => { suppressWorkflowPortClick = false; }, 0);
    const directTarget = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest?.('[data-port-direction="input"]');
    const target = directTarget || nearestCompatibleWorkflowInput(port, upEvent.clientX, upEvent.clientY)?.port || snapTarget;
    snapTarget?.classList.remove("is-snap-target");
    if (target) completeWorkflowConnection(target);
    else {
      showWorkflowNodePickerAt(upEvent.clientX, upEvent.clientY, port);
      showWorkflowToast(`请选择可接收“${port.dataset.portLabel || "数据"}”的节点，将自动完成连接`);
    }
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end, { once:true });
});
workflowLines?.addEventListener("click", (event) => {
  const path = event.target instanceof Element ? event.target.closest("[data-link]") : null;
  if (!path) return;
  selectedWorkflowEdgeId = path.dataset.link || "";
  updateWorkflowLines();
  const selectedPath = [...workflowLines.querySelectorAll("path[data-link]")].find((item) => item.dataset.link === selectedWorkflowEdgeId);
  showWorkflowEdgeDeleteButton(selectedPath, event.clientX, event.clientY);
  showWorkflowToast("已选择连线；点击“删除连线”或按 Delete / Backspace");
});
workflowLines?.addEventListener("focusin", (event) => {
  const path = event.target instanceof Element ? event.target.closest("[data-link]") : null;
  if (!path) return;
  selectedWorkflowEdgeId = path.dataset.link || "";
  workflowLines.querySelectorAll(".workflow-link-visible").forEach((item) => item.classList.toggle("is-selected", item.previousElementSibling?.dataset.link === selectedWorkflowEdgeId));
  showWorkflowEdgeDeleteButton(path);
});
workflowLines?.addEventListener("keydown", (event) => {
  const path = event.target instanceof Element ? event.target.closest("[data-link]") : null;
  if (!path || !["Delete", "Backspace"].includes(event.key)) return;
  event.preventDefault();
  selectedWorkflowEdgeId = path.dataset.link || "";
  deleteSelectedWorkflowEdge();
});
workflowEdgeDeleteButton?.addEventListener("click", () => deleteSelectedWorkflowEdge());
document.querySelector("#workflow-canvas-shell")?.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!selectedWorkflowEdgeId || target?.closest("[data-link], #workflow-edge-delete")) return;
  selectedWorkflowEdgeId = "";
  hideWorkflowEdgeDeleteButton();
  updateWorkflowLines();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pendingWorkflowSource) {
    clearWorkflowConnectionState();
    showWorkflowToast("已取消连线");
  }
  if (!["Delete", "Backspace"].includes(event.key) || !selectedWorkflowEdgeId) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  deleteSelectedWorkflowEdge();
});
document.querySelector("#workflow-reset")?.addEventListener("click", () => {
  loadWorkflowGraph(defaultWorkflowGraph());
  showWorkflowToast("已恢复示例工作流");
});
document.querySelector("#workflow-new")?.addEventListener("click", () => {
  clearWorkflowConnectionState();
  selectedWorkflowEdgeId = "";
  activeWorkflowScenePreset = "";
  loadWorkflowGraph({ version:6, scene_preset:"", nodes:[], edges:[] });
  workflowState.zoom = .82;
  workflowState.panX = Math.max(28, (workflowViewport?.clientWidth || 0) * .08);
  workflowState.panY = Math.max(28, (workflowViewport?.clientHeight || 0) * .1);
  applyWorkflowTransform();
  closeWorkflowNodePicker();
  showWorkflowToast("空白工作流已新建，双击幕布添加节点");
});
document.querySelector("#workflow-share")?.addEventListener("click", openWorkflowShareDialog);
document.querySelector("#workflow-share-dialog-close")?.addEventListener("click", () => workflowShareDialog?.close());
document.querySelector("#workflow-save-local")?.addEventListener("click", saveWorkflowLocally);
document.querySelector("#workflow-export")?.addEventListener("click", exportWorkflowJson);
document.querySelector("#workflow-publish")?.addEventListener("click", publishWorkflow);
document.querySelector("#workflow-copy-link")?.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(workflowShareLinkInput.value); showWorkflowToast("分享链接已复制"); }
  catch { workflowShareLinkInput.select(); document.execCommand("copy"); showWorkflowToast("分享链接已复制"); }
});
document.querySelector("#workflow-import")?.addEventListener("click", () => workflowImportFile?.click());
workflowImportFile?.addEventListener("change", async () => {
  const file = workflowImportFile.files?.[0];
  workflowImportFile.value = "";
  if (!file || file.size > 256 * 1024) return showWorkflowToast("只支持 256KB 以内的工作流 JSON");
  try {
    const value = JSON.parse(await file.text());
    loadWorkflowGraph(value.graph || value);
    setWorkspaceView("workflow");
    showWorkflowToast("工作流已导入");
  } catch { showWorkflowToast("工作流文件格式不正确"); }
});

// HTML 中保留的首屏示例只用于无脚本降级；脚本启动后立即按 v5 契约
// 重建，使首次打开和加载旧分享时都只出现统一媒体节点。
loadWorkflowGraph(serializeWorkflowGraph());
renderWorkflowNodePicker();
workflowBoard?.querySelectorAll("[data-node-id]").forEach(ensureWorkflowNodeRunButton);
workflowBoard?.querySelectorAll("[data-node-id]").forEach((node) => { bindWorkflowNodeControls(node); updateWorkflowCameraSummary(node); });
workflowSceneCover?.addEventListener("load", syncWorkflowRedrawSources);
syncWorkflowRedrawSources();
const workflowUrl = new URL(window.location.href);
if (workflowUrl.searchParams.get("workspace") === "workflow") setWorkspaceView("workflow");
if (workflowUrl.searchParams.get("workspace") === "assets") {
  setWorkspaceView("assets");
  loadAssetLibrary();
}
const workflowIdFromUrl = workflowUrl.searchParams.get("workflow") || "";
if (/^[a-f0-9]{12}$/.test(workflowIdFromUrl)) {
  fetchJson(`${API.workflows}/${workflowIdFromUrl}`, { method:"GET" }, 5000).then(({ body }) => {
    loadWorkflowGraph(body.workflow?.graph);
    setWorkspaceView("workflow");
    showWorkflowToast(`已打开「${String(body.workflow?.name || "共享工作流").slice(0, 30)}」`);
  }).catch(() => showWorkflowToast("分享的工作流不存在或已下架"));
}
if (requestedDiscovery === "workflows") showDiscovery("workflows");
