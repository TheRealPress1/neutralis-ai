/* Typed fetch client for the FastAPI dashboard endpoints. */

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

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, API_BASE);
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

async function apiPost<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(path, API_BASE);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// --- Portfolio ---

export function fetchPortfolioStats() {
  return apiFetch<PortfolioStats>("/api/portfolio/stats");
}

export function fetchPositions(status: "open" | "closed", limit = 50) {
  return apiFetch<Position[]>("/api/positions", {
    status,
    limit: String(limit),
  });
}

// --- Activity (signals + decisions) ---

export function fetchSignals(limit = 20) {
  return apiFetch<Signal[]>("/api/signals", { limit: String(limit) });
}

export function fetchDecisions(limit = 20) {
  return apiFetch<Decision[]>("/api/decisions", { limit: String(limit) });
}

// --- Matches ---

export function fetchMatches(limit = 25) {
  return apiFetch<MarketMatch[]>("/api/matches", { limit: String(limit) });
}

// --- Risk Profiles ---

export function fetchProfiles() {
  return apiFetch<RiskProfile[]>("/api/profiles");
}

export function fetchActiveProfile() {
  return apiFetch<RiskProfile>("/api/profiles/active");
}

export async function updateProfile(
  profileId: number,
  updates: Partial<
    Omit<RiskProfile, "id" | "is_active" | "user_id" | "created_at" | "updated_at">
  >,
): Promise<RiskProfile> {
  const url = new URL(`/api/profiles/${profileId}`, API_BASE);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<RiskProfile>;
}

export async function activateProfile(
  profileId: number,
): Promise<RiskProfile> {
  const url = new URL(`/api/profiles/${profileId}/activate`, API_BASE);
  const res = await fetch(url.toString(), { method: "PUT" });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<RiskProfile>;
}

// --- Arb Signals ---

export function fetchArbSignals(limit = 50, offset = 0) {
  return apiFetch<ArbSignal[]>("/api/arb-signals", {
    limit: String(limit),
    offset: String(offset),
  });
}

// --- Execution ---

export function fetchOrders(limit = 50, status?: string) {
  const params: Record<string, string> = { limit: String(limit) };
  if (status) params.status = status;
  return apiFetch<Order[]>("/api/orders", params);
}

export function fetchFills(limit = 50) {
  return apiFetch<Fill[]>("/api/fills", { limit: String(limit) });
}

export function fetchFillsForOrder(orderId: string) {
  return apiFetch<Fill[]>(`/api/orders/${orderId}/fills`);
}

export function fetchExecutionStats() {
  return apiFetch<ExecutionStats>("/api/execution/stats");
}

// --- Backtest ---

export function fetchBacktestDataRange() {
  return apiFetch<BacktestDataRange>("/api/backtest/data-range");
}

export function runBacktest(config: Record<string, unknown>) {
  return apiPost<BacktestResult>("/api/backtest/run", config);
}

export function runOptimization(config: Record<string, unknown>) {
  return apiPost<{ results: OptimizerResult[]; completed: number; total_combos: number }>("/api/backtest/optimize", config);
}

// --- Decision Reasons ---

export function fetchDecisionReasons(decisionId: number) {
  return apiFetch<DecisionReasons>(`/api/decisions/${decisionId}/reasons`);
}

// --- Analytics ---

export function fetchAnalyticsSummary() {
  return apiFetch<AnalyticsSummary>("/api/analytics/summary");
}

export function fetchPnLTimeline(days = 30) {
  return apiFetch<DailyPnL[]>("/api/analytics/pnl-timeline", { days: String(days) });
}

export function fetchBreakdown() {
  return apiFetch<{ by_category: CategoryBreakdown[]; by_venue: VenueBreakdown[]; pnl_distribution: PnLBucket[] }>("/api/analytics/breakdown");
}

export function fetchGuardStats() {
  return apiFetch<GuardStat[]>("/api/analytics/guard-stats");
}

// --- Enriched Signals & Regime ---

export function fetchEnrichedSignals(limit = 50, filters?: Record<string, string | number>) {
  const raw: Record<string, string | number> = { limit, ...filters };
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) params[k] = String(v);
  return apiFetch<EnrichedSignal[]>("/api/signals/enriched", params);
}

export function fetchCurrentRegime() {
  return apiFetch<RegimeState>("/api/regime/current");
}

// --- Automation / Kill Switch ---

export function fetchAutomationState() {
  return apiFetch<AutomationState>("/api/automation/state");
}

export function startAutomation() {
  return apiPost<AutomationState>("/api/automation/start");
}

export function pauseAutomation() {
  return apiPost<AutomationState>("/api/automation/pause");
}

export function triggerKillSwitch(reason = "Manual kill switch") {
  return apiPost<AutomationState>("/api/automation/kill", { reason });
}

// --- Audit Logs / Activity ---

export function fetchAuditLogs(
  params?: { event_type?: string; entity_type?: string; limit?: number },
) {
  const queryParams: Record<string, string> = {};
  if (params?.event_type) queryParams.event_type = params.event_type;
  if (params?.entity_type) queryParams.entity_type = params.entity_type;
  if (params?.limit) queryParams.limit = String(params.limit);
  return apiFetch<AuditLogEntry[]>("/api/activity", queryParams);
}

// --- Exports ---

export function getTradesCsvUrl(limit = 500) {
  return `${API_BASE}/api/exports/trades.csv?limit=${limit}`;
}
