import importlib
from pathlib import Path
import subprocess

from fastapi.testclient import TestClient
from PIL import Image
import pytest

from backend.huiju.api.app import app
from backend.huiju.api.routes import agents
from backend.huiju.persistence.database import UserDatabase
from test_short_drama_frontend import SHARED_WORKSPACE_DOM


ROOT = Path(__file__).resolve().parents[1]
SESSIONS = "/api/v1/agents/short-drama/sessions"
relay_module = importlib.import_module("backend.huiju.runtime.relay")


@pytest.mark.parametrize("tool_name", ["generate_image", "edit_image"])
def test_persisted_image_receipt_survives_lost_runtime_jobs(tmp_path, monkeypatch, tool_name):
    private_dir = tmp_path / "private"
    database_path = tmp_path / "users.sqlite3"
    database = UserDatabase(database_path, private_dir)
    generated_dir = tmp_path / "generated"
    generated_dir.mkdir()
    monkeypatch.setattr(relay_module, "GENERATED_DIR", generated_dir)
    monkeypatch.setattr(relay_module, "PRIVATE_MEDIA_DIR", private_dir)
    monkeypatch.setattr(agents.relay, "database", database)
    monkeypatch.setattr(agents.relay, "jobs", {})
    monkeypatch.setattr(agents.relay, "owner_cache", {})
    monkeypatch.setattr(agents.relay, "membership_cache", {})

    clients = []
    owners = []
    for number in (1, 2):
        client = TestClient(app)
        client.get("/api/v1/users/me")
        device = client.cookies.get("huiju_session")
        owner = database.register_user(device, f"1390000{number:04d}", "test-hash", "创作者")
        agents.relay.owner_cache.pop(device, None)
        clients.append(client)
        owners.append(owner)

    job_id = "a" * 32
    other_job_id = "b" * 32
    prompt = "雨夜女侦探角色图"
    event = {
        "name": tool_name, "arguments": {"prompt": prompt, "model": "qwen_image"},
        "result": {"ok": True, "job_id": job_id, "status": "queued", "credits": 0,
                   "status_url": f"/api/v1/images/jobs/{job_id}"},
    }
    first_session = database.create_short_drama_session(owners[0], "雨夜侦探")
    second_session = database.create_short_drama_session(owners[1], "另一位创作者")
    database.add_short_drama_message(owners[0], first_session["id"], "tool", "", event)
    database.add_short_drama_message(owners[1], second_session["id"], "tool", "", event)
    database.add_short_drama_message(owners[0], first_session["id"], "tool", "", {
        **event, "result": {**event["result"], "job_id": other_job_id},
    })
    source = generated_dir / f"{job_id}-0.png"
    Image.new("RGB", (2, 2), "green").save(source)
    original_bytes = source.read_bytes()
    images = [{"url": f"/generated/{source.name}?expires=1&token=temporary"}]

    agents.relay.record_history(owners[0], images, prompt, "qwen_image", job_id=job_id)

    # A fresh database object and an empty job map model an application restart.
    monkeypatch.setattr(agents.relay, "database", UserDatabase(database_path, private_dir))
    agents.relay.jobs.clear()
    assert clients[0].get(f"/api/v1/images/jobs/{job_id}").status_code == 404
    response = clients[0].get(f"{SESSIONS}/{first_session['id']}")
    assert response.status_code == 200
    messages = response.json()["messages"]
    result = messages[0]["tool"]["result"]
    assert result == {
        **event["result"], "status": "completed",
        "images": [{"url": images[0]["history_url"]}],
    }
    assert messages[0]["tool"]["arguments"] == event["arguments"]
    assert messages[1]["tool"]["result"]["status"] == "queued"
    permanent_url = result["images"][0]["url"]
    assert permanent_url.startswith("/api/v1/private-media/history/")
    assert "?" not in permanent_url
    source.unlink()
    assert clients[0].get(permanent_url).content == original_bytes
    assert clients[1].get(permanent_url).status_code == 404
    untouched = clients[1].get(f"{SESSIONS}/{second_session['id']}").json()["messages"][0]
    assert untouched["tool"]["result"]["status"] == "queued"


def test_completed_session_receipt_renders_without_polling_lost_image_job():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const sessionId = 'a'.repeat(32);
const jobId = 'b'.repeat(32);
const permanentUrl = '/api/v1/private-media/history/' + 'c'.repeat(32);
const polled = [];
const request = async url => {
  if (url.endsWith('/sessions')) return {body: {items: [{id: sessionId, title: '已完成角色图', updated_at: 1}]}};
  if (url === '/api/v1/images/jobs/' + jobId) {
    polled.push(url);
    const error = new Error('runtime job no longer exists');
    error.status = 404;
    throw error;
  }
  return {body: {id: sessionId, title: '已完成角色图', messages: [{
    id: 'tool-message', role: 'tool', tool: {
      name: 'generate_image', arguments: {prompt: '雨夜女侦探角色图'},
      result: {ok: true, job_id: jobId, status: 'completed', credits: 0,
        status_url: '/api/v1/images/jobs/' + jobId, images: [{url: permanentUrl}]},
    },
  }]}};
};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange() {}});
await controller.open(true);
await nodes.get('refresh-jobs').listeners.click();
assert.deepEqual(polled, [], 'persisted completed jobs must not depend on the in-memory status endpoint');
const card = nodes.get('messages').children[0];
assert.equal(card.dataset.status, 'completed');
assert.equal(card.children.at(-1).children[0].src, permanentUrl);
assert.equal(card.children.at(-1).children[1].href, permanentUrl);
controller.suspend();
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr
