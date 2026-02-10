"""Domain models -- dataclasses that flow through the pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4


class MarketStatus(str, Enum):
    INITIALIZED = "initialized"
    INACTIVE = "inactive"
    ACTIVE = "active"
    CLOSED = "closed"
    DETERMINED = "determined"
    DISPUTED = "disputed"
    AMENDED = "amended"
    FINALIZED = "finalized"


class MarketType(str, Enum):
    BINARY = "binary"
    SCALAR = "scalar"


class SignalType(str, Enum):
    COMPLEMENT_ARB = "complement_arb"
    CROSS_PLATFORM_DISCREPANCY = "cross_platform_discrepancy"


class DecisionVerdict(str, Enum):
    PASS = "pass"
    REJECT = "reject"


class PositionStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class TradeSide(str, Enum):
    BUY_YES = "buy_yes"
    BUY_NO = "buy_no"


@dataclass(frozen=True)
class OrderbookLevel:
    price_dollars: float
    quantity_dollars: float


@dataclass(frozen=True)
class NormalizedMarket:
    ticker: str
    event_ticker: str
    market_type: MarketType
    title: str
    subtitle: str
    status: MarketStatus

    yes_bid: float
    yes_ask: float
    no_bid: float
    no_ask: float

    volume: float
    volume_24h: float
    liquidity: float
    open_interest: float

    close_time: Optional[datetime] = None
    expected_expiration: Optional[datetime] = None
    notional_value: float = 1.0

    yes_bids: tuple[OrderbookLevel, ...] = ()
    no_bids: tuple[OrderbookLevel, ...] = ()

    venue: str = "kalshi"

    snapshot_ts: datetime = field(default_factory=datetime.now)


@dataclass(frozen=True)
class CrossPlatformMatch:
    kalshi_ticker: str
    kalshi_title: str
    kalshi_yes_ask: float
    kalshi_no_ask: float
    polymarket_id: str
    polymarket_question: str
    polymarket_yes_price: float
    polymarket_no_price: float
    match_confidence: float
    price_discrepancy_pct: float
    favored_venue: str


@dataclass(frozen=True)
class TradeLeg:
    ticker: str
    side: str
    price_dollars: float
    quantity_dollars: float
    venue: str = ""


@dataclass(frozen=True)
class Signal:
    id: str = field(default_factory=lambda: uuid4().hex[:12])
    signal_type: SignalType = SignalType.COMPLEMENT_ARB
    ticker: str = ""
    event_ticker: str = ""

    yes_ask: float = 0.0
    no_ask: float = 0.0
    combined_cost: float = 0.0
    gross_edge: float = 0.0
    net_edge: float = 0.0
    edge_pct: float = 0.0

    legs: tuple[TradeLeg, ...] = ()
    market_snapshot: Optional[NormalizedMarket] = None
    cross_platform: Optional[CrossPlatformMatch] = None
    created_at: datetime = field(default_factory=datetime.now)
    # Scoring fields (alpha vNext)
    confidence_score: int = 0
    time_to_resolution_days: float = 0.0
    roi_per_day: float = 0.0
    features_json: dict = field(default_factory=dict)


@dataclass(frozen=True)
class GuardResult:
    guard_name: str
    passed: bool
    reason: str = ""
    value: Optional[float] = None
    threshold: Optional[float] = None


@dataclass(frozen=True)
class Decision:
    signal_id: str
    verdict: DecisionVerdict
    guard_results: tuple[GuardResult, ...] = ()
    suggested_size_dollars: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    # Ranked selection fields (alpha vNext)
    selected: bool = False
    selection_score: float = 0.0
    allocation_reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class Trade:
    id: str = field(default_factory=lambda: uuid4().hex[:12])
    signal_id: str = ""
    decision_id: int = 0
    ticker: str = ""
    event_ticker: str = ""
    venue: str = "kalshi"
    side: TradeSide = TradeSide.BUY_YES
    price: float = 0.0
    size_dollars: float = 0.0
    quantity: float = 0.0
    is_paper: bool = True
    created_at: datetime = field(default_factory=datetime.now)


@dataclass(frozen=True)
class Position:
    id: str = field(default_factory=lambda: uuid4().hex[:12])
    ticker: str = ""
    event_ticker: str = ""
    venue: str = "kalshi"
    side: TradeSide = TradeSide.BUY_YES
    status: PositionStatus = PositionStatus.OPEN
    entry_price: float = 0.0
    size_dollars: float = 0.0
    quantity: float = 0.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    trade_count: int = 0
    opened_at: datetime = field(default_factory=datetime.now)
    closed_at: Optional[datetime] = None
    category: str = "other"
    exit_reason: Optional[str] = None
    exit_price: Optional[float] = None


@dataclass(frozen=True)
class PortfolioSnapshot:
    positions: tuple[Position, ...] = ()
    total_exposure_dollars: float = 0.0
    total_realized_pnl: float = 0.0
    total_unrealized_pnl: float = 0.0
    open_position_count: int = 0
    venue_exposure: tuple[tuple[str, float], ...] = ()
    event_exposure: tuple[tuple[str, float], ...] = ()
    snapshot_ts: datetime = field(default_factory=datetime.now)
