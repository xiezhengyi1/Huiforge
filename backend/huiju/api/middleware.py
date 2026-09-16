"""Session issuance, transport headers and request-size protections."""
from __future__ import annotations

import re
import secrets
import time
import uuid
from urllib.parse import urlsplit

from fastapi import Request
from fastapi.responses import JSONResponse, Response

from ..core.config import *
from ..runtime import relay


_VERSIONED_STATIC_SUFFIXES = (".css", ".js")
_PUBLIC_MEDIA_SUFFIXES = (".avif", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp", ".woff2")


def _cache_policy(request: Request) -> str:
    """Return the cache contract for a public response without caching private APIs."""
    path = request.url.path.lower()
    if path.startswith("/api/") or path.startswith("/generated/users/"):
        return "private, no-store"
    if path in {"/", "/index.html", "/studio.html", "/profile.html", "/pricing.html"}:
        return "no-cache, max-age=0, must-revalidate"
    if re.match(r"^/static/showcase/v\d+/", path):
        return "public, max-age=31536000, immutable"
    if path.endswith(_VERSIONED_STATIC_SUFFIXES):
        if request.query_params.get("v"):
            return "public, max-age=31536000, immutable"
        return "public, max-age=3600, stale-while-revalidate=86400"
    if path.startswith("/icons/") or path.endswith(_PUBLIC_MEDIA_SUFFIXES):
        return "public, max-age=86400, stale-while-revalidate=604800"
    return "private, no-store"


def _apply_transport_headers(request: Request, response: Response) -> Response:
    """Apply one transport contract to normal and middleware-rejected responses."""
    response.headers["X-Request-ID"] = request.state.request_id
    if request.state.set_session_cookie:
        response.set_cookie(
            "huiju_session",
            request.state.session_id,
            max_age=DEVICE_COOKIE_MAX_AGE,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite="lax",
            path="/",
        )
    # Endpoint-specific privacy policies (for example private media) win.  The
    # fallback keeps APIs private while allowing versioned frontend assets to
    # be reused by the browser instead of downloaded on every navigation.
    if "cache-control" not in response.headers:
        response.headers["Cache-Control"] = _cache_policy(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    if COOKIE_SECURE:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; "
        "style-src 'self'; img-src 'self' https://images.unsplash.com data: blob:; "
        "media-src 'self' blob: data:; connect-src 'self'; "
        "font-src 'self'; form-action 'self'; frame-ancestors 'none'"
    )
    return response


def _reject(request: Request, error: str, status_code: int) -> Response:
    return _apply_transport_headers(request, JSONResponse({"error": error}, status_code=status_code))

async def security_headers(request: Request, call_next):
    request.state.request_id = uuid.uuid4().hex
    supplied_session = request.cookies.get("huiju_session", "")
    session_is_valid = bool(re.fullmatch(r"[a-f0-9]{32}", supplied_session))
    request.state.session_id = supplied_session if session_is_valid else uuid.uuid4().hex
    is_health_probe = request.url.path in {"/api/v1/health/live", "/api/v1/health/ready"}
    request.state.set_session_cookie = not session_is_valid and not is_health_probe
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.url.path.startswith("/api/"):
        fetch_site = request.headers.get("sec-fetch-site", "").lower()
        if fetch_site == "cross-site":
            request.state.set_session_cookie = False
            return _reject(request, "cross_site_request_blocked", 403)
        origin = request.headers.get("origin", "").strip()
        if origin:
            parsed_origin = urlsplit(origin)
            request_host = request.headers.get("host", "").lower()
            if parsed_origin.scheme not in {"http", "https"} or parsed_origin.netloc.lower() != request_host:
                request.state.set_session_cookie = False
                return _reject(request, "cross_site_request_blocked", 403)
    if request.url.path.startswith(("/generated/users/", "/generated/assets/", "/generated/avatars/")):
        return _reject(request, "not_found", 404)
    if request.method == "POST" and request.url.path in {
        "/api/v1/images/generations", "/api/v1/images/tools", "/api/v1/images/analyze",
        "/api/v1/videos/generations", "/api/v1/audio/tts",
    }:
        content_type = request.headers.get("content-type", "")
        if not content_type.lower().startswith("application/json"):
            return _reject(request, "unsupported_media_type", 415)
        content_length_header = request.headers.get("content-length")
        if not content_length_header:
            return _reject(request, "content_length_required", 411)
        try:
            content_length = int(content_length_header)
        except ValueError:
            return _reject(request, "invalid_content_length", 400)
        if content_length < 0 or content_length > MAX_GENERATION_BODY_BYTES:
            return _reject(request, "request_too_large", 413)
    is_agent_json = request.method == "POST" and (
        request.url.path == "/api/v1/agents/short-drama/sessions"
        or bool(re.fullmatch(r"/api/v1/agents/short-drama/sessions/[a-f0-9]{32}/messages", request.url.path))
    )
    if is_agent_json:
        if not request.headers.get("content-type", "").lower().startswith("application/json"):
            return _reject(request, "unsupported_media_type", 415)
        try:
            content_length = int(request.headers.get("content-length", ""))
        except ValueError:
            return _reject(request, "content_length_required", 411)
        if content_length < 0 or content_length > MAX_AGENT_MESSAGE_BYTES:
            return _reject(request, "request_too_large", 413)
    if request.method in {"POST", "PATCH"} and request.url.path in {
        "/api/v1/users/register", "/api/v1/users/login", "/api/v1/users/logout",
        "/api/v1/users/sms/send",
        "/api/v1/users/me", "/api/v1/feedback", "/api/v1/workflows",
        "/api/v1/assets", "/api/v1/assets/categories",
    }:
        content_length_header = request.headers.get("content-length")
        if request.url.path != "/api/v1/users/logout":
            if not request.headers.get("content-type", "").lower().startswith("application/json"):
                return _reject(request, "unsupported_media_type", 415)
            if not content_length_header:
                return _reject(request, "content_length_required", 411)
        try:
            content_length = int(content_length_header or "0")
        except ValueError:
            return _reject(request, "invalid_content_length", 400)
        if content_length < 0 or content_length > MAX_ACCOUNT_BODY_BYTES:
            return _reject(request, "request_too_large", 413)
    if request.method == "POST" and request.url.path in {"/api/v1/images/uploads", "/api/v1/images/masks"}:
        content_type = request.headers.get("content-type", "")
        if not content_type.lower().startswith("multipart/form-data"):
            return _reject(request, "unsupported_media_type", 415)
        content_length_header = request.headers.get("content-length")
        if not content_length_header:
            return _reject(request, "content_length_required", 411)
        try:
            content_length = int(content_length_header)
        except ValueError:
            return _reject(request, "invalid_content_length", 400)
        if content_length < 0 or content_length > MAX_UPLOAD_BODY_BYTES:
            return _reject(request, "request_too_large", 413)
    multipart_limits = {
        "/api/v1/media/uploads": MAX_DEPTH_UPLOAD_BYTES + 64 * 1024,
        "/api/v1/videos/tools": MAX_DEPTH_UPLOAD_BYTES + 64 * 1024,
        "/api/v1/assets/uploads": max(MAX_VIDEO_DOWNLOAD_BYTES, MAX_AUDIO_DOWNLOAD_BYTES, MAX_UPLOAD_BODY_BYTES) + 64 * 1024,
        "/api/v1/feedback/screenshots": MAX_FEEDBACK_SCREENSHOT_BODY_BYTES,
    }
    multipart_limit = multipart_limits.get(request.url.path) if request.method == "POST" else None
    if multipart_limit is not None:
        if not request.headers.get("content-type", "").lower().startswith("multipart/form-data"):
            return _reject(request, "unsupported_media_type", 415)
        try:
            content_length = int(request.headers.get("content-length", ""))
        except ValueError:
            return _reject(request, "content_length_required", 411)
        if content_length < 0 or content_length > multipart_limit:
            return _reject(request, "request_too_large", 413)
    if request.method == "POST" and request.url.path == "/api/v1/videos/depth":
        if not request.headers.get("content-type", "").lower().startswith("multipart/form-data"):
            return _reject(request, "unsupported_media_type", 415)
        try:
            content_length = int(request.headers.get("content-length", ""))
        except ValueError:
            return _reject(request, "content_length_required", 411)
        if content_length < 0 or content_length > MAX_DEPTH_UPLOAD_BYTES + 64 * 1024:
            return _reject(request, "request_too_large", 413)
    if request.method == "POST" and request.url.path == "/api/v1/users/avatar":
        if not request.headers.get("content-type", "").lower().startswith("multipart/form-data"):
            return _reject(request, "unsupported_media_type", 415)
        try:
            content_length = int(request.headers.get("content-length", ""))
        except ValueError:
            return _reject(request, "content_length_required", 411)
        if content_length < 0 or content_length > MAX_AVATAR_BODY_BYTES:
            return _reject(request, "request_too_large", 413)
    response: Response = await call_next(request)
    return _apply_transport_headers(request, response)
