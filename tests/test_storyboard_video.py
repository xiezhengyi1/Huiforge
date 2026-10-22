import asyncio
import json
import shutil
import subprocess
import uuid
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.huiju.api.app import app
from backend.huiju.persistence.database import UserDatabase
from backend.huiju.runtime import relay


PAYLOAD = {"title": "雨夜重逢", "shots": [
    {"prompt": "雨夜车站，女孩抬头望向站台"},
    {"prompt": "男子穿过雨幕，在女孩面前停下"},
]}
BASE = "/api/v1/storyboards"


@pytest.fixture
def storyboard_env(tmp_path, monkeypatch):
    database = UserDatabase(tmp_path / "users.sqlite3", tmp_path / "private")
    monkeypatch.setattr(relay, "database", database)
    monkeypatch.setattr(relay, "owner_cache", {})
    count = 0

    def user(balance=10000):
        nonlocal count
        count += 1
        client = TestClient(app)
        client.get("/api/v1/users/me")
        device = client.cookies.get("huiju_session")
        owner = database.register_user(device, f"1380000{count:04d}", "test-hash", "创作者")
        relay.owner_cache.pop(device, None)
        relay.wallet_for(owner)
        with database._connect() as connection:
            connection.execute("UPDATE wallets SET daily=?,monthly=0,topup=0 WHERE owner_id=?", (balance, owner))
        return client, owner

    return SimpleNamespace(database=database, user=user, root=tmp_path, monkeypatch=monkeypatch)


def service_for(env):
    from backend.huiju.api.routes.storyboards import storyboard_service
    from backend.huiju.providers import storyboard
    env.monkeypatch.setattr(storyboard_service.media_service, "database", env.database)
    env.monkeypatch.setattr(storyboard_service.media_service, "configured_for_video", lambda model: True)
    env.monkeypatch.setattr(storyboard, "MEDIA_WORKER_ENABLED", True)
    env.monkeypatch.setattr(storyboard_service, "poll_seconds", 0.001)
    return storyboard_service


def make_clip(env, *, size="160x90", color="red"):
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        pytest.skip("ffmpeg and ffprobe required")
    target = env.root / f"{uuid.uuid4().hex}.mp4"
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        f"color=c={color}:s={size}:r=25:d=0.4", "-f", "lavfi", "-i",
        "sine=frequency=440:sample_rate=48000:duration=0.4", "-c:v", "libx264",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(target),
    ], check=True, capture_output=True)
    return target


def completed_video(env, owner, clip):
    job_id = uuid.uuid4().hex
    target = env.database.private_media_dir / "videos" / owner / f"{job_id}.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(clip, target)
    env.database.create_media_job(owner, job_id, "video", "text_to_video", "test", "镜头", {})
    env.database.update_media_job(job_id, owner, status="completed", media_path=target.relative_to(env.database.private_media_dir).as_posix(), mime_type="video/mp4")
    return job_id


async def finish(service):
    await asyncio.gather(*list(service.tasks))


def test_quote_is_fixed_per_shot_and_does_not_debit(storyboard_env):
    client, owner = storyboard_env.user()
    before = relay.credit_summary(owner)["total"]
    response = client.post(BASE + "/quotes", json=PAYLOAD)
    assert response.status_code == 200
    quote = response.json()
    assert quote["total_credits"] == sum(shot["credits"] for shot in quote["shots"])
    assert [shot["duration"] for shot in quote["shots"]] == [5, 5]
    assert quote["composition_credits"] == 0
    assert quote["total_credits"] > 0
    assert relay.credit_summary(owner)["total"] == before


@pytest.mark.parametrize("changes", [{"shots": [{"prompt": "单个镜头"}]}, {"resolution": "480P"}])
def test_invalid_storyboards_never_debit(storyboard_env, changes):
    client, owner = storyboard_env.user()
    before = relay.credit_summary(owner)["total"]
    response = client.post(BASE + "/jobs", json={**PAYLOAD, **changes})
    assert response.status_code == 422
    assert relay.credit_summary(owner)["total"] == before
    assert storyboard_env.database.media_jobs_for(owner) == []


