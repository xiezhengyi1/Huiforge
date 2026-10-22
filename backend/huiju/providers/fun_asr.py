"""Fun-ASR file transcription through model-bound DashScope temporary storage."""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import httpx

from ..core.config import BAILIAN_BASE_URL, DASHSCOPE_API_KEY


POLL_INTERVAL_SECONDS = 2.0
MAX_POLL_ATTEMPTS = 180


class FunAsrError(RuntimeError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def _provider_error(code: str | None, public_code: str = "asr_provider_unavailable") -> FunAsrError:
    return FunAsrError("asr_provider_arrearage" if code == "Arrearage" else public_code)


async def _request_json(client: httpx.AsyncClient, method: str, url: str, **kwargs: Any) -> dict[str, Any]:
    response = await client.request(method, url, timeout=90.0, **kwargs)
    try:
        body = response.json()
    except ValueError:
        raise FunAsrError("asr_provider_unavailable") from None
    if response.is_error:
        raise _provider_error(body.get("code"))
    return body


async def transcribe(client: httpx.AsyncClient, audio_path: Path) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {DASHSCOPE_API_KEY}"}
    try:
        policy = (await _request_json(
            client, "GET", f"{BAILIAN_BASE_URL}/uploads", headers=headers,
            params={"action": "getPolicy", "model": "fun-asr"},
        ))["data"]
        key = f"{policy['upload_dir']}/{audio_path.name}"
        with audio_path.open("rb") as audio:
            uploaded = await client.post(
                policy["upload_host"], timeout=120.0,
                data={
                    "OSSAccessKeyId": policy["oss_access_key_id"], "Signature": policy["signature"],
                    "policy": policy["policy"], "x-oss-object-acl": policy["x_oss_object_acl"],
                    "x-oss-forbid-overwrite": policy["x_oss_forbid_overwrite"],
                    "key": key, "success_action_status": "200",
                },
                files={"file": (audio_path.name, audio)},
            )
        uploaded.raise_for_status()
        submitted = await _request_json(
            client, "POST", f"{BAILIAN_BASE_URL}/services/audio/asr/transcription",
            headers={**headers, "X-DashScope-Async": "enable", "X-DashScope-OssResourceResolve": "enable"},
            json={"model": "fun-asr", "input": {"file_urls": [f"oss://{key}"]},
                  "parameters": {"channel_id": [0]}},
        )
        task_id = submitted["output"]["task_id"]
        for _ in range(MAX_POLL_ATTEMPTS):
            task = (await _request_json(
                client, "GET", f"{BAILIAN_BASE_URL}/tasks/{task_id}", headers=headers,
            ))["output"]
            if task["task_status"] in {"PENDING", "RUNNING"}:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                continue
            if task["task_status"] != "SUCCEEDED":
                raise _provider_error(task.get("code"), "asr_transcription_failed")
            result = task["results"][0]
            if result["subtask_status"] != "SUCCEEDED":
                raise _provider_error(result.get("code"), "asr_transcription_failed")
            transcripts = (await _request_json(client, "GET", result["transcription_url"]))["transcripts"]
            return {
                "text": "\n".join(transcript["text"] for transcript in transcripts),
                "segments": [
                    {"start": sentence["begin_time"] / 1000, "end": sentence["end_time"] / 1000,
                     "text": sentence["text"]}
                    for transcript in transcripts for sentence in transcript["sentences"]
                ],
            }
        raise FunAsrError("asr_transcription_timeout")
    except httpx.HTTPError:
        raise FunAsrError("asr_provider_unavailable") from None
