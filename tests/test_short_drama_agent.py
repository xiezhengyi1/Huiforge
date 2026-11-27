import asyncio
from collections import defaultdict, deque
import json
from types import SimpleNamespace

from fastapi.testclient import TestClient
import httpx
import pytest

from backend.huiju.api.app import app
from backend.huiju.api.routes import agents
from backend.huiju.persistence.database import UserDatabase
from backend.huiju.providers import bailian_media


SESSIONS = "/api/v1/agents/short-drama/sessions"
IMAGE_ARGUMENTS = {
    "prompt": "雨夜小巷中的女侦探角色设定",
    "model": "qwen_image",
    "aspect_ratio": "9:16",
    "resolution": "720p",
    "quality": "standard",
    "style": "cinematic",
    "count": 1,
}


def text_response(response_id="response-final", text="分镜规划完成，请确认后再生成。"):
    return {"id": response_id, "status": "completed", "output": [{
        "type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}],
    }]}


def tool_response(name, arguments, response_id="response-tool"):
    return {"id": response_id, "status": "completed", "output": [{
        "type": "function_call", "name": name, "call_id": "call-1",
        "arguments": json.dumps(arguments),
    }]}


@pytest.fixture
def agent_env(tmp_path, monkeypatch):
    database = UserDatabase(tmp_path / "users.sqlite3", tmp_path / "private")
    monkeypatch.setattr(agents.relay, "database", database)
    monkeypatch.setattr(agents.relay, "jobs", {})
    monkeypatch.setattr(agents.relay, "uploads", {})
    monkeypatch.setattr(agents.relay, "queue", asyncio.Queue())
    monkeypatch.setattr(agents.relay, "owner_cache", {})
    monkeypatch.setattr(agents.relay, "membership_cache", {})
    monkeypatch.setattr(agents.relay, "rate_windows", defaultdict(deque))
    monkeypatch.setattr(agents.relay.gpu, "capability_status", lambda: {"zimage": True, "upscaler": True})
    monkeypatch.setattr(agents, "ARK_AGENT_API_KEY", "test-key")
    monkeypatch.setattr(agents, "ARK_AGENT_BASE_URL", "https://agent.test")
    monkeypatch.setattr(agents, "ARK_AGENT_MODEL", "test-agent-model")
    clients = []
    user_count = 0

    def provider(*replies):
        pending = deque(replies)
        requests = []

        def handle(request):
            assert request.url == "https://agent.test/responses"
            requests.append(json.loads(request.content))
            reply = pending.popleft()
            if isinstance(reply, Exception):
                raise reply
            status, body = reply if isinstance(reply, tuple) else (200, reply)
            return httpx.Response(status, json=body)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        clients.append(client)
        monkeypatch.setattr(agents.relay, "client", client)
        return requests

    def user():
        nonlocal user_count
        user_count += 1
        client = TestClient(app)
        client.get("/api/v1/users/me")
        device = client.cookies.get("huiju_session")
        owner = database.register_user(device, f"1390000{user_count:04d}", "unused-test-hash", "测试创作者")
        agents.relay.owner_cache.pop(device, None)
        return client, owner

    provider()
    yield SimpleNamespace(database=database, provider=provider, user=user)
    for client in clients:
        asyncio.run(client.aclose())


def create_session(client):
    response = client.post(SESSIONS, json={"title": "雨夜侦探"})
    assert response.status_code == 201
    return response.json()["id"]


def test_sessions_require_login_and_do_not_cross_users(agent_env):
    guest = TestClient(app)
    assert guest.post(SESSIONS, json={}).status_code == 401
    assert guest.get(SESSIONS).status_code == 401
    first, owner = agent_env.user()
    second, _ = agent_env.user()
    session_id = create_session(first)
    agent_env.database.update_short_drama_response(owner, session_id, "provider-private-id")

    assert [item["id"] for item in first.get(SESSIONS).json()["items"]] == [session_id]
    assert second.get(SESSIONS).json() == {"items": []}
    assert second.get(f"{SESSIONS}/{session_id}").status_code == 404
    assert second.post(f"{SESSIONS}/{session_id}/messages", json={"message": "读取别人的剧本"}).status_code == 404
    assert "provider_response_id" not in first.get(f"{SESSIONS}/{session_id}").json()


