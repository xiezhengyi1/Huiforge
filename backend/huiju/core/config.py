"""Environment parsing, filesystem paths, limits and provider credentials."""
from __future__ import annotations

import hashlib
import hmac
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[3]

load_dotenv(BASE_DIR / ".env", override=False)

APP_VERSION = "2.2.0"

RELEASE_ID = "20260908-member-access-v41"

VAR_DIR = Path(os.getenv("HUIJU_VAR_DIR", str(BASE_DIR / "var")))

VAR_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)

USER_DB_FILE = Path(os.getenv(
    "HUIJU_USER_DB_FILE",
    str(VAR_DIR / "users.sqlite3"),
))

EDGE_STATS_DB = Path(os.getenv(
    "HUIJU_EDGE_STATS_DB",
    str(VAR_DIR / "edge-stats.sqlite3"),
))

ANALYTICS_BACKUP_DIR = Path(os.getenv(
    "HUIJU_ANALYTICS_BACKUP_DIR",
    str(EDGE_STATS_DB.resolve(strict=False).parent / "analytics-backups"),
))

MEDIA_WORKER_ENABLED = os.getenv("HUIJU_MEDIA_WORKER_ENABLED", "1") == "1"

GPU_WARMUP_ENABLED = os.getenv("HUIJU_GPU_WARMUP_ENABLED", "1") == "1"

FRONTEND_DIR = BASE_DIR / "frontend"

FRONTEND_PAGE_DIR = FRONTEND_DIR / "pages"

FRONTEND_CSS_DIR = FRONTEND_DIR / "css"

FRONTEND_JS_DIR = FRONTEND_DIR / "js"

STATIC_DIR = FRONTEND_DIR / "static"

ICONS_DIR = STATIC_DIR / "icons"

FRONTEND_ASSET_PATHS = {
    "index.html": FRONTEND_PAGE_DIR / "index.html",
    "studio.html": FRONTEND_PAGE_DIR / "studio.html",
    "pricing.html": FRONTEND_PAGE_DIR / "pricing.html",
    "profile.html": FRONTEND_PAGE_DIR / "profile.html",
    **{
        f"css/{name}": FRONTEND_CSS_DIR / name
        for name in (
            "layout.css", "theme.css", "styles.css", "home.css", "home-surface.css",
            "studio.css", "onboarding.css", "pricing.css", "profile.css", "profile-overrides.css",
            "theme-variant-base.css", "theme-indigo.css", "theme-cinnabar.css",
            "theme-monochrome-blue.css", "theme-monochrome-accent.css", "theme-global.css",
            "theme-audit.css",
        )
    },
    **{
        f"js/{name}": FRONTEND_JS_DIR / name
        for name in (
            "app.js", "catalog.js", "onboarding.js", "onboarding-main.js",
            "onboarding-workflow.js", "pricing.js", "profile.js", "theme.js",
        )
    },
    "js/core/api-client.js": FRONTEND_JS_DIR / "core" / "api-client.js",
    "js/features/generation/mode-rules.js": FRONTEND_JS_DIR / "features" / "generation" / "mode-rules.js",
    "js/features/workflow/schema.js": FRONTEND_JS_DIR / "features" / "workflow" / "schema.js",
}

FRONTEND_ASSETS = frozenset(FRONTEND_ASSET_PATHS)

GENERATED_DIR = VAR_DIR / "generated"

GENERATED_DIR.mkdir(mode=0o700, exist_ok=True)

UPLOAD_DIR = VAR_DIR / "uploads"

UPLOAD_DIR.mkdir(mode=0o700, exist_ok=True)

FEEDBACK_DIR = Path(os.getenv("HUIJU_FEEDBACK_DIR", str(VAR_DIR / "feedback")))

FEEDBACK_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)

PRIVATE_MEDIA_DIR = Path(os.getenv(
    "HUIJU_PRIVATE_MEDIA_DIR",
    str(VAR_DIR / "private-media"),
))

PRIVATE_MEDIA_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)

def bounded_env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    """Read a deployment setting without allowing malformed or unsafe values."""
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return min(max(value, minimum), maximum)

ANALYTICS_BACKUP_RETENTION_DAYS = bounded_env_int(
    "HUIJU_ANALYTICS_BACKUP_RETENTION_DAYS", 120, 7, 730,
)

ANALYTICS_BACKUP_INTERVAL_SECONDS = bounded_env_int(
    "HUIJU_ANALYTICS_BACKUP_INTERVAL_SECONDS", 3600, 300, 86400,
)

MAX_QUEUE_SIZE = bounded_env_int("RELAY_QUEUE_SIZE", 8, 1, 8)

