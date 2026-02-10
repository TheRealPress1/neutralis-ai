"""Tests for the paper execution system: slippage, fill simulation, position accounting, idempotency."""

from __future__ import annotations

from unittest.mock import MagicMock, patch, call
from datetime import datetime

import pytest

from neutralis.execution.models import (
    Fill,
    Order,
    OrderStatus,
    SlippageConfig,
    TickContext,
    ExecutionResult,
    VENUE_SLIPPAGE,
)
from neutralis.execution.slippage import compute_slippage, _walk_orderbook
from neutralis.execution.fill_simulator import simulate_fill, _compute_fee
from neutralis.execution.executor import PaperExecutor
from neutralis.models import (
    Decision,
    DecisionVerdict,
    GuardResult,
    NormalizedMarket,
    MarketStatus,
    MarketType,
    OrderbookLevel,
    Position,
    PositionStatus,
    Signal,
    SignalType,
    Trade,
    TradeLeg,
    TradeSide,
)


# =========================================================================
# Slippage tests
# =========================================================================

class TestSlippage:
    def test_base_slippage_no_orderbook(self, no_book_market, slippage_config):
        """Without orderbook, slippage uses sqrt-impact heuristic."""
        fill_price, bps = compute_slippage(
            requested_price=0.52,
            size_dollars=10.0,
            market=no_book_market,
            side="buy_yes",
            config=slippage_config,
        )
        assert bps >= slippage_config.base_slippage_bps
        assert fill_price > 0.52
        assert fill_price <= 0.99

    def test_thin_book_penalty(self, slippage_config):
        """Thin liquidity adds penalty bps."""
        market = NormalizedMarket(
            ticker="T", event_ticker="E", market_type=MarketType.BINARY,
            title="", subtitle="", status=MarketStatus.ACTIVE,
            yes_bid=0.50, yes_ask=0.52, no_bid=0.48, no_ask=0.50,
            volume=100, volume_24h=50, liquidity=30.0, open_interest=50,
            venue="kalshi",
        )
        _, bps = compute_slippage(0.52, 10.0, market, "buy_yes", slippage_config)
        # liquidity=30 < threshold=100, so penalty should apply
        assert bps >= slippage_config.base_slippage_bps + slippage_config.thin_book_penalty_bps

    def test_max_slippage_cap(self, no_book_market, slippage_config):
        """Slippage never exceeds max_slippage_bps."""
        _, bps = compute_slippage(
            requested_price=0.52,
            size_dollars=100000.0,  # huge order
            market=no_book_market,
            side="buy_yes",
            config=slippage_config,
        )
        assert bps <= slippage_config.max_slippage_bps

    def test_orderbook_walk_vwap(self, deep_book_market, slippage_config):
        """With orderbook, slippage derives from VWAP of consumed depth."""
        fill_price, bps = compute_slippage(
            requested_price=0.55,
            size_dollars=50.0,
            market=deep_book_market,
            side="buy_yes",
            config=slippage_config,
        )
        assert fill_price > 0.55
        assert bps >= slippage_config.base_slippage_bps

    def test_fill_price_capped_at_099(self, slippage_config):
        """Fill price should never exceed 0.99 for binary contracts."""
        market = NormalizedMarket(
            ticker="T", event_ticker="E", market_type=MarketType.BINARY,
            title="", subtitle="", status=MarketStatus.ACTIVE,
            yes_bid=0.97, yes_ask=0.98, no_bid=0.02, no_ask=0.03,
            volume=100, volume_24h=50, liquidity=10.0, open_interest=50,
            venue="kalshi",
        )
        fill_price, _ = compute_slippage(0.98, 50.0, market, "buy_yes", slippage_config)
        assert fill_price <= 0.99

    def test_kalshi_vs_polymarket_rates(self):
        """Kalshi and Polymarket have different default slippage configs."""
        k = VENUE_SLIPPAGE["kalshi"]
        p = VENUE_SLIPPAGE["polymarket"]
        assert k.base_slippage_bps > p.base_slippage_bps
        assert k.max_slippage_bps > p.max_slippage_bps

    def test_walk_orderbook_basic(self):
        """_walk_orderbook returns correct VWAP and consumed amount."""
        levels = (
            OrderbookLevel(price_dollars=0.55, quantity_dollars=100.0),
            OrderbookLevel(price_dollars=0.54, quantity_dollars=200.0),
        )
        vwap, consumed = _walk_orderbook(levels, 150.0)
        # Should consume 100 @ 0.55 + 50 @ 0.54
        assert consumed == pytest.approx(150.0)
        assert vwap > 0.54
        assert vwap < 0.55

    def test_no_market_slippage(self, slippage_config):
        """When market is None, still returns valid slippage."""
        fill_price, bps = compute_slippage(0.50, 10.0, None, "buy_yes", slippage_config)
        assert fill_price > 0.50
        assert bps > 0