@pytest.mark.parametrize("auto_execute", [None, False])
def test_planning_disables_provider_tools_and_does_not_submit_jobs(agent_env, auto_execute):
    client, _ = agent_env.user()
    session_id = create_session(client)
    requests = agent_env.provider(text_response())
    payload = {"message": "先规划三镜头短剧，不生成素材"}
    if auto_execute is not None:
        payload["auto_execute"] = auto_execute

    response = client.post(f"{SESSIONS}/{session_id}/messages", json=payload)

    assert response.status_code == 200
    assert response.json()["tool_calls"] == []
    assert requests[0]["tool_choice"] == "none"
    assert agents.relay.queue.empty()
    assert agents.relay.jobs == {}
    assert [item["role"] for item in client.get(f"{SESSIONS}/{session_id}").json()["messages"]] == ["user", "assistant"]


def test_omitted_execution_flag_cannot_execute_a_provider_tool_call(agent_env):
    client, _ = agent_env.user()
    session_id = create_session(client)
    agent_env.provider(tool_response("generate_image", IMAGE_ARGUMENTS), text_response())

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "规划角色"})

    assert response.status_code == 200
    assert response.json()["tool_calls"][0]["result"] == {"ok": False, "status": "approval_required"}
    assert agents.relay.queue.empty()
    assert agents.relay.jobs == {}


def test_parallel_tool_calls_respect_total_per_turn_limit(agent_env, monkeypatch):
    client, _ = agent_env.user()
    session_id = create_session(client)
    monkeypatch.setattr(agents, "MAX_AGENT_TOOL_CALLS", 2)
    calls = tool_response("generate_image", IMAGE_ARGUMENTS)
    template = calls["output"][0]
    calls["output"] = [
        {**template, "call_id": "call-invalid", "arguments": "[]"},
        *[{**template, "call_id": f"call-{index}"} for index in range(3)],
    ]
    requests = agent_env.provider(calls, text_response())

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "确认生成角色图", "auto_execute": True})

    assert response.status_code == 200
    results = [event["result"] for event in response.json()["tool_calls"]]
    assert results[0]["error"] == "invalid_arguments"
    assert all(result["ok"] for result in results[1:3])
    assert results[3]["error"] == "tool_call_limit_reached"
    assert agents.relay.queue.qsize() == 2
    assert requests[1]["tool_choice"] == "none"


def test_agent_cannot_confirm_portrait_rights_on_behalf_of_user(agent_env):
    client, _ = agent_env.user()
    session_id = create_session(client)
    agent_env.provider(tool_response("edit_video", {
        "prompt": "制作角色替换视频",
        "operation": "character_swap_video",
        "model": "wan2.2-animate-mix",
        "upload_ids": ["0" * 32, "1" * 32],
        "rights_confirmed": True,
    }), text_response())

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "确认执行视频任务", "auto_execute": True})

    assert response.status_code == 200
    assert response.json()["tool_calls"][0]["result"] == {
        "ok": False, "error": "portrait_rights_confirmation_required",
    }


