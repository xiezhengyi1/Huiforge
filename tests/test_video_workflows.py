import asyncio
import json
from pathlib import Path
import shutil
import subprocess
from types import SimpleNamespace
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.huiju.api.app import app
from backend.huiju.persistence.database import UserDatabase
from backend.huiju.runtime import relay

BASE = "/api/v1/video-workflows/jobs"


@pytest.fixture
def workflow_env(tmp_path, monkeypatch):
    database = UserDatabase(tmp_path / "users.sqlite3", tmp_path / "private")
    monkeypatch.setattr(relay, "database", database)
    monkeypatch.setattr(relay, "owner_cache", {})
    monkeypatch.setattr(relay, "uploads", {})
    counter = 0

    def user(balance=10000):
        nonlocal counter
        counter += 1
        client = TestClient(app)
        client.get("/api/v1/users/me")
        device = client.cookies.get("huiju_session")
        owner = database.register_user(device, f"1370000{counter:04d}", "test-hash", "创作者")
        relay.owner_cache.pop(device, None)
        relay.wallet_for(owner)
        with database._connect() as connection:
            connection.execute("UPDATE wallets SET daily=?,monthly=0,topup=0 WHERE owner_id=?", (balance, owner))
        return client, owner

    return SimpleNamespace(database=database, user=user, root=tmp_path, monkeypatch=monkeypatch)


def test_workflow_requires_exactly_one_owned_video_source(workflow_env):
    client, _ = workflow_env.user()
    response = client.post(BASE, json={"kind": "video-dubbing", "prompt": "你好"})
    assert response.status_code == 422
    response = client.post(BASE, json={"kind": "video-dubbing", "source_job_id": "a" * 32, "source_upload_id": "b" * 32})
    assert response.status_code == 422
    assert client.post(BASE, json={"kind": "video-dubbing", "source_job_id": "a" * 32, "prompt": "你好"}).status_code == 404


def clip(env, *, audio=True, duration=1.2):
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        pytest.skip("ffmpeg required")
    target = env.root / f"{uuid.uuid4().hex}.mp4"
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"color=c=blue:s=160x90:r=25:d={duration}"]
    if audio:
        command += ["-f", "lavfi", "-i", f"sine=frequency=220:sample_rate=48000:duration={duration}", "-c:a", "aac"]
    subprocess.run(command + ["-c:v", "libx264", "-pix_fmt", "yuv420p", str(target)], check=True, capture_output=True)
    return target


def source(env, owner, *, upload=False, audio=True):
    path = clip(env, audio=audio)
    source_id = uuid.uuid4().hex
    if upload:
        relay.uploads[source_id] = {"owner": owner, "kind": "video_reference", "path": path, "media_type": "video/mp4"}
        return {"source_upload_id": source_id}
    target = env.database.private_media_dir / "videos" / owner / f"{source_id}.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    env.database.create_media_job(owner, source_id, "video", "text_to_video", "test", "源视频", {})
    env.database.update_media_job(source_id, owner, status="completed", media_path=target.relative_to(env.database.private_media_dir).as_posix(), mime_type="video/mp4")
    return {"source_job_id": source_id}


def service_for(env):
    from backend.huiju.api.routes.video_workflows import video_workflow_service
    from backend.huiju.providers import video_workflows
    env.monkeypatch.setattr(video_workflow_service.media_service, "database", env.database)
    env.monkeypatch.setattr(video_workflow_service.media_service, "configured_for_audio", lambda model: True)
    env.monkeypatch.setattr(video_workflow_service, "poll_seconds", 0.001)
    env.monkeypatch.setattr(video_workflows, "MEDIA_WORKER_ENABLED", True)
    env.monkeypatch.setattr(video_workflows, "DASHSCOPE_API_KEY", "test-key")
    env.monkeypatch.setattr(video_workflows, "ARK_AGENT_API_KEY", "test-key")
    return video_workflow_service


def fake_tts(env, service, owner, calls):
    audio = env.root / "speech.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=24000:duration=2.4", str(audio)], check=True, capture_output=True)

    def submit(owner_id, job_id, payload):
        assert owner_id == owner
        parent = env.database.recoverable_video_workflow_jobs()[0]
        assert parent["tts_job_id"] == job_id
        assert parent["phase"] == "synthesizing"
        calls.append(payload)
        target = env.database.private_media_dir / "audio" / owner / f"{job_id}.wav"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(audio, target)
        env.database.create_media_job(owner, job_id, "audio", "text_to_speech", payload["model"], payload["text"], payload)
        env.database.update_media_job(job_id, owner, status="completed", mime_type="audio/wav", media_path=target.relative_to(env.database.private_media_dir).as_posix())
    env.monkeypatch.setattr(service.media_service, "submit_tts", submit)


