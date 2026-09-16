"""Model catalog, capability taxonomy, pricing snapshots and prompt assembly."""
from __future__ import annotations

import math
from typing import Any

from ..runtime.gpu_scheduler import ASPECT_RATIOS, FINAL_PIXEL_BUDGETS, HIGH_RESOLUTIONS, dimensions_for_ratio
from ..core.config import *

MODELS: dict[str, dict[str, Any]] = {
    "qwen_image": {
        "label": "Qwen-Image-2512",
        "base_url": "http://127.0.0.1:8001",
        "steps": 20,
    },
    "zimage_turbo": {
        "label": "Z-Image Turbo",
        "base_url": "http://127.0.0.1:8001",
        "steps": 4,
    },
    "zimage": {
        "label": "Z-Image",
        "base_url": "http://127.0.0.1:8001",
        "steps": 20,
    },
    "flux": {
        "label": "FLUX.1-dev",
        "base_url": "http://127.0.0.1:8002",
        "steps": 28,
    },
    "flux2": {
        "label": "FLUX.2-dev",
        "base_url": "http://127.0.0.1:8003",
        "steps": 28,
    },
    "gpt_image": {
        "label": "GPT Image 2",
        "api": True,
        "provider": "fal",
        "model_id": FAL_GPT_IMAGE_2_QUEUE_APPLICATION,
        "capabilities": ["text_to_image", "image_edit", "multi_reference", "mask_edit", "4k"],
        "steps": None,
    },
    "seedream_4_0": {
        "label": "Seedream 4.0",
        "api": True,
        "provider": "openai_compatible",
        "model_id": "doubao-seedream-4-0-250828",
        "steps": None,
        "capabilities": ["text_to_image", "image_edit", "multi_reference", "image_series", "stream"],
    },
    "seedream_4_5": {
        "label": "Seedream 4.5",
        "api": True,
        "provider": "openai_compatible",
        "model_id": "doubao-seedream-4-5-251128",
        "steps": None,
        "capabilities": ["text_to_image", "image_edit", "multi_reference", "image_series", "stream"],
    },
    "seedream_5_0": {
        "label": "Seedream 5.0",
        "api": True,
        "provider": "openai_compatible",
        "model_id": "doubao-seedream-5-0-260128",
        "steps": None,
        "capabilities": ["text_to_image", "image_edit", "multi_reference", "image_series", "stream", "png_output"],
    },
    "seedream_5_0_pro": {
        "label": "Seedream 5.0 Pro",
        "api": True,
        "provider": "openai_compatible",
        "model_id": "doubao-seedream-5-0-pro-260628",
        "steps": None,
        "capabilities": ["text_to_image", "image_edit", "multi_reference", "interactive_edit", "layer_decomposition"],
    },
    "google_nano_banana": {
        "label": "Nano Banana",
        "api": True,
        "provider": "google",
        "model_id": "gemini-2.5-flash-image",
        "capabilities": ["text_to_image", "image_edit"],
        "steps": None,
    },
    "google_nano_banana_pro": {
        "label": "Nano Banana Pro",
        "api": True,
        "provider": "google",
        "model_id": "gemini-3-pro-image",
        "capabilities": ["text_to_image", "image_edit", "multi_reference", "4k"],
        "steps": None,
    },
    "google_nano_banana_2": {
        "label": "Nano Banana 2",
        "api": True,
        "provider": "google",
        "model_id": "gemini-3.1-flash-image",
        "capabilities": ["text_to_image", "image_edit", "multi_reference", "4k"],
        "steps": None,
    },
    "google_nano_banana_2_lite": {
        "label": "Nano Banana 2 Lite",
        "api": True,
        "provider": "google",
        "model_id": "gemini-3.1-flash-lite-image",
        "capabilities": ["text_to_image", "image_edit"],
        "steps": None,
    },
    "bailian_qwen_3": {
        "label": "Qwen-Image 3.0",
        "api": True,
        "provider": "bailian",
        "model_id": "qwen-image-3.0",
        "steps": None,
    },
    "bailian_qwen_3_pro": {
        "label": "Qwen-Image 3.0 Pro",
        "api": True,
        "provider": "bailian",
        "model_id": "qwen-image-3.0-pro",
        "steps": None,
    },
    "bailian_wan_2_7": {
        "label": "Wan 2.7 Image",
        "api": True,
        "provider": "bailian",
        "model_id": "wan2.7-image",
        "steps": None,
    },
    "bailian_wan_2_7_pro": {
        "label": "Wan 2.7 Image Pro",
        "api": True,
        "provider": "bailian",
        "model_id": "wan2.7-image-pro",
        "steps": None,
    },
}

TOOL_MODEL_IDS = (
    "gpt_image",
    "seedream_4_0", "seedream_4_5", "seedream_5_0", "seedream_5_0_pro",
    "google_nano_banana", "google_nano_banana_pro", "google_nano_banana_2", "google_nano_banana_2_lite",
    "bailian_qwen_3", "bailian_qwen_3_pro", "bailian_wan_2_7", "bailian_wan_2_7_pro",
)

UPSCALER_MODEL_ID = "server_ultrasharp"
BACKGROUND_REMOVAL_MODEL_ID = "server_u2netp"

