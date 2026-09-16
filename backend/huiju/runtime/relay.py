"""Generation queues, GPU scheduling, provider execution and usage accounting."""
from __future__ import annotations

import asyncio
import base64
import contextlib
import hashlib
import hmac
import io
import json
import logging
import os
import re
import secrets
import shutil
import sqlite3
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from .gpu_scheduler import HIGH_RESOLUTIONS, SingleGpuScheduler, dimensions_for_ratio

from ..catalog.models import *
from ..core.config import *
from ..persistence.database import UserDatabase
from ..catalog.pricing import USD_CNY_RATE, audio_quote, image_quote, member_exclusive, membership_active, video_quote

logger = logging.getLogger("huiju.relay")

class RelayState:
    def __init__(self) -> None:
        self.queue: asyncio.Queue[str] = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)
        self.jobs: dict[str, dict[str, Any]] = {}
        self.uploads: dict[str, dict[str, Any]] = {}
        self.feedback_uploads: dict[str, dict[str, Any]] = {}
        self.idempotency: dict[tuple[str, str], str] = {}
        self.rate_windows: dict[str, deque[float]] = defaultdict(deque)
        self.sms_last_sent: dict[str, float] = {}
        self.workers: list[asyncio.Task[None]] = []
        self.warmup_task: asyncio.Task[None] | None = None
        self.client: httpx.AsyncClient | None = None
        self.google_client: httpx.AsyncClient | None = None
        self.owner_cache: dict[str, str] = {}
        self.membership_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self.vision_slots = asyncio.Semaphore(VISION_ANALYSIS_CONCURRENCY)
        self.gpu = SingleGpuScheduler(BASE_DIR, GENERATED_DIR)
        self.database = UserDatabase(USER_DB_FILE, PRIVATE_MEDIA_DIR)

    def owner_for_device(self, device_id: str) -> str:
        """Return bound user id if device is bound, otherwise device_id."""
        cached = self.owner_cache.get(device_id)
        if cached is not None:
            return cached
        owner = self.database.owner_for_device(device_id)
        self.owner_cache[device_id] = owner
        if len(self.owner_cache) > 100_000:
            self.owner_cache.pop(next(iter(self.owner_cache)))
        return owner

    @staticmethod
    def _password_hash(password: str, salt: bytes | None = None) -> str:
        salt = salt or secrets.token_bytes(16)
        digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
        return f"scrypt${salt.hex()}${digest.hex()}"

    @classmethod
    def _password_matches(cls, password: str, encoded: str) -> bool:
        try:
            scheme, salt_hex, expected_hex = encoded.split("$", 2)
            if scheme != "scrypt":
                return False
            actual = cls._password_hash(password, bytes.fromhex(salt_hex)).split("$", 2)[2]
            return hmac.compare_digest(actual, expected_hex)
        except (ValueError, TypeError):
            return False

    def register_user(self, device_id: str, phone: str, password: str, display_name: str) -> str:
        if self.database.phone_exists(phone):
            raise ValueError("phone_exists")
        old_owner = self.owner_for_device(device_id)
        try:
            user_id = self.database.register_user(device_id, phone, self._password_hash(password), display_name)
        except sqlite3.IntegrityError as error:
            raise ValueError("phone_exists") from error
        self._migrate_runtime_owner(old_owner, user_id)
        self.owner_cache[device_id] = user_id
        self.membership_cache.pop(user_id, None)
        return user_id

    def login_user(self, device_id: str, phone: str, password: str) -> str:
        match = self.database.login_user(device_id, phone)
        if not match or not self._password_matches(password, match[1]):
            raise ValueError("invalid_credentials")
        user_id = match[0]
        old_owner = self.owner_for_device(device_id)
        self.database.bind_session(device_id, user_id)
        self._migrate_runtime_owner(old_owner, user_id)
        self.owner_cache[device_id] = user_id
        self.membership_cache.pop(user_id, None)
        return user_id

    def logout_user(self, device_id: str) -> None:
        self.database.logout_user(device_id)
        self.owner_cache[device_id] = device_id

    def public_user(self, user_id: str) -> dict[str, Any]:
        return self.database.public_user(user_id)

    def record_history(self, owner: str, images: list[dict[str, str]], prompt: str, kind: str) -> None:
        if not self.database.user_exists(owner):
            return
        now = time.time()
        for image in images:
            url = image.get("url") if isinstance(image, dict) else None
            if isinstance(url, str):
                history_id = uuid.uuid4().hex
                try:
                    source = generated_path_from_url(url.split("?", 1)[0]).resolve(strict=True)
                    source.relative_to(GENERATED_DIR.resolve())
                    destination_dir = PRIVATE_MEDIA_DIR / "histories" / owner
                    destination_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
                    destination = destination_dir / f"{history_id}{source.suffix.lower()}"
                    shutil.copy2(source, destination)
                    destination.chmod(0o600)
                    media_path = destination.relative_to(PRIVATE_MEDIA_DIR).as_posix()
                except (OSError, ValueError):
                    logger.warning("Could not persist history image owner=%s", owner)
                    continue
                self.database.add_history(owner, history_id, media_path, prompt, kind, now)
                image["history_url"] = f"/api/v1/private-media/history/{history_id}"

    @staticmethod
    def _china_day() -> str:
        return datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

    @staticmethod
    def _china_month() -> str:
        return datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m")

    def wallet_for(self, owner: str) -> dict[str, Any]:
        return self.database.wallet_for(owner, DAILY_CREDITS)

    def membership_for(self, owner: str) -> dict[str, Any]:
        now = time.monotonic()
        cached = self.membership_cache.get(owner)
        if cached and now - cached[0] < 10:
            return cached[1]
        membership = self.database.membership_for(owner)
        self.membership_cache[owner] = (now, membership)
        if len(self.membership_cache) > 100_000:
            self.membership_cache.pop(next(iter(self.membership_cache)))
        return membership

    def credit_summary(self, owner: str) -> dict[str, Any]:
        if not self.database.user_exists(owner):
            return {
                "daily": DAILY_CREDITS, "monthly": 0, "topup": 0, "total": DAILY_CREDITS,
                "daily_expires": "今日 24:00", "monthly_expires": "本月末",
                "topup_expires": "充值后 24 个月", "daily_grant": DAILY_CREDITS,
                "membership_tier": "free", "membership_expires_at": None, "ledger": [],
            }
        wallet = self.wallet_for(owner)
        return {
            "daily": wallet["daily"], "monthly": wallet["monthly"], "topup": wallet["topup"],
            "total": wallet["daily"] + wallet["monthly"] + wallet["topup"],
            "daily_expires": "今日 24:00", "monthly_expires": "本月末", "topup_expires": "充值后 24 个月",
            "daily_grant": DAILY_CREDITS, "membership_tier": wallet["membership_tier"],
            "membership_expires_at": wallet["membership_expires_at"], "ledger": wallet["ledger"][:100],
        }

    def charge_credits(
        self, owner: str, model: str, count: int, resolution: str, quality: str = "standard",
    ) -> int:
        # Qwen-Image-2512 is a permanently free route. Its abuse protection is
        # request-rate based, so it must never touch wallet or daily-free state.
        if model == "qwen_image":
            return 0
        wallet = self.wallet_for(owner)
        member = membership_active(wallet)
        if member_exclusive(model) and not member:
            raise ValueError("paid_plan_required")
        quote = image_quote(model, resolution, count=count, member=member, quality=quality)
        total = int(quote["total_credits"])
        allowed_buckets = ["daily", "monthly", "topup"]
        self.database.charge_wallet(
            owner, total, allowed_buckets,
            f"{MODELS.get(model, {}).get('label', model)} · {resolution} × {count}",
            mark_free_image=not member,
        )
        return total

    def quote_image_credits(
        self, owner: str, model: str, count: int, resolution: str, reference_count: int = 0,
        quality: str = "standard",
    ) -> dict[str, Any]:
        return image_quote(
            model, resolution, count=count,
            member=membership_active(self.wallet_for(owner)), reference_count=reference_count,
            quality=quality,
        )

    def charge_image_tool_credits(
        self, owner: str, model: str, resolution: str, *, output_count: int = 1,
        reference_count: int = 0, operation: str = "edit", quality: str = "standard",
    ) -> dict[str, Any]:
        wallet = self.wallet_for(owner)
        member = membership_active(wallet)
        if member_exclusive(model) and not member:
            raise ValueError("paid_plan_required")
        quote = image_quote(
            model, resolution, count=output_count, member=member,
            reference_count=reference_count, quality=quality,
        )
        self.database.charge_wallet(
            owner, int(quote["total_credits"]), ["daily", "monthly", "topup"],
            f"{model} · {operation} · {resolution} × {output_count}",
        )
        return quote

    def charge_video_credits(
        self, owner: str, model: str, resolution: str, duration: int,
        *, has_video_input: bool, input_video_seconds: int = 0,
    ) -> dict[str, Any]:
        wallet = self.wallet_for(owner)
        if member_exclusive(model) and not membership_active(wallet):
            raise ValueError("paid_plan_required")
        quote = video_quote(
            model, resolution, duration, has_video_input, input_video_seconds=input_video_seconds,
            member=membership_active(wallet),
        )
        self.database.charge_wallet(
            owner, int(quote["total_credits"]), ["daily", "monthly", "topup"],
            f"{model} · {resolution} · {quote['quantity']} 秒",
        )
        return quote

    def charge_audio_credits(self, owner: str, model: str, text: str) -> dict[str, Any]:
        wallet = self.wallet_for(owner)
        if member_exclusive(model) and not membership_active(wallet):
            raise ValueError("paid_plan_required")
        quote = audio_quote(model, text, member=membership_active(wallet))
        self.database.charge_wallet(
            owner, int(quote["total_credits"]), ["daily", "monthly", "topup"],
            f"{model} · 预估 {quote['quantity']} 秒",
        )
        return quote

    def _migrate_runtime_owner(self, old_owner: str, new_owner: str) -> None:
        for job in self.jobs.values():
            if job.get("owner") == old_owner:
                job["owner"] = new_owner
        for upload in self.uploads.values():
            if upload.get("owner") == old_owner:
                upload["owner"] = new_owner
        for (owner, key), job_id in list(self.idempotency.items()):
            if owner == old_owner:
                self.idempotency.pop((owner, key), None)
                self.idempotency[(new_owner, key)] = job_id

    def record_model_usage(
        self,
        *,
        job_id: str,
        model: str,
        operation: str,
        status: str,
        resolution: str,
        request_count: int,
        image_count: int,
        credits_charged: int,
        duration_ms: int,
        provider_usage: Any = None,
        error_code: str | None = None,
        provider_name: str | None = None,
        media_kind: str = "image",
        provider_cost_usd: float | None = None,
        pricing_source_override: str | None = None,
    ) -> None:
        cfg = MODELS.get(model, {})
        provider = str(provider_name or cfg.get("provider") or "local")
        usage = normalized_provider_usage(provider_usage)
        estimated_cost, pricing_source = estimated_provider_cost_usd(model, resolution, image_count, usage)
        if provider_cost_usd is not None:
            estimated_cost = round(max(0.0, float(provider_cost_usd)), 8)
            pricing_source = str(pricing_source_override or "provider_rate_card")
        event = {
            "event_id": uuid.uuid4().hex,
            "created_at": time.time(),
            "job_id": job_id,
            "model": model,
            "model_label": str(cfg.get("label") or model),
            "provider": provider,
            "billing_category": "local_compute" if provider == "local" else f"{provider}_api",
            "operation": operation,
            "status": status,
            "resolution": resolution,
            "request_count": max(0, int(request_count)),
            "image_count": max(0, int(image_count)),
            "credits_charged": max(0, int(credits_charged)),
            "provider_cost_usd": estimated_cost,
            "pricing_source": pricing_source,
            "provider_usage": usage,
            "media_kind": media_kind,
            "duration_ms": max(0, int(duration_ms)),
            "error_code": str(error_code or "")[:80],
        }
        try:
            MODEL_USAGE_FILE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with MODEL_USAGE_FILE.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")
            with contextlib.suppress(OSError):
                os.chmod(MODEL_USAGE_FILE, 0o600)
        except OSError:
            logger.exception("Could not persist model usage job_id=%s model=%s", job_id, model)

    def model_usage_events(self) -> list[dict[str, Any]]:
        try:
            lines = MODEL_USAGE_FILE.read_text(encoding="utf-8").splitlines()
        except OSError:
            return []
        events: list[dict[str, Any]] = []
        for line in lines[-100_000:]:
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if isinstance(event, dict):
                events.append(event)
        return events

    async def start(self) -> None:
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(UPSTREAM_TIMEOUT_SECONDS, connect=3.0),
            follow_redirects=False,
            trust_env=False,
        )
        # Compshare exposes public Internet access through its managed HTTPS
        # proxy. Keep the proxy opt-in limited to Google rather than changing
        # the networking behaviour of local SGLang and the other providers.
        self.google_client = httpx.AsyncClient(
            timeout=httpx.Timeout(UPSTREAM_TIMEOUT_SECONDS, connect=10.0),
            follow_redirects=False,
            trust_env=True,
        )
        self.workers = [asyncio.create_task(self.worker(index)) for index in range(WORKER_CONCURRENCY)]
        if GPU_WARMUP_ENABLED:
            self.warmup_task = asyncio.create_task(self.gpu.warm_defaults(), name="default-model-warmup")
    async def stop(self) -> None:
        if self.warmup_task:
            self.warmup_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.warmup_task
        for task in self.workers:
            task.cancel()
        for task in self.workers:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        if self.client:
            await self.client.aclose()
        if self.google_client:
            await self.google_client.aclose()
        await self.gpu.shutdown()

    def prune(self) -> None:
        now = time.time()
        monotonic_now = time.monotonic()
        for job_id, job in list(self.jobs.items()):
            if job["status"] in {"completed", "failed", "cancelled"} and now - job["updated_at"] > JOB_TTL_SECONDS:
                self.jobs.pop(job_id, None)
        for key, job_id in list(self.idempotency.items()):
            if job_id not in self.jobs and not self.database.media_job(key[0], job_id):
                self.idempotency.pop(key, None)
        for upload_id, upload in list(self.uploads.items()):
            upload_path = upload.get("path")
            if now - upload.get("updated_at", now) > UPLOAD_TTL_SECONDS:
                if isinstance(upload_path, Path):
                    with contextlib.suppress(OSError):
                        upload_path.unlink()
                self.uploads.pop(upload_id, None)
        for upload_id, upload in list(self.feedback_uploads.items()):
            upload_path = upload.get("path")
            if now - upload.get("updated_at", now) > UPLOAD_TTL_SECONDS:
                if isinstance(upload_path, Path):
                    with contextlib.suppress(OSError):
                        upload_path.unlink()
                self.feedback_uploads.pop(upload_id, None)
        for ip, window in list(self.rate_windows.items()):
            while window and monotonic_now - window[0] >= 60:
                window.popleft()
            if not window:
                self.rate_windows.pop(ip, None)
        for image_path in GENERATED_DIR.rglob("*"):
            if not image_path.is_file() or image_path.suffix.lower() not in {".png", ".jpg", ".webp"}:
                continue
            try:
                relative = image_path.relative_to(GENERATED_DIR)
            except ValueError:
                continue
            if relative.parts and relative.parts[0] in {"avatars", "users", "assets", "skill-covers"}:
                continue
            with contextlib.suppress(OSError):
                if now - image_path.stat().st_mtime > IMAGE_TTL_SECONDS:
                    image_path.unlink()

    def check_rate_limit(self, ip: str, *, limit: int | None = None) -> bool:
        now = time.monotonic()
        window = self.rate_windows[ip]
        while window and now - window[0] >= 60:
            window.popleft()
        request_limit = MAX_REQUESTS_PER_MINUTE if limit is None else max(1, int(limit))
        if len(window) >= request_limit:
            return False
        window.append(now)
        return True

    async def worker(self, worker_id: int) -> None:
        while True:
            job_id = await self.queue.get()
            try:
                job = self.jobs.get(job_id)
                if job is not None and job.get("status") != "cancelled":
                    await self.execute(job_id, job)
            except Exception:
                logger.exception("Unexpected job worker failure job_id=%s worker=%s", job_id, worker_id)
            finally:
                self.queue.task_done()

    async def execute(self, job_id: str, job: dict[str, Any]) -> None:
        payload = job.get("payload")
        if not isinstance(payload, dict):
            job.update(status="failed", error="invalid_payload", updated_at=time.time())
            return
        if payload.get("kind") == "tool":
            await self.generate_tool(job_id, job)
            return
        await self.generate_text(job_id, job)

    async def generate_text(self, job_id: str, job: dict[str, Any]) -> None:
        assert self.client is not None
        if job.get("status") == "cancelled":
            return
        payload = job.pop("payload")
        model = payload["model"]
        started = time.monotonic()
        job["status"] = "running"
        job["updated_at"] = time.time()

        if model not in MODELS:
            job.update(status="failed", error="model_unavailable", updated_at=time.time())
            return

        if MODELS[model].get("api"):
            await self.generate_api(job_id, job, payload)
            return

        native_resolution = "1k" if payload["resolution"] in HIGH_RESOLUTIONS else payload["resolution"]
        width, height = dimensions_for_ratio(payload["aspect_ratio"], native_resolution)

        quality_steps = TURBO_QUALITY_STEPS if model == "zimage_turbo" else QUALITY_STEPS
        upstream_payload = {
            "prompt": generation_prompt_for(payload),
            "size": f"{width}x{height}",
            "num_inference_steps": quality_steps[payload["quality"]],
            "response_format": "b64_json",
        }
        try:
            async def call_zimage() -> list[dict[str, str]]:
                # Z-Image's SGLang endpoint accepts one caption embedding per
                # request. Submit multi-image selections as independent jobs
                # with deterministic distinct seeds instead of OpenAI's `n`.
                images: list[dict[str, str]] = []
                for index in range(payload["count"]):
                    response = await self.client.post(
                        f"{MODELS[model]['base_url']}/v1/images/generations",
                        json={**upstream_payload, "seed": (payload["seed"] + index) % (2**31)},
                    )
                    response.raise_for_status()
                    images.extend(self.persist_images(job_id, response.json().get("data"), start_index=index, limit=1))
                return images

            images = await self.gpu.run_flux(call_zimage)
            if not images:
                raise ValueError("upstream returned no valid image data")
            if payload["resolution"] in HIGH_RESOLUTIONS:
                source_paths = [generated_path_from_url(image["url"]) for image in images]
                result_paths = await self.gpu.upscale_paths(source_paths, payload["resolution"])
                images = public_images(result_paths)
            job.update(status="completed", images=images, updated_at=time.time())
            self.record_history(job.get("owner", ""), images, payload["prompt"], model)
            self.record_model_usage(
                job_id=job_id, model=model, operation="text_to_image", status="completed",
                resolution=payload["resolution"], request_count=payload["count"], image_count=len(images),
                credits_charged=int(job.get("charged_credits") or 0),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            logger.info("Generation completed job_id=%s model=%s quality=%s resolution=%s", job_id, model, payload["quality"], payload["resolution"])
        except (httpx.HTTPError, ValueError, TypeError, KeyError, RuntimeError) as error:
            job.update(status="failed", error="generation_failed", updated_at=time.time())
            self.record_model_usage(
                job_id=job_id, model=model, operation="text_to_image", status="failed",
                resolution=payload.get("resolution", "720p"), request_count=payload.get("count", 1), image_count=0,
                credits_charged=int(job.get("charged_credits") or 0),
                duration_ms=int((time.monotonic() - started) * 1000), error_code=type(error).__name__,
            )
            logger.warning("Generation failed job_id=%s model=%s type=%s", job_id, model, type(error).__name__)

    async def generate_tool(self, job_id: str, job: dict[str, Any]) -> None:
        payload = job.pop("payload")
        started = time.monotonic()
        usage_model = str(payload.get("model") or "bailian_wan_2_7")
        if job.get("status") == "cancelled":
            return
        upload = self.uploads.get(payload["upload_id"])
        if not upload or upload.get("owner") != job.get("owner"):
            job.update(status="failed", error="source_image_missing", updated_at=time.time())
            return
        source = upload.get("path")
        if not isinstance(source, Path) or not source.is_file():
            job.update(status="failed", error="source_image_missing", updated_at=time.time())
            return
        job["status"] = "running"
        job["updated_at"] = time.time()
        try:
            reference_uploads: list[dict[str, Any]] = []
            for reference_id in payload.get("reference_upload_ids") or []:
                reference = self.uploads.get(reference_id)
                reference_path = reference.get("path") if reference else None
                if (
                    not reference
                    or reference.get("owner") != job.get("owner")
                    or not isinstance(reference_path, Path)
                    or not reference_path.is_file()
                ):
                    raise ValueError("reference_image_missing")
                reference_uploads.append(reference)
            mask_path: Path | None = None
            if payload.get("mask_upload_id"):
                mask = self.uploads.get(payload["mask_upload_id"])
                candidate = mask.get("path") if mask else None
                if isinstance(candidate, Path):
                    mask_path = candidate
            if payload["operation"] == "upscale":
                # The upscaler writes next to its input, so first move a private
                # copy into this job's generated directory.  This also keeps an
                # uploaded source from being exposed directly.
                output_dir = GENERATED_DIR / job_id
                output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
                staged = output_dir / "source.png"
                shutil.copy2(source, staged)
                target_resolution = payload["resolution"] if payload["resolution"] in HIGH_RESOLUTIONS else "2k"
                paths = await self.gpu.upscale_paths([staged], target_resolution)
            elif payload["operation"] == "cutout":
                output_dir = GENERATED_DIR / job_id
                output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
                output = output_dir / "cutout.png"
                paths = [await self.gpu.remove_background(source, output)]
            else:
                images = await self.generate_api_tool(job_id, payload, source, mask_path, upload, reference_uploads)
                job.update(status="completed", images=images, updated_at=time.time())
                self.record_history(job.get("owner", ""), images, payload.get("user_prompt", ""), payload.get("model", payload["operation"]))
                provider_usage_fields: dict[str, Any] = {}
                if usage_model == "gpt_image":
                    output_count = payload.get("views", 1) if payload.get("operation") == "multiview" else 1
                    provider_quote = image_quote(
                        usage_model,
                        payload.get("resolution", "720p"),
                        count=output_count,
                        reference_count=1 + len(reference_uploads),
                        quality=payload.get("quality", "standard"),
                    )
                    provider_usage_fields = {
                        "provider_name": "fal",
                        "provider_cost_usd": provider_quote["provider_cost_cny"] / USD_CNY_RATE,
                        "pricing_source_override": provider_quote["pricing_source"],
                    }
                self.record_model_usage(
                    job_id=job_id, model=usage_model, operation=payload["operation"], status="completed",
                    resolution=payload.get("resolution", "720p"), request_count=1, image_count=len(images),
                    credits_charged=int(job.get("charged_credits") or 0),
                    duration_ms=int((time.monotonic() - started) * 1000),
                    **provider_usage_fields,
                )
                logger.info("Cloud image tool completed job_id=%s operation=%s model=%s", job_id, payload["operation"], payload.get("model"))
                return
            images = public_images(paths)
            job.update(status="completed", images=images, updated_at=time.time())
            self.record_history(job.get("owner", ""), images, payload.get("user_prompt", ""), payload["operation"])
            self.record_model_usage(
                job_id=job_id, model=usage_model, operation=payload["operation"], status="completed",
                resolution=payload.get("resolution", "720p"), request_count=1, image_count=len(images),
                credits_charged=int(job.get("charged_credits") or 0),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            logger.info("Image tool completed job_id=%s operation=%s", job_id, payload["operation"])
        except Exception as error:
            job.update(status="failed", error="image_tool_failed", updated_at=time.time())
            self.record_model_usage(
                job_id=job_id, model=usage_model, operation=payload.get("operation", "image_tool"), status="failed",
                resolution=payload.get("resolution", "720p"), request_count=1, image_count=0,
                credits_charged=int(job.get("charged_credits") or 0),
                duration_ms=int((time.monotonic() - started) * 1000), error_code=type(error).__name__,
            )
            logger.warning("Image tool failed job_id=%s type=%s", job_id, type(error).__name__)

    async def generate_api_tool(
        self,
        job_id: str,
        payload: dict[str, Any],
        source: Path,
        mask: Path | None,
        upload: dict[str, Any],
        reference_uploads: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Run a reference-image task through an explicitly selected cloud model."""
        assert self.client is not None
        model_id = str(payload.get("model") or "")
        cfg = MODELS.get(model_id)
        if not cfg:
            raise ValueError("unsupported_tool_model")
        provider = cfg.get("provider", "")
        source_data = f"data:image/png;base64,{base64.b64encode(source.read_bytes()).decode('ascii')}"
        references = [source_data]
        for reference_upload in reference_uploads:
            reference_path = reference_upload.get("path")
            if isinstance(reference_path, Path):
                references.append(f"data:image/png;base64,{base64.b64encode(reference_path.read_bytes()).decode('ascii')}")
        prompt = str(payload.get("prompt") or "").strip()
        mask_data: str | None = None
        if mask is not None:
            mask_data = f"data:image/png;base64,{base64.b64encode(mask.read_bytes()).decode('ascii')}"
            if provider != "fal":
                references.append(mask_data)
                prompt = f"{prompt}\nThe second reference is an alpha mask: edit only its white/non-transparent region and preserve everything else."
        width = max(1, int(upload.get("width") or 1024))
        height = max(1, int(upload.get("height") or 1024))
        edge = 2048 if payload.get("resolution") in HIGH_RESOLUTIONS else 1024
        scale = min(edge / width, edge / height)
        target_width = max(384, min(2048, int(round(width * scale / 64) * 64)))
        target_height = max(384, min(2048, int(round(height * scale / 64) * 64)))
        if payload.get("operation") == "panorama":
            target_width, target_height = 2048, 1024
        images: list[dict[str, Any]] = []
        if provider == "fal":
            request_body = self._fal_gpt_image_body(
                payload,
                prompt,
                ratio=width / height,
                image_urls=references,
                mask_url=mask_data,
            )
            result = await self._run_fal_image(FAL_GPT_IMAGE_2_ENDPOINTS["image_edit"], request_body)
            remote_urls = [
                item["url"] for item in result.get("images", [])
                if isinstance(item, dict) and isinstance(item.get("url"), str)
            ]
            images = await self.persist_remote_images(
                job_id, remote_urls, allowed_host_suffixes=(".fal.media",), limit=10,
            )
        elif provider == "openai_compatible":
            if not SEEDREAM_API_KEY or not SEEDREAM_BASE_URL:
                raise RuntimeError("Seedream API is not configured")
            seedream_model = str(cfg.get("model_id") or SEEDREAM_IMAGE_MODEL)
            is_seedream_pro = "seedream-5-0-pro" in seedream_model
            if payload.get("operation") in {"interactive", "layers"} and not is_seedream_pro:
                raise ValueError("seedream_pro_required")
            if payload.get("operation") == "layers" and (len(references) != 1 or mask is not None):
                raise ValueError("layer_decomposition_requires_one_image")
            seedream_payload = {
                    "model": seedream_model,
                    "prompt": prompt,
                    "image": references[0] if payload.get("operation") == "layers" else references,
                    "size": "2K" if "seedream-5-0" in seedream_model or payload.get("resolution") in HIGH_RESOLUTIONS else "1K",
                    "response_format": "url",
                    "watermark": False,
                }
            if payload.get("operation") == "layers":
                seedream_payload["layer_decomposition"] = True
                seedream_payload["output_format"] = "jpeg"
            if "seedream-5-0-pro" not in seedream_model:
                seedream_payload["sequential_image_generation"] = "disabled"
            response = await self.client.post(
                f"{SEEDREAM_BASE_URL}/images/generations",
                headers={"Authorization": f"Bearer {SEEDREAM_API_KEY}"},
                json=seedream_payload,
            )
            response.raise_for_status()
            data = response.json().get("data", [])
            inline_items = [item for item in data if isinstance(item, dict) and isinstance(item.get("b64_json"), str)]
            images = self.persist_images(
                job_id, inline_items,
                limit=17 if payload.get("operation") == "layers" else 10,
            )
            metadata_items = inline_items
            if not images:
                remote_items = [item for item in data if isinstance(item, dict) and isinstance(item.get("url"), str)]
                remote_urls = [item["url"] for item in remote_items]
                images = await self.persist_remote_images(
                    job_id, remote_urls,
                    allowed_host_suffixes=(".volces.com", ".volcengine.com", ".byteimg.com"),
                    limit=17 if payload.get("operation") == "layers" else 10,
                )
                metadata_items = remote_items
            if payload.get("operation") == "layers":
                metadata_keys = ("z_index", "bounding_box", "name", "description", "output_format", "size")
                for persisted, provider_item in zip(images, metadata_items):
                    persisted.update({key: provider_item[key] for key in metadata_keys if key in provider_item})
                    persisted["kind"] = "layer"
        elif provider == "bailian":
            if not DASHSCOPE_API_KEY or not BAILIAN_BASE_URL:
                raise RuntimeError("Alibaba Cloud Model Studio API is not configured")
            model_name = str(cfg.get("model_id") or "qwen-image-3.0")
            content = [{"image": reference} for reference in references]
            content.append({"text": prompt})
            size_value = (
                "2K" if model_name.startswith("wan") and payload.get("resolution") in HIGH_RESOLUTIONS
                else ("1K" if model_name.startswith("wan") else f"{target_width}*{target_height}")
            )
            response = await self.client.post(
                f"{BAILIAN_BASE_URL}/services/aigc/multimodal-generation/generation",
                headers={"Authorization": f"Bearer {DASHSCOPE_API_KEY}"},
                json={
                    "model": model_name,
                    "input": {"messages": [{"role": "user", "content": content}]},
                    "parameters": {"size": size_value, "n": 1, "watermark": False, "prompt_extend": True},
                },
            )
            response.raise_for_status()
            choices = response.json().get("output", {}).get("choices", [])
            remote_urls = []
            for choice in choices:
                choice_content = choice.get("message", {}).get("content", []) if isinstance(choice, dict) else []
                for item in choice_content if isinstance(choice_content, list) else []:
                    if isinstance(item, dict) and isinstance(item.get("image"), str):
                        remote_urls.append(item["image"])
            images = await self.persist_remote_images(job_id, remote_urls, allowed_host_suffixes=(".aliyuncs.com",))
        elif provider == "google":
            if not GOOGLE_API_KEY or not self.google_client:
                raise RuntimeError("Google API is not configured")
            google_model = str(cfg.get("model_id") or GOOGLE_IMAGE_MODEL)
            image_input = [
                {"type": "image", "mime_type": "image/png", "data": base64.b64encode(path.read_bytes()).decode("ascii")}
                for path in [source, *(item["path"] for item in reference_uploads), *([mask] if mask is not None else [])]
            ]
            response = await self.google_client.post(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                headers={"x-goog-api-key": GOOGLE_API_KEY},
                json={
                    "model": google_model,
                    "input": [*image_input, {"type": "text", "text": prompt}],
                    "response_format": {
                        "type": "image",
                        "aspect_ratio": "1:1",
                        "image_size": google_image_size(model_id, str(payload.get("resolution") or "720p")),
                        "mime_type": "image/jpeg",
                        "delivery": "inline",
                    },
                },
            )
            response.raise_for_status()
            encoded = [
                {"b64_json": item["data"]}
                for step in response.json().get("steps", [])
                if isinstance(step, dict) and step.get("type") == "model_output"
                for item in step.get("content", [])
                if isinstance(item, dict) and item.get("type") == "image" and isinstance(item.get("data"), str)
            ]
            images = self.persist_images(job_id, encoded, limit=10)
        else:
            raise ValueError("unsupported_tool_provider")
        if not images:
            raise ValueError("api_tool_returned_no_image")
        return images

    @staticmethod
    def _fal_gpt_image_body(
        payload: dict[str, Any],
        prompt: str,
        *,
        ratio: float | None = None,
        image_urls: list[str] | None = None,
        mask_url: str | None = None,
    ) -> dict[str, Any]:
        resolution = str(payload["resolution"])
        image_size = (
            fal_gpt_image_size_for_ratio(ratio, resolution)
            if ratio is not None
            else fal_gpt_image_size(str(payload["aspect_ratio"]), resolution)
        )
        editing = image_urls is not None
        body: dict[str, Any] = {
            "prompt": prompt,
            "image_size": image_size,
            "background": "auto",
            "quality": FAL_GPT_IMAGE_2_QUALITY[str(payload["quality"])],
            "num_images": int(payload.get("views") if payload.get("operation") == "multiview" else payload.get("count") or 1),
            "output_format": "webp",
            "sync_mode": False,
        }
        if editing:
            body["image_urls"] = image_urls
        if mask_url is not None:
            body["mask_url"] = mask_url
        return body

    async def _request_fal_image_json(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not FAL_KEY or self.client is None:
            raise RuntimeError("fal_image_not_configured")
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

    @staticmethod
    def _fal_image_queue_request_path(request_id: str, *, status: bool) -> str:
        suffix = "/status" if status else ""
        return f"/{FAL_GPT_IMAGE_2_QUEUE_APPLICATION}/requests/{request_id}{suffix}"

    async def _run_fal_image(self, endpoint: str, request_body: dict[str, Any]) -> dict[str, Any]:
        submitted = await self._request_fal_image_json(
            "POST", f"/{endpoint}", json=request_body, timeout=90.0,
        )
        request_id = str(submitted.get("request_id") or "")
        if not request_id:
            raise ValueError("provider_task_id_missing")
        started = time.monotonic()
        delay = 1.0
        while time.monotonic() - started < 600:
            status_body = await self._request_fal_image_json(
                "GET",
                self._fal_image_queue_request_path(request_id, status=True),
                params={"logs": "false"},
                timeout=30.0,
            )
            status = str(status_body.get("status") or "UNKNOWN").upper()
            if status == "COMPLETED":
                return await self._request_fal_image_json(
                    "GET", self._fal_image_queue_request_path(request_id, status=False), timeout=30.0,
                )
            if status in {"FAILED", "CANCELED", "CANCELLED", "ERROR"}:
                raise RuntimeError(f"fal_image_{status.lower()}")
            await asyncio.sleep(delay)
            delay = min(10.0, delay * 1.7)
        raise TimeoutError("fal_image_timeout")

    async def generate_api(self, job_id: str, job: dict[str, Any], payload: dict[str, Any]) -> None:
        assert self.client is not None
        if job.get("status") == "cancelled":
            return
        model = payload["model"]
        job["status"] = "running"
        job["updated_at"] = time.time()
        cfg = MODELS[model]
        provider = cfg.get("provider", "")
        prompt = generation_prompt_for(payload)
        images: list[dict[str, str]] = []
        provider_usage: dict[str, Any] = {}
        provider_request_count = 0
        started = time.monotonic()
        try:
            if provider == "fal":
                provider_request_count = 1
                request_body = self._fal_gpt_image_body(payload, prompt)
                result = await self._run_fal_image(
                    FAL_GPT_IMAGE_2_ENDPOINTS["text_to_image"], request_body,
                )
                remote_urls = [
                    item["url"] for item in result.get("images", [])
                    if isinstance(item, dict) and isinstance(item.get("url"), str)
                ]
                images = await self.persist_remote_images(
                    job_id, remote_urls, allowed_host_suffixes=(".fal.media",), limit=4,
                )
            elif provider == "openai_compatible":
                if not SEEDREAM_API_KEY or not SEEDREAM_BASE_URL:
                    raise RuntimeError("SEEDREAM_API_KEY / SEEDREAM_BASE_URL not configured")
                # Seedream Lite/4.5/4.0 can generate a related series in one
                # request.  Seedream 5.0 Pro is single-image only, so a user
                # asking for several independent candidates receives separate
                # requests instead.
                seedream_model = str(cfg.get("model_id") or SEEDREAM_IMAGE_MODEL)
                provider_size = "4K" if payload["resolution"] == "4k" else (
                    "2K" if payload["resolution"] == "2k" else "1K"
                )
                if "seedream-5-0" in seedream_model and provider_size == "1K":
                    provider_size = "2K"
                provider_prompt = f"{prompt}\n输出画幅比例：{payload['aspect_ratio']}，严格保持该横纵比。"

                series_models = {"seedream_4_0", "seedream_4_5", "seedream_5_0"}
                use_series = model in series_models and payload.get("output_mode") == "auto" and payload["count"] > 1

                async def request_seedream_image() -> httpx.Response:
                    seedream_payload = {
                        "model": seedream_model,
                        "prompt": provider_prompt,
                        "size": provider_size,
                        "response_format": "url",
                        "watermark": False,
                    }
                    if use_series:
                        seedream_payload["sequential_image_generation"] = "auto"
                        seedream_payload["sequential_image_generation_options"] = {"max_images": payload["count"]}
                    elif "seedream-5-0-pro" not in seedream_model:
                        seedream_payload["sequential_image_generation"] = "disabled"
                    return await self.client.post(
                        f"{SEEDREAM_BASE_URL}/images/generations",
                        headers={"Authorization": f"Bearer {SEEDREAM_API_KEY}"},
                        json=seedream_payload,
                    )

                request_count = 1 if use_series else payload["count"]
                provider_request_count = request_count
                responses = await asyncio.gather(*(request_seedream_image() for _ in range(request_count)))
                remote_urls: list[str] = []
                for response in responses:
                    response.raise_for_status()
                    for item in response.json().get("data", []):
                        if isinstance(item, dict) and isinstance(item.get("url"), str):
                            remote_urls.append(item["url"])
                images = await self.persist_remote_images(
                    job_id, remote_urls,
                    allowed_host_suffixes=(".volces.com", ".volcengine.com", ".byteimg.com"),
                )
            elif provider == "bailian":
                if not DASHSCOPE_API_KEY or not BAILIAN_BASE_URL:
                    raise RuntimeError("Alibaba Cloud Model Studio API is not configured")
                model_id = str(cfg.get("model_id") or "qwen-image-3.0")
                if model_id.startswith("wan"):
                    size_value = "4K" if model_id.endswith("-pro") and payload["resolution"] == "4k" else ("2K" if payload["resolution"] in HIGH_RESOLUTIONS else "1K")
                else:
                    native_resolution = "2k" if payload["resolution"] in HIGH_RESOLUTIONS else payload["resolution"]
                    api_width, api_height = dimensions_for_ratio(payload["aspect_ratio"], native_resolution)
                    size_value = f"{api_width}*{api_height}"
                provider_request_count = 1
                response = await self.client.post(
                    f"{BAILIAN_BASE_URL}/services/aigc/multimodal-generation/generation",
                    headers={"Authorization": f"Bearer {DASHSCOPE_API_KEY}"},
                    json={
                        "model": model_id,
                        "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
                        "parameters": {
                            "size": size_value,
                            "n": payload["count"],
                            "watermark": False,
                            "prompt_extend": True,
                        },
                    },
                )
                response.raise_for_status()
                choices = response.json().get("output", {}).get("choices", [])
                remote_urls: list[str] = []
                for choice in choices:
                    content = choice.get("message", {}).get("content", []) if isinstance(choice, dict) else []
                    for item in (content if isinstance(content, list) else []):
                        remote_url = item.get("image") if isinstance(item, dict) else None
                        if isinstance(remote_url, str):
                            remote_urls.append(remote_url)
                images = await self.persist_remote_images(job_id, remote_urls, allowed_host_suffixes=(".aliyuncs.com",))
            elif provider == "google":
                if not GOOGLE_API_KEY:
                    raise RuntimeError("GOOGLE_API_KEY not configured")
                google_model = str(cfg.get("model_id") or GOOGLE_IMAGE_MODEL)
                image_size = google_image_size(model, payload["resolution"])

                async def request_google_image() -> httpx.Response:
                    if not self.google_client:
                        raise RuntimeError("Google HTTP client is not ready")
                    return await self.google_client.post(
                        "https://generativelanguage.googleapis.com/v1beta/interactions",
                        headers={"x-goog-api-key": GOOGLE_API_KEY},
                        json={
                            "model": google_model,
                            "input": [{"type": "text", "text": prompt}],
                            "response_format": {
                                "type": "image", "aspect_ratio": payload["aspect_ratio"],
                                "image_size": image_size, "mime_type": "image/jpeg", "delivery": "inline",
                            },
                        },
                    )

                provider_request_count = payload["count"]
                responses = await asyncio.gather(*(request_google_image() for _ in range(provider_request_count)))
                encoded: list[dict[str, str]] = []
                usage_totals: dict[str, int] = defaultdict(int)
                usage_modalities: dict[str, dict[str, int]] = {
                    "input_tokens_by_modality": defaultdict(int),
                    "output_tokens_by_modality": defaultdict(int),
                }
                for response in responses:
                    response.raise_for_status()
                    body = response.json()
                    for step in body.get("steps", []) if isinstance(body.get("steps"), list) else []:
                        if not isinstance(step, dict) or step.get("type") != "model_output":
                            continue
                        for block in step.get("content", []) if isinstance(step.get("content"), list) else []:
                            if isinstance(block, dict) and block.get("type") == "image" and isinstance(block.get("data"), str):
                                encoded.append({"b64_json": block["data"]})
                    clean_usage = normalized_provider_usage(body.get("usage"))
                    for key in (
                        "total_input_tokens", "total_output_tokens", "total_thought_tokens",
                        "total_cached_tokens", "total_tool_use_tokens",
                    ):
                        usage_totals[key] += int(clean_usage.get(key) or 0)
                    for key in usage_modalities:
                        for item in clean_usage.get(key, []):
                            usage_modalities[key][str(item.get("modality") or "unknown")] += int(item.get("tokens") or 0)
                provider_usage = dict(usage_totals)
                for key, totals in usage_modalities.items():
                    if totals:
                        provider_usage[key] = [{"modality": modality, "tokens": tokens} for modality, tokens in totals.items()]
                images = self.persist_images(job_id, encoded)
            else:
                raise RuntimeError(f"unsupported_api_provider:{provider}")
            if not images:
                raise ValueError("api returned no valid image data")
            job.update(status="completed", images=images, updated_at=time.time())
            self.record_history(job.get("owner", ""), images, payload["prompt"], model)
            provider_usage_fields: dict[str, Any] = {}
            if model == "gpt_image":
                provider_quote = image_quote(
                    model,
                    payload["resolution"],
                    count=payload["count"],
                    quality=payload["quality"],
                )
                provider_usage_fields = {
                    "provider_name": "fal",
                    "provider_cost_usd": provider_quote["provider_cost_cny"] / USD_CNY_RATE,
                    "pricing_source_override": provider_quote["pricing_source"],
                }
            self.record_model_usage(
                job_id=job_id, model=model, operation="text_to_image", status="completed",
                resolution=payload["resolution"], request_count=provider_request_count, image_count=len(images),
                credits_charged=int(job.get("charged_credits") or 0),
                duration_ms=int((time.monotonic() - started) * 1000), provider_usage=provider_usage,
                **provider_usage_fields,
            )
            logger.info("API generation completed job_id=%s model=%s", job_id, model)
        except Exception as error:
            job.update(status="failed", error="api_generation_failed", updated_at=time.time())
            self.record_model_usage(
                job_id=job_id, model=model, operation="text_to_image", status="failed",
                resolution=payload.get("resolution", "720p"), request_count=provider_request_count,
                image_count=0, credits_charged=int(job.get("charged_credits") or 0),
                duration_ms=int((time.monotonic() - started) * 1000), provider_usage=provider_usage,
                error_code=type(error).__name__,
            )
            logger.warning("API generation failed job_id=%s model=%s type=%s", job_id, model, type(error).__name__)

    @staticmethod
    def persist_images(job_id: str, data: Any, *, start_index: int = 0, limit: int = 4) -> list[dict[str, str]]:
        if not isinstance(data, list):
            return []
        images: list[dict[str, str]] = []
        for index, item in enumerate(data[:limit], start=start_index):
            encoded = item.get("b64_json") if isinstance(item, dict) else None
            if not isinstance(encoded, str) or len(encoded) > 32_000_000:
                continue
            try:
                raw = base64.b64decode(encoded, validate=True)
            except (ValueError, TypeError):
                continue
            if raw.startswith(b"\x89PNG\r\n\x1a\n"):
                extension = "png"
            elif raw.startswith(b"\xff\xd8\xff"):
                extension = "jpg"
            elif raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
                extension = "webp"
            else:
                continue
            filename = f"{job_id}-{index}.{extension}"
            (GENERATED_DIR / filename).write_bytes(raw)
            images.append({"url": f"/generated/{filename}"})
        return images

    async def persist_remote_images(
        self,
        job_id: str,
        urls: list[str],
        *,
        allowed_host_suffixes: tuple[str, ...],
        limit: int = 6,
    ) -> list[dict[str, str]]:
        """Copy short-lived provider results locally without creating an SSRF proxy."""
        assert self.client is not None
        images: list[dict[str, str]] = []
        for index, url in enumerate(urls[:limit]):
            parsed = urlparse(url)
            host = (parsed.hostname or "").lower()
            if parsed.scheme != "https" or not host or not any(host.endswith(suffix) for suffix in allowed_host_suffixes):
                continue
            try:
                async with self.client.stream("GET", url) as response:
                    response.raise_for_status()
                    content_length = int(response.headers.get("Content-Length", "0") or 0)
                    if content_length > MAX_UPLOAD_BODY_BYTES:
                        continue
                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes(64 * 1024):
                        total += len(chunk)
                        if total > MAX_UPLOAD_BODY_BYTES:
                            chunks = []
                            break
                        chunks.append(chunk)
                raw = b"".join(chunks)
            except (httpx.HTTPError, ValueError):
                continue
            if raw.startswith(b"\x89PNG\r\n\x1a\n"):
                extension = "png"
            elif raw.startswith(b"\xff\xd8\xff"):
                extension = "jpg"
            elif raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
                extension = "webp"
            else:
                continue
            try:
                from PIL import Image

                Image.MAX_IMAGE_PIXELS = MAX_UPLOAD_PIXELS
                with Image.open(io.BytesIO(raw)) as probe:
                    probe.verify()
                    if probe.width * probe.height > MAX_UPLOAD_PIXELS:
                        continue
            except (OSError, ValueError):
                continue
            filename = f"{job_id}-{index}.{extension}"
            (GENERATED_DIR / filename).write_bytes(raw)
            images.append({"url": f"/generated/{filename}"})
        return images

def public_images(paths: list[Path]) -> list[dict[str, str]]:
    images: list[dict[str, str]] = []
    base = GENERATED_DIR.resolve()
    for path in paths[:9]:
        try:
            resolved = path.resolve(strict=True)
            relative = resolved.relative_to(base)
        except (OSError, ValueError):
            continue
        if resolved.suffix.lower() not in {".png", ".jpg", ".webp"}:
            continue
        images.append({"url": f"/generated/{relative.as_posix()}"})
    return images

def generated_path_from_url(url: str) -> Path:
    prefix = "/generated/"
    if not isinstance(url, str) or not url.startswith(prefix):
        raise ValueError("invalid_generated_url")
    relative = Path(url.removeprefix(prefix))
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("invalid_generated_url")
    return GENERATED_DIR / relative

def private_or_generated_source(owner: str, url: str) -> Path:
    clean_url = str(url or "").split("?", 1)[0]
    private_match = re.fullmatch(r"/api/v1/private-media/(history|asset|video|audio)/([a-f0-9]{32})", clean_url)
    if private_match:
        path = relay.database.media_path(owner, private_match.group(1), private_match.group(2))
        if not path:
            raise ValueError("private_media_not_found")
        return path
    source = generated_path_from_url(clean_url).resolve(strict=True)
    source.relative_to(GENERATED_DIR.resolve())
    return source

relay = RelayState()
