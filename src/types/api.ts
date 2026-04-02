/* TypeScript types mirroring the Python models and SQL schema. */

export interface PortfolioStats {
  open_positions: number;
  closed_positions: number;
  total_exposure: number;
  total_realized_pnl: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_trades: number;
}

export interface Position {
  id: string;
  ticker: string;
  event_ticker: string;
  venue: string;
  side: "buy_yes" | "buy_no";
  status: "open" | "closed";
  entry_price: number;
  size_dollars: number;
  quantity: number;
  realized_pnl: number;
  unrealized_pnl: number;
  trade_count: number;
  opened_at: string;
  closed_at: string | null;
}

export interface Signal {
  id: string;
  signal_type: "complement_arb" | "cross_platform_discrepancy";
  ticker: string;
  event_ticker: string;
  yes_ask: number;
  no_ask: number;
  combined_cost: number;
  gross_edge: number;
  net_edge: number;
  edge_pct: number;
  snapshot_id: number | null;
  created_at: string;
}

export interface GuardResult {
  guard_name: string;
  passed: boolean;
  reason: string;
  value: number | null;
  threshold: number | null;
}

export interface Decision {
  id: number;
  signal_id: string;
  verdict: "pass" | "reject";
  guard_results: GuardResult[];
  suggested_size: number;
  created_at: string;
  ticker: string;
  edge_pct: number;
  signal_type: "complement_arb" | "cross_platform_discrepancy";
}

export interface MarketMatch {
  id: number;
  kalshi_ticker: string;
  kalshi_title: string;
  polymarket_id: string;
  polymarket_question: string;
  match_confidence: number;
  kalshi_snapshot_id: number | null;
  polymarket_snapshot_id: number | null;
  created_at: string;
}

export type ActivityItem =
  | { kind: "signal"; data: Signal }
  | { kind: "decision"; data: Decision };

export interface RiskProfile {
  id: number;
  name: string;
  preset: "conservative" | "moderate" | "aggressive" | "custom";
  is_active: boolean;
  target_annual_return_pct: number;
  description: string;

  // Signal Quality
  min_edge_pct: number;
  min_liquidity_dollars: number;
  max_time_to_expiry_hours: number;
  min_time_to_expiry_hours: number;
  fee_rate: number;

  // Position Sizing
  max_position_dollars: number;

  // Portfolio Limits
  max_total_exposure_dollars: number;
  max_event_exposure_dollars: number;
  max_ticker_exposure_dollars: number;
  max_venue_exposure_pct: number;
  max_open_positions: number;

  // Matching
  min_similarity: number;

  // Daily loss limit
  daily_loss_limit_dollars: number;

  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// --- Arb Signals ---

export interface ArbSignal {
  id: number;
  mapping_id: number;
  kalshi_ticker: string;
  title: string;
  kalshi_bid: number;
  kalshi_ask: number;
  poly_bid: number;
  poly_ask: number;
  edge_kalshi_to_poly: number;
  edge_poly_to_kalshi: number;
  ts: string;
}

// --- Execution ---

export interface Order {
  id: string;
  ticker: string;
  venue: string;
  side: "buy_yes" | "buy_no";
  decision_id: number;
  status: "filled" | "partial" | "cancelled" | "pending";
  requested_price: number;
  requested_size_dollars: number;
  filled_size_dollars: number;
  avg_fill_price: number | null;
  slippage_bps: number | null;
  fees_dollars: number;
  created_at: string;
}

export interface Fill {
  id: string;
  order_id: string;
  fill_number: number;
  ticker?: string;
  side?: "buy_yes" | "buy_no";
  price: number;
  requested_price?: number;
  quantity: number;
  size_dollars: number;
  fee_dollars: number;
  slippage_bps: number;
  created_at: string;
}

export interface ExecutionStats {
  total_orders: number;
  filled: number;
  partial: number;
  cancelled: number;
  avg_slippage_bps: number;
  total_fees: number;
}

// --- Backtest ---

export interface BacktestResult {
  start_date: string;
  end_date: string;
  time_steps: number;
  duration_ms: number;
  total_pnl: number;
  total_trades: number;
  total_signals: number;
  total_passed: number;
  total_rejected: number;
  positions_opened: number;
  positions_closed: number;
  win_count: number;
  loss_count: number;
  best_trade: number;
  worst_trade: number;
  max_drawdown: number;
  avg_trade_pnl: number;
  win_rate: number;
  equity_curve: Array<{ ts: string; realized_pnl: number; open_positions: number; total_exposure: number }>;
  trades: Array<{ ts: string; ticker: string; venue: string; side: string; price: number; size_dollars: number; edge_pct: number }>;
  closed_positions: Array<{ ticker: string; venue: string; side: string; entry_price: number; size_dollars: number; realized_pnl: number; category: string }>;
  by_category: Record<string, { pnl: number; trades: number }>;
  by_venue: Record<string, unknown>;
  by_signal_type: Record<string, unknown>;
  config_snapshot: Record<string, unknown>;
}

export interface BacktestDataRange {
  earliest: string;
  latest: string;
  total_runs: number;
  total_snapshots: number;
}

export interface OptimizerResult {
  rank: number;
  objective_value: number;
  total_pnl: number;
  win_rate: number;
  sharpe_ratio: number;
  total_trades: number;
  weights: Record<string, number>;
}

// --- Analytics ---

export interface AnalyticsSummary {
  total_pnl: number;
  total_closed: number;
  avg_trade_pnl: number;
  max_drawdown: number;
  best_day: number;
  worst_day: number;
  avg_win: number;
  avg_loss: number;
}

export interface CategoryBreakdown {
  category: string;
  total_pnl: number;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  losses?: number;
}

export interface GuardStat {
  guard_name: string;
  rejections: number;
  total_evaluations: number;
  rejection_rate: number;
}

export interface PnLBucket {
  bucket_start: number;
  count: number;
}

export interface VenueBreakdown {
  venue: string;
  total_trades: number;
  total_pnl: number;
}

// --- Decision Reasons ---

export interface DecisionReasons {
  ticker: string;
  verdict: "pass" | "reject";
  selected: boolean;
  edge_pct: number;
  confidence_score: number;
  roi_per_day: number;
  time_to_resolution_days: number;
  suggested_size: number;
  selection_score: number | null;
  guard_results: GuardResult[];
  allocation_reasons: string[];
  features_json: Record<string, unknown>;
}

// --- Enriched Signals & Regime ---

export interface EnrichedSignal {
  id: string;
  ticker: string;
  signal_type: "complement_arb" | "cross_platform_discrepancy";
  confidence_score: number;
  edge_pct: number;
  roi_per_day: number;
  signal_created_at: string;
  verdict: "pass" | "reject" | null;
  selected: boolean;
  guard_results: GuardResult[];
  allocation_reasons?: string[];
}

export interface RegimeState {
  regime: "normal" | "risk_off";
  metrics_json: Record<string, unknown>;
  params_json: Record<string, unknown>;
}

// --- Automation / Kill Switch ---

export interface AutomationState {
  id?: number;
  status: "running" | "paused" | "killed";
  kill_switch: boolean;
  killed_reason: string | null;
  paused_at: string | null;
  killed_at: string | null;
  started_at: string | null;
  daily_loss_dollars: number;
  daily_loss_reset_at: string | null;
  peak_portfolio_value: number;
  max_drawdown_dollars: number;
  updated_at: string | null;
}

// --- Audit Logs ---

export interface AuditLogEntry {
  id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

// --- Pipeline Logs (Live tab) ---

export interface PipelineLog {
  id: number;
  level: string;
  category: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

// --- Engine Health (Live tab) ---

export interface EngineHealth {
  status: "ok" | "degraded" | "stopped" | "paused" | "unreachable";
  paused?: boolean;
  kalshi_ws_connected?: boolean;
  kalshi_ws_subscriptions?: number;
  poly_ws_connected?: boolean;
  poly_ws_subscriptions?: number;
  poly_us_ws_connected?: boolean;
  poly_us_ws_subscriptions?: number;
  kalshi_markets?: number;
  poly_markets?: number;
  poly_us_markets?: number;
  xp_pairs?: number;
  three_way_groups?: number;
  ticker_updates?: number;
  arb_checks?: number;
  signals_detected?: number;
  orders_placed?: number;
  prices_stale?: boolean;
  oldest_kalshi_price_age_sec?: number;
  oldest_poly_price_age_sec?: number;
}

// --- Market Browser ---

export interface MarketSnapshot {
  ticker: string;
  event_ticker: string;
  title: string;
  venue: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  volume: number | null;
  liquidity: number | null;
  snapshot_ts: string;
}

// --- Manual Orders ---

export interface ManualOrderRequest {
  venue: string;
  ticker: string;
  side: "yes" | "no";
  quantity: number;
  price_cents: number;
}

export interface ManualOrderResult {
  success: boolean;
  order_id: string;
  error: string;
  filled_price?: number;
  filled_quantity?: number;
}

// --- Activity Timeline ---

export type TimelineItem =
  | { kind: "signal"; data: Signal; ts: string }
  | { kind: "decision"; data: Decision; ts: string }
  | { kind: "order"; data: Order; ts: string }
  | { kind: "fill"; data: Fill; ts: string }
  | { kind: "position"; data: Position; ts: string };
