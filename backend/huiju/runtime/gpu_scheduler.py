"""Exclusive single-GPU scheduling for FLUX, Qwen image tools, and upscaling.

Only one GPU workload is resident at a time.  The previous model is released
before another one starts, while Linux keeps recently read model pages warm in
the file cache.  This is deliberately safer than holding both 32 GB FLUX and
54 GB Qwen checkpoints in a host with 48 GB of RAM.
"""
from __future__ import annotations

import asyncio
import gc
import importlib.util
import logging
import os
import signal
import subprocess
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, Literal, TypeVar
from urllib.error import URLError
from urllib.request import urlopen


logger = logging.getLogger("huiju.gpu")
T = TypeVar("T")
GpuMode = Literal["zimage", "qwen_edit", "upscaler"]

ASPECT_RATIOS: dict[str, float] = {
    "1:1": 1.0,
    "4:5": 4 / 5,
    "3:4": 3 / 4,
    "2:3": 2 / 3,
    "9:16": 9 / 16,
    "16:9": 16 / 9,
    "3:2": 3 / 2,
    "21:9": 21 / 9,
}

# Pixel budgets preserve the selected aspect ratio.  480p and 720p match the
# conventional 16:9 pixel counts; 1K/2K/4K are approximately 1/4/8 megapixel
# final outputs.  2K and 4K are generated at 1K then AI-upscaled.
FINAL_PIXEL_BUDGETS: dict[str, int] = {
    "480p": 854 * 480,
    "720p": 1280 * 720,
    "1k": 1024 * 1024,
    "2k": 2560 * 1440,
    "4k": 3840 * 2160,
}
HIGH_RESOLUTIONS = frozenset({"2k", "4k"})
NATIVE_RESOLUTION_FOR_UPSCALE = "1k"
# Qwen-Image-Edit-2511 is a 54 GB BF16 checkpoint.  Layerwise GPU offload
# reduces VRAM use but still needs the checkpoint and loader working set in
# host memory.  Keep an 8 GB margin so a 48 GB container is never OOM-killed.
QWEN_MIN_HOST_MEMORY_BYTES = 64 * 1024**3


class GpuTaskError(RuntimeError):
    """A safe, expected failure while switching or running a GPU workload."""


def dimensions_for_ratio(aspect_ratio: str, resolution: str) -> tuple[int, int]:
    """Return dimensions aligned to 16 pixels for diffusion inference."""
    ratio = ASPECT_RATIOS[aspect_ratio]
    budget = FINAL_PIXEL_BUDGETS[resolution]
    height = max(256, int((budget / ratio) ** 0.5))
    width = max(256, int(height * ratio))
    width = max(256, round(width / 16) * 16)
    height = max(256, round(height / 16) * 16)
    return width, height


def dimensions_for_image(width: int, height: int, resolution: str) -> tuple[int, int]:
    if width < 1 or height < 1:
        raise GpuTaskError("invalid_image_dimensions")
    ratio = width / height
    target_pixels = FINAL_PIXEL_BUDGETS[resolution]
    target_height = max(16, int((target_pixels / ratio) ** 0.5))
    target_width = max(16, int(target_height * ratio))
    return round(target_width / 2) * 2, round(target_height / 2) * 2


