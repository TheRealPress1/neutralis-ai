"""Read/write operations for the market_mappings table."""

from __future__ import annotations

from neutralis.storage.postgres import PostgresStorage


def upsert_mapping(
    storage: PostgresStorage,
    kalshi_ticker: str,
    polymarket_token_id_yes: str,
    title: str,
    match_confidence: float,
) -> int:
    """Create or update a market mapping. Returns the mapping id."""
    return storage.upsert_market_mapping(
        kalshi_ticker=kalshi_ticker,
        polymarket_token_id_yes=polymarket_token_id_yes,
        title=title,
        match_confidence=match_confidence,
    )


def get_active(storage: PostgresStorage, limit: int = 100) -> list[dict]:
    """Return all active market mappings."""
    return storage.get_active_mappings(limit=limit)
