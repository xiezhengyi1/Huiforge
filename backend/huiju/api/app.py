"""FastAPI composition root; contains no business logic."""
from __future__ import annotations

import contextlib
import hashlib
import logging
import mimetypes
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from ..core.config import (
    APP_VERSION,
    BASE_DIR,
    FRONTEND_ASSET_PATHS,
    FRONTEND_ASSETS,
    FRONTEND_CSS_DIR,
    FRONTEND_JS_DIR,
    GENERATED_DIR,
    ICONS_DIR,
    MEDIA_WORKER_ENABLED,
    STATIC_DIR,
)
from .middleware import security_headers
from .routes.media import media_service, video_depth_service
from .router import include_api_routes
from ..runtime import relay

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
mimetypes.add_type("image/webp", ".webp")

def _load_frontend_payloads() -> dict[str, tuple[bytes, str, str]]:
    payloads: dict[str, tuple[bytes, str, str]] = {}
    for name in FRONTEND_ASSETS:
        content = FRONTEND_ASSET_PATHS[name].read_bytes()
        media_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        etag = f'"{hashlib.sha256(content).hexdigest()[:24]}"'
        payloads[name] = (content, media_type, etag)
    return payloads


FRONTEND_PAYLOADS = _load_frontend_payloads()


def frontend_response(request: Request, name: str) -> Response:
    content, media_type, etag = FRONTEND_PAYLOADS[name]
    headers = {"ETag": etag}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=content, media_type=media_type, headers=headers)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await relay.start()
    if MEDIA_WORKER_ENABLED and relay.client is not None:
        await media_service.start(relay.client)
    try:
        yield
    finally:
        if MEDIA_WORKER_ENABLED:
            await video_depth_service.stop()
            await media_service.stop()
        await relay.stop()


app = FastAPI(
    title="Huiju Image Relay", version=APP_VERSION, lifespan=lifespan,
)
app.middleware("http")(security_headers)
include_api_routes(app)


@app.get("/")
async def frontend_index(request: Request) -> Response:
    return frontend_response(request, "index.html")


@app.get("/{asset_name}")
async def frontend_asset(asset_name: str, request: Request) -> Response:
    if asset_name not in FRONTEND_ASSETS:
        raise HTTPException(status_code=404, detail="not_found")
    return frontend_response(request, asset_name)


app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")
app.mount("/css", StaticFiles(directory=FRONTEND_CSS_DIR), name="frontend-css")
app.mount("/js", StaticFiles(directory=FRONTEND_JS_DIR), name="frontend-js")
app.mount("/icons", StaticFiles(directory=ICONS_DIR), name="icons")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