def test_confirmed_image_tool_enqueues_a_real_owned_job_and_persists_receipt(agent_env):
    client, owner = agent_env.user()
    session_id = create_session(client)
    requests = agent_env.provider(tool_response("generate_image", IMAGE_ARGUMENTS), text_response(text="角色图已提交，正在排队。"))

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "确认生成一张角色图", "auto_execute": True})

    assert response.status_code == 200
    event = response.json()["tool_calls"][0]
    assert event["result"]["ok"] is True
    job_id = event["result"]["job_id"]
    assert event["result"]["status"] == "queued"
    assert event["result"]["credits"] == 0
    assert event["result"]["status_url"] == f"/api/v1/images/jobs/{job_id}"
    assert agents.relay.queue.get_nowait() == job_id
    assert agents.relay.jobs[job_id]["owner"] == owner
    assert agents.relay.jobs[job_id]["payload"]["prompt"] == IMAGE_ARGUMENTS["prompt"]
    assert requests[1]["previous_response_id"] == "response-tool"
    assert json.loads(requests[1]["input"][0]["output"])["job_id"] == job_id
    messages = client.get(f"{SESSIONS}/{session_id}").json()["messages"]
    assert [item["role"] for item in messages] == ["user", "tool", "assistant"]
    assert messages[1]["tool"] == event


def test_submitted_tool_receipt_survives_followup_provider_failure(agent_env):
    client, owner = agent_env.user()
    session_id = create_session(client)
    agent_env.provider(tool_response("generate_image", IMAGE_ARGUMENTS), (502, {"error": {"message": "provider-private-id"}}))

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "确认生成角色图", "auto_execute": True})

    assert response.status_code == 502
    messages = client.get(f"{SESSIONS}/{session_id}").json()["messages"]
    assert [item["role"] for item in messages] == ["user", "tool"]
    result = messages[1]["tool"]["result"]
    assert result["ok"] is True
    assert result["status"] == "queued"
    assert agents.relay.jobs[result["job_id"]]["owner"] == owner
    assert agents.relay.queue.get_nowait() == result["job_id"]
    assert "provider-private-id" not in response.text


@pytest.mark.parametrize("kind", ["video", "audio"])
def test_media_status_uses_public_job_id_and_owned_media_url(agent_env, kind):
    client, owner = agent_env.user()
    session_id = create_session(client)
    job_id = "a" * 32
    agent_env.database.create_media_job(owner, job_id, kind, "generation", "test-model", "私人提示词", {})
    agent_env.database.update_media_job(job_id, owner, status="completed", provider_task_id="provider-task-private", provider_status="provider-private-state", media_path="private/output.bin")
    requests = agent_env.provider(tool_response("get_job_status", {"job_id": job_id}), text_response())

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "查看成片", "auto_execute": True})

    assert response.status_code == 200
    result = response.json()["tool_calls"][0]["result"]
    assert result == {"ok": True, "job_id": job_id, "kind": kind, "status": "completed", "url": f"/api/v1/private-media/{kind}/{job_id}"}
    assert json.loads(requests[1]["input"][0]["output"]) == result
    assert "provider_status" not in response.text
    assert "provider_task_id" not in response.text
    assert "private/output.bin" not in response.text


def test_failed_media_status_does_not_send_private_error_to_user_or_provider(agent_env):
    client, owner = agent_env.user()
    session_id = create_session(client)
    job_id = "b" * 32
    private_error = "provider_task_id=vendor-private C:\\private\\render.mp4 /srv/private/input.wav"
    agent_env.database.create_media_job(owner, job_id, "video", "text_to_video", "test-model", "", {})
    agent_env.database.update_media_job(job_id, owner, status="failed", error=private_error)
    requests = agent_env.provider(tool_response("get_job_status", {"job_id": job_id}), text_response())

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "查询失败原因", "auto_execute": True})

    assert response.status_code == 200
    result = response.json()["tool_calls"][0]["result"]
    assert result == {"ok": True, "job_id": job_id, "kind": "video", "status": "failed", "error": "media_generation_failed"}
    assert private_error not in response.text
    assert private_error not in requests[1]["input"][0]["output"]
    assert "vendor-private" not in client.get(f"{SESSIONS}/{session_id}").text


