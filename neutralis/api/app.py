"""FastAPI dashboard application."""

from __future__ import annotations

import dataclasses
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from neutralis.config import load_settings
from neutralis.profiles import (
    activate_profile,
    load_active_profile,
    load_all_profiles,
    update_profile,
)
from neutralis.portfolio.manager import PortfolioManager
from neutralis.storage.postgres import PostgresStorage

_storage: PostgresStorage | None = None


def _get_storage() -> PostgresStorage:
    assert _storage is not None, "Storage not initialized"
    return _storage


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
    global _storage  # noqa: PLW0603
    settings = load_settings()
    _storage = PostgresStorage(settings.db)
    _storage.connect()
    yield
    _storage.close()
    _storage = None


app = FastAPI(
    title="Neutralis.ai Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "PUT"],
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
    category_overrides: dict | None = None
    strategy: str | None = None


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
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = update_profile(storage, profile_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return updated.to_dict()


@app.put("/api/profiles/{profile_id}/activate")
def activate_profile_endpoint(profile_id: int):
    storage = _get_storage()
    activate_profile(storage, profile_id)
    profile = load_active_profile(storage)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found after activation")
    return profile.to_dict()


# --- Analytics ---

@app.get("/api/analytics/summary")
def analytics_summary():
    storage = _get_storage()
    return storage.get_analytics_summary()


@app.get("/api/analytics/pnl-timeline")
def pnl_timeline(days: int = Query(90, ge=7, le=365)):
    storage = _get_storage()
    return _serialize(storage.get_daily_pnl(days=days))


@app.get("/api/analytics/breakdown")
def analytics_breakdown():
    storage = _get_storage()
    by_category: list = []
    by_venue: list = []
    pnl_dist: list = []
    try:
        by_category = storage.get_category_breakdown()
    except Exception:
        storage._safe_rollback()
    try:
        by_venue = storage.get_venue_breakdown()
    except Exception:
        storage._safe_rollback()
    try:
        pnl_dist = storage.get_pnl_distribution()
    except Exception:
        storage._safe_rollback()
    return {
        "by_category": _serialize(by_category),
        "by_venue": _serialize(by_venue),
        "pnl_distribution": _serialize(pnl_dist),
    }


@app.get("/api/analytics/guard-stats")
def guard_stats():
    storage = _get_storage()
    return _serialize(storage.get_guard_effectiveness())


# --- Categories ---

@app.get("/api/categories")
def list_categories():
    from neutralis.categories import ALL_CATEGORIES
    return [
        {
            "slug": c.slug,
            "label": c.label,
            "color": c.color,
            "description": c.description,
        }
        for c in ALL_CATEGORIES
    ]


# --- Backtest ---

class BacktestRequest(BaseModel):
    start_date: str
    end_date: str
    pipeline_overrides: dict[str, Any] | None = None
    portfolio_overrides: dict[str, Any] | None = None
    matching_overrides: dict[str, Any] | None = None


@app.post("/api/backtest/run")
def run_backtest_endpoint(req: BacktestRequest):
    from neutralis.backtest.engine import run_backtest

    try:
        result = run_backtest(
            start_date=req.start_date,
            end_date=req.end_date,
            pipeline_overrides=req.pipeline_overrides,
            portfolio_overrides=req.portfolio_overrides,
            matching_overrides=req.matching_overrides,
        )
        return result.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/backtest/data-range")
def backtest_data_range():
    """Return the date range of available historical data."""
    storage = _get_storage()
    rows = storage._fetch_dicts("""
        SELECT
            MIN(snapshot_ts)::date AS earliest,
            MAX(snapshot_ts)::date AS latest,
            COUNT(DISTINCT date_trunc('minute', snapshot_ts)) AS total_runs,
            COUNT(*) AS total_snapshots
        FROM market_snapshots
    """)
    if not rows:
        return {"earliest": None, "latest": None, "total_runs": 0, "total_snapshots": 0}
    row = rows[0]
    return {
        "earliest": str(row["earliest"]) if row["earliest"] else None,
        "latest": str(row["latest"]) if row["latest"] else None,
        "total_runs": row["total_runs"],
        "total_snapshots": row["total_snapshots"],
    }