async def finish(service):
    await asyncio.gather(*list(service.tasks))


@pytest.mark.parametrize("upload", [False, True])
def test_given_script_dubbing_replaces_audio_aligns_duration_and_is_private(workflow_env, upload):
    from backend.huiju.api.schemas import VideoWorkflowInput
    service = service_for(workflow_env)
    client, owner = workflow_env.user()
    other, _ = workflow_env.user()
    selected = source(workflow_env, owner, upload=upload)
    before = relay.credit_summary(owner)["total"]
    calls = []
    fake_tts(workflow_env, service, owner, calls)

    async def forbidden_asr(*args):
        pytest.fail("given text must not trigger ASR")
    workflow_env.monkeypatch.setattr(service, "_transcribe", forbidden_asr)

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver", cookies=client.cookies) as api:
            response = await api.post(BASE, json={"kind": "video-dubbing", **selected, "prompt": "欢迎来到绘域。"})
            assert response.status_code == 202
            receipt = response.json()
            if upload:
                relay.uploads.clear()
            await finish(service)
            result = (await api.get(receipt["status_url"])).json()
            assert result["status"] == "completed", result
            assert result["script"] == "欢迎来到绘域。"
            assert (await api.get(result["url"])).status_code == 200
            return receipt, result
    receipt, result = asyncio.run(run())
    assert other.get(receipt["status_url"]).status_code == 404
    assert other.get(result["url"]).status_code == 404
    assert calls[0]["voice"] == "Cherry" and calls[0]["language_type"] == "Chinese"
    assert relay.credit_summary(owner)["total"] == before - result["credits"]["charged_credits"]
    record = workflow_env.database.video_workflow_job(owner, receipt["job_id"])
    output = workflow_env.database.media_path(owner, "video", record["output_job_id"])
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(output)], check=True, capture_output=True).stdout)
    assert abs(float(info["format"]["duration"]) - 1.2) < 0.1
    assert len([stream for stream in info["streams"] if stream["codec_type"] == "audio"]) == 1
    original = workflow_env.database.private_media_dir / record["source_path"]
    def video_hash(path):
        return subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:v:0", "-c", "copy", "-f", "hash", "-hash", "sha256", "-"], capture_output=True, check=True).stdout
    assert video_hash(original) == video_hash(output)
    assert "provider_task_id" not in json.dumps(result)
    assert str(workflow_env.root) not in json.dumps(result)


def test_empty_prompt_uses_transcript_before_tts_and_preserves_segments(workflow_env):
    from backend.huiju.api.schemas import VideoWorkflowInput
    service = service_for(workflow_env)
    _, owner = workflow_env.user()
    selected = source(workflow_env, owner)
    calls = []
    fake_tts(workflow_env, service, owner, calls)
    segments = [{"start": 0.0, "end": 1.0, "text": "你好，绘域。"}]

    async def transcribe(path):
        assert path.read_bytes()[:4] == b"RIFF"
        return {"text": "你好，绘域。", "segments": segments}
    workflow_env.monkeypatch.setattr(service, "_transcribe", transcribe)

    async def run():
        receipt = service.submit(owner, VideoWorkflowInput(kind="video-dubbing", **selected))
        await finish(service)
        result = service.get(owner, receipt["job_id"])
        assert result["status"] == "completed"
        assert result["transcript"] == result["script"] == "你好，绘域。"
        assert result["segments"] == segments
    asyncio.run(run())
    assert calls[0]["text"] == "你好，绘域。"


def test_known_text_budget_is_checked_before_task_creation(workflow_env):
    service = service_for(workflow_env)
    client, owner = workflow_env.user(balance=0)
    selected = source(workflow_env, owner)
    response = client.post(BASE, json={"kind": "video-dubbing", **selected, "prompt": "欢迎来到绘域。"})
    assert response.status_code == 402
    assert workflow_env.database.recoverable_video_workflow_jobs() == []
    assert relay.credit_summary(owner)["total"] == 0


