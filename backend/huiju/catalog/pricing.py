"""Single source of truth for plans, provider costs and Credits quotes.

All public prices are integer Credits.  The safety floor guarantees at least
``MIN_UNIT_MARGIN_CNY`` over the official/list provider price at the nominal
Credit value.  Provider promotions are deliberately ignored so a temporary
discount ending cannot turn a route loss-making.
"""
from __future__ import annotations

import math
import re
from typing import Any


CREDIT_VALUE_CNY = 0.07
MIN_UNIT_MARGIN_CNY = 0.09
USD_CNY_RATE = 7.20

# Only current flagship releases require membership. All other paid routes can
# consume the daily grant before any monthly or top-up credits.
MEMBER_EXCLUSIVE_MODELS = frozenset({
    "bailian_qwen_3_pro",
    "bailian_wan_2_7_pro",
    "google_nano_banana_pro",
    "google_nano_banana_2",
    "seedream_5_0_pro",
    "wan3.0-video-prime",
})


def member_exclusive(model: str) -> bool:
    return model in MEMBER_EXCLUSIVE_MODELS

MEMBERSHIP_PLANS: tuple[dict[str, Any], ...] = (
    {"id": "basic", "name": "基础会员", "first_month_cny": 19, "renewal_cny": 29, "credits": 400, "audience": "学生、轻度创作"},
    {"id": "standard", "name": "标准会员", "first_month_cny": 45, "renewal_cny": 59, "credits": 900, "audience": "日常创作", "recommended": True},
    {"id": "high_frequency", "name": "高频创作会员", "first_month_cny": 99, "renewal_cny": 119, "credits": 2100, "audience": "高频个人、小工作室"},
)

TOPUP_PACKS: tuple[dict[str, Any], ...] = (
    {"price_cny": 5, "credits": 50},
    {"price_cny": 19.9, "credits": 210},
    {"price_cny": 49, "credits": 540},
    {"price_cny": 99, "credits": 1100},
    {"price_cny": 199, "credits": 2250},
)


def _rule(public: int, member: int, provider_cny: float, source: str) -> dict[str, Any]:
    floor = max(1, math.ceil((provider_cny + MIN_UNIT_MARGIN_CNY - 1e-9) / CREDIT_VALUE_CNY))
    return {
        "public": max(public, floor),
        "member": max(member, floor),
        "provider_cost_cny": round(provider_cny, 6),
        "source": source,
    }


def _free_rule(provider_cny: float, source: str) -> dict[str, Any]:
    """Describe a deliberately subsidized model without applying the price floor."""
    return {
        "public": 0,
        "member": 0,
        "provider_cost_cny": round(provider_cny, 6),
        "source": source,
    }


# Per image.  Resolution-specific overrides are applied by image_quote().
IMAGE_RULES: dict[str, dict[str, Any]] = {
    "server_ultrasharp": _rule(2, 2, 0.00, "服务器本地 4x-UltraSharp 轻量超分"),
    "server_u2netp": _rule(1, 1, 0.00, "服务器本地 U2NetP Alpha 抠图"),
    "qwen_image": _free_rule(0.18, "站内免费模型 · 每分钟最多 10 次"),
    "zimage_turbo": _rule(3, 2, 0.00, "站内本地成本基准"),
    "zimage": _rule(4, 3, 0.00, "站内本地成本基准"),
    "flux": _rule(8, 6, 0.00, "站内本地成本基准"),
    "flux2": _rule(10, 8, 0.00, "站内本地成本基准"),
    "qwen_image_edit": _rule(5, 4, 0.18, "站内本地成本基准"),
    "gpt_image": _rule(3, 2, 0.006 * USD_CNY_RATE, "fal.ai GPT Image 2 官方 Low 质量价"),
    "seedream_4_0": _rule(6, 5, 0.20, "火山方舟官方刊例价"),
    "seedream_4_5": _rule(7, 5, 0.25, "火山方舟官方刊例价"),
    "seedream_5_0": _rule(6, 5, 0.22, "火山方舟官方刊例价"),
    "seedream_5_0_pro": _rule(8, 6, 0.30, "火山方舟官方刊例价"),
    "bailian_qwen_3": _rule(5, 4, 0.18, "阿里云百炼官方刊例价"),
    "bailian_qwen_3_pro": _rule(7, 6, 0.25, "阿里云百炼官方刊例价"),
    "bailian_wan_2_7": _rule(6, 5, 0.20, "阿里云百炼官方刊例价"),
    "bailian_wan_2_7_pro": _rule(8, 6, 0.50, "阿里云百炼官方刊例价"),
    "google_nano_banana": _rule(7, 6, 0.039 * USD_CNY_RATE, "Google 官方美元价折算"),
    "google_nano_banana_pro": _rule(18, 16, 0.134 * USD_CNY_RATE, "Google 官方美元价折算"),
    "google_nano_banana_2": _rule(11, 9, 0.067 * USD_CNY_RATE, "Google 官方美元价折算"),
    "google_nano_banana_2_lite": _rule(6, 5, 0.0336 * USD_CNY_RATE, "Google 官方美元价折算"),
}


