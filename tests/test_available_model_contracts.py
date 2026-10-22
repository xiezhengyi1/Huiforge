from fastapi.testclient import TestClient
import pytest

from backend.huiju.api.app import app
from backend.huiju.api.schemas import AudioTtsInput, GenerationInput, ImageToolInput, VideoGenerationInput
from backend.huiju.catalog.models import BACKGROUND_REMOVAL_MODEL_ID, MODELS, TOOL_MODEL_IDS, UPSCALER_MODEL_ID


client = TestClient(app)
IMAGE_ID = "a" * 32
VIDEO_ID = "b" * 32
AUDIO_ID = "c" * 32


def video_payload(model: str) -> dict[str, object]:
    payload: dict[str, object] = {
        "model": model,
        "operation": "text_to_video",
        "prompt": "测试镜头：晨光中的安静街道，镜头缓慢推进。",
        "resolution": "720P",
        "ratio": "16:9",
        "duration": 5,
    }
    if model == "wan2.7-i2v-2026-04-25":
        payload.update(operation="image_to_video", upload_ids=[IMAGE_ID])
    elif model == "wan2.7-r2v-2026-06-12":
        payload.update(operation="reference_to_video", upload_ids=[IMAGE_ID])
    elif model == "wan2.7-videoedit":
        payload.update(operation="video_edit", upload_ids=[VIDEO_ID])
    elif model == "wanx2.1-vace-plus":
        payload.update(operation="video_extension", upload_ids=[VIDEO_ID])
    elif model == "video-style-transform":
        payload.update(operation="video_style", upload_ids=[VIDEO_ID])
    elif model == "videoretalk":
        payload.update(operation="lip_sync", upload_ids=[VIDEO_ID, AUDIO_ID])
    elif model == "wan2.2-animate-mix":
        payload.update(operation="character_swap_video", upload_ids=[VIDEO_ID, IMAGE_ID], rights_confirmed=True)
    elif model == "wan2.2-s2v":
        payload.update(operation="digital_human", upload_ids=[IMAGE_ID, AUDIO_ID])
    elif model == "minimax_h3_max":
        payload.update(resolution="480P")
    return payload


def test_every_currently_available_model_accepts_its_public_request_contract() -> None:
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    catalog = response.json()

    image_models = set(catalog["models"])
    image_tools = set(catalog["tool_models"])
    video_models = set(catalog["video_models"])
    audio_models = set(catalog["audio_models"])

    assert image_models == set(MODELS)
    assert image_tools == set(TOOL_MODEL_IDS)
    assert catalog["upscaler_model"]["id"] == UPSCALER_MODEL_ID
    assert catalog["background_removal_model"]["id"] == BACKGROUND_REMOVAL_MODEL_ID

    for model in image_models:
        assert GenerationInput.model_validate({
            "model": model,
            "prompt": "测试画面：晨光照亮安静的城市街角。",
        }).model == model
    for model in image_tools:
        assert ImageToolInput.model_validate({
            "model": model,
            "operation": "edit",
            "upload_id": IMAGE_ID,
            "prompt": "提升画面明暗层次。",
        }).model == model
    assert ImageToolInput.model_validate({
        "model": BACKGROUND_REMOVAL_MODEL_ID,
        "operation": "cutout",
        "upload_id": IMAGE_ID,
    }).operation == "cutout"
    for model in video_models:
        assert VideoGenerationInput.model_validate(video_payload(model)).model == model
    for model in audio_models:
        assert AudioTtsInput.model_validate({
            "model": model,
            "text": "这是绘域的模型接口测试。",
            "format": "mp3",
        }).model == model


@pytest.mark.parametrize("model", ["wan2.7-t2v-2026-06-12", "wan2.7-i2v-2026-04-25", "wan2.7-r2v-2026-06-12"])
@pytest.mark.parametrize("resolution", ["720P", "1080P"])
def test_wan27_accepts_documented_resolutions_for_vertical_five_second_video(model, resolution):
    payload = video_payload(model)
    payload.update(resolution=resolution, ratio="9:16", duration=5)

    video = VideoGenerationInput.model_validate(payload)

    assert video.resolution == resolution
    assert video.ratio == "9:16"
    assert video.duration == 5
