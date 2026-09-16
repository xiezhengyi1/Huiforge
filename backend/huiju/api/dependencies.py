"""Request identity, authorization and shared response helpers."""
from __future__ import annotations

import hmac
import json
import logging
from typing import Any, Literal

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from ..core.config import *
from ..runtime import relay

logger = logging.getLogger("huiju.relay")

def client_ip(request: Request) -> str:
    # X-Forwarded-For is intentionally ignored until a specific trusted proxy is configured.
    return request.client.host if request.client else "unknown"

async def volc_sms_request(action: Literal["SendSmsVerifyCode", "CheckSmsVerifyCode"], payload: dict[str, Any]) -> dict[str, Any]:
    if not sms_is_configured() or relay.client is None:
        raise HTTPException(status_code=503, detail="sms_not_configured")
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    query, headers = volc_sms_signed_headers(action, body)
    try:
        response = await relay.client.post(
            f"https://sms.volcengineapi.com/?{query}", content=body, headers=headers, timeout=15.0,
        )
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("Volcengine SMS request failed action=%s error=%s", action, type(error).__name__)
        raise HTTPException(status_code=502, detail="sms_provider_unavailable") from error
    metadata = result.get("ResponseMetadata") if isinstance(result, dict) else None
    provider_error = metadata.get("Error") if isinstance(metadata, dict) else None
    if response.status_code >= 400 or provider_error:
        error_code = provider_error.get("Code") if isinstance(provider_error, dict) else "provider_error"
        logger.warning("Volcengine SMS rejected action=%s code=%s", action, error_code)
        raise HTTPException(status_code=502, detail="sms_provider_rejected")
    return result

def session_id(request: Request) -> str:
    """Return a server-issued opaque session identifier, never an IP-derived identity."""
    value = getattr(request.state, "session_id", None)
    if not isinstance(value, str):
        raise RuntimeError("session middleware did not initialize")
    return value

def owner_id(request: Request) -> str:
    """Resolve the effective owner: bound user id if device is bound, else device_id."""
    return relay.owner_for_device(session_id(request))

def require_usage_admin(request: Request) -> None:
    if not ADMIN_USAGE_TOKEN:
        raise HTTPException(status_code=503, detail="admin_usage_not_configured")
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
    if not token or not hmac.compare_digest(token, ADMIN_USAGE_TOKEN):
        raise HTTPException(status_code=401, detail="admin_token_invalid")

def job_response(job_id: str, job: dict[str, Any]) -> JSONResponse:
    if job["status"] == "completed":
        return JSONResponse({"request_id": job_id, "status": "completed", "images": job["images"]})
    if job["status"] == "cancelled":
        return JSONResponse({"request_id": job_id, "status": "cancelled"})
    return JSONResponse(
        {"request_id": job_id, "status": job["status"], "status_url": f"/api/v1/images/jobs/{job_id}"},
        status_code=202,
    )
