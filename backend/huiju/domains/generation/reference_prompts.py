"""Normalize workflow image mentions to each provider's documented syntax."""
from __future__ import annotations

import re


_IMAGE_MENTION = re.compile(r"@(?:图片|图|image)\s*([1-9]\d*)", re.IGNORECASE)


def assemble_reference_prompt(prompt: str, model: str, image_count: int) -> str:
    """Validate ``@图片N`` mentions and render the model-specific image token."""
    text = str(prompt or "").strip()
    matches = list(_IMAGE_MENTION.finditer(text))
    if not matches:
        return text

    maximum = max(int(match.group(1)) for match in matches)
    if image_count < 1 or maximum > image_count:
        raise ValueError("reference_prompt_image_out_of_range")

    model_id = str(model or "").lower()

    def replacement(match: re.Match[str]) -> str:
        index = int(match.group(1))
        if model_id.startswith("seedance_"):
            return f"@Image {index}"
        if model_id.startswith("wan"):
            return f"图片{index}"
        return f"图{index}"

    return _IMAGE_MENTION.sub(replacement, text)
