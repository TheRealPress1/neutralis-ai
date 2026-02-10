"""FastAPI dashboard application."""

from __future__ import annotations

import csv
import dataclasses
import io
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from neutralis.audit import AuditLogger
from neutralis.config import load_settings
from neutralis.guard.kill_switch import KillSwitch
from neutralis.profiles import (
    activate_profile,
    load_active_profile,
    load_all_profiles,
    update_profile,
)
from neutralis.portfolio.manager import PortfolioManager
from neutralis.storage.postgres import PostgresStorage

_storage: PostgresStorage | None = None
_kill_switch: KillSwitch | None = None
_audit: AuditLogger | None = None


def _get_storage() -> PostgresStorage:
    assert _storage is not None, "Storage not initialized"
    return _storage


def _get_kill_switch() -> KillSwitch:
    assert _kill_switch is not None, "KillSwitch not initialized"
    return _kill_switch


def _get_audit() -> AuditLogger:
    assert _audit is not None, "AuditLogger not initialized"
    return _audit


def _serialize(obj: Any) -> Any:
    """Recursively convert dataclasses, datetimes, and enums to JSON-safe types."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {k: _serialize(v) for k, v in dataclasses.asdict(obj).items()}
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, (list, tuple)):
        return [_serialize(item) for item in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


@asynccontextmanager
async def lifespan(application: FastAPI):  # noqa: ARG001
    global _storage, _kill_switch, _audit  # noqa: PLW0603
    settings = load_settings()
    _storage = PostgresStorage(settings.db)
    _storage.connect()
    _kill_switch = KillSwitch(_storage)
    _audit = AuditLogger(_storage)
    yield
    _storage.close()
    _storage = None
    _kill_switch = None
    _audit = None


app = FastAPI(
    title="Neutralis.ai Dashboard",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "PUT", "POST"],
    allow_headers=["*"],
)


# --- Health ---

@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Portfolio ---

@app.get("/api/portfolio")
def portfolio_snapshot():
    storage = _get_storage()
    settings = load_settings()
    portfolio = PortfolioManager(storage, settings.portfolio)
    snapshot = portfolio.get_snapshot()
    return _serialize(snapshot)


@app.get("/api/portfolio/stats")
def portfolio_stats():
    storage = _get_storage()
    return storage.get_portfolio_stats()


@app.get("/api/portfolio/performance")
def portfolio_performance():
    """Return portfolio performance metrics including drawdown."""
    storage = _get_storage()
    ks = _get_kill_switch()
    stats = storage.get_portfolio_stats()
    state = ks.get_state()
    return {
        **stats,
        "peak_portfolio_value": state.get("peak_portfolio_value", 0),
        "max_drawdown_dollars": state.get("max_drawdown_dollars", 0),
        "daily_loss_dollars": state.get("daily_loss_dollars", 0),
    }


# --- Positions ---

@app.get("/api/positions")
def list_positions(
    status: str = Query("open", pattern="^(open|closed)$"),
    limit: int = Query(50, ge=1, le=500),
):
    storage = _get_storage()
    if status == "open":
        positions = storage.get_open_positions()
        return _serialize(positions)
    return storage.get_closed_positions(limit=limit)


@app.get("/api/positions/{position_id}")
def get_position(position_id: str):
    storage = _get_storage()
    position = storage.get_position(position_id)
    if position is None:
        raise HTTPException(status_code=404, detail="Position not found")
    return _serialize(position)


# --- Signals ---

@app.get("/api/signals")
def list_signals(limit: int = Query(50, ge=1, le=500)):
    storage = _get_storage()
    return JSONResponse(content=_serialize(storage.get_recent_signals(limit=limit)))


# --- Decisions ---

@app.get("/api/decisions")
def list_decisions(
    verdict: str | None = Query(None, pattern="^(pass|reject)$"),
    limit: int = Query(50, ge=1, le=500),
):
    storage = _get_storage()
    return JSONResponse(
        content=_serialize(storage.get_recent_decisions(limit=limit, verdict=verdict)),
    )


# --- Trades ---

@app.get("/api/trades")
def list_trades(limit: int = Query(50, ge=1, le=500)):
    storage = _get_storage()
    return JSONResponse(content=_serialize(storage.get_recent_trades(limit=limit)))


# --- Cross-Platform ---

@app.get("/api/matches")
def list_matches(limit: int = Query(50, ge=1, le=500)):
    storage = _get_storage()
    return JSONResponse(content=_serialize(storage.get_recent_matches(limit=limit)))


@app.get("/api/cross-platform/signals")
def list_cross_platform_signals(limit: int = Query(50, ge=1, le=500)):
    storage = _get_storage()
    return JSONResponse(
        content=_serialize(storage.get_recent_cross_platform_signals(limit=limit)),
    )


# --- Risk Profiles ---

class ProfileUpdate(BaseModel):
    name: str | None = None
    preset: str | None = None
    target_annual_return_pct: float | None = None
    description: str | None = None
    min_edge_pct: float | None = None
    min_liquidity_dollars: float | None = None
    max_time_to_expiry_hours: float | None = None
    min_time_to_expiry_hours: float | None = None
    fee_rate: float | None = None
    max_position_dollars: float | None = None
    max_total_exposure_dollars: float | None = None
    max_event_exposure_dollars: float | None = None
    max_ticker_exposure_dollars: float | None = None
    max_venue_exposure_pct: float | None = None
    max_open_positions: int | None = None
    min_similarity: float | None = None
    daily_loss_limit_dollars: float | None = None


@app.get("/api/profiles")
def list_profiles():
    storage = _get_storage()
    profiles = load_all_profiles(storage)
    return [p.to_dict() for p in profiles]


@app.get("/api/profiles/active")
def get_active_profile():
    storage = _get_storage()
    profile = load_active_profile(storage)
    if profile is None:
        raise HTTPException(status_code=404, detail="No active profile found")
    return profile.to_dict()


@app.put("/api/profiles/{profile_id}")
def update_profile_endpoint(profile_id: int, body: ProfileUpdate):
    storage = _get_storage()
    audit = _get_audit()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = update_profile(storage, profile_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    audit.profile_changed(profile_id, updates)
    return updated.to_dict()


@app.put("/api/profiles/{profile_id}/activate")
def activate_profile_endpoint(profile_id: int):
    storage = _get_storage()
    audit = _get_audit()
    activate_profile(storage, profile_id)
    profile = load_active_profile(storage)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found after activation")
    audit.profile_activated(profile_id, profile.name)
    return profile.to_dict()


# --- Automation / Kill Switch ---

@app.get("/api/automation/state")
def get_automation_state():
    ks = _get_kill_switch()
    return ks.get_state()


@app.post("/api/automation/start")
def start_automation():
    ks = _get_kill_switch()
    audit = _get_audit()
    state = ks.start()
    audit.automation_started()
    return state


@app.post("/api/automation/pause")
def pause_automation():
    ks = _get_kill_switch()
    audit = _get_audit()
    state = ks.pause()
    audit.automation_paused()
    return state


class KillRequest(BaseModel):
    reason: str = "Manual kill switch"


@app.post("/api/automation/kill")
def trigger_kill_switch(body: KillRequest):
    ks = _get_kill_switch()
    audit = _get_audit()
    state = ks.kill(reason=body.reason)
    audit.kill_switch_triggered(body.reason)
    return state


# --- Audit Logs / Activity ---

@app.get("/api/activity")
def list_activity(
    event_type: str | None = Query(None),
    entity_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    """Return recent audit log entries with optional filtering."""
    storage = _get_storage()
    return storage.get_audit_logs(
        event_type=event_type,
        entity_type=entity_type,
        limit=limit,
    )


# --- Exports ---

@app.get("/api/exports/trades.csv")
def export_trades_csv(limit: int = Query(500, ge=1, le=10000)):
    """Export trade blotter as CSV."""
    storage = _get_storage()
    trades = storage.get_recent_trades(limit=limit)

    output = io.StringIO()
    if trades:
        writer = csv.DictWriter(output, fieldnames=trades[0].keys())
        writer.writeheader()
        writer.writerows(trades)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=neutralis_trades.csv"},
    )
