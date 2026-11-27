"""Accounts, wallets, assets, private media and feedback APIs."""
from __future__ import annotations

import asyncio
import contextlib
import hmac
import io
import json
import re
import secrets
import smtplib
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from ...catalog.models import *
from ...core.config import *
from ...providers.account_email import email_code_digest, email_registration_configured, send_verification_email
from ..dependencies import *
from ...runtime import *
from ..schemas import *

router = APIRouter()

@router.get("/api/v1/users/me")
async def users_me(request: Request) -> dict[str, Any]:
    device = session_id(request)
    user_id = relay.owner_for_device(device)
    bound = user_id != device
    return {"device_id": device, "bound": bound, "profile": relay.public_user(user_id) if bound else None}

@router.get("/api/v1/credits")
async def credits(request: Request) -> dict[str, Any]:
    return relay.credit_summary(owner_id(request))

@router.get("/api/v1/users/sms/status")
async def users_sms_status() -> dict[str, Any]:
    return {
        "configured": sms_is_configured(),
        "provider": "火山引擎短信",
        "code_length": 6,
        "expires_in": 300,
        "cooldown": 60,
    }

@router.post("/api/v1/users/sms/send")
async def users_sms_send(payload: SmsSendInput, request: Request) -> dict[str, Any]:
    if not sms_is_configured():
        raise HTTPException(status_code=503, detail="sms_not_configured")
    phone_key = hashlib.sha256(payload.phone.encode("utf-8")).hexdigest()[:24]
    now = time.monotonic()
    if now - relay.sms_last_sent.get(phone_key, 0.0) < 60:
        raise HTTPException(status_code=429, detail="sms_cooldown")
    if not relay.check_rate_limit(f"sms-ip:{client_ip(request)}") or not relay.check_rate_limit(f"sms-phone:{phone_key}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    # Avoid billing a needless SMS for an already registered phone while keeping
    # the public response generic enough not to disclose account membership.
    already_registered = relay.database.phone_exists(payload.phone)
    relay.sms_last_sent[phone_key] = now
    if not already_registered:
        sms_payload: dict[str, Any] = {
            "SmsAccount": VOLC_SMS_ACCOUNT,
            "Sign": VOLC_SMS_SIGN,
            "TemplateID": VOLC_SMS_TEMPLATE_ID,
            "PhoneNumber": payload.phone,
            "Scene": VOLC_SMS_SCENE,
            "CodeType": 6,
            "ExpireTime": 300,
            "TryCount": 5,
        }
        if VOLC_SMS_USER_EXT_CODE:
            sms_payload["UserExtCode"] = VOLC_SMS_USER_EXT_CODE
        await volc_sms_request("SendSmsVerifyCode", sms_payload)
    return {"ok": True, "cooldown": 60, "expires_in": 300}

@router.post("/api/v1/users/register")
async def users_register(payload: RegisterInput, request: Request) -> dict[str, Any]:
    if not relay.check_rate_limit(f"register:{client_ip(request)}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    if not sms_is_configured():
        raise HTTPException(status_code=503, detail="sms_not_configured")
    if relay.database.phone_exists(payload.phone):
        raise HTTPException(status_code=409, detail="phone_exists")
    checked = await volc_sms_request("CheckSmsVerifyCode", {
        "SmsAccount": VOLC_SMS_ACCOUNT,
        "PhoneNumber": payload.phone,
        "Scene": VOLC_SMS_SCENE,
        "Code": payload.sms_code,
    })
    if str(checked.get("Result")) != "0":
        raise HTTPException(status_code=422, detail="invalid_sms_code")
    device = session_id(request)
    try:
        user_id = relay.register_user(device, payload.phone, payload.password, payload.display_name)
    except ValueError as error:
        status = 409 if str(error) == "phone_exists" else 422
        raise HTTPException(status_code=status, detail=str(error)) from error
    return {"ok": True, "profile": relay.public_user(user_id)}

@router.post("/api/v1/users/login")
async def users_login(payload: LoginInput, request: Request) -> dict[str, Any]:
    if not relay.check_rate_limit(f"login:{client_ip(request)}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    try:
        user_id = relay.login_user(session_id(request), payload.phone, payload.password)
    except ValueError as error:
        raise HTTPException(status_code=401, detail="invalid_credentials") from error
    return {"ok": True, "profile": relay.public_user(user_id)}

@router.get("/api/v1/users/email/status")
async def users_email_status() -> dict[str, Any]:
    return {"configured": email_registration_configured()}


@router.post("/api/v1/users/email/send")
async def users_email_send(payload: EmailAddressInput, request: Request) -> dict[str, Any]:
    if not email_registration_configured():
        raise HTTPException(status_code=503, detail="email_not_configured")
    if not relay.check_rate_limit(f"email-send:{client_ip(request)}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    device = session_id(request)
    code = f"{secrets.randbelow(1_000_000):06d}"
    digest = email_code_digest(device, payload.email, code)
    if not relay.database.reserve_email_code(device, payload.email, digest, time.time()):
        raise HTTPException(status_code=429, detail="rate_limited")
    if not relay.database.contact_exists(payload.email):
        try:
            await asyncio.to_thread(send_verification_email, payload.email, code)
        except (OSError, smtplib.SMTPException, ValueError) as error:
            relay.database.discard_email_code(device, payload.email, digest)
            raise HTTPException(status_code=503, detail="email_delivery_unavailable") from error
    return {"ok": True, "cooldown": 60, "expires_in": 300}


@router.post("/api/v1/users/email/register")
async def users_email_register(payload: EmailRegisterInput, request: Request) -> dict[str, Any]:
    if not email_registration_configured():
        raise HTTPException(status_code=503, detail="email_not_configured")
    if not relay.check_rate_limit(f"register:{client_ip(request)}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    device = session_id(request)
    digest = email_code_digest(device, payload.email, payload.code)
    if not relay.database.consume_email_code(device, payload.email, digest, time.time()):
        raise HTTPException(status_code=422, detail="invalid_email_code")
    try:
        user_id = relay.register_user(device, payload.email, payload.password, payload.display_name, contact_type="email")
    except ValueError as error:
        raise HTTPException(status_code=409, detail="email_exists") from error
    return {"ok": True, "profile": relay.public_user(user_id)}


@router.post("/api/v1/users/email/login")
async def users_email_login(payload: EmailLoginInput, request: Request) -> dict[str, Any]:
    if not relay.check_rate_limit(f"login:{client_ip(request)}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    try:
        user_id = relay.login_user(session_id(request), payload.email, payload.password, contact_type="email")
    except ValueError as error:
        raise HTTPException(status_code=401, detail="invalid_credentials") from error
    return {"ok": True, "profile": relay.public_user(user_id)}


@router.post("/api/v1/users/logout")
async def users_logout(request: Request) -> dict[str, bool]:
    relay.logout_user(session_id(request))
    return {"ok": True}

@router.patch("/api/v1/users/me")
async def users_update(payload: ProfileInput, request: Request) -> dict[str, Any]:
    owner = owner_id(request)
    if not relay.database.update_profile(owner, payload.display_name, payload.bio):
        raise HTTPException(status_code=401, detail="login_required")
    return {"ok": True, "profile": relay.public_user(owner)}

@router.post("/api/v1/users/avatar")
async def users_avatar(request: Request, avatar: UploadFile = File(...)) -> dict[str, Any]:
    owner = owner_id(request)
    if not relay.database.user_exists(owner):
        raise HTTPException(status_code=401, detail="login_required")
    if avatar.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=415, detail="invalid_avatar")
    raw = await avatar.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="avatar_too_large")
    try:
        from PIL import Image
        image = Image.open(io.BytesIO(raw))
        image.load()
        image = image.convert("RGB")
        image.thumbnail((512, 512))
        avatar_dir = PRIVATE_MEDIA_DIR / "avatars" / owner
        avatar_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        path = avatar_dir / "avatar.webp"
        image.save(path, "WEBP", quality=88, method=6)
        path.chmod(0o600)
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=415, detail="invalid_avatar") from error
    relay.database.set_avatar_path(owner, path.relative_to(PRIVATE_MEDIA_DIR).as_posix())
    return {"ok": True, "profile": relay.public_user(owner)}

@router.get("/api/v1/users/avatar/content")
async def users_avatar_content(request: Request) -> FileResponse:
    owner = owner_id(request)
    path = relay.database.media_path(owner, "avatar", "avatar")
    if not path:
        raise HTTPException(status_code=404, detail="avatar_not_found")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})

@router.get("/api/v1/users/history")
async def users_history(request: Request) -> dict[str, Any]:
    owner = owner_id(request)
    return {"items": relay.database.histories_for(owner) if relay.database.user_exists(owner) else []}

@router.delete("/api/v1/users/history/{history_id}")
async def users_history_delete(history_id: str, request: Request) -> dict[str, bool]:
    if not re.fullmatch(r"[a-f0-9]{32}", history_id):
        raise HTTPException(status_code=404, detail="history_not_found")
    owner = owner_id(request)
    if not relay.check_rate_limit(f"history-delete:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    path = relay.database.media_path(owner, "history", history_id)
    if not path or not relay.database.delete_history(owner, history_id):
        raise HTTPException(status_code=404, detail="history_not_found")
    with contextlib.suppress(OSError):
        path.unlink()
    return {"ok": True}

def asset_categories_for(owner: str) -> list[dict[str, Any]]:
    defaults = [{**item, "custom": False} for item in DEFAULT_ASSET_CATEGORIES]
    custom = [
        {"id": str(item.get("id", "")), "name": str(item.get("name", "")), "icon": "○", "custom": True}
        for item in relay.database.custom_asset_categories(owner)
        if re.fullmatch(r"custom-[a-f0-9]{12}", str(item.get("id", ""))) and str(item.get("name", "")).strip()
    ]
    return defaults + custom

ASSET_MEDIA_TYPES: dict[str, tuple[str, str, int]] = {
    "image/png": (".png", "image", MAX_UPLOAD_BODY_BYTES),
    "image/jpeg": (".jpg", "image", MAX_UPLOAD_BODY_BYTES),
    "image/webp": (".webp", "image", MAX_UPLOAD_BODY_BYTES),
    "video/mp4": (".mp4", "video", MAX_VIDEO_DOWNLOAD_BYTES),
    "video/quicktime": (".mov", "video", MAX_VIDEO_DOWNLOAD_BYTES),
    "video/webm": (".webm", "video", MAX_VIDEO_DOWNLOAD_BYTES),
    "audio/wav": (".wav", "audio", MAX_AUDIO_DOWNLOAD_BYTES),
    "audio/x-wav": (".wav", "audio", MAX_AUDIO_DOWNLOAD_BYTES),
    "audio/mpeg": (".mp3", "audio", MAX_AUDIO_DOWNLOAD_BYTES),
    "audio/mp4": (".m4a", "audio", MAX_AUDIO_DOWNLOAD_BYTES),
    "audio/x-m4a": (".m4a", "audio", MAX_AUDIO_DOWNLOAD_BYTES),
    "audio/ogg": (".ogg", "audio", MAX_AUDIO_DOWNLOAD_BYTES),
}
ASSET_SUFFIX_TYPES: dict[str, tuple[str, str]] = {
    ".png": ("image/png", "image"), ".jpg": ("image/jpeg", "image"),
    ".jpeg": ("image/jpeg", "image"), ".webp": ("image/webp", "image"),
    ".mp4": ("video/mp4", "video"), ".mov": ("video/quicktime", "video"),
    ".webm": ("video/webm", "video"), ".wav": ("audio/wav", "audio"),
    ".mp3": ("audio/mpeg", "audio"), ".m4a": ("audio/mp4", "audio"),
    ".ogg": ("audio/ogg", "audio"),
}

def _validated_asset_media(raw: bytes, declared_type: str) -> tuple[str, str, str]:
    """Return normalized suffix, MIME and media family after signature validation."""
    normalized = declared_type.lower().split(";", 1)[0].strip()
    if normalized not in ASSET_MEDIA_TYPES:
        raise HTTPException(status_code=415, detail="unsupported_asset_media_type")
    suffix, family, _ = ASSET_MEDIA_TYPES[normalized]
    if family == "image":
        try:
            from PIL import Image, UnidentifiedImageError
            Image.MAX_IMAGE_PIXELS = MAX_UPLOAD_PIXELS
            with Image.open(io.BytesIO(raw)) as image:
                image.verify()
                detected = str(image.format or "").upper()
        except (OSError, ValueError, UnidentifiedImageError) as error:
            raise HTTPException(status_code=415, detail="invalid_asset_media") from error
        expected = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}[normalized]
        if detected != expected:
            raise HTTPException(status_code=415, detail="asset_media_type_mismatch")
    elif family == "video":
        iso_video = len(raw) >= 12 and raw[4:8] == b"ftyp"
        webm_video = raw.startswith(b"\x1aE\xdf\xa3")
        if (normalized == "video/webm" and not webm_video) or (normalized != "video/webm" and not iso_video):
            raise HTTPException(status_code=415, detail="invalid_asset_media")
    else:
        signatures = {
            "audio/wav": len(raw) >= 12 and raw.startswith(b"RIFF") and raw[8:12] == b"WAVE",
            "audio/x-wav": len(raw) >= 12 and raw.startswith(b"RIFF") and raw[8:12] == b"WAVE",
            "audio/mpeg": raw.startswith(b"ID3") or (len(raw) > 2 and raw[0] == 0xFF and raw[1] & 0xE0 == 0xE0),
            "audio/ogg": raw.startswith(b"OggS"),
            "audio/mp4": len(raw) >= 12 and b"ftyp" in raw[4:16],
            "audio/x-m4a": len(raw) >= 12 and b"ftyp" in raw[4:16],
        }
        if not signatures.get(normalized, False):
            raise HTTPException(status_code=415, detail="invalid_asset_media")
    canonical = "audio/wav" if normalized == "audio/x-wav" else "audio/mp4" if normalized == "audio/x-m4a" else normalized
    return suffix, canonical, family

def _asset_record(
    owner: str, source: Path, name: str, category_id: str, prompt: str, kind: str,
    asset_type: str | None, media_type: str, family: str,
) -> dict[str, Any]:
    requested_type = asset_type or family
    if requested_type in {"voice", "music"} and family != "audio":
        raise HTTPException(status_code=422, detail="asset_type_media_mismatch")
    if requested_type not in ({"image"} if family == "image" else {"video"} if family == "video" else {"audio", "voice", "music"}):
        raise HTTPException(status_code=422, detail="asset_type_media_mismatch")
    asset_id = uuid.uuid4().hex
    destination_dir = PRIVATE_MEDIA_DIR / "assets" / owner
    destination_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    destination = destination_dir / f"{asset_id}{source.suffix.lower()}"
    try:
        shutil.copy2(source, destination)
        destination.chmod(0o600)
    except OSError as error:
        raise HTTPException(status_code=503, detail="asset_copy_failed") from error
    record = {
        "id": asset_id, "name": name, "category_id": category_id,
        "url": f"/api/v1/private-media/asset/{asset_id}",
        "media_path": destination.relative_to(PRIVATE_MEDIA_DIR).as_posix(),
        "prompt": prompt, "kind": kind, "asset_type": requested_type,
        "media_type": media_type, "size_bytes": destination.stat().st_size,
        "created_at": time.time(),
    }
    try:
        relay.database.create_asset(owner, record)
    except ValueError as error:
        with contextlib.suppress(OSError):
            destination.unlink()
        raise HTTPException(status_code=409, detail=str(error)) from error
    return record

@router.get("/api/v1/assets")
async def assets_list(request: Request) -> dict[str, Any]:
    owner = owner_id(request)
    items = relay.database.assets_for(owner)
    return {"categories": asset_categories_for(owner), "items": items}

@router.post("/api/v1/assets/categories")
async def asset_category_create(payload: AssetCategoryCreateInput, request: Request) -> dict[str, Any]:
    owner = owner_id(request)
    if not relay.check_rate_limit(f"asset-category:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    all_names = {str(item.get("name", "")).strip().casefold() for item in asset_categories_for(owner)}
    if payload.name.casefold() in all_names:
        raise HTTPException(status_code=409, detail="category_exists")
    try:
        category = relay.database.create_asset_category(owner, payload.name)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"ok": True, "category": {**category, "icon": "○", "custom": True}}

@router.post("/api/v1/assets/uploads")
async def asset_upload(
    request: Request,
    media: UploadFile = File(...),
    name: str = Form(..., min_length=1, max_length=40),
    category_id: str = Form(..., pattern=r"^[a-z0-9-]{1,64}$"),
    asset_type: Literal["image", "video", "audio", "voice", "music"] | None = Form(default=None),
    prompt: str = Form(default="", max_length=8000),
) -> dict[str, Any]:
    owner = owner_id(request)
    if not relay.check_rate_limit(f"asset-upload-ip:{client_ip(request)}") or not relay.check_rate_limit(f"asset-upload-user:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    if category_id not in {item["id"] for item in asset_categories_for(owner)}:
        raise HTTPException(status_code=422, detail="invalid_asset_category")
    declared = str(media.content_type or "").lower().split(";", 1)[0]
    descriptor = ASSET_MEDIA_TYPES.get(declared)
    if not descriptor:
        raise HTTPException(status_code=415, detail="unsupported_asset_media_type")
    raw = await media.read(descriptor[2] + 1)
    await media.close()
    if not raw or len(raw) > descriptor[2]:
        raise HTTPException(status_code=413, detail="asset_media_too_large")
    suffix, canonical_type, family = _validated_asset_media(raw, declared)
    upload_path = UPLOAD_DIR / f"asset-{uuid.uuid4().hex}{suffix}"
    upload_path.write_bytes(raw)
    try:
        record = _asset_record(owner, upload_path, name, category_id, prompt, "upload", asset_type, canonical_type, family)
    finally:
        with contextlib.suppress(OSError):
            upload_path.unlink()
    return {"ok": True, "asset": {key: value for key, value in record.items() if key != "media_path"}}

@router.post("/api/v1/assets")
async def asset_create(payload: AssetCreateInput, request: Request) -> dict[str, Any]:
    owner = owner_id(request)
    if not relay.check_rate_limit(f"asset-create:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    valid_categories = {item["id"] for item in asset_categories_for(owner)}
    if payload.category_id not in valid_categories:
        raise HTTPException(status_code=422, detail="invalid_asset_category")
    try:
        source = private_or_generated_source(owner, payload.url)
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=404, detail="asset_source_not_found") from error
    media_descriptor = ASSET_SUFFIX_TYPES.get(source.suffix.lower())
    if not media_descriptor:
        raise HTTPException(status_code=415, detail="invalid_asset_source")
    media_type, family = media_descriptor
    record = _asset_record(
        owner, source, payload.name, payload.category_id, payload.prompt,
        payload.kind, payload.asset_type, media_type, family,
    )
    return {"ok": True, "asset": {key: value for key, value in record.items() if key != "media_path"}}

@router.delete("/api/v1/assets/{asset_id}")
async def asset_delete(asset_id: str, request: Request) -> dict[str, bool]:
    if not re.fullmatch(r"[a-f0-9]{32}", asset_id):
        raise HTTPException(status_code=404, detail="asset_not_found")
    owner = owner_id(request)
    if not relay.check_rate_limit(f"asset-delete:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    path = relay.database.media_path(owner, "asset", asset_id)
    if not path or not relay.database.delete_asset(owner, asset_id):
        raise HTTPException(status_code=404, detail="asset_not_found")
    with contextlib.suppress(OSError):
        path.unlink()
    return {"ok": True}

@router.get("/api/v1/private-media/{kind}/{record_id}")
async def private_media(kind: Literal["history", "asset", "video", "audio"], record_id: str, request: Request) -> FileResponse:
    if not re.fullmatch(r"[a-f0-9]{32}", record_id):
        raise HTTPException(status_code=404, detail="private_media_not_found")
    owner = owner_id(request)
    path = relay.database.media_path(owner, kind, record_id)
    if not path:
        raise HTTPException(status_code=404, detail="private_media_not_found")
    return FileResponse(path, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})

@router.post("/api/v1/feedback/screenshots")
async def feedback_screenshot_upload(request: Request, image: UploadFile = File(...)) -> JSONResponse:
    """Store an optional feedback screenshot outside the public generated-image mount."""
    relay.prune()
    owner = owner_id(request)
    if not relay.check_rate_limit(f"feedback-upload-ip:{client_ip(request)}") or not relay.check_rate_limit(f"feedback-upload-user:{owner}"):
        return JSONResponse({"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="unsupported_image_type")
    raw = await image.read(5 * 1024 * 1024 + 1)
    await image.close()
    if not raw or len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="upload_too_large")
    try:
        from PIL import Image, ImageOps, UnidentifiedImageError

        Image.MAX_IMAGE_PIXELS = MAX_UPLOAD_PIXELS
        with Image.open(io.BytesIO(raw)) as probe:
            probe.verify()
        with Image.open(io.BytesIO(raw)) as source:
            if source.width * source.height > MAX_UPLOAD_PIXELS:
                raise HTTPException(status_code=413, detail="upload_dimensions_too_large")
            normalized = ImageOps.exif_transpose(source).convert("RGB")
            normalized.thumbnail((2560, 2560), Image.Resampling.LANCZOS)
            screenshot_id = uuid.uuid4().hex
            path = FEEDBACK_DIR / f"{screenshot_id}.webp"
            normalized.save(path, format="WEBP", quality=86, method=6)
            with contextlib.suppress(OSError):
                path.chmod(0o600)
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=415, detail="invalid_image") from error
    relay.feedback_uploads[screenshot_id] = {"owner": owner, "path": path, "updated_at": time.time()}
    return JSONResponse({"screenshot_id": screenshot_id})

@router.post("/api/v1/feedback")
async def feedback_create(payload: FeedbackInput, request: Request) -> dict[str, bool]:
    relay.prune()
    owner = owner_id(request)
    if not relay.check_rate_limit(f"feedback-ip:{client_ip(request)}") or not relay.check_rate_limit(f"feedback-user:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    screenshot_file = None
    if payload.screenshot_id:
        screenshot = relay.feedback_uploads.get(payload.screenshot_id)
        if not screenshot or screenshot.get("owner") != owner:
            raise HTTPException(status_code=404, detail="feedback_screenshot_not_found")
        screenshot_path = Path(screenshot.get("path", ""))
        try:
            screenshot_path.resolve(strict=True).relative_to(FEEDBACK_DIR.resolve())
        except (OSError, ValueError) as error:
            raise HTTPException(status_code=404, detail="feedback_screenshot_not_found") from error
        screenshot_file = screenshot_path.name
        relay.feedback_uploads.pop(payload.screenshot_id, None)
    profile = relay.public_user(owner) if relay.database.user_exists(owner) else None
    relay.database.add_feedback({
        "id": uuid.uuid4().hex,
        "user_id": owner if profile else None,
        "username": profile["display_name"] if profile else "匿名用户",
        "category": payload.category,
        "message": payload.message,
        "screenshot_file": screenshot_file,
        "created_at": time.time(),
    })
    return {"ok": True}
