"""Lightweight sticky-session edge for the multi-process production layout.

Frontend payloads are served from memory here.  Stateful generation routes are
pinned to backend zero, while account/catalog/workflow traffic is consistently
distributed across four application processes.  This keeps in-memory jobs and
the single GPU safe without forcing every browser request through one Python
application worker.
"""
from __future__ import annotations

import asyncio
import contextlib
import hashlib
import mimetypes
import os
import re
import sqlite3
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.background import BackgroundTask

from ..core.config import (
    APP_VERSION,
    ANALYTICS_BACKUP_DIR,
    BASE_DIR,
    COOKIE_SECURE,
    DEVICE_COOKIE_MAX_AGE,
    EDGE_STATS_DB,
    FRONTEND_ASSET_PATHS,
    FRONTEND_ASSETS,
    RELEASE_ID,
)
from ..persistence.analytics import create_edge_snapshot, traffic_snapshot

BACKEND_COUNT = max(1, min(16, int(os.getenv("HUIJU_BACKEND_COUNT", "4"))))
BACKEND_HOST = os.getenv("HUIJU_BACKEND_HOST", "127.0.0.1")
BACKEND_FIRST_PORT = int(os.getenv("HUIJU_BACKEND_FIRST_PORT", "8100"))
SESSION_PATTERN = re.compile(r"[a-f0-9]{32}")
HOP_HEADERS = frozenset({
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
})
STATEFUL_PREFIXES = (
    "/api/v1/images", "/api/v1/videos", "/api/v1/audio", "/api/v1/media",
    "/api/v1/agents", "/api/v1/private-media", "/api/v1/provider-uploads", "/generated/",
)
CHINA_TZ = timezone(timedelta(hours=8))
EDGE_CACHE_SECONDS = {
    "/api/v1/capabilities": 5,
    "/api/v1/images/tool-presets": 300,
}


def _frontend_payloads() -> dict[str, tuple[bytes, str, str]]:
    payloads: dict[str, tuple[bytes, str, str]] = {}
    for name in FRONTEND_ASSETS:
        content = FRONTEND_ASSET_PATHS[name].read_bytes()
        media_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        payloads[name] = (content, media_type, f'"{hashlib.sha256(content).hexdigest()[:24]}"')
    return payloads


FRONTEND_PAYLOADS = _frontend_payloads()


def _security_headers(response: Response, path: str) -> None:
    if "cache-control" not in response.headers:
        if path in {"/", "/index.html", "/studio.html", "/profile.html", "/pricing.html"}:
            response.headers["Cache-Control"] = "no-cache, max-age=0, must-revalidate"
        elif path.endswith((".css", ".js")):
            response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
        else:
            response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    if COOKIE_SECURE:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; "
        "style-src 'self'; img-src 'self' https://images.unsplash.com data: blob:; "
        "media-src 'self' blob: data:; connect-src 'self'; font-src 'self'; "
        "form-action 'self'; frame-ancestors 'none'"
    )


