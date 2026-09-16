"""fal.ai, Aliyun Model Studio and Volcengine media providers.

Only request shapes proven by a live minimal probe are enabled here.  Provider
task identifiers and expiring output URLs never leave the server; completed
media is copied into the owner-scoped private media store.
"""
from __future__ import annotations

import asyncio
import base64
import contextlib
import logging
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

import httpx

from ..core.config import (
    ARK_VIDEO_API_KEY,
    ARK_VIDEO_BASE_URL,
    BAILIAN_BASE_URL,
    BAILIAN_WAN3_BASE_URL,
    BAILIAN_TTS_BASE_URL,
    BAILIAN_TTS_MODEL,
    BAILIAN_TTS_VOICE,
    BAILIAN_VIDEO_MODEL,
    DASHSCOPE_API_KEY,
    DOUBAO_TTS_MODEL_IDS,
    FAL_H3_MAX_ENDPOINTS,
    FAL_H3_MAX_MODEL_ID,
    FAL_H3_MAX_QUEUE_APPLICATION,
    FAL_KEY,
    FAL_QUEUE_BASE_URL,
    MAX_AUDIO_DOWNLOAD_BYTES,
    MAX_VIDEO_DOWNLOAD_BYTES,
    PRIVATE_MEDIA_DIR,
    SEEDANCE_MODEL_ENDPOINTS,
    WAN3_VIDEO_MODEL_IDS,
)
from ..persistence.database import UserDatabase
from .volcengine_speech import VolcengineSpeechService

logger = logging.getLogger("huiju.providers.bailian")


def _provider_url(value: Any, media_kind: str) -> str:
    """Find an HTTPS provider result URL without relying on one response revision."""
    extensions = (".mp4", ".webm") if media_kind == "video" else (".wav", ".mp3", ".m4a", ".ogg")
    if isinstance(value, str):
        candidate = value
        parsed = urlparse(candidate)
        # Qwen3-TTS currently documents and returns an HTTP OSS URL.  OSS also
        # serves the same signed path over HTTPS, so upgrade only allow-listed
        # provider hosts instead of weakening the downloader's HTTPS policy.
        if parsed.scheme == "http" and _allowed_provider_host(parsed.hostname or ""):
            candidate = "https://" + candidate.removeprefix("http://")
        clean = candidate.split("?", 1)[0].lower()
        return candidate if candidate.startswith("https://") and clean.endswith(extensions) else ""
    if isinstance(value, dict):
        priority = ("video_url", "audio_url", "url", "result_url")
        for key in priority:
            direct = value.get(key)
            # Signed provider URLs do not always retain a filename extension.
            # Explicit media URL fields are safe to accept here because the
            # downloader still enforces HTTPS, an allow-listed host, a size
            # ceiling, and validates the downloaded media signature.
            found = direct if isinstance(direct, str) and direct.startswith("https://") else ""
            if not found:
                found = _provider_url(direct, media_kind)
            if found:
                return found
        for nested in value.values():
            found = _provider_url(nested, media_kind)
            if found:
                return found
    if isinstance(value, list):
        for nested in value:
            found = _provider_url(nested, media_kind)
            if found:
                return found
    return ""


def _provider_audio_bytes(value: Any) -> bytes:
    """Accept inline audio only when it is an explicitly named base64 field."""
    if isinstance(value, dict):
        for key in ("audio_data", "audio_base64", "b64_audio"):
            encoded = value.get(key)
            if isinstance(encoded, str) and len(encoded) <= MAX_AUDIO_DOWNLOAD_BYTES * 2:
                with contextlib.suppress(ValueError, TypeError):
                    return base64.b64decode(encoded, validate=True)
        for nested in value.values():
            raw = _provider_audio_bytes(nested)
            if raw:
                return raw
    elif isinstance(value, list):
        for nested in value:
            raw = _provider_audio_bytes(nested)
            if raw:
                return raw
    return b""


def _allowed_provider_host(host: str) -> bool:
    host = host.lower().rstrip(".")
    return any(host == suffix or host.endswith("." + suffix) for suffix in (
        "aliyuncs.com", "alicdn.com", "volces.com", "volccdn.com", "byteimg.com", "fal.media",
    ))


def _provider_response_code(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    output = value.get("output") if isinstance(value.get("output"), dict) else {}
    raw = value.get("code") or output.get("code")
    return "".join(character for character in str(raw or "") if character.isalnum() or character in "._-")[:96]


def _provider_failure_code(error: Exception) -> str:
    if isinstance(error, httpx.HTTPStatusError):
        code = ""
        with contextlib.suppress(ValueError):
            code = _provider_response_code(error.response.json())
        return f"http_{error.response.status_code}" + (f":{code}" if code else "")
    message = str(error)
    if message.startswith("provider_video_"):
        return message
    return type(error).__name__


class BailianMediaService:
    def __init__(self, database: UserDatabase, usage_recorder: Callable[..., None] | None = None) -> None:
        self.database = database
        self.usage_recorder = usage_recorder
        self.client: httpx.AsyncClient | None = None
        self.tasks: set[asyncio.Task[None]] = set()
        self.doubao_speech = VolcengineSpeechService()

    @property
    def configured(self) -> bool:
        return bool(
            (DASHSCOPE_API_KEY and BAILIAN_BASE_URL)
            or self.seedance_configured
            or FAL_KEY
            or self.doubao_speech.configured()
        )

    @property
    def seedance_configured(self) -> bool:
        return bool(ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL and any(SEEDANCE_MODEL_ENDPOINTS.values()))

    def configured_for_video(self, model: str) -> bool:
        if model == FAL_H3_MAX_MODEL_ID:
            return bool(FAL_KEY and FAL_QUEUE_BASE_URL)
        if model in SEEDANCE_MODEL_ENDPOINTS:
            return bool(ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL and SEEDANCE_MODEL_ENDPOINTS.get(model))
        if model in WAN3_VIDEO_MODEL_IDS:
            return bool(DASHSCOPE_API_KEY and BAILIAN_WAN3_BASE_URL)
        return bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL)

    def configured_for_audio(self, model: str) -> bool:
        if model in DOUBAO_TTS_MODEL_IDS:
            return self.doubao_speech.configured()
        if model.startswith("qwen-audio-"):
            return bool(DASHSCOPE_API_KEY and BAILIAN_TTS_BASE_URL)
        return bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL)

    async def start(self, client: httpx.AsyncClient) -> None:
        self.client = client
        for job in self.database.recoverable_media_jobs():
            if job["kind"] == "video" and job.get("provider_task_id"):
                self._track(self._resume_video(job))
            else:
                self.database.update_media_job(job["id"], job["owner_id"], status="failed", error="service_restarted")

    async def stop(self) -> None:
        for task in list(self.tasks):
            task.cancel()
        for task in list(self.tasks):
            with contextlib.suppress(asyncio.CancelledError):
                await task

    def _track(self, coroutine: Any) -> None:
        task = asyncio.create_task(coroutine)
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    def _record_usage(
        self, job_id: str, model: str, operation: str, status: str, started: float,
        kind: str, error: str = "", *, credits_charged: int = 0,
        resolution: str = "720P", provider_cost_usd: float | None = None,
        pricing_source: str = "",
    ) -> None:
        if not self.usage_recorder:
            return
        self.usage_recorder(
            job_id=job_id, model=model, operation=operation, status=status,
            resolution=resolution if kind == "video" else "24kHz", request_count=1,
            image_count=0, credits_charged=credits_charged,
            duration_ms=int((time.monotonic() - started) * 1000), error_code=error,
            provider_name=(
                "fal" if model == FAL_H3_MAX_MODEL_ID
                else "volcengine" if model in SEEDANCE_MODEL_ENDPOINTS or model in DOUBAO_TTS_MODEL_IDS
                else "bailian"
            ),
            media_kind=kind, provider_cost_usd=provider_cost_usd,
            pricing_source_override=pricing_source or None,
        )

    def submit_video(self, owner: str, job_id: str, payload: dict[str, Any]) -> None:
        self.database.create_media_job(
            owner, job_id, "video", payload["operation"], payload["model"], payload["prompt"], payload,
        )
        self._track(self._run_video(owner, job_id, payload))

    def submit_tts(
        self, owner: str, job_id: str, payload: dict[str, Any], *,
        reference_audio: bytes | None = None, reference_mime: str = "",
    ) -> None:
        self.database.create_media_job(
            owner, job_id, "audio", "text_to_speech", payload["model"], payload["text"], payload,
        )
        self._track(self._run_tts(owner, job_id, payload, reference_audio, reference_mime))

    async def _request_json(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self.configured or self.client is None:
            raise RuntimeError("bailian_media_not_configured")
        response = await self.client.request(
            method,
            f"{BAILIAN_BASE_URL}{path}",
            headers={"Authorization": f"Bearer {DASHSCOPE_API_KEY}", **kwargs.pop("headers", {})},
            **kwargs,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("provider_invalid_json")
        return data

    async def _request_ark_json(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self.seedance_configured or self.client is None:
            raise RuntimeError("seedance_video_not_configured")
        response = await self.client.request(
            method,
            f"{ARK_VIDEO_BASE_URL}{path}",
            headers={"Authorization": f"Bearer {ARK_VIDEO_API_KEY}", **kwargs.pop("headers", {})},
            **kwargs,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("provider_invalid_json")
        return data

    async def _request_wan3_json(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not DASHSCOPE_API_KEY or not BAILIAN_WAN3_BASE_URL or self.client is None:
            raise RuntimeError("wan3_video_not_configured")
        response = await self.client.request(
            method,
            f"{BAILIAN_WAN3_BASE_URL}{path}",
            headers={"Authorization": f"Bearer {DASHSCOPE_API_KEY}", **kwargs.pop("headers", {})},
            **kwargs,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("provider_invalid_json")
        return data

    async def _request_fal_json(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not FAL_KEY or self.client is None:
            raise RuntimeError("fal_video_not_configured")
        response = await self.client.request(
            method,
            f"{FAL_QUEUE_BASE_URL}{path}",
            headers={"Authorization": f"Key {FAL_KEY}", **kwargs.pop("headers", {})},
            **kwargs,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("provider_invalid_json")
        return data

    async def _request_qwen_audio_json(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not DASHSCOPE_API_KEY or not BAILIAN_TTS_BASE_URL or self.client is None:
            raise RuntimeError("qwen_audio_tts_not_configured")
        response = await self.client.request(
            method,
            f"{BAILIAN_TTS_BASE_URL}{path}",
            headers={"Authorization": f"Bearer {DASHSCOPE_API_KEY}", **kwargs.pop("headers", {})},
            **kwargs,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("provider_invalid_json")
        return data

    @staticmethod
    def _bailian_video_input(payload: dict[str, Any]) -> dict[str, Any]:
        operation = payload.get("operation", "text_to_video")
        media_urls = list(payload.get("media_urls") or [])
        uploaded_types = list(payload.get("media_types") or [])
        videos = [url for url, media_type in zip(media_urls, uploaded_types, strict=True) if str(media_type).startswith("video/")]
        audios = [url for url, media_type in zip(media_urls, uploaded_types, strict=True) if str(media_type).startswith("audio/")]
        images = [url for url, media_type in zip(media_urls, uploaded_types, strict=True) if str(media_type).startswith("image/")]
        if operation == "video_edit":
            result: dict[str, Any] = {"prompt": payload["prompt"]}
            result["media"] = ([{"type": "video", "url": videos[0]}] if videos else []) + [
                {"type": "reference_image", "url": url} for url in images
            ]
            return result
        if operation == "video_extension":
            result = {"prompt": payload["prompt"], "function": "video_extension"}
            if videos:
                result["first_clip_url"] = videos[0]
            if images:
                result["first_frame_url"] = images[0]
            return result
        if operation == "video_style":
            return {"video_url": videos[0] if videos else media_urls[0]}
        if operation == "lip_sync":
            result = {
                "video_url": videos[0] if videos else "",
                "audio_url": audios[0] if audios else "",
            }
            if images:
                result["ref_image_url"] = images[0]
            return result
        if operation == "character_swap_video":
            return {
                "image_url": images[0] if images else "",
                "video_url": videos[0] if videos else "",
                "watermark": True,
            }
        if operation == "digital_human":
            return {
                "image_url": images[0] if images else "",
                "audio_url": audios[0] if audios else "",
            }
        media_types = {
            "image_to_video": ["first_frame"],
            "first_last_to_video": ["first_frame", "last_frame"],
            "reference_to_video": [
                "reference_video" if str(uploaded_types[index] if index < len(uploaded_types) else "").startswith("video/") else "reference_image"
                for index in range(len(media_urls))
            ],
        }.get(operation, [])
        result: dict[str, Any] = {"prompt": payload["prompt"]}
        if media_urls:
            result["media"] = [
                {"type": media_type, "url": media_url}
                for media_type, media_url in zip(media_types, media_urls, strict=True)
            ]
        return result

    @staticmethod
    def _wan3_video_input(payload: dict[str, Any]) -> dict[str, Any]:
        operation = str(payload.get("operation") or "text_to_video")
        media_urls = list(payload.get("media_urls") or [])
        media_types = list(payload.get("media_types") or [])
        if operation == "image_to_video":
            roles = ["first_frame"]
        elif operation == "first_last_to_video":
            roles = ["first_frame", "last_frame"]
        else:
            roles = [
                "reference_video" if str(media_type).startswith("video/")
                else "reference_audio" if str(media_type).startswith("audio/")
                else "reference_image"
                for media_type in media_types
            ]
        prompt = str(payload["prompt"])
        if operation == "video_extension":
            prompt = f"将视频1向后延长。{prompt}"
        result: dict[str, Any] = {"prompt": prompt}
        if media_urls:
            result["media"] = [
                {"type": role, "url": url}
                for role, url in zip(roles, media_urls, strict=True)
            ]
        return result

    @staticmethod
    def _seedance_content(payload: dict[str, Any]) -> list[dict[str, Any]]:
        content: list[dict[str, Any]] = [{"type": "text", "text": payload["prompt"]}]
        operation = payload.get("operation", "text_to_video")
        uploaded_types = list(payload.get("media_types") or [])
        media_urls = list(payload.get("media_urls") or [])
        if operation == "image_to_video":
            roles = ["first_frame"]
        elif operation == "first_last_to_video":
            roles = ["first_frame", "last_frame"]
        else:
            roles = [
                "reference_video" if str(uploaded_types[index] if index < len(uploaded_types) else "").startswith("video/")
                else "reference_audio" if str(uploaded_types[index] if index < len(uploaded_types) else "").startswith("audio/")
                else "reference_image"
                for index in range(len(media_urls))
            ]
        for index, (role, url) in enumerate(zip(roles, media_urls, strict=True)):
            media_type = str(uploaded_types[index] if index < len(uploaded_types) else "")
            is_video = media_type.startswith("video/")
            is_audio = media_type.startswith("audio/")
            content_type = "video_url" if is_video else "audio_url" if is_audio else "image_url"
            content.append({
                "type": content_type,
                content_type: {"url": url},
                "role": role,
            })
        return content

    @staticmethod
    def _fal_video_input(payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        operation = str(payload["operation"])
        endpoint = FAL_H3_MAX_ENDPOINTS[operation]
        request_body: dict[str, Any] = {
            "prompt": str(payload["prompt"]),
            "duration": int(payload["duration"]),
            "resolution": str(payload["resolution"]),
            "enable_safety_checker": True,
            "sync_mode": False,
            "prompt_expansion_mode": "balanced",
        }
        if operation == "text_to_video":
            request_body["aspect_ratio"] = str(payload["ratio"])
        else:
            request_body["image_url"] = str(payload["media_urls"][0])
        return endpoint, request_body

    @staticmethod
    def _fal_queue_request_path(provider_task_id: str, *, status: bool) -> str:
        suffix = "/status" if status else ""
        return f"/{FAL_H3_MAX_QUEUE_APPLICATION}/requests/{provider_task_id}{suffix}"

    @staticmethod
    def _provider_task_id(result: dict[str, Any]) -> str:
        output = result.get("output") if isinstance(result.get("output"), dict) else {}
        return str(
            result.get("id") or result.get("task_id") or output.get("task_id") or result.get("request_id") or ""
        )

    async def _run_video(self, owner: str, job_id: str, payload: dict[str, Any]) -> None:
        started = time.monotonic()
        self.database.update_media_job(job_id, owner, status="running", provider_status="CREATING")
        try:
            model = str(payload.get("model") or BAILIAN_VIDEO_MODEL)
            if model == FAL_H3_MAX_MODEL_ID:
                endpoint, request_body = self._fal_video_input(payload)
                result = await self._request_fal_json(
                    "POST", f"/{endpoint}", json=request_body, timeout=90.0,
                )
            elif model in SEEDANCE_MODEL_ENDPOINTS:
                request_body: dict[str, Any] = {
                    "model": SEEDANCE_MODEL_ENDPOINTS[model],
                    "content": self._seedance_content(payload),
                    "ratio": payload.get("ratio", "16:9"),
                    "resolution": str(payload.get("resolution", "720P")).lower(),
                    "watermark": True,
                }
                # Zero is the UI's provider-controlled/automatic duration mode.
                request_body["duration"] = int(payload.get("duration") or -1)
                result = await self._request_ark_json(
                    "POST", "/contents/generations/tasks", json=request_body, timeout=90.0,
                )
            elif model in WAN3_VIDEO_MODEL_IDS:
                operation = str(payload.get("operation") or "text_to_video")
                parameters: dict[str, Any] = {
                    "resolution": payload.get("resolution", "720P"),
                    "prompt_extend": True,
                }
                if operation == "video_extension":
                    parameters["ratio"] = "adaptive"
                else:
                    parameters.update({
                        "ratio": payload.get("ratio", "16:9"),
                        "duration": int(payload.get("duration", 5)),
                    })
                result = await self._request_wan3_json(
                    "POST",
                    "/services/aigc/video-generation/video-synthesis",
                    headers={"X-DashScope-Async": "enable"},
                    json={"model": model, "input": self._wan3_video_input(payload), "parameters": parameters},
                    timeout=90.0,
                )
            else:
                operation = str(payload.get("operation") or "text_to_video")
                provider_path = (
                    "/services/aigc/image2video/video-synthesis"
                    if operation in {"lip_sync", "character_swap_video", "digital_human"}
                    else "/services/aigc/video-generation/video-synthesis"
                )
                parameters: dict[str, Any]
                if operation == "video_style":
                    parameters = {
                        "style": int(payload.get("style_id") or 0), "video_fps": 15,
                        "animate_emotion": True, "min_len": 540 if payload.get("resolution") == "480P" else 720,
                        "use_SR": True,
                    }
                elif operation == "lip_sync":
                    parameters = {"video_extension": True, "query_face_threshold": 170}
                elif operation == "character_swap_video":
                    parameters = {"mode": "wan-std", "check_image": True}
                elif operation == "digital_human":
                    parameters = {"resolution": payload.get("resolution", "720P")}
                elif operation == "video_extension":
                    parameters = {"control_condition": "depth", "duration": 5}
                else:
                    parameters = {
                        "resolution": payload.get("resolution", "720P"),
                        "ratio": payload.get("ratio", "16:9"),
                        "duration": int(payload.get("duration", 5)),
                        "prompt_extend": True,
                        "watermark": True,
                    }
                result = await self._request_json(
                    "POST",
                    provider_path,
                    headers={"X-DashScope-Async": "enable"},
                    json={
                        "model": model,
                        "input": self._bailian_video_input(payload),
                        "parameters": parameters,
                    },
                    timeout=90.0,
                )
            output = result.get("output") if isinstance(result.get("output"), dict) else {}
            task_id = self._provider_task_id(result)
            if not task_id:
                raise ValueError("provider_task_id_missing")
            self.database.update_media_job(
                job_id, owner, provider_task_id=task_id,
                provider_status=str(output.get("task_status") or "PENDING"),
            )
            await self._poll_video(
                owner, job_id, task_id, started, model, payload.get("operation", "text_to_video"),
                credits_charged=int(payload.get("charged_credits") or 0),
                resolution=str(payload.get("resolution") or "720P"),
                provider_cost_cny=float(payload.get("provider_cost_cny") or 0),
                pricing_source=str(payload.get("pricing_source") or ""),
            )
        except asyncio.CancelledError:
            raise
        except Exception as error:
            failure_code = _provider_failure_code(error)
            logger.warning("Bailian video failed job_id=%s error=%s", job_id, failure_code)
            self.database.update_media_job(job_id, owner, status="failed", error=failure_code)
            self._record_usage(
                job_id, payload.get("model") or BAILIAN_VIDEO_MODEL,
                payload.get("operation", "text_to_video"), "failed", started, "video",
                failure_code, credits_charged=int(payload.get("charged_credits") or 0),
                resolution=str(payload.get("resolution") or "720P"),
            )

    async def _resume_video(self, job: dict[str, Any]) -> None:
        started = time.monotonic()
        parameters = job["parameters"]
        try:
            await self._poll_video(
                job["owner_id"], job["id"], job["provider_task_id"], started,
                str(job.get("model") or BAILIAN_VIDEO_MODEL), str(job.get("operation") or "text_to_video"),
                credits_charged=int(parameters["charged_credits"]), resolution=str(parameters["resolution"]),
                provider_cost_cny=float(parameters["provider_cost_cny"]),
                pricing_source=str(parameters["pricing_source"]),
            )
        except asyncio.CancelledError:
            raise
        except Exception as error:
            failure_code = _provider_failure_code(error)
            self.database.update_media_job(job["id"], job["owner_id"], status="failed", error=failure_code)
            self._record_usage(
                job["id"], str(job.get("model") or BAILIAN_VIDEO_MODEL), str(job.get("operation") or "text_to_video"), "failed", started,
                "video", failure_code, credits_charged=int(job.get("charged_credits") or 0),
            )

    async def _poll_video(
        self, owner: str, job_id: str, provider_task_id: str, started: float,
        model: str, operation: str, *, credits_charged: int = 0, resolution: str = "720P",
        provider_cost_cny: float = 0.0, pricing_source: str = "",
    ) -> None:
        delay = 2.0
        while time.monotonic() - started < 600:
            if model == FAL_H3_MAX_MODEL_ID:
                result = await self._request_fal_json(
                    "GET", self._fal_queue_request_path(provider_task_id, status=True),
                    params={"logs": "false"}, timeout=30.0,
                )
            elif model in SEEDANCE_MODEL_ENDPOINTS:
                result = await self._request_ark_json(
                    "GET", f"/contents/generations/tasks/{provider_task_id}", timeout=30.0,
                )
            elif model in WAN3_VIDEO_MODEL_IDS:
                result = await self._request_wan3_json("GET", f"/tasks/{provider_task_id}", timeout=30.0)
            else:
                result = await self._request_json("GET", f"/tasks/{provider_task_id}", timeout=30.0)
            output = result.get("output") if isinstance(result.get("output"), dict) else result
            status = str(
                output.get("task_status") or result.get("task_status") or result.get("status") or "UNKNOWN"
            ).upper()
            self.database.update_media_job(job_id, owner, status="running", provider_status=status)
            if status in {"SUCCEEDED", "COMPLETED"}:
                if model == FAL_H3_MAX_MODEL_ID:
                    result = await self._request_fal_json(
                        "GET", self._fal_queue_request_path(provider_task_id, status=False), timeout=30.0,
                    )
                    output = result
                url = _provider_url(output, "video") or _provider_url(result, "video")
                if not url:
                    raise ValueError("provider_video_url_missing")
                media_path, mime = await self._download(owner, job_id, "video", url)
                self.database.update_media_job(
                    job_id, owner, status="completed", provider_status=status,
                    media_path=media_path, mime_type=mime,
                )
                self._record_usage(
                    job_id, model, operation, "completed", started, "video",
                    credits_charged=credits_charged, resolution=resolution,
                    provider_cost_usd=provider_cost_cny / 7.20,
                    pricing_source=pricing_source,
                )
                return
            if status in {"FAILED", "CANCELED", "CANCELLED", "UNKNOWN", "ERROR"}:
                code = _provider_response_code(output) or _provider_response_code(result)
                raise RuntimeError(f"provider_video_{status.lower()}" + (f":{code}" if code else ""))
            await asyncio.sleep(delay)
            delay = min(15.0, delay * 1.7)
        raise TimeoutError("provider_video_timeout")

    async def _create_qwen_voice(self, job_id: str, raw: bytes, mime: str) -> str:
        encoded = base64.b64encode(raw).decode("ascii")
        result = await self._request_json(
            "POST", "/services/audio/tts/customization",
            json={
                "model": "qwen-voice-enrollment",
                "input": {
                    "action": "create",
                    "target_model": "qwen3-tts-vc-2026-01-22",
                    "preferred_name": f"huiju_{job_id[:8]}",
                    "audio": {"data": f"data:{mime};base64,{encoded}"},
                },
            },
            timeout=180.0,
        )
        output = result.get("output") if isinstance(result.get("output"), dict) else {}
        voice = str(output.get("voice") or output.get("voice_id") or "")
        if not voice:
            raise ValueError("provider_voice_id_missing")
        return voice

    async def _delete_qwen_voice(self, voice: str) -> None:
        await self._request_json(
            "POST", "/services/audio/tts/customization",
            json={"model": "qwen-voice-enrollment", "input": {"action": "delete", "voice": voice}},
            timeout=60.0,
        )

    async def _run_tts(
        self, owner: str, job_id: str, payload: dict[str, Any],
        reference_audio: bytes | None = None, reference_mime: str = "",
    ) -> None:
        started = time.monotonic()
        temporary_voice = ""
        self.database.update_media_job(job_id, owner, status="running", provider_status="RUNNING")
        try:
            model = str(payload.get("model") or BAILIAN_TTS_MODEL)
            if reference_audio:
                temporary_voice = await self._create_qwen_voice(job_id, reference_audio, reference_mime)
                payload = {**payload, "voice": temporary_voice}
            if model in DOUBAO_TTS_MODEL_IDS:
                if self.client is None:
                    raise RuntimeError("media_client_unavailable")
                raw = await self.doubao_speech.synthesize(self.client, owner, payload)
                media_path, mime = self._persist_audio(owner, job_id, raw)
                result = None
            elif model.startswith("qwen3-tts"):
                tts_input: dict[str, Any] = {
                    "text": payload["text"],
                    "voice": payload.get("voice") or BAILIAN_TTS_VOICE,
                    "language_type": payload.get("language_type") or "Auto",
                }
                if model == "qwen3-tts-instruct-flash" and payload.get("instructions"):
                    tts_input["instructions"] = payload["instructions"]
                result = await self._request_json(
                    "POST", "/services/aigc/multimodal-generation/generation",
                    json={"model": model, "input": tts_input}, timeout=120.0,
                )
            else:
                result = await self._request_qwen_audio_json(
                    "POST",
                    "/services/audio/tts/SpeechSynthesizer",
                    json={
                        "model": model,
                        "input": {
                            "text": payload["text"],
                            "voice": payload.get("voice") or "longanhuan_v3.6",
                            "format": "wav",
                            "sample_rate": 24000,
                        },
                    },
                    timeout=120.0,
                )
            if model not in DOUBAO_TTS_MODEL_IDS:
                url = _provider_url(result, "audio")
                if url:
                    media_path, mime = await self._download(owner, job_id, "audio", url)
                else:
                    raw = _provider_audio_bytes(result)
                    media_path, mime = self._persist_audio(owner, job_id, raw)
            self.database.update_media_job(
                job_id, owner, status="completed", provider_status="SUCCEEDED",
                media_path=media_path, mime_type=mime,
            )
            self._record_usage(
                job_id, payload.get("model") or BAILIAN_TTS_MODEL, "text_to_speech", "completed", started, "audio",
                credits_charged=int(payload.get("charged_credits") or 0),
            )
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.warning("Bailian TTS failed job_id=%s type=%s", job_id, type(error).__name__)
            self.database.update_media_job(job_id, owner, status="failed", error=type(error).__name__)
            self._record_usage(
                job_id, payload.get("model") or BAILIAN_TTS_MODEL, "text_to_speech", "failed", started, "audio",
                type(error).__name__, credits_charged=int(payload.get("charged_credits") or 0),
            )
        finally:
            if temporary_voice:
                try:
                    await self._delete_qwen_voice(temporary_voice)
                except Exception as error:
                    logger.warning("Temporary voice cleanup failed job_id=%s type=%s", job_id, type(error).__name__)

    async def _download(self, owner: str, job_id: str, kind: str, url: str) -> tuple[str, str]:
        if self.client is None:
            raise RuntimeError("media_client_unavailable")
        parsed = urlparse(url)
        if parsed.scheme != "https" or not _allowed_provider_host(parsed.hostname or ""):
            raise ValueError("provider_media_host_rejected")
        limit = MAX_VIDEO_DOWNLOAD_BYTES if kind == "video" else MAX_AUDIO_DOWNLOAD_BYTES
        async with self.client.stream("GET", url, timeout=180.0) as response:
            response.raise_for_status()
            length = int(response.headers.get("Content-Length", "0") or 0)
            if length > limit:
                raise ValueError("provider_media_too_large")
            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes(128 * 1024):
                total += len(chunk)
                if total > limit:
                    raise ValueError("provider_media_too_large")
                chunks.append(chunk)
        raw = b"".join(chunks)
        if kind == "audio":
            return self._persist_audio(owner, job_id, raw)
        if len(raw) < 12 or b"ftyp" not in raw[4:16]:
            raise ValueError("provider_video_invalid")
        return self._persist(owner, job_id, "videos", ".mp4", raw), "video/mp4"

    def _persist_audio(self, owner: str, job_id: str, raw: bytes) -> tuple[str, str]:
        if len(raw) >= 12 and raw.startswith(b"RIFF") and raw[8:12] == b"WAVE":
            suffix, mime = ".wav", "audio/wav"
        elif raw.startswith(b"ID3") or (len(raw) > 2 and raw[0] == 0xFF and raw[1] & 0xE0 == 0xE0):
            suffix, mime = ".mp3", "audio/mpeg"
        elif raw.startswith(b"OggS"):
            suffix, mime = ".ogg", "audio/ogg"
        elif len(raw) >= 12 and b"ftyp" in raw[4:16]:
            suffix, mime = ".m4a", "audio/mp4"
        else:
            raise ValueError("provider_audio_invalid")
        return self._persist(owner, job_id, "audio", suffix, raw), mime

    @staticmethod
    def _persist(owner: str, job_id: str, bucket: str, suffix: str, raw: bytes) -> str:
        directory = PRIVATE_MEDIA_DIR / bucket / owner
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        destination = directory / f"{job_id}{suffix}"
        destination.write_bytes(raw)
        with contextlib.suppress(OSError):
            destination.chmod(0o600)
        return destination.relative_to(PRIVATE_MEDIA_DIR).as_posix()
