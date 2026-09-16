"""Owner-scoped video and audio generation APIs."""
from __future__ import annotations

import asyncio
import hmac
import math
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask

from ..dependencies import client_ip, owner_id
from ...providers.bailian_media import BailianMediaService
from ...providers.video_depth import VideoDepthService, valid_video_signature
from ...core.config import (
    BAILIAN_BASE_URL,
    DASHSCOPE_API_KEY,
    HUIJU_PUBLIC_BASE_URL,
    MAX_DEPTH_UPLOAD_BYTES,
    UPLOAD_DIR,
)
from ...runtime import relay
from ..schemas import AudioTtsInput, VideoGenerationInput
from ...domains.generation.reference_prompts import assemble_reference_prompt

router = APIRouter()
media_service = BailianMediaService(relay.database, relay.record_model_usage)
video_depth_service = VideoDepthService(relay.database, relay.record_model_usage)


def _session_owner(request: Request) -> str:
    """Use the server-issued owner for signed-in and device sessions.

    Image generation already accepts this private owner contract. Requiring a
    registered account only for media caused audio requests to fail before a
    job could be created, despite the browser holding a valid session.
    """
    return owner_id(request)


def _public_job(owner: str, job_id: str, kind: Literal["video", "audio"]) -> dict[str, Any]:
    job = relay.database.media_job(owner, job_id)
    if not job or job["kind"] != kind:
        raise HTTPException(status_code=404, detail="media_job_not_found")
    result = {
        key: value for key, value in job.items()
        if key not in {"error"} or job["status"] == "failed"
    }
    if job["status"] == "completed":
        result["url"] = f"/api/v1/private-media/{kind}/{job_id}"
    return result


def _provider_image_urls(request: Request, owner: str, upload_ids: list[str]) -> tuple[list[str], list[str]]:
    """Mint short-lived, unguessable URLs for a provider to fetch owned reference media."""
    if upload_ids and not HUIJU_PUBLIC_BASE_URL.startswith("https://"):
        raise HTTPException(status_code=503, detail="provider_upload_public_base_url_required")
    urls: list[str] = []
    media_types: list[str] = []
    for upload_id in upload_ids:
        upload = relay.uploads.get(upload_id)
        path = Path(str(upload.get("path", ""))) if upload else Path()
        if not upload or upload.get("owner") != owner or upload.get("kind") == "mask" or not path.is_file():
            raise HTTPException(status_code=404, detail="unknown_video_upload")
        token = secrets.token_urlsafe(32)
        upload["provider_token"] = token
        upload["provider_token_expires"] = time.time() + 20 * 60
        upload["updated_at"] = time.time()
        urls.append(f"{HUIJU_PUBLIC_BASE_URL}/api/v1/provider-uploads/{token}")
        media_types.append(str(upload.get("media_type") or "image/png"))
    return urls, media_types


def _uploaded_video_seconds(owner: str, upload_ids: list[str]) -> int:
    """Return the rounded provider-billed duration of the owner's video inputs."""
    total = 0.0
    for upload_id in upload_ids:
        upload = relay.uploads.get(upload_id)
        if not upload or upload.get("owner") != owner or not str(upload.get("media_type") or "").startswith("video/"):
            continue
        result = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(upload["path"]),
            ],
            capture_output=True,
            check=True,
            text=True,
            timeout=15,
        )
        total += float(result.stdout.strip())
    return math.ceil(total)


def _validate_video_media_contract(operation: str, media_types: list[str]) -> None:
    counts = {
        "image": sum(value.startswith("image/") for value in media_types),
        "video": sum(value.startswith("video/") for value in media_types),
        "audio": sum(value.startswith("audio/") for value in media_types),
    }
    valid = {
        "video_edit": counts["video"] == 1 and counts["image"] <= 1 and counts["audio"] == 0,
        "video_extension": counts["video"] + counts["image"] >= 1 and counts["audio"] == 0 and all(
            media_type == "video/mp4" for media_type in media_types if media_type.startswith("video/")
        ),
        "video_style": counts["video"] == 1 and len(media_types) == 1,
        "lip_sync": counts["video"] == 1 and counts["audio"] == 1 and counts["image"] <= 1,
        "character_swap_video": counts["video"] == 1 and counts["image"] == 1 and len(media_types) == 2,
        "digital_human": counts["image"] == 1 and counts["audio"] == 1 and len(media_types) == 2,
    }
    if operation in valid and not valid[operation]:
        raise HTTPException(status_code=422, detail=f"invalid_{operation}_media_types")


@router.get("/api/v1/provider-uploads/{token}", name="provider_upload")
async def provider_upload(token: str) -> FileResponse:
    """Serve one normalized upload to a cloud model through an expiring capability URL."""
    if len(token) < 32 or len(token) > 96:
        raise HTTPException(status_code=404, detail="not_found")
    now = time.time()
    for upload in relay.uploads.values():
        expected = str(upload.get("provider_token", ""))
        if expected and hmac.compare_digest(expected, token):
            if float(upload.get("provider_token_expires", 0)) < now:
                raise HTTPException(status_code=410, detail="provider_upload_expired")
            path = Path(str(upload.get("path", "")))
            if not path.is_file():
                raise HTTPException(status_code=404, detail="not_found")
            return FileResponse(
                path, media_type=str(upload.get("media_type") or "image/png"),
                headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
            )
    raise HTTPException(status_code=404, detail="not_found")


