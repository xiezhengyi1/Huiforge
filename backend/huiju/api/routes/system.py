"""Health, model catalog, capability and administrative APIs."""
from __future__ import annotations

import asyncio
import csv
import contextlib
import hmac
import io
import json
import os
import re
import shutil
import sqlite3
import statistics
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response

from ...catalog.models import *
from ...core.config import *
from ..dependencies import *
from ...runtime import *
from ..schemas import *
from ...catalog.pricing import image_quote, member_exclusive, membership_active, pricing_catalog, video_quote
from ...persistence.analytics import create_edge_snapshot, snapshot_status, traffic_snapshot

router = APIRouter()
CHINA_TZ = timezone(timedelta(hours=8))


def _storage_ready(path: Path) -> bool:
    """Check configured storage without exposing its filesystem location."""
    try:
        return path.is_dir() and os.access(path, os.R_OK | os.W_OK)
    except OSError:
        return False


@router.get("/api/v1/health/live")
async def health_live() -> dict[str, str]:
    """Lightweight process liveness probe for load balancers."""
    return {"status": "ok", "version": APP_VERSION, "release": RELEASE_ID}


@router.get("/api/v1/health/ready")
async def health_ready() -> JSONResponse:
    """Dependency-aware readiness probe with no credentials or internal paths."""
    checks = {
        "database": relay.database.healthcheck(),
        "generated_storage": _storage_ready(GENERATED_DIR),
        "private_storage": _storage_ready(PRIVATE_MEDIA_DIR),
        "runtime": bool(relay.client is not None and not relay.client.is_closed),
        "workers": bool(relay.workers and all(not task.done() for task in relay.workers)),
    }
    ready = all(checks.values())
    return JSONResponse(
        {
            "status": "ready" if ready else "starting",
            "version": APP_VERSION,
            "release": RELEASE_ID,
            "checks": checks,
        },
        status_code=200 if ready else 503,
        headers={"Retry-After": "5"} if not ready else None,
    )

@router.get("/api/v1/stats")
async def stats() -> dict[str, Any]:
    relay.prune()
    return traffic_snapshot()

@router.get("/api/v1/admin/model-usage")
async def admin_model_usage(
    request: Request,
    start: float | None = Query(default=None, ge=0),
    end: float | None = Query(default=None, ge=0),
    provider: str | None = Query(default=None, max_length=40, pattern=r"^[a-z0-9_]+$"),
    model: str | None = Query(default=None, max_length=64, pattern=r"^[a-z0-9_]+$"),
    status: Literal["completed", "failed"] | None = None,
    group_by: Literal["model", "provider", "billing_category", "day"] = "model",
    limit: int = Query(default=100, ge=0, le=1000),
) -> dict[str, Any]:
    """Admin-only model usage, Credits and estimated provider billing report."""
    require_usage_admin(request)
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=422, detail="invalid_time_range")
    events = []
    for event in relay.model_usage_events():
        created_at = float(event.get("created_at") or 0)
        if start is not None and created_at < start:
            continue
        if end is not None and created_at > end:
            continue
        if provider and event.get("provider") != provider:
            continue
        if model and event.get("model") != model:
            continue
        if status and event.get("status") != status:
            continue
        events.append(event)

    def empty_totals() -> dict[str, Any]:
        return {
            "jobs": 0, "completed": 0, "failed": 0, "provider_requests": 0,
            "images": 0, "credits_charged": 0, "provider_cost_usd": 0.0,
            "unpriced_jobs": 0, "duration_ms": 0,
        }

    def add_event(totals: dict[str, Any], event: dict[str, Any]) -> None:
        totals["jobs"] += 1
        if event.get("status") == "completed":
            totals["completed"] += 1
        else:
            totals["failed"] += 1
        totals["provider_requests"] += int(event.get("request_count") or 0)
        totals["images"] += int(event.get("image_count") or 0)
        totals["credits_charged"] += int(event.get("credits_charged") or 0)
        totals["duration_ms"] += int(event.get("duration_ms") or 0)
        cost = event.get("provider_cost_usd")
        if isinstance(cost, (int, float)):
            totals["provider_cost_usd"] += float(cost)
        elif event.get("provider") != "local":
            totals["unpriced_jobs"] += 1

    totals = empty_totals()
    grouped: dict[str, dict[str, Any]] = {}
    for event in events:
        add_event(totals, event)
        if group_by == "day":
            group_key = datetime.fromtimestamp(float(event.get("created_at") or 0), timezone(timedelta(hours=8))).strftime("%Y-%m-%d")
        else:
            group_key = str(event.get(group_by) or "unknown")
        group = grouped.setdefault(group_key, {"key": group_key, **empty_totals()})
        add_event(group, event)
    totals["provider_cost_usd"] = round(totals["provider_cost_usd"], 8)
    for group in grouped.values():
        group["provider_cost_usd"] = round(group["provider_cost_usd"], 8)
    return {
        "currency": "USD",
        "cost_kind": "provider_list_price_estimate",
        "filters": {"start": start, "end": end, "provider": provider, "model": model, "status": status, "group_by": group_by},
        "totals": totals,
        "groups": sorted(grouped.values(), key=lambda item: (-item["provider_cost_usd"], item["key"])),
        "pricing": GOOGLE_IMAGE_PRICING_USD,
        "recent_events": sorted(events, key=lambda item: float(item.get("created_at") or 0), reverse=True)[:limit],
    }


def _percentile(values: list[int], ratio: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((len(ordered) - 1) * ratio)))
    return int(ordered[index])


def _usage_totals(events: list[dict[str, Any]]) -> dict[str, Any]:
    durations = [max(0, int(event.get("duration_ms") or 0)) for event in events]
    completed = sum(1 for event in events if event.get("status") == "completed")
    failed = sum(1 for event in events if event.get("status") == "failed")
    priced_jobs = sum(1 for event in events if isinstance(event.get("provider_cost_usd"), (int, float)))
    nonlocal_jobs = sum(1 for event in events if event.get("provider") != "local")
    provider_cost = sum(
        float(event["provider_cost_usd"])
        for event in events if isinstance(event.get("provider_cost_usd"), (int, float))
    )
    return {
        "jobs": len(events),
        "completed": completed,
        "failed": failed,
        "success_rate": round(completed / len(events) * 100, 2) if events else 0.0,
        "provider_requests": sum(int(event.get("request_count") or 0) for event in events),
        "outputs": sum(int(event.get("image_count") or 0) for event in events),
        "credits_charged": sum(int(event.get("credits_charged") or 0) for event in events),
        "provider_cost_usd": round(provider_cost, 8),
        "priced_jobs": priced_jobs,
        "nonlocal_jobs": nonlocal_jobs,
        "unpriced_jobs": sum(
            1 for event in events
            if event.get("provider") != "local" and not isinstance(event.get("provider_cost_usd"), (int, float))
        ),
        "avg_duration_ms": round(sum(durations) / len(durations)) if durations else 0,
        "median_duration_ms": int(statistics.median(durations)) if durations else 0,
        "p95_duration_ms": _percentile(durations, 0.95),
        "max_duration_ms": max(durations, default=0),
    }


