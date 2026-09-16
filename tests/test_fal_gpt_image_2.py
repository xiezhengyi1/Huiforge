import asyncio
from pathlib import Path

from backend.huiju.catalog.models import MODELS, TOOL_MODEL_IDS, fal_gpt_image_size
from backend.huiju.core.config import (
    FAL_GPT_IMAGE_2_ENDPOINTS,
    FAL_GPT_IMAGE_2_QUEUE_APPLICATION,
)
from backend.huiju.catalog.pricing import image_quote
from backend.huiju.runtime import RelayState


ROOT = Path(__file__).resolve().parents[1]


def test_gpt_image_2_replaces_legacy_route_and_is_available_for_generation_and_editing():
    assert MODELS["gpt_image"]["label"] == "GPT Image 2"
    assert MODELS["gpt_image"]["provider"] == "fal"
    assert "gpt_image" in TOOL_MODEL_IDS
    assert FAL_GPT_IMAGE_2_ENDPOINTS == {
        "text_to_image": "openai/gpt-image-2",
        "image_edit": "openai/gpt-image-2/edit",
    }
    source = (ROOT / "backend" / "huiju" / "runtime" / "relay.py").read_text(encoding="utf-8")
    assert "gpt-image-1" not in source
    assert "OPENAI_IMAGE_MODEL" not in source


def test_gpt_image_2_text_request_maps_existing_quality_size_and_count_controls():
    body = RelayState._fal_gpt_image_body({
        "aspect_ratio": "16:9",
        "resolution": "2k",
        "quality": "fine",
        "count": 3,
    }, "雨夜霓虹街道，准确显示中文店招")

    assert body == {
        "prompt": "雨夜霓虹街道，准确显示中文店招",
        "image_size": fal_gpt_image_size("16:9", "2k"),
        "background": "auto",
        "quality": "medium",
        "num_images": 3,
        "output_format": "webp",
        "sync_mode": False,
    }


def test_gpt_image_2_edit_request_keeps_mask_separate_from_reference_images():
    image_urls = ["data:image/png;base64,source", "data:image/png;base64,reference"]
    body = RelayState._fal_gpt_image_body(
        {
            "resolution": "4k",
            "quality": "ultra",
            "operation": "redraw",
            "views": 3,
        },
        "只替换蒙版区域内的天空",
        ratio=4 / 3,
        image_urls=image_urls,
        mask_url="data:image/png;base64,mask",
    )

    assert body["image_urls"] == image_urls
    assert body["mask_url"] == "data:image/png;base64,mask"
    assert body["quality"] == "high"
    assert body["num_images"] == 1
    assert max(body["image_size"].values()) <= 3840


def test_gpt_image_2_queue_uses_application_root_for_status_and_result():
    request_id = "764cabcf-b745-4b3e-ae38-1200304cf45b"
    assert FAL_GPT_IMAGE_2_QUEUE_APPLICATION == "openai/gpt-image-2"
    assert RelayState._fal_image_queue_request_path(request_id, status=True) == (
        f"/openai/gpt-image-2/requests/{request_id}/status"
    )
    assert RelayState._fal_image_queue_request_path(request_id, status=False) == (
        f"/openai/gpt-image-2/requests/{request_id}"
    )


def test_gpt_image_2_queue_submit_poll_and_result_contract():
    relay = RelayState.__new__(RelayState)
    calls = []

    async def request(method, path, **kwargs):
        calls.append((method, path, kwargs))
        if method == "POST":
            return {"request_id": "request-id"}
        if path.endswith("/status"):
            return {"status": "COMPLETED"}
        return {"images": [{"url": "https://v3b.fal.media/files/result.png"}]}

    relay._request_fal_image_json = request
    result = asyncio.run(relay._run_fal_image(
        FAL_GPT_IMAGE_2_ENDPOINTS["text_to_image"],
        {"prompt": "test"},
    ))

    assert result["images"][0]["url"].endswith("result.png")
    assert [(method, path) for method, path, _ in calls] == [
        ("POST", "/openai/gpt-image-2"),
        ("GET", "/openai/gpt-image-2/requests/request-id/status"),
        ("GET", "/openai/gpt-image-2/requests/request-id"),
    ]


def test_gpt_image_2_pricing_tracks_official_quality_resolution_and_edit_rates():
    assert image_quote("gpt_image", "1k", quality="standard")["unit_credits"] == 3
    assert image_quote("gpt_image", "1k", quality="fine")["unit_credits"] == 8
    assert image_quote("gpt_image", "1k", quality="ultra")["unit_credits"] == 26
    assert image_quote("gpt_image", "4k", quality="ultra", member=True)["unit_credits"] == 43

    edit = image_quote("gpt_image", "1k", quality="fine", reference_count=1)
    multi_reference = image_quote("gpt_image", "4k", quality="ultra", reference_count=3)
    assert edit["provider_cost_cny"] == 0.4392
    assert edit["unit_credits"] == 9
    assert multi_reference["provider_cost_cny"] == 3.1464
    assert multi_reference["nominal_margin_cny"] > 0


def test_gpt_image_2_is_exposed_in_workspace_workflow_and_capabilities_without_key_leakage():
    app = (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
    workflow_schema = (ROOT / "frontend" / "js" / "features" / "workflow" / "schema.js").read_text(encoding="utf-8")
    studio = (ROOT / "frontend" / "pages" / "studio.html").read_text(encoding="utf-8")
    system = (ROOT / "backend" / "huiju" / "api" / "routes" / "system.py").read_text(encoding="utf-8")

    assert 'gpt_image:{ tags:["NEW","文字","4K"]' in app
    assert '["gpt_image", "GPT Image 2 · fal.ai"]' in workflow_schema
    assert 'id="output-quality-section"' in studio
    assert 'source == "fal_image"' in system
    assert "FAL_KEY" not in app
    assert "1f19dc7f" not in (ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8")
