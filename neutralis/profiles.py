"""Risk profile loader -- reads/writes user risk profiles from the database."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from neutralis.config import MatchingConfig, PipelineConfig, PortfolioConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)


@dataclass
class RiskProfile:
    """Mutable representation of a risk_profiles row."""

    id: int
    name: str
    preset: str
    is_active: bool
    target_annual_return_pct: float
    description: str

    # Pipeline / Signal Quality
    min_edge_pct: float
    min_liquidity_dollars: float
    max_time_to_expiry_hours: float
    min_time_to_expiry_hours: float
    fee_rate: float

    # Position Sizing
    max_position_dollars: float

    # Portfolio Limits
    max_total_exposure_dollars: float
    max_event_exposure_dollars: float
    max_ticker_exposure_dollars: float
    max_venue_exposure_pct: float
    max_open_positions: int

    # Matching
    min_similarity: float

    # Daily loss limit
    daily_loss_limit_dollars: float = 100.0

    # Meta
    user_id: Optional[str] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

    def to_pipeline_config(self) -> PipelineConfig:
        """Convert profile fields to a PipelineConfig."""
        return PipelineConfig(
            min_edge_pct=self.min_edge_pct,
            min_liquidity_dollars=self.min_liquidity_dollars,
            max_time_to_expiry_hours=self.max_time_to_expiry_hours,
            min_time_to_expiry_hours=self.min_time_to_expiry_hours,
            fee_rate=self.fee_rate,
            max_position_dollars=self.max_position_dollars,
        )

    def to_portfolio_config(self) -> PortfolioConfig:
        """Convert profile fields to a PortfolioConfig."""
        return PortfolioConfig(
            max_total_exposure_dollars=self.max_total_exposure_dollars,
            max_event_exposure_dollars=self.max_event_exposure_dollars,
            max_ticker_exposure_dollars=self.max_ticker_exposure_dollars,
            max_venue_exposure_pct=self.max_venue_exposure_pct,
            max_open_positions=self.max_open_positions,
            daily_loss_limit_dollars=self.daily_loss_limit_dollars,
        )

    def to_matching_config(self) -> MatchingConfig:
        """Convert profile fields to a MatchingConfig (only min_similarity)."""
        return MatchingConfig(min_similarity=self.min_similarity)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for API response."""
        return {
            "id": self.id,
            "name": self.name,
            "preset": self.preset,
            "is_active": self.is_active,
            "target_annual_return_pct": self.target_annual_return_pct,
            "description": self.description,
            "min_edge_pct": self.min_edge_pct,
            "min_liquidity_dollars": self.min_liquidity_dollars,
            "max_time_to_expiry_hours": self.max_time_to_expiry_hours,
            "min_time_to_expiry_hours": self.min_time_to_expiry_hours,
            "fee_rate": self.fee_rate,
            "max_position_dollars": self.max_position_dollars,
            "max_total_exposure_dollars": self.max_total_exposure_dollars,
            "max_event_exposure_dollars": self.max_event_exposure_dollars,
            "max_ticker_exposure_dollars": self.max_ticker_exposure_dollars,
            "max_venue_exposure_pct": self.max_venue_exposure_pct,
            "max_open_positions": self.max_open_positions,
            "min_similarity": self.min_similarity,
            "daily_loss_limit_dollars": self.daily_loss_limit_dollars,
            "user_id": self.user_id,
            "created_at": str(self.created_at) if self.created_at else None,
            "updated_at": str(self.updated_at) if self.updated_at else None,
        }


# Column order must match the SELECT
_PROFILE_COLS = (
    "id, name, preset, is_active, target_annual_return_pct, description, "
    "min_edge_pct, min_liquidity_dollars, max_time_to_expiry_hours, "
    "min_time_to_expiry_hours, fee_rate, max_position_dollars, "
    "max_total_exposure_dollars, max_event_exposure_dollars, "
    "max_ticker_exposure_dollars, max_venue_exposure_pct, max_open_positions, "
    "min_similarity, daily_loss_limit_dollars, user_id, created_at, updated_at"
)


