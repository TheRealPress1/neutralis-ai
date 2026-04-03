"""Configuration loader -- reads from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _load_dotenv() -> None:
    """Minimal .env.local loader. No external dependency."""
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if key not in os.environ:
                os.environ[key] = value


_load_dotenv()


@dataclass(frozen=True)
class KalshiConfig:
    base_url: str = "https://api.elections.kalshi.com/trade-api/v2"
    markets_path: str = "/markets"
    series_path: str = "/series"
    events_path: str = "/events"
    orderbook_path: str = "/markets/{ticker}/orderbook"
    max_reads_per_sec: int = 20
    default_market_limit: int = 1000
    orderbook_depth: int = 10


@dataclass(frozen=True)
class DatabaseConfig:
    dsn: str = field(default_factory=lambda: os.environ.get("SUPABASE_DB_URL", ""))

    def __post_init__(self) -> None:
        if not self.dsn:
            raise ValueError(
                "SUPABASE_DB_URL not set. "
                "Get it from Supabase Dashboard > Settings > Database > Connection string."
            )


TIME_HORIZON_PRESETS: dict[str, float] = {
    "live": 72.0,          # 3 days — focus on imminent markets
    "short_term": 168.0,   # 1 week
    "medium_term": 720.0,  # 30 days
    "long_term": 2160.0,   # 90 days
    "all": 43800.0,        # ~5 years (default — no filtering)
}


@dataclass(frozen=True)
class PipelineConfig:
    scan_interval_sec: float = 30.0
    min_edge_pct: float = 1.0
    min_liquidity_dollars: float = 50.0
    max_time_to_expiry_hours: float = 43800.0  # ~5 years (tournament/political markets)
    min_time_to_expiry_hours: float = 1.0
    fee_rate: float = 0.07
    max_position_dollars: float = field(
        default_factory=lambda: float(os.environ.get("MAX_POSITION_DOLLARS", "25.0"))
    )
    min_xp_edge_pct: float = 0.10  # Cross-platform arb threshold (lower — one side is fee-free)
    slippage_per_leg: float = 0.002  # $0.002 per leg execution buffer (price movement risk)


@dataclass(frozen=True)
class PolymarketConfig:
    gamma_base_url: str = "https://gamma-api.polymarket.com"
    clob_base_url: str = "https://clob.polymarket.com"
    default_market_limit: int = 100
    max_pages: int = 50


@dataclass(frozen=True)
class MatchingConfig:
    min_similarity: float = 0.65
    min_discrepancy_pct: float = 3.0
    min_token_overlap: int = 2
    weight_text: float = 0.50
    weight_entity: float = 0.35
    weight_temporal: float = 0.15
    max_liquidity_ratio: float = 10.0  # reject if venue liquidity differs >Nx
    max_spread: float = 0.40  # reject if bid-ask spread > this on either side


@dataclass(frozen=True)
class PortfolioConfig:
    max_total_exposure_dollars: float = field(
        default_factory=lambda: float(os.environ.get("MAX_TOTAL_EXPOSURE", "500.0"))
    )
    max_event_exposure_dollars: float = field(
        default_factory=lambda: float(os.environ.get("MAX_EVENT_EXPOSURE", "100.0"))
    )
    max_ticker_exposure_dollars: float = field(
        default_factory=lambda: float(os.environ.get("MAX_TICKER_EXPOSURE", "50.0"))
    )
    max_venue_exposure_pct: float = 0.80
    max_open_positions: int = 50
    # Daily loss circuit breaker — auto-pause trading when either limit is hit
    max_daily_loss_dollars: float = field(
        default_factory=lambda: float(os.environ.get("MAX_DAILY_LOSS", "100.0"))
    )
    max_daily_loss_pct: float = 20.0  # daily loss as % of max_total_exposure (starting capital proxy)


@dataclass(frozen=True)
class ExitConfig:
    stop_loss_pct: float = 15.0
    take_profit_pct: float = 25.0
    time_decay_hours: float = 24.0
    time_decay_edge_floor_pct: float = 1.0
    min_exit_liquidity_dollars: float = 10.0
    enabled: bool = True
    # Trailing stop: exit if price drops this % from high-water mark
    trailing_stop_pct: float = 10.0
    trailing_stop_activation_pct: float = 5.0  # Only activate after position is +5%
    # Dynamic take-profit: tighten TP as expiry approaches
    # When hours_to_expiry < dynamic_tp_hours, scale TP from take_profit_pct down to dynamic_tp_floor_pct
    dynamic_tp_hours: float = 12.0
    dynamic_tp_floor_pct: float = 8.0


@dataclass(frozen=True)
class PerformanceFeeConfig:
    enabled: bool = True
    free_rate: float = 0.00
    starter_rate: float = 0.12
    pro_rate: float = 0.07
    founder_rate: float = 0.00
    min_fee_amount: float = 0.0001  # $0.0001 — skip dust entries

    def rate_for_tier(self, tier: str) -> float:
        """Return the fee rate for a subscription tier."""
        rates = {
            "free": self.free_rate,
            "starter": self.starter_rate,
            "pro": self.pro_rate,
            "founder": self.founder_rate,
        }
        return rates.get(tier, self.free_rate)


@dataclass(frozen=True)
class DirectionalConfig:
    enabled: bool = True
    min_implied_probability: float = 0.80
    probability_floor: float = 0.60
    min_liquidity_dollars: float = 50.0
    max_position_dollars: float = 100.0
    max_total_exposure_dollars: float = 2000.0
    max_event_exposure_dollars: float = 200.0
    max_ticker_exposure_dollars: float = 100.0
    max_open_positions: int = 50
    min_time_to_expiry_hours: float = 1.0
    max_time_to_expiry_hours: float = 168.0  # 7 days
    # Per-category probability thresholds (override min_implied_probability)
    # Crypto milestones are binary (BTC > $150k?) — 85% is very strong conviction
    crypto_min_probability: float = 0.85
    crypto_max_time_hours: float = 720.0  # 30 days (milestone markets resolve slower)
    # Political markets have longer horizons — require higher conviction
    politics_min_probability: float = 0.88
    politics_max_time_hours: float = 2160.0  # 90 days
    # Categories to scan (in addition to sports which is always on)
    extra_categories: tuple[str, ...] = ("crypto", "politics")


@dataclass(frozen=True)
class MomentumConfig:
    enabled: bool = True
    # Price velocity: min price move in 5-min window to trigger
    min_price_velocity: float = 0.10
    # Volume surge: current 5m vol must be Nx the rolling average
    volume_surge_multiplier: float = 3.0
    # Flow imbalance: must agree with price direction
    flow_imbalance_threshold: float = 0.75
    # Implied probability range (entry must be in this band)
    min_implied_probability: float = 0.75
    max_entry_price: float = 0.95
    min_entry_price: float = 0.30
    # Minimum contracts in 5m window
    min_volume_5m: int = 30
    # Position sizing
    max_position_dollars: float = 40.0
    # Probability floor for exit (lower than directional — momentum exits faster)
    probability_floor: float = 0.50
    # Per-sport overrides (tennis momentum is faster than soccer)
    tennis_min_velocity: float = 0.08
    tennis_surge_mult: float = 2.5
    soccer_min_velocity: float = 0.12
    soccer_surge_mult: float = 3.0
    basketball_min_velocity: float = 0.10
    basketball_surge_mult: float = 3.0


@dataclass(frozen=True)
class ScoreConfig:
    enabled: bool = True
    poll_interval_sec: float = 30.0
    timeout_sec: float = 10.0
    # ESPN league slugs to poll
    tennis_leagues: tuple[str, ...] = ("atp", "wta")
    soccer_leagues: tuple[str, ...] = (
        "eng.1", "ger.1", "ita.1", "esp.1", "fra.1",
        "usa.1", "uefa.champions", "uefa.europa",
    )
    basketball_leagues: tuple[str, ...] = ("nba",)
    # Edge multiplier when score confirms momentum
    score_confirm_boost: float = 1.5
    # Velocity threshold reduction when score confirms direction
    score_velocity_discount: float = 0.50


@dataclass(frozen=True)
class ExecutionConfig:
    live_trading_enabled: bool = field(
        default_factory=lambda: os.environ.get("LIVE_TRADING_ENABLED", "true").lower()
        in ("true", "1", "yes")
    )
    kalshi_api_key_id: str = field(
        default_factory=lambda: os.environ.get("KALSHI_API_KEY_ID", "")
    )
    kalshi_private_key_path: str = field(
        default_factory=lambda: os.environ.get("KALSHI_PRIVATE_KEY_PATH", "")
    )
    # Polymarket CLOB execution credentials
    polymarket_private_key: str = field(
        default_factory=lambda: os.environ.get("POLYMARKET_PRIVATE_KEY", "")
    )
    polymarket_funder_address: str = field(
        default_factory=lambda: os.environ.get("POLYMARKET_FUNDER_ADDRESS", "")
    )
    polymarket_signature_type: int = field(
        default_factory=lambda: int(os.environ.get("POLYMARKET_SIGNATURE_TYPE", "0"))
    )
    max_order_dollars: float = field(
        default_factory=lambda: float(os.environ.get("MAX_ORDER_DOLLARS", "50.0"))
    )
    balance_floor_dollars: float = field(
        default_factory=lambda: float(os.environ.get("BALANCE_FLOOR_DOLLARS", "25.0"))
    )

    # Order placement timeout — max time to wait for an exchange API response
    order_timeout_sec: float = 15.0
    # Polymarket maintenance window suppression (Tuesdays ~7:00 AM ET, ~90s downtime)
    suppress_poly_maintenance: bool = True
    # Maker order strategy — GTC limit orders for lower Kalshi fees (4x cheaper)
    use_maker_orders: bool = True
    maker_price_offset_cents: int = 1  # Post N cents inside the spread (bid + offset)
    maker_fill_timeout_sec: float = 10.0  # Cancel unfilled GTC order after this
    # Polymarket US execution credentials (Ed25519)
    polymarket_us_key_id: str = field(
        default_factory=lambda: os.environ.get("POLYMARKET_US_KEY_ID", "")
    )
    polymarket_us_secret_key: str = field(
        default_factory=lambda: os.environ.get("POLYMARKET_US_SECRET_KEY", "")
    )
    # Prefer US over international for sports markets when both are available
    prefer_polymarket_us: bool = field(
        default_factory=lambda: os.environ.get("PREFER_POLYMARKET_US", "true").lower()
        in ("true", "1", "yes")
    )


@dataclass(frozen=True)
class MarketFilterConfig:
    enabled: bool = True
    category_whitelist: tuple[str, ...] = ("politics", "economics", "crypto")
    incremental_updates: bool = True
    full_refresh_interval_sec: float = 300.0
    # Series with known cross-platform overlap (Polymarket counterparts exist)
    priority_series: tuple[str, ...] = (
        # Soccer tournament winners
        "KXPREMIERLEAGUE", "KXUCL", "KXFACUP", "KXLALIGA",
        "KXBUNDESLIGA", "KXSERIEA", "KXLIGUE1",
        "KXEUROPALEAGUE", "KXMLSWINNER",
        # Soccer match 3-way markets (Team A / Team B / Draw)
        "KXEPLGAME", "KXBUNDESLIGAGAME", "KXLIGUE1GAME",
        "KXSERIEAGAME", "KXBRASILEIROGAME", "KXSCOTTISHPREMGAME", "KXUEFAGAME",
        # Tennis
        "KXATPMATCH", "KXWTAMATCH",
        # American sports
        "KXNBA", "KXNFL",
        "KXNBAMVP", "KXNBAEAST", "KXNBAWEST",
        # NHL + MLB (confirmed cross-platform overlap via Attena)
        "KXNHL", "KXMLB",
        # Crypto milestones (Polymarket has BTC/ETH milestone markets)
        "KXBTCMAXY", "KXBTCMINY", "KXETHMAXY", "KXETHMINY",
        "KXBTC2026200", "KXBTC2026250", "KXCRYPTORESERVE",
        # Economics (Polymarket has Fed/inflation/GDP markets)
        "KXFEDDECISION", "KXRATECUT", "KXFED", "KXCPIYOY", "KXGDP",
        # Political
        "KXFEDCHAIRNOM", "KXPRESPARTY",
        "KXSENATE", "KXGOVCA",
        # Entertainment (Polymarket has Oscar/Nobel markets)
        "KXOSCARPIC", "KXOSCARACTO", "KXOSCARACTR", "KXOSCARDIR",
        "KXNOBELPEACE",
    )


@dataclass(frozen=True)
class WebSocketConfig:
    enabled: bool = field(
        default_factory=lambda: os.environ.get("WEBSOCKET_ENABLED", "").lower()
        in ("true", "1", "yes")
    )
    ws_url: str = "wss://api.elections.kalshi.com/trade-api/ws/v2"
    reconnect_delay_sec: float = 1.0
    max_reconnect_delay_sec: float = 60.0
    health_port: int = 9091
    # Focus on high-crossover categories for real-time arb detection
    focus_categories: tuple[str, ...] = ("Sports", "Crypto", "Politics")
    # How often to run periodic tasks (settlement, MTM, full REST refresh)
    settlement_interval_sec: float = 60.0
    mtm_interval_sec: float = 30.0
    rest_refresh_interval_sec: float = 300.0
    # Max markets to subscribe to on WS (performance guard)
    max_ws_subscriptions: int = 2000
    # Stale price protection: reject orders if price data is older than this
    max_price_age_sec: float = 30.0


@dataclass(frozen=True)
class PolymarketWSConfig:
    enabled: bool = field(
        default_factory=lambda: os.environ.get("POLYMARKET_WS_ENABLED", "").lower()
        in ("true", "1", "yes")
    )
    ws_url: str = "wss://ws-subscriptions-clob.polymarket.com/ws/market"
    reconnect_delay_sec: float = 1.0
    max_reconnect_delay_sec: float = 60.0
    max_subscriptions: int = 500


@dataclass(frozen=True)
class PolymarketUSConfig:
    """Polymarket US (CFTC-regulated) market data configuration."""
    base_url: str = "https://gateway.polymarket.us"
    default_market_limit: int = 100
    max_pages: int = 50


@dataclass(frozen=True)
class PolymarketUSWSConfig:
    enabled: bool = field(
        default_factory=lambda: os.environ.get("POLYMARKET_US_WS_ENABLED", "").lower()
        in ("true", "1", "yes")
    )
    ws_url: str = "wss://api.polymarket.us/v1/ws/markets"
    reconnect_delay_sec: float = 1.0
    max_reconnect_delay_sec: float = 60.0
    max_subscriptions: int = 10  # Hard limit from US API


@dataclass(frozen=True)
class SchedulerConfig:
    scan_interval_sec: float = 30.0
    max_consecutive_errors: int = 5
    max_backoff_sec: float = 300.0
    startup_health_check: bool = True
    heartbeat_every_n_runs: int = 10
    health_port: int = 9090


@dataclass(frozen=True)
class APIConfig:
    host: str = "0.0.0.0"
    port: int = field(
        default_factory=lambda: int(os.environ.get("PORT", 8000))
    )


@dataclass(frozen=True)
class AlertsConfig:
    discord_webhook_url: str = field(
        default_factory=lambda: os.environ.get("DISCORD_WEBHOOK_URL", "")
    )
    enabled: bool = True


@dataclass(frozen=True)
class Settings:
    kalshi: KalshiConfig = field(default_factory=KalshiConfig)
    polymarket: PolymarketConfig = field(default_factory=PolymarketConfig)
    matching: MatchingConfig = field(default_factory=MatchingConfig)
    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    pipeline: PipelineConfig = field(default_factory=PipelineConfig)
    portfolio: PortfolioConfig = field(default_factory=PortfolioConfig)
    scheduler: SchedulerConfig = field(default_factory=SchedulerConfig)
    api: APIConfig = field(default_factory=APIConfig)
    alerts: AlertsConfig = field(default_factory=AlertsConfig)
    exits: ExitConfig = field(default_factory=ExitConfig)
    execution: ExecutionConfig = field(default_factory=ExecutionConfig)
    market_filter: MarketFilterConfig = field(default_factory=MarketFilterConfig)
    websocket: WebSocketConfig = field(default_factory=WebSocketConfig)
    polymarket_ws: PolymarketWSConfig = field(default_factory=PolymarketWSConfig)
    polymarket_us: PolymarketUSConfig = field(default_factory=PolymarketUSConfig)
    polymarket_us_ws: PolymarketUSWSConfig = field(default_factory=PolymarketUSWSConfig)
    directional: DirectionalConfig = field(default_factory=DirectionalConfig)
    momentum: MomentumConfig = field(default_factory=MomentumConfig)
    scores: ScoreConfig = field(default_factory=ScoreConfig)
    performance_fees: PerformanceFeeConfig = field(default_factory=PerformanceFeeConfig)


def load_settings() -> Settings:
    """Build and validate settings from environment."""
    return Settings()


def load_settings_with_profile(storage: object, base: Settings | None = None) -> Settings:
    """Build settings, overriding pipeline/portfolio/matching from the active DB profile.

    Falls back to environment defaults if no profile exists or DB query fails.
    If ``base`` is provided, use it instead of creating fresh Settings from env.
    """
    from neutralis.profiles import load_active_profile

    if base is None:
        base = Settings()

    try:
        profile = load_active_profile(storage)
    except Exception:
        import logging
        logging.getLogger(__name__).warning(
            "Failed to load risk profile from DB, using env defaults",
            exc_info=True,
        )
        return base

    if profile is None:
        return base

    return Settings(
        kalshi=base.kalshi,
        polymarket=base.polymarket,
        matching=profile.to_matching_config(),
        db=base.db,
        pipeline=profile.to_pipeline_config(),
        portfolio=profile.to_portfolio_config(),
        scheduler=base.scheduler,
        api=base.api,
        alerts=base.alerts,
        exits=base.exits,
        execution=base.execution,
        market_filter=base.market_filter,
        websocket=base.websocket,
        polymarket_ws=base.polymarket_ws,
        polymarket_us=base.polymarket_us,
        polymarket_us_ws=base.polymarket_us_ws,
        performance_fees=base.performance_fees,
    )
