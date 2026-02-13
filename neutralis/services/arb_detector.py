"""Cross-platform arbitrage detector.

Fetches live orderbooks from Kalshi and Polymarket for mapped market pairs,
computes edge in both directions, and stores arb signals.
"""

from __future__ import annotations

from neutralis.logging import get_logger
from neutralis.storage.postgres import PostgresStorage
from neutralis.venues.kalshi_client import KalshiClient
from neutralis.venues.polymarket_client import PolymarketClient

logger = get_logger(__name__)

# Default fee rates (per contract, fraction of $1)
KALSHI_FEE = 0.03
POLY_FEE = 0.02


def _best_ask(orderbook: dict, side: str) -> float | None:
    """Extract the best ask price from a venue orderbook response.

    Returns price as a fraction of $1 (0.0 - 1.0), or None if no levels.
    """
    asks = orderbook.get(side, [])
    if not asks:
        return None
    # Both venues return lists of [price, qty] or {"price": ..., "quantity": ...}
    first = asks[0]
    if isinstance(first, dict):
        return float(first.get("price", 0))
    if isinstance(first, (list, tuple)):
        return float(first[0])
    return None


def _best_bid(orderbook: dict, side: str) -> float | None:
    """Extract the best bid price from a venue orderbook response."""
    bids = orderbook.get(side, [])
    if not bids:
        return None
    first = bids[0]
    if isinstance(first, dict):
        return float(first.get("price", 0))
    if isinstance(first, (list, tuple)):
        return float(first[0])
    return None


def detect_arb_signals(
    storage: PostgresStorage,
    kalshi_client: KalshiClient,
    poly_client: PolymarketClient,
    kalshi_fee: float = KALSHI_FEE,
    poly_fee: float = POLY_FEE,
) -> list[dict]:
    """Scan all active market mappings for cross-platform arb edges.

    For each mapping, fetch orderbooks from both venues, compute:
      edge_kalshi_to_poly = 1.0 - kalshi_yes_ask - poly_no_ask - fees
      edge_poly_to_kalshi = 1.0 - poly_yes_ask - kalshi_no_ask - fees

    Upserts into arb_signals table and returns list of signal dicts.
    """
    mappings = storage.get_active_mappings()
    if not mappings:
        logger.info("No active market mappings to scan")
        return []

    total_fees = kalshi_fee + poly_fee
    signals: list[dict] = []

    for mapping in mappings:
        kalshi_ticker = mapping["kalshi_ticker"]
        poly_token_id = mapping["polymarket_token_id_yes"]
        mapping_id = mapping["id"]

        try:
            kalshi_ob = kalshi_client.get_orderbook(kalshi_ticker)
            poly_ob = poly_client.get_orderbook(poly_token_id)
        except Exception:
            logger.warning(
                "Failed to fetch orderbooks for mapping %s",
                mapping_id,
                exc_info=True,
            )
            continue

        # Kalshi orderbook has "yes" and "no" keys
        kalshi_yes_ask = _best_ask(kalshi_ob, "yes")
        kalshi_no_ask = _best_ask(kalshi_ob, "no")
        kalshi_yes_bid = _best_bid(kalshi_ob, "yes")
        kalshi_no_bid = _best_bid(kalshi_ob, "no")

        # Polymarket orderbook has "asks" and "bids" for the YES token
        # For the NO side, poly_no_ask = 1 - poly_yes_bid
        poly_yes_ask_val = _best_ask(poly_ob, "asks")
        poly_yes_bid_val = _best_bid(poly_ob, "bids")

        if any(
            v is None
            for v in [kalshi_yes_ask, kalshi_no_ask, poly_yes_ask_val, poly_yes_bid_val]
        ):
            logger.debug(
                "Incomplete orderbook data for mapping %s, skipping",
                mapping_id,
            )
            continue

        # Polymarket NO side: no_ask ≈ 1 - yes_bid, no_bid ≈ 1 - yes_ask
        poly_no_ask = 1.0 - poly_yes_bid_val  # type: ignore[operator]
        poly_no_bid = 1.0 - poly_yes_ask_val  # type: ignore[operator]

        # Kalshi prices are in cents (0-99), convert to fraction if needed
        k_bid = float(kalshi_yes_bid) if kalshi_yes_bid else 0.0  # type: ignore[arg-type]
        k_ask = float(kalshi_yes_ask)  # type: ignore[arg-type]
        k_no_ask = float(kalshi_no_ask)  # type: ignore[arg-type]
        p_bid = float(poly_yes_bid_val)  # type: ignore[arg-type]
        p_ask = float(poly_yes_ask_val)  # type: ignore[arg-type]

        # Edge: buy YES on cheaper, buy NO on other
        edge_kp = 1.0 - k_ask - poly_no_ask - total_fees
        edge_pk = 1.0 - p_ask - k_no_ask - total_fees

        signal_id = storage.save_arb_signal(
            mapping_id=mapping_id,
            kalshi_bid=k_bid,
            kalshi_ask=k_ask,
            poly_bid=p_bid,
            poly_ask=p_ask,
            edge_kp=edge_kp,
            edge_pk=edge_pk,
            liquidity_notes=None,
        )

        signal = {
            "id": signal_id,
            "mapping_id": mapping_id,
            "title": mapping.get("title", ""),
            "kalshi_ticker": kalshi_ticker,
            "poly_token_id": poly_token_id,
            "kalshi_bid": k_bid,
            "kalshi_ask": k_ask,
            "poly_bid": p_bid,
            "poly_ask": p_ask,
            "edge_kalshi_to_poly": edge_kp,
            "edge_poly_to_kalshi": edge_pk,
        }
        signals.append(signal)

        if edge_kp > 0.01 or edge_pk > 0.01:
            logger.info(
                "Arb edge detected: %s K->P=%.2f%% P->K=%.2f%%",
                mapping.get("title", kalshi_ticker),
                edge_kp * 100,
                edge_pk * 100,
            )

    logger.info("Scanned %d mappings, produced %d arb signals", len(mappings), len(signals))
    return signals
