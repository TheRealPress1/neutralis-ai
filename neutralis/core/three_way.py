"""Three-way (Dutch book) arbitrage scanner for soccer match markets.

Soccer matches have 3 mutually exclusive outcomes (Team A, Team B, Draw).
If the sum of asks for all 3 < $1.00 (minus fees), buying all 3 guarantees profit.

Works on both Kalshi (3 separate binary markets per event) and Polymarket
(single market with 3 outcomes).
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import replace
from datetime import datetime, timezone

from neutralis.config import PipelineConfig
from neutralis.fees import estimate_three_way_fee
from neutralis.logging import get_logger
from neutralis.models import (
    NormalizedMarket,
    Signal,
    SignalType,
    ThreeWayGroup,
    ThreeWayOutcome,
    TradeLeg,
)

logger = get_logger(__name__)

# Kalshi ticker suffix conventions for match markets
_TIE_SUFFIXES = ("-TIE", "-DRAW", "-DRW")

# Match series prefixes (to limit grouping to actual match series)
_MATCH_SERIES = {
    "KXEPLGAME", "KXBUNDESLIGAGAME", "KXLIGUE1GAME",
    "KXSERIEAGAME", "KXBRASILEIROGAME", "KXSCOTTISHPREMGAME",
    "KXUEFAGAME",
}


def _is_match_series(event_ticker: str) -> bool:
    """Check if event_ticker belongs to a known 3-way match series."""
    for prefix in _MATCH_SERIES:
        if event_ticker.startswith(prefix):
            return True
    return False


def _hours_until(dt: datetime | None) -> float | None:
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (dt - now).total_seconds() / 3600.0


def _extract_team_label(ticker: str, event_ticker: str) -> str:
    """Extract the team/outcome label from the ticker suffix."""
    if ticker.startswith(event_ticker) and len(ticker) > len(event_ticker) + 1:
        return ticker[len(event_ticker) + 1:]  # e.g., "AVL", "LEE", "TIE"
    return ticker


def group_kalshi_three_way(
    markets: dict[str, NormalizedMarket],
) -> list[ThreeWayGroup]:
    """Group Kalshi binary markets by event_ticker into 3-way match groups.

    Kalshi match markets use separate binary tickers per outcome:
      KXEPLGAME-26FEB21AVLLEE-AVL  (Aston Villa wins)
      KXEPLGAME-26FEB21AVLLEE-LEE  (Leeds wins)
      KXEPLGAME-26FEB21AVLLEE-TIE  (Draw)

    Returns ThreeWayGroup for events with exactly 3 active markets.
    """
    # Group by event_ticker
    by_event: dict[str, list[NormalizedMarket]] = defaultdict(list)
    for nm in markets.values():
        if nm.status.value != "active":
            continue
        if not _is_match_series(nm.event_ticker):
            continue
        by_event[nm.event_ticker].append(nm)

    groups: list[ThreeWayGroup] = []
    for event_ticker, event_markets in by_event.items():
        if len(event_markets) != 3:
            continue

        # Identify draw and team markets
        draw_market: NormalizedMarket | None = None
        team_markets: list[NormalizedMarket] = []

        for nm in event_markets:
            label = _extract_team_label(nm.ticker, event_ticker)
            if any(nm.ticker.endswith(s) for s in _TIE_SUFFIXES):
                draw_market = nm
            else:
                team_markets.append(nm)

        if draw_market is None or len(team_markets) != 2:
            continue

        # All must have valid prices
        if any(m.yes_ask <= 0 for m in event_markets):
            continue

        def _to_outcome(nm: NormalizedMarket) -> ThreeWayOutcome:
            return ThreeWayOutcome(
                label=_extract_team_label(nm.ticker, event_ticker),
                ticker=nm.ticker,
                ask=nm.yes_ask,
                bid=nm.yes_bid,
                venue="kalshi",
            )

        min_liq = min(m.liquidity for m in event_markets)

        groups.append(ThreeWayGroup(
            event_id=event_ticker,
            venue="kalshi",
            title=draw_market.title.replace("Will there be a draw in ", "").rstrip("?"),
            outcome_a=_to_outcome(team_markets[0]),
            outcome_b=_to_outcome(team_markets[1]),
            outcome_draw=_to_outcome(draw_market),
            close_time=draw_market.close_time or draw_market.expected_expiration,
            liquidity=min_liq,
        ))

    logger.info("Grouped %d Kalshi 3-way match events from %d candidates", len(groups), len(by_event))
    return groups


def scan_three_way_arb(
    groups: list[ThreeWayGroup],
    config: PipelineConfig | None = None,
    *,
    maker: bool = False,
) -> list[Signal]:
    """Scan 3-way groups for Dutch book arb (single venue).

    If sum of all 3 outcome asks < $1.00 after fees, buying all 3 guarantees profit.
    """
    cfg = config or PipelineConfig()
    signals: list[Signal] = []

    for group in groups:
        # Time filter
        hours_left = _hours_until(group.close_time)
        if hours_left is not None:
            if hours_left < cfg.min_time_to_expiry_hours:
                continue
            if hours_left > cfg.max_time_to_expiry_hours:
                continue

        combined = group.combined_ask
        if combined >= 1.0:
            continue

        gross_edge = 1.0 - combined
        prices = (group.outcome_a.ask, group.outcome_b.ask, group.outcome_draw.ask)
        venues = (group.venue, group.venue, group.venue)
        fee = estimate_three_way_fee(prices, venues, maker=maker)
        net_edge = gross_edge - fee - (cfg.slippage_per_leg * 3)

        if net_edge <= 0:
            continue

        edge_pct = (net_edge / combined) * 100.0
        if edge_pct < cfg.min_edge_pct:
            continue

        if group.liquidity < cfg.min_liquidity_dollars:
            continue

        # Build 3 trade legs
        legs = tuple(
            TradeLeg(
                ticker=oc.ticker,
                side="yes",
                price_dollars=oc.ask,
                quantity_dollars=min(cfg.max_position_dollars, group.liquidity / 3),
                venue=oc.venue,
            )
            for oc in group.outcomes
        )

        signal = Signal(
            signal_type=SignalType.THREE_WAY_ARB,
            ticker=group.event_id,
            event_ticker=group.event_id,
            yes_ask=group.outcome_a.ask,
            no_ask=group.outcome_b.ask,
            combined_cost=round(combined, 6),
            gross_edge=round(gross_edge, 6),
            net_edge=round(net_edge, 6),
            edge_pct=round(edge_pct, 4),
            legs=legs,
        )
        signals.append(signal)
        logger.info(
            "3-way arb: %s  A=%.4f B=%.4f D=%.4f  combined=%.4f  edge=%.2f%%",
            group.event_id,
            group.outcome_a.ask, group.outcome_b.ask, group.outcome_draw.ask,
            combined, edge_pct,
        )

    signals.sort(key=lambda s: s.edge_pct, reverse=True)
    logger.info("3-way scan: %d signals from %d groups", len(signals), len(groups))
    return signals


# ── Cross-venue three-way merge ──

_LABEL_CLEAN_RE = re.compile(r"[^a-z0-9 ]")
_LABEL_STRIP_SUFFIXES = ("wins", "win", "to win")


def _canonical_label(label: str) -> str:
    """Normalize outcome label for cross-venue matching.

    'Aston Villa Wins' → 'aston villa'
    'AVL' → 'avl'
    'Draw' → 'draw'
    """
    s = label.strip().lower()
    for suffix in _LABEL_STRIP_SUFFIXES:
        if s.endswith(suffix):
            s = s[: -len(suffix)].strip()
    return _LABEL_CLEAN_RE.sub("", s).strip()


def _pick_cheapest(kalshi_oc: ThreeWayOutcome, poly_oc: ThreeWayOutcome) -> ThreeWayOutcome:
    """Return the outcome with the lower ask price (cheaper to buy)."""
    if poly_oc.ask > 0 and (kalshi_oc.ask <= 0 or poly_oc.ask < kalshi_oc.ask):
        return poly_oc
    return kalshi_oc


def merge_cross_venue_three_way(
    kalshi_groups: list[ThreeWayGroup],
    poly_groups: list[ThreeWayGroup],
) -> list[ThreeWayGroup]:
    """Match Kalshi and Polymarket 3-way groups and build hybrid groups.

    For each matched pair, picks the cheapest ask per outcome across venues.
    This exploits Polymarket's near-zero fees — shifting legs to Poly reduces
    total fee burden.

    Returns hybrid ThreeWayGroups with mixed venues (e.g. 2 Poly + 1 Kalshi).
    """
    if not kalshi_groups or not poly_groups:
        return []

    # Build lookup: canonical team labels -> poly group
    # Each Poly group is indexed by the frozenset of its team labels (non-draw)
    poly_by_teams: dict[frozenset[str], ThreeWayGroup] = {}
    for pg in poly_groups:
        team_labels = frozenset(
            _canonical_label(oc.label)
            for oc in (pg.outcome_a, pg.outcome_b)
        )
        if len(team_labels) == 2:  # Must have 2 distinct team labels
            poly_by_teams[team_labels] = pg

    merged: list[ThreeWayGroup] = []
    for kg in kalshi_groups:
        # Extract canonical team labels from Kalshi group
        k_labels = frozenset(
            _canonical_label(oc.label)
            for oc in (kg.outcome_a, kg.outcome_b)
        )
        if len(k_labels) != 2:
            continue

        pg = poly_by_teams.get(k_labels)
        if pg is None:
            continue

        # Match outcomes: align Kalshi A/B/Draw to Poly A/B/Draw by label
        k_by_label = {
            _canonical_label(kg.outcome_a.label): kg.outcome_a,
            _canonical_label(kg.outcome_b.label): kg.outcome_b,
        }
        p_by_label = {
            _canonical_label(pg.outcome_a.label): pg.outcome_a,
            _canonical_label(pg.outcome_b.label): pg.outcome_b,
        }

        # Pick cheapest per outcome
        best_outcomes = []
        for label in k_labels:
            k_oc = k_by_label.get(label)
            p_oc = p_by_label.get(label)
            if k_oc and p_oc:
                best_outcomes.append(_pick_cheapest(k_oc, p_oc))
            elif k_oc:
                best_outcomes.append(k_oc)
            else:
                break  # Can't match — skip
        if len(best_outcomes) != 2:
            continue

        best_draw = _pick_cheapest(kg.outcome_draw, pg.outcome_draw)

        hybrid = ThreeWayGroup(
            event_id=f"XV:{kg.event_id}",
            venue="cross_venue",
            title=kg.title,
            outcome_a=best_outcomes[0],
            outcome_b=best_outcomes[1],
            outcome_draw=best_draw,
            close_time=kg.close_time,
            liquidity=min(kg.liquidity, pg.liquidity),
        )

        # Only include if the hybrid is cheaper than single-venue
        if hybrid.combined_ask < kg.combined_ask:
            merged.append(hybrid)

    logger.info(
        "Cross-venue 3-way merge: %d hybrid groups from %d Kalshi × %d Polymarket",
        len(merged), len(kalshi_groups), len(poly_groups),
    )
    return merged
