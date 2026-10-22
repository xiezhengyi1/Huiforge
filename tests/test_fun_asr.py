import asyncio
from collections import deque
from email.parser import BytesParser
from email.policy import default
import json

import httpx
import pytest

from backend.huiju.providers import fun_asr


BASE_URL = "https://dashscope.test/api/v1"
UPLOAD_URL = "https://upload.test/"
RESULT_URL = "https://result.test/transcript.json?Signature=private-signature"
POLICY = {
    "policy": "test-policy", "signature": "test-signature",
    "upload_dir": "dashscope-instant/test", "upload_host": UPLOAD_URL,
    "oss_access_key_id": "test-oss-key", "x_oss_object_acl": "private",
    "x_oss_forbid_overwrite": "true", "expire_in_seconds": 300,
    "max_file_size_mb": 100, "capacity_limit_mb": 999999,
}
TRANSCRIPT = {
    "file_url": "oss://dashscope-instant/test/clip.wav",
    "properties": {"audio_format": "pcm_s16le", "channels": [0],
                   "original_sampling_rate": 16000, "original_duration_in_milliseconds": 3834},
    "transcripts": [{
        "channel_id": 0, "content_duration_in_milliseconds": 3500,
        "text": "雨停了。我们出发。", "sentences": [
            {"begin_time": 125, "end_time": 1430, "text": "雨停了。", "sentence_id": 1,
             "words": [{"begin_time": 125, "end_time": 1430, "text": "雨停了", "punctuation": "。"}]},
            {"begin_time": 2100, "end_time": 3820, "text": "我们出发。", "sentence_id": 2,
             "words": [{"begin_time": 2100, "end_time": 3820, "text": "我们出发", "punctuation": "。"}]},
        ],
    }],
}


@pytest.fixture
def audio(tmp_path, monkeypatch):
    monkeypatch.setattr(fun_asr, "DASHSCOPE_API_KEY", "test-api-key")
    monkeypatch.setattr(fun_asr, "BAILIAN_BASE_URL", BASE_URL)
    monkeypatch.setattr(fun_asr, "POLL_INTERVAL_SECONDS", 0)
    path = tmp_path / "clip.wav"
    path.write_bytes(b"RIFF-local-audio-bytes")
    return path


def success_reply(request, transcript=TRANSCRIPT):
    if request.url.path == "/api/v1/uploads":
        return httpx.Response(200, json={"request_id": "policy-id", "data": POLICY})
    if request.url.host == "upload.test":
        return httpx.Response(200)
    if request.url.path.endswith("/transcription"):
        return httpx.Response(200, json={"request_id": "submit-id", "output": {
            "task_id": "provider-task-id", "task_status": "PENDING",
        }})
    if request.url.path.endswith("/tasks/provider-task-id"):
        return httpx.Response(200, json={"request_id": "poll-id", "output": {
            "task_id": "provider-task-id", "task_status": "SUCCEEDED", "results": [{
                "file_url": "oss://dashscope-instant/test/clip.wav",
                "subtask_status": "SUCCEEDED", "transcription_url": RESULT_URL,
            }], "task_metrics": {"TOTAL": 1, "SUCCEEDED": 1, "FAILED": 0},
        }})
    assert str(request.url) == RESULT_URL
    return httpx.Response(200, json=transcript)


def run_transcribe(handler, audio):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fun_asr.transcribe(client, audio)
    return asyncio.run(run())


def test_local_audio_uses_model_bound_policy_upload_and_returns_seconds(audio):
    requests = []
    pending = deque(["PENDING", "RUNNING"])

    def handle(request):
        requests.append(request)
        if request.url.path.endswith("/tasks/provider-task-id") and pending:
            return httpx.Response(200, json={"output": {
                "task_id": "provider-task-id", "task_status": pending.popleft(),
            }})
        return success_reply(request)

    assert run_transcribe(handle, audio) == {
        "text": "雨停了。我们出发。", "segments": [
            {"start": 0.125, "end": 1.43, "text": "雨停了。"},
            {"start": 2.1, "end": 3.82, "text": "我们出发。"},
        ],
    }
    policy, upload, submit, *remaining = requests
    assert policy.method == "GET"
    assert policy.url == BASE_URL + "/uploads?action=getPolicy&model=fun-asr"
    assert policy.headers["Authorization"] == "Bearer test-api-key"
    message = BytesParser(policy=default).parsebytes(
        ("Content-Type: " + upload.headers["content-type"] + "\r\n\r\n").encode() + upload.content
    )
    parts = list(message.iter_parts())
    fields = {part.get_param("name", header="content-disposition"): part.get_payload(decode=True) for part in parts}
    assert fields == {
        "OSSAccessKeyId": b"test-oss-key", "Signature": b"test-signature", "policy": b"test-policy",
        "x-oss-object-acl": b"private", "x-oss-forbid-overwrite": b"true",
        "key": b"dashscope-instant/test/clip.wav", "success_action_status": b"200",
        "file": audio.read_bytes(),
    }
    assert parts[-1].get_filename() == "clip.wav"
    assert "Authorization" not in upload.headers
    assert submit.method == "POST"
    assert submit.url == BASE_URL + "/services/audio/asr/transcription"
    assert submit.headers["X-DashScope-Async"] == "enable"
    assert submit.headers["X-DashScope-OssResourceResolve"] == "enable"
    assert json.loads(submit.content) == {
        "model": "fun-asr", "input": {"file_urls": ["oss://dashscope-instant/test/clip.wav"]},
        "parameters": {"channel_id": [0]},
    }
    assert [request.method for request in remaining] == ["GET", "GET", "GET", "GET"]
    assert all(request.headers["Authorization"] == "Bearer test-api-key" for request in remaining[:-1])
    assert "Authorization" not in remaining[-1].headers


