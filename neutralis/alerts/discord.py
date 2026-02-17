"""Discord webhook notifier -- fire-and-forget alerts for pipeline events."""

from __future__ import annotations

from typing import Any

import httpx

from neutralis.config import AlertsConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)

# Embed colours
_GREEN = 0x2ECC71
_RED = 0xE74C3C
_ORANGE = 0xE67E22
_BLUE = 0x3498DB


class DiscordNotifier:
    """Posts rich-embed alerts to a Discord webhook.

    If no webhook URL is configured the notifier silently no-ops.
    Every public method is wrapped in try/except — a failed alert must
    never crash the pipeline.
    """

    def __init__(self, config: AlertsConfig) -> None:
        self._url = config.discord_webhook_url
        self._enabled = config.enabled and bool(self._url)

    # ------------------------------------------------------------------
    # Public alert methods
    # ------------------------------------------------------------------

    def notify_signals(
        self,
        complement: int,
        cross_platform: int,
        matches: int,
    ) -> None:
        """Alert when signals are found (skips if all counts are zero)."""
        total = complement + cross_platform
        if total == 0:
            return

        fields: list[dict[str, Any]] = []
        if complement > 0:
            fields.append({"name": "Complement Arb", "value": str(complement), "inline": True})
        if cross_platform > 0:
            fields.append({"name": "Cross-Platform", "value": str(cross_platform), "inline": True})
        fields.append({"name": "Matched Pairs", "value": str(matches), "inline": True})

        self._send_embed(
            title=f"\u26a1 {total} Signal{'s' if total != 1 else ''} Detected",
            color=_GREEN,
            fields=fields,
        )

    def notify_fill(
        self,
        ticker: str,
        side: str,
        venue: str,
        size: float,
        price: float,
    ) -> None:
        """Alert when a position is opened from a PASS decision."""
        self._send_embed(
            title="\u2705 Position Opened",
            color=_GREEN,
            fields=[
                {"name": "Ticker", "value": ticker, "inline": True},
                {"name": "Side", "value": side.upper(), "inline": True},
                {"name": "Venue", "value": venue.capitalize(), "inline": True},
                {"name": "Size", "value": f"${size:.2f}", "inline": True},
                {"name": "Price", "value": f"${price:.4f}", "inline": True},
            ],
        )

    def notify_settlement(
        self,
        ticker: str,
        side: str,
        result: str,
        pnl: float,
    ) -> None:
        """Alert when a position is settled with realized P&L."""
        color = _GREEN if pnl >= 0 else _RED
        pnl_str = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"

        self._send_embed(
            title="\U0001f4b0 Position Settled",
            color=color,
            fields=[
                {"name": "Ticker", "value": ticker, "inline": True},
                {"name": "Side", "value": side.upper(), "inline": True},
                {"name": "Result", "value": result.upper(), "inline": True},
                {"name": "Realized P&L", "value": pnl_str, "inline": True},
            ],
        )

    def notify_error(
        self,
        error_msg: str,
        consecutive: int,
        max_errors: int,
    ) -> None:
        """Alert on pipeline errors. Red if near limit, orange otherwise."""
        color = _RED if consecutive >= max_errors - 1 else _ORANGE
        self._send_embed(
            title=f"\u26a0\ufe0f Pipeline Error ({consecutive}/{max_errors})",
            color=color,
            fields=[
                {"name": "Error", "value": f"```{error_msg[:1000]}```", "inline": False},
            ],
        )

    def notify_pipeline_summary(self, stats: object) -> None:
        """Post-run summary. Only call when something interesting happened."""
        fields = [
            {
                "name": "Signals",
                "value": str(
                    getattr(stats, "complement_signals", 0)
                    + getattr(stats, "cross_platform_signals", 0)
                ),
                "inline": True,
            },
            {"name": "Pass", "value": str(getattr(stats, "decisions_pass", 0)), "inline": True},
            {"name": "Reject", "value": str(getattr(stats, "decisions_reject", 0)), "inline": True},
            {"name": "Open", "value": str(getattr(stats, "open_positions", 0)), "inline": True},
            {
                "name": "Exposure",
                "value": f"${getattr(stats, 'total_exposure', 0.0):.2f}",
                "inline": True,
            },
            {
                "name": "Duration",
                "value": f"{getattr(stats, 'duration_ms', 0.0):.0f}ms",
                "inline": True,
            },
        ]

        settled = getattr(stats, "positions_settled", 0)
        if settled > 0:
            pnl = getattr(stats, "settlement_pnl", 0.0)
            pnl_str = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"
            fields.append({"name": "Settled", "value": str(settled), "inline": True})
            fields.append({"name": "Settlement P&L", "value": pnl_str, "inline": True})

        self._send_embed(
            title="\U0001f4ca Pipeline Run Complete",
            color=_BLUE,
            fields=fields,
        )

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _send_embed(
        self,
        title: str,
        color: int,
        fields: list[dict[str, Any]],
        description: str = "",
    ) -> None:
        """POST a single rich embed to the Discord webhook."""
        if not self._enabled:
            return

        payload: dict[str, Any] = {
            "embeds": [
                {
                    "title": title,
                    "color": color,
                    "fields": fields,
                    "footer": {"text": "Neutralis.ai"},
                },
            ],
        }
        if description:
            payload["embeds"][0]["description"] = description

        try:
            resp = httpx.post(self._url, json=payload, timeout=5.0)
            resp.raise_for_status()
        except Exception:
            logger.warning("Failed to send Discord alert: %s", title, exc_info=True)