WORKER_CONCURRENCY = 1

MAX_REQUESTS_PER_MINUTE = bounded_env_int("RELAY_RATE_LIMIT_PER_MINUTE", 30, 1, 600)

QWEN_IMAGE_REQUESTS_PER_MINUTE = bounded_env_int("QWEN_IMAGE_RATE_LIMIT_PER_MINUTE", 10, 1, 120)

MAX_GENERATION_BODY_BYTES = 32 * 1024

MAX_ACCOUNT_BODY_BYTES = 16 * 1024

MAX_UPLOAD_BODY_BYTES = bounded_env_int("RELAY_MAX_UPLOAD_BYTES", 15 * 1024 * 1024, 1_024, 25 * 1024 * 1024)

MAX_AVATAR_BODY_BYTES = 3 * 1024 * 1024

MAX_FEEDBACK_SCREENSHOT_BODY_BYTES = 5 * 1024 * 1024 + 64 * 1024

MAX_UPLOAD_PIXELS = 16_000_000

COOKIE_SECURE = os.getenv("RELAY_COOKIE_SECURE", "0") == "1"

UPSTREAM_TIMEOUT_SECONDS = float(os.getenv("RELAY_UPSTREAM_TIMEOUT_SECONDS", "240"))

VISION_ANALYSIS_CONCURRENCY = bounded_env_int("RELAY_VISION_CONCURRENCY", 2, 1, 4)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

GOOGLE_IMAGE_MODEL = os.getenv("GOOGLE_IMAGE_MODEL", "gemini-3.1-flash-image")

ADMIN_USAGE_TOKEN = os.getenv("HUIJU_ADMIN_USAGE_TOKEN", "")

MODEL_USAGE_FILE = Path(os.getenv(
    "HUIJU_MODEL_USAGE_FILE",
    str(VAR_DIR / "model-usage.jsonl"),
))

SEEDREAM_API_KEY = os.getenv("SEEDREAM_API_KEY", "")

SEEDREAM_BASE_URL = os.getenv("SEEDREAM_BASE_URL", "")

SEEDREAM_IMAGE_MODEL = os.getenv("SEEDREAM_IMAGE_MODEL", "doubao-seedream-3-0-t2i-250415")

# Ark Responses API powers the site-owned short-drama editing agent.  It can
# reuse the same Ark credential as Seedream, while deployments may override it
# independently to isolate quotas and billing.
ARK_AGENT_API_KEY = os.getenv("ARK_AGENT_API_KEY", SEEDREAM_API_KEY)

ARK_AGENT_BASE_URL = os.getenv(
    "ARK_AGENT_BASE_URL", SEEDREAM_BASE_URL or "https://ark.cn-beijing.volces.com/api/v3",
).rstrip("/")

ARK_AGENT_MODEL = os.getenv("ARK_AGENT_MODEL", "doubao-seed-2-0-lite-260215")

MAX_AGENT_TOOL_CALLS = bounded_env_int("HUIJU_AGENT_MAX_TOOL_CALLS", 6, 1, 10)

MAX_AGENT_MESSAGE_BYTES = bounded_env_int("HUIJU_AGENT_MAX_MESSAGE_BYTES", 16 * 1024, 1024, 64 * 1024)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")

BAILIAN_BASE_URL = os.getenv("BAILIAN_BASE_URL", "https://dashscope.aliyuncs.com/api/v1").rstrip("/")

# Wan 3.0 supports the business-space endpoint documented by Model Studio.  A
# deployment may opt into that endpoint without moving the existing Wan 2.x
# routes away from their working DashScope base URL.
BAILIAN_WAN3_BASE_URL = os.getenv("BAILIAN_WAN3_BASE_URL", BAILIAN_BASE_URL).rstrip("/")

# Cloud media models retrieve each source URL themselves.  The local browser
# address is never reachable by those providers, so deployments must expose a
# public HTTPS origin for signed, short-lived provider-upload URLs.
HUIJU_PUBLIC_BASE_URL = os.getenv("HUIJU_PUBLIC_BASE_URL", "").rstrip("/")
BAILIAN_TTS_BASE_URL = os.getenv("BAILIAN_TTS_BASE_URL", "").rstrip("/")

BAILIAN_COMPATIBLE_BASE_URL = os.getenv(
    "BAILIAN_COMPATIBLE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
).rstrip("/")

BAILIAN_VISION_MODEL = os.getenv("BAILIAN_VISION_MODEL", "qwen3-vl-plus")

BAILIAN_VIDEO_MODEL = os.getenv("BAILIAN_VIDEO_MODEL", "wan2.7-t2v-2026-06-12")