def _traffic_analytics(
    start_day: str,
    month_day: str,
    today: str,
    previous_start_day: str | None = None,
    previous_end_day: str | None = None,
) -> dict[str, Any]:
    empty = {
        "all_time": {"page_views": 0, "api_writes": 0, "visitors": 0},
        "today": {"page_views": 0, "api_writes": 0, "visitors": 0},
        "month": {"page_views": 0, "api_writes": 0, "visitors": 0},
        "range": {"page_views": 0, "api_writes": 0, "visitors": 0},
        "previous": {"page_views": 0, "api_writes": 0, "visitors": 0},
        "daily": [],
        "tracking_started_at": None,
    }
    if not EDGE_STATS_DB.is_file():
        return empty
    try:
        with sqlite3.connect(EDGE_STATS_DB, timeout=10) as connection:
            connection.row_factory = sqlite3.Row
            tables = {
                str(row[0]) for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'",
                )
            }
            counters = dict(connection.execute("SELECT key,value FROM counters")) if "counters" in tables else {}
            visitor_total = int(connection.execute("SELECT COUNT(*) FROM visitors").fetchone()[0]) if "visitors" in tables else 0
            tracking_row = connection.execute(
                "SELECT value FROM metadata WHERE key='daily_tracking_started_at'",
            ).fetchone() if "metadata" in tables else None
            daily_rows = connection.execute(
                """SELECT c.day,c.page_views,c.api_writes,COUNT(v.session_id) AS visitors
                   FROM daily_counters c LEFT JOIN daily_visitors v ON v.day=c.day
                   WHERE c.day >= ? GROUP BY c.day,c.page_views,c.api_writes ORDER BY c.day""",
                (start_day,),
            ).fetchall() if {"daily_counters", "daily_visitors"} <= tables else []
            today_row = connection.execute(
                """SELECT c.page_views,c.api_writes,COUNT(v.session_id) AS visitors
                   FROM daily_counters c LEFT JOIN daily_visitors v ON v.day=c.day
                   WHERE c.day=? GROUP BY c.day,c.page_views,c.api_writes""",
                (today,),
            ).fetchone() if {"daily_counters", "daily_visitors"} <= tables else None
            month_row = connection.execute(
                "SELECT COALESCE(SUM(page_views),0),COALESCE(SUM(api_writes),0) FROM daily_counters WHERE day>=?",
                (month_day,),
            ).fetchone() if "daily_counters" in tables else (0, 0)
            month_visitors = int(connection.execute(
                "SELECT COUNT(DISTINCT session_id) FROM daily_visitors WHERE day>=?",
                (month_day,),
            ).fetchone()[0]) if "daily_visitors" in tables else 0
            range_row = connection.execute(
                "SELECT COALESCE(SUM(page_views),0),COALESCE(SUM(api_writes),0) FROM daily_counters WHERE day>=? AND day<=?",
                (start_day, today),
            ).fetchone() if "daily_counters" in tables else (0, 0)
            range_visitors = int(connection.execute(
                "SELECT COUNT(DISTINCT session_id) FROM daily_visitors WHERE day>=? AND day<=?",
                (start_day, today),
            ).fetchone()[0]) if "daily_visitors" in tables else 0
            previous_row = connection.execute(
                "SELECT COALESCE(SUM(page_views),0),COALESCE(SUM(api_writes),0) FROM daily_counters WHERE day>=? AND day<=?",
                (previous_start_day, previous_end_day),
            ).fetchone() if "daily_counters" in tables and previous_start_day and previous_end_day else (0, 0)
            previous_visitors = int(connection.execute(
                "SELECT COUNT(DISTINCT session_id) FROM daily_visitors WHERE day>=? AND day<=?",
                (previous_start_day, previous_end_day),
            ).fetchone()[0]) if "daily_visitors" in tables and previous_start_day and previous_end_day else 0
    except sqlite3.Error:
        return empty
    return {
        "all_time": {
            "page_views": int(counters.get("page_views", 0)),
            "api_writes": int(counters.get("clicks", 0)),
            "visitors": visitor_total,
        },
        "today": {
            "page_views": int(today_row["page_views"]) if today_row else 0,
            "api_writes": int(today_row["api_writes"]) if today_row else 0,
            "visitors": int(today_row["visitors"]) if today_row else 0,
        },
        "month": {
            "page_views": int(month_row[0]),
            "api_writes": int(month_row[1]),
            "visitors": month_visitors,
        },
        "range": {
            "page_views": int(range_row[0]),
            "api_writes": int(range_row[1]),
            "visitors": range_visitors,
        },
        "previous": {
            "page_views": int(previous_row[0]),
            "api_writes": int(previous_row[1]),
            "visitors": previous_visitors,
        },
        "daily": [
            {
                "day": str(row["day"]),
                "page_views": int(row["page_views"]),
                "api_writes": int(row["api_writes"]),
                "visitors": int(row["visitors"]),
            }
            for row in daily_rows
        ],
        "tracking_started_at": float(tracking_row[0]) if tracking_row else None,
    }


def _group_usage(events: list[dict[str, Any]], key_name: str) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        if key_name == "model":
            key = str(event.get("model_label") or event.get("model") or "unknown")
        else:
            key = str(event.get(key_name) or "unknown")
        grouped[key].append(event)
    return sorted(
        ({"key": key, **_usage_totals(items)} for key, items in grouped.items()),
        key=lambda item: (-item["jobs"], -item["provider_cost_usd"], item["key"]),
    )