@pytest.mark.parametrize("transcripts", [[], [{"channel_id": 0, "text": "", "sentences": []}]])
def test_successful_audio_without_dialogue_returns_empty_result(audio, transcripts):
    assert run_transcribe(lambda request: success_reply(request, {"transcripts": transcripts}), audio) == {
        "text": "", "segments": [],
    }


@pytest.mark.parametrize("stage", ["/uploads", "/transcription", "/tasks/provider-task-id"])
def test_arrearage_is_public_and_stops_without_retry(audio, stage):
    calls = []

    def handle(request):
        calls.append(request)
        if request.url.path.endswith(stage):
            return httpx.Response(403, json={
                "code": "Arrearage", "message": "private-key private-signature provider-task-id",
                "request_id": "private-request-id",
            })
        return success_reply(request)

    with pytest.raises(fun_asr.FunAsrError) as error:
        run_transcribe(handle, audio)
    assert error.value.code == "asr_provider_arrearage"
    assert str(error.value) == "asr_provider_arrearage"
    assert sum(request.url.path.endswith(stage) for request in calls) == 1


@pytest.mark.parametrize("subtask_failed", [False, True])
def test_failed_task_or_subtask_never_downloads_or_resubmits(audio, subtask_failed):
    calls = []

    def handle(request):
        calls.append(request)
        if request.url.path.endswith("/tasks/provider-task-id"):
            output = {"task_id": "provider-task-id", "task_status": "FAILED", "code": "FILE_DOWNLOAD_FAILED"}
            if subtask_failed:
                output.update(task_status="SUCCEEDED", results=[{
                    "subtask_status": "FAILED", "code": "FILE_DOWNLOAD_FAILED", "message": "private-provider-error",
                }])
            return httpx.Response(200, json={"output": output})
        return success_reply(request)

    with pytest.raises(fun_asr.FunAsrError) as error:
        run_transcribe(handle, audio)
    assert error.value.code == "asr_transcription_failed"
    assert str(error.value) == "asr_transcription_failed"
    assert len(calls) == 4


def test_failed_oss_upload_never_submits_asr(audio):
    calls = []

    def handle(request):
        calls.append(request)
        if request.url.host == "upload.test":
            return httpx.Response(403, text="<Error>private-signature</Error>")
        return success_reply(request)

    with pytest.raises(fun_asr.FunAsrError) as error:
        run_transcribe(handle, audio)
    assert str(error.value) == "asr_provider_unavailable"
    assert len(calls) == 2


def test_transport_error_is_sanitized_and_not_retried(audio):
    calls = []

    def handle(request):
        calls.append(request)
        raise httpx.ReadTimeout("private-key https://private.example/?Signature=secret")

    with pytest.raises(fun_asr.FunAsrError) as error:
        run_transcribe(handle, audio)
    assert str(error.value) == "asr_provider_unavailable"
    assert len(calls) == 1


def test_pending_task_has_a_finite_poll_limit(audio, monkeypatch):
    monkeypatch.setattr(fun_asr, "MAX_POLL_ATTEMPTS", 2)
    calls = []

    def handle(request):
        calls.append(request)
        if request.url.path.endswith("/tasks/provider-task-id"):
            return httpx.Response(200, json={"output": {"task_status": "PENDING"}})
        return success_reply(request)

    with pytest.raises(fun_asr.FunAsrError) as error:
        run_transcribe(handle, audio)
    assert str(error.value) == "asr_transcription_timeout"
    assert sum(request.url.path.endswith("/transcription") for request in calls) == 1
    assert sum(request.url.path.endswith("/tasks/provider-task-id") for request in calls) == 2
