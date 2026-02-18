/* Typed fetch client for the dashboard API route (/api/dashboard). */

import type {
  PortfolioStats,
  Position,
  Signal,
  Decision,
  MarketMatch,
  RiskProfile,
  AutomationState,
  AuditLogEntry,
  ArbSignal,
  Order,
  Fill,
  ExecutionStats,
  BacktestResult,
  BacktestDataRange,
  OptimizerResult,
  DecisionReasons,
  AnalyticsSummary,
  DailyPnL,
  CategoryBreakdown,
  VenueBreakdown,
  PnLBucket,
  GuardStat,
  EnrichedSignal,
  RegimeState,
} from "@/types/api";

function apiBase() {
  return typeof window !== "undefined" ? window.location.origin : "";
}

async function dashFetch<T>(
  type: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL("/api/dashboard", apiBase());
  url.searchParams.set("type", type);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// --- Portfolio ---

export function fetchPortfolioStats() {
  return dashFetch<PortfolioStats>("stats");
}

export function fetchPositions(status: "open" | "closed", limit = 50) {
  return dashFetch<Position[]>("positions", {
    status,
    limit: String(limit),
  });
}

// --- Activity (signals + decisions) ---

export function fetchSignals(limit = 20) {
  return dashFetch<Signal[]>("signals", { limit: String(limit) });
}

export function fetchDecisions(limit = 20) {
  return dashFetch<Decision[]>("decisions", { limit: String(limit) });
}

// --- Matches ---

export function fetchMatches(limit = 25) {
  return dashFetch<MarketMatch[]>("matches", { limit: String(limit) });
}

// --- Risk Profiles ---

export function fetchProfiles() {
  return dashFetch<RiskProfile[]>("profiles");
}

export function fetchActiveProfile() {
  return dashFetch<RiskProfile>("active-profile");
}

export async function updateProfile(
  profileId: number,
  updates: Partial<
    Omit<RiskProfile, "id" | "is_active" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<RiskProfile> {
  // This is now handled by server actions — see dashboard.ts
  // Keep this stub for backward compatibility but it won't be called
  throw new Error("Use server action updateRiskProfile() instead");
}

export async function activateProfile(
  profileId: number,
): Promise<RiskProfile> {
  throw new Error("Use server action instead");
}

// --- Arb Signals ---

export function fetchArbSignals(limit = 50, offset = 0) {
  return dashFetch<ArbSignal[]>("arb-signals", {
    limit: String(limit),
  });
}

// --- Execution ---

export function fetchOrders(limit = 50, status?: string) {
  const params: Record<string, string> = { limit: String(limit) };
  if (status) params.status = status;
  return dashFetch<Order[]>("orders", params);
}

export function fetchFills(limit = 50) {
  return dashFetch<Fill[]>("fills", { limit: String(limit) });
}

export function fetchFillsForOrder(orderId: string) {
  return dashFetch<Fill[]>("fills", { order_id: orderId });
}

export function fetchExecutionStats() {
  return dashFetch<ExecutionStats>("execution-stats");
}

// --- Backtest ---
// These require the Python engine — they will fail gracefully in production.

const PYTHON_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function fetchBacktestDataRange() {
  return fetch(new URL("/api/backtest/data-range", PYTHON_API_BASE).toString())
    .then((r) => { if (!r.ok) throw new Error("Backtest engine offline"); return r.json() as Promise<BacktestDataRange>; });
}

export function runBacktest(config: Record<string, unknown>) {
  return fetch(new URL("/api/backtest/run", PYTHON_API_BASE).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  }).then((r) => { if (!r.ok) throw new Error("Backtest engine offline"); return r.json() as Promise<BacktestResult>; });
}

export function runOptimization(config: Record<string, unknown>) {
  return fetch(new URL("/api/backtest/optimize", PYTHON_API_BASE).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  }).then((r) => { if (!r.ok) throw new Error("Backtest engine offline"); return r.json() as Promise<{ results: OptimizerResult[]; completed: number; total_combos: number }>; });
}

// --- Decision Reasons ---

export function fetchDecisionReasons(decisionId: number) {
  return dashFetch<DecisionReasons>("decision-reasons", { id: String(decisionId) });
}

// --- Analytics ---

export function fetchAnalyticsSummary() {
  return dashFetch<AnalyticsSummary>("analytics-summary");
}

export function fetchPnLTimeline(days = 30) {
  return dashFetch<DailyPnL[]>("pnl-timeline", { days: String(days) });
}

export function fetchBreakdown() {
  return dashFetch<{ by_category: CategoryBreakdown[]; by_venue: VenueBreakdown[]; pnl_distribution: PnLBucket[] }>("breakdown");
}

export function fetchGuardStats() {
  return dashFetch<GuardStat[]>("guard-stats");
}

// --- Enriched Signals & Regime ---

export function fetchEnrichedSignals(limit = 50, filters?: Record<string, string | number>) {
  const raw: Record<string, string | number> = { limit, ...filters };
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) params[k] = String(v);
  return dashFetch<EnrichedSignal[]>("enriched-signals", params);
}

export function fetchCurrentRegime() {
  return dashFetch<RegimeState>("regime");
}

// --- Automation / Kill Switch ---

export function fetchAutomationState() {
  return dashFetch<AutomationState>("automation-state");
}

// Start/pause/kill are now server actions (src/app/actions/dashboard.ts)
// These stubs are kept for type compatibility but should not be called from components.

export function startAutomation(): Promise<AutomationState> {
  throw new Error("Use server action setAutomationStatus('start') instead");
}

export function pauseAutomation(): Promise<AutomationState> {
  throw new Error("Use server action setAutomationStatus('pause') instead");
}

export function triggerKillSwitch(reason = "Manual kill switch"): Promise<AutomationState> {
  throw new Error("Use server action setAutomationStatus('kill', reason) instead");
}

// --- Audit Logs / Activity ---

export async function fetchAuditLogs(
  params?: { event_type?: string; entity_type?: string; limit?: number },
): Promise<AuditLogEntry[]> {
  const url = new URL("/api/activity", apiBase());
  if (params?.event_type) url.searchParams.set("event_type", params.event_type);
  if (params?.entity_type) url.searchParams.set("entity_type", params.entity_type);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Activity ${res.status}: ${res.statusText}`);
  return res.json() as Promise<AuditLogEntry[]>;
}