WAN3_VIDEO_MODEL_IDS = frozenset({"wan3.0-video", "wan3.0-video-prime"})

BAILIAN_TTS_MODEL = os.getenv("BAILIAN_TTS_MODEL", "qwen3-tts-flash")

BAILIAN_TTS_VOICE = os.getenv("BAILIAN_TTS_VOICE", "Cherry")

# Doubao Speech uses a product-scoped API key in the Volcengine console.
DOUBAO_SPEECH_API_KEY = os.getenv("DOUBAO_SPEECH_API_KEY", "")

DOUBAO_SPEECH_BASE_URL = os.getenv(
    "DOUBAO_SPEECH_BASE_URL", "https://openspeech.bytedance.com"
).rstrip("/")

DOUBAO_SPEECH_RESOURCE_ID = os.getenv("DOUBAO_SPEECH_RESOURCE_ID", "seed-tts-2.0")

DOUBAO_TTS_DEFAULT_VOICE = os.getenv(
    "DOUBAO_TTS_DEFAULT_VOICE", "zh_female_vv_uranus_bigtts"
)

DOUBAO_TTS_MODEL_IDS = frozenset({"doubao-tts-2.0"})


def doubao_speech_is_configured() -> bool:
    return bool(DOUBAO_SPEECH_BASE_URL and DOUBAO_SPEECH_API_KEY)

# Seedance video models are Ark endpoint IDs rather than stable public model
# names. Keep product-facing aliases in public APIs and centralise the endpoint
# mapping here so the quick composer, workflow canvas and provider never drift.
# These defaults are the healthy endpoints provisioned for this deployment;
# environment variables can replace them without a code change.
SEEDANCE_2_0_MODEL = os.getenv("SEEDANCE_2_0_MODEL", "ep-20260822213419-cjq2z")
SEEDANCE_2_0_MINI_MODEL = os.getenv("SEEDANCE_2_0_MINI_MODEL", "ep-20260822213444-fs8bf")
SEEDANCE_2_0_FAST_MODEL = os.getenv("SEEDANCE_2_0_FAST_MODEL", "ep-20260822213507-zxbzp")
SEEDANCE_2_5_MODEL = os.getenv("SEEDANCE_2_5_MODEL", "ep-20260822213305-f9cg6")

SEEDANCE_MODEL_ENDPOINTS = {
    "seedance_2_0": SEEDANCE_2_0_MODEL,
    "seedance_2_0_mini": SEEDANCE_2_0_MINI_MODEL,
    "seedance_2_0_fast": SEEDANCE_2_0_FAST_MODEL,
    "seedance_2_5": SEEDANCE_2_5_MODEL,
}

ARK_VIDEO_API_KEY = os.getenv("ARK_VIDEO_API_KEY", SEEDREAM_API_KEY)

ARK_VIDEO_BASE_URL = os.getenv(
    "ARK_VIDEO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3",
).rstrip("/")

FAL_KEY = os.getenv("FAL_KEY", "")

FAL_QUEUE_BASE_URL = os.getenv("FAL_QUEUE_BASE_URL", "https://queue.fal.run").rstrip("/")

FAL_H3_MAX_MODEL_ID = "minimax_h3_max"

FAL_H3_MAX_QUEUE_APPLICATION = "minimax/h3-max"

FAL_H3_MAX_ENDPOINTS = {
    "text_to_video": "minimax/h3-max/text-to-video",
    "image_to_video": "minimax/h3-max/image-to-video",
}

FAL_GPT_IMAGE_2_MODEL_ID = "gpt_image"

FAL_GPT_IMAGE_2_QUEUE_APPLICATION = "openai/gpt-image-2"

FAL_GPT_IMAGE_2_ENDPOINTS = {
    "text_to_image": "openai/gpt-image-2",
    "image_edit": "openai/gpt-image-2/edit",
}

FAL_GPT_IMAGE_2_QUALITY = {
    "standard": "low",
    "fine": "medium",
    "ultra": "high",
}

MAX_VIDEO_DOWNLOAD_BYTES = bounded_env_int(
    "RELAY_MAX_VIDEO_DOWNLOAD_BYTES", 200 * 1024 * 1024, 1 * 1024 * 1024, 500 * 1024 * 1024,
)

MAX_AUDIO_DOWNLOAD_BYTES = bounded_env_int(
    "RELAY_MAX_AUDIO_DOWNLOAD_BYTES", 30 * 1024 * 1024, 256 * 1024, 100 * 1024 * 1024,
)

# Video Depth Anything Small is Apache-2.0 and uses about 6.8 GB VRAM in FP16.
# It is deliberately executed in a separate process/venv so it never becomes a
# hidden dependency of the Z-Image service process.
VIDEO_DEPTH_REPO = Path(os.getenv("VIDEO_DEPTH_REPO", "/workspace/models/Video-Depth-Anything"))

