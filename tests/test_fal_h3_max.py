import asyncio
from pathlib import Path

from pydantic import ValidationError
import pytest

from backend.huiju.core.config import (
    FAL_H3_MAX_ENDPOINTS,
    FAL_H3_MAX_MODEL_ID,
    FAL_H3_MAX_QUEUE_APPLICATION,
)
from backend.huiju.catalog.pricing import video_quote
from backend.huiju.providers.bailian_media import BailianMediaService, _allowed_provider_host
from backend.huiju.api.schemas import VideoGenerationInput


ROOT = Path(__file__).resolve().parents[1]


def test_h3_max_schema_accepts_official_text_and_image_modes():
    text = VideoGenerationInput(
        prompt="雨夜街道，镜头缓慢向前推进",
        operation="text_to_video",
        model=FAL_H3_MAX_MODEL_ID,
        resolution="768P",
        ratio="21:9",
        duration=15,
    )
    image = VideoGenerationInput(
        prompt="人物回头，风吹动衣角",
        operation="image_to_video",
        model=FAL_H3_MAX_MODEL_ID,
        upload_ids=["a" * 32],
        resolution="480P",
        duration=5,
    )

    assert text.resolution == "768P"
    assert image.upload_ids == ["a" * 32]


@pytest.mark.parametrize(
    "payload",
    [
        {"operation": "reference_to_video", "resolution": "768P", "duration": 5, "upload_ids": ["a" * 32]},
        {"operation": "text_to_video", "resolution": "720P", "duration": 5},
        {"operation": "text_to_video", "resolution": "768P", "duration": 4},
        {"operation": "text_to_video", "resolution": "768P", "duration": 16},
    ],
)
def test_h3_max_schema_rejects_unsupported_modes_resolution_and_duration(payload):
    with pytest.raises(ValidationError):
        VideoGenerationInput(prompt="测试视频提示词", model=FAL_H3_MAX_MODEL_ID, **payload)


def test_h3_max_pricing_uses_official_non_promotional_rate_card():
    public_480 = video_quote(FAL_H3_MAX_MODEL_ID, "480P", 5, False, member=False)
    member_480 = video_quote(FAL_H3_MAX_MODEL_ID, "480P", 5, False, member=True)
    public_768 = video_quote(FAL_H3_MAX_MODEL_ID, "768P", 5, False, member=False)
    member_768 = video_quote(FAL_H3_MAX_MODEL_ID, "768P", 5, False, member=True)

    assert (public_480["unit_credits"], member_480["unit_credits"]) == (9, 7)
    assert (public_768["unit_credits"], member_768["unit_credits"]) == (12, 10)
    assert public_480["provider_cost_cny"] == 1.8
    assert public_768["provider_cost_cny"] == 2.88
    assert "fal.ai H3 Max 官方常规价" in public_768["pricing_source"]


def test_h3_max_provider_builds_official_request_shapes():
    text_endpoint, text_body = BailianMediaService._fal_video_input({
        "operation": "text_to_video",
        "prompt": "镜头横移，环境音清晰",
        "duration": 10,
        "resolution": "768P",
        "ratio": "16:9",
        "media_urls": [],
    })
    image_endpoint, image_body = BailianMediaService._fal_video_input({
        "operation": "image_to_video",
        "prompt": "镜头慢慢拉远",
        "duration": 5,
        "resolution": "480P",
        "ratio": "1:1",
        "media_urls": ["https://example.test/provider-image"],
    })

    assert text_endpoint == FAL_H3_MAX_ENDPOINTS["text_to_video"]
    assert text_body == {
        "prompt": "镜头横移，环境音清晰",
        "duration": 10,
        "resolution": "768P",
        "enable_safety_checker": True,
        "sync_mode": False,
        "prompt_expansion_mode": "balanced",
        "aspect_ratio": "16:9",
    }
    assert image_endpoint == FAL_H3_MAX_ENDPOINTS["image_to_video"]
    assert image_body["image_url"] == "https://example.test/provider-image"
    assert "aspect_ratio" not in image_body


def test_h3_max_queue_status_and_result_use_application_root():
    request_id = "764cabcf-b745-4b3e-ae38-1200304cf45b"

    assert FAL_H3_MAX_QUEUE_APPLICATION == "minimax/h3-max"
    assert BailianMediaService._fal_queue_request_path(request_id, status=True) == (
        f"/minimax/h3-max/requests/{request_id}/status"
    )
    assert BailianMediaService._fal_queue_request_path(request_id, status=False) == (
        f"/minimax/h3-max/requests/{request_id}"
    )


def test_provider_task_id_never_prefers_request_trace_id():
    assert BailianMediaService._provider_task_id({
        "request_id": "trace-id",
        "output": {"task_id": "dashscope-task-id", "task_status": "PENDING"},
    }) == "dashscope-task-id"
    assert BailianMediaService._provider_task_id({
        "request_id": "trace-id",
        "id": "ark-task-id",
        "status": "queued",
    }) == "ark-task-id"


def test_fal_requests_keep_credentials_server_side(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"status": "IN_QUEUE", "request_id": "request-id"}

    class Client:
        def __init__(self):
            self.request_call = None

        async def request(self, *args, **kwargs):
            self.request_call = (args, kwargs)
            return Response()

    monkeypatch.setattr("backend.huiju.providers.bailian_media.FAL_KEY", "test-fal-key")
    service = BailianMediaService.__new__(BailianMediaService)
    service.client = Client()
    result = asyncio.run(service._request_fal_json("GET", "/health"))
    _, kwargs = service.client.request_call

    assert result["request_id"] == "request-id"
    assert kwargs["headers"]["Authorization"].startswith("Key ")
    assert "FAL_KEY" not in (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    assert _allowed_provider_host("v3b.fal.media") is True
    assert _allowed_provider_host("attacker.example") is False


def test_h3_max_is_present_on_quick_workspace_workflow_and_agent_surfaces():
    app = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    system = (ROOT / "backend" / "huiju" / "api" / "routes" / "system.py").read_text(encoding="utf-8")
    agents = (ROOT / "backend" / "huiju" / "api" / "routes" / "agents.py").read_text(encoding="utf-8")
    catalog = (ROOT / "backend" / "huiju" / "catalog" / "models.py").read_text(encoding="utf-8")

    assert app.count("minimax_h3_max") >= 15
    assert 'minimax_h3_max": {"label": "MiniMax H3 Max"' in system
    assert '"minimax_h3_max"' in agents
    assert '"h3-max-text-video"' in catalog
    assert '"h3-max-image-video"' in catalog
