"""Tests for the high-probability directional sports strategy."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from neutralis.categories import classify_sport
from neutralis.config import DirectionalConfig
from neutralis.core.directional_scanner import scan_high_probability
from neutralis.guard.constraints import check_min_implied_probability
from neutralis.guard.decision import evaluate_directional_signal
from neutralis.models import (
    MarketStatus,
    MarketType,
    NormalizedMarket,
    PortfolioSnapshot,
    Position,
    PositionStatus,
    Signal,
    SignalType,
    TradeSide,
)


# ---------------------------------------------------------------------------
# classify_sport
# ---------------------------------------------------------------------------


class TestClassifySport:
    def test_kalshi_tennis_atp(self):
        assert classify_sport("Djokovic vs Nadal", "KXATPMATCH-ABC") == "tennis"

    def test_kalshi_tennis_wta(self):
        assert classify_sport("Swiatek vs Gauff", "KXWTAMATCH-XYZ") == "tennis"

    def test_kalshi_soccer_epl(self):
        assert classify_sport("Arsenal vs Chelsea", "KXEPLGAME-123") == "soccer"

    def test_kalshi_soccer_bundesliga(self):
        assert classify_sport("Bayern vs Dortmund", "KXBUNDESLIGAGAME-99") == "soccer"

    def test_kalshi_soccer_uefa(self):
        assert classify_sport("Real vs PSG", "KXUEFAGAME-01") == "soccer"

    def test_kalshi_basketball_nba(self):
        assert classify_sport("Lakers vs Celtics", "KXNBA-LALAL") == "basketball"

    def test_keyword_fallback_tennis(self):
        assert classify_sport("ATP Final match tomorrow", "UNKNOWN") == "tennis"

    def test_keyword_fallback_soccer(self):
        assert classify_sport("Premier League: Man City vs Liverpool", "") == "soccer"

    def test_keyword_fallback_champions_league(self):
        assert classify_sport("Champions League semi-final", "") == "soccer"

    def test_keyword_fallback_nba(self):
        assert classify_sport("NBA Playoffs game 7", "") == "basketball"

    def test_not_a_sport(self):
        assert classify_sport("Will Bitcoin hit 100k?", "KXBTC2026200") is None

    def test_politics_not_sport(self):
        assert classify_sport("Presidential election 2028", "KXPRESPARTY") is None

    def test_nfl_not_included(self):
        # NFL is sports but not in the directional strategy's 3 sports
        assert classify_sport("Super Bowl winner", "KXNFL-SB") is None

    def test_case_insensitive_ticker(self):
        assert classify_sport("Match", "kxatpmatch-lower") == "tennis"


# ---------------------------------------------------------------------------
# scan_high_probability
# ---------------------------------------------------------------------------


def _make_market(
    ticker: str = "KXATPMATCH-001",
    event_ticker: str = "KXATPMATCH",
    title: str = "Djokovic vs Sinner - ATP",
    yes_ask: float = 0.85,
    no_ask: float = 0.20,
    liquidity: float = 500.0,
    hours_ahead: float = 24.0,
    venue: str = "kalshi",
    status: str = "active",
) -> NormalizedMarket:
    expiry = datetime.now(timezone.utc) + timedelta(hours=hours_ahead)
    return NormalizedMarket(
        ticker=ticker,
        event_ticker=event_ticker,
        market_type=MarketType.BINARY,
        title=title,
        subtitle="",
        status=MarketStatus(status),
        yes_bid=yes_ask - 0.02,
        yes_ask=yes_ask,
        no_bid=no_ask - 0.02,
        no_ask=no_ask,
        volume=10000,
        volume_24h=5000,
        liquidity=liquidity,
        open_interest=3000,
        close_time=expiry,
        expected_expiration=expiry,
        venue=venue,
    )


class TestScanHighProbability:
    def test_basic_yes_signal(self):
        market = _make_market(yes_ask=0.88, no_ask=0.18)
        signals = scan_high_probability([market])
        assert len(signals) == 1
        s = signals[0]
        assert s.signal_type == SignalType.HIGH_PROBABILITY_DIRECTIONAL
        assert s.entry_side == "yes"
        assert s.implied_probability == 0.88
        assert s.probability_floor == 0.60
        assert s.net_edge > 0

    def test_basic_no_signal(self):
        market = _make_market(yes_ask=0.15, no_ask=0.90)
        signals = scan_high_probability([market])
        assert len(signals) == 1
        assert signals[0].entry_side == "no"

    def test_both_sides_high(self):
        # Edge case: both sides >= 0.80 (impossible in real markets but should handle)
        market = _make_market(yes_ask=0.85, no_ask=0.85)
        signals = scan_high_probability([market])
        # Both should produce signals
        assert len(signals) == 2

    def test_below_threshold_filtered(self):
        market = _make_market(yes_ask=0.75, no_ask=0.30)
        signals = scan_high_probability([market])
        assert len(signals) == 0

    def test_non_sport_filtered(self):
        market = _make_market(
            ticker="KXBTC-001",
            event_ticker="KXBTC2026200",
            title="Bitcoin above 200k?",
        )
        signals = scan_high_probability([market])
        assert len(signals) == 0

    def test_low_liquidity_filtered(self):
        market = _make_market(liquidity=10.0)
        signals = scan_high_probability([market])
        assert len(signals) == 0

    def test_expired_market_filtered(self):
        market = _make_market(hours_ahead=0.1)  # 6 min away, below 1h min
        signals = scan_high_probability([market])
        assert len(signals) == 0

    def test_too_far_expiry_filtered(self):
        market = _make_market(hours_ahead=200.0)  # > 168h max
        signals = scan_high_probability([market])
        assert len(signals) == 0

    def test_inactive_market_filtered(self):
        market = _make_market(status="closed")
        signals = scan_high_probability([market])
        assert len(signals) == 0

    def test_disabled_config(self):
        market = _make_market(yes_ask=0.90)
        cfg = DirectionalConfig(enabled=False)
        signals = scan_high_probability([market], cfg)
        assert len(signals) == 0

    def test_polymarket_venue(self):
        market = _make_market(
            ticker="poly-tennis-001",
            event_ticker="poly-tennis",
            title="ATP Tennis: Djokovic to win",
            yes_ask=0.90,
            venue="polymarket",
        )
        signals = scan_high_probability([market])
        assert len(signals) == 1
        assert signals[0].legs[0].venue == "polymarket"

    def test_sorted_by_edge_descending(self):
        m1 = _make_market(ticker="T1", yes_ask=0.82)
        m2 = _make_market(ticker="T2", yes_ask=0.92)
        signals = scan_high_probability([m1, m2])
        assert len(signals) == 2
        # 0.92 has lower edge_pct (1-0.92 < 1-0.82) so m1 should be first
        assert signals[0].ticker == "T1"

    def test_soccer_market(self):
        market = _make_market(
            ticker="KXEPLGAME-ARS",
            event_ticker="KXEPLGAME",
            title="Arsenal vs Bournemouth",
            yes_ask=0.88,
        )
        signals = scan_high_probability([market])
        assert len(signals) == 1

    def test_basketball_market(self):
        market = _make_market(
            ticker="KXNBA-LAL",
            event_ticker="KXNBA",
            title="Lakers vs Wizards",
            yes_ask=0.92,
        )
        signals = scan_high_probability([market])
        assert len(signals) == 1


# ---------------------------------------------------------------------------
# check_min_implied_probability guard
# ---------------------------------------------------------------------------


class TestMinImpliedProbabilityGuard:
    def test_passes_above_threshold(self):
        signal = Signal(
            signal_type=SignalType.HIGH_PROBABILITY_DIRECTIONAL,
            implied_probability=0.85,
        )
        result = check_min_implied_probability(signal, 0.80)
        assert result.passed is True

    def test_passes_at_threshold(self):
        signal = Signal(
            signal_type=SignalType.HIGH_PROBABILITY_DIRECTIONAL,
            implied_probability=0.80,
        )
        result = check_min_implied_probability(signal, 0.80)
        assert result.passed is True

    def test_fails_below_threshold(self):
        signal = Signal(
            signal_type=SignalType.HIGH_PROBABILITY_DIRECTIONAL,
            implied_probability=0.75,
        )
        result = check_min_implied_probability(signal, 0.80)
        assert result.passed is False


# ---------------------------------------------------------------------------
# evaluate_directional_signal
# ---------------------------------------------------------------------------


class TestEvaluateDirectionalSignal:
    def _make_signal_and_market(self):
        market = _make_market(yes_ask=0.88, liquidity=200.0)
        signal = Signal(
            signal_type=SignalType.HIGH_PROBABILITY_DIRECTIONAL,
            ticker=market.ticker,
            event_ticker=market.event_ticker,
            implied_probability=0.88,
            entry_side="yes",
            probability_floor=0.60,
            edge_pct=10.0,
            net_edge=0.05,
            market_snapshot=market,
        )
        return signal, market

    def test_pass_with_empty_portfolio(self):
        signal, market = self._make_signal_and_market()
        cfg = DirectionalConfig()
        decision = evaluate_directional_signal(
            signal, market, cfg,
            portfolio_snapshot=PortfolioSnapshot(),
        )
        assert decision.verdict.value == "pass"
        assert decision.suggested_size_dollars > 0

    def test_reject_low_probability(self):
        market = _make_market(yes_ask=0.70)
        signal = Signal(
            signal_type=SignalType.HIGH_PROBABILITY_DIRECTIONAL,
            ticker=market.ticker,
            event_ticker=market.event_ticker,
            implied_probability=0.70,
        )
        cfg = DirectionalConfig()
        decision = evaluate_directional_signal(
            signal, market, cfg,
            portfolio_snapshot=PortfolioSnapshot(),
        )
        assert decision.verdict.value == "reject"

    def test_reject_exposure_exceeded(self):
        signal, market = self._make_signal_and_market()
        cfg = DirectionalConfig(max_total_exposure_dollars=100.0)
        # Portfolio already at $100
        snapshot = PortfolioSnapshot(
            total_exposure_dollars=100.0,
            open_position_count=2,
        )
        decision = evaluate_directional_signal(
            signal, market, cfg, portfolio_snapshot=snapshot,
        )
        assert decision.verdict.value == "reject"

    def test_reject_duplicate_position(self):
        signal, market = self._make_signal_and_market()
        cfg = DirectionalConfig()
        existing = Position(
            ticker=signal.ticker,
            side=TradeSide.BUY_YES,
            status=PositionStatus.OPEN,
            size_dollars=50.0,
        )
        snapshot = PortfolioSnapshot(positions=(existing,))
        decision = evaluate_directional_signal(
            signal, market, cfg, portfolio_snapshot=snapshot,
        )
        assert decision.verdict.value == "reject"
