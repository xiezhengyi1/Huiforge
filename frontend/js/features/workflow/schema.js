export const WORKFLOW_NODE_CATEGORIES = Object.freeze({
  input: { label:"输入", accent:"#4d83a1" },
  image: { label:"图片", accent:"#a86478" },
  video: { label:"视频", accent:"#7b6698" },
  audio: { label:"音频", accent:"#397f8b" },
  output: { label:"输出", accent:"#3d816a" },
});

export const WORKFLOW_EDIT_MODELS = Object.freeze([
  ["qwen_image_edit", "Qwen Image Edit FP8"],
  ["gpt_image", "GPT Image 2 · fal.ai"],
  ["bailian_qwen_3_pro", "Qwen-Image 3.0 Pro"],
  ["seedream_5_0_pro", "Seedream 5.0 Pro"],
]);
export const WORKFLOW_GENERATION_MODELS = Object.freeze([
  ["qwen_image", "Qwen-Image-2512"],
  ["zimage_turbo", "Z-Image Turbo"],
  ["gpt_image", "GPT Image 2 · fal.ai"],
  ["bailian_qwen_3", "Qwen-Image 3.0"],
  ["bailian_qwen_3_pro", "Qwen-Image 3.0 Pro"],
  ["seedream_5_0", "Seedream 5.0"],
  ["seedream_5_0_pro", "Seedream 5.0 Pro"],
]);
export const WORKFLOW_RESOLUTIONS = Object.freeze([["720p","720p"],["1k","1K"],["2k","2K"],["4k","4K"]]);
export const WORKFLOW_QUALITIES = Object.freeze([["standard","标准"],["fine","精细"],["ultra","极致精细"]]);
export const WORKFLOW_RATIOS = Object.freeze([["1:1","1:1 方图"],["4:5","4:5 人像"],["3:4","3:4 竖幅"],["16:9","16:9 横幅"],["9:16","9:16 竖屏"],["21:9","21:9 影院"]]);
export const WORKFLOW_VIDEO_MODELS = Object.freeze([
  ["minimax_h3_max", "MiniMax H3 Max · fal.ai"],
  ["wan2.7-t2v-2026-06-12", "Wan 2.7 文生视频 · 已验证"],
  ["wan3.0-video", "Wan 3.0 视频 · 全能参考"],
  ["wan3.0-video-prime", "Wan 3.0 视频 Prime · 优速"],
  ["seedance_2_0", "Seedance 2.0"],
  ["seedance_2_0_mini", "Seedance 2.0 Mini"],
  ["seedance_2_0_fast", "Seedance 2.0 Fast"],
  ["seedance_2_5", "Seedance 2.5"],
]);
export const WORKFLOW_VIDEO_REFERENCE_PORTS = Object.freeze(Array.from({ length:30 }, (_, index) => `media${index + 1}`));
export const WORKFLOW_VIDEO_REFERENCE_LIMITS = Object.freeze({
  minimax_h3_max:1,
  "wan2.7-t2v-2026-06-12":5,
  "wan2.7-i2v-2026-04-25":5,
  "wan2.7-r2v-2026-06-12":5,
  "wan3.0-video":5,
  "wan3.0-video-prime":5,
  seedance_2_0:9,
  seedance_2_0_mini:9,
  seedance_2_0_fast:9,
  seedance_2_5:30,
});

export function workflowVideoReferenceLimit(model, mode) {
  if (mode === "text_to_video") return 0;
  if (mode === "first_last_to_video") return 2;
  return WORKFLOW_VIDEO_REFERENCE_LIMITS[model] || 1;
}
export const WORKFLOW_SEEDANCE_MODELS = Object.freeze([
  ["seedance_2_0", "Seedance 2.0"],
  ["seedance_2_0_mini", "Seedance 2.0 Mini"],
  ["seedance_2_0_fast", "Seedance 2.0 Fast"],
  ["seedance_2_5", "Seedance 2.5"],
]);
export const WORKFLOW_VIDEO_TOOL_MODELS = Object.freeze([
  ["wan2.7-videoedit", "Wan 2.7 视频编辑"],
  ["wan3.0-video", "Wan 3.0 视频 · 编辑/延展"],
  ["wan3.0-video-prime", "Wan 3.0 视频 Prime · 编辑/延展"],
  ["wanx2.1-vace-plus", "Wan VACE 视频延展"],
  ["video-style-transform", "Wan 视频风格化"],
  ["videoretalk", "Wan VideoRetalk 口型同步"],
  ["wan2.2-animate-mix", "Wan 视频角色替换"],
  ["wan2.2-s2v", "Wan 数字人播报"],
  ...WORKFLOW_SEEDANCE_MODELS,
]);