def _error_breakdown(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    failures = [event for event in events if event.get("status") == "failed"]
    grouped: dict[str, int] = defaultdict(int)
    for event in failures:
        grouped[str(event.get("error_code") or "unknown_error")[:80]] += 1
    return [
        {
            "code": code,
            "count": count,
            "share": round(count / len(failures) * 100, 2) if failures else 0.0,
        }
        for code, count in sorted(grouped.items(), key=lambda item: (-item[1], item[0]))
    ]


def _change(current: int | float, previous: int | float) -> float | None:
    if previous == 0:
        return 0.0 if current == 0 else None
    return round((current - previous) / previous * 100, 2)


def _analytics_payload(days: int) -> dict[str, Any]:
    now = datetime.now(CHINA_TZ)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    range_start = today_start - timedelta(days=days - 1)
    previous_end = range_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    month_start = today_start.replace(day=1)
    end_ts = now.timestamp()
    events = [
        event for event in relay.model_usage_events()
        if float(event.get("created_at") or 0) <= end_ts
    ]
    range_events = [event for event in events if float(event.get("created_at") or 0) >= range_start.timestamp()]
    previous_events = [
        event for event in events
        if previous_start.timestamp() <= float(event.get("created_at") or 0) < range_start.timestamp()
    ]
    today_events = [event for event in events if float(event.get("created_at") or 0) >= today_start.timestamp()]
    month_events = [event for event in events if float(event.get("created_at") or 0) >= month_start.timestamp()]
    traffic = _traffic_analytics(
        range_start.strftime("%Y-%m-%d"),
        month_start.strftime("%Y-%m-%d"),
        now.strftime("%Y-%m-%d"),
        previous_start.strftime("%Y-%m-%d"),
        previous_end.strftime("%Y-%m-%d"),
    )
    accounts = relay.database.analytics_snapshot(range_start.timestamp(), end_ts)
    traffic_by_day = {item["day"]: item for item in traffic["daily"]}
    users_by_day = {item["day"]: item["users"] for item in accounts["new_users_daily"]}
    usage_by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in range_events:
        day = datetime.fromtimestamp(float(event.get("created_at") or 0), CHINA_TZ).strftime("%Y-%m-%d")
        usage_by_day[day].append(event)
    tracking_started_at = traffic.get("tracking_started_at")
    tracking_day = (
        datetime.fromtimestamp(float(tracking_started_at), CHINA_TZ).strftime("%Y-%m-%d")
        if isinstance(tracking_started_at, (int, float)) else None
    )
    daily = []
    for offset in range(days):
        day = (range_start + timedelta(days=offset)).strftime("%Y-%m-%d")
        traffic_item = traffic_by_day.get(day, {})
        if tracking_day and day < tracking_day:
            coverage = "unavailable"
        elif tracking_day and day == tracking_day:
            coverage = "partial"
        else:
            coverage = "tracked" if traffic_item else "no_events"
        daily.append({
            "day": day,
            "coverage": coverage,
            "visitors": int(traffic_item.get("visitors", 0)),
            "page_views": int(traffic_item.get("page_views", 0)),
            "api_writes": int(traffic_item.get("api_writes", 0)),
            "new_users": int(users_by_day.get(day, 0)),
            **_usage_totals(usage_by_day.get(day, [])),
        })
    unavailable_days = sum(1 for item in daily if item["coverage"] == "unavailable")
    current_usage = _usage_totals(range_events)
    previous_usage = _usage_totals(previous_events)
    sanitized_events = [
        {
            "created_at": float(event.get("created_at") or 0),
            "job_id": str(event.get("job_id") or "")[-12:],
            "model": str(event.get("model_label") or event.get("model") or "unknown"),
            "provider": str(event.get("provider") or "unknown"),
            "operation": str(event.get("operation") or "unknown"),
            "media_kind": str(event.get("media_kind") or "unknown"),
            "status": str(event.get("status") or "unknown"),
            "duration_ms": max(0, int(event.get("duration_ms") or 0)),
            "provider_cost_usd": event.get("provider_cost_usd") if isinstance(event.get("provider_cost_usd"), (int, float)) else None,
            "credits_charged": max(0, int(event.get("credits_charged") or 0)),
            "error_code": str(event.get("error_code") or "")[:80],
        }
        for event in sorted(range_events, key=lambda item: float(item.get("created_at") or 0), reverse=True)
    ]
    return {
        "release": RELEASE_ID,
        "generated_at": end_ts,
        "timezone": "Asia/Shanghai",
        "range": {"days": days, "start": range_start.timestamp(), "end": end_ts},
        "traffic": {
            **traffic,
            "daily": daily,
            "coverage": {
                "exact_from_day": tracking_day,
                "unavailable_days": unavailable_days,
                "tracked_days": days - unavailable_days,
            },
        },
        "accounts": accounts,
        "usage": {
            "range": current_usage,
            "previous": previous_usage,
            "today": _usage_totals(today_events),
            "month": _usage_totals(month_events),
            "change": {
                "jobs": _change(current_usage["jobs"], previous_usage["jobs"]),
                "provider_cost_usd": _change(current_usage["provider_cost_usd"], previous_usage["provider_cost_usd"]),
                "success_rate": round(current_usage["success_rate"] - previous_usage["success_rate"], 2),
                "visitors": _change(traffic["range"]["visitors"], traffic["previous"]["visitors"]),
            },
            "by_model": _group_usage(range_events, "model"),
            "by_provider": _group_usage(range_events, "provider"),
            "error_breakdown": _error_breakdown(range_events),
            "recent_events": sanitized_events[:24],
            "slowest_events": sorted(sanitized_events, key=lambda item: item["duration_ms"], reverse=True)[:8],
        },
        "recovery": snapshot_status(),
        "definitions": {
            "visitor": "浏览首页或工作台的独立服务器会话；按日、按月分别去重。",
            "api_write": "产生业务写操作的 POST API 请求，不含读取、轮询和健康检查。",
            "provider_request": "模型任务实际发往上游服务商的请求次数。",
            "cost": "依照服务商公开列表价估算的 USD 成本；未定价任务单独标注。",
            "duration": "从任务进入执行到完成或失败的墙钟时间。",
            "recovery": "每日 SQLite 在线快照，含日访问量与去重会话；恢复必须在入口服务停止后离线执行。",
        },
    }


@router.get("/api/v1/admin/analytics")
async def admin_analytics(
    request: Request,
    days: int = Query(default=30, ge=7, le=90),
) -> dict[str, Any]:
    """Detailed, admin-only operating snapshot for the analytics panel."""
    require_usage_admin(request)
    return _analytics_payload(days)


@router.get("/api/v1/admin/analytics/export")
async def export_admin_analytics(
    request: Request,
    days: int = Query(default=30, ge=7, le=90),
    format: Literal["csv", "json"] = "csv",
) -> Response:
    """Export privacy-safe daily aggregates; raw visitor session IDs are never included."""
    require_usage_admin(request)
    payload = _analytics_payload(days)
    date_stamp = datetime.now(CHINA_TZ).strftime("%Y%m%d")
    if format == "json":
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        return Response(
            body,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="huiju-analytics-{date_stamp}.json"'},
        )
    output = io.StringIO(newline="")
    fields = [
        "day", "coverage", "visitors", "page_views", "api_writes", "new_users",
        "jobs", "completed", "failed", "success_rate", "provider_requests",
        "credits_charged", "provider_cost_usd", "unpriced_jobs", "avg_duration_ms", "p95_duration_ms",
    ]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(payload["traffic"]["daily"])
    return Response(
        "\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="huiju-analytics-{date_stamp}.csv"'},
    )


@router.post("/api/v1/admin/analytics/snapshot")
async def create_admin_analytics_snapshot(request: Request) -> dict[str, Any]:
    """Create an on-demand, integrity-checked daily restore point."""
    require_usage_admin(request)
    result = await asyncio.to_thread(create_edge_snapshot, force=True)
    if not result.get("created") and result.get("reason") == "snapshot_failed":
        raise HTTPException(status_code=503, detail="analytics_snapshot_failed")
    return result

@router.get("/api/v1/pricing")
async def public_pricing(request: Request) -> dict[str, Any]:
    """Return the exact tariff used by charging and every client surface."""
    membership = relay.membership_for(owner_id(request))
    return {**pricing_catalog(membership_active(membership)), "member": membership_active(membership)}


@router.get("/api/v1/models")
async def models(request: Request) -> dict[str, Any]:
    capabilities = relay.gpu.capability_status()
    member = membership_active(relay.membership_for(owner_id(request)))
    image_tools_available = bool(
        capabilities["image_tools"]
        or (FAL_KEY and FAL_QUEUE_BASE_URL)
        or (DASHSCOPE_API_KEY and BAILIAN_BASE_URL)
        or (SEEDREAM_API_KEY and SEEDREAM_BASE_URL)
    )
    available_models = {}
    catalog_by_id = {item["id"]: item for item in MODEL_CATALOG}
    for mid, cfg in MODELS.items():
        member_only = member_exclusive(mid)
        available = model_is_available(mid, capabilities) and (member or not member_only)
        metadata = catalog_by_id.get(mid, {})
        available_models[mid] = {
            "label": cfg["label"], "available": available,
            "badges": [*metadata.get("badges", []), *( ["会员专享"] if member_only else [] )], "tagline": metadata.get("tagline", ""),
            "speed": metadata.get("speed", ""), "max_resolution": metadata.get("max_resolution", ""),
            "credit_note": "免费 · 每分钟最多 10 次" if mid == "qwen_image" else f"{image_quote(mid, '1k', member=member)['unit_credits']} Credits/张",
            "capabilities": cfg.get("capabilities", []),
            "credits": image_quote(mid, "1k", member=member)["unit_credits"],
            "free": mid == "qwen_image",
            "member_only": member_only,
            "rate_limit_per_minute": QWEN_IMAGE_REQUESTS_PER_MINUTE if mid == "qwen_image" else None,
        }
    tool_models: dict[str, dict[str, Any]] = {}
    for model_id in TOOL_MODEL_IDS:
        cfg = MODELS[model_id]
        metadata = catalog_by_id.get(model_id, {})
        member_only = member_exclusive(model_id)
        tool_models[model_id] = {
            "label": cfg["label"],
            "available": model_is_available(model_id, capabilities) and (member or not member_only),
            "badges": [*metadata.get("badges", []), *( ["会员专享"] if member_only else [] )],
            "credits": image_quote(model_id, "1k", member=member)["unit_credits"],
            "member_only": member_only,
        }
    return {
        "models": available_models,
        "tool_models": tool_models,
        "upscaler_model": {
            "id": UPSCALER_MODEL_ID,
            "label": "4x-UltraSharp 服务器轻量超分",
            "available": bool(capabilities["upscaler"]),
            "badges": ["本地", "轻量", "忠实放大"],
            "credits": image_quote(UPSCALER_MODEL_ID, "2k", member=member)["unit_credits"],
        },
        "background_removal_model": {
            "id": BACKGROUND_REMOVAL_MODEL_ID,
            "label": "U2NetP 本地轻量抠图",
            "available": bool(capabilities["background_removal"]),
            "badges": ["本地", "透明 PNG"],
            "credits": image_quote(BACKGROUND_REMOVAL_MODEL_ID, "1k", member=member)["unit_credits"],
        },
        "video_models": {
            "minimax_h3_max": {"label": "MiniMax H3 Max", "available": bool(FAL_KEY and FAL_QUEUE_BASE_URL), "badges": ["fal.ai", "内置音频", "5–15 秒", "480P/768P"]},
            "wan2.7-t2v-2026-06-12": {"label": "Wan 2.7 文生视频", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["文生视频", "2–15 秒"]},
            "wan2.7-i2v-2026-04-25": {"label": "Wan 2.7 图生视频", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["首帧/首尾帧", "2–15 秒"]},
            "wan2.7-r2v-2026-06-12": {"label": "Wan 2.7 参考生视频", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["最多 5 张参考", "2–15 秒"]},
            "wan3.0-video": {"label": "Wan 3.0 视频", "available": bool(DASHSCOPE_API_KEY and BAILIAN_WAN3_BASE_URL), "badges": ["全能参考", "2–30 秒", "30 FPS"]},
            "wan3.0-video-prime": {"label": "Wan 3.0 视频 Prime", "available": bool(member and DASHSCOPE_API_KEY and BAILIAN_WAN3_BASE_URL), "badges": ["全能参考", "优速", "2–30 秒", "会员专享"], "member_only": True},
            "seedance_2_0": {"label": "Seedance 2.0", "available": bool(ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL and SEEDANCE_MODEL_ENDPOINTS["seedance_2_0"]), "badges": ["最多 9 张参考", "4–15 秒"]},
            "seedance_2_0_mini": {"label": "Seedance 2.0 Mini", "available": bool(ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL and SEEDANCE_MODEL_ENDPOINTS["seedance_2_0_mini"]), "badges": ["最多 9 张参考", "4–15 秒"]},
            "seedance_2_0_fast": {"label": "Seedance 2.0 Fast", "available": bool(ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL and SEEDANCE_MODEL_ENDPOINTS["seedance_2_0_fast"]), "badges": ["最多 9 张参考", "4–15 秒"]},
            "seedance_2_5": {"label": "Seedance 2.5", "available": bool(ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL and SEEDANCE_2_5_MODEL), "badges": ["最多 30 张参考", "0–30 秒"]},
            "wan2.7-videoedit": {"label": "Wan 2.7 视频编辑", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["指令编辑", "2–10 秒"]},
            "wanx2.1-vace-plus": {"label": "VACE 视频延展", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["延展", "固定 5 秒"]},
            "video-style-transform": {"label": "视频风格化", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["8 种风格", "540P/720P"]},
            "videoretalk": {"label": "VideoRetalk 口型同步", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["视频+音频", "口型同步"]},
            "wan2.2-animate-mix": {"label": "Wan 视频角色替换", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["图片+视频", "需肖像授权"]},
            "wan2.2-s2v": {"label": "Wan 数字人播报", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["图片+音频", "数字人"]},
        },
        "audio_models": {
            "doubao-tts-2.0": {"label": "豆包语音合成 2.0", "available": doubao_speech_is_configured(), "badges": ["火山引擎", "自然情感", "多语种"]},
            "qwen3-tts-flash": {"label": "Qwen3-TTS Flash", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["多语言", "自然音色"]},
            "qwen3-tts-instruct-flash": {"label": "Qwen3-TTS 指令版", "available": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL), "badges": ["情绪指令", "多语言"]},
            "qwen-audio-3.0-tts-flash": {"label": "Qwen-Audio 3.0 TTS Flash", "available": bool(DASHSCOPE_API_KEY and BAILIAN_TTS_BASE_URL), "badges": ["低延迟", "系统音色"]},
            "qwen-audio-3.0-tts-plus": {"label": "Qwen-Audio 3.0 TTS Plus", "available": bool(DASHSCOPE_API_KEY and BAILIAN_TTS_BASE_URL), "badges": ["高表现力", "系统音色"]},
        },
        "catalog": MODEL_CATALOG,
        "tools": {
            "edit": image_tools_available,
            "redraw": image_tools_available,
            "multiview": image_tools_available,
            "panorama": image_tools_available,
            "multiangle": image_tools_available,
            "upscale": bool(capabilities["upscaler"]),
            "cutout": bool(capabilities["background_removal"]),
            "interactive": bool(SEEDREAM_API_KEY and SEEDREAM_BASE_URL),
            "layers": bool(SEEDREAM_API_KEY and SEEDREAM_BASE_URL),
            "video_depth": bool(VIDEO_DEPTH_PYTHON.is_file() and (VIDEO_DEPTH_REPO / "run.py").is_file()),
            "editor_model": "Qwen-Image-Edit FP8" if capabilities["image_tools"] else "Seedream 云端图片编辑",
            "local_editor_ready": bool(capabilities["image_tools"]),
        },
        "scheduler": {"active_mode": capabilities["active_mode"], "queue_limit": MAX_QUEUE_SIZE},
    }

