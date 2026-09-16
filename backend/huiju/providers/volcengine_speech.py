"""Volcengine Doubao Speech V3 synthesis adapter.

The public application contract stays provider-neutral.  This module owns the
provider-specific authentication, request shape and SSE/base64 decoding so the
router, workflow canvas and short-drama agent do not duplicate that logic.
"""
from __future__ import annotations

import base64
import json
import uuid
from typing import Any

import httpx

from ..core.config import (
    DOUBAO_SPEECH_API_KEY,
    DOUBAO_SPEECH_BASE_URL,
    DOUBAO_SPEECH_RESOURCE_ID,
    DOUBAO_TTS_DEFAULT_VOICE,
    doubao_speech_is_configured,
)


LANGUAGE_MAP = {
    "Chinese": "zh-cn",
    "English": "en",
    "Japanese": "ja",
    "Spanish": "es-mx",
    "Portuguese": "pt-br",
    "French": "fr",
    "German": "de",
}


class VolcengineSpeechService:
    """Produce one complete audio file through the V3 HTTP/SSE endpoint."""

    endpoint = "/api/v3/tts/unidirectional/sse"

    @staticmethod
    def configured() -> bool:
        return doubao_speech_is_configured()

    @staticmethod
    def _headers(request_id: str) -> dict[str, str]:
        headers = {
            "Accept": "text/event-stream, application/json",
            "Content-Type": "application/json",
            "X-Api-Resource-Id": DOUBAO_SPEECH_RESOURCE_ID,
            "X-Api-Request-Id": request_id,
        }
        headers["X-Api-Key"] = DOUBAO_SPEECH_API_KEY
        return headers

    @staticmethod
    def _payload(owner: str, request_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        requested_format = str(payload.get("format") or "mp3")
        # V3 streaming does not support WAV; use MP3 while preserving the
        # provider-neutral frontend default used by the Qwen adapter.
        encoding = requested_format if requested_format in {"mp3", "ogg_opus", "pcm"} else "mp3"
        speed_ratio = float(payload.get("speed_ratio") or 1.0)
        loudness_ratio = float(payload.get("loudness_ratio") or 1.0)
        audio_params: dict[str, Any] = {
            "format": encoding,
            "speech_rate": max(-50, min(100, round((speed_ratio - 1.0) * 100))),
            "loudness_rate": max(-50, min(100, round((loudness_ratio - 1.0) * 100))),
        }
        if encoding in {"mp3", "ogg_opus"}:
            audio_params["bit_rate"] = 64000
        additions: dict[str, Any] = {
            "disable_markdown_filter": False,
            "enable_latex_tn": False,
        }
        language = LANGUAGE_MAP.get(str(payload.get("language_type") or "Auto"))
        if language:
            additions["explicit_language"] = language
        emotion = str(payload.get("emotion") or "").strip()
        if emotion:
            audio_params.update({
                "emotion": emotion,
                "emotion_scale": float(payload.get("emotion_scale") or 4.0),
            })
        return {
            "user": {"uid": owner[:64]},
            "req_params": {
                "text": payload["text"],
                "speaker": payload.get("voice") or DOUBAO_TTS_DEFAULT_VOICE,
                "sample_rate": int(payload.get("sample_rate") or 24000),
                "audio_params": audio_params,
                "additions": json.dumps(additions, ensure_ascii=False),
            },
        }

    @staticmethod
    def _decode_event(value: Any) -> bytes:
        if not isinstance(value, dict):
            return b""
        code = value.get("code")
        if code not in (None, 0, 20000000):
            raise RuntimeError(f"doubao_speech_{code}")
        encoded = value.get("data") or value.get("audio_data") or value.get("audio_base64")
        if not isinstance(encoded, str) or not encoded:
            return b""
        try:
            return base64.b64decode(encoded, validate=True)
        except (ValueError, TypeError) as error:
            raise ValueError("doubao_speech_invalid_audio") from error

    @classmethod
    def _decode_response(cls, response: httpx.Response) -> bytes:
        content_type = response.headers.get("Content-Type", "").lower()
        if content_type.startswith(("audio/", "application/octet-stream")):
            return response.content
        if "text/event-stream" in content_type or response.text.lstrip().startswith("data:"):
            chunks: list[bytes] = []
            for line in response.text.splitlines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw or raw == "[DONE]":
                    continue
                try:
                    chunks.append(cls._decode_event(json.loads(raw)))
                except json.JSONDecodeError as error:
                    raise ValueError("doubao_speech_invalid_sse") from error
            audio = b"".join(chunks)
        else:
            try:
                audio = cls._decode_event(response.json())
            except json.JSONDecodeError as error:
                raise ValueError("doubao_speech_invalid_json") from error
        if not audio:
            raise ValueError("doubao_speech_audio_missing")
        return audio

    async def synthesize(
        self,
        client: httpx.AsyncClient,
        owner: str,
        payload: dict[str, Any],
    ) -> bytes:
        if not self.configured():
            raise RuntimeError("doubao_speech_not_configured")
        request_id = uuid.uuid4().hex
        response = await client.post(
            f"{DOUBAO_SPEECH_BASE_URL}{self.endpoint}",
            headers=self._headers(request_id),
            json=self._payload(owner, request_id, payload),
            timeout=120.0,
        )
        response.raise_for_status()
        return self._decode_response(response)