VIDEO_DEPTH_PYTHON = Path(os.getenv("VIDEO_DEPTH_PYTHON", "/workspace/video-depth-venv/bin/python"))

VIDEO_DEPTH_ENCODER = os.getenv("VIDEO_DEPTH_ENCODER", "vits")

MAX_DEPTH_UPLOAD_BYTES = bounded_env_int(
    "HUIJU_MAX_DEPTH_UPLOAD_BYTES", 200 * 1024 * 1024, 1 * 1024 * 1024, 500 * 1024 * 1024,
)

VOLC_SMS_ACCESS_KEY = os.getenv("VOLC_SMS_ACCESS_KEY", "")

VOLC_SMS_SECRET_KEY = os.getenv("VOLC_SMS_SECRET_KEY", "")

VOLC_SMS_ACCOUNT = os.getenv("VOLC_SMS_ACCOUNT", "")

VOLC_SMS_SIGN = os.getenv("VOLC_SMS_SIGN", "")

VOLC_SMS_TEMPLATE_ID = os.getenv("VOLC_SMS_TEMPLATE_ID", "")

VOLC_SMS_USER_EXT_CODE = os.getenv("VOLC_SMS_USER_EXT_CODE", "")

VOLC_SMS_SCENE = os.getenv("VOLC_SMS_SCENE", "注册验证码")

JOB_TTL_SECONDS = 15 * 60

DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60

IMAGE_TTL_SECONDS = 24 * 60 * 60

UPLOAD_TTL_SECONDS = 2 * 60 * 60

IDEMPOTENCY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,128}$")

DAILY_CREDITS = 10

GOOGLE_IMAGE_PRICING_USD: dict[str, dict[str, Any]] = {
    "google_nano_banana": {
        "input_per_million": 0.30, "text_output_per_million": 2.50,
        "image": {"1K": 0.039}, "source": "google_standard_2026-08-21",
    },
    "google_nano_banana_pro": {
        "input_per_million": 2.00, "text_output_per_million": 12.00,
        "image": {"1K": 0.134, "2K": 0.134, "4K": 0.24}, "source": "google_standard_2026-08-21",
    },
    "google_nano_banana_2": {
        "input_per_million": 0.50, "text_output_per_million": 3.00,
        "image": {"512": 0.045, "1K": 0.067, "2K": 0.101, "4K": 0.151}, "source": "google_standard_2026-08-21",
    },
    "google_nano_banana_2_lite": {
        "input_per_million": 0.25, "text_output_per_million": 1.50,
        "image": {"1K": 0.0336}, "source": "google_standard_2026-08-21",
    },
}

def sms_is_configured() -> bool:
    return all((
        VOLC_SMS_ACCESS_KEY, VOLC_SMS_SECRET_KEY, VOLC_SMS_ACCOUNT,
        VOLC_SMS_SIGN, VOLC_SMS_TEMPLATE_ID,
    ))

def _volc_hmac(key: bytes, value: str) -> bytes:
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).digest()

def volc_sms_signed_headers(action: str, body: bytes) -> tuple[str, dict[str, str]]:
    """Build the official Volcengine HMAC-SHA256 V4 request signature."""
    host = "sms.volcengineapi.com"
    region = "cn-north-1"
    service = "volcSMS"
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    short_date = now[:8]
    query = f"Action={quote(action, safe='-_.~')}&Version=2020-01-01"
    body_hash = hashlib.sha256(body).hexdigest()
    signed_headers = "content-type;host;x-content-sha256;x-date"
    canonical_headers = (
        "content-type:application/json\n"
        f"host:{host}\n"
        f"x-content-sha256:{body_hash}\n"
        f"x-date:{now}\n"
    )
    canonical_request = "\n".join((
        "POST", "/", query, canonical_headers, signed_headers, body_hash,
    ))
    scope = f"{short_date}/{region}/{service}/request"
    string_to_sign = "\n".join((
        "HMAC-SHA256", now, scope,
        hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
    ))
    signing_key = _volc_hmac(
        _volc_hmac(_volc_hmac(_volc_hmac(VOLC_SMS_SECRET_KEY.encode("utf-8"), short_date), region), service),
        "request",
    )
    signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    authorization = (
        f"HMAC-SHA256 Credential={VOLC_SMS_ACCESS_KEY}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    return query, {
        "Content-Type": "application/json",
        "Host": host,
        "X-Content-Sha256": body_hash,
        "X-Date": now,
        "Authorization": authorization,
    }