def test_whole_budget_is_checked_before_creating_parent_or_child(storyboard_env):
    service_for(storyboard_env)
    client, owner = storyboard_env.user(balance=1)
    response = client.post(BASE + "/jobs", json=PAYLOAD)
    assert response.status_code == 402
    assert relay.credit_summary(owner)["total"] == 1
    assert storyboard_env.database.media_jobs_for(owner) == []
    assert storyboard_env.database.recoverable_storyboard_jobs() == []


def test_compose_repeated_owned_video_preserves_audio_and_private_result(storyboard_env):
    service = service_for(storyboard_env)
    client, owner = storyboard_env.user()
    other, _ = storyboard_env.user()
    job_id = completed_video(storyboard_env, owner, make_clip(storyboard_env))
    before = relay.credit_summary(owner)["total"]

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver", cookies=client.cookies) as api:
            response = await api.post(BASE + "/compose", json={"title": "重复镜头", "job_ids": [job_id, job_id]})
            assert response.status_code == 202
            receipt = response.json()
            await finish(service)
            result = (await api.get(receipt["status_url"])).json()
            assert result["status"] == "completed"
            assert result["phase"] == "completed"
            assert result["completed_shots"] == result["total_shots"] == 2
            assert [shot["job_id"] for shot in result["shots"]] == [job_id, job_id]
            assert result["quote"]["total_credits"] == 0
            media = await api.get(result["url"])
            assert media.status_code == 200
            assert media.content[4:8] == b"ftyp"
            return receipt, result

    receipt, result = asyncio.run(run())
    assert other.get(receipt["status_url"]).status_code == 404
    assert other.get(result["url"]).status_code == 404
    assert relay.credit_summary(owner)["total"] == before
    record = storyboard_env.database.storyboard_job(owner, receipt["job_id"])
    output = storyboard_env.database.media_path(owner, "video", record["output_job_id"])
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(output)], check=True, capture_output=True).stdout)
    assert {stream["codec_type"] for stream in info["streams"]} == {"video", "audio"}
    assert 0.75 <= float(info["format"]["duration"]) <= 1.0
    assert "provider_task_id" not in json.dumps(result)
    assert str(storyboard_env.root) not in json.dumps(result)


def test_compose_rejects_other_owner_and_unfinished_jobs(storyboard_env):
    service_for(storyboard_env)
    first, owner = storyboard_env.user()
    second, _ = storyboard_env.user()
    job_id = uuid.uuid4().hex
    storyboard_env.database.create_media_job(owner, job_id, "video", "text_to_video", "test", "镜头", {})
    assert second.post(BASE + "/compose", json={"job_ids": [job_id, job_id]}).status_code == 404
    assert first.post(BASE + "/compose", json={"job_ids": [job_id, job_id]}).status_code == 422


def test_compose_mixed_specs_fails_explicitly_without_charge(storyboard_env):
    from backend.huiju.api.schemas import StoryboardComposeInput
    service = service_for(storyboard_env)
    _, owner = storyboard_env.user()
    ids = [completed_video(storyboard_env, owner, make_clip(storyboard_env, size=size)) for size in ("160x90", "128x72")]
    before = relay.credit_summary(owner)["total"]

    async def run():
        receipt = service.submit_compose(owner, StoryboardComposeInput(job_ids=ids))
        await finish(service)
        result = service.get(owner, receipt["job_id"])
        assert result["status"] == "failed"
        assert result["error"] == "storyboard_clip_specs_mismatch"
        assert "url" not in result
    asyncio.run(run())
    assert relay.credit_summary(owner)["total"] == before