@router.post("/api/v1/media/uploads")
async def upload_reference_media(request: Request, media: UploadFile = File(...)) -> JSONResponse:
    """Store owner-scoped video or audio references for media workflows."""
    owner = _session_owner(request)
    if not relay.check_rate_limit(f"media-upload-ip:{client_ip(request)}") or not relay.check_rate_limit(f"media-upload-user:{owner}"):
        return JSONResponse({"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
    content_type = str(media.content_type or "").lower()
    allowed = {
        "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm",
        "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a", "audio/ogg": ".ogg",
    }
    if content_type not in allowed:
        raise HTTPException(status_code=415, detail="unsupported_reference_media_type")
    raw = await media.read(MAX_DEPTH_UPLOAD_BYTES + 1)
    await media.close()
    if not raw or len(raw) > MAX_DEPTH_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="reference_media_too_large")
    suffix = allowed[content_type]
    looks_like_iso_video = len(raw) >= 12 and raw[4:8] == b"ftyp"
    looks_like_webm = raw.startswith(b"\x1aE\xdf\xa3")
    looks_like_wav = len(raw) >= 12 and raw.startswith(b"RIFF") and raw[8:12] == b"WAVE"
    looks_like_mp3 = raw.startswith(b"ID3") or (len(raw) > 2 and raw[0] == 0xFF and raw[1] & 0xE0 == 0xE0)
    looks_like_ogg = raw.startswith(b"OggS")
    signature_ok = {
        ".webm": looks_like_webm, ".mp4": looks_like_iso_video, ".mov": looks_like_iso_video,
        ".m4a": looks_like_iso_video, ".wav": looks_like_wav, ".mp3": looks_like_mp3, ".ogg": looks_like_ogg,
    }.get(suffix, False)
    if not signature_ok:
        raise HTTPException(status_code=415, detail="invalid_reference_media")
    upload_id = uuid.uuid4().hex
    path = UPLOAD_DIR / f"{upload_id}{suffix}"
    path.write_bytes(raw)
    relay.uploads[upload_id] = {
        "owner": owner,
        "path": path,
        "updated_at": time.time(),
        "kind": "audio_reference" if content_type.startswith("audio/") else "video_reference",
        "media_type": content_type,
    }
    return JSONResponse({
        "upload_id": upload_id,
        "media_type": content_type,
        "size": len(raw),
        "preview_url": f"/api/v1/media/uploads/{upload_id}/preview",
    })


@router.get("/api/v1/media/uploads/{upload_id}/preview")
async def preview_reference_media(upload_id: str, request: Request) -> FileResponse:
    """Stream an owner-scoped upload from a same-origin URL for browser playback."""
    owner = _session_owner(request)
    upload = relay.uploads.get(upload_id)
    path = Path(str(upload.get("path", ""))) if upload else Path()
    if (
        not re.fullmatch(r"[a-f0-9]{32}", upload_id)
        or not upload
        or upload.get("owner") != owner
        or upload.get("kind") not in {"video_reference", "audio_reference"}
        or not path.is_file()
    ):
        raise HTTPException(status_code=404, detail="unknown_reference_media")
    return FileResponse(
        path,
        media_type=str(upload.get("media_type") or "application/octet-stream"),
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.post("/api/v1/videos/generations")
async def create_video(payload: VideoGenerationInput, request: Request) -> JSONResponse:
    owner = _session_owner(request)
    if not media_service.configured_for_video(payload.model):
        detail = (
            "fal_video_not_configured" if payload.model == "minimax_h3_max"
            else "seedance_endpoint_not_configured" if payload.model.startswith("seedance_")
            else "bailian_video_not_configured"
        )
        raise HTTPException(status_code=503, detail=detail)
    if not relay.check_rate_limit(f"video-ip:{client_ip(request)}") or not relay.check_rate_limit(f"video-user:{owner}"):
        return JSONResponse({"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
    idempotency_key = request.headers.get("Idempotency-Key", "")
    if idempotency_key:
        from ...core.config import IDEMPOTENCY_PATTERN
        if not IDEMPOTENCY_PATTERN.fullmatch(idempotency_key):
            raise HTTPException(status_code=400, detail="invalid_idempotency_key")
        previous_id = relay.idempotency.get((owner, idempotency_key))
        if previous_id:
            previous = relay.database.media_job(owner, previous_id)
            if previous:
                return JSONResponse({**previous, "request_id": previous_id, "status_url": f"/api/v1/videos/jobs/{previous_id}"})
    active = [job for job in relay.database.media_jobs_for(owner, 100) if job["kind"] == "video" and job["status"] in {"queued", "running"}]
    if active:
        return JSONResponse({"error": "media_concurrency_limit"}, status_code=429, headers={"Retry-After": "15"})
    job_id = uuid.uuid4().hex
    try:
        request_payload = payload.model_dump(mode="json")
        request_payload["media_urls"], request_payload["media_types"] = _provider_image_urls(request, owner, payload.upload_ids)
        _validate_video_media_contract(payload.operation, request_payload["media_types"])
        request_payload.pop("upload_ids", None)
        request_payload["prompt"] = assemble_reference_prompt(
            request_payload.get("prompt", ""),
            payload.model,
            sum(value.startswith("image/") for value in request_payload["media_types"]),
        )
        billed_duration = 30 if payload.model == "seedance_2_5" and payload.duration == 0 else payload.duration
        quote = relay.charge_video_credits(
            owner, payload.model, payload.resolution, billed_duration,
            has_video_input=any(value.startswith("video/") for value in request_payload["media_types"]),
            input_video_seconds=_uploaded_video_seconds(owner, payload.upload_ids),
        )
        request_payload.update(
            charged_credits=quote["total_credits"], unit_credits=quote["unit_credits"],
            billed_quantity=quote["quantity"], pricing_source=quote["pricing_source"],
            provider_cost_cny=quote["provider_cost_cny"],
        )
        media_service.submit_video(owner, job_id, request_payload)
    except ValueError as error:
        if str(error) == "media_concurrency_limit":
            return JSONResponse({"error": "media_concurrency_limit"}, status_code=429, headers={"Retry-After": "15"})
        if str(error) == "credits_insufficient":
            return JSONResponse({"error": "credits_insufficient", "credits": relay.credit_summary(owner)}, status_code=402)
        if str(error) == "reference_prompt_image_out_of_range":
            raise HTTPException(status_code=422, detail=str(error)) from error
        raise
    if idempotency_key:
        relay.idempotency[(owner, idempotency_key)] = job_id
    return JSONResponse(
        {"request_id": job_id, "status": "queued", "status_url": f"/api/v1/videos/jobs/{job_id}", "quote": quote},
        status_code=202,
    )


@router.get("/api/v1/videos/jobs/{job_id}")
async def video_job(job_id: str, request: Request) -> JSONResponse:
    owner = _session_owner(request)
    result = _public_job(owner, job_id, "video")
    status_code = 202 if result["status"] in {"queued", "running"} else 200
    if status_code == 202:
        result["status_url"] = f"/api/v1/videos/jobs/{job_id}"
    return JSONResponse(result, status_code=status_code)


@router.post("/api/v1/audio/tts")
async def create_tts(payload: AudioTtsInput, request: Request) -> JSONResponse:
    owner = _session_owner(request)
    reference_audio: bytes | None = None
    reference_mime = ""
    if payload.reference_upload_id:
        if not payload.rights_confirmed:
            raise HTTPException(status_code=422, detail="voice_rights_confirmation_required")
        if not DASHSCOPE_API_KEY or not BAILIAN_BASE_URL:
            raise HTTPException(status_code=503, detail="voice_clone_provider_not_configured")
        upload = relay.uploads.get(payload.reference_upload_id)
        path = Path(str(upload.get("path", ""))) if upload else Path()
        if not upload or upload.get("owner") != owner or upload.get("kind") != "audio_reference" or not path.is_file():
            raise HTTPException(status_code=404, detail="unknown_reference_audio")
        reference_audio = path.read_bytes()
        if not reference_audio or len(reference_audio) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="voice_reference_too_large")
        reference_mime = str(upload.get("media_type") or "audio/mpeg")
        reference_mime = {"audio/x-wav": "audio/wav", "audio/m4a": "audio/mp4"}.get(reference_mime, reference_mime)
        if reference_mime not in {"audio/wav", "audio/mpeg", "audio/mp4"}:
            raise HTTPException(status_code=415, detail="voice_reference_type_unsupported")
    if not media_service.configured_for_audio(payload.model):
        raise HTTPException(status_code=503, detail="audio_provider_not_configured")
    if not relay.check_rate_limit(f"audio-ip:{client_ip(request)}") or not relay.check_rate_limit(f"audio-user:{owner}"):
        return JSONResponse({"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
    active = [job for job in relay.database.media_jobs_for(owner, 100) if job["kind"] == "audio" and job["status"] in {"queued", "running"}]
    if len(active) >= 2:
        return JSONResponse({"error": "media_concurrency_limit"}, status_code=429, headers={"Retry-After": "10"})
    job_id = uuid.uuid4().hex
    try:
        quote = relay.charge_audio_credits(owner, payload.model, payload.text)
        request_payload = payload.model_dump(mode="json")
        if reference_audio is not None:
            request_payload["requested_model"] = request_payload["model"]
            request_payload["model"] = "qwen3-tts-vc-2026-01-22"
        request_payload.update(
            charged_credits=quote["total_credits"], unit_credits=quote["unit_credits"],
            billed_quantity=quote["quantity"], pricing_source=quote["pricing_source"],
        )
        media_service.submit_tts(
            owner, job_id, request_payload,
            reference_audio=reference_audio, reference_mime=reference_mime,
        )
    except ValueError as error:
        if str(error) == "media_concurrency_limit":
            return JSONResponse({"error": "media_concurrency_limit"}, status_code=429, headers={"Retry-After": "10"})
        if str(error) == "credits_insufficient":
            return JSONResponse({"error": "credits_insufficient", "credits": relay.credit_summary(owner)}, status_code=402)
        raise
    return JSONResponse(
        {"request_id": job_id, "status": "queued", "status_url": f"/api/v1/audio/jobs/{job_id}", "quote": quote},
        status_code=202,
    )


@router.get("/api/v1/audio/jobs/{job_id}")
async def audio_job(job_id: str, request: Request) -> JSONResponse:
    owner = _session_owner(request)
    result = _public_job(owner, job_id, "audio")
    status_code = 202 if result["status"] in {"queued", "running"} else 200
    if status_code == 202:
        result["status_url"] = f"/api/v1/audio/jobs/{job_id}"
    return JSONResponse(result, status_code=status_code)


@router.get("/api/v1/media/jobs")
async def media_jobs(request: Request, limit: int = Query(default=50, ge=1, le=100)) -> dict[str, Any]:
    owner = _session_owner(request)
    items = relay.database.media_jobs_for(owner, limit)
    for item in items:
        if item["status"] == "completed":
            item["url"] = f"/api/v1/private-media/{item['kind']}/{item['id']}"
    return {"items": items}


@router.post("/api/v1/videos/depth")
async def create_video_depth(
    request: Request,
    video: UploadFile = File(...),
    grayscale: bool = Form(default=True),
    target_fps: int = Form(default=24, ge=6, le=30),
    max_frames: int = Form(default=900, ge=60, le=1800),
) -> JSONResponse:
    """Convert an uploaded video to a temporally consistent depth-map video."""
    owner = _session_owner(request)
    if not video_depth_service.configured:
        raise HTTPException(status_code=503, detail="video_depth_not_configured")
    if video.content_type not in {"video/mp4", "video/quicktime", "video/webm", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="unsupported_video_type")
    if not relay.check_rate_limit(f"depth-ip:{client_ip(request)}") or not relay.check_rate_limit(f"depth-user:{owner}"):
        return JSONResponse({"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
    raw = await video.read(MAX_DEPTH_UPLOAD_BYTES + 1)
    filename = str(video.filename or "").lower()
    await video.close()
    if not raw or len(raw) > MAX_DEPTH_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="video_too_large")
    if not valid_video_signature(raw):
        raise HTTPException(status_code=415, detail="invalid_depth_video")
    suffix = ".webm" if filename.endswith(".webm") else (".mov" if filename.endswith(".mov") else ".mp4")
    job_id = uuid.uuid4().hex
    try:
        billed_seconds = max(1, (max_frames + target_fps - 1) // target_fps)
        quote = relay.charge_video_credits(
            owner, "video-depth-anything-small", "720P", billed_seconds,
            has_video_input=True,
        )
        video_depth_service.submit_upload(
            owner, job_id, raw, suffix,
            grayscale=grayscale, target_fps=target_fps, max_frames=max_frames,
            charged_credits=quote["total_credits"], unit_credits=quote["unit_credits"],
            billed_quantity=quote["quantity"], pricing_source=quote["pricing_source"],
        )
    except ValueError as error:
        if str(error) == "media_concurrency_limit":
            return JSONResponse({"error": "media_concurrency_limit"}, status_code=429, headers={"Retry-After": "15"})
        if str(error) == "credits_insufficient":
            return JSONResponse({"error": "credits_insufficient", "credits": relay.credit_summary(owner)}, status_code=402)
        raise HTTPException(status_code=415, detail=str(error)) from error
    return JSONResponse(
        {"request_id": job_id, "status": "queued", "status_url": f"/api/v1/videos/jobs/{job_id}", "quote": quote},
        status_code=202,
    )


@router.post("/api/v1/videos/tools")
async def run_local_video_tool(
    request: Request,
    video: UploadFile = File(...),
    operation: Literal["extract_frame", "enhance_video", "trim_video", "crop_video"] = Form(...),
    frame_time: float = Form(default=1, ge=0, le=3600),
    start_time: float = Form(default=0, ge=0, le=3600),
    end_time: float = Form(default=5, gt=0, le=3600),
    crop_ratio: Literal["16:9", "9:16", "1:1", "4:3", "3:4"] = Form(default="16:9"),
    enhance_scale: Literal[1.5, 2.0] = Form(default=1.5),
) -> FileResponse:
    """Run deterministic editing operations through the server FFmpeg binary."""
    owner = _session_owner(request)
    if not relay.check_rate_limit(f"video-tool-ip:{client_ip(request)}") or not relay.check_rate_limit(f"video-tool-user:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited", headers={"Retry-After": "60"})
    if video.content_type not in {"video/mp4", "video/quicktime", "video/webm", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="unsupported_video_type")
    raw = await video.read(MAX_DEPTH_UPLOAD_BYTES + 1)
    filename = str(video.filename or "").lower()
    await video.close()
    if not raw or len(raw) > MAX_DEPTH_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="video_too_large")
    if not valid_video_signature(raw):
        raise HTTPException(status_code=415, detail="invalid_video")
    if operation == "trim_video" and end_time <= start_time:
        raise HTTPException(status_code=422, detail="invalid_trim_range")

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(status_code=503, detail="ffmpeg_not_installed")
    workspace = Path(tempfile.mkdtemp(prefix="huiju-video-tool-", dir=UPLOAD_DIR))
    suffix = ".webm" if raw.startswith(b"\x1aE\xdf\xa3") else (".mov" if filename.endswith(".mov") else ".mp4")
    source = workspace / f"source{suffix}"
    source.write_bytes(raw)
    output = workspace / ("frame.png" if operation == "extract_frame" else "edited.mp4")
    common = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    if operation == "extract_frame":
        command = [*common, "-ss", str(frame_time), "-i", str(source), "-frames:v", "1", str(output)]
    elif operation == "enhance_video":
        video_filter = f"scale=trunc(iw*{enhance_scale}/2)*2:trunc(ih*{enhance_scale}/2)*2:flags=lanczos,unsharp=5:5:0.55:3:3:0.25"
        command = [*common, "-i", str(source), "-map", "0:v:0", "-map", "0:a?", "-vf", video_filter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output)]
    elif operation == "trim_video":
        command = [*common, "-ss", str(start_time), "-i", str(source), "-t", str(end_time - start_time), "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output)]
    else:
        ratio = {"16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1.0, "4:3": 4 / 3, "3:4": 3 / 4}[crop_ratio]
        video_filter = f"crop=if(gt(iw/ih\\,{ratio})\\,ih*{ratio}\\,iw):if(gt(iw/ih\\,{ratio})\\,ih\\,iw/{ratio})"
        command = [*common, "-i", str(source), "-map", "0:v:0", "-map", "0:a?", "-vf", video_filter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output)]

    started = time.monotonic()
    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=600)
        if process.returncode != 0 or not output.is_file():
            raise HTTPException(status_code=422, detail=f"video_tool_failed:{stderr.decode('utf-8', 'replace')[-240:]}")
        relay.record_model_usage(
            job_id=uuid.uuid4().hex,
            model="ffmpeg-local",
            operation=operation,
            status="completed",
            resolution="source",
            request_count=1,
            image_count=1 if operation == "extract_frame" else 0,
            credits_charged=0,
            duration_ms=int((time.monotonic() - started) * 1000),
            provider_name="local",
            media_kind="image" if operation == "extract_frame" else "video",
            provider_cost_usd=0,
            pricing_source_override="local_compute",
        )
        return FileResponse(
            output,
            media_type="image/png" if operation == "extract_frame" else "video/mp4",
            filename=output.name,
            headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
            background=BackgroundTask(shutil.rmtree, workspace),
        )
    except BaseException:
        shutil.rmtree(workspace)
        raise