# =========================================================================
# Fill simulation tests
# =========================================================================

class TestFillSimulation:
    def test_full_fill_deep_book(self, deep_book_market, slippage_config):
        """Deep orderbook should produce a full fill."""
        order = Order(
            ticker="TEST-DEEP",
            venue="kalshi",
            side="buy_yes",
            requested_price=0.55,
            requested_size_dollars=50.0,
            requested_quantity=90.9,
        )
        fills = simulate_fill(order, deep_book_market, slippage_config)
        assert len(fills) == 1
        assert fills[0].size_dollars == pytest.approx(50.0, abs=0.01)

    def test_partial_fill_thin_book(self, thin_book_market, slippage_config):
        """Thin orderbook should produce a partial fill capped at available depth."""
        order = Order(
            ticker="TEST-THIN",
            venue="kalshi",
            side="buy_yes",
            requested_price=0.60,
            requested_size_dollars=50.0,
            requested_quantity=83.3,
        )
        fills = simulate_fill(order, thin_book_market, slippage_config)
        assert len(fills) == 1
        # Only 10.0 depth available
        assert fills[0].size_dollars == pytest.approx(10.0, abs=0.01)

    def test_heuristic_no_orderbook(self, no_book_market, slippage_config):
        """Without orderbook but with liquidity, should fully fill."""
        order = Order(
            ticker="TEST-NOBOOK",
            venue="polymarket",
            side="buy_yes",
            requested_price=0.52,
            requested_size_dollars=20.0,
            requested_quantity=38.5,
        )
        fills = simulate_fill(order, no_book_market, slippage_config)
        assert len(fills) == 1
        assert fills[0].size_dollars == pytest.approx(20.0, abs=0.01)

    def test_very_thin_liquidity_80pct(self, slippage_config):
        """When liquidity < 50% of order size, fill 80%."""
        market = NormalizedMarket(
            ticker="T", event_ticker="E", market_type=MarketType.BINARY,
            title="", subtitle="", status=MarketStatus.ACTIVE,
            yes_bid=0.50, yes_ask=0.52, no_bid=0.48, no_ask=0.50,
            volume=100, volume_24h=50, liquidity=5.0, open_interest=10,
            venue="polymarket",
        )
        order = Order(
            ticker="T", venue="polymarket", side="buy_yes",
            requested_price=0.52, requested_size_dollars=20.0,
            requested_quantity=38.5,
        )
        fills = simulate_fill(order, market, slippage_config)
        assert len(fills) == 1
        assert fills[0].size_dollars == pytest.approx(16.0, abs=0.01)

    def test_fees_kalshi(self):
        """Kalshi fee computation is correct."""
        fee = _compute_fee(0.50, 10.0, "kalshi")
        # kalshi_fee_per_contract(0.50) = 0.07 * 0.5 * 0.5 = 0.0175
        assert fee == pytest.approx(0.175, abs=0.001)

    def test_fees_polymarket(self):
        """Polymarket fee is zero."""
        fee = _compute_fee(0.50, 10.0, "polymarket")
        assert fee == 0.0


# =========================================================================
# Position accounting tests (via executor with mocked storage)
# =========================================================================

