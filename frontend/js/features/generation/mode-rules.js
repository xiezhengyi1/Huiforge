export const VIDEO_MODES = new Set([
  "video_text", "video_image", "video_first_last", "video_reference", "video_edit",
  "video_extension", "video_style", "video_lip_sync", "video_character_swap",
  "video_digital_human", "unified_video",
]);

export const IMAGE_EDIT_MODES = new Set([
  "edit", "redraw", "multiview", "multiangle", "panorama", "upscale", "cutout", "interactive", "layers",
]);

export const VIDEO_IMAGE_MODES = new Set([
  "video_image", "video_first_last", "video_reference", "video_edit", "video_extension",
  "video_style", "video_lip_sync", "video_character_swap", "video_digital_human",
]);

export const AUDIO_MODES = new Set(["audio_tts", "audio_reference", "audio_custom_voice", "audio_image", "unified_audio"]);
export const AUDIO_SOURCE_MODES = new Set(["audio_reference", "audio_custom_voice", "audio_image"]);
export const AUDIO_REQUIRED_SOURCE_MODES = new Set(["audio_reference", "audio_image"]);
export const AUDIO_REFERENCE_MODES = new Set(["audio_reference", "audio_custom_voice"]);
export const SEEDANCE_MODEL_IDS = new Set(["seedance_2_0", "seedance_2_0_mini", "seedance_2_0_fast", "seedance_2_5"]);
export const SEEDANCE_VIDEO_MODELS = [...SEEDANCE_MODEL_IDS];
export const WAN3_VIDEO_MODEL_IDS = new Set(["wan3.0-video", "wan3.0-video-prime"]);
export const WAN3_VIDEO_MODELS = [...WAN3_VIDEO_MODEL_IDS];

export const UNIFIED_MODES = new Set(["unified_image", "unified_video", "unified_audio"]);

const UNIFIED_RESOLUTION = Object.freeze({
  unified_image: { withSource: "edit", withoutSource: "text" },
  unified_video: { withSource: "video_image", withoutSource: "video_text" },
  unified_audio: { withSource: "audio_reference", withoutSource: "audio_tts" },
});

const UNIFIED_MEDIA_RULES = Object.freeze({
  unified_image: { image: true, video: false, audio: false, max: 10 },
  unified_video: { image: true, video: false, audio: false, max: 1 },
  unified_audio: { image: false, video: false, audio: true, max: 1 },
});

export function resolveUnifiedMode(mode, hasSource) {
  if (!UNIFIED_MODES.has(mode)) return mode;
  const rule = UNIFIED_RESOLUTION[mode];
  return hasSource ? rule.withSource : rule.withoutSource;
}

export function sourceMediaRule(mode) {
  return UNIFIED_MEDIA_RULES[mode] || null;
}

export function sourceMediaLimits(mode) {
  const unifiedRule = sourceMediaRule(mode);
  if (unifiedRule) return { ...unifiedRule };
  return {
    max: mode === "video_first_last" ? 2
      : mode === "video_reference" ? 5
      : ["video_edit", "video_lip_sync"].includes(mode) ? 3
      : ["video_character_swap", "video_digital_human"].includes(mode) ? 2
      : ["edit", "interactive"].includes(mode) ? 10 : 1,
    video: new Set(["video_reference", "video_edit", "video_extension", "video_style", "video_lip_sync", "video_character_swap"]).has(mode),
    audio: new Set(["video_lip_sync", "video_digital_human", "audio_reference", "audio_custom_voice"]).has(mode),
    image: !new Set(["audio_reference", "audio_custom_voice"]).has(mode),
  };
}