@pytest.mark.parametrize("empty_transcript", [False, True])
@pytest.mark.parametrize("model_dialogue", ["无可识别台词", None])
def test_viral_remake_uses_six_real_frames_and_returns_plan_without_media_generation(workflow_env, empty_transcript, model_dialogue):
    from backend.huiju.api.schemas import VideoWorkflowInput
    service = service_for(workflow_env)
    _, owner = workflow_env.user()
    selected = source(workflow_env, owner)
    before = relay.credit_summary(owner)["total"]
    plan = {"title": "一次重逢", "summary": "两人在雨夜重逢", "rhythm": "铺垫后揭示", "shots": [
        {"prompt": "雨夜，女孩在车站望向街口", "duration": 5}, {"prompt": "男子穿过雨幕，停在女孩面前", "duration": 5}]}
    if model_dialogue is not None:
        plan["dialogue"] = model_dialogue
    requests = []

    def provider(request):
        body = json.loads(request.content)
        requests.append(body)
        if str(request.url).endswith("/chat/completions"):
            images = [item for item in body["messages"][0]["content"] if item["type"] == "image_url"]
            assert len(images) == 6
            assert all(image["image_url"]["url"].startswith("data:image/jpeg;base64,") for image in images)
            return httpx.Response(200, json={"choices": [{"message": {"content": "六帧呈现一段重逢，前半铺垫后半揭示。"}}]})
        assert str(request.url).endswith("/responses")
        assert body["tool_choice"] == {"type": "function", "name": "build_remake_plan"}
        assert body["tools"][0]["strict"] is True
        return httpx.Response(200, json={"id": "private-response-id", "status": "completed", "output": [{"type": "function_call", "name": "build_remake_plan", "arguments": json.dumps(plan, ensure_ascii=False)}]})

    async def transcribe(path):
        return {"text": "" if empty_transcript else "你好", "segments": [] if empty_transcript else [{"start": 0.0, "end": 1.0, "text": "你好"}]}
    workflow_env.monkeypatch.setattr(service, "_transcribe", transcribe)
    workflow_env.monkeypatch.setattr(service.media_service, "submit_video", lambda *args: pytest.fail("remake is a plan, not paid video generation"))
    workflow_env.monkeypatch.setattr(service.media_service, "submit_tts", lambda *args: pytest.fail("remake does not synthesize speech"))

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
            workflow_env.monkeypatch.setattr(relay, "client", client)
            receipt = service.submit(owner, VideoWorkflowInput(kind="viral-remake", **selected))
            await finish(service)
            result = service.get(owner, receipt["job_id"])
            assert result["status"] == "completed", result
            assert "url" not in result
            assert len(result["plan"]["shots"]) == 2
            assert "private-response-id" not in json.dumps(result)
            assert result["plan"]["dialogue"] == ("无可识别台词" if empty_transcript else "你好")
    asyncio.run(run())
    assert len(requests) == 2
    assert relay.credit_summary(owner)["total"] == before


def test_restart_does_not_repeat_uncertain_external_calls(workflow_env):
    from backend.huiju.api.schemas import VideoWorkflowInput
    service = service_for(workflow_env)
    _, owner = workflow_env.user()
    selected = source(workflow_env, owner, upload=True)
    workflow_env.monkeypatch.setattr(service, "_track", lambda coroutine: coroutine.close())
    receipt = service.submit(owner, VideoWorkflowInput(kind="viral-remake", **selected))
    record = workflow_env.database.video_workflow_job(owner, receipt["job_id"])
    workflow_env.database.update_video_workflow_job(owner, receipt["job_id"], status="running", phase="transcribing", state=record["state"], tts_job_id="")
    relay.uploads.clear()
    async def forbidden(*args):
        pytest.fail("restart repeated ASR")
    workflow_env.monkeypatch.setattr(service, "_transcribe", forbidden)

    async def run():
        await service._run(workflow_env.database.video_workflow_job(owner, receipt["job_id"]), resume=True)
        result = service.get(owner, receipt["job_id"])
        assert result["status"] == "failed" and result["error"] == "video_workflow_interrupted"
    asyncio.run(run())


def test_atempo_chain_covers_speeds_outside_single_filter_range():
    from backend.huiju.providers.video_workflows import atempo_chain
    for speed in (0.125, 1.0, 9.0):
        factors = [float(part.split("=")[1]) for part in atempo_chain(speed).split(",")]
        product = 1.0
        for factor in factors:
            assert 0.5 <= factor <= 2.0
            product *= factor
        assert product == pytest.approx(speed)


def test_sources_cannot_cross_owners_or_use_unfinished_jobs(workflow_env):
    service_for(workflow_env)
    first, owner = workflow_env.user()
    second, _ = workflow_env.user()
    for upload in (False, True):
        selected = source(workflow_env, owner, upload=upload)
        assert second.post(BASE, json={"kind": "video-dubbing", **selected, "prompt": "旁白"}).status_code == 404
        if not upload:
            workflow_env.database.update_media_job(selected["source_job_id"], owner, status="running")
            assert first.post(BASE, json={"kind": "video-dubbing", **selected, "prompt": "旁白"}).status_code == 422