# Per second.  Seedance values start from the supplied rate card.  The single
# 1-Credit member cell is lifted to 2 because 1 * 0.07 cannot contain 0.09
# profit even with a zero provider cost.
VIDEO_RULES: dict[str, dict[str, dict[str, Any]]] = {
    "minimax_h3_max": {
        "480P:no_video": _rule(9, 7, 0.05 * USD_CNY_RATE, "fal.ai H3 Max 官方常规价 $0.05/秒"),
        "768P:no_video": _rule(12, 10, 0.08 * USD_CNY_RATE, "fal.ai H3 Max 官方常规价 $0.08/秒"),
    },
    "seedance_2_5": {
        "1080P:video": _rule(39, 28, 1.86, "用户提供的 Seedance 2.5 刊例折算"),
        "1080P:no_video": _rule(66, 47, 3.20, "用户提供的 Seedance 2.5 刊例折算"),
        "720P:video": _rule(28, 20, 1.30, "Seedance 2.5 1080P 刊例保守折算"),
        "720P:no_video": _rule(47, 34, 2.24, "Seedance 2.5 1080P 刊例保守折算"),
    },
    "seedance_2_0_fast": {
        "480P:video": _rule(4, 3, 0.10, "用户提供的 Seedance 2.0 Fast 刊例"),
        "480P:no_video": _rule(7, 5, 0.24, "用户提供的 Seedance 2.0 Fast 刊例"),
        "720P:video": _rule(9, 7, 0.36, "用户提供的 Seedance 2.0 Fast 刊例"),
        "720P:no_video": _rule(14, 11, 0.65, "用户提供的 Seedance 2.0 Fast 刊例"),
        "1080P:video": _rule(16, 12, 0.72, "720P 刊例保守外推"),
        "1080P:no_video": _rule(25, 19, 1.20, "720P 刊例保守外推"),
    },
    "seedance_2_0_mini": {
        "480P:video": _rule(3, 1, 0.00, "用户提供的 Seedance 2.0 Mini 刊例；已应用利润底线"),
        "480P:no_video": _rule(4, 2, 0.04, "用户提供的 Seedance 2.0 Mini 刊例"),
        "720P:video": _rule(6, 3, 0.12, "用户提供的 Seedance 2.0 Mini 刊例"),
        "720P:no_video": _rule(9, 4, 0.18, "用户提供的 Seedance 2.0 Mini 刊例"),
        "1080P:video": _rule(11, 6, 0.30, "720P 刊例保守外推"),
        "1080P:no_video": _rule(16, 8, 0.45, "720P 刊例保守外推"),
    },
    "seedance_2_0": {
        "480P:video": _rule(6, 4, 0.16, "火山方舟官方刊例折算"),
        "480P:no_video": _rule(10, 7, 0.36, "火山方舟官方刊例折算"),
        "720P:video": _rule(12, 9, 0.50, "火山方舟官方刊例折算"),
        "720P:no_video": _rule(19, 14, 0.84, "火山方舟官方刊例折算"),
        "1080P:video": _rule(22, 17, 1.10, "火山方舟官方刊例折算"),
        "1080P:no_video": _rule(34, 26, 1.70, "火山方舟官方刊例折算"),
    },
    "wan2.7-t2v-2026-06-12": {
        "720P:no_video": _rule(12, 10, 0.60, "阿里云百炼 Wan 2.7 官方价"),
        "1080P:no_video": _rule(19, 16, 1.00, "阿里云百炼 Wan 2.7 官方价"),
    },
    "wan2.7-i2v-2026-04-25": {
        "720P:no_video": _rule(12, 10, 0.60, "阿里云百炼 Wan 2.7 官方价"),
        "1080P:no_video": _rule(19, 16, 1.00, "阿里云百炼 Wan 2.7 官方价"),
    },
    "wan2.7-r2v-2026-06-12": {
        "720P:no_video": _rule(12, 10, 0.60, "阿里云百炼 Wan 2.7 官方价"),
        "1080P:no_video": _rule(19, 16, 1.00, "阿里云百炼 Wan 2.7 官方价"),
    },
    "wan3.0-video": {
        "480P:no_video": _rule(6, 6, 0.30, "阿里云百炼 Wan 3.0 官方价"),
        "720P:no_video": _rule(10, 10, 0.60, "阿里云百炼 Wan 3.0 官方价"),
        "1080P:no_video": _rule(19, 19, 1.20, "阿里云百炼 Wan 3.0 官方价"),
        "480P:video": _rule(6, 6, 0.30, "阿里云百炼 Wan 3.0 输入/输出同价"),
        "720P:video": _rule(10, 10, 0.60, "阿里云百炼 Wan 3.0 输入/输出同价"),
        "1080P:video": _rule(19, 19, 1.20, "阿里云百炼 Wan 3.0 输入/输出同价"),
    },
    "wan3.0-video-prime": {
        "480P:no_video": _rule(8, 8, 0.45, "阿里云百炼 Wan 3.0 Prime 官方价"),
        "720P:no_video": _rule(15, 15, 0.90, "阿里云百炼 Wan 3.0 Prime 官方价"),
        "1080P:no_video": _rule(27, 27, 1.80, "阿里云百炼 Wan 3.0 Prime 官方价"),
        "480P:video": _rule(8, 8, 0.45, "阿里云百炼 Wan 3.0 Prime 输入/输出同价"),
        "720P:video": _rule(15, 15, 0.90, "阿里云百炼 Wan 3.0 Prime 输入/输出同价"),
        "1080P:video": _rule(27, 27, 1.80, "阿里云百炼 Wan 3.0 Prime 输入/输出同价"),
    },
    "wan2.7-videoedit": {
        "720P:video": _rule(12, 10, 0.60, "阿里云百炼 Wan 2.7 视频编辑官方价"),
        "1080P:video": _rule(19, 16, 1.00, "阿里云百炼 Wan 2.7 视频编辑官方价"),
    },
    "wanx2.1-vace-plus": {"720P:video": _rule(15, 12, 0.70, "阿里云百炼 VACE 官方价")},
    "video-style-transform": {
        "480P:video": _rule(7, 5, 0.20, "阿里云百炼视频风格化官方价"),
        "720P:video": _rule(12, 9, 0.50, "阿里云百炼视频风格化官方价"),
    },
    "videoretalk": {
        "480P:video": _rule(4, 3, 0.08, "阿里云百炼 VideoRetalk 官方价"),
        "720P:video": _rule(4, 3, 0.08, "阿里云百炼 VideoRetalk 官方价"),
    },
    "wan2.2-animate-mix": {
        "480P:video": _rule(10, 8, 0.45, "阿里云百炼角色替换刊例"),
        "720P:video": _rule(15, 12, 0.70, "阿里云百炼角色替换刊例"),
    },
    "wan2.2-s2v": {
        "480P:video": _rule(10, 8, 0.50, "阿里云百炼 Wan S2V 官方价"),
        "720P:video": _rule(16, 15, 0.90, "阿里云百炼 Wan S2V 官方价"),
    },
    "video-depth-anything-small": {
        "480P:video": _rule(3, 2, 0.00, "站内 GPU 成本基准"),
        "720P:video": _rule(4, 3, 0.00, "站内 GPU 成本基准"),
        "1080P:video": _rule(6, 4, 0.00, "站内 GPU 成本基准"),
    },
}