export const WORKFLOW_IMAGE_TOOL_OPTIONS = Object.freeze([
  ["edit", "指令编辑"], ["redraw", "局部重绘"], ["interactive", "交互编辑"],
  ["layers", "图层拆分"], ["multiview", "多视角"], ["multiangle", "多角度绘图"],
  ["panorama", "360° 全景"], ["upscale", "AI 超分"], ["cutout", "AI 抠图"], ["restore", "照片修复"],
  ["resize", "调整大小"], ["rotate", "旋转"], ["crop", "裁剪"],
  ["collage", "拼图"], ["watermark", "添加水印"], ["convert", "格式转换"],
]);
export const WORKFLOW_IMAGE_TOOLS_WITH_NATURAL_LANGUAGE = new Set(["edit", "redraw", "interactive"]);
export const WORKFLOW_VIDEO_TOOL_OPTIONS = Object.freeze([
  ["extract_frame", "抽帧"], ["enhance_video", "画质提升"],
  ["trim_video", "截取片段"], ["crop_video", "画面裁剪"],
  ["smart_cutout", "智能抠像"], ["segment_reshoot", "片段重拍"],
  ["video_edit", "AI 视频编辑"], ["video_extension", "视频延展"],
  ["video_style", "视频风格化"], ["lip_sync", "口型同步"],
  ["character_swap_video", "视频角色替换"], ["digital_human", "数字人播报"],
  ["video_depth", "转深度图"],
]);
export const WORKFLOW_CANONICAL_NODE_TYPES = new Set([
  "image_generator", "image_tool", "video_generator", "video_tool", "audio_generator", "audio_tool",
]);
export const WORKFLOW_GENERATION_NODE_TYPES = new Set(["image_generator", "video_generator", "audio_generator"]);
export const WORKFLOW_NODE_TEMPLATES = Object.freeze([
  { type:"media_input", category:"input", icon:"input", label:"输入", note:"在同一个节点中选择并上传图片、视频或音频", inputs:[], outputs:[{ name:"image", type:"image", label:"图片" },{ name:"video", type:"video", label:"视频" },{ name:"audio", type:"audio", label:"音频" }], fields:[{ key:"input_type", label:"输入类型", kind:"select", options:[["image","图片"],["video","视频"],["audio","音频"]] }], custom:"media-input" },
  { type:"image_generator", category:"image", icon:"image-generate", label:"AI 生图", note:"文字生成或参考图驱动，统一选择模型和输出规格", inputs:[{ name:"image1", type:"image", label:"参考图 1" },{ name:"image2", type:"image", label:"参考图 2" }], outputs:[{ name:"image", type:"image", label:"图像" }], fields:[{ key:"prompt", label:"提示词", kind:"textarea", placeholder:"描述画面；输入 @ 引用已连接图片" },{ key:"model", label:"模型", kind:"select", options:WORKFLOW_GENERATION_MODELS },{ key:"ratio", label:"画面比例", kind:"select", options:WORKFLOW_RATIOS },{ key:"resolution", label:"分辨率", kind:"select", options:WORKFLOW_RESOLUTIONS },{ key:"quality", label:"生成质量", kind:"select", options:WORKFLOW_QUALITIES },{ key:"count", label:"生成数量", kind:"select", options:[["1","1 张"],["2","2 张"],["4","4 张"]] }] },
  { type:"image_tool", category:"image", icon:"image-edit", label:"图片编辑", note:"在一个节点中选择重绘、超分、图层或本地编辑能力", inputs:[{ name:"image1", type:"image", label:"主图" },{ name:"image2", type:"image", label:"辅助图" },{ name:"image3", type:"image", label:"辅助图 2" },{ name:"image4", type:"image", label:"辅助图 3" }], outputs:[{ name:"image", type:"image", label:"图像" }], fields:[{ key:"tool", label:"具体能力", kind:"select", options:WORKFLOW_IMAGE_TOOL_OPTIONS },{ key:"prompt", label:"处理要求", kind:"textarea", placeholder:"描述希望修改的内容" },{ key:"model", label:"模型", kind:"select", options:WORKFLOW_EDIT_MODELS },{ key:"resolution", label:"分辨率", kind:"select", options:WORKFLOW_RESOLUTIONS },{ key:"views", label:"视角数量", kind:"select", options:[["3","3 个视角"],["4","4 个视角"],["9","9 个视角"]] },{ key:"selection", label:"选择方式", kind:"select", options:[["point","点选"],["bbox","框选"]] },{ key:"azimuth", label:"水平角度", kind:"range", min:"-180", max:"180", value:"45" },{ key:"elevation", label:"垂直角度", kind:"range", min:"-30", max:"75", value:"30" },{ key:"distance", label:"镜头距离", kind:"range", min:"2", max:"12", step:"0.1", value:"5.4" },{ key:"width", label:"宽度", kind:"number", value:"1024" },{ key:"height", label:"高度", kind:"number", value:"1024" },{ key:"fit", label:"适配", kind:"select", options:[["contain","完整显示"],["cover","铺满裁切"],["stretch","拉伸"]] },{ key:"degrees", label:"旋转角度", kind:"select", options:[["90","90°"],["180","180°"],["270","270°"]] },{ key:"ratio", label:"裁剪比例", kind:"select", options:WORKFLOW_RATIOS },{ key:"columns", label:"拼图列数", kind:"select", options:[["1","1 列"],["2","2 列"],["3","3 列"],["4","4 列"]] },{ key:"gap", label:"图片间距", kind:"number", value:"16" },{ key:"background", label:"背景色", kind:"text", value:"#ffffff" },{ key:"text", label:"水印文字", kind:"text", value:"绘域" },{ key:"position", label:"水印位置", kind:"select", options:[["bottom-right","右下"],["bottom-left","左下"],["top-right","右上"],["top-left","左上"],["center","居中"]] },{ key:"opacity", label:"透明度", kind:"range", min:"10", max:"100", value:"55" },{ key:"format", label:"输出格式", kind:"select", options:[["png","PNG"],["jpg","JPG"],["webp","WebP"]] },{ key:"quality", label:"输出质量", kind:"number", value:"92" }], custom:"image-tool" },
  { type:"video_generator", category:"video", icon:"video-generate", label:"AI 生成视频", note:"文字、首帧、首尾帧或参考图统一生成视频", inputs:[...WORKFLOW_VIDEO_REFERENCE_PORTS.map((name, index) => ({ name, type:"media", label:`参考图 ${index + 1}` }))], outputs:[{ name:"video", type:"video", label:"视频" }], fields:[{ key:"prompt", label:"提示词", kind:"textarea", placeholder:"描述镜头；输入 @ 引用已连接图片" },{ key:"mode", label:"生成方式", kind:"select", options:[["text_to_video","文生视频"],["image_to_video","图生视频"],["first_last_to_video","首尾帧生视频"],["reference_to_video","参考图生视频"]] },{ key:"model", label:"模型", kind:"select", options:WORKFLOW_VIDEO_MODELS },{ key:"resolution", label:"分辨率", kind:"select", options:[["480P","480P"],["768P","768P"],["720P","720P"],["1080P","1080P"]] },{ key:"ratio", label:"画面比例", kind:"select", options:[["16:9","16:9 横屏"],["9:16","9:16 竖屏"],["1:1","1:1 方形"],["4:3","4:3 横向"],["3:4","3:4 竖向"]] },{ key:"duration", label:"时长（秒）", kind:"range", min:"2", max:"30", value:"5" }] },
  { type:"video_tool", category:"video", icon:"video-edit", label:"视频编辑", note:"抽帧、提升画质、截取、裁剪、智能抠像、片段重拍与 AI 编辑", inputs:[{ name:"video", type:"video", label:"主视频" },{ name:"image", type:"image", label:"辅助图片" },{ name:"audio", type:"audio", label:"辅助音频" }], outputs:[{ name:"video", type:"video", label:"视频" },{ name:"image", type:"image", label:"抽帧图像" }], fields:[{ key:"tool", label:"具体能力", kind:"select", options:WORKFLOW_VIDEO_TOOL_OPTIONS },{ key:"prompt", label:"处理要求", kind:"textarea", placeholder:"描述希望的视频效果或重拍内容" },{ key:"model", label:"模型", kind:"select", options:WORKFLOW_VIDEO_TOOL_MODELS },{ key:"resolution", label:"分辨率", kind:"select", options:[["720P","720P"],["1080P","1080P"]] },{ key:"duration", label:"输出时长", kind:"range", min:"2", max:"30", value:"5" },{ key:"frame_time", label:"抽帧时间（秒）", kind:"number", value:"1" },{ key:"start_time", label:"开始时间（秒）", kind:"number", value:"0" },{ key:"end_time", label:"结束时间（秒）", kind:"number", value:"5" },{ key:"crop_ratio", label:"裁剪比例", kind:"select", options:[["16:9","16:9 横屏"],["9:16","9:16 竖屏"],["1:1","1:1 方形"],["4:3","4:3 横向"],["3:4","3:4 竖向"]] },{ key:"enhance_scale", label:"提升倍率", kind:"select", options:[["1.5","1.5×"],["2","2×"]] },{ key:"background", label:"抠像背景", kind:"select", options:[["transparent","透明通道"],["green","绿幕"],["white","白色"]] },{ key:"style_id", label:"预设风格", kind:"select", options:[["0","日式漫画"],["1","美式漫画"],["2","清新漫画"],["3","3D 卡通"],["4","国风卡通"],["5","纸艺"],["6","简易插画"],["7","国风水墨"]] },{ key:"palette", label:"深度样式", kind:"select", options:[["grayscale","灰度深度"],["color","彩色深度"]] },{ key:"target_fps", label:"处理帧率", kind:"select", options:[["12","12 FPS"],["24","24 FPS"],["30","30 FPS"]] },{ key:"max_frames", label:"最多帧数", kind:"select", options:[["300","300 帧"],["900","900 帧"],["1800","1800 帧"]] }] },
  { type:"audio_generator", category:"audio", icon:"audio-generate", label:"AI 生成音频", note:"文生配音、文字定制音色、图片旁白和参考音色统一生成", inputs:[{ name:"text", type:"text", label:"配音文本" },{ name:"image", type:"image", label:"旁白图片" },{ name:"audio", type:"audio", label:"参考音频（选填）" }], outputs:[{ name:"audio", type:"audio", label:"音频" }], fields:[{ key:"ability", label:"具体能力", kind:"select", options:[["text_dubbing","文生配音"],["custom_voice","定制音色"],["image_dubbing","图片配音"],["reference_audio","参考音频配声 / 声音复刻"]] },{ key:"text", label:"配音文本 / 旁白要求", kind:"textarea", placeholder:"输入需要朗读的文字；图片配音时可填写旁白风格" },{ key:"voice_description", label:"音色描述", kind:"textarea", placeholder:"例如：温暖明亮的青年女声，咬字清晰，语速舒缓" },{ key:"preview_text", label:"试听文案", kind:"text", value:"欢迎使用绘域" },{ key:"model", label:"模型", kind:"select", options:[["doubao-tts-2.0","豆包语音合成 2.0"],["qwen3-tts-flash","Qwen3-TTS Flash"],["qwen3-tts-instruct-flash","Qwen3-TTS 指令版"],["qwen-audio-3.0-tts-flash","Qwen-Audio 3.0 Flash"],["qwen-audio-3.0-tts-plus","Qwen-Audio 3.0 Plus"]] },{ key:"voice", label:"音色", kind:"select", options:[["zh_female_vv_uranus_bigtts","Vivi 2.0"],["zh_male_dayi_saturn_bigtts","大壹"],["zh_female_meilinvyou_saturn_bigtts","魅力女友"],["Cherry","芊悦"],["Serena","苏瑶"],["Ethan","晨煦"]] },{ key:"language_type", label:"语言", kind:"select", options:[["Auto","自动识别"],["Chinese","中文"],["English","英文"],["Japanese","日语"]] },{ key:"speed_ratio", label:"语速", kind:"range", min:"0.5", max:"2", step:"0.1", value:"1" },{ key:"emotion", label:"情绪", kind:"select", options:[["","自动理解"],["happy","开心"],["sad","悲伤"],["angry","生气"],["fear","恐惧"],["surprise","惊喜"]] }] },
  { type:"audio_tool", category:"audio", icon:"audio-edit", label:"音频编辑", note:"浏览器本地完成裁剪、响度归一和 WAV 转换", inputs:[{ name:"audio", type:"audio", label:"音频" }], outputs:[{ name:"audio", type:"audio", label:"音频" }], fields:[{ key:"tool", label:"具体能力", kind:"select", options:[["trim","裁剪音频"],["normalize","响度归一"],["convert","转换为 WAV"]] },{ key:"start", label:"开始秒数", kind:"number", value:"0" },{ key:"end", label:"结束秒数（0 为结尾）", kind:"number", value:"0" }] },
  { type:"media_output", category:"output", icon:"output", label:"输出", note:"选择输出图片、视频或音频，并预览最终结果", inputs:[{ name:"image", type:"image", label:"图片" },{ name:"video", type:"video", label:"视频" },{ name:"audio", type:"audio", label:"音频" }], outputs:[], fields:[{ key:"output_type", label:"输出类型", kind:"select", options:[["image","图片"],["video","视频"],["audio","音频"]] },{ key:"format", label:"下载格式", kind:"select", options:[["png","PNG"],["webp","WebP"],["jpg","JPG"],["mp4","MP4"],["webm","WebM"],["wav","WAV"]] },{ key:"save_history", label:"保存方式", kind:"select", options:[["auto","保存到个人资产"],["manual","只在本次预览"]] }], custom:"media-output" },
  { type:"text_output", category:"output", icon:"text", label:"文字输出", note:"查看并复制解析或字幕结果", inputs:[{ name:"text", type:"text", label:"文字" }], outputs:[], fields:[], custom:"text-output" },
]);
export const WORKFLOW_NODE_TYPES = new Set(WORKFLOW_NODE_TEMPLATES.map((item) => item.type));
