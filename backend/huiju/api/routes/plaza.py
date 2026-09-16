"""Public plaza posts backed by copies of creator-owned media."""
from __future__ import annotations

import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from ...core.config import PRIVATE_MEDIA_DIR
from ...runtime import private_or_generated_source, relay
from ..dependencies import owner_id
from ..schemas import PlazaPostCreateInput

router = APIRouter()

MEDIA_TYPES = {
    ".png": ("image", "image/png"),
    ".jpg": ("image", "image/jpeg"),
    ".jpeg": ("image", "image/jpeg"),
    ".webp": ("image", "image/webp"),
    ".mp4": ("video", "video/mp4"),
    ".mov": ("video", "video/quicktime"),
    ".webm": ("video", "video/webm"),
}


def public_post(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"], "author": record["author"], "title": record["title"],
        "prompt": record["prompt"], "model": record["model"], "media_type": record["media_type"],
        "tags": record["tags"], "likes_count": int(record["likes_count"]),
        "liked_by_viewer": bool(record.get("liked_by_viewer", False)), "created_at": record["created_at"],
        "url": f"/api/v1/plaza/{record['id']}/media",
    }


@router.get("/api/v1/plaza")
async def plaza_list(request: Request, limit: int = Query(default=24, ge=1, le=50)) -> dict[str, Any]:
    records = relay.database.list_plaza_posts(limit, owner_id(request))
    return {"items": [public_post(record) for record in records]}


@router.post("/api/v1/plaza")
async def plaza_create(payload: PlazaPostCreateInput, request: Request) -> dict[str, Any]:
    owner = owner_id(request)
    if not relay.check_rate_limit(f"plaza:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    try:
        source = private_or_generated_source(owner, payload.url)
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=404, detail="plaza_source_not_found") from error
    media = MEDIA_TYPES.get(source.suffix.lower())
    if not media:
        raise HTTPException(status_code=415, detail="unsupported_plaza_media")
    post_id = uuid.uuid4().hex
    destination_dir = PRIVATE_MEDIA_DIR / "plaza"
    destination_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    destination = destination_dir / f"{post_id}{source.suffix.lower()}"
    try:
        shutil.copy2(source, destination)
        destination.chmod(0o600)
    except OSError as error:
        raise HTTPException(status_code=503, detail="plaza_copy_failed") from error
    profile = relay.public_user(owner) if relay.database.user_exists(owner) else None
    record = {
        "id": post_id, "owner": owner, "author": profile["display_name"] if profile else "匿名创作者",
        "title": payload.title, "prompt": payload.prompt, "model": payload.model, "tags": payload.tags,
        "media_path": destination.relative_to(PRIVATE_MEDIA_DIR).as_posix(),
        "media_type": media[0], "mime_type": media[1], "created_at": time.time(), "likes_count": 0,
    }
    relay.database.create_plaza_post(record)
    return {"ok": True, "post": public_post(record)}


@router.get("/api/v1/plaza/{post_id}/media")
async def plaza_media(post_id: str) -> FileResponse:
    if not re.fullmatch(r"[a-f0-9]{32}", post_id):
        raise HTTPException(status_code=404, detail="plaza_post_not_found")
    record = relay.database.plaza_post(post_id)
    path = relay.database.plaza_media_path(post_id)
    if not record or not path:
        raise HTTPException(status_code=404, detail="plaza_post_not_found")
    return FileResponse(path, media_type=record["mime_type"], headers={"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff"})


@router.post("/api/v1/plaza/{post_id}/like")
async def plaza_like(post_id: str, request: Request) -> dict[str, Any]:
    if not re.fullmatch(r"[a-f0-9]{32}", post_id):
        raise HTTPException(status_code=404, detail="plaza_post_not_found")
    owner = owner_id(request)
    if not relay.check_rate_limit(f"plaza-like:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    result = relay.database.toggle_plaza_like(post_id, owner)
    if result is None:
        raise HTTPException(status_code=404, detail="plaza_post_not_found")
    liked, likes_count = result
    return {"ok": True, "liked": liked, "likes_count": likes_count}
