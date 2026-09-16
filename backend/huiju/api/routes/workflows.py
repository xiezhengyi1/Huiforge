"""Workflow sharing and owner-aware workflow persistence."""
from __future__ import annotations

import asyncio
import contextlib
import hmac
import io
import json
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from ...catalog.models import *
from ...core.config import *
from ..dependencies import *
from ...runtime import *
from ..schemas import *

router = APIRouter()

def public_workflow(record: dict[str, Any], include_graph: bool = False) -> dict[str, Any]:
    nodes = record.get("graph", {}).get("nodes", [])
    node_types = {str(node.get("type", "")) for node in nodes}
    media_types: list[str] = []
    if any("video" in item for item in node_types):
        media_types.append("视频")
    if any("audio" in item or "speech" in item for item in node_types):
        media_types.append("音频")
    if any("image" in item for item in node_types):
        media_types.append("图像")
    if not media_types:
        media_types.append("综合")
    result = {
        "id": record["id"], "name": record["name"], "description": record.get("description", ""),
        "author": record.get("author", "匿名创作者"), "node_count": len(nodes),
        "tags": record.get("tags", []), "media_types": media_types,
        "likes_count": int(record.get("likes_count", 0)),
        "comments_count": int(record.get("comments_count", 0)),
        "uses_count": int(record.get("uses_count", 0)),
        "liked_by_viewer": bool(record.get("liked_by_viewer", False)),
        "created_at": record.get("created_at", 0),
    }
    if include_graph:
        result["graph"] = record.get("graph", {})
    return result

@router.get("/api/v1/workflows")
async def workflows_list(
    request: Request,
    limit: int = Query(default=24, ge=1, le=50),
    q: str = Query(default="", max_length=40),
    sort: Literal["recommended", "latest", "liked", "used"] = "recommended",
) -> dict[str, Any]:
    safe_limit = min(max(limit, 1), 50)
    records = relay.database.list_shared_workflows(safe_limit, q, sort, owner_id(request))
    return {"items": [public_workflow(record) for record in records]}

@router.get("/api/v1/workflows/{workflow_id}")
async def workflow_get(workflow_id: str, request: Request) -> dict[str, Any]:
    if not re.fullmatch(r"[a-f0-9]{12}", workflow_id):
        raise HTTPException(status_code=404, detail="workflow_not_found")
    record = relay.database.get_workflow(workflow_id, owner_id(request))
    if not record:
        raise HTTPException(status_code=404, detail="workflow_not_found")
    return {"workflow": public_workflow(record, include_graph=True)}

@router.post("/api/v1/workflows")
async def workflow_create(payload: WorkflowCreateInput, request: Request) -> dict[str, Any]:
    if not relay.check_rate_limit(f"workflow:{client_ip(request)}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    owner = owner_id(request)
    profile = relay.public_user(owner) if relay.database.user_exists(owner) else None
    graph = payload.graph.model_dump(mode="json")
    node_ids = {node["id"] for node in graph["nodes"]}
    seen_edges: set[tuple[str, str]] = set()
    valid_edges: list[dict[str, str]] = []
    for edge in graph.get("edges", []):
        signature = (edge["from_node"], edge["to_node"])
        if edge["from_node"] == edge["to_node"] or not set(signature).issubset(node_ids) or signature in seen_edges:
            continue
        seen_edges.add(signature)
        valid_edges.append(edge)
    graph["edges"] = valid_edges
    for node in graph["nodes"]:
        sanitized: dict[str, str | int | float | bool] = {}
        for key, value in node.get("config", {}).items():
            if not re.fullmatch(r"[a-z][a-z0-9_]{0,31}", key):
                continue
            sanitized[key] = value[:1000] if isinstance(value, str) else value
        node["config"] = sanitized
    workflow_id = uuid.uuid4().hex[:12]
    record = {
        "id": workflow_id, "owner": owner, "author": profile["display_name"] if profile else "匿名创作者",
        "name": payload.name, "description": payload.description, "tags": payload.tags,
        "graph": graph, "created_at": time.time(),
    }
    relay.database.create_workflow(record)
    return {"ok": True, "workflow": public_workflow(record, include_graph=True)}

@router.post("/api/v1/workflows/{workflow_id}/like")
async def workflow_like(workflow_id: str, request: Request) -> dict[str, Any]:
    if not re.fullmatch(r"[a-f0-9]{12}", workflow_id):
        raise HTTPException(status_code=404, detail="workflow_not_found")
    if not relay.check_rate_limit(f"workflow-like:{owner_id(request)}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    result = relay.database.toggle_workflow_like(workflow_id, owner_id(request))
    if result is None:
        raise HTTPException(status_code=404, detail="workflow_not_found")
    liked, likes_count = result
    return {"ok": True, "liked": liked, "likes_count": likes_count}

@router.get("/api/v1/workflows/{workflow_id}/comments")
async def workflow_comments(workflow_id: str, limit: int = Query(default=30, ge=1, le=50)) -> dict[str, Any]:
    if not re.fullmatch(r"[a-f0-9]{12}", workflow_id):
        raise HTTPException(status_code=404, detail="workflow_not_found")
    if not relay.database.get_workflow(workflow_id):
        raise HTTPException(status_code=404, detail="workflow_not_found")
    return {"items": relay.database.list_workflow_comments(workflow_id, limit)}

@router.post("/api/v1/workflows/{workflow_id}/comments")
async def workflow_comment_create(workflow_id: str, payload: WorkflowCommentInput, request: Request) -> dict[str, Any]:
    if not re.fullmatch(r"[a-f0-9]{12}", workflow_id):
        raise HTTPException(status_code=404, detail="workflow_not_found")
    owner = owner_id(request)
    if not relay.check_rate_limit(f"workflow-comment:{owner}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    profile = relay.public_user(owner) if relay.database.user_exists(owner) else None
    record = {
        "id": uuid.uuid4().hex[:16], "workflow_id": workflow_id, "owner": owner,
        "author": profile["display_name"] if profile else "神秘画家",
        "content": payload.content, "created_at": time.time(),
    }
    if not relay.database.add_workflow_comment(record):
        raise HTTPException(status_code=404, detail="workflow_not_found")
    return {"ok": True, "comment": {key: record[key] for key in ("id", "author", "content", "created_at")}}

@router.post("/api/v1/workflows/{workflow_id}/use")
async def workflow_use(workflow_id: str, request: Request) -> dict[str, Any]:
    if not re.fullmatch(r"[a-f0-9]{12}", workflow_id):
        raise HTTPException(status_code=404, detail="workflow_not_found")
    if not relay.check_rate_limit(f"workflow-use:{owner_id(request)}"):
        raise HTTPException(status_code=429, detail="rate_limited")
    record = relay.database.mark_workflow_used(workflow_id)
    if not record:
        raise HTTPException(status_code=404, detail="workflow_not_found")
    return {"ok": True, "workflow": public_workflow(record, include_graph=True)}
