"""Shared test fixtures for execution tests."""

from __future__ import annotations

import pytest

from neutralis.execution.models import Order, SlippageConfig, TickContext
from neutralis.models import (
    Decision,
    DecisionVerdict,
    GuardResult,
    NormalizedMarket,
    MarketStatus,
    MarketType,
    OrderbookLevel,
    Signal,
    SignalType,
    TradeLeg,
)


@pytest.fixture
def slippage_config():
    return SlippageConfig(
        base_slippage_bps=10.0,
        thin_book_penalty_bps=50.0,
        liquidity_threshold=100.0,
        max_slippage_bps=200.0,
        impact_coefficient=0.5,
    )


@pytest.fixture
def deep_book_market():
    """Market with substantial orderbook depth."""
    return NormalizedMarket(
        ticker="TEST-DEEP",
        event_ticker="TEST-EVENT",
        market_type=MarketType.BINARY,
        title="Test market with deep book",
        subtitle="",
        status=MarketStatus.ACTIVE,
        yes_bid=0.55,
        yes_ask=0.57,
        no_bid=0.43,
        no_ask=0.45,
        volume=10000,
        volume_24h=5000,
        liquidity=500.0,
        open_interest=2000,
        yes_bids=(
            OrderbookLevel(price_dollars=0.55, quantity_dollars=100.0),
            OrderbookLevel(price_dollars=0.54, quantity_dollars=200.0),
            OrderbookLevel(price_dollars=0.53, quantity_dollars=300.0),
        ),
        no_bids=(
            OrderbookLevel(price_dollars=0.43, quantity_dollars=100.0),
            OrderbookLevel(price_dollars=0.42, quantity_dollars=200.0),
            OrderbookLevel(price_dollars=0.41, quantity_dollars=300.0),
        ),
        venue="kalshi",
    )


@pytest.fixture
def thin_book_market():
    """Market with very thin orderbook."""
    return NormalizedMarket(
        ticker="TEST-THIN",
        event_ticker="TEST-EVENT",
        market_type=MarketType.BINARY,
        title="Test market with thin book",
        subtitle="",
        status=MarketStatus.ACTIVE,
        yes_bid=0.60,
        yes_ask=0.62,
        no_bid=0.38,
        no_ask=0.40,
        volume=200,
        volume_24h=50,
        liquidity=30.0,
        open_interest=100,
        yes_bids=(
            OrderbookLevel(price_dollars=0.60, quantity_dollars=10.0),
        ),
        no_bids=(
            OrderbookLevel(price_dollars=0.38, quantity_dollars=10.0),
        ),
        venue="kalshi",
    )


@pytest.fixture
def no_book_market():
    """Market without orderbook data (e.g. Polymarket)."""
    return NormalizedMarket(
        ticker="TEST-NOBOOK",
        event_ticker="TEST-EVENT",
        market_type=MarketType.BINARY,
        title="Test market no orderbook",
        subtitle="",
        status=MarketStatus.ACTIVE,
        yes_bid=0.50,
        yes_ask=0.52,
        no_bid=0.48,
        no_ask=0.50,
        volume=5000,
        volume_24h=2000,
        liquidity=200.0,
        open_interest=1000,
        venue="polymarket",
    )


@pytest.fixture
def sample_signal(deep_book_market):
    return Signal(
        signal_type=SignalType.COMPLEMENT_ARB,
        ticker="TEST-DEEP",
        event_ticker="TEST-EVENT",
        yes_ask=0.57,
        no_ask=0.45,
        combined_cost=1.02,
        gross_edge=0.0,
        net_edge=0.0,
        edge_pct=2.0,
        legs=(
            TradeLeg(ticker="TEST-DEEP", side="yes", price_dollars=0.57, quantity_dollars=10.0, venue="kalshi"),
            TradeLeg(ticker="TEST-DEEP", side="no", price_dollars=0.45, quantity_dollars=10.0, venue="kalshi"),
        ),
        market_snapshot=deep_book_market,
        confidence_score=60,
    )


@pytest.fixture
def sample_decision():
    return Decision(
        signal_id="",
        verdict=DecisionVerdict.PASS,
        guard_results=(
            GuardResult(guard_name="min_edge", passed=True, value=2.0, threshold=1.0),
        ),
        suggested_size_dollars=20.0,
        selected=True,
        selection_score=0.5,
    )


@pytest.fixture
def tick_context():
    return TickContext(tick_id="tick_1_2026-02-10T14:30Z", run_number=1)