class EdgeState:
    def __init__(self) -> None:
        self.client: httpx.AsyncClient | None = None
        self.pending_page_views = 0
        self.pending_clicks = 0
        self.pending_visitors: set[str] = set()
        self.pending_daily: dict[str, dict[str, object]] = defaultdict(
            lambda: {"page_views": 0, "api_writes": 0, "visitors": set()},
        )
        self.flush_task: asyncio.Task[None] | None = None
        self.response_cache: dict[str, tuple[float, int, dict[str, str], bytes]] = {}
        self.cache_locks = {path: asyncio.Lock() for path in EDGE_CACHE_SECONDS}
        self._initialize_stats_database()
        create_edge_snapshot(source=EDGE_STATS_DB, backup_dir=ANALYTICS_BACKUP_DIR)

    def _initialize_stats_database(self) -> None:
        """Create the shared WAL store."""
        EDGE_STATS_DB.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with sqlite3.connect(EDGE_STATS_DB, timeout=30) as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA synchronous=NORMAL")
            connection.execute("CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL)")
            connection.execute("CREATE TABLE IF NOT EXISTS visitors (session_id TEXT PRIMARY KEY)")
            connection.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            connection.execute(
                """CREATE TABLE IF NOT EXISTS daily_counters (
                    day TEXT PRIMARY KEY,
                    page_views INTEGER NOT NULL DEFAULT 0,
                    api_writes INTEGER NOT NULL DEFAULT 0
                )""",
            )
            connection.execute(
                """CREATE TABLE IF NOT EXISTS daily_visitors (
                    day TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    PRIMARY KEY(day, session_id)
                )""",
            )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_daily_visitors_session ON daily_visitors(session_id, day)")
            connection.execute(
                "INSERT OR IGNORE INTO metadata(key, value) VALUES ('daily_tracking_started_at', ?)",
                (str(time.time()),),
            )
            connection.execute(
                "INSERT OR IGNORE INTO counters(key, value) VALUES ('page_views', ?)",
                (0,),
            )
            connection.execute(
                "INSERT OR IGNORE INTO counters(key, value) VALUES ('clicks', ?)",
                (0,),
            )
            connection.execute(
                "INSERT OR IGNORE INTO metadata(key, value) VALUES ('started_at', ?)",
                (str(time.time()),),
            )

    def record(self, method: str, path: str, session_id: str) -> None:
        page_view = method == "GET" and path in {"/", "/index.html", "/studio.html"}
        click = method == "POST" and path.startswith("/api/") and path != "/api/v1/stats"
        if not (page_view or click):
            return
        self.pending_visitors.add(session_id)
        day = datetime.now(CHINA_TZ).strftime("%Y-%m-%d")
        bucket = self.pending_daily[day]
        if page_view:
            self.pending_page_views += 1
            bucket["page_views"] = int(bucket["page_views"]) + 1
            visitors = bucket["visitors"]
            assert isinstance(visitors, set)
            visitors.add(session_id)
        else:
            self.pending_clicks += 1
            bucket["api_writes"] = int(bucket["api_writes"]) + 1

    @staticmethod
    def _write_batch(
        page_views: int,
        clicks: int,
        visitors: set[str],
        daily: dict[str, dict[str, object]],
    ) -> None:
        with sqlite3.connect(EDGE_STATS_DB, timeout=30) as connection:
            connection.execute("PRAGMA synchronous=NORMAL")
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("UPDATE counters SET value = value + ? WHERE key = 'page_views'", (page_views,))
            connection.execute("UPDATE counters SET value = value + ? WHERE key = 'clicks'", (clicks,))
            connection.executemany(
                "INSERT OR IGNORE INTO visitors(session_id) VALUES (?)",
                ((session_id,) for session_id in visitors),
            )
            for day, bucket in daily.items():
                connection.execute(
                    """INSERT INTO daily_counters(day,page_views,api_writes) VALUES(?,?,?)
                       ON CONFLICT(day) DO UPDATE SET
                         page_views=page_views+excluded.page_views,
                         api_writes=api_writes+excluded.api_writes""",
                    (day, int(bucket["page_views"]), int(bucket["api_writes"])),
                )
                day_visitors = bucket["visitors"]
                assert isinstance(day_visitors, set)
                connection.executemany(
                    "INSERT OR IGNORE INTO daily_visitors(day,session_id) VALUES(?,?)",
                    ((day, session_id) for session_id in day_visitors),
                )

    async def flush(self) -> None:
        if not (self.pending_page_views or self.pending_clicks or self.pending_visitors or self.pending_daily):
            return
        page_views, self.pending_page_views = self.pending_page_views, 0
        clicks, self.pending_clicks = self.pending_clicks, 0
        visitors, self.pending_visitors = self.pending_visitors, set()
        daily, self.pending_daily = self.pending_daily, defaultdict(
            lambda: {"page_views": 0, "api_writes": 0, "visitors": set()},
        )
        try:
            await asyncio.to_thread(self._write_batch, page_views, clicks, visitors, daily)
            await asyncio.to_thread(
                create_edge_snapshot, source=EDGE_STATS_DB, backup_dir=ANALYTICS_BACKUP_DIR,
            )
        except sqlite3.Error:
            self.pending_page_views += page_views
            self.pending_clicks += clicks
            self.pending_visitors.update(visitors)
            for day, failed_bucket in daily.items():
                current = self.pending_daily[day]
                current["page_views"] = int(current["page_views"]) + int(failed_bucket["page_views"])
                current["api_writes"] = int(current["api_writes"]) + int(failed_bucket["api_writes"])
                current_visitors = current["visitors"]
                failed_visitors = failed_bucket["visitors"]
                assert isinstance(current_visitors, set) and isinstance(failed_visitors, set)
                current_visitors.update(failed_visitors)

    async def snapshot(self) -> dict[str, int | float]:
        await self.flush()
        return await asyncio.to_thread(traffic_snapshot, EDGE_STATS_DB)

    async def cached_get(
        self, path: str, target: str, headers: dict[str, str],
    ) -> tuple[int, dict[str, str], bytes]:
        now = time.monotonic()
        cached = self.response_cache.get(path)
        if cached and cached[0] > now:
            return cached[1], cached[2], cached[3]
        async with self.cache_locks[path]:
            now = time.monotonic()
            cached = self.response_cache.get(path)
            if cached and cached[0] > now:
                return cached[1], cached[2], cached[3]
            assert self.client is not None
            upstream = await self.client.get(target, headers=headers)
            response_headers = {
                key: value for key, value in upstream.headers.items()
                if key.lower() not in HOP_HEADERS and key.lower() != "set-cookie"
            }
            result = (upstream.status_code, response_headers, upstream.content)
            if upstream.status_code == 200:
                self.response_cache[path] = (
                    now + EDGE_CACHE_SECONDS[path], upstream.status_code,
                    response_headers, upstream.content,
                )
            return result

    async def flush_loop(self) -> None:
        while True:
            await asyncio.sleep(2)
            await self.flush()


edge = EdgeState()


