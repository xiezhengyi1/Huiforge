"""Owner-scoped asynchronous source-video workflows."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..dependencies import owner_id
from ..schemas import VideoWorkflowInput
from ...providers.video_workflows import VideoWorkflowService
from ...runtime import relay
from .media import media_service

router = APIRouter(prefix="/api/v1/video-workflows")
video_workflow_service = VideoWorkflowService(relay, media_service)


@router.post("/jobs")
async def submit_video_workflow(payload: VideoWorkflowInput, request: Request):
    return JSONResponse(video_workflow_service.submit(owner_id(request), payload), status_code=202)


@router.get("/jobs/{job_id}")
async def video_workflow_job(job_id: str, request: Request):
    result = video_workflow_service.get(owner_id(request), job_id)
    return JSONResponse(result, status_code=202 if result["status"] in {"queued", "running"} else 200)
