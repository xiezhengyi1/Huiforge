"""Persistent, sequential storyboard generation and local video composition."""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from pathlib import Path
import shutil
import tempfile
from typing import Any
import uuid

from fastapi import HTTPException

from ..api.schemas import StoryboardComposeInput, StoryboardGenerationInput
from ..catalog.pricing import member_exclusive, membership_active, video_quote
from ..core.config import MEDIA_WORKER_ENABLED

logger = logging.getLogger("huiju.storyboard")


class StoryboardError(Exception):
    """A public, fixed error code without provider response or filesystem data."""


class StoryboardService:
    def __init__(self, relay: Any, media_service: Any) -> None:
        self.relay = relay
        self.media_service = media_service
        self.tasks: set[asyncio.Task[None]] = set()
        self.poll_seconds = 1.0

    @property
    def database(self):
        return self.relay.database

    def quote(self, owner: str, payload: StoryboardGenerationInput) -> dict[str, Any]:
        wallet = self.relay.wallet_for(owner)
        member = membership_active(wallet)
        if member_exclusive(payload.model) and not member:
            raise HTTPException(status_code=403, detail="paid_plan_required")
        shots = []
        for index, shot in enumerate(payload.shots, 1):
            quote = video_quote(payload.model, payload.resolution, shot.duration, False, member=member)
            shots.append({"index": index, "duration": shot.duration, "credits": quote["total_credits"], **quote})
        return {"total_credits": sum(shot["credits"] for shot in shots), "shots": shots, "composition_credits": 0}

    def _video_active(self, owner: str) -> bool:
        return any(job["kind"] == "video" and job["status"] in {"queued", "running"}
                   for job in self.database.media_jobs_for(owner, 100))

    @staticmethod
    def _require_ffmpeg() -> None:
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            raise HTTPException(status_code=503, detail="ffmpeg_not_available")

    def submit(self, owner: str, payload: StoryboardGenerationInput) -> dict[str, Any]:
        self._require_ffmpeg()
        if not MEDIA_WORKER_ENABLED or not self.media_service.configured_for_video(payload.model):
            raise HTTPException(status_code=503, detail="storyboard_video_not_configured")
        if self._video_active(owner):
            raise HTTPException(status_code=429, detail="media_concurrency_limit")
        quote = self.quote(owner, payload)
        if self.relay.credit_summary(owner)["total"] < quote["total_credits"]:
            raise HTTPException(status_code=402, detail="credits_insufficient")
        shots = [{"index": index, "prompt": shot.prompt, "duration": shot.duration,
                  "credits": quote["shots"][index - 1]["credits"], "status": "pending", "job_id": ""}
                 for index, shot in enumerate(payload.shots, 1)]
        return self._submit(owner, payload.title, {"mode": "generate", **payload.model_dump()}, quote, shots)

    def submit_compose(self, owner: str, payload: StoryboardComposeInput) -> dict[str, Any]:
        self._require_ffmpeg()
        shots = []
        for index, job_id in enumerate(payload.job_ids, 1):
            job = self.database.media_job(owner, job_id)
            if not job or job["kind"] != "video":
                raise HTTPException(status_code=404, detail="media_job_not_found")
            if job["status"] != "completed" or self.database.media_path(owner, "video", job_id) is None:
                raise HTTPException(status_code=422, detail="storyboard_video_not_completed")
            shots.append({"index": index, "job_id": job_id, "prompt": job["prompt"],
                          "duration": job["billed_quantity"], "credits": 0, "status": "completed"})
        if self._video_active(owner):
            raise HTTPException(status_code=429, detail="media_concurrency_limit")
        quote = {"total_credits": 0, "composition_credits": 0,
                 "shots": [{"index": shot["index"], "credits": 0, "duration": shot["duration"]} for shot in shots]}
        return self._submit(owner, payload.title, {"mode": "compose", **payload.model_dump()}, quote, shots)

    def _submit(self, owner: str, title: str, payload: dict[str, Any], quote: dict[str, Any],
                shots: list[dict[str, Any]]) -> dict[str, Any]:
        job_id = uuid.uuid4().hex
        try:
            self.database.create_storyboard_job(owner, job_id, title, payload, quote, shots, uuid.uuid4().hex)
        except ValueError as error:
            if str(error) == "storyboard_concurrency_limit":
                raise HTTPException(status_code=429, detail=str(error)) from error
            raise
        self._track(self._run(self.database.storyboard_job(owner, job_id), allow_submission=True))
        return {"job_id": job_id, "status": "queued", "status_url": f"/api/v1/storyboards/jobs/{job_id}", "quote": quote}

    def get(self, owner: str, job_id: str) -> dict[str, Any]:
        record = self.database.storyboard_job(owner, job_id)
        if record is None:
            raise HTTPException(status_code=404, detail="storyboard_job_not_found")
        shots = record["shots"]
        completed = sum(shot["status"] == "completed" for shot in shots)
        result = {"job_id": record["id"], "title": record["title"], "status": record["status"],
                  "phase": record["phase"], "total_shots": len(shots), "completed_shots": completed,
                  "current_shot": min(completed + 1, len(shots)), "shots": shots, "quote": record["quote"],
                  "created_at": record["created_at"], "updated_at": record["updated_at"]}
        if record["status"] == "completed":
            result["url"] = f"/api/v1/private-media/video/{record['output_job_id']}"
        if record["error"]:
            result["error"] = record["error"]
        return result

    def _track(self, coroutine: Any) -> None:
        task = asyncio.create_task(coroutine)
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def start(self) -> None:
        for record in self.database.recoverable_storyboard_jobs():
            self._track(self._run(record, allow_submission=False))

    async def stop(self) -> None:
        tasks = list(self.tasks)
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task

    def _save(self, record: dict[str, Any], phase: str, *, status: str = "running", error: str = "") -> None:
        self.database.update_storyboard_job(record["owner_id"], record["id"], status=status,
                                            phase=phase, shots=record["shots"], error=error)

    async def _wait_shot(self, record: dict[str, Any], shot: dict[str, Any]) -> None:
        while True:
            job = self.database.media_job(record["owner_id"], shot["job_id"])
            if job is None:
                raise StoryboardError("storyboard_submission_interrupted")
            shot["status"] = job["status"]
            self._save(record, "generating")
            if job["status"] == "failed":
                shot["error"] = "storyboard_provider_arrearage" if job["error"] == "http_400:Arrearage" else "storyboard_shot_failed"
                raise StoryboardError(shot["error"])
            if job["status"] == "completed":
                return
            await asyncio.sleep(self.poll_seconds)

    async def _run(self, record: dict[str, Any], *, allow_submission: bool) -> None:
        owner = record["owner_id"]
        try:
            if record["payload"]["mode"] == "generate":
                for shot in record["shots"]:
                    if not shot["job_id"]:
                        if not allow_submission:
                            raise StoryboardError("storyboard_submission_interrupted")
                        if self._video_active(owner):
                            raise StoryboardError("media_concurrency_limit")
                        shot.update(job_id=uuid.uuid4().hex, status="submitting")
                        self._save(record, "generating")
                        quote = record["quote"]["shots"][shot["index"] - 1]
                        try:
                            self.database.charge_wallet(owner, quote["credits"], ["daily", "monthly", "topup"],
                                                        f"分镜 {shot['index']} · {record['payload']['model']} · {shot['duration']} 秒")
                        except ValueError as error:
                            if str(error) == "credits_insufficient":
                                raise StoryboardError("credits_insufficient") from error
                            raise
                        payload = {"operation": "text_to_video", "model": record["payload"]["model"],
                                   "resolution": record["payload"]["resolution"], "ratio": record["payload"]["ratio"],
                                   "duration": shot["duration"], "prompt": shot["prompt"], "media_urls": [], "media_types": [],
                                   "charged_credits": quote["credits"], "unit_credits": quote["unit_credits"],
                                   "billed_quantity": quote["quantity"], "provider_cost_cny": quote["provider_cost_cny"],
                                   "pricing_source": quote["pricing_source"]}
                        self.media_service.submit_video(owner, shot["job_id"], payload)
                    await self._wait_shot(record, shot)
            self._save(record, "composing")
            await self._compose(record)
            self._save(record, "completed", status="completed")
        except StoryboardError as error:
            self._save(record, "failed", status="failed", error=str(error))
        except Exception:
            logger.exception("Storyboard execution failed")
            self._save(record, "failed", status="failed", error="storyboard_execution_failed")

    async def _process(self, *command: str) -> bytes:
        process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        try:
            output, _ = await asyncio.wait_for(process.communicate(), timeout=600)
            if process.returncode:
                raise StoryboardError("storyboard_compose_failed")
            return output
        finally:
            if process.returncode is None:
                process.kill()
                await process.wait()

    async def _signature(self, path: Path) -> list[dict[str, Any]]:
        data = json.loads(await self._process("ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,codec_name,width,height,pix_fmt,sample_aspect_ratio,r_frame_rate,time_base,sample_rate,channels,channel_layout",
            "-of", "json", str(path)))
        streams = data["streams"]
        if sum(stream["codec_type"] == "video" for stream in streams) != 1 or sum(stream["codec_type"] == "audio" for stream in streams) > 1:
            raise StoryboardError("storyboard_clip_specs_mismatch")
        return streams

    async def _compose(self, record: dict[str, Any]) -> None:
        owner, output_id = record["owner_id"], record["output_job_id"]
        output_job = self.database.media_job(owner, output_id)
        if output_job is not None and output_job["status"] == "completed":
            return
        paths = [self.database.media_path(owner, "video", shot["job_id"]) for shot in record["shots"]]
        if any(path is None for path in paths):
            raise StoryboardError("storyboard_video_not_completed")
        signatures = [await self._signature(path) for path in paths]
        if any(signature != signatures[0] for signature in signatures[1:]):
            raise StoryboardError("storyboard_clip_specs_mismatch")
        if output_job is None:
            if self._video_active(owner):
                raise StoryboardError("media_concurrency_limit")
            self.database.create_media_job(owner, output_id, "video", "storyboard_compose", "ffmpeg-local", record["title"], {})
        self.database.update_media_job(output_id, owner, status="running", error="")
        directory = self.database.private_media_dir / "videos" / owner
        directory.mkdir(parents=True, exist_ok=True)
        output = directory / f"{output_id}.mp4"
        try:
            with tempfile.TemporaryDirectory(prefix="storyboard-", dir=directory) as workspace:
                manifest = Path(workspace) / "clips.txt"
                manifest.write_text("".join("file '" + path.as_posix().replace("'", "'\\''") + "'\n" for path in paths), encoding="utf-8")
                await self._process("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest),
                                    "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(output))
        except Exception:
            self.database.update_media_job(output_id, owner, status="failed", error="storyboard_compose_failed")
            raise
        self.database.update_media_job(output_id, owner, status="completed", mime_type="video/mp4",
                                        media_path=output.relative_to(self.database.private_media_dir).as_posix())