MODEL_CATALOG = [
    {
        "id": "qwen_image", "family": "阿里系", "name": "Qwen-Image-2512", "open": True, "local": True,
        "badges": ["本地", "免费", "中文强", "文字表现"], "tagline": "中文语义、海报构图与画面内文字更均衡",
        "best_for": ["中文长提示词", "海报与封面", "需要画面文字的设计"],
        "strengths": ["理解复合中文描述", "写实与设计类任务均衡", "本地队列不向第三方发送提示词"],
        "limitations": ["复杂小字仍需校对", "高分辨率由生成后 AI 超分完成"],
        "speed": "中等", "max_resolution": "4K（AI 超分）", "credit_note": "免费 · 0 Credits · 每分钟最多 10 次",
    },
    {
        "id": "zimage_turbo", "family": "阿里系", "name": "Z-Image Turbo", "open": True, "local": True,
        "badges": ["本地", "极速", "免费通道"], "tagline": "少步数快速出图，适合试构图和批量探索",
        "best_for": ["快速草图", "风格探索", "中文自然语言"],
        "strengths": ["3–8 步快速生成", "本地运行", "适合先构思再精修"],
        "limitations": ["精细文字与复杂结构不如高质量模型", "免费通道为低优先级公平队列"],
        "speed": "极快", "max_resolution": "4K（AI 超分）", "credit_note": "0 Credits（公平使用）",
    },
    {
        "id": "zimage", "family": "阿里系", "name": "Z-Image", "open": True, "local": True,
        "badges": ["本地", "高细节", "中文强"], "tagline": "更完整的细节与层次，适合最终成片",
        "best_for": ["氛围人像", "复杂场景", "高质感成片"],
        "strengths": ["中文提示词理解稳定", "细节密度高", "光影和材质层次丰富"],
        "limitations": ["速度慢于 Turbo", "同一张 GPU 上与编辑模型串行调度"],
        "speed": "较慢", "max_resolution": "4K（AI 超分）", "credit_note": "0 Credits（公平使用）",
    },
    {
        "id": "qwen_image_edit", "family": "图像编辑", "name": "Qwen-Image-Edit-2511 FP8", "open": True, "local": False, "tool_only": True,
        "badges": ["图像编辑", "待部署基座"], "tagline": "下载兼容基座后可负责重绘、多视角、多角度和全景工作流",
        "best_for": ["Alpha 蒙版局部重绘", "主体一致的换角度", "参考图延展"],
        "strengths": ["理解原图语义", "可接收服务器预设约束", "与 multiple-angle LoRA 联动"],
        "limitations": ["当前只有 Edit LoRA，没有 Qwen-Image-Edit 基座模型", "Qwen-Image-2512 是文生图模型，不能替代编辑基座"],
        "speed": "待部署", "max_resolution": "4K（AI 超分）", "credit_note": "当前不可用",
    },
    {
        "id": "flux", "family": "Flux 系列", "name": "FLUX.1-dev", "open": True, "local": True,
        "badges": ["可选加载", "写实", "构图强"], "tagline": "写实光影与镜头语言突出，默认不进入启动队列",
        "best_for": ["商业摄影", "电影感场景", "材质表现"],
        "strengths": ["写实质感好", "镜头与空间表现自然"],
        "limitations": ["当前默认不常驻", "切换模型需要等待并占用显存"],
        "speed": "较慢", "max_resolution": "4K（AI 超分）", "credit_note": "暂未开放",
    },
    {
        "id": "flux2", "family": "Flux 系列", "name": "FLUX.2-dev", "open": True, "local": False,
        "badges": ["计划接入", "高质量"], "tagline": "下一代 FLUX 线路的预留模型位",
        "best_for": ["高质量写实", "商业视觉"], "strengths": ["保留接入能力"],
        "limitations": ["当前服务器未启用"], "speed": "未启用", "max_resolution": "待配置", "credit_note": "未开放",
    },
    {
        "id": "gpt_image", "family": "GPT 系列", "name": "GPT Image 2", "open": False, "local": False, "api": True,
        "badges": ["fal.ai", "文字准确", "生成与编辑", "4K"], "tagline": "擅长复杂指令、精细排版与多参考图自然语言编辑",
        "best_for": ["信息图与海报", "准确文字", "多轮图像编辑"],
        "strengths": ["指令遵循强", "画面内文字能力突出", "最多 10 张站内参考图", "支持蒙版编辑"],
        "limitations": ["提示词和图片会发送至 fal.ai / OpenAI", "高质量与 4K 输出成本较高"],
        "speed": "中等", "max_resolution": "4K", "credit_note": "按质量与分辨率动态计价",
    },
    {
        "id": "google_nano_banana", "family": "Google 系列", "name": "Nano Banana", "open": False, "local": False, "api": True,
        "badges": ["Google API", "经典", "生成与编辑"], "tagline": "Gemini 2.5 Flash Image，适合快速生成与自然语言编辑",
        "best_for": ["快速创意", "对话式编辑", "常规 1K 配图"],
        "strengths": ["生成与编辑接口统一", "指令理解自然", "生态成熟"],
        "limitations": ["仅适合 1K 输出", "Google 已建议迁移至 Nano Banana 2 Lite"],
        "speed": "快", "max_resolution": "1K", "credit_note": "6 Credits/张",
    },
    {
        "id": "google_nano_banana_pro", "family": "Google 系列", "name": "Nano Banana Pro", "open": False, "local": False, "api": True,
        "badges": ["Google API", "专业设计", "4K"], "tagline": "Gemini 3 Pro Image，面向复杂版式、产品样机和准确文字",
        "best_for": ["高保真商业设计", "复杂图文排版", "4K 主视觉"],
        "strengths": ["推理驱动的专业设计", "准确文字表现", "最高 4K"],
        "limitations": ["单张成本最高", "高复杂度任务延迟更长"],
        "speed": "中等", "max_resolution": "4K", "credit_note": "20 Credits/张",
    },
    {
        "id": "google_nano_banana_2", "family": "Google 系列", "name": "Nano Banana 2", "open": False, "local": False, "api": True,
        "badges": ["Google API", "高吞吐", "4K"], "tagline": "Gemini 3.1 Flash Image，兼顾质量、速度和规模化生产",
        "best_for": ["高频商业创作", "多轮编辑", "多尺寸交付"],
        "strengths": ["支持 512、1K、2K、4K", "多语言文字更稳", "高吞吐"],
        "limitations": ["4K 成本高于常规 1K", "会将内容发送至 Google API"],
        "speed": "很快", "max_resolution": "4K", "credit_note": "10 Credits/张",
    },
    {
        "id": "google_nano_banana_2_lite", "family": "Google 系列", "name": "Nano Banana 2 Lite", "open": False, "local": False, "api": True,
        "badges": ["Google API", "低延迟", "低成本"], "tagline": "Gemini 3.1 Flash Lite Image，适合大规模交互式生成与编辑",
        "best_for": ["批量缩略图", "快速试稿", "高并发互动"],
        "strengths": ["四款中价格最低", "低延迟", "支持生成与编辑"],
        "limitations": ["当前固定 1K 输出", "复杂设计优先选择 Pro"],
        "speed": "极快", "max_resolution": "1K", "credit_note": "5 Credits/张",
    },
    {
        "id": "seedream_4_0", "family": "Seed 系列", "name": "Seedream 4.0", "open": False, "local": False, "api": True,
        "badges": ["API", "组图", "多图参考"], "tagline": "面向日常中文创作的均衡型商业模型",
        "best_for": ["日常创作", "中文场景", "营销配图"], "strengths": ["中文语义自然", "支持最多 15 张关联组图", "支持多参考图编辑"],
        "limitations": ["当前需配置服务密钥"], "speed": "快", "max_resolution": "由 API 决定", "credit_note": "按 API 成本换算",
    },
    {
        "id": "seedream_4_5", "family": "Seed 系列", "name": "Seedream 4.5", "open": False, "local": False, "api": True,
        "badges": ["API", "组图", "流式输出"], "tagline": "强化审美、光影与复杂画面表现",
        "best_for": ["广告视觉", "人物写真", "复杂场景"], "strengths": ["成片感强", "中文提示词友好", "支持多参考图与关联组图"],
        "limitations": ["当前需配置服务密钥"], "speed": "中等", "max_resolution": "由 API 决定", "credit_note": "按 API 成本换算",
    },
    {
        "id": "seedream_5_0", "family": "Seed 系列", "name": "Seedream 5.0 Lite", "open": False, "local": False, "api": True,
        "badges": ["API", "组图", "多图参考"], "tagline": "较低成本的快速商业生成线路",
        "best_for": ["批量创意", "电商配图", "快速提案"], "strengths": ["速度与成本平衡", "支持关联组图", "支持 PNG 输出与多参考图"],
        "limitations": ["免费用户不可调用", "当前需配置服务密钥"], "speed": "快", "max_resolution": "3K", "credit_note": "9 Credits/张",
    },
    {
        "id": "seedream_5_0_pro", "family": "Seed 系列", "name": "Seedream 5.0 Pro", "open": False, "local": False, "api": True,
        "badges": ["API", "图层拆分", "交互编辑"], "tagline": "支持坐标交互编辑与最多 16 个可复用图层",
        "best_for": ["专业广告", "交互式精修", "分层设计交付"], "strengths": ["点选与框选精准编辑", "单图拆成底图与最多 16 个透明图层", "支持 2–10 张参考图"],
        "limitations": ["不支持组图与流式输出", "高像素档消耗更多 Credits", "需先在火山方舟开通模型"], "speed": "中等", "max_resolution": "4K", "credit_note": "12–24 Credits/张",
    },
    {
        "id": "bailian_qwen_3", "family": "阿里云百炼", "name": "Qwen-Image 3.0", "open": False, "local": False, "api": True,
        "badges": ["百炼 API", "快速", "文字准确"], "tagline": "兼顾速度、复杂版面和多语言文字渲染",
        "best_for": ["海报排版", "中文文字", "快速商业提案"], "strengths": ["生成与编辑能力统一", "最多 6 张输出"],
        "limitations": ["图片与提示词会发送至阿里云百炼", "最高 2048×2048"], "speed": "快", "max_resolution": "2048×2048", "credit_note": "8 Credits/张",
    },
    {
        "id": "bailian_qwen_3_pro", "family": "阿里云百炼", "name": "Qwen-Image 3.0 Pro", "open": False, "local": False, "api": True,
        "badges": ["百炼 API", "Pro", "复杂版面"], "tagline": "更强的真实质感、语义遵循和复杂信息排版",
        "best_for": ["高完成度海报", "多语言字体", "复杂商业视觉"], "strengths": ["复杂指令遵循更强", "最多 6 张输出"],
        "limitations": ["图片与提示词会发送至阿里云百炼", "高分辨率消耗更高"], "speed": "中等", "max_resolution": "2048×2048", "credit_note": "11–20 Credits/张",
    },
    {
        "id": "bailian_wan_2_7", "family": "阿里云百炼", "name": "Wan 2.7 Image", "open": False, "local": False, "api": True,
        "badges": ["百炼 API", "多图参考", "角色一致"], "tagline": "适合品牌色、角色一致性与多图组合编辑",
        "best_for": ["电商系列图", "角色连续图", "多图融合"], "strengths": ["最多 9 张参考图", "支持连续组图"],
        "limitations": ["当前编辑台先开放文生图", "图片与提示词会发送至阿里云百炼"], "speed": "快", "max_resolution": "2048×2048", "credit_note": "9 Credits/张",
    },
    {
        "id": "bailian_wan_2_7_pro", "family": "阿里云百炼", "name": "Wan 2.7 Image Pro", "open": False, "local": False, "api": True,
        "badges": ["百炼 API", "4K 文生图", "交互编辑"], "tagline": "面向商用主视觉、品牌控制和高分辨率交付",
        "best_for": ["4K 主视觉", "商品系列图", "角色一致性"], "strengths": ["文生图最高 4K", "支持边界框交互编辑"],
        "limitations": ["图像编辑最高 2K", "当前编辑台先开放文生图"], "speed": "中等", "max_resolution": "4K（文生图）", "credit_note": "12 Credits 起",
    },
]