class TestPositionAccounting:
    def _make_storage_mock(self):
        """Build a storage mock that tracks calls."""
        storage = MagicMock()
        storage.save_order.return_value = "order123"
        storage.save_fill.return_value = "fill123"
        storage.save_trade.return_value = "trade123"
        storage.get_open_position.return_value = None
        return storage

    def _make_portfolio(self, storage):
        from neutralis.portfolio.manager import PortfolioManager
        return PortfolioManager(storage)

    def test_fill_creates_trade_and_position(
        self, sample_signal, sample_decision, tick_context, deep_book_market,
    ):
        storage = self._make_storage_mock()
        portfolio = self._make_portfolio(storage)
        executor = PaperExecutor(storage, portfolio)

        result = executor.execute(
            signal=sample_signal,
            decision=sample_decision,
            decision_id=42,
            tick_ctx=tick_context,
            market=deep_book_market,
        )

        assert len(result.orders) == 2  # yes + no legs
        assert len(result.fills) == 2
        assert len(result.trades) == 2
        assert storage.save_trade.call_count == 2
        assert storage.save_position.call_count == 2

    def test_vwap_on_second_fill(
        self, sample_signal, sample_decision, tick_context, deep_book_market,
    ):
        storage = self._make_storage_mock()
        # Simulate existing position
        existing_pos = Position(
            id="pos1",
            ticker="TEST-DEEP",
            venue="kalshi",
            side=TradeSide.BUY_YES,
            status=PositionStatus.OPEN,
            entry_price=0.55,
            size_dollars=10.0,
            quantity=18.18,
            trade_count=1,
        )
        storage.get_open_position.return_value = existing_pos

        portfolio = self._make_portfolio(storage)
        executor = PaperExecutor(storage, portfolio)

        result = executor.execute(
            signal=sample_signal,
            decision=sample_decision,
            decision_id=42,
            tick_ctx=tick_context,
            market=deep_book_market,
        )

        # update_position should be called for existing positions
        assert storage.update_position.call_count >= 1

    def test_partial_fill_reflects_partial_quantity(
        self, sample_decision, tick_context, thin_book_market,
    ):
        """When orderbook is thin, partial fill should create correct trade quantity."""
        signal = Signal(
            signal_type=SignalType.COMPLEMENT_ARB,
            ticker="TEST-THIN",
            event_ticker="TEST-EVENT",
            yes_ask=0.62,
            no_ask=0.40,
            combined_cost=1.02,
            legs=(
                TradeLeg(ticker="TEST-THIN", side="yes", price_dollars=0.62, quantity_dollars=25.0, venue="kalshi"),
            ),
            market_snapshot=thin_book_market,
        )
        storage = self._make_storage_mock()
        portfolio = self._make_portfolio(storage)
        executor = PaperExecutor(storage, portfolio)

        result = executor.execute(
            signal=signal,
            decision=sample_decision,
            decision_id=42,
            tick_ctx=tick_context,
            market=thin_book_market,
        )

        assert len(result.fills) == 1
        # Thin book only has 10.0 depth, so fill should be partial
        assert result.fills[0].size_dollars < 20.0
        assert not result.fully_filled

    def test_multi_leg_creates_multiple_orders(
        self, sample_signal, sample_decision, tick_context, deep_book_market,
    ):
        """Multi-leg signal should create one order per leg."""
        storage = self._make_storage_mock()
        portfolio = self._make_portfolio(storage)
        executor = PaperExecutor(storage, portfolio)

        result = executor.execute(
            signal=sample_signal,
            decision=sample_decision,
            decision_id=42,
            tick_ctx=tick_context,
            market=deep_book_market,
        )

        assert len(result.orders) == len(sample_signal.legs)


# =========================================================================
# Idempotency tests
# =========================================================================