def test_other_user_cannot_query_jobs_or_edit_uploads(agent_env):
    first, owner = agent_env.user()
    second, _ = agent_env.user()
    session_id = create_session(second)
    job_id = "c" * 32
    agents.relay.jobs[job_id] = {"owner": owner, "status": "completed", "images": [{"url": "/private-owner-image"}]}
    agent_env.database.create_media_job(owner, job_id, "video", "text_to_video", "test-model", "", {})
    agent_env.provider(tool_response("get_job_status", {"job_id": job_id}), text_response())
    result = second.post(f"{SESSIONS}/{session_id}/messages", json={"message": "查询任务", "auto_execute": True})
    assert result.json()["tool_calls"][0]["result"] == {"ok": False, "error": "job_not_found"}

    upload_id = "d" * 32
    agents.relay.uploads[upload_id] = {"owner": owner, "kind": "image", "path": "private-owner-image"}
    agent_env.provider(tool_response("edit_image", {"operation": "upscale", "model": "server_ultrasharp", "upload_id": upload_id}), text_response())
    result = second.post(f"{SESSIONS}/{session_id}/messages", json={"message": "放大图像", "auto_execute": True})
    assert result.json()["tool_calls"][0]["result"] == {"ok": False, "error": "unknown_upload"}
    assert agents.relay.queue.empty()


def test_followup_uses_stored_provider_context_without_exposing_it(agent_env):
    client, owner = agent_env.user()
    session_id = create_session(client)
    requests = agent_env.provider(text_response("context-private-1"), text_response("context-private-2", "保留女侦探角色，把第二镜改为黎明。"))

    first = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "规划雨夜女侦探短剧", "auto_execute": False})
    second = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "只把第二镜改为黎明", "auto_execute": False})

    assert first.status_code == second.status_code == 200
    assert "previous_response_id" not in requests[0]
    assert requests[1]["previous_response_id"] == "context-private-1"
    assert agent_env.database.short_drama_session(owner, session_id)["provider_response_id"] == "context-private-2"
    detail = client.get(f"{SESSIONS}/{session_id}")
    assert [item["role"] for item in detail.json()["messages"]] == ["user", "assistant", "user", "assistant"]
    assert "context-private" not in first.text + second.text + detail.text


@pytest.mark.parametrize("provider_reply", [
    (429, {"error": {"message": "vendor-secret /srv/private/agent.log"}}),
    httpx.ReadTimeout("vendor-secret /srv/private/agent.log"),
    {"id": "vendor-secret", "status": "failed", "error": {"message": "C:\\private\\agent.log"}, "output": []},
])
def test_provider_failure_returns_safe_502_and_keeps_previous_context(agent_env, provider_reply):
    client, owner = agent_env.user()
    session_id = create_session(client)
    agent_env.database.update_short_drama_response(owner, session_id, "prior-context")
    agent_env.provider(provider_reply)

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "继续规划", "auto_execute": False})

    assert response.status_code == 502
    assert response.json() == {"detail": "agent_provider_unavailable"}
    assert agent_env.database.short_drama_session(owner, session_id)["provider_response_id"] == "prior-context"
    assert [item["role"] for item in client.get(f"{SESSIONS}/{session_id}").json()["messages"]] == ["user"]
    assert agents.relay.queue.empty()


def test_long_session_restores_latest_100_messages_with_tool_receipt_in_order(agent_env):
    client, owner = agent_env.user()
    session_id = create_session(client)
    for index in range(103):
        agent_env.database.add_short_drama_message(
            owner, session_id, "user" if index % 2 == 0 else "assistant", f"message-{index:03d}",
        )
    event = {
        "name": "generate_image", "arguments": IMAGE_ARGUMENTS,
        "result": {"ok": True, "job_id": "e" * 32, "status": "queued"},
    }
    agent_env.database.add_short_drama_message(owner, session_id, "tool", "", event)
    agent_env.database.add_short_drama_message(owner, session_id, "assistant", "最新镜头任务已经提交")

    response = client.get(f"{SESSIONS}/{session_id}")

    assert response.status_code == 200
    messages = response.json()["messages"]
    assert len(messages) == 100
    assert [item["content"] for item in messages] == [f"message-{index:03d}" for index in range(5, 103)] + ["", "最新镜头任务已经提交"]
    assert messages[-2]["role"] == "tool"
    assert messages[-2]["tool"] == event
    assert messages[-1]["role"] == "assistant"