@pytest.mark.parametrize("fail_first,provider_error,expected_error", [(False, "", ""), (True, "private-provider-code", "storyboard_shot_failed"), (True, "http_400:Arrearage", "storyboard_provider_arrearage")])
def test_generation_is_sequential_charges_frozen_quote_and_stops_at_failure(storyboard_env, fail_first, provider_error, expected_error):
    from backend.huiju.api.schemas import StoryboardGenerationInput
    service = service_for(storyboard_env)
    _, owner = storyboard_env.user()
    clip = make_clip(storyboard_env)
    submissions = []
    payload = StoryboardGenerationInput.model_validate(PAYLOAD)
    quote = service.quote(owner, payload)
    before = relay.credit_summary(owner)["total"]

    def submit(owner_id, job_id, request):
        parent = storyboard_env.database.recoverable_storyboard_jobs()[0]
        current = parent["shots"][len(submissions)]
        assert current["job_id"] == job_id and current["status"] == "submitting"
        assert all(storyboard_env.database.media_job(owner, value)["status"] == "completed" for value in submissions)
        assert request["provider_cost_cny"] == quote["shots"][len(submissions)]["provider_cost_cny"]
        submissions.append(job_id)
        storyboard_env.database.create_media_job(owner_id, job_id, "video", request["operation"], request["model"], request["prompt"], request)
        if fail_first:
            storyboard_env.database.update_media_job(job_id, owner_id, status="failed", error=provider_error)
        else:
            target = storyboard_env.database.private_media_dir / "videos" / owner / f"{job_id}.mp4"
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(clip, target)
            storyboard_env.database.update_media_job(job_id, owner_id, status="completed", mime_type="video/mp4", media_path=target.relative_to(storyboard_env.database.private_media_dir).as_posix())

    storyboard_env.monkeypatch.setattr(service.media_service, "submit_video", submit)

    async def run():
        receipt = service.submit(owner, payload)
        assert receipt["quote"] == quote
        from backend.huiju.providers import storyboard
        storyboard_env.monkeypatch.setattr(storyboard, "video_quote", lambda *args, **kwargs: pytest.fail("fixed quote was recalculated during execution"))
        await finish(service)
        result = service.get(owner, receipt["job_id"])
        assert result["status"] == ("failed" if fail_first else "completed")
        assert result["completed_shots"] == (0 if fail_first else 2)
        if fail_first:
            assert result["error"] == expected_error
        assert "private-provider-code" not in json.dumps(result)
    asyncio.run(run())
    assert len(submissions) == (1 if fail_first else 2)
    spent = quote["shots"][0]["credits"] if fail_first else quote["total_credits"]
    assert relay.credit_summary(owner)["total"] == before - spent


@pytest.mark.parametrize("has_child", [True, False])
def test_restart_never_resubmits_or_recharges_a_prepared_shot(storyboard_env, has_child):
    from backend.huiju.api.schemas import StoryboardGenerationInput
    service = service_for(storyboard_env)
    _, owner = storyboard_env.user()
    payload = StoryboardGenerationInput.model_validate(PAYLOAD)
    parent_id, missing_id = uuid.uuid4().hex, uuid.uuid4().hex
    source_id = completed_video(storyboard_env, owner, make_clip(storyboard_env))
    shots = [{"index": index, "prompt": shot.prompt, "duration": shot.duration,
              "credits": 10, "status": "submitting", "job_id": source_id if has_child else missing_id}
             for index, shot in enumerate(payload.shots, 1)]
    storyboard_env.database.create_storyboard_job(owner, parent_id, payload.title, {"mode": "generate", **payload.model_dump()}, service.quote(owner, payload), shots, uuid.uuid4().hex)
    before = relay.credit_summary(owner)["total"]
    storyboard_env.monkeypatch.setattr(service.media_service, "submit_video", lambda *args: pytest.fail("restart submitted a new paid task"))

    async def run():
        await service.start()
        await finish(service)
        result = service.get(owner, parent_id)
        assert result["status"] == ("completed" if has_child else "failed")
        if not has_child:
            assert result["error"] == "storyboard_submission_interrupted"
    asyncio.run(run())
    assert relay.credit_summary(owner)["total"] == before


def test_recovery_waits_for_existing_running_child_then_does_not_submit_next(storyboard_env):
    from backend.huiju.api.schemas import StoryboardGenerationInput
    service = service_for(storyboard_env)
    _, owner = storyboard_env.user()
    payload = StoryboardGenerationInput.model_validate(PAYLOAD)
    child_id, parent_id = uuid.uuid4().hex, uuid.uuid4().hex
    storyboard_env.database.create_media_job(owner, child_id, "video", "text_to_video", payload.model, "镜头", {})
    storyboard_env.database.update_media_job(child_id, owner, status="running")
    shots = [{"index": 1, "prompt": payload.shots[0].prompt, "duration": 5, "credits": 10, "status": "running", "job_id": child_id},
             {"index": 2, "prompt": payload.shots[1].prompt, "duration": 5, "credits": 10, "status": "pending", "job_id": ""}]
    storyboard_env.database.create_storyboard_job(owner, parent_id, payload.title, {"mode": "generate", **payload.model_dump()}, service.quote(owner, payload), shots, uuid.uuid4().hex)
    before = relay.credit_summary(owner)["total"]
    storyboard_env.monkeypatch.setattr(service.media_service, "submit_video", lambda *args: pytest.fail("restart must not submit"))

    async def run():
        await service.start()
        await asyncio.sleep(0.01)
        assert service.get(owner, parent_id)["status"] == "running"
        storyboard_env.database.update_media_job(child_id, owner, status="completed")
        await finish(service)
        result = service.get(owner, parent_id)
        assert result["completed_shots"] == 1
        assert result["error"] == "storyboard_submission_interrupted"
    asyncio.run(run())
    assert relay.credit_summary(owner)["total"] == before


