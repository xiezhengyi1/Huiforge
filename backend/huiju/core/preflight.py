"""Secret-safe production configuration preflight.

Run with ``python -m backend.huiju.core.preflight`` in the same environment that
will start Uvicorn.  Only boolean readiness is printed; credential values and
filesystem paths are never emitted.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from typing import Any

from .config import (
    ADMIN_USAGE_TOKEN,
    APP_VERSION,
    ARK_AGENT_API_KEY,
    ARK_AGENT_BASE_URL,
    ARK_AGENT_MODEL,
    ARK_VIDEO_API_KEY,
    ARK_VIDEO_BASE_URL,
    FAL_KEY,
    COOKIE_SECURE,
    DASHSCOPE_API_KEY,
    GENERATED_DIR,
    GOOGLE_API_KEY,
    PRIVATE_MEDIA_DIR,
    RELEASE_ID,
    SEEDREAM_API_KEY,
    SEEDREAM_BASE_URL,
    STATIC_DIR,
    FRONTEND_CSS_DIR,
    FRONTEND_JS_DIR,
    FRONTEND_PAGE_DIR,
    sms_is_configured,
    doubao_speech_is_configured,
    BASE_DIR,
)


_SHOWCASE_REFERENCE_PATTERN = re.compile(
    r"/static/showcase/v\d+/[a-z0-9_./-]+\.webp",
)
_SHOWCASE_REFERENCE_SOURCES = (
    FRONTEND_PAGE_DIR / "index.html",
    FRONTEND_PAGE_DIR / "studio.html",
    FRONTEND_JS_DIR / "app.js",
    FRONTEND_CSS_DIR / "home-surface.css",
)


def _storage_ready(path) -> bool:
    return path.is_dir() and os.access(path, os.R_OK | os.W_OK)


def _release_consistent() -> bool:
    try:
        html = (FRONTEND_PAGE_DIR / "studio.html").read_text(encoding="utf-8")
    except OSError:
        return False
    match = re.search(r'<meta name="huiju-release" content="([^"]+)"', html)
    return bool(match and match.group(1) == RELEASE_ID)


def _showcase_assets_complete() -> bool:
    references: set[str] = set()
    try:
        for path in _SHOWCASE_REFERENCE_SOURCES:
            source = path.read_text(encoding="utf-8")
            references.update(_SHOWCASE_REFERENCE_PATTERN.findall(source))
    except OSError:
        return False
    if not references or not STATIC_DIR.is_dir():
        return False
    for reference in references:
        asset = STATIC_DIR / reference.removeprefix("/static/")
        try:
            signature = asset.read_bytes()[:12]
        except OSError:
            return False
        if len(signature) != 12 or signature[:4] != b"RIFF" or signature[8:] != b"WEBP":
            return False
    return True


def production_checks() -> dict[str, Any]:
    image_provider = bool(
        FAL_KEY or GOOGLE_API_KEY or DASHSCOPE_API_KEY
        or (SEEDREAM_API_KEY and SEEDREAM_BASE_URL)
    )
    video_provider = bool(
        (DASHSCOPE_API_KEY)
        or (ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL)
        or FAL_KEY
    )
    audio_provider = bool(DASHSCOPE_API_KEY or doubao_speech_is_configured())
    blocking = {
        "secure_cookie": COOKIE_SECURE,
        "admin_usage_token": bool(ADMIN_USAGE_TOKEN),
        "sms_registration": sms_is_configured(),
        "image_provider": image_provider,
        "video_provider": video_provider,
        "audio_provider": audio_provider,
        "generated_storage": _storage_ready(GENERATED_DIR),
        "private_storage": _storage_ready(PRIVATE_MEDIA_DIR),
        "release_consistent": _release_consistent(),
        "showcase_assets": _showcase_assets_complete(),
    }
    optional = {
        "short_drama_agent": bool(ARK_AGENT_API_KEY and ARK_AGENT_BASE_URL and ARK_AGENT_MODEL),
    }
    return {
        "status": "ready" if all(blocking.values()) else "blocked",
        "version": APP_VERSION,
        "release": RELEASE_ID,
        "blocking": blocking,
        "optional": optional,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate a Huiju production release.")
    parser.add_argument("--static-assets-only", action="store_true")
    args = parser.parse_args(argv)
    if args.static_assets_only:
        result = {"showcase_assets": _showcase_assets_complete()}
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if result["showcase_assets"] else 1
    result = production_checks()
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if result["status"] == "ready" else 1


if __name__ == "__main__":
    raise SystemExit(main())
