"""Kalshi category resolver -- maps category slugs to event tickers via events API."""

from __future__ import annotations

from typing import TYPE_CHECKING

from neutralis.logging import get_logger

if TYPE_CHECKING:
    from neutralis.venues.kalshi_client import KalshiClient

logger = get_logger(__name__)

# Map our internal category slugs to Kalshi's event category names.
KALSHI_CATEGORY_MAP: dict[str, list[str]] = {
    "politics": ["Politics", "Elections"],
    "economics": ["Economics", "Financials"],
    "crypto": ["Crypto"],
    "sports": ["Sports"],
    "entertainment": ["Entertainment"],
    "science_tech": ["Science and Technology"],
    "weather": ["Climate and Weather"],
}


class KalshiCategoryResolver:
    """Resolve category slugs to a set of Kalshi event tickers.

    Fetches ALL events from /events (paginated), then filters by category
    to build an event_ticker whitelist for market filtering.
    """

    def __init__(self, client: KalshiClient) -> None:
        self._client = client
        self._event_tickers: set[str] = set()
        self._event_to_category: dict[str, str] = {}
        self._resolved = False

    def resolve(self, category_slugs: list[str] | tuple[str, ...]) -> None:
        """Fetch all events and filter by category whitelist."""
        # Build set of target Kalshi category names
        target_kalshi_cats: set[str] = set()
        slug_lookup: dict[str, str] = {}  # kalshi_name -> our_slug
        for slug in category_slugs:
            kalshi_names = KALSHI_CATEGORY_MAP.get(slug, [slug.capitalize()])
            for kn in kalshi_names:
                target_kalshi_cats.add(kn)
                slug_lookup[kn] = slug

        # Fetch all events (paginated)
        all_events = self._client.get_all_events()

        # Filter to target categories
        self._event_tickers.clear()
        self._event_to_category.clear()
        for event in all_events:
            cat = event.get("category", "")
            et = event.get("event_ticker", "")
            if cat in target_kalshi_cats and et:
                self._event_tickers.add(et)
                self._event_to_category[et] = slug_lookup.get(cat, "other")

        self._resolved = True
        logger.info(
            "Category resolver: %d event tickers from %d total events "
            "(categories: %s)",
            len(self._event_tickers),
            len(all_events),
            ", ".join(category_slugs),
        )

    def has_event(self, event_ticker: str | None) -> bool:
        """Check if an event ticker is in our whitelist."""
        if event_ticker is None:
            return False
        return event_ticker in self._event_tickers

    def category_for_event(self, event_ticker: str) -> str:
        """Look up which category an event belongs to."""
        return self._event_to_category.get(event_ticker, "other")

    @property
    def event_count(self) -> int:
        return len(self._event_tickers)