QUALITY_STEPS = {"standard": 20, "fine": 24, "ultra": 28}

TURBO_QUALITY_STEPS = {"standard": 3, "fine": 4, "ultra": 8}

def model_is_available(model_id: str, capabilities: dict[str, Any]) -> bool:
    """Resolve availability per provider instead of gating every model on Z-Image."""
    if model_id in {"qwen_image", "zimage_turbo", "zimage"}:
        return bool(capabilities.get("zimage"))
    if model_id == "gpt_image":
        return bool(FAL_KEY and FAL_QUEUE_BASE_URL)
    if model_id.startswith("google_"):
        return bool(GOOGLE_API_KEY)
    if model_id.startswith("bailian_"):
        return bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL)
    if model_id.startswith("seedream_"):
        return bool(SEEDREAM_API_KEY and SEEDREAM_BASE_URL)
    # FLUX remains documented in the interface, but is intentionally absent
    # from the default startup queue.
    return False


def fal_gpt_image_size_for_ratio(ratio: float, resolution: str) -> dict[str, int]:
    """Build a GPT Image 2 custom size within Fal's documented pixel limits."""
    pixel_budget = max(FINAL_PIXEL_BUDGETS["720p"], FINAL_PIXEL_BUDGETS[resolution])
    height = math.sqrt(pixel_budget / ratio)
    width = height * ratio
    if max(width, height) > 3840:
        scale = 3840 / max(width, height)
        width *= scale
        height *= scale
    width = max(16, round(width / 16) * 16)
    height = max(16, round(height / 16) * 16)
    return {"width": width, "height": height}


def fal_gpt_image_size(aspect_ratio: str, resolution: str) -> dict[str, int]:
    return fal_gpt_image_size_for_ratio(ASPECT_RATIOS[aspect_ratio], resolution)

def google_image_size(model_id: str, resolution: str) -> str:
    """Map workbench resolution labels to sizes supported by each Gemini image model."""
    if model_id in {"google_nano_banana", "google_nano_banana_2_lite"}:
        return "1K"
    if resolution == "4k":
        return "4K"
    if resolution == "2k":
        return "2K"
    if model_id == "google_nano_banana_2" and resolution == "480p":
        return "512"
    return "1K"

def normalized_provider_usage(value: Any) -> dict[str, Any]:
    """Keep only numeric billing metadata; never persist provider payloads or prompts."""
    if not isinstance(value, dict):
        return {}
    result: dict[str, Any] = {}
    for key in (
        "total_input_tokens", "total_output_tokens", "total_thought_tokens",
        "total_cached_tokens", "total_tool_use_tokens",
    ):
        if isinstance(value.get(key), (int, float)):
            result[key] = max(0, int(value[key]))
    for key in ("input_tokens_by_modality", "output_tokens_by_modality"):
        entries = []
        for item in value.get(key, []) if isinstance(value.get(key), list) else []:
            if isinstance(item, dict) and isinstance(item.get("tokens"), (int, float)):
                entries.append({"modality": str(item.get("modality") or "unknown")[:24], "tokens": max(0, int(item["tokens"]))})
        if entries:
            result[key] = entries
    return result

def estimated_provider_cost_usd(model_id: str, resolution: str, image_count: int, usage: dict[str, Any]) -> tuple[float | None, str | None]:
    pricing = GOOGLE_IMAGE_PRICING_USD.get(model_id)
    if not pricing:
        cfg = MODELS.get(model_id, {})
        return (0.0, "local_compute") if not cfg.get("api") else (None, None)
    image_size = google_image_size(model_id, resolution)
    image_rate = pricing["image"].get(image_size)
    if image_rate is None:
        return None, str(pricing.get("source") or "")
    input_tokens = int(usage.get("total_input_tokens") or 0)
    text_output_tokens = sum(
        int(item.get("tokens") or 0)
        for item in usage.get("output_tokens_by_modality", [])
        if item.get("modality") == "text"
    )
    if not text_output_tokens:
        # Avoid charging image tokens again when the provider omits modality
        # breakdown; thought tokens are billed at the text-output rate.
        text_output_tokens = int(usage.get("total_thought_tokens") or 0)
    cost = (
        image_rate * max(0, image_count)
        + input_tokens * float(pricing["input_per_million"]) / 1_000_000
        + text_output_tokens * float(pricing["text_output_per_million"]) / 1_000_000
    )
    return round(cost, 8), str(pricing.get("source") or "")

SIZE_BY_RATIO = {
    "1:1": "512x512",
    "4:5": "512x640",
    "3:4": "576x768",
    "2:3": "512x768",
    "9:16": "432x768",
    "16:9": "768x432",
    "3:2": "768x512",
    "21:9": "896x384",
}

STYLE_HINTS = {
    "natural": "natural photography, balanced composition",
    "editorial": "editorial photography, refined art direction",
    "illustration": "artistic illustration, sophisticated color and detail",
    "cinematic": "电影感构图，浅景深，柔和的戏剧性光线，冷暖色调对比，35mm胶片质感，氛围浓郁，画面细节丰富",
    "cyberpunk": "霓虹灯招牌，赛博朋克都市夜景，雨雾弥漫，冷蓝与品红霓虹光对比，科幻未来感，高细节，反乌托邦氛围",
    "chinese": "中国古典美学，水墨意境，古风场景，柔和自然光，留白构图，工笔细节，雅致色调",
    "healing": "清新治愈，明亮柔和自然光，低饱和柔和色彩，浅景深，日系胶片质感，温暖宁静的氛围",
    "suspense": "悬疑氛围，昏暗低饱和色调，硬质阴影，窥视感构图，胶片颗粒感，紧张压抑的情绪张力",
    "scifi": "科幻史诗感，未来都市与巨型建筑，冷色科技光，广角大纵深构图，大气透视，高细节渲染",
    "portrait": "精致五官，自然妆造，柔光人像，浅景深虚化背景，皮肤质感细腻，眼神光，高级感",
    "anime": "日系二次元画风，赛璐璐风格，清透色彩，精致线条，动画电影质感，梦幻光效",
    "charsheet": "16:9 横向高清角色设定一图流，主体为全身人物立绘，周围包含角色的正面、侧面、背面小图或局部特写，以及 4-6 个表情变化小格；右侧或下方排布服装细节、武器/道具、配饰与材质特写，整体为专业游戏美术设定稿排版，干净背景，高细节，清晰线稿与上色，信息丰富但布局整洁",
}