class SingleGpuScheduler:
    """Serialize model changes and keep model ownership explicit.

    FLUX remains an SGLang HTTP server for efficient same-model request
    handling.  Qwen editing uses the supplied image_tools module (which also
    uses SGLang DiffGenerator).  The scheduler prevents their GPU allocations
    from overlapping and performs deterministic cleanup on every switch.
    """

    def __init__(self, base_dir: Path, generated_dir: Path) -> None:
        self.base_dir = base_dir
        self.generated_dir = generated_dir
        self.generated_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Z-Image is the default text model. FLUX is intentionally not started
        # or selected by this relay unless an operator explicitly configures it.
        self.flux_model_path = Path(os.getenv("ZIMAGE_MODEL_PATH", "/workspace/models/Z-Image-Turbo"))
        self.image_tools_path = Path(os.getenv("IMAGE_TOOLS_PATH", "/workspace/image_tools/image_tools.py"))
        self.qwen_model_path = Path(os.getenv("QWEN_EDIT_MODEL_PATH", "/workspace/models/Qwen-Image-Edit-2511-FP8"))
        self.upscaler_path = Path(os.getenv("UPSCALER_MODEL_PATH", "/workspace/models/upscale_models/4x-UltraSharp.pth"))
        self.cutout_model_name = os.getenv("CUTOUT_MODEL_NAME", "u2netp")
        self.sglang_bin = os.getenv("SGLANG_BIN", "/workspace/sglang-venv/bin/sglang")
        self.flux_port = int(os.getenv("ZIMAGE_PORT", "8001"))
        # Lets an operator take an oversized diffusion model offline without
        # taking the public API and frontend down with it.
        self.zimage_enabled = os.getenv("ZIMAGE_ENABLED", "1").strip().lower() in {"1", "true", "yes"}
        self.flux_start_timeout = int(os.getenv("FLUX_START_TIMEOUT_SECONDS", "120"))
        self.qwen_warm_on_startup = os.getenv("QWEN_WARM_ON_STARTUP", "0").strip().lower() in {"1", "true", "yes"}
        self.qwen_min_host_memory_bytes = int(
            os.getenv("QWEN_MIN_HOST_MEMORY_BYTES", str(QWEN_MIN_HOST_MEMORY_BYTES))
        )
        self._lock = asyncio.Lock()
        self._qwen_lock = asyncio.Lock()
        self._active_mode: GpuMode | None = None
        self._flux_process: subprocess.Popen[bytes] | None = None
        self._image_tools: Any | None = None
        self._upscaler: Any | None = None
        self._cutout_session: Any | None = None

    @property
    def active_mode(self) -> GpuMode | None:
        return self._active_mode

    def capability_status(self) -> dict[str, bool | str | None]:
        return {
            "zimage": self.zimage_enabled and self.flux_model_path.is_dir() and Path(self.sglang_bin).is_file(),
            "flux": False,
            "image_tools": self.image_tools_path.is_file() and self._qwen_model_is_complete() and self._qwen_host_memory_is_sufficient(),
            "upscaler": self.upscaler_path.is_file(),
            "background_removal": importlib.util.find_spec("rembg") is not None,
            "active_mode": self._active_mode,
        }

    def _host_memory_limit_bytes(self) -> int:
        """Return the effective cgroup/host memory ceiling without allocating."""
        cgroup_limit = Path("/sys/fs/cgroup/memory.max")
        try:
            value = cgroup_limit.read_text(encoding="utf-8").strip()
            if value and value != "max":
                return int(value)
        except (OSError, ValueError):
            pass
        try:
            page_size = os.sysconf("SC_PAGE_SIZE")
            page_count = os.sysconf("SC_PHYS_PAGES")
            return int(page_size) * int(page_count)
        except (AttributeError, OSError, ValueError):
            return 0

    def _qwen_host_memory_is_sufficient(self) -> bool:
        return self._host_memory_limit_bytes() >= self.qwen_min_host_memory_bytes

    def _qwen_model_is_complete(self) -> bool:
        transformer = self.qwen_model_path / "transformer"
        text_encoder = self.qwen_model_path / "text_encoder"
        has_transformer = any(transformer.glob("*.safetensors")) or any(path.name != "diffusion_pytorch_model.bin.index.json" for path in transformer.glob("*.bin"))
        has_text_encoder = any(text_encoder.glob("*.safetensors")) or any(path.name != "model.safetensors.index.json" for path in text_encoder.glob("*.bin"))
        return (self.qwen_model_path / "model_index.json").is_file() and has_transformer and has_text_encoder

    async def run_flux(self, operation: Callable[[], Awaitable[T]]) -> T:
        """Run an HTTP FLUX operation while preventing an inter-model switch."""
        async with self._lock:
            await asyncio.to_thread(self._activate_flux)
            return await operation()

    async def warm_defaults(self) -> None:
        """Start Z-Image-Turbo first; load the editor only when explicitly enabled."""
        if not self.zimage_enabled:
            logger.warning("Text image model is disabled by operator configuration")
            return
        # The public text model must always be warm, even while the optional
        # Qwen snapshot is still downloading.
        try:
            async with self._lock:
                await asyncio.to_thread(self._activate_flux)
            logger.info("Z-Image warm start complete")
        except Exception:
            logger.exception("Z-Image warm start failed")
        if not self.qwen_warm_on_startup:
            logger.info("Qwen editor warm start disabled; it will load on first editing request")
            return
        if not self._qwen_model_is_complete():
            logger.warning("Qwen FP8 snapshot is incomplete; skipping warm start")
            return
        async with self._qwen_lock:
            try:
                await asyncio.to_thread(self._activate_qwen)
                logger.info("Qwen FP8 warm start complete")
            except Exception:
                # Editing should never make the public Z-Image relay unhealthy.
                logger.exception("Qwen FP8 warm start failed; text generation remains available")

    async def run_image_tool(
        self,
        *,
        operation: Literal["edit", "redraw", "multiview", "panorama", "multiangle"],
        source: Path,
        prompt: str,
        job_id: str,
        views: int = 3,
        mask: Path | None = None,
        camera: dict[str, float] | None = None,
    ) -> list[Path]:
        async with self._qwen_lock:
            return await asyncio.to_thread(
                self._run_image_tool_blocking, operation, source, prompt, job_id, views, mask, camera
            )

    async def upscale_paths(self, paths: list[Path], resolution: str) -> list[Path]:
        if resolution not in HIGH_RESOLUTIONS:
            return paths
        # Qwen edit and AI upscaling share GPU 1; Z-Image on GPU 0 stays independent.
        async with self._qwen_lock:
            return await asyncio.to_thread(self._upscale_paths_blocking, paths, resolution)

    async def remove_background(self, source: Path, output: Path) -> Path:
        return await asyncio.to_thread(self._remove_background_blocking, source, output)

    async def shutdown(self) -> None:
        async with self._lock:
            await asyncio.to_thread(self._shutdown_active)

    def _activate_flux(self) -> None:
        if not self.zimage_enabled:
            raise GpuTaskError("flux_disabled")
        if not self.flux_model_path.is_dir() or not Path(self.sglang_bin).is_file():
            raise GpuTaskError("flux_not_installed")
        if self._active_mode == "zimage" and self._flux_is_ready():
            return
        self._shutdown_upscaler()
        if not self._flux_is_ready():
            self._start_flux_server()
        self._active_mode = "zimage"
        logger.info("GPU active model: zimage")

    def _activate_qwen(self) -> Any:
        if not self.image_tools_path.is_file():
            raise GpuTaskError("image_tools_not_installed")
        if not self._qwen_model_is_complete():
            raise GpuTaskError("qwen_model_not_ready")
        if not self._qwen_host_memory_is_sufficient():
            raise GpuTaskError("qwen_host_memory_insufficient")
        if self._active_mode != "qwen_edit":
            self._shutdown_upscaler()
            self._active_mode = "qwen_edit"
            logger.info("GPU active model: qwen_edit")
        return self._load_image_tools()

    def _activate_upscaler(self) -> Any:
        if not self.upscaler_path.is_file():
            raise GpuTaskError("upscaler_not_installed")
        if self._active_mode != "upscaler":
            self._shutdown_qwen()
            self._active_mode = "upscaler"
            logger.info("GPU active model: upscaler")
        if self._upscaler is None:
            try:
                from spandrel import ModelLoader
                import torch

                descriptor = ModelLoader(device="cuda").load_from_file(self.upscaler_path)
                descriptor.model.eval()
                if descriptor.supports_half:
                    descriptor.model.half()
                self._upscaler = descriptor
                torch.cuda.empty_cache()
            except Exception as error:  # pragma: no cover - depends on CUDA runtime
                raise GpuTaskError("upscaler_load_failed") from error
        return self._upscaler

    def _load_image_tools(self) -> Any:
        if self._image_tools is not None:
            return self._image_tools
        spec = importlib.util.spec_from_file_location("huiju_image_tools", self.image_tools_path)
        if not spec or not spec.loader:
            raise GpuTaskError("image_tools_import_failed")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        # image_tools.py exposes its own public redraw/multiview/panorama
        # helpers. Pre-seeding its generator keeps those helpers intact while
        # forcing the 54 GB Qwen checkpoint into SGLang's memory-saving,
        # layerwise-offload mode on this 32 GB GPU.
        try:
            # This process never hosts Z-Image. Restrict Qwen to the second
            # physical GPU before importing its CUDA stack, avoiding model
            # eviction and the old Z-Image/FLUX-style ping-pong.
            os.environ["CUDA_VISIBLE_DEVICES"] = os.getenv("QWEN_CUDA_VISIBLE_DEVICES", "1")
            from sglang.multimodal_gen import DiffGenerator

            module.MODEL_PATH = str(self.qwen_model_path)
            module._generator = DiffGenerator.from_pretrained(
                model_path=module.MODEL_PATH,
                num_gpus=1,
                trust_remote_code=True,
                warmup_mode="off",
                performance_mode="memory",
                dit_layerwise_offload=True,
                text_encoder_cpu_offload=True,
                vae_cpu_offload=True,
            )
        except Exception as error:  # pragma: no cover - requires deployed SGLang/CUDA
            raise GpuTaskError("qwen_load_failed") from error
        self._image_tools = module
        return module

    def _run_image_tool_blocking(
        self,
        operation: Literal["edit", "redraw", "multiview", "panorama", "multiangle"],
        source: Path,
        prompt: str,
        job_id: str,
        views: int,
        mask: Path | None,
        camera: dict[str, float] | None,
    ) -> list[Path]:
        if not source.is_file():
            raise GpuTaskError("source_image_missing")
        tools = self._activate_qwen()
        output_dir = self.generated_dir / job_id
        output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        try:
            if operation == "edit":
                output = tools.edit_image(str(source), prompt, str(output_dir / "edit.png"), steps=4)
                paths = [Path(output)]
            elif operation == "redraw":
                if not mask or not mask.is_file():
                    raise GpuTaskError("redraw_mask_missing")
                output = tools.redraw_image(str(source), prompt, str(output_dir / "redraw.png"), steps=4)
                self._apply_alpha_mask(source, Path(output), mask)
                paths = [Path(output)]
            elif operation == "multiview":
                result = tools.multiview_image(str(source), prompt, views=views, output_dir=str(output_dir))
                paths = [Path(item) for item in result.get("files", [])]
            elif operation == "panorama":
                output = output_dir / "panorama.png"
                panorama_prompt = (
                    f"{prompt}, true 360-degree equirectangular panorama, strict 2:1 aspect ratio, "
                    "360-degree horizontal field of view, 180-degree vertical field of view, "
                    "centered level horizon, seamless left-right wrap, continuous floor and ceiling, "
                    "no fisheye, no ordinary ultra-wide photo, no cubemap, no collage, no frame"
                )
                result = tools.get_generator().generate_with_lora(
                    prompt=panorama_prompt,
                    image_path=str(source),
                    lora_path=[tools.LIGHTNING_LORA],
                    output_path=str(output_dir),
                    output_file_name=output.name,
                    num_inference_steps=4,
                    width=1536,
                    height=768,
                )
                paths = [Path(getattr(result, "output_file_path", output))]
            elif operation == "multiangle":
                if not camera:
                    raise GpuTaskError("camera_missing")
                output = output_dir / "multiangle.png"
                result = tools.get_generator().generate_with_lora(
                    prompt=f"{prompt}, {self._camera_prompt(camera)}",
                    image_path=str(source),
                    lora_path=[tools.LIGHTNING_LORA, tools.ANGLES_LORA],
                    output_path=str(output_dir),
                    output_file_name=output.name,
                    num_inference_steps=4,
                )
                paths = [Path(getattr(result, "output_file_path", output))]
            else:
                raise GpuTaskError("unsupported_image_tool")
        except GpuTaskError:
            raise
        except Exception as error:  # pragma: no cover - CUDA and model specific
            logger.exception("Image tool failed operation=%s", operation)
            raise GpuTaskError("image_tool_failed") from error
        if not paths or any(not path.is_file() for path in paths):
            raise GpuTaskError("image_tool_output_missing")
        return paths

    @staticmethod
    def _camera_prompt(camera: dict[str, float]) -> str:
        azimuth = max(-180.0, min(180.0, float(camera.get("azimuth", 45))))
        elevation = max(-30.0, min(75.0, float(camera.get("elevation", 30))))
        distance = max(2.0, min(12.0, float(camera.get("distance", 5.4))))
        horizontal = "front" if abs(azimuth) <= 22 else ("front-right" if azimuth > 0 and azimuth < 90 else "front-left" if azimuth < 0 and azimuth > -90 else "right side" if azimuth >= 90 else "left side")
        vertical = "low-angle" if elevation < 8 else ("eye-level" if elevation < 25 else "elevated" if elevation < 55 else "high-angle")
        framing = "close-up" if distance < 4 else ("medium shot" if distance < 7.5 else "wide shot")
        return f"{horizontal} three-quarter view, {vertical} shot, {framing}, camera azimuth {azimuth:.0f} degrees, elevation {elevation:.0f} degrees"

    @staticmethod
    def _apply_alpha_mask(source: Path, generated: Path, mask: Path) -> None:
        """Commit generated pixels only where the user-painted alpha mask permits."""
        from PIL import Image

        with Image.open(source) as original, Image.open(generated) as edited, Image.open(mask) as alpha_image:
            base = original.convert("RGB")
            candidate = edited.convert("RGB").resize(base.size, Image.Resampling.LANCZOS)
            alpha = alpha_image.convert("L").resize(base.size, Image.Resampling.LANCZOS)
            Image.composite(candidate, base, alpha).save(generated, format="PNG", optimize=True)

    def _upscale_paths_blocking(self, paths: list[Path], resolution: str) -> list[Path]:
        descriptor = self._activate_upscaler()
        outputs: list[Path] = []
        for source in paths:
            output = source.with_name(f"{source.stem}-{resolution}.png")
            self._upscale_one(descriptor, source, output, resolution)
            outputs.append(output)
        return outputs

    def _remove_background_blocking(self, source: Path, output: Path) -> Path:
        from PIL import Image
        from rembg import new_session, remove

        if self._cutout_session is None:
            self._cutout_session = new_session(self.cutout_model_name)
        with Image.open(source) as image:
            result = remove(image.convert("RGBA"), session=self._cutout_session, post_process_mask=True)
        result.save(output, format="PNG", optimize=True)
        return output

    @staticmethod
    def _upscale_one(descriptor: Any, source: Path, output: Path, resolution: str) -> None:
        try:
            import numpy as np
            import torch
            from PIL import Image
        except ImportError as error:  # pragma: no cover - deployment dependency
            raise GpuTaskError("upscaler_dependencies_missing") from error

        with Image.open(source) as image:
            source_image = image.convert("RGB")
        target_width, target_height = dimensions_for_image(*source_image.size, resolution)
        input_tensor = torch.from_numpy(np.asarray(source_image).copy()).permute(2, 0, 1).unsqueeze(0)
        input_tensor = input_tensor.float().div_(255)
        scale = int(getattr(descriptor, "scale", 4))
        tile = 192
        overlap = 16
        _, channels, source_height, source_width = input_tensor.shape
        result = torch.empty((1, channels, source_height * scale, source_width * scale), dtype=torch.float32)

        with torch.inference_mode():
            for top in range(0, source_height, tile):
                for left in range(0, source_width, tile):
                    bottom = min(top + tile, source_height)
                    right = min(left + tile, source_width)
                    source_top = max(0, top - overlap)
                    source_left = max(0, left - overlap)
                    source_bottom = min(source_height, bottom + overlap)
                    source_right = min(source_width, right + overlap)
                    patch = input_tensor[:, :, source_top:source_bottom, source_left:source_right].cuda()
                    if getattr(descriptor, "supports_half", False):
                        patch = patch.half()
                    patch_result = descriptor.model(patch).float().cpu()
                    crop_top = (top - source_top) * scale
                    crop_left = (left - source_left) * scale
                    crop_bottom = crop_top + (bottom - top) * scale
                    crop_right = crop_left + (right - left) * scale
                    result[:, :, top * scale:bottom * scale, left * scale:right * scale] = patch_result[
                        :, :, crop_top:crop_bottom, crop_left:crop_right
                    ]

        array = result.squeeze(0).clamp_(0, 1).mul_(255).round().byte().permute(1, 2, 0).numpy()
        final_image = Image.fromarray(array, "RGB")
        if final_image.size != (target_width, target_height):
            final_image = final_image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        final_image.save(output, format="PNG", optimize=True)
        del input_tensor, result
        torch.cuda.empty_cache()

    def _flux_is_ready(self) -> bool:
        try:
            with urlopen(f"http://127.0.0.1:{self.flux_port}/health", timeout=1.5) as response:
                return response.status == 200
        except (URLError, TimeoutError, OSError):
            return False

    def _start_flux_server(self) -> None:
        if self._flux_process and self._flux_process.poll() is None:
            return
        environment = os.environ.copy()
        environment["SGLANG_USE_RUNAI_MODEL_STREAMER"] = "0"
        command = [
            self.sglang_bin,
            "serve",
            "--model-path",
            str(self.flux_model_path),
            "--host",
            "127.0.0.1",
            "--port",
            str(self.flux_port),
            "--warmup-mode",
            "off",
            "--trust-remote-code",
        ]
        if "Qwen-Image-2512" in str(self.flux_model_path):
            # The 54 GB Qwen checkpoint needs both 32 GB GPUs.  Standard tensor
            # parallelism is the documented SGLang path; FSDP inference here
            # produced syntactically successful requests but invalid noisy pixels.
            # On two 32 GB cards, tensor parallelism alone loads successfully
            # but exhausts VRAM on the first denoising pass.  SGLang's memory
            # mode offloads transformer layers without using the FSDP path.
            command.extend([
                "--num-gpus", "2", "--tp-size", "2", "--performance-mode", "memory",
                "--dit-layerwise-offload",
            ])
            environment["CUDA_VISIBLE_DEVICES"] = os.getenv("ZIMAGE_CUDA_VISIBLE_DEVICES", "0,1")
        else:
            command.extend(["--num-gpus", "1", "--performance-mode", "memory"])
            environment["CUDA_VISIBLE_DEVICES"] = os.getenv("ZIMAGE_CUDA_VISIBLE_DEVICES", "0")
        log_file = open("/tmp/huiju_sglang_flux.log", "ab", buffering=0)
        self._flux_process = subprocess.Popen(
            command,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=environment,
        )
        deadline = time.monotonic() + self.flux_start_timeout
        while time.monotonic() < deadline:
            if self._flux_is_ready():
                return
            if self._flux_process.poll() is not None:
                raise GpuTaskError("flux_start_failed")
            time.sleep(1)
        self._stop_flux_server()
        raise GpuTaskError("flux_start_timeout")

    def _stop_flux_server(self) -> None:
        if self._flux_process and self._flux_process.poll() is None:
            try:
                os.killpg(self._flux_process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                self._flux_process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(self._flux_process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                self._flux_process.wait(timeout=3)
        self._flux_process = None
        if self._active_mode == "zimage":
            self._active_mode = None

    def _shutdown_qwen(self) -> None:
        module = self._image_tools
        generator = getattr(module, "_generator", None) if module else None
        if generator is not None:
            with __import__("contextlib").suppress(Exception):
                generator.shutdown()
            module._generator = None
        self._image_tools = None
        self._empty_cuda_cache()
        if self._active_mode == "qwen_edit":
            self._active_mode = None

    def _shutdown_upscaler(self) -> None:
        if self._upscaler is not None:
            model = getattr(self._upscaler, "model", None)
            self._upscaler = None
            del model
        self._empty_cuda_cache()
        if self._active_mode == "upscaler":
            self._active_mode = None

    def _shutdown_active(self) -> None:
        # Keep Z-Image (port 8001) alive across API-worker restarts. It is a
        # separate GPU-0 service and must never participate in tool switching.
        self._shutdown_qwen()
        self._shutdown_upscaler()
        self._active_mode = None

    @staticmethod
    def _empty_cuda_cache() -> None:
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass
