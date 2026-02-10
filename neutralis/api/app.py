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

from neutralis.config import load_settings
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
    allow_methods=["GET"],
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