@pytest.mark.parametrize("tool_name,kind,active_count,arguments", [
    ("generate_video", "video", 1, {"prompt": "雨夜侦探走过小巷", "model": "wan2.7-t2v-2026-06-12", "operation": "text_to_video", "upload_ids": [], "duration": 5}),
    ("synthesize_speech", "audio", 2, {"text": "雨夜里，她终于找到了线索。", "model": "qwen3-tts-flash", "voice": "Cherry"}),
    ("convert_video_to_depth", "video", 1, {"source_job_id": "f" * 32, "grayscale": True, "target_fps": 24, "max_frames": 60}),
])
def test_media_concurrency_rejection_does_not_charge_wallet(agent_env, monkeypatch, tool_name, kind, active_count, arguments):
    client, owner = agent_env.user()
    session_id = create_session(client)
    database = agent_env.database
    database.wallet_for(owner, 10000)
    with database._connect() as connection:
        connection.execute("UPDATE wallets SET daily=10000 WHERE owner_id=?", (owner,))
    monkeypatch.setattr(agents.media_service, "database", database)
    monkeypatch.setattr(agents.media_service, "configured_for_video", lambda _model: True)
    monkeypatch.setattr(agents.media_service, "configured_for_audio", lambda _model: True)
    monkeypatch.setattr(agents.video_depth_service, "database", database)
    monkeypatch.setattr(type(agents.video_depth_service), "configured", property(lambda _self: True))
    if tool_name == "convert_video_to_depth":
        source = database.private_media_dir / "source.mp4"
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"owned-video")
        database.create_media_job(owner, "f" * 32, "video", "text_to_video", "test-model", "", {}, status="completed")
        database.update_media_job("f" * 32, owner, media_path="source.mp4")
    for index in range(active_count):
        database.create_media_job(owner, f"{index + 1:032x}", kind, "generation", "test-model", "", {})
    before_wallet = database.wallet_for(owner, 10000)
    before_jobs = database.media_jobs_for(owner)
    agent_env.provider(tool_response(tool_name, arguments), text_response())

    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "确认提交素材任务", "auto_execute": True})

    assert response.status_code == 200
    assert response.json()["tool_calls"][0]["result"] == {"ok": False, "error": "media_concurrency_limit"}
    assert database.wallet_for(owner, 10000) == before_wallet
    assert database.media_jobs_for(owner) == before_jobs


@pytest.mark.parametrize("surface", ["api", "agent"])
@pytest.mark.parametrize("model,operation,upload_ids", [
    ("wan2.7-t2v-2026-06-12", "text_to_video", []),
    ("wan2.7-i2v-2026-04-25", "image_to_video", ["a" * 32]),
    ("wan2.7-r2v-2026-06-12", "reference_to_video", ["a" * 32]),
])
def test_wan27_rejects_480p_before_charging_or_creating_jobs(agent_env, monkeypatch, surface, model, operation, upload_ids):
    client, owner = agent_env.user()
    database = agent_env.database
    database.wallet_for(owner, 10000)
    with database._connect() as connection:
        connection.execute("UPDATE wallets SET daily=10000 WHERE owner_id=?", (owner,))
    monkeypatch.setattr(agents.media_service, "database", database)
    monkeypatch.setattr(agents.media_service, "configured_for_video", lambda _model: True)
    monkeypatch.setattr(agents.media_service, "_track", lambda coroutine: coroutine.close())
    # Keep local billing and job persistence real; signed URL minting and the
    # provider worker are outside this request-validation regression.
    monkeypatch.setattr(agents, "_provider_image_urls", lambda _request, _owner, ids: (
        ["https://media.test/reference.png"] * len(ids), ["image/png"] * len(ids),
    ))
    from backend.huiju.api.routes import media
    monkeypatch.setattr(media, "_provider_image_urls", agents._provider_image_urls)
    arguments = {"prompt": "雨夜侦探走过小巷", "model": model, "operation": operation, "upload_ids": upload_ids, "resolution": "480P", "ratio": "9:16", "duration": 5}
    before_wallet = database.wallet_for(owner, 10000)

    if surface == "api":
        response = client.post("/api/v1/videos/generations", json=arguments)
        assert response.status_code == 422
    else:
        session_id = create_session(client)
        agent_env.provider(tool_response("generate_video", arguments), text_response())
        response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "确认生成视频", "auto_execute": True})
        assert response.status_code == 200
        result = response.json()["tool_calls"][0]["result"]
        assert result["ok"] is False
        assert result["error"] == "invalid_arguments"

    assert database.wallet_for(owner, 10000) == before_wallet
    assert database.media_jobs_for(owner) == []