TOOL_PROMPT_PRESETS: dict[str, list[dict[str, str]]] = {
    "edit": [
        {"id": "edit-faithful", "label": "忠实编辑", "prompt": "编辑目标：严格按照补充要求修改输入图。硬性保留：未被要求改变的主体身份、几何结构、构图、机位、光线方向和背景关系保持一致；新增内容与原图透视、材质、颗粒和色彩自然融合。"},
        {"id": "edit-product", "label": "商品精修", "prompt": "编辑目标：在保持商品造型、品牌标识、比例和材质准确的前提下完成商业级精修。画面要求：轮廓干净、反射可信、布光克制、背景无接缝；不要改变商品结构。"},
        {"id": "edit-portrait", "label": "人像精修", "prompt": "编辑目标：自然改善人像画面。硬性保留：人物身份、五官比例、年龄特征和真实皮肤纹理；避免过度磨皮、五官漂移、手部变形和虚假塑料感。"},
        {"id": "edit-restore", "label": "照片修复", "prompt": "编辑目标：修复划痕、折痕、噪点、褪色和模糊，恢复自然细节与层次。硬性保留：人物身份、年代特征、原始构图和真实纹理；不要凭空增加文字或物体。"},
        {"id": "edit-style", "label": "风格迁移", "prompt": "编辑目标：只改变整体视觉风格与媒介质感。硬性保留：主体身份、姿态、构图、空间关系和关键轮廓；风格统一，边缘干净，不添加文字或水印。"},
    ],
    "redraw": [
        {"id": "redraw-natural", "label": "自然补绘", "prompt": "编辑目标：只重绘 Alpha 蒙版覆盖区域。衔接要求：新内容延续原图的透视、光线方向、材质与颗粒。硬性保留：蒙版外的主体、背景、构图与像素保持不变，边缘自然过渡。"},
        {"id": "redraw-remove", "label": "移除物体", "prompt": "编辑目标：只移除 Alpha 蒙版区域内的主体。补全要求：依据周围结构、纹理、阴影与透视自然补全背景。硬性保留：蒙版外内容、机位、光线和色彩保持不变。"},
        {"id": "redraw-material", "label": "替换材质", "prompt": "编辑目标：只替换 Alpha 蒙版区域的材质与颜色。硬性保留：原始形状、几何结构、构图、机位和光照方向不变；蒙版边缘无接缝。"},
    ],
    "multiview": [
        {"id": "multiview-product", "label": "产品标准视图", "prompt": "创作目标：生成同一产品的正面、左侧、右侧与背面标准视图。构图：白色无缝背景、同一焦段、等距排布。硬性保留：身份、比例、标签位置、材质和关键细节一致，不增加或遗漏部件。"},
        {"id": "multiview-character", "label": "角色设定视图", "prompt": "创作目标：生成同一角色的正面、侧面与背面设定视图。构图与光线：中性站姿、白色背景、同一焦段、均匀柔光。硬性保留：脸型、发型、服装、配饰、体型与身份完全一致。"},
        {"id": "multiview-object", "label": "物体结构视图", "prompt": "创作目标：从多个标准方位完整展示同一物体。构图：同一焦段、尺度与背景，视图排列清楚。硬性保留：几何结构、比例、材质和部件数量一致，不增加或遗漏部件。"},
    ],
    "multiangle": [
        {"id": "multiangle-faithful", "label": "忠实换机位", "prompt": "编辑目标：只按指定的水平角、俯仰角和景别改变相机机位。硬性保留：主体身份、造型、颜色、材质、动作和场景内容一致，不新增主体。"},
        {"id": "multiangle-product", "label": "产品环绕机位", "prompt": "编辑目标：只按相机参数改变产品的观察角度。场景与光线：干净棚拍背景和一致柔光。硬性保留：产品造型、比例、标签位置、材质与部件不变。"},
        {"id": "multiangle-character", "label": "角色环绕机位", "prompt": "编辑目标：只转换摄像机方位、俯仰和距离。硬性保留：人物身份、五官、发型、服装、姿态与场景不变；不要新增人物或改变动作。"},
    ],
    "panorama": [
        {"id": "panorama-interior", "label": "室内 360° 全景", "prompt": "创作目标：以输入图为锚点生成真正可环视一周的 360° 室内全景。投影规格：2:1 等距柱状投影，水平视场 360°、垂直视场 180°，地平线位于画面中线。空间要求：补足前后左右和头顶、地面关系，建筑结构与尺度连续。硬性保留：原图材质、光源方向和视觉语言；最左与最右边缘必须无缝衔接。禁止鱼眼、普通超广角、立方体贴图、拼贴和边框。"},
        {"id": "panorama-landscape", "label": "自然环境 360° 全景", "prompt": "创作目标：将输入场景扩展为真正可环视一周的 360° 自然环境全景。投影规格：2:1 等距柱状投影，水平视场 360°、垂直视场 180°，地平线稳定居中。空间要求：地貌、天空、地面和远景连续。硬性保留：天气、光线和色彩与原图一致；最左与最右边缘必须无缝衔接。禁止鱼眼、普通超广角、立方体贴图、拼贴和边框。"},
        {"id": "panorama-concept", "label": "概念空间 360° 全景", "prompt": "创作目标：围绕输入图建立完整可环视一周的 360° 沉浸空间。投影规格：2:1 等距柱状投影，水平视场 360°、垂直视场 180°，地平线位于画面中线。空间要求：补足前后左右、头顶和地面关系并保持可信尺度。硬性保留：核心视觉语言、材质和色彩体系；最左与最右边缘必须无缝衔接。禁止鱼眼、普通超广角、立方体贴图、拼贴和边框。"},
    ],
    "upscale": [
        {"id": "upscale-faithful", "label": "忠实超分", "prompt": "只增强清晰度、边缘、纹理和微小细节，不改变主体身份、文字、构图、颜色、材质或画面内容。"},
    ],
    "cutout": [
        {"id": "cutout-alpha", "label": "透明背景", "prompt": "准确分离前景主体，保留自然发丝、透明物和半透明边缘，输出透明 Alpha 背景 PNG。"},
    ],
    "interactive": [
        {"id": "interactive-precise", "label": "精准交互编辑", "prompt": "严格根据点选或框选坐标定位目标，只修改用户明确描述的对象或区域，其余内容保持不变。"},
    ],
    "layers": [
        {"id": "layers-standard", "label": "标准图层拆分", "prompt": "将画面拆成语义清晰、可单独复用的透明图层，并保留一张完整底图。"},
    ],
}

CAPABILITY_GROUPS: list[dict[str, Any]] = [
    {"id": "drawing-models", "name": "AI 生图", "icon": "✦", "items": [
        {"id": "drawing-unified", "name": "AI 生图", "description": "描述画面；上传参考图就沿着它继续创作", "badges": ["文生图", "图生图"], "action": "drawing-mode", "mode": "unified_image", "availability": "image_generation"}
    ]},
    {"id": "image-models", "name": "图像模型", "icon": "▧", "items": [
        {"id": "model-zimage-turbo", "name": "Z-Image Turbo", "description": "本地少步数快速构思", "badges": ["本地", "极速", "免费"], "action": "model", "model": "zimage_turbo", "availability": "zimage"},
        {"id": "model-zimage", "name": "Z-Image", "description": "本地高细节生成", "badges": ["本地", "高细节"], "action": "model", "model": "zimage", "availability": "zimage"},
        {"id": "model-qwen2512", "name": "Qwen-Image-2512", "description": "免费使用 · 每分钟最多 10 次", "badges": ["本地", "免费", "中文强"], "action": "model", "model": "qwen_image", "availability": "zimage"},
        {"id": "model-qwen3", "name": "Qwen-Image 3.0", "description": "百炼快速商业生成", "badges": ["百炼 API", "中文强"], "action": "model", "model": "bailian_qwen_3", "availability": "bailian"},
        {"id": "model-qwen3-pro", "name": "Qwen-Image 3.0 Pro", "description": "复杂版面与文字渲染", "badges": ["百炼 API", "Pro", "文字"], "action": "model", "model": "bailian_qwen_3_pro", "availability": "bailian"},
        {"id": "model-wan27", "name": "Wan 2.7 Image", "description": "多图参考与角色一致性", "badges": ["百炼 API", "多图参考"], "action": "model", "model": "bailian_wan_2_7", "availability": "bailian"},
        {"id": "model-wan27-pro", "name": "Wan 2.7 Image Pro", "description": "4K 文生图与商用主视觉", "badges": ["百炼 API", "Pro", "4K"], "action": "model", "model": "bailian_wan_2_7_pro", "availability": "bailian"},
        {"id": "model-seedream40", "name": "Seedream 4.0", "description": "多参考图与关联组图", "badges": ["火山 API", "组图", "多图参考"], "action": "model", "model": "seedream_4_0", "availability": "volcano"},
        {"id": "model-seedream45", "name": "Seedream 4.5", "description": "高质感商业图像与关联组图", "badges": ["火山 API", "组图", "流式"], "action": "model", "model": "seedream_4_5", "availability": "volcano"},
        {"id": "model-seedream5", "name": "Seedream 5.0 Lite", "description": "快速组图、多参考图与 PNG 输出", "badges": ["火山 API", "组图", "多图参考"], "action": "model", "model": "seedream_5_0", "availability": "volcano"},
        {"id": "model-seedream5-pro", "name": "Seedream 5.0 Pro", "description": "坐标交互编辑与图层拆分", "badges": ["火山 API", "图层拆分", "交互编辑"], "action": "model", "model": "seedream_5_0_pro", "availability": "volcano"},
        {"id": "model-flux1", "name": "FLUX.1-dev", "description": "写实光影与镜头语言", "badges": ["可选加载", "写实", "构图强"], "action": "model", "model": "flux", "availability": "route_pending", "requires": "需配置本地 FLUX.1 服务；该模型不进入默认启动队列。"},
        {"id": "model-flux2", "name": "FLUX.2-dev", "description": "下一代 FLUX 高质量线路", "badges": ["计划接入", "高质量"], "action": "model", "model": "flux2", "availability": "route_pending", "requires": "需提供并配置 FLUX.2 模型服务。"},
        {"id": "model-gpt-image", "name": "GPT Image 2", "description": "复杂指令、精细排版、4K 生成与多参考图编辑", "badges": ["fal.ai", "文字准确", "生成与编辑", "4K"], "action": "model", "model": "gpt_image", "availability": "fal_image", "requires": "需配置 fal.ai API Key。"},
        {"id": "model-nano-banana", "name": "Nano Banana", "description": "Gemini 2.5 快速生成与编辑", "badges": ["Google API", "经典", "1K"], "action": "model", "model": "google_nano_banana", "availability": "google", "requires": "需配置 Google Gemini API。"},
        {"id": "model-nano-banana-pro", "name": "Nano Banana Pro", "description": "专业设计、准确文字与 4K 输出", "badges": ["Google API", "专业", "4K"], "action": "model", "model": "google_nano_banana_pro", "availability": "google", "requires": "需配置 Google Gemini API。"},
        {"id": "model-nano-banana-2", "name": "Nano Banana 2", "description": "高吞吐生成、编辑与多尺寸输出", "badges": ["Google API", "高吞吐", "4K"], "action": "model", "model": "google_nano_banana_2", "availability": "google", "requires": "需配置 Google Gemini API。"},
        {"id": "model-nano-banana-2-lite", "name": "Nano Banana 2 Lite", "description": "超低延迟、低成本批量生成", "badges": ["Google API", "低延迟", "低成本"], "action": "model", "model": "google_nano_banana_2_lite", "availability": "google", "requires": "需配置 Google Gemini API。"}
    ]},
    {"id": "image-edit", "name": "图片编辑", "icon": "◌", "items": [
        {"id": "image-analysis", "name": "图片解析", "description": "识别主体、构图、文字与风格", "action": "analysis", "availability": "bailian_vl", "requires": "阿里云百炼 Qwen3-VL 视觉理解 API"},
        {"id": "inpaint", "name": "局部重绘", "description": "Alpha 画笔选择修改区域", "action": "compose", "mode": "redraw", "availability": "image_tools"},
        {"id": "generic-edit", "name": "指令编辑", "description": "用自然语言增删改画面", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "只修改我明确描述的内容，未提及区域与主体保持不变。"},
        {"id": "seedream-interactive", "name": "交互编辑", "description": "点选或框选画面后精准修改", "badges": ["Seedream 5.0 Pro", "坐标"], "action": "compose", "mode": "interactive", "availability": "volcano"},
        {"id": "seedream-layers", "name": "图层拆分", "description": "拆成底图与最多 16 个透明图层", "badges": ["Seedream 5.0 Pro", "PNG 图层"], "action": "compose", "mode": "layers", "availability": "volcano"},
        {"id": "ai-upscale", "name": "无损放大", "description": "上传图片后进行 AI 超分", "action": "compose", "mode": "upscale", "availability": "upscaler"},
        {"id": "photo-restore", "name": "照片修复", "description": "去划痕、降噪、恢复细节", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "修复老照片的划痕、折痕、噪点与褪色，恢复自然清晰度和真实细节。"},
        {"id": "image-editor", "name": "图片编辑器", "description": "在同一窗口完成拼图、尺寸、旋转、裁剪、格式转换与水印", "action": "client", "client_tool": "editor", "availability": "browser"}
    ]},
    {"id": "commerce", "name": "电商专区", "icon": "◇", "items": [
        {"id": "product-background", "name": "商品换背景", "description": "保留商品，重做陈列环境", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "严格保留商品造型、品牌标识、比例和材质，只替换为高级商业摄影背景。"},
        {"id": "marketing-poster", "name": "营销图海报", "description": "商品主视觉与留白排版", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "将商品制作成商业营销主视觉，保留产品准确性，预留干净文案区，不生成乱码文字。"},
        {"id": "background-removal", "name": "AI 抠图", "description": "输出透明 Alpha 背景", "badges": ["本地", "透明 PNG"], "action": "compose", "mode": "cutout", "availability": "background_removal"},
        {"id": "virtual-tryon", "name": "模特换装", "description": "保留身份和姿态替换服装", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保持人物身份、脸部、姿态和背景不变，仅替换服装，剪裁贴合、材质和阴影真实。"},
        {"id": "model-replace", "name": "模特更换调整", "description": "保留商品关系调整模特", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保留商品、穿戴关系与构图，按要求调整模特形象，确保人体结构和遮挡关系真实。"},
        {"id": "product-angles", "name": "商品标准视图", "description": "生成统一正侧背产品组图", "action": "compose", "mode": "multiview", "availability": "image_tools"},
        {"id": "product-multiangle", "name": "商品环绕机位", "description": "拖动相机查看同一商品的新机位", "action": "compose", "mode": "multiangle", "availability": "image_tools", "prompt": "保持商品造型、比例、标签位置、材质、部件和布光关系准确，只移动相机到指定偏移角度，不旋转或重塑商品。"}
    ]},
    {"id": "architecture", "name": "建筑室内", "icon": "▱", "items": [
        {"id": "sketch-render", "name": "线稿渲染", "description": "草图转可信建筑效果图", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "严格遵循原图线稿的结构、开口、透视和尺度，渲染为真实建筑效果图。"},
        {"id": "interior-style", "name": "室内风格替换", "description": "保持布局更换设计语言", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保持空间布局、墙体、门窗、机位和尺度不变，只替换室内设计风格与软装材质。"},
        {"id": "material-replace", "name": "材质替换", "description": "墙地顶材质定向修改", "action": "compose", "mode": "redraw", "availability": "image_tools"},
        {"id": "day-night", "name": "日夜转换", "description": "保持建筑切换时间与灯光", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保持建筑、机位和景观不变，转换为指定时间与天气，灯光和反射符合真实物理。"},
        {"id": "interior-panorama", "name": "室内 360° 全景", "description": "生成 2:1 等距柱状环视空间", "action": "compose", "mode": "panorama", "availability": "image_tools"},
        {"id": "architecture-multiangle", "name": "建筑环绕视角", "description": "保持结构生成指定观察机位", "action": "compose", "mode": "multiangle", "availability": "image_tools", "prompt": "保持建筑体块、门窗、楼层、材质、尺度、场地和光照连续，只按指定偏移角度移动相机；禁止改变结构或凭空增加构件。"},
        {"id": "architecture-upscale", "name": "效果图超分", "description": "增强材质、边缘与小尺度细节", "action": "compose", "mode": "upscale", "availability": "upscaler"}
    ]},
    {"id": "portrait", "name": "人像摄影", "icon": "◎", "items": [
        {"id": "portrait-retouch", "name": "自然精修", "description": "保留身份的克制人像修饰", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "自然精修人像，严格保留身份、五官比例、年龄特征和皮肤真实纹理。"},
        {"id": "id-photo", "name": "证件照", "description": "规范背景、服装与光线", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "制作规范证件照，保持人物身份和五官比例，正面姿态，均匀布光，干净背景。"},
        {"id": "portrait-light", "name": "人像布光", "description": "只改变光线与影调", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保持人物、姿态、服装和背景内容不变，只调整为自然专业的人像摄影布光。"},
        {"id": "makeup", "name": "妆容调整", "description": "自然妆造与色彩统一", "action": "compose", "mode": "redraw", "availability": "image_tools"},
        {"id": "portrait-style", "name": "写真风格", "description": "胶片、棚拍、纪实等风格", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保持人物身份、姿态和场景关系，将画面转换为指定写真摄影风格。"},
        {"id": "portrait-multiangle", "name": "人像多角度", "description": "锁定身份调整摄影机位", "action": "compose", "mode": "multiangle", "availability": "image_tools", "prompt": "严格锁定人物身份、五官、年龄、发型、服装、姿态、身体比例和背景关系，只按指定偏移角度移动相机，不改变人物动作。"},
        {"id": "face-swap", "name": "AI 换脸", "description": "高风险身份编辑", "action": "unavailable", "availability": "route_pending", "requires": "具备实名授权/肖像核验的换脸 API 与内容安全审核"}
    ]},
    {"id": "game-anime", "name": "游戏动漫", "icon": "◈", "items": [
        {"id": "anime-convert", "name": "图片转动漫", "description": "保留主体转二次元视觉", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保持主体身份、轮廓、姿态和构图，转换为完成度高的动画电影美术风格。"},
        {"id": "character-sheet", "name": "角色设定稿", "description": "正侧背与细节设计", "badges": ["结构化模板", "三视图"], "action": "model", "model": "bailian_wan_2_7", "availability": "image_generation", "input_hint": "例如：17 岁的荒野信使，红色短发，旧皮质飞行夹克，左臂机械义肢，轻便背包，日系科幻游戏美术。", "input_help": "写清角色身份、年龄感、体型、发型、服装、配饰和美术风格；系统会自动生成正面、侧面、背面的一致设定稿。", "prompt": "专业角色设定稿：恰好三个全身标准视图，依次为正面、左侧面、背面；三视图等高等距，不重复角度。角色身份、脸型、体型、服装和配饰完全一致，纯白背景，无文字、边框和额外人物。"},
        {"id": "character-views", "name": "角色多视角", "description": "保持角色一致生成标准视图", "action": "compose", "mode": "multiview", "availability": "image_tools"},
        {"id": "game-scene", "name": "游戏场景概念", "description": "环境叙事与关卡氛围", "badges": ["结构化模板", "关卡构图"], "action": "model", "model": "bailian_qwen_3", "availability": "image_generation", "input_hint": "例如：废弃海底观测站的中央大厅，潮汐涌入，远处发光珊瑚照亮逃生通道，写实科幻游戏概念图。", "input_help": "写清地点、时间/天气、叙事事件、主视觉焦点和美术风格；系统会补足前中后景、动线和可信尺度。", "prompt": "高完成度游戏场景概念设计：单一明确叙事焦点，前中后景层级和可行走动线清楚，建筑尺度可信，材质统一，电影感光影；画面中不出现界面、文字、水印或拼贴边框。"},
        {"id": "item-design", "name": "道具设计", "description": "武器、装备与材质拆解", "badges": ["结构化模板", "细节视图"], "action": "model", "model": "bailian_qwen_3", "availability": "image_generation", "input_hint": "例如：可折叠蒸汽朋克侦察无人机，铜与深绿色涂装，黄铜铰链，侦察镜头和可替换能量芯。", "input_help": "写清道具用途、轮廓、关键部件、材质、配色和时代风格；系统会自动组织主视图和不重复细节图。", "prompt": "专业游戏道具设计板：左侧一个完整主视图，右侧三个不重复的结构或材质细节视图；所有视图属于同一道具，比例、部件数量、材质和设计语言一致，纯白背景，无文字与水印。"},
        {"id": "multiangle-character", "name": "角色环绕机位", "description": "锁定角色设定调整观察角度", "action": "compose", "mode": "multiangle", "availability": "image_tools", "prompt": "锁定角色身份、脸型、发型、服装、配饰、体型、姿态和场景设定，只按指定偏移角度移动相机。"}
    ]},
    {"id": "creative", "name": "创意应用", "icon": "⌁", "items": [
        {"id": "outpaint", "name": "AI 扩图", "description": "补足画面外空间", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "向画面外自然延展环境，保持透视、地平线、光线、材质和叙事连续。"},
        {"id": "style-transfer", "name": "风格迁移", "description": "保持结构替换媒介风格", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保持主体、构图和空间关系，只转换为指定艺术风格，视觉语言统一。"},
        {"id": "image-fusion", "name": "图片融合", "description": "多图主体和场景融合", "action": "model", "model": "bailian_qwen_3_pro", "availability": "bailian", "prompt": "融合上传的多张参考图：保持每个核心主体的身份、造型与材质，以统一透视、光线和色彩将它们自然组织在同一画面中，不要出现生硬拼贴边缘。"},
        {"id": "creative-text", "name": "创意文字", "description": "材质字、标题字与海报文字", "action": "model", "model": "bailian_qwen_3_pro", "availability": "bailian", "prompt": "创作一张文字准确、层级清楚的中文创意字体海报，排版克制，无多余乱码。"},
        {"id": "qr-art", "name": "AI 二维码", "description": "可扫描的艺术二维码", "action": "unavailable", "availability": "route_pending", "requires": "QR Code 生成器 + ControlNet QR Monster/二维码美化模型 API"},
        {"id": "portrait-studio", "name": "AI 写真馆", "description": "人像参考驱动写真", "action": "compose", "mode": "edit", "availability": "image_tools", "prompt": "保持人物身份和五官比例，生成指定主题的专业写真，姿态自然，皮肤纹理真实。"},
        {"id": "storyboard-images", "name": "故事连环画", "description": "连续人物与场景组图", "action": "model", "model": "bailian_wan_2_7", "availability": "bailian", "prompt": "生成一组叙事连贯的故事画面，角色、服装、场景方向和色彩语言保持一致。"},
        {"id": "batch-illustration", "name": "批量配图", "description": "一次生成多张主题配图", "action": "model", "model": "bailian_wan_2_7", "availability": "bailian", "prompt": "围绕同一主题生成一组视觉统一、内容互补的配图，保持色彩和艺术风格一致。"}
    ]},
    {"id": "video-models", "name": "视频模型", "icon": "▷", "items": [
        {"id": "seedance-video-2", "name": "Seedance 2.0", "description": "多模态文生、图生与参考视频生成", "badges": ["最多 9 张参考", "4–15 秒", "多模态"], "action": "video_mode", "mode": "video_text", "model": "seedance_2_0", "availability": "seedance_video"},
        {"id": "seedance-video-2-mini", "name": "Seedance 2.0 Mini", "description": "适合高频预览与轻量视频创作", "badges": ["最多 9 张参考", "4–15 秒", "轻量"], "action": "video_mode", "mode": "video_text", "model": "seedance_2_0_mini", "availability": "seedance_video"},
        {"id": "seedance-video-2-fast", "name": "Seedance 2.0 Fast", "description": "更快完成多模态视频生成", "badges": ["最多 9 张参考", "4–15 秒", "快速"], "action": "video_mode", "mode": "video_text", "model": "seedance_2_0_fast", "availability": "seedance_video"},
        {"id": "h3-max-text-video", "name": "MiniMax H3 Max 文生视频", "description": "fal.ai 高速有声视频，支持 480P/768P 与 5–15 秒", "badges": ["fal.ai", "内置音频", "5–15 秒"], "action": "video_mode", "mode": "video_text", "model": "minimax_h3_max", "availability": "fal_video"},
        {"id": "h3-max-image-video", "name": "MiniMax H3 Max 图生视频", "description": "用首帧图片生成连贯有声视频，输出比例跟随原图", "badges": ["fal.ai", "首帧驱动", "768P"], "action": "video_mode", "mode": "video_image", "model": "minimax_h3_max", "availability": "fal_video"},
        {"id": "seedance-video", "name": "Seedance 2.5", "description": "文本、首帧与参考图生成，最长 30 秒", "badges": ["最多 30 张参考", "0–30 秒", "接入点"], "action": "video_mode", "mode": "video_text", "model": "seedance_2_5", "availability": "seedance_video"},
        {"id": "wan-video", "name": "Wan 2.7 文生视频", "description": "文字直接生成有声视频", "badges": ["百炼 API", "2–15 秒", "异步"], "action": "video_mode", "mode": "video_text", "model": "wan2.7-t2v-2026-06-12", "availability": "bailian_video"},
        {"id": "wan3-video", "name": "Wan 3.0 视频", "description": "统一完成文生、首帧、首尾帧与多模态参考视频", "badges": ["全能参考", "2–30 秒", "30 FPS"], "action": "video_mode", "mode": "video_text", "model": "wan3.0-video", "availability": "bailian_video"},
        {"id": "wan3-video-prime", "name": "Wan 3.0 视频 Prime", "description": "Wan 3.0 的优速版，能力与标准版对齐", "badges": ["全能参考", "优速", "2–30 秒"], "action": "video_mode", "mode": "video_text", "model": "wan3.0-video-prime", "availability": "bailian_video"},
        {"id": "wan-image-video", "name": "Wan 2.7 图生视频", "description": "首帧或首尾帧驱动视频", "badges": ["百炼 API", "720P/1080P", "2–15 秒"], "action": "video_mode", "mode": "video_image", "model": "wan2.7-i2v-2026-04-25", "availability": "bailian_video"},
        {"id": "wan-reference-video", "name": "Wan 2.7 参考生视频", "description": "最多五张图片保持主体与风格", "badges": ["百炼 API", "多参考", "2–15 秒"], "action": "video_mode", "mode": "video_reference", "model": "wan2.7-r2v-2026-06-12", "availability": "bailian_video"},
        {"id": "video-edit-model", "name": "通用视频编辑", "description": "自然语言修改视频内容、风格与镜头", "badges": ["Wan 2.7", "有声保留", "2–10 秒"], "action": "video_mode", "mode": "video_edit", "model": "wan2.7-videoedit", "availability": "bailian_video"}
    ]},
    {"id": "ai-video", "name": "AI 生视频", "icon": "▶", "items": [
        {"id": "unified-video", "name": "AI 生视频", "description": "描述镜头；上传一张图就让它动起来", "badges": ["Wan 3.0", "文生/图生", "2–30 秒"], "action": "video_mode", "mode": "unified_video", "model": "wan3.0-video", "availability": "bailian_video"},
        {"id": "first-last-video", "name": "首尾帧生视频", "description": "上传两张图控制开始与结束画面", "badges": ["Wan 2.7", "首尾帧", "2–15 秒"], "action": "video_mode", "mode": "video_first_last", "model": "wan2.7-i2v-2026-04-25", "availability": "bailian_video"},
        {"id": "reference-video", "name": "视频参考生视频", "description": "最多五张参考图保持人物、道具与风格", "badges": ["Wan 2.7", "多参考", "2–15 秒"], "action": "video_mode", "mode": "video_reference", "model": "wan2.7-r2v-2026-06-12", "availability": "bailian_video"},
        {"id": "digital-human", "name": "数字人播报", "description": "一张人物图片与一段音频驱动口播", "badges": ["Wan S2V", "图片+音频", "异步"], "action": "video_mode", "mode": "video_digital_human", "model": "wan2.2-s2v", "availability": "bailian_video"}
    ]},
    {"id": "video-tools", "name": "视频工具", "icon": "▰", "items": [
        {"id": "video-editor", "name": "AI 视频编辑", "description": "自然语言重绘、替换、增删视频内容", "badges": ["Wan 2.7 VideoEdit", "有声保留"], "action": "video_mode", "mode": "video_edit", "model": "wan2.7-videoedit", "availability": "bailian_video"},
        {"id": "video-depth", "name": "转深度图", "description": "生成时间连续的单目视频深度图", "badges": ["Video Depth Anything", "异步", "Small FP16"], "action": "workflow_node", "node_type": "video_tool", "node_config": {"tool": "video_depth"}, "availability": "video_depth"},
        {"id": "video-extension", "name": "视频延展", "description": "延展首尾内容并保持运动连续", "badges": ["VACE", "固定 5 秒"], "action": "video_mode", "mode": "video_extension", "model": "wanx2.1-vace-plus", "availability": "bailian_video"},
        {"id": "video-style", "name": "视频风格化", "description": "八种漫画、卡通和水墨风格", "badges": ["8 种风格", "540P/720P"], "action": "video_mode", "mode": "video_style", "model": "video-style-transform", "availability": "bailian_video"},
        {"id": "lip-sync", "name": "口型同步", "description": "人物视频按音频重建准确口型", "badges": ["VideoRetalk", "视频+音频"], "action": "video_mode", "mode": "video_lip_sync", "model": "videoretalk", "availability": "bailian_video"},
        {"id": "character-swap-video", "name": "视频角色替换", "description": "保持动作、场景与光照替换角色", "badges": ["Wan Animate", "需肖像授权"], "action": "video_mode", "mode": "video_character_swap", "model": "wan2.2-animate-mix", "availability": "bailian_video"}
    ]},
    {"id": "short-drama", "name": "短剧工坊", "icon": "▤", "items": [
        {"id": "short-drama-agent", "name": "短剧编辑 Agent", "description": "对话拆解分镜并调用站内图像、视频和配音工具", "badges": ["火山方舟", "函数调用", "可审计"], "action": "info", "info_view": "short-drama-agent", "availability": "ark_agent"},
        {"id": "script-to-board", "name": "剧本转分镜", "description": "由短剧 Agent 拆解场次、角色与镜头", "action": "info", "info_view": "short-drama-agent", "availability": "ark_agent"},
        {"id": "viral-remake", "name": "爆款复刻", "description": "解析视频结构并生成重制方案", "action": "unavailable", "availability": "route_pending", "requires": "视频下载/ASR、视觉理解、LLM 分析与视频生成 API 组合"},
        {"id": "storyboard-render", "name": "分镜出图", "description": "角色一致的连续分镜图", "action": "model", "model": "bailian_wan_2_7", "availability": "bailian", "prompt": "生成连续短剧分镜组图，角色、服装、场景轴线和光色保持一致，每格镜头意图明确。"},
        {"id": "storyboard-video", "name": "分镜成片", "description": "逐镜生成并自动拼接", "action": "unavailable", "availability": "video_route_pending", "requires": "Seedance/Wan 视频 API + 服务端转码与任务编排"}
    ]},
    {"id": "sound", "name": "配声工坊", "icon": "◖", "items": [
        {"id": "unified-dubbing", "name": "AI 配音", "description": "输入文案；上传一段声音就沿用它的音色", "badges": ["豆包语音 2.0", "Qwen3-TTS", "文生/参考生"], "action": "audio_mode", "mode": "unified_audio", "model": "doubao-tts-2.0", "availability": "speech_tts"},
        {"id": "custom-voice", "name": "定制音色", "description": "用文字描述设计音色，也可选传已授权参考音频", "badges": ["文字定制", "参考音频选填", "可存资产"], "action": "audio_mode", "mode": "audio_custom_voice", "model": "qwen3-tts-instruct-flash", "availability": "bailian_audio", "requires": "参考音频选填；上传时仅可使用本人声音或已获得权利人明确授权的样本"},
        {"id": "image-dubbing", "name": "图片配音", "description": "看图生成旁白与配音", "badges": ["图片理解", "自动旁白", "语音合成"], "action": "audio_mode", "mode": "audio_image", "model": "doubao-tts-2.0", "availability": "image_dubbing", "requires": "视觉理解与语音合成服务"},
        {"id": "video-dubbing", "name": "视频配音", "description": "理解视频并生成旁白", "action": "unavailable", "availability": "route_pending", "requires": "视频理解 API + ASR + LLM + TTS"}
    ]},
    {"id": "workspace", "name": "工作流与资产", "icon": "⌘", "items": [
        {"id": "workflow-canvas", "name": "工作流幕布", "description": "无界节点编排与分享", "action": "workspace", "availability": "workflow"},
        {"id": "personal-assets", "name": "资产库", "description": "命名、分类并复用个人资产", "action": "assets", "availability": "browser"},
        {"id": "generation-history", "name": "生成记录", "description": "查看本机自动保存的生成历史", "action": "history", "availability": "browser"},
        {"id": "api-platform", "name": "API 状态与文档", "description": "查看能力状态与真实接口目录", "action": "info", "info_view": "api", "availability": "browser"},
        {"id": "tutorials", "name": "教程中心", "description": "方法论、提示词与工作流指南", "action": "info", "info_view": "tutorials", "availability": "browser"},
        {"id": "changelog", "name": "更新日志", "description": "版本与能力变化记录", "action": "info", "info_view": "changelog", "availability": "browser"}
    ]}
]

def capability_item(capability_id: str | None) -> dict[str, Any] | None:
    """Resolve a server-owned capability without exposing its prompt to clients."""
    if not capability_id:
        return None
    return next(
        (
            item
            for group in CAPABILITY_GROUPS
            for item in group.get("items", [])
            if item.get("id") == capability_id
        ),
        None,
    )

def generation_prompt_for(payload: dict[str, Any]) -> str:
    """Assemble provider-aware text-to-image prompts at execution time.

    Seedream follows Volcengine's connected natural-language pattern; Bailian
    follows Model Studio's subject/scene/style/camera/atmosphere/detail order.
    The capability instruction stays server-side and the user's text remains
    the only editable prompt shown in the browser.
    """
    user_prompt = str(payload.get("prompt") or "").strip()
    selected = capability_item(payload.get("capability_id"))
    capability_prompt = str(selected.get("prompt") or "").strip() if selected else ""
    style_hint = STYLE_HINTS.get(str(payload.get("style") or "natural"), STYLE_HINTS["natural"])
    provider = str(MODELS.get(str(payload.get("model") or ""), {}).get("provider") or "local")
    if provider == "openai_compatible":
        parts = [
            f"创作一张图像：{user_prompt}",
            f"能力目标：{capability_prompt}" if capability_prompt else "",
            f"视觉风格、色彩与光影：{style_hint}",
            "使用连贯自然语言理解主体、动作、环境、构图和用途；严格保留用户明确提出的数量、位置、文字与限制条件。",
        ]
    elif provider == "bailian":
        parts = [
            f"主体与主体特征：{user_prompt}",
            f"任务目标：{capability_prompt}" if capability_prompt else "",
            f"场景、风格与氛围：{style_hint}",
            "镜头语言与细节：构图层级清楚，主体关系准确，材质、光影和空间透视可信；严格执行用户明确的文字、数量、位置和禁止项。",
        ]
    else:
        parts = [user_prompt, capability_prompt, f"视觉风格：{style_hint}"]
    return "\n".join(part for part in parts if part)

def tool_prompt_for(payload: dict[str, Any], preset_prompt: str) -> str:
    """Assemble reference-image instructions using official image numbering."""
    operation = str(payload.get("operation") or "edit")
    selected = capability_item(payload.get("capability_id"))
    capability_prompt = str(selected.get("prompt") or "").strip() if selected else ""
    user_prompt = str(payload.get("prompt") or "").strip()
    operation_rules = {
        "edit": "以图1为待编辑原图。只执行明确要求的修改，未提及的主体身份、构图、机位、背景和视觉属性保持不变。",
        "redraw": "以图1为待编辑原图，图2为 Alpha 蒙版。只修改图2白色或非透明区域，蒙版外像素内容保持不变，边缘自然衔接。",
        "multiview": f"以图1主体为唯一身份与结构参考，生成一套恰好 {int(payload.get('views') or 3)} 个视角的组图；各视图主体、比例、材质和细节一致。",
        "multiangle": "以图1主体为唯一身份与结构参考，只改变摄像机方位、俯仰和距离，不改变主体造型、动作、材质或场景内容。",
        "panorama": "以图1为中心锚点，生成真正可环视一周的 360° 全景。输出必须是严格 2:1 的等距柱状投影，水平视场 360°、垂直视场 180°，地平线位于画面中线；补足前后左右、头顶与地面空间，保持透视、光源、材质和尺度连续，最左与最右边缘必须像同一位置一样无缝衔接。禁止输出普通宽幅图、鱼眼图、立方体贴图、分镜拼贴、重复主体、黑边或画框。",
        "upscale": "以图1为唯一原图，只增强清晰度、边缘和真实纹理，不改变文字、身份、构图、颜色或内容。",
        "cutout": "以图1为唯一原图，准确保留前景主体并移除背景，输出带自然半透明边缘的 PNG Alpha 通道。",
        "interactive": "按点选或框选坐标精准编辑对应对象或区域；未被标注、未被用户明确提及的内容保持不变。",
        "layers": "将图1拆分为可独立复用的视觉图层，返回完整底图以及透明背景的主体、文字、装饰和背景图层。",
    }
    parts = [operation_rules.get(operation, operation_rules["edit"]), capability_prompt, preset_prompt, user_prompt]
    if operation == "multiangle" and isinstance(payload.get("camera"), dict):
        camera = payload["camera"]
        azimuth = max(-180.0, min(180.0, float(camera.get("azimuth", 0))))
        elevation = max(-30.0, min(75.0, float(camera.get("elevation", 0))))
        distance = max(2.0, min(12.0, float(camera.get("distance", 5))))
        offset_cosine = math.cos(math.radians(azimuth)) * math.cos(math.radians(elevation))
        offset_angle = math.degrees(math.acos(max(-1.0, min(1.0, offset_cosine))))
        horizontal_direction = "向右" if azimuth > 0 else "向左" if azimuth < 0 else "水平不偏移"
        vertical_direction = "向上" if elevation > 0 else "向下" if elevation < 0 else "垂直不偏移"
        parts.append(
            "相机参数：水平角 {:+.0f}°，俯仰角 {:+.0f}°，距离 {:.1f}；相对输入图当前基准机位的合成偏移角为 {:.0f}°（{}、{}）。严格按偏移角移动摄像机，不要通过旋转、变形或重绘主体来伪造机位变化。".format(
                azimuth, elevation, distance, offset_angle, horizontal_direction, vertical_direction,
            )
        )
    if operation == "interactive":
        for annotation in payload.get("annotations") or []:
            coords = [max(0, min(999, int(value))) for value in annotation.get("coordinates", [])]
            image_index = int(annotation.get("image_index") or 1)
            if annotation.get("kind") == "point" and len(coords) == 2:
                parts.append(f"图 {image_index} <point>{coords[0]} {coords[1]}</point> 是需要编辑的目标位置。")
            elif annotation.get("kind") == "bbox" and len(coords) == 4:
                x1, y1, x2, y2 = coords
                parts.append(f"图 {image_index} <bbox>{min(x1,x2)} {min(y1,y2)} {max(x1,x2)} {max(y1,y2)}</bbox> 是需要编辑的目标区域。")
    provider = str(MODELS.get(str(payload.get("model") or ""), {}).get("provider") or "local")
    if provider == "openai_compatible":
        parts.append("用连贯自然语言理解编辑目标、参考图关系、需要保留的内容和输出用途。")
    elif provider == "bailian":
        parts.append("严格按图1/图2的引用关系执行；修改目标、保留项、镜头、氛围与细节分别落实，不添加未要求的元素。")
    return "\n".join(part for part in parts if part)
