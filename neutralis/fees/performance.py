"""Performance fee calculation with high-water mark logic.

Users pay a percentage of net profits above their all-time high (the high-water
mark).  This prevents double-charging when users recover from drawdowns.

Rates by tier:
  - free / founder: 0%
  - starter: 12%
  - pro: 7%

The module is split into a **pure function** (`compute_fee_accrual`) for
testability and a **stateful service** (`PerformanceFeeAccruer`) that wraps
DB reads/writes around the pure computation.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from neutralis.config import PerformanceFeeConfig

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pure computation
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FeeAccrualResult:
    """Outcome of computing a performance fee for a single position close."""

    fee_amount: float
    fee_rate: float
    tier: str
    hwm_before: float
    hwm_after: float
    cumulative_pnl_before: float
    cumulative_pnl_after: float
    taxable_gain: float  # portion of P&L above HWM that was taxed


def compute_fee_accrual(
    realized_pnl_delta: float,
    current_cumulative_pnl: float,
    current_hwm: float,
    tier: str,
    config: PerformanceFeeConfig | None = None,
) -> FeeAccrualResult:
    """Compute the performance fee for a single position close.

    High-water mark logic:
      1. new_cumulative = current_cumulative_pnl + realized_pnl_delta
      2. If new_cumulative > current_hwm:
         taxable_gain = new_cumulative - current_hwm
         fee = rate * taxable_gain
         Update HWM to new_cumulative
      3. If new_cumulative <= current_hwm:
         No fee (user is recovering from a drawdown).
         HWM stays the same.
    """
    cfg = config or PerformanceFeeConfig()
    rate = cfg.rate_for_tier(tier)
    new_cumulative = current_cumulative_pnl + realized_pnl_delta

    # Zero-rate tiers (free / founder) — still track HWM, no fee
    if rate <= 0.0:
        return FeeAccrualResult(
            fee_amount=0.0,
            fee_rate=rate,
            tier=tier,
            hwm_before=current_hwm,
            hwm_after=max(current_hwm, new_cumulative),
            cumulative_pnl_before=current_cumulative_pnl,
            cumulative_pnl_after=new_cumulative,
            taxable_gain=0.0,
        )

    if new_cumulative > current_hwm:
        taxable_gain = new_cumulative - current_hwm
        fee_amount = round(rate * taxable_gain, 4)
        new_hwm = new_cumulative

        # Skip dust entries
        if fee_amount < cfg.min_fee_amount:
            fee_amount = 0.0
    else:
        # Below HWM — no fee, user is recovering
        taxable_gain = 0.0
        fee_amount = 0.0
        new_hwm = current_hwm

    return FeeAccrualResult(
        fee_amount=fee_amount,
        fee_rate=rate,
        tier=tier,
        hwm_before=current_hwm,
        hwm_after=new_hwm,
        cumulative_pnl_before=current_cumulative_pnl,
        cumulative_pnl_after=new_cumulative,
        taxable_gain=taxable_gain,
    )


# ---------------------------------------------------------------------------
# Stateful accrual service (wraps pure compute + DB persistence)
# ---------------------------------------------------------------------------


class PerformanceFeeAccruer:
    """Accrue performance fees on position close.

    Instantiate with a storage backend and optional user_id (single-tenant).
    Call ``accrue_on_close`` from ``PortfolioManager.close_position()``.
    """

    def __init__(
        self,
        storage: object,  # PostgresStorage — untyped to avoid circular import
        config: PerformanceFeeConfig | None = None,
        user_id: str | None = None,
    ) -> None:
        self._storage = storage
        self._config = config or PerformanceFeeConfig()
        self._user_id = user_id

    def accrue_on_close(
        self,
        position_id: str,
        realized_pnl: float,
        user_id: str | None = None,
    ) -> FeeAccrualResult | None:
        """Compute and persist a performance fee for a closed position.

        Returns the accrual result, or ``None`` if fees are disabled or
        user_id is unavailable.
        """
        if not self._config.enabled:
            return None

        uid = user_id or self._user_id
        if uid is None:
            return None

        # Load current fee state
        state = self._storage.get_user_fee_state(uid)
        if state is None:
            # Auto-initialize for users missing a fee state row
            self._storage.upsert_user_fee_state(
                user_id=uid,
                high_water_mark=0.0,
                cumulative_realized_pnl=0.0,
                total_fees_accrued=0.0,
                current_tier="free",
            )
            state = self._storage.get_user_fee_state(uid)
            if state is None:
                return None

        # Pure computation
        result = compute_fee_accrual(
            realized_pnl_delta=realized_pnl,
            current_cumulative_pnl=float(state["cumulative_realized_pnl"]),
            current_hwm=float(state["high_water_mark"]),
            tier=state["current_tier"],
            config=self._config,
        )

        # Persist updated state
        new_total_fees = float(state["total_fees_accrued"]) + result.fee_amount
        self._storage.upsert_user_fee_state(
            user_id=uid,
            high_water_mark=result.hwm_after,
            cumulative_realized_pnl=result.cumulative_pnl_after,
            total_fees_accrued=new_total_fees,
            current_tier=result.tier,
        )

        # Append immutable ledger entry
        self._storage.append_fee_ledger(
            user_id=uid,
            position_id=position_id,
            realized_pnl_delta=realized_pnl,
            cumulative_pnl_before=result.cumulative_pnl_before,
            cumulative_pnl_after=result.cumulative_pnl_after,
            hwm_before=result.hwm_before,
            hwm_after=result.hwm_after,
            fee_rate=result.fee_rate,
            fee_amount=result.fee_amount,
            tier_at_time=result.tier,
        )

        if result.fee_amount > 0:
            logger.info(
                "Performance fee: $%.4f (%s @ %.0f%%) on position %s "
                "(P&L=$%.4f, HWM $%.4f→$%.4f)",
                result.fee_amount,
                result.tier,
                result.fee_rate * 100,
                position_id,
                realized_pnl,
                result.hwm_before,
                result.hwm_after,
            )

        return result
