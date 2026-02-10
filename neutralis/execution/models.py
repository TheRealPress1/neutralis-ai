"""Execution domain models -- Order, Fill, TickContext, SlippageConfig, ExecutionResult."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from uuid import uuid4


class OrderStatus(str, Enum):
    PENDING = "pending"
    FILLED = "filled"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


@dataclass(frozen=True)
class TickContext:
    tick_id: str
    run_number: int
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass(frozen=True)
class SlippageConfig:
    base_slippage_bps: float = 10.0
    thin_book_penalty_bps: float = 50.0
    liquidity_threshold: float = 100.0
    max_slippage_bps: float = 200.0
    impact_coefficient: float = 0.5


VENUE_SLIPPAGE: dict[str, SlippageConfig] = {
    "kalshi": SlippageConfig(
        base_slippage_bps=10,
        thin_book_penalty_bps=50,
        liquidity_threshold=100,
        max_slippage_bps=200,
        impact_coefficient=0.5,
    ),
    "polymarket": SlippageConfig(
        base_slippage_bps=5,
        thin_book_penalty_bps=30,
        liquidity_threshold=200,
        max_slippage_bps=150,
        impact_coefficient=0.3,
    ),
}


@dataclass(frozen=True)
class Order:
    id: str = field(default_factory=lambda: uuid4().hex[:12])
    tick_id: str = ""
    signal_id: str = ""
    decision_id: int = 0
    ticker: str = ""
    event_ticker: str = ""
    venue: str = "kalshi"
    side: str = "buy_yes"
    order_type: str = "market"
    requested_price: float = 0.0
    requested_size_dollars: float = 0.0
    requested_quantity: float = 0.0
    status: str = "pending"
    filled_size_dollars: float = 0.0
    filled_quantity: float = 0.0
    fill_count: int = 0
    avg_fill_price: float | None = None
    slippage_bps: float | None = None
    fees_dollars: float = 0.0
    is_paper: bool = True
    user_id: str = "00000000-0000-0000-0000-000000000000"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    expired_at: datetime | None = None


@dataclass(frozen=True)
class Fill:
    id: str = field(default_factory=lambda: uuid4().hex[:12])
    order_id: str = ""
    fill_number: int = 1
    price: float = 0.0
    quantity: float = 0.0
    size_dollars: float = 0.0
    fee_dollars: float = 0.0
    slippage_bps: float = 0.0
    liquidity_consumed: float = 0.0
    trade_id: str | None = None
    is_paper: bool = True
    user_id: str = "00000000-0000-0000-0000-000000000000"
    created_at: datetime = field(default_factory=datetime.now)


@dataclass(frozen=True)
class ExecutionResult:
    orders: tuple[Order, ...] = ()
    fills: tuple[Fill, ...] = ()
    trades: tuple = ()  # tuple[Trade, ...]
    total_slippage_bps: float = 0.0
    total_fees_dollars: float = 0.0
    fully_filled: bool = True