class TestIdempotency:
    def test_duplicate_tick_decision_ticker_side_skipped(
        self, sample_signal, sample_decision, tick_context, deep_book_market,
    ):
        """Duplicate tick+decision+ticker+side should be skipped."""
        storage = MagicMock()
        storage.save_order.return_value = ""  # conflict -> empty string
        storage.get_open_position.return_value = None

        from neutralis.portfolio.manager import PortfolioManager
        portfolio = PortfolioManager(storage)
        executor = PaperExecutor(storage, portfolio)

        result = executor.execute(
            signal=sample_signal,
            decision=sample_decision,
            decision_id=42,
            tick_ctx=tick_context,
            market=deep_book_market,
        )

        assert len(result.orders) == 0
        assert len(result.fills) == 0
        assert storage.save_fill.call_count == 0

    def test_different_tick_creates_new_order(
        self, sample_signal, sample_decision, deep_book_market,
    ):
        """Different tick_id should create new orders."""
        storage = MagicMock()
        storage.save_order.return_value = "order456"
        storage.save_fill.return_value = "fill456"
        storage.save_trade.return_value = "trade456"
        storage.get_open_position.return_value = None

        from neutralis.portfolio.manager import PortfolioManager
        portfolio = PortfolioManager(storage)
        executor = PaperExecutor(storage, portfolio)

        ctx1 = TickContext(tick_id="tick_1_2026-02-10T14:30Z", run_number=1)
        ctx2 = TickContext(tick_id="tick_2_2026-02-10T14:31Z", run_number=2)

        r1 = executor.execute(sample_signal, sample_decision, 42, ctx1, deep_book_market)
        r2 = executor.execute(sample_signal, sample_decision, 42, ctx2, deep_book_market)

        # Both should produce orders
        assert len(r1.orders) == 2
        assert len(r2.orders) == 2


# =========================================================================
# Edge case tests
# =========================================================================

class TestEdgeCases:
    def test_zero_size_decision(self, sample_signal, tick_context, deep_book_market):
        """Decision with zero size should produce no orders."""
        decision = Decision(
            signal_id=sample_signal.id,
            verdict=DecisionVerdict.PASS,
            suggested_size_dollars=0.0,
            selected=True,
        )
        storage = MagicMock()
        storage.get_open_position.return_value = None
        from neutralis.portfolio.manager import PortfolioManager
        portfolio = PortfolioManager(storage)
        executor = PaperExecutor(storage, portfolio)

        result = executor.execute(
            sample_signal, decision, 42, tick_context, deep_book_market,
        )
        assert len(result.orders) == 0

    def test_no_market_snapshot(self, sample_decision, tick_context):
        """Signal without market snapshot should still execute with heuristic."""
        signal = Signal(
            signal_type=SignalType.COMPLEMENT_ARB,
            ticker="TEST-X",
            event_ticker="TEST-EVENT",
            yes_ask=0.55,
            no_ask=0.45,
            combined_cost=1.00,
            legs=(
                TradeLeg(ticker="TEST-X", side="yes", price_dollars=0.55, quantity_dollars=10.0),
            ),
            market_snapshot=None,
        )
        storage = MagicMock()
        storage.save_order.return_value = "order789"
        storage.save_fill.return_value = "fill789"
        storage.save_trade.return_value = "trade789"
        storage.get_open_position.return_value = None

        from neutralis.portfolio.manager import PortfolioManager
        portfolio = PortfolioManager(storage)
        executor = PaperExecutor(storage, portfolio)

        result = executor.execute(
            signal, sample_decision, 42, tick_context,
        )
        assert len(result.fills) >= 1

    def test_empty_legs_signal(self, sample_decision, tick_context, deep_book_market):
        """Signal with no legs should produce empty result."""
        signal = Signal(
            signal_type=SignalType.COMPLEMENT_ARB,
            ticker="TEST",
            event_ticker="TEST-EVENT",
            legs=(),
        )
        storage = MagicMock()
        from neutralis.portfolio.manager import PortfolioManager
        portfolio = PortfolioManager(storage)
        executor = PaperExecutor(storage, portfolio)

        result = executor.execute(
            signal, sample_decision, 42, tick_context, deep_book_market,
        )
        assert len(result.orders) == 0
        assert len(result.fills) == 0
