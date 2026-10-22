"""Owner-scoped storyboard quotes, generation and composition."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..dependencies import owner_id
from ..schemas import StoryboardComposeInput, StoryboardGenerationInput
from ...providers.storyboard import StoryboardService
from ...runtime import relay
from .media import media_service

router = APIRouter(prefix="/api/v1/storyboards")
storyboard_service = StoryboardService(relay, media_service)


@router.post("/quotes")
async def quote_storyboard(payload: StoryboardGenerationInput, request: Request):
    return storyboard_service.quote(owner_id(request), payload)


@router.post("/jobs")
async def create_storyboard(payload: StoryboardGenerationInput, request: Request):
    return JSONResponse(storyboard_service.submit(owner_id(request), payload), status_code=202)


@router.post("/compose")
async def compose_storyboard(payload: StoryboardComposeInput, request: Request):
    return JSONResponse(storyboard_service.submit_compose(owner_id(request), payload), status_code=202)


@router.get("/jobs/{job_id}")
async def storyboard_job(job_id: str, request: Request):
    result = storyboard_service.get(owner_id(request), job_id)
    return JSONResponse(result, status_code=202 if result["status"] in {"queued", "running"} else 200)