@router.get("/api/v1/capabilities")
async def capabilities(request: Request) -> dict[str, Any]:
    gpu = relay.gpu.capability_status()
    member = membership_active(relay.membership_for(owner_id(request)))
    image_tools_available = bool(
        gpu.get("image_tools")
        or (FAL_KEY and FAL_QUEUE_BASE_URL)
        or (DASHSCOPE_API_KEY and BAILIAN_BASE_URL)
        or (SEEDREAM_API_KEY and SEEDREAM_BASE_URL)
    )

    def resolve(item: dict[str, Any]) -> dict[str, Any]:
        source = item.get("availability", "route_pending")
        provider_configured = False
        ready = False
        if source in {"browser", "workflow"}:
            ready = True
        elif source == "zimage":
            ready = bool(gpu.get("zimage"))
        elif source == "image_generation":
            ready = bool(
                gpu.get("zimage")
                or (DASHSCOPE_API_KEY and BAILIAN_BASE_URL)
                or (SEEDREAM_API_KEY and SEEDREAM_BASE_URL)
                or GOOGLE_API_KEY
            )
            provider_configured = bool(ready and not gpu.get("zimage"))
        elif source == "image_tools":
            ready = image_tools_available
            provider_configured = bool(not gpu.get("image_tools") and image_tools_available)
        elif source == "upscaler":
            ready = bool(gpu.get("upscaler"))
        elif source == "background_removal":
            ready = bool(gpu.get("background_removal"))
        elif source == "bailian":
            ready = bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL)
            provider_configured = ready
        elif source == "bailian_vl":
            ready = bool(DASHSCOPE_API_KEY and BAILIAN_COMPATIBLE_BASE_URL)
            provider_configured = ready
        elif source in {"bailian_video", "bailian_audio"}:
            ready = bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL)
            provider_configured = ready
        elif source == "doubao_speech":
            ready = doubao_speech_is_configured()
            provider_configured = ready
        elif source == "speech_tts":
            ready = bool(doubao_speech_is_configured() or (DASHSCOPE_API_KEY and BAILIAN_BASE_URL))
            provider_configured = ready
        elif source == "image_dubbing":
            ready = bool(
                DASHSCOPE_API_KEY and BAILIAN_COMPATIBLE_BASE_URL
                and (doubao_speech_is_configured() or BAILIAN_BASE_URL)
            )
            provider_configured = bool(DASHSCOPE_API_KEY or doubao_speech_is_configured())
        elif source == "seedance_video":
            ready = bool(ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL and any(SEEDANCE_MODEL_ENDPOINTS.values()))
            provider_configured = bool(ARK_VIDEO_API_KEY)
        elif source == "fal_video":
            ready = bool(FAL_KEY and FAL_QUEUE_BASE_URL)
            provider_configured = bool(FAL_KEY)
        elif source == "fal_image":
            ready = bool(FAL_KEY and FAL_QUEUE_BASE_URL)
            provider_configured = bool(FAL_KEY)
        elif source == "video_depth":
            ready = bool(VIDEO_DEPTH_PYTHON.is_file() and (VIDEO_DEPTH_REPO / "run.py").is_file())
            provider_configured = ready
        elif source == "ark_agent":
            ready = bool(ARK_AGENT_API_KEY and ARK_AGENT_BASE_URL and ARK_AGENT_MODEL)
            provider_configured = ready
        elif source == "volcano":
            ready = bool(SEEDREAM_API_KEY and SEEDREAM_BASE_URL)
            provider_configured = ready
        elif source == "google":
            ready = bool(GOOGLE_API_KEY)
            provider_configured = ready
        elif source in {"bailian_route_pending", "video_route_pending"}:
            provider_configured = bool(DASHSCOPE_API_KEY)
        elif source == "volcano_route_pending":
            provider_configured = bool(SEEDREAM_API_KEY)
        result = {key: value for key, value in item.items() if key != "prompt"}
        member_only = member_exclusive(str(item.get("model") or ""))
        if member_only and not member:
            ready = False
            result["requires"] = "会员专享模型"
        result["member_only"] = member_only
        result["ready"] = ready
        result["provider_configured"] = provider_configured
        result["state"] = "ready" if ready else ("route_needed" if provider_configured else "needs_api")
        return result

    groups = []
    for group in CAPABILITY_GROUPS:
        groups.append({**{key: value for key, value in group.items() if key != "items"}, "items": [resolve(item) for item in group["items"]]})
    return {
        "groups": groups,
        "providers": {
            "local_image": bool(gpu.get("zimage")),
            "local_edit": bool(gpu.get("image_tools")),
            "cloud_edit": bool(not gpu.get("image_tools") and image_tools_available),
            "local_upscale": bool(gpu.get("upscaler")),
            "local_cutout": bool(gpu.get("background_removal")),
            "volcano_engine": bool(SEEDREAM_API_KEY and SEEDREAM_BASE_URL),
            "aliyun_bailian": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL),
            "google_gemini": bool(GOOGLE_API_KEY),
            "visual_understanding": bool(DASHSCOPE_API_KEY and BAILIAN_COMPATIBLE_BASE_URL),
            "bailian_video": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL),
            "bailian_audio": bool(DASHSCOPE_API_KEY and BAILIAN_BASE_URL),
            "doubao_speech": doubao_speech_is_configured(),
            "seedance_video": bool(ARK_VIDEO_API_KEY and ARK_VIDEO_BASE_URL and any(SEEDANCE_MODEL_ENDPOINTS.values())),
            "fal_ai_video": bool(FAL_KEY and FAL_QUEUE_BASE_URL),
            "fal_ai_image": bool(FAL_KEY and FAL_QUEUE_BASE_URL),
            "video_depth": bool(VIDEO_DEPTH_PYTHON.is_file() and (VIDEO_DEPTH_REPO / "run.py").is_file()),
            "short_drama_agent": bool(ARK_AGENT_API_KEY and ARK_AGENT_BASE_URL and ARK_AGENT_MODEL),
        },
    }

@router.get("/api/v1/images/tool-presets")
async def image_tool_presets() -> dict[str, Any]:
    public_presets = {
        operation: [{"id": item["id"], "label": item["label"]} for item in presets]
        for operation, presets in TOOL_PROMPT_PRESETS.items()
    }
    local_editor = bool(relay.gpu.capability_status().get("image_tools"))
    return {"presets": public_presets, "model": "Qwen-Image-Edit-2511-FP8" if local_editor else "Seedream 云端图片编辑"}


@router.get("/api/v1/bootstrap")
async def workspace_bootstrap(request: Request) -> dict[str, Any]:
    """Return the data needed for first paint in one session-aware request."""
    # Import locally to keep router module composition acyclic at startup.
    from .users import credits, users_me

    pricing_payload, models_payload, capabilities_payload, presets_payload, credits_payload, user_payload = (
        await asyncio.gather(
            public_pricing(request),
            models(request),
            capabilities(request),
            image_tool_presets(),
            credits(request),
            users_me(request),
        )
    )
    return {
        "pricing": pricing_payload,
        "models": models_payload,
        "capabilities": capabilities_payload,
        "tool_presets": presets_payload,
        "credits": credits_payload,
        "user": user_payload,
        "release": RELEASE_ID,
    }