def test_local_composition_restarts_same_output_job_after_process_interruption(storyboard_env):
    service = service_for(storyboard_env)
    _, owner = storyboard_env.user()
    child_id = completed_video(storyboard_env, owner, make_clip(storyboard_env))
    parent_id, output_id = uuid.uuid4().hex, uuid.uuid4().hex
    shots = [{"index": index, "prompt": "镜头", "duration": 5, "credits": 0, "status": "completed", "job_id": child_id} for index in (1, 2)]
    storyboard_env.database.create_storyboard_job(owner, parent_id, "恢复本地合成", {"mode": "compose", "job_ids": [child_id, child_id]}, {"total_credits": 0, "shots": [], "composition_credits": 0}, shots, output_id)
    storyboard_env.database.update_storyboard_job(owner, parent_id, status="running", phase="composing", shots=shots)
    storyboard_env.database.create_media_job(owner, output_id, "video", "storyboard_compose", "ffmpeg-local", "合成", {})
    storyboard_env.database.update_media_job(output_id, owner, status="failed", error="service_restarted")
    before = relay.credit_summary(owner)["total"]

    async def run():
        await service.start()
        await finish(service)
        assert service.get(owner, parent_id)["status"] == "completed"
        assert service.get(owner, parent_id)["url"].endswith(output_id)
        output = storyboard_env.database.media_job(owner, output_id)
        assert output["status"] == "completed" and output["error"] == ""
    asyncio.run(run())
    assert len(storyboard_env.database.media_jobs_for(owner)) == 2
    assert relay.credit_summary(owner)["total"] == before


def test_same_owner_second_parent_is_rejected_before_any_charge(storyboard_env):
    from backend.huiju.api.schemas import StoryboardGenerationInput
    from fastapi import HTTPException
    service = service_for(storyboard_env)
    _, owner = storyboard_env.user()
    before = relay.credit_summary(owner)["total"]
    storyboard_env.monkeypatch.setattr(service, "_track", lambda coroutine: coroutine.close())
    payload = StoryboardGenerationInput.model_validate(PAYLOAD)
    service.submit(owner, payload)
    with pytest.raises(HTTPException) as raised:
        service.submit(owner, payload)
    assert raised.value.status_code == 429
    assert len(storyboard_env.database.recoverable_storyboard_jobs()) == 1
    assert storyboard_env.database.media_jobs_for(owner) == []
    assert relay.credit_summary(owner)["total"] == before


def test_completed_output_is_adopted_when_parent_completion_was_interrupted(storyboard_env):
    service = service_for(storyboard_env)
    _, owner = storyboard_env.user()
    output_id = completed_video(storyboard_env, owner, make_clip(storyboard_env))
    parent_id = uuid.uuid4().hex
    shots = [{"index": index, "prompt": "镜头", "duration": 5, "credits": 0, "status": "completed", "job_id": output_id} for index in (1, 2)]
    storyboard_env.database.create_storyboard_job(owner, parent_id, "父完成恢复", {"mode": "compose", "job_ids": [output_id, output_id]}, {"total_credits": 0, "shots": [], "composition_credits": 0}, shots, output_id)
    storyboard_env.database.update_storyboard_job(owner, parent_id, status="running", phase="composing", shots=shots)
    original = storyboard_env.database.media_path(owner, "video", output_id).read_bytes()

    async def no_process(*args):
        pytest.fail("completed output must not be overwritten")
    storyboard_env.monkeypatch.setattr(service, "_process", no_process)

    async def run():
        await service.start()
        await finish(service)
        assert service.get(owner, parent_id)["status"] == "completed"
    asyncio.run(run())
    assert storyboard_env.database.media_path(owner, "video", output_id).read_bytes() == original