@asynccontextmanager
async def lifespan(_: FastAPI):
    limits = httpx.Limits(max_connections=4096, max_keepalive_connections=1024, keepalive_expiry=20)
    edge.client = httpx.AsyncClient(timeout=httpx.Timeout(300, connect=3), limits=limits, trust_env=False)
    edge.flush_task = asyncio.create_task(edge.flush_loop(), name="edge-stats-flush")
    try:
        yield
    finally:
        if edge.flush_task:
            edge.flush_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await edge.flush_task
        await edge.flush()
        if edge.client:
            await edge.client.aclose()


app = FastAPI(title="Huiju Edge", version=APP_VERSION, lifespan=lifespan)


def _session(request: Request) -> tuple[str, bool]:
    supplied = request.cookies.get("huiju_session", "")
    valid = bool(SESSION_PATTERN.fullmatch(supplied))
    return (supplied if valid else uuid.uuid4().hex), not valid


def _backend_index(path: str, session_id: str) -> int:
    if path.startswith(STATEFUL_PREFIXES) or path in {"/api/v1/health/ready", "/api/v1/health/live"}:
        return 0
    return int.from_bytes(hashlib.blake2s(session_id.encode(), digest_size=2).digest(), "big") % BACKEND_COUNT


def _cookie_header(original: str, session_id: str) -> str:
    """Replace, rather than duplicate, an invalid session cookie."""
    parts = []
    for part in original.split(";"):
        candidate = part.strip()
        if candidate and candidate.split("=", 1)[0].strip() != "huiju_session":
            parts.append(candidate)
    parts.append(f"huiju_session={session_id}")
    return "; ".join(parts)


def _set_cookie(response: Response, session_id: str, required: bool, path: str) -> None:
    if required and path not in {"/api/v1/health/live", "/api/v1/health/ready"}:
        response.set_cookie(
            "huiju_session", session_id, max_age=DEVICE_COOKIE_MAX_AGE,
            httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/",
        )


def _frontend_response(request: Request, name: str, session_id: str, set_cookie: bool) -> Response:
    content, media_type, etag = FRONTEND_PAYLOADS[name]
    if request.headers.get("if-none-match") == etag:
        response = Response(status_code=304, headers={"ETag": etag})
    else:
        response = Response(content=content, media_type=media_type, headers={"ETag": etag})
    _set_cookie(response, session_id, set_cookie, request.url.path)
    _security_headers(response, request.url.path)
    return response


@app.get("/api/v1/stats")
async def stats(request: Request) -> JSONResponse:
    session_id, set_cookie = _session(request)
    response = JSONResponse(await edge.snapshot())
    _set_cookie(response, session_id, set_cookie, request.url.path)
    _security_headers(response, request.url.path)
    return response


@app.api_route("/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def dispatch(request: Request, path: str) -> Response:
    request_path = "/" + path
    session_id, set_cookie = _session(request)
    edge.record(request.method, request_path, session_id)
    frontend_name = "index.html" if not path else path
    if frontend_name in FRONTEND_PAYLOADS:
        return _frontend_response(request, frontend_name, session_id, set_cookie)

    backend = _backend_index(request_path, session_id)
    target = f"http://{BACKEND_HOST}:{BACKEND_FIRST_PORT + backend}{request.url.path}"
    if request.url.query:
        target += "?" + request.url.query
    headers = {key: value for key, value in request.headers.items() if key.lower() not in HOP_HEADERS}
    headers["cookie"] = _cookie_header(request.headers.get("cookie", ""), session_id)
    headers["x-forwarded-for"] = request.client.host if request.client else "127.0.0.1"
    headers["x-forwarded-proto"] = request.url.scheme
    headers["x-forwarded-host"] = request.headers.get("host", "")
    if request.method == "GET" and request_path in EDGE_CACHE_SECONDS:
        try:
            status_code, response_headers, content = await edge.cached_get(request_path, target, headers)
            response = Response(content=content, status_code=status_code, headers=response_headers)
            _set_cookie(response, session_id, set_cookie, request_path)
            _security_headers(response, request_path)
            return response
        except (httpx.HTTPError, AssertionError):
            response = JSONResponse({"error": "service_temporarily_unavailable"}, status_code=503)
            response.headers["Retry-After"] = "2"
            _set_cookie(response, session_id, set_cookie, request_path)
            _security_headers(response, request_path)
            return response
    try:
        assert edge.client is not None
        upstream_request = edge.client.build_request(
            request.method, target, headers=headers, content=request.stream(),
        )
        upstream = await edge.client.send(upstream_request, stream=True)
    except (httpx.HTTPError, AssertionError):
        response = JSONResponse({"error": "service_temporarily_unavailable"}, status_code=503)
        response.headers["Retry-After"] = "2"
        _set_cookie(response, session_id, set_cookie, request_path)
        _security_headers(response, request_path)
        return response

    response_headers = {
        key: value for key, value in upstream.headers.items()
        if key.lower() not in HOP_HEADERS and key.lower() != "set-cookie"
    }
    response = StreamingResponse(
        upstream.aiter_raw(), status_code=upstream.status_code,
        headers=response_headers, background=BackgroundTask(upstream.aclose),
    )
    for cookie in upstream.headers.get_list("set-cookie"):
        response.headers.append("set-cookie", cookie)
    _set_cookie(response, session_id, set_cookie, request_path)
    _security_headers(response, request_path)
    return response