def _row_to_profile(row: tuple) -> RiskProfile:  # type: ignore[type-arg]
    return RiskProfile(
        id=row[0],
        name=row[1],
        preset=row[2],
        is_active=row[3],
        target_annual_return_pct=row[4],
        description=row[5],
        min_edge_pct=row[6],
        min_liquidity_dollars=row[7],
        max_time_to_expiry_hours=row[8],
        min_time_to_expiry_hours=row[9],
        fee_rate=row[10],
        max_position_dollars=row[11],
        max_total_exposure_dollars=row[12],
        max_event_exposure_dollars=row[13],
        max_ticker_exposure_dollars=row[14],
        max_venue_exposure_pct=row[15],
        max_open_positions=row[16],
        min_similarity=row[17],
        daily_loss_limit_dollars=row[18],
        user_id=str(row[19]) if row[19] else None,
        created_at=row[20],
        updated_at=row[21],
    )


# ---------------------------------------------------------------------------
# DB operations -- accept a PostgresStorage instance
# ---------------------------------------------------------------------------

def load_active_profile(storage: object) -> RiskProfile | None:
    """Load the active risk profile from the database."""
    conn = storage._ensure_connected()  # type: ignore[attr-defined]
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {_PROFILE_COLS} FROM risk_profiles "
            "WHERE is_active = TRUE AND user_id IS NULL "
            "LIMIT 1"
        )
        row = cur.fetchone()
    return _row_to_profile(row) if row else None


def load_all_profiles(storage: object) -> list[RiskProfile]:
    """Load all risk profiles."""
    conn = storage._ensure_connected()  # type: ignore[attr-defined]
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {_PROFILE_COLS} FROM risk_profiles "
            "WHERE user_id IS NULL "
            "ORDER BY id"
        )
        rows = cur.fetchall()
    return [_row_to_profile(row) for row in rows]


def activate_profile(storage: object, profile_id: int) -> None:
    """Set the given profile as active, deactivating all others."""
    conn = storage._ensure_connected()  # type: ignore[attr-defined]
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE risk_profiles SET is_active = FALSE "
            "WHERE user_id IS NULL AND is_active = TRUE"
        )
        cur.execute(
            "UPDATE risk_profiles SET is_active = TRUE, updated_at = now() "
            "WHERE id = %(id)s",
            {"id": profile_id},
        )
    conn.commit()


def update_profile(
    storage: object, profile_id: int, updates: dict[str, Any],
) -> RiskProfile | None:
    """Update specific fields on a profile. Returns the updated profile."""
    allowed = {
        "name", "preset", "target_annual_return_pct", "description",
        "min_edge_pct", "min_liquidity_dollars", "max_time_to_expiry_hours",
        "min_time_to_expiry_hours", "fee_rate", "max_position_dollars",
        "max_total_exposure_dollars", "max_event_exposure_dollars",
        "max_ticker_exposure_dollars", "max_venue_exposure_pct",
        "max_open_positions", "min_similarity", "daily_loss_limit_dollars",
    }
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return None

    # Auto-mark as custom when config fields change
    meta_fields = {"name", "description", "preset"}
    if any(k not in meta_fields for k in filtered):
        if "preset" not in filtered:
            filtered["preset"] = "custom"

    set_clauses = ", ".join(f"{k} = %({k})s" for k in filtered)
    filtered["id"] = profile_id

    conn = storage._ensure_connected()  # type: ignore[attr-defined]
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE risk_profiles SET {set_clauses}, updated_at = now() "
            f"WHERE id = %(id)s",
            filtered,
        )
    conn.commit()

    # Re-fetch updated profile
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {_PROFILE_COLS} FROM risk_profiles WHERE id = %(id)s",
            {"id": profile_id},
        )
        row = cur.fetchone()
    return _row_to_profile(row) if row else None
