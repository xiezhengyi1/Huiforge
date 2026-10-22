"""Validated public API and workflow contracts."""
from __future__ import annotations

import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class GenerationInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    prompt: str = Field(min_length=3, max_length=8000)
    model: str = "qwen_image"
    aspect_ratio: Literal["1:1", "4:5", "3:4", "2:3", "9:16", "16:9", "3:2", "21:9"] = "1:1"
    quality: Literal["standard", "fine", "ultra"] = "standard"
    resolution: Literal["480p", "720p", "1k", "2k", "4k"] = "720p"
    style: Literal[
        "natural", "editorial", "illustration", "cinematic", "cyberpunk", "chinese",
        "healing", "suspense", "scifi", "portrait", "anime", "charsheet",
    ] = "natural"
    count: Literal[1, 2, 3, 4] = 1
    output_mode: Literal["auto", "independent"] = "auto"
    capability_id: str | None = Field(default=None, max_length=64, pattern=r"^[a-z0-9-]+$")

class ImageAnnotationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_index: int = Field(ge=1, le=10)
    kind: Literal["point", "bbox"]
    coordinates: list[int] = Field(min_length=2, max_length=4)

class ImageToolInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    operation: Literal["edit", "redraw", "multiview", "panorama", "multiangle", "upscale", "cutout", "interactive", "layers"]
    model: str = Field(default="qwen_image_edit", max_length=64, pattern=r"^[a-z0-9_]+$")
    upload_id: str = Field(min_length=32, max_length=32, pattern=r"^[a-f0-9]{32}$")
    mask_upload_id: str | None = Field(default=None, min_length=32, max_length=32, pattern=r"^[a-f0-9]{32}$")
    reference_upload_ids: list[str] = Field(default_factory=list, max_length=9)
    annotations: list[ImageAnnotationInput] = Field(default_factory=list, max_length=40)
    prompt: str = Field(default="", max_length=8000)
    preset_id: str | None = Field(default=None, max_length=64, pattern=r"^[a-z0-9-]+$")
    resolution: Literal["480p", "720p", "1k", "2k", "4k"] = "720p"
    quality: Literal["standard", "fine", "ultra"] = "standard"
    views: Literal[3, 4, 9] = 3
    camera: dict[str, float] | None = None
    capability_id: str | None = Field(default=None, max_length=64, pattern=r"^[a-z0-9-]+$")

class ImageAnalysisInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    upload_id: str = Field(min_length=32, max_length=32, pattern=r"^[a-f0-9]{32}$")
    focus: Literal["complete", "prompt", "text", "commerce", "narration"] = "complete"
    instruction: str = Field(default="", max_length=500)

class BindContactInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    contact: str = Field(min_length=5, max_length=200)

class RegisterInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    phone: str = Field(pattern=r"^1[3-9]\d{9}$")
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(default="", max_length=24)
    sms_code: str = Field(pattern=r"^\d{4,8}$")

class SmsSendInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    phone: str = Field(pattern=r"^1[3-9]\d{9}$")

class LoginInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    phone: str = Field(pattern=r"^1[3-9]\d{9}$")
    password: str = Field(min_length=8, max_length=72)

class ProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    display_name: str = Field(min_length=1, max_length=24)
    bio: str = Field(default="", max_length=160)

class FeedbackInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    category: Literal["product", "generation", "function", "billing", "bug", "other"] = "other"
    message: str = Field(min_length=2, max_length=1000)
    screenshot_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")

class AssetCreateInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=40)
    category_id: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    url: str = Field(
        min_length=16, max_length=500,
        pattern=r"^/(?:generated/[a-zA-Z0-9_./?=&%-]+|api/v1/private-media/(?:history|asset|video|audio)/[a-f0-9]{32})$",
    )
    prompt: str = Field(default="", max_length=8000)
    kind: str = Field(default="text", max_length=64, pattern=r"^[a-z0-9_-]+$")
    asset_type: Literal["image", "video", "audio", "voice", "music"] | None = None

class PlazaPostCreateInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=2, max_length=40)
    url: str = Field(
        min_length=16, max_length=500,
        pattern=r"^/api/v1/private-media/(?:history|asset|video)/[a-f0-9]{32}$",
    )
    prompt: str = Field(default="", max_length=8000)
    model: str = Field(default="绘域", min_length=1, max_length=64)
    tags: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("tags")
    @classmethod
    def validate_plaza_tags(cls, value: list[str]) -> list[str]:
        result: list[str] = []
        for item in value:
            tag = re.sub(r"\s+", "", item).strip("#＃,，。")[:12]
            if tag and tag not in result:
                result.append(tag)
        return result

class AssetCategoryCreateInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=20)

class VideoGenerationInput(BaseModel):
    """Unified quick-composer contract for supported video generation modes."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    prompt: str = Field(min_length=3, max_length=5000)
    operation: Literal[
        "text_to_video", "image_to_video", "first_last_to_video", "reference_to_video",
        "video_edit", "video_extension", "video_style", "lip_sync", "character_swap_video", "digital_human",
    ] = "text_to_video"
    model: Literal[
        "minimax_h3_max",
        "wan2.7-t2v-2026-06-12", "wan2.7-i2v-2026-04-25",
        "wan2.7-r2v-2026-06-12", "seedance_2_0", "seedance_2_0_mini",
        "seedance_2_0_fast", "seedance_2_5", "wan2.7-videoedit",
        "wanx2.1-vace-plus", "video-style-transform", "videoretalk", "wan2.2-animate-mix", "wan2.2-s2v",
        "wan3.0-video", "wan3.0-video-prime",
    ] = "wan2.7-t2v-2026-06-12"
    upload_ids: list[str] = Field(default_factory=list, max_length=30)
    resolution: Literal["480P", "720P", "768P", "1080P"] = "720P"
    ratio: Literal["21:9", "16:9", "9:16", "1:1", "4:3", "3:4"] = "16:9"
    duration: int = Field(default=5, ge=0, le=30)
    style_id: int = Field(default=0, ge=0, le=7)
    rights_confirmed: bool = False

    @model_validator(mode="after")
    def validate_video_mode(self) -> "VideoGenerationInput":
        required = {
            "text_to_video": (0, 0),
            "image_to_video": (1, 1),
            "first_last_to_video": (2, 2),
            "reference_to_video": (1, 5),
            "video_edit": (1, 2),
            "video_extension": (1, 2),
            "video_style": (1, 1),
            "lip_sync": (2, 3),
            "character_swap_video": (2, 2),
            "digital_human": (2, 2),
        }
        minimum, maximum = required[self.operation]
        if self.operation == "reference_to_video":
            maximum = 30 if self.model == "seedance_2_5" else 9 if self.model.startswith("seedance_2_0") else 5
        if not minimum <= len(self.upload_ids) <= maximum:
            raise ValueError("invalid_video_reference_count")
        if len(set(self.upload_ids)) != len(self.upload_ids):
            raise ValueError("duplicate_video_reference")
        if any(len(value) != 32 or any(char not in "0123456789abcdef" for char in value) for value in self.upload_ids):
            raise ValueError("invalid_video_upload_id")
        if self.model == "wan2.7-t2v-2026-06-12" and self.operation != "text_to_video":
            raise ValueError("video_model_mode_mismatch")
        if self.model == "wan2.7-i2v-2026-04-25" and self.operation not in {"image_to_video", "first_last_to_video"}:
            raise ValueError("video_model_mode_mismatch")
        if self.model == "wan2.7-r2v-2026-06-12" and self.operation != "reference_to_video":
            raise ValueError("video_model_mode_mismatch")
        if self.model in {"wan2.7-t2v-2026-06-12", "wan2.7-i2v-2026-04-25", "wan2.7-r2v-2026-06-12"} and self.resolution not in {"720P", "1080P"}:
            raise ValueError("video_resolution_model_mismatch")
        if self.model == "minimax_h3_max":
            if self.operation not in {"text_to_video", "image_to_video"}:
                raise ValueError("video_model_mode_mismatch")
            if self.resolution not in {"480P", "768P"}:
                raise ValueError("h3_max_resolution_not_supported")
            if not 5 <= self.duration <= 15:
                raise ValueError("h3_max_duration_out_of_range")
        elif self.resolution == "768P":
            raise ValueError("video_resolution_model_mismatch")
        if self.ratio == "21:9" and self.model != "minimax_h3_max":
            raise ValueError("video_ratio_model_mismatch")
        specialized = {
            "wan2.7-videoedit": "video_edit",
            "wanx2.1-vace-plus": "video_extension",
            "video-style-transform": "video_style",
            "videoretalk": "lip_sync",
            "wan2.2-animate-mix": "character_swap_video",
            "wan2.2-s2v": "digital_human",
        }
        if self.model in specialized and self.operation != specialized[self.model]:
            raise ValueError("video_model_mode_mismatch")
        if self.operation == "character_swap_video" and not self.rights_confirmed:
            raise ValueError("portrait_rights_confirmation_required")
        if self.model == "wanx2.1-vace-plus" and self.duration != 5:
            raise ValueError("vace_duration_must_be_five")
        if self.model in {"wan3.0-video", "wan3.0-video-prime"}:
            if not 2 <= self.duration <= 30:
                raise ValueError("video_duration_out_of_range")
        elif self.model == "seedance_2_5":
            if self.duration > 30:
                raise ValueError("video_duration_out_of_range")
        elif self.model.startswith("seedance_"):
            if not 4 <= self.duration <= 15:
                raise ValueError("video_duration_out_of_range")
        elif not 2 <= self.duration <= 15:
            raise ValueError("video_duration_out_of_range")
        return self

class StoryboardShotInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    prompt: str = Field(min_length=3, max_length=5000)
    duration: int = Field(default=5, ge=2, le=30)


class StoryboardGenerationInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(default="我的分镜成片", min_length=1, max_length=60)
    model: str = "wan2.7-t2v-2026-06-12"
    resolution: Literal["480P", "720P", "768P", "1080P"] = "720P"
    ratio: Literal["21:9", "16:9", "9:16", "1:1", "4:3", "3:4"] = "9:16"
    shots: list[StoryboardShotInput] = Field(min_length=2, max_length=8)

    @model_validator(mode="after")
    def validate_shots(self) -> "StoryboardGenerationInput":
        for shot in self.shots:
            VideoGenerationInput(
                model=self.model, resolution=self.resolution, ratio=self.ratio,
                prompt=shot.prompt, duration=shot.duration,
            )
        return self


class StoryboardComposeInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(default="我的分镜成片", min_length=1, max_length=60)
    job_ids: list[str] = Field(min_length=2, max_length=8)

    @field_validator("job_ids")
    @classmethod
    def validate_job_ids(cls, values: list[str]) -> list[str]:
        if any(not re.fullmatch(r"[a-f0-9]{32}", value) for value in values):
            raise ValueError("invalid_video_job_id")
        return values


class AudioTtsInput(BaseModel):
    """Owner-scoped non-realtime speech synthesis contract."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=2000)
    model: Literal[
        "qwen3-tts-flash", "qwen3-tts-instruct-flash",
        "qwen-audio-3.0-tts-flash", "qwen-audio-3.0-tts-plus",
        "doubao-tts-2.0",
    ] = "qwen3-tts-flash"
    voice: str = Field(default="Cherry", pattern=r"^[a-zA-Z0-9_.-]{1,96}$")
    language_type: Literal[
        "Auto", "Chinese", "English", "French", "German", "Russian", "Italian",
        "Spanish", "Portuguese", "Japanese", "Korean",
    ] = "Auto"
    instructions: str = Field(default="", max_length=1000)
    format: Literal["wav", "mp3", "ogg_opus"] = "wav"
    sample_rate: Literal[8000, 16000, 24000] = 24000
    speed_ratio: float = Field(default=1.0, ge=0.1, le=2.0)
    loudness_ratio: float = Field(default=1.0, ge=0.5, le=2.0)
    emotion: str = Field(default="", max_length=32, pattern=r"^[a-zA-Z_-]{0,32}$")
    emotion_scale: float = Field(default=4.0, ge=1.0, le=5.0)
    reference_upload_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    rights_confirmed: bool = False

class VideoWorkflowInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    kind: Literal["viral-remake", "video-dubbing"]
    source_upload_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    source_job_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    prompt: str = Field(default="", max_length=2000)
    voice: str = Field(default="Cherry", pattern=r"^[a-zA-Z0-9_.-]{1,96}$")
    language_type: Literal["Chinese", "English", "French", "German", "Russian", "Italian", "Spanish", "Portuguese", "Japanese", "Korean", "Auto"] = "Chinese"

    @model_validator(mode="after")
    def validate_source(self) -> "VideoWorkflowInput":
        if bool(self.source_upload_id) == bool(self.source_job_id):
            raise ValueError("exactly_one_video_source_required")
        return self


class VideoRemakeShot(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    prompt: str = Field(min_length=3, max_length=1000)
    duration: int = Field(ge=2, le=15)


class VideoRemakePlan(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=60)
    summary: str = Field(min_length=1, max_length=500)
    rhythm: str = Field(min_length=1, max_length=500)
    dialogue: str = Field(max_length=2000)
    shots: list[VideoRemakeShot] = Field(min_length=2, max_length=8)


class ShortDramaSessionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(default="未命名短剧", min_length=1, max_length=60)

class ShortDramaMessageInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=12000)
    auto_execute: bool = False

DEFAULT_ASSET_CATEGORIES: tuple[dict[str, str], ...] = (
    {"id": "characters", "name": "角色", "icon": "◎"},
    {"id": "scenes", "name": "场景", "icon": "▱"},
    {"id": "designs", "name": "设计图", "icon": "◇"},
    {"id": "products", "name": "商品", "icon": "◫"},
    {"id": "storyboards", "name": "分镜", "icon": "▤"},
    {"id": "references", "name": "参考图", "icon": "◌"},
    {"id": "videos", "name": "视频", "icon": "▷"},
    {"id": "voices", "name": "音色", "icon": "◖"},
    {"id": "music", "name": "音乐", "icon": "♫"},
    {"id": "audio", "name": "音频", "icon": "≋"},
)

WorkflowNodeType = Literal[
    "media_input", "image_generator", "image_tool", "video_generator", "video_tool",
    "audio_generator", "audio_tool", "media_output", "text_output",
]

class WorkflowNodeInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    type: WorkflowNodeType
    category: Literal["input", "image", "video", "audio", "output"]
    x: float = Field(ge=-50000, le=50000)
    y: float = Field(ge=-50000, le=50000)
    config: dict[str, str | int | float | bool] = Field(default_factory=dict, max_length=24)

class WorkflowEdgeInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    from_node: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    to_node: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    from_port: str = Field(default="output", pattern=r"^[a-z][a-z0-9_]{0,23}$")
    to_port: str = Field(default="input", pattern=r"^[a-z][a-z0-9_]{0,23}$")

class WorkflowGraphInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    version: Literal[6] = 6
    scene_preset: str = Field(default="", max_length=64, pattern=r"^[a-z0-9-]*$")
    nodes: list[WorkflowNodeInput] = Field(min_length=1, max_length=30)
    edges: list[WorkflowEdgeInput] = Field(default_factory=list, max_length=60)

class WorkflowCreateInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=40)
    description: str = Field(default="", max_length=120)
    tags: list[str] = Field(default_factory=list, max_length=8)
    graph: WorkflowGraphInput

    @field_validator("tags")
    @classmethod
    def validate_workflow_tags(cls, value: list[str]) -> list[str]:
        result: list[str] = []
        for item in value:
            tag = re.sub(r"\s+", "", item).strip("#＃,，。")[:12]
            if tag and tag not in result:
                result.append(tag)
        return result

class WorkflowCommentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    content: str = Field(min_length=1, max_length=300)
