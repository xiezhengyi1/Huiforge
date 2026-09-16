"""Owner-scoped Video Depth Anything asynchronous inference service.

The service calls the official repository as an argv-only subprocess.  It
never interpolates user values into a shell command and uses the Apache-2.0
Small checkpoint by default, which is the only variant suitable for a
commercial default without a separate model license review.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Callable

from ..core.config import (
    MAX_DEPTH_UPLOAD_BYTES,
    PRIVATE_MEDIA_DIR,
    VIDEO_DEPTH_ENCODER,
    VIDEO_DEPTH_PYTHON,
    VIDEO_DEPTH_REPO,
)
from ..persistence.database import UserDatabase

logger = logging.getLogger("huiju.providers.video_depth")


def valid_video_signature(raw: bytes) -> bool:
    """Accept MP4/MOV and WebM containers without trusting the MIME header."""
    return (len(raw) >= 12 and b"ftyp" in raw[4:16]) or raw.startswith(b"\x1aE\xdf\xa3")


class VideoDepthService:
    def __init__(self, database: UserDatabase, usage_recorder: Callable[..., None] | None = None) -> None:
        self.database = database
        self.usage_recorder = usage_recorder
        self.tasks: set[asyncio.Task[None]] = set()
        self.slot = asyncio.Semaphore(1)

    @property
    def configured(self) -> bool:
        return bool(
            VIDEO_DEPTH_PYTHON.is_file()
            and (VIDEO_DEPTH_REPO / "run.py").is_file()
            and VIDEO_DEPTH_ENCODER in {"vits", "vitb", "vitl"}
        )

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

    def submit_upload(
        self, owner: str, job_id: str, raw: bytes, suffix: str, *,
        grayscale: bool, target_fps: int, max_frames: int,
        charged_credits: int = 0, unit_credits: int = 0, billed_quantity: int = 0,
        pricing_source: str = "",
    ) -> None:
        if not self.configured:
            raise RuntimeError("video_depth_not_configured")
        if not raw or len(raw) > MAX_DEPTH_UPLOAD_BYTES or not valid_video_signature(raw):
            raise ValueError("invalid_depth_video")
        input_dir = PRIVATE_MEDIA_DIR / "depth-input" / owner
        input_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        source = input_dir / f"{job_id}{suffix if suffix in {'.mp4','.mov','.webm'} else '.mp4'}"
        source.write_bytes(raw)
        with contextlib.suppress(OSError):
            source.chmod(0o600)
        payload = {
            "grayscale": grayscale, "target_fps": target_fps, "max_frames": max_frames,
            "charged_credits": charged_credits, "unit_credits": unit_credits,
            "billed_quantity": billed_quantity, "pricing_source": pricing_source,
        }
        try:
            self.database.create_media_job(
                owner, job_id, "video", "video_depth", "video-depth-anything-small", "", payload,
            )
        except Exception:
            with contextlib.suppress(OSError):
                source.unlink()
            raise
        self._track(self._run(owner, job_id, source, payload))

    def submit_existing_video(
        self, owner: str, job_id: str, source_job_id: str, *,
        grayscale: bool, target_fps: int, max_frames: int,
        charged_credits: int = 0, unit_credits: int = 0, billed_quantity: int = 0,
        pricing_source: str = "",
    ) -> None:
        if not self.configured:
            raise RuntimeError("video_depth_not_configured")
        source = self.database.media_path(owner, "video", source_job_id)
        if not source:
            raise ValueError("source_video_not_found")
        payload = {
            "source_job_id": source_job_id, "grayscale": grayscale,
            "target_fps": target_fps, "max_frames": max_frames,
            "charged_credits": charged_credits, "unit_credits": unit_credits,
            "billed_quantity": billed_quantity, "pricing_source": pricing_source,
        }
        self.database.create_media_job(
            owner, job_id, "video", "video_depth", "video-depth-anything-small", "", payload,
        )
        self._track(self._run(owner, job_id, source, payload))

    async def _run(self, owner: str, job_id: str, source: Path, payload: dict[str, Any]) -> None:
        started = time.monotonic()
        output_dir = PRIVATE_MEDIA_DIR / "depth-work" / owner / job_id
        output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.database.update_media_job(job_id, owner, status="running", provider_status="INFERENCE")
        command = [
            str(VIDEO_DEPTH_PYTHON), str(VIDEO_DEPTH_REPO / "run.py"),
            "--input_video", str(source), "--output_dir", str(output_dir),
            "--encoder", VIDEO_DEPTH_ENCODER,
            "--max_len", str(int(payload.get("max_frames") or 900)),
            "--target_fps", str(int(payload.get("target_fps") or 24)),
        ]
        if bool(payload.get("grayscale", True)):
            command.append("--grayscale")
        try:
            async with self.slot:
                process = await asyncio.create_subprocess_exec(
                    *command,
                    cwd=str(VIDEO_DEPTH_REPO),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=1800)
            if process.returncode != 0:
                logger.warning(
                    "Video depth failed job_id=%s rc=%s stderr=%s",
                    job_id, process.returncode, stderr.decode("utf-8", "replace")[-500:],
                )
                raise RuntimeError("video_depth_inference_failed")
            candidates = sorted(
                (item for item in output_dir.rglob("*") if item.is_file() and item.suffix.lower() in {".mp4", ".webm"}),
                # The official runner also writes a processed source preview.
                # Always select *_vis.* (the actual depth map) before falling
                # back to modification time for future output-name revisions.
                key=lambda item: ("_vis" in item.stem.lower(), item.stat().st_mtime),
                reverse=True,
            )
            if not candidates:
                raise ValueError("video_depth_output_missing")
            raw = candidates[0].read_bytes()
            if len(raw) > MAX_DEPTH_UPLOAD_BYTES or not valid_video_signature(raw):
                raise ValueError("video_depth_output_invalid")
            destination_dir = PRIVATE_MEDIA_DIR / "videos" / owner
            destination_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
            suffix = ".webm" if raw.startswith(b"\x1aE\xdf\xa3") else ".mp4"
            destination = destination_dir / f"{job_id}{suffix}"
            destination.write_bytes(raw)
            with contextlib.suppress(OSError):
                destination.chmod(0o600)
            media_path = destination.relative_to(PRIVATE_MEDIA_DIR).as_posix()
            mime = "video/webm" if suffix == ".webm" else "video/mp4"
            self.database.update_media_job(
                job_id, owner, status="completed", provider_status="SUCCEEDED",
                media_path=media_path, mime_type=mime,
            )
            if self.usage_recorder:
                self.usage_recorder(
                    job_id=job_id, model="video-depth-anything-small", operation="video_depth",
                    status="completed", resolution="source", request_count=1, image_count=0,
                    credits_charged=int(payload.get("charged_credits") or 0), duration_ms=int((time.monotonic() - started) * 1000),
                    provider_name="local", media_kind="video",
                )
            logger.info("Video depth completed job_id=%s output=%s", job_id, candidates[0].name)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self.database.update_media_job(job_id, owner, status="failed", error=type(error).__name__)
            if self.usage_recorder:
                self.usage_recorder(
                    job_id=job_id, model="video-depth-anything-small", operation="video_depth",
                    status="failed", resolution="source", request_count=1, image_count=0,
                    credits_charged=int(payload.get("charged_credits") or 0), duration_ms=int((time.monotonic() - started) * 1000),
                    error_code=type(error).__name__, provider_name="local", media_kind="video",
                )
        finally:
            shutil.rmtree(output_dir, ignore_errors=True)
            if source.parent.name == owner and source.parent.parent.name == "depth-input":
                with contextlib.suppress(OSError):
                    source.unlink()