def test_agent_video_persists_billing_contract_and_resumes_without_new_submission(agent_env, monkeypatch):
    client, owner = agent_env.user()
    database = agent_env.database
    database.wallet_for(owner, 10000)
    with database._connect() as connection:
        connection.execute("UPDATE wallets SET daily=10000 WHERE owner_id=?", (owner,))
    service = bailian_media.BailianMediaService(database)
    monkeypatch.setattr(agents, "media_service", service)
    monkeypatch.setattr(service, "configured_for_video", lambda _model: True)
    monkeypatch.setattr(type(service), "configured", property(lambda _self: True))
    monkeypatch.setattr(service, "_track", lambda coroutine: coroutine.close())
    monkeypatch.setattr(bailian_media, "PRIVATE_MEDIA_DIR", database.private_media_dir)
    session_id = create_session(client)
    arguments = {"prompt": "雨夜侦探走过小巷", "model": "wan2.7-t2v-2026-06-12", "operation": "text_to_video", "upload_ids": [], "resolution": "720P", "ratio": "9:16", "duration": 5}
    agent_env.provider(tool_response("generate_video", arguments), text_response())
    response = client.post(f"{SESSIONS}/{session_id}/messages", json={"message": "确认生成视频", "auto_execute": True})
    assert response.status_code == 200
    result = response.json()["tool_calls"][0]["result"]
    assert result["ok"] is True
    job_id = result["job_id"]
    database.update_media_job(job_id, owner, status="running", provider_task_id="existing-upstream-task")
    stored_job = database.recoverable_media_jobs()[0]
    charged_wallet = database.wallet_for(owner, 10000)
    requests = []
    video_bytes = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"

    def handle(request):
        assert request.method == "GET", "recovery cannot create another provider task"
        requests.append(request.url.path)
        if request.url.path.endswith("/tasks/existing-upstream-task"):
            return httpx.Response(200, json={"output": {
                "task_status": "SUCCEEDED", "video_url": "https://result.aliyuncs.com/existing.mp4",
            }})
        assert str(request.url) == "https://result.aliyuncs.com/existing.mp4"
        return httpx.Response(200, content=video_bytes, headers={"Content-Type": "video/mp4"})

    async def recover():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as upstream:
            service.client = upstream
            await service._resume_video(stored_job)

    asyncio.run(recover())

    assert database.media_job(owner, job_id)["status"] == "completed"
    assert stored_job["parameters"]["provider_cost_cny"] == 3.0
    assert database.media_path(owner, "video", job_id).read_bytes() == video_bytes
    assert database.wallet_for(owner, 10000) == charged_wallet
    assert len(database.media_jobs_for(owner)) == 1
    assert requests == ["/api/v1/tasks/existing-upstream-task", "/existing.mp4"]