@pytest.mark.parametrize("error_code", ["asr_provider_arrearage", "asr_transcription_failed", "asr_provider_unavailable", "asr_transcription_timeout"])
def test_asr_errors_are_safe_and_never_charge_tts(workflow_env, error_code):
    from backend.huiju.api.schemas import VideoWorkflowInput
    from backend.huiju.providers.fun_asr import FunAsrError
    service = service_for(workflow_env)
    _, owner = workflow_env.user()
    selected = source(workflow_env, owner)
    before = relay.credit_summary(owner)["total"]
    async def rejected(path):
        raise FunAsrError(error_code)
    workflow_env.monkeypatch.setattr(service, "_transcribe", rejected)
    workflow_env.monkeypatch.setattr(service.media_service, "submit_tts", lambda *args: pytest.fail("ASR failed"))
    async def run():
        receipt = service.submit(owner, VideoWorkflowInput(kind="video-dubbing", **selected))
        await finish(service)
        result = service.get(owner, receipt["job_id"])
        assert result["status"] == "failed" and result["error"] == error_code
    asyncio.run(run())
    assert relay.credit_summary(owner)["total"] == before


def test_no_dialogue_dubbing_requires_text_without_charging(workflow_env):
    from backend.huiju.api.schemas import VideoWorkflowInput
    service = service_for(workflow_env)
    _, owner = workflow_env.user()
    selected = source(workflow_env, owner)
    async def empty(path):
        return {"text": "", "segments": []}
    workflow_env.monkeypatch.setattr(service, "_transcribe", empty)
    before = relay.credit_summary(owner)["total"]
    async def run():
        receipt = service.submit(owner, VideoWorkflowInput(kind="video-dubbing", **selected))
        await finish(service)
        assert service.get(owner, receipt["job_id"])["error"] == "dubbing_script_required"
    asyncio.run(run())
    assert relay.credit_summary(owner)["total"] == before


def test_audio_concurrency_rejection_does_not_debit_or_create_parent(workflow_env):
    service_for(workflow_env)
    client, owner = workflow_env.user()
    selected = source(workflow_env, owner)
    for _ in range(2):
        workflow_env.database.create_media_job(owner, uuid.uuid4().hex, "audio", "text_to_speech", "test", "语音", {})
    before = relay.credit_summary(owner)["total"]
    response = client.post(BASE, json={"kind": "video-dubbing", **selected, "prompt": "旁白"})
    assert response.status_code == 429
    assert workflow_env.database.recoverable_video_workflow_jobs() == []
    assert relay.credit_summary(owner)["total"] == before


def test_restart_resumes_existing_completed_tts_without_resubmitting_or_debit(workflow_env):
    from backend.huiju.api.schemas import AudioTtsInput, VideoWorkflowInput
    service = service_for(workflow_env)
    _, owner = workflow_env.user()
    selected = source(workflow_env, owner, upload=True)
    workflow_env.monkeypatch.setattr(service, "_track", lambda coroutine: coroutine.close())
    receipt = service.submit(owner, VideoWorkflowInput(kind="video-dubbing", **selected, prompt="恢复旁白"))
    record = workflow_env.database.video_workflow_job(owner, receipt["job_id"])
    quote = relay.charge_audio_credits(owner, "qwen3-tts-flash", "恢复旁白")
    audio_id = uuid.uuid4().hex
    record["state"]["credits"].update(tts_quote=quote, charged_credits=quote["total_credits"])
    workflow_env.database.update_video_workflow_job(owner, receipt["job_id"], status="running", phase="synthesizing", state=record["state"], tts_job_id=audio_id)
    calls = []
    fake_tts(workflow_env, service, owner, calls)
    service.media_service.submit_tts(owner, audio_id, AudioTtsInput(text="恢复旁白").model_dump())
    workflow_env.monkeypatch.setattr(service.media_service, "submit_tts", lambda *args: pytest.fail("restart repeated TTS POST"))
    relay.uploads.clear()
    before = relay.credit_summary(owner)["total"]
    async def run():
        await service._run(workflow_env.database.video_workflow_job(owner, receipt["job_id"]), resume=True)
        assert service.get(owner, receipt["job_id"])["status"] == "completed"
    asyncio.run(run())
    assert relay.credit_summary(owner)["total"] == before
    assert len(calls) == 1


@pytest.mark.parametrize("worker_enabled", [False, True])
def test_workflow_worker_follows_media_lifecycle(workflow_env, worker_enabled):
    import importlib
    app_module = importlib.import_module("backend.huiju.api.app")
    events = []
    def callback(label):
        async def invoke(*args):
            events.append(label)
        return invoke
    workflow_env.monkeypatch.setattr(app_module, "MEDIA_WORKER_ENABLED", worker_enabled)
    workflow_env.monkeypatch.setattr(relay, "client", object())
    workflow_env.monkeypatch.setattr(relay, "start", callback("relay.start"))
    workflow_env.monkeypatch.setattr(relay, "stop", callback("relay.stop"))
    for name in ("media_service", "storyboard_service", "video_workflow_service", "video_depth_service"):
        service = getattr(app_module, name)
        workflow_env.monkeypatch.setattr(service, "stop", callback(name + ".stop"))
        if name != "video_depth_service":
            workflow_env.monkeypatch.setattr(service, "start", callback(name + ".start"))
    async def run():
        async with app_module.lifespan(app):
            events.append("app.ready")
    asyncio.run(run())
    if worker_enabled:
        assert events.index("media_service.start") < events.index("video_workflow_service.start") < events.index("app.ready")
        assert events.index("video_workflow_service.stop") < events.index("media_service.stop") < events.index("relay.stop")
    else:
        assert events == ["relay.start", "app.ready", "relay.stop"]


def test_invalid_audio_cannot_leave_a_running_output_job(workflow_env):
    from backend.huiju.api.schemas import VideoWorkflowInput
    service = service_for(workflow_env)
    _, owner = workflow_env.user()
    selected = source(workflow_env, owner)
    fake_tts(workflow_env, service, owner, [])
    original_probe = service._probe
    async def invalid_audio(path):
        if path.suffix == ".wav":
            raise ValueError("invalid_audio_duration")
        return await original_probe(path)
    workflow_env.monkeypatch.setattr(service, "_probe", invalid_audio)
    async def run():
        receipt = service.submit(owner, VideoWorkflowInput(kind="video-dubbing", **selected, prompt="测试旁白"))
        await finish(service)
        assert service.get(owner, receipt["job_id"])["status"] == "failed"
    asyncio.run(run())
    assert not any(job["status"] in {"queued", "running"} for job in workflow_env.database.media_jobs_for(owner))


def test_remake_plan_stays_within_agent_handoff_size_contract():
    from backend.huiju.api.schemas import VideoRemakePlan
    from backend.huiju.providers.video_workflows import REMAKE_PLAN_TOOL
    from pydantic import ValidationError
    plan = {"title": "雨夜重逢", "summary": "结构", "rhythm": "节奏", "dialogue": "台词",
            "shots": [{"prompt": "雨夜车站", "duration": 5}, {"prompt": "男主走来", "duration": 5}]}
    for key, maximum in (("summary", 500), ("rhythm", 500), ("dialogue", 2000)):
        with pytest.raises(ValidationError):
            VideoRemakePlan.model_validate({**plan, key: "字" * (maximum + 1)})
        if key != "dialogue":
            assert REMAKE_PLAN_TOOL["parameters"]["properties"][key]["maxLength"] == maximum
    assert "dialogue" not in REMAKE_PLAN_TOOL["parameters"]["properties"]
    assert "dialogue" not in REMAKE_PLAN_TOOL["parameters"]["required"]
    with pytest.raises(ValidationError):
        VideoRemakePlan.model_validate({**plan, "shots": [{"prompt": "字" * 1001, "duration": 5}, plan["shots"][1]]})
    assert REMAKE_PLAN_TOOL["parameters"]["properties"]["shots"]["items"]["properties"]["prompt"]["maxLength"] == 1000


def test_existing_completed_plan_get_uses_stored_transcript_as_canonical_dialogue(workflow_env):
    service_for(workflow_env)
    client, owner = workflow_env.user()
    job_id = uuid.uuid4().hex
    state = {"transcript": "雨夜，信携谜而来。", "segments": [{"start": 0.12, "end": 2.04, "text": "雨夜，信携谜而来。"}],
             "script": "", "credits": {"charged_credits": 0},
             "plan": {"title": "雨夜来信", "summary": "结构", "rhythm": "节奏", "dialogue": "无可识别台词",
                      "shots": [{"prompt": "雨夜站台", "duration": 5}, {"prompt": "女孩打开信件", "duration": 5}]}}
    workflow_env.database.create_video_workflow_job(owner, job_id, "viral-remake", {"kind": "viral-remake"}, "unused-source.mp4", state, uuid.uuid4().hex)
    workflow_env.database.update_video_workflow_job(owner, job_id, status="completed", phase="completed", state=state, tts_job_id="")
    response = client.get(BASE + "/" + job_id)
    assert response.status_code == 200
    assert response.json()["plan"]["dialogue"] == response.json()["transcript"] == "雨夜，信携谜而来。"
