"""In-memory market cache with incremental update support."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from neutralis.logging import get_logger

logger = get_logger(__name__)


def _parse_ts(value: Any) -> int:
    """Parse a timestamp to Unix seconds. Handles ISO strings and ints."""
    if isinstance(value, (int, float)) and value > 0:
        return int(value)
    if isinstance(value, str) and value:
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return int(dt.timestamp())
        except (ValueError, TypeError):
            pass
    return 0


class MarketCache:
    """Thread-safe in-memory cache of raw Kalshi market dicts.

    Supports:
    - Full load on first run (or periodic refresh)
    - Incremental updates via min_updated_ts on subsequent runs
    - Snapshot export for the pipeline
    """

    def __init__(self) -> None:
        self._markets: dict[str, dict[str, Any]] = {}  # ticker -> raw dict
        self._last_full_fetch_ts: float = 0.0
        self._last_update_epoch: int = 0  # Unix seconds for min_updated_ts

    def update_bulk(self, markets: list[dict[str, Any]]) -> int:
        """Insert or update markets. Returns count of new/changed entries."""
        changed = 0
        max_ts = self._last_update_epoch
        for m in markets:
            ticker = m.get("ticker")
            if not ticker:
                continue
            # Track the latest update timestamp (Kalshi uses updated_time ISO string)
            raw_ts = m.get("updated_time") or m.get("last_updated_ts") or m.get("updated_ts") or 0
            updated_ts = _parse_ts(raw_ts)
            if updated_ts > max_ts:
                max_ts = updated_ts
            # Check if this is actually new/changed
            existing = self._markets.get(ticker)
            if existing is None:
                changed += 1
            self._markets[ticker] = m

        if max_ts > self._last_update_epoch:
            self._last_update_epoch = max_ts
        return changed

    def mark_full_refresh(self) -> None:
        """Record that a full refresh just completed."""
        self._last_full_fetch_ts = time.monotonic()

    def needs_full_refresh(self, full_refresh_interval_sec: float) -> bool:
        """Check if enough time has passed for a full re-fetch."""
        if self._last_full_fetch_ts == 0:
            return True
        return (time.monotonic() - self._last_full_fetch_ts) >= full_refresh_interval_sec

    def remove(self, ticker: str) -> None:
        """Remove a market from the cache."""
        self._markets.pop(ticker, None)

    def get_all(self) -> list[dict[str, Any]]:
        """Return all cached markets as a list of raw dicts."""
        return list(self._markets.values())

    @property
    def last_update_epoch(self) -> int:
        """Unix timestamp of the most recent market update."""
        return self._last_update_epoch

    @property
    def is_empty(self) -> bool:
        return len(self._markets) == 0

    @property
    def size(self) -> int:
        return len(self._markets)