AUDIO_RULES: dict[str, dict[str, Any]] = {
    "qwen3-tts-flash": _rule(3, 2, 0.00032, "阿里云百炼 Qwen3-TTS 官方字符价折算"),
    "qwen3-tts-instruct-flash": _rule(3, 2, 0.00032, "阿里云百炼 Qwen3-TTS 官方字符价折算"),
    "qwen-audio-3.0-tts-flash": _rule(3, 2, 0.00040, "阿里云百炼 Qwen-Audio TTS 官方字符价折算"),
    "qwen-audio-3.0-tts-plus": _rule(3, 2, 0.00056, "阿里云百炼 Qwen-Audio TTS 官方字符价折算"),
    "doubao-tts-2.0": _rule(3, 2, 0.00200, "火山引擎豆包语音官方字符价折算"),
}


def membership_active(wallet: dict[str, Any]) -> bool:
    return str(wallet.get("membership_tier") or "free") != "free"


def _tier(rule: dict[str, Any], member: bool) -> int:
    return int(rule["member" if member else "public"])


GPT_IMAGE_2_TEXT_USD: dict[str, dict[str, float]] = {
    "1K": {"standard": .006, "fine": .053, "ultra": .211},
    "2K": {"standard": .007, "fine": .056, "ultra": .222},
    "4K": {"standard": .012, "fine": .101, "ultra": .401},
}

