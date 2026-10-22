from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.huiju.api.routes import agents


def test_agent_can_query_owned_storyboard_progress(monkeypatch):
    monkeypatch.setattr(agents.relay, "jobs", {})
    monkeypatch.setattr(agents.relay.database, "storyboard_job", lambda owner, job: {"id": job} if owner == "creator" else None)
    monkeypatch.setattr(agents, "storyboard_service", SimpleNamespace(get=lambda owner, job: {"job_id": job, "status": "running", "total_shots": 2, "completed_shots": 1}))
    result = agents._execute_tool("creator", "get_job_status", {"job_id": "a" * 32}, None)
    assert result == {"ok": True, "kind": "video", "job_id": "a" * 32, "status": "running", "total_shots": 2, "completed_shots": 1}


def test_storyboard_tool_submits_one_background_job_and_exposes_budget(monkeypatch):
    seen = []
    def submit(owner, payload):
        seen.append((owner, payload.model_dump()))
        return {"job_id": "a" * 32, "status": "queued", "status_url": "/api/v1/storyboards/jobs/" + "a" * 32, "quote": {"total_credits": 100}}
    monkeypatch.setattr(agents, "storyboard_service", SimpleNamespace(submit=submit))
    result = agents._execute_tool("creator", "generate_storyboard", {"title": "雨夜来信", "shots": [{"prompt": "雨夜街角一封信"}, {"prompt": "女侦探抬头望向路灯"}]}, None)
    assert result["ok"] is True
    assert result["credits"] == 100
    assert result["status_url"].startswith("/api/v1/storyboards/jobs/")
    assert len(seen) == 1
    assert seen[0][0] == "creator"
    assert len(seen[0][1]["shots"]) == 2


def test_storyboard_tool_keeps_business_errors_actionable(monkeypatch):
    def submit(owner, payload):
        raise HTTPException(402, "credits_insufficient")
    monkeypatch.setattr(agents, "storyboard_service", SimpleNamespace(submit=submit))
    result = agents._execute_tool("creator", "generate_storyboard", {"title": "短片", "shots": [{"prompt": "雨夜的街角"}, {"prompt": "晨光中的街道"}]}, None)
    assert result == {"ok": False, "error": "credits_insufficient"}


def test_compose_tool_preserves_the_requested_shot_order(monkeypatch):
    seen = []
    def compose(owner, payload):
        seen.extend(payload.job_ids)
        return {"job_id": "c" * 32, "status": "queued", "status_url": "/api/v1/storyboards/jobs/" + "c" * 32, "quote": {"total_credits": 0}}
    monkeypatch.setattr(agents, "storyboard_service", SimpleNamespace(submit_compose=compose))
    result = agents._execute_tool("creator", "compose_storyboard", {"title": "成片", "job_ids": ["b" * 32, "a" * 32, "b" * 32]}, None)
    assert result["ok"] is True
    assert result["credits"] == 0
    assert seen == ["b" * 32, "a" * 32, "b" * 32]