GPT_IMAGE_2_EDIT_USD: dict[str, dict[str, float]] = {
    "1K": {"standard": .018, "fine": .061, "ultra": .219},
    "2K": {"standard": .019, "fine": .068, "ultra": .234},
    "4K": {"standard": .024, "fine": .113, "ultra": .413},
}


def _gpt_image_2_rule(resolution: str, quality: str, reference_count: int) -> dict[str, Any]:
    resolution_tier = "4K" if resolution == "4K" else "2K" if resolution == "2K" else "1K"
    rate_card = GPT_IMAGE_2_EDIT_USD if reference_count else GPT_IMAGE_2_TEXT_USD
    provider_usd = rate_card[resolution_tier][quality]
    if reference_count > 1:
        provider_usd += (reference_count - 1) * (.012 if resolution_tier == "4K" else .008)
    provider_cny = provider_usd * USD_CNY_RATE
    member_floor = max(1, math.ceil((provider_cny + MIN_UNIT_MARGIN_CNY - 1e-9) / CREDIT_VALUE_CNY))
    public_price = max(member_floor + 1, math.ceil(member_floor * 1.10))
    mode = "编辑" if reference_count else "文生图"
    provider_quality = {"standard": "Low", "fine": "Medium", "ultra": "High"}[quality]
    return _rule(
        public_price,
        member_floor,
        provider_cny,
        f"fal.ai GPT Image 2 官方{mode}价 · {resolution_tier} {provider_quality}",
    )


def image_quote(
    model: str,
    resolution: str,
    count: int = 1,
    member: bool = False,
    reference_count: int = 0,
    quality: str = "standard",
) -> dict[str, Any]:
    key = str(resolution or "1k").upper()
    rule = dict(IMAGE_RULES.get(model, _rule(8, 6, 0.30, "保守默认价")))
    if model == "gpt_image":
        rule = _gpt_image_2_rule(key, quality, max(0, int(reference_count)))
    elif model == "bailian_qwen_3_pro" and key in {"2K", "4K"}:
        rule = _rule(13, 10, 0.50, "阿里云百炼 Qwen Image Pro 2K 官方价")
    elif model in {"seedream_5_0_pro", "bailian_wan_2_7_pro"} and key in {"2K", "4K"}:
        rule = _rule(15, 12, 0.60, "官方高像素档保守价")
    elif model == "google_nano_banana_pro" and key == "4K":
        rule = _rule(29, 26, 0.24 * USD_CNY_RATE, "Google 官方美元价折算")
    elif model == "google_nano_banana_2":
        usd = {"480P": .045, "512": .045, "1K": .067, "2K": .101, "4K": .151}.get(key, .067)
        safe = _rule(8, 6, usd * USD_CNY_RATE, "Google 官方美元价折算")
        rule = safe
    unit = _tier(rule, member)
    reference_fee = max(0, int(reference_count)) if model in {"bailian_qwen_3_pro", "seedream_5_0_pro", "bailian_wan_2_7_pro"} else 0
    unit += reference_fee
    return _quote_payload("image", model, unit, max(1, int(count)), rule, member, "张")


def video_quote(
    model: str, resolution: str, duration: int, has_video_input: bool,
    member: bool = False, input_video_seconds: int = 0,
) -> dict[str, Any]:
    model_rules = VIDEO_RULES.get(model, {})
    resolution_key = str(resolution or "720P").upper()
    input_key = "video" if has_video_input else "no_video"
    rule = model_rules.get(f"{resolution_key}:{input_key}")
    if rule is None:
        rule = model_rules.get(f"{resolution_key}:no_video") or model_rules.get(f"{resolution_key}:video")
    if rule is None and model_rules:
        rule = next(iter(model_rules.values()))
    rule = dict(rule or _rule(12, 10, 0.60, "保守默认视频价"))
    unit = _tier(rule, member)
    output_seconds = max(1, int(duration))
    billed_seconds = output_seconds + (max(0, int(input_video_seconds)) if model.startswith("wan3.0-video") else 0)
    return _quote_payload("video", model, unit, billed_seconds, rule, member, "秒")


def estimate_audio_seconds(text: str) -> int:
    cjk = len(re.findall(r"[\u3400-\u9fff]", text))
    latin_words = len(re.findall(r"[A-Za-z0-9]+", text))
    punctuation = len(re.findall(r"[，。！？；：,.!?;:]", text))
    seconds = cjk / 4.0 + latin_words / 2.5 + punctuation * 0.12
    return max(1, math.ceil(seconds))


def audio_quote(model: str, text: str, member: bool = False) -> dict[str, Any]:
    rule = dict(AUDIO_RULES.get(model, _rule(3, 2, 0.003, "保守默认音频价")))
    seconds = estimate_audio_seconds(text)
    return _quote_payload("audio", model, _tier(rule, member), seconds, rule, member, "秒（预估）")


def _quote_payload(kind: str, model: str, unit: int, quantity: int, rule: dict[str, Any], member: bool, unit_label: str) -> dict[str, Any]:
    total = unit * quantity
    provider_total = float(rule.get("provider_cost_cny") or 0) * quantity
    revenue = total * CREDIT_VALUE_CNY
    return {
        "kind": kind,
        "model": model,
        "member": member,
        "unit_credits": unit,
        "quantity": quantity,
        "unit_label": unit_label,
        "total_credits": total,
        "nominal_revenue_cny": round(revenue, 4),
        "provider_cost_cny": round(provider_total, 4),
        "nominal_margin_cny": round(revenue - provider_total, 4),
        "pricing_source": rule.get("source", ""),
    }


def pricing_catalog(member: bool = False) -> dict[str, Any]:
    return {
        "credit_value_cny": CREDIT_VALUE_CNY,
        "minimum_unit_margin_cny": MIN_UNIT_MARGIN_CNY,
        "free": {
            "daily_credits": 10,
            "model": "qwen_image",
            "resolution": "all",
            "max_images_per_day": None,
            "unlimited_usage": True,
            "rate_limit_per_minute": 10,
        },
        "memberships": list(MEMBERSHIP_PLANS),
        "topups": list(TOPUP_PACKS),
        "image": {
            model: {
                **image_quote(model, "1k", member=member),
                "by_resolution": {
                    resolution: image_quote(model, resolution, member=member)["unit_credits"]
                    for resolution in ("480p", "720p", "1k", "2k", "4k")
                },
                "by_resolution_public": {
                    resolution: image_quote(model, resolution, member=False)["unit_credits"]
                    for resolution in ("480p", "720p", "1k", "2k", "4k")
                },
                "by_resolution_member": {
                    resolution: image_quote(model, resolution, member=True)["unit_credits"]
                    for resolution in ("480p", "720p", "1k", "2k", "4k")
                },
                "by_quality_resolution": {
                    quality: {
                        resolution: image_quote(model, resolution, member=member, quality=quality)["unit_credits"]
                        for resolution in ("480p", "720p", "1k", "2k", "4k")
                    }
                    for quality in ("standard", "fine", "ultra")
                },
            }
            for model in IMAGE_RULES
        },
        "video": {
            model: {
                key: {"public": int(rule["public"]), "member": int(rule["member"]), "unit": "Credits/秒"}
                for key, rule in rules.items()
            }
            for model, rules in VIDEO_RULES.items()
        },
        "audio": {model: {"public": int(rule["public"]), "member": int(rule["member"]), "unit": "Credits/预估秒"} for model, rule in AUDIO_RULES.items()},
    }
