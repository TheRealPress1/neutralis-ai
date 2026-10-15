import type { CreateMonitorRequest, MonitorAlert, MonitorObservation, MonitorTarget, MonitorWorkerHealth, PersistentMonitor, UpdateMonitorRequest } from "./persistent-monitor-types";

export const MONITOR_QUOTA = 25;
export const MONITOR_FRESHNESS_MS = 45_000;
export const MONITOR_WORKER_STALE_MS = 180_000;
export const MONITOR_BATCH_SIZE = 10;
export class MonitorError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.name = "MonitorError"; this.code = code; this.status = status; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MonitorError("invalid_request", "A JSON object is required.");
  return value as Record<string, unknown>;
}
function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new MonitorError("invalid_request", "Unsupported monitor fields.");
}
export function validateTarget(value: unknown): MonitorTarget {
  const target = object(value);
  if (target.kind === "market") {
    onlyKeys(target, ["kind", "ticker"]);
    if (typeof target.ticker !== "string" || !/^[A-Z0-9][A-Z0-9.-]{0,119}$/.test(target.ticker)) throw new MonitorError("invalid_target", "Use the exact Kalshi market ticker.");
    return { kind: "market", ticker: target.ticker };
  }
  if (target.kind === "opportunity") {
    onlyKeys(target, ["kind", "candidateId", "pairDirection"]);
    if (typeof target.candidateId !== "string" || !/^v1~[A-Z0-9][A-Z0-9.-]{0,119}~[a-z0-9][a-z0-9_-]{0,199}$/.test(target.candidateId) || !["kalshi_yes_polymarket_no", "polymarket_yes_kalshi_no"].includes(String(target.pairDirection))) throw new MonitorError("invalid_target", "Select an exact supported pair and direction.");
    return { kind: "opportunity", candidateId: target.candidateId, pairDirection: target.pairDirection as "kalshi_yes_polymarket_no" | "polymarket_yes_kalshi_no" };
  }
  throw new MonitorError("invalid_target", "Choose a market or a supported opportunity pair.");
}
export function validateCreateMonitor(value: unknown): CreateMonitorRequest {
  const input = object(value); onlyKeys(input, ["target", "direction", "threshold", "label"]);
  const target = validateTarget(input.target);
  if (input.direction !== "above" && input.direction !== "below") throw new MonitorError("invalid_direction", "Choose above or below.");
  const threshold = input.threshold;
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < (target.kind === "market" ? 0 : -1) || threshold > 1 || Math.abs(threshold * 10_000 - Math.round(threshold * 10_000)) > 1e-7) throw new MonitorError("invalid_threshold", "Use a finite dollar threshold with at most four decimal places.");
  if (input.label !== undefined && (typeof input.label !== "string" || !input.label.trim() || input.label.length > 160 || /[\u0000-\u001f\u007f]/.test(input.label))) throw new MonitorError("invalid_label", "Use a label of 1–160 printable characters.");
  return { target, direction: input.direction, threshold, ...(typeof input.label === "string" ? { label: input.label.trim() } : {}) };
}
export function validateVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 2_147_483_646) throw new MonitorError("invalid_version", "Refresh this monitor before changing it.");
  return value;
}
export function validateUpdateMonitor(value: unknown): UpdateMonitorRequest {
  const input = object(value); onlyKeys(input, ["action", "version"]);
  if (input.action !== "pause" && input.action !== "resume" && input.action !== "rearm") throw new MonitorError("invalid_action", "Choose pause, resume or rearm.");
  return { action: input.action, version: validateVersion(input.version) };
}
export function validateMonitorId(id: string) {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id)) throw new MonitorError("invalid_id", "Invalid monitor ID.");
  return id;
}
export function finiteValue(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value))) return null;
  const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null;
}
export function validateObservation(observation: MonitorObservation, target: MonitorTarget, now = Date.now()): MonitorObservation {
  if (observation.status !== "ok") return { status: observation.status === "closed" ? "closed" : "unavailable", value: null, observedAt: null, error: observation.status === "closed" ? "Market is closed; no alert was triggered." : "Fresh public quote unavailable; no alert was triggered." };
  const timestamp = observation.observedAt ? Date.parse(observation.observedAt) : NaN;
  if (observation.value === null || !Number.isFinite(observation.value) || observation.value < (target.kind === "market" ? 0 : -1) || observation.value > 1 || !Number.isFinite(timestamp) || now - timestamp > MONITOR_FRESHNESS_MS || timestamp > now + 5_000) return { status: "unavailable", value: null, observedAt: null, error: "Fresh public quote unavailable; no alert was triggered." };
  return { status: "ok", value: observation.value, observedAt: new Date(timestamp).toISOString(), error: null };
}
export function conditionMet(direction: "above" | "below", threshold: number, observation: MonitorObservation) {
  return observation.status === "ok" && observation.value !== null && (direction === "above" ? observation.value >= threshold : observation.value <= threshold);
}
export function defaultLabel(target: MonitorTarget) { return target.kind === "market" ? `${target.ticker} · YES last trade` : `${target.candidateId} · ${target.pairDirection === "kalshi_yes_polymarket_no" ? "Kalshi YES + Polymarket NO" : "Kalshi NO + Polymarket YES"}`; }
export function alertDisclaimer(target: MonitorTarget) { return target.kind === "market" ? "Observed Kalshi YES last-trade price. No order was placed." : "Gross spread before fees and slippage. Settlement equivalence is unverified. No order was placed."; }

export function normalizeMonitor(value: unknown): PersistentMonitor {
  const row = object(value);
  return { id: String(row.id), target: validateTarget(row.target), label: String(row.label), direction: row.direction as PersistentMonitor["direction"], threshold: Number(row.threshold), state: row.state as PersistentMonitor["state"], version: Number(row.version), armVersion: Number(row.arm_version), createdAt: String(row.created_at), updatedAt: String(row.updated_at), nextCheckAt: String(row.next_check_at), lastCheckedAt: typeof row.last_checked_at === "string" ? row.last_checked_at : null, lastCheckStatus: row.last_check_status as PersistentMonitor["lastCheckStatus"], lastValue: finiteValue(row.last_value), lastObservedAt: typeof row.last_observed_at === "string" ? row.last_observed_at : null, lastError: typeof row.last_error === "string" ? row.last_error : null, triggeredAt: typeof row.triggered_at === "string" ? row.triggered_at : null };
}
export function normalizeAlert(value: unknown): MonitorAlert {
  const row = object(value), target = validateTarget(row.target);
  return { id: String(row.id), monitorId: String(row.monitor_id), armVersion: Number(row.arm_version), label: String(row.label), target, direction: row.direction as MonitorAlert["direction"], threshold: Number(row.threshold), observedValue: Number(row.observed_value), observedAt: String(row.observed_at), createdAt: String(row.created_at), disclaimer: alertDisclaimer(target) };
}
export function workerHealth(configured: boolean, value: unknown, now = Date.now()): MonitorWorkerHealth {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const completed = typeof row.completed_at === "string" && Number.isFinite(Date.parse(row.completed_at)) ? row.completed_at : null;
  const checked = finiteValue(row.checked_count) ?? 0, failures = finiteValue(row.failure_count) ?? 0;
  const status = !configured ? "not_configured" : !completed ? "never_run" : (now - Date.parse(completed) > MONITOR_WORKER_STALE_MS || Date.parse(completed) > now + 5_000) ? "stale" : failures > 0 ? "degraded" : "healthy";
  const messages = { not_configured: "Persistent checking is not configured on this deployment.", never_run: "Configured, but no completed worker run has been recorded.", stale: "The last completed worker run is delayed. Saved monitors remain in place.", degraded: "The last worker run completed with unavailable quotes or failed checks.", healthy: "A worker run completed recently. Each monitor shows its own latest observation." };
  return { configured, status, lastCompletedAt: completed, lastCheckedCount: checked, lastFailureCount: failures, message: messages[status] };
}

/** One public request, no cache/credentials/retries. Timestamp denotes a successful quote check. */
export async function readKalshiMonitorQuote(ticker: string, fetcher: typeof fetch = fetch, now: () => number = Date.now): Promise<MonitorObservation> {
  try {
    const response = await fetcher(`https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}`, { cache: "no-store", redirect: "error", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error("Quote unavailable");
    const body = object(await response.json()), market = object(body.market);
    if (market.ticker !== ticker || market.market_type !== "binary") throw new Error("Mismatched market");
    const close = typeof market.close_time === "string" ? Date.parse(market.close_time) : NaN;
    if (market.status !== "active" || market.result || Number.isFinite(close) && close <= now()) return { status: "closed", value: null, observedAt: null, error: null };
    // The provider uses zero as a placeholder before the first trade. Require
    // positive lifetime volume; 24h volume alone cannot prove an older trade.
    const volume = finiteValue(market.volume_fp);
    if (volume === null || volume <= 0) throw new Error("No demonstrated trade history");
    const price = finiteValue(market.last_price_dollars);
    return validateObservation({ status: "ok", value: price, observedAt: new Date(now()).toISOString(), error: null }, { kind: "market", ticker }, now());
  } catch { return { status: "unavailable", value: null, observedAt: null, error: "Fresh public quote unavailable; no alert was triggered." }; }
}

/** Structural read port: the public opportunity provider supplies this, never account data. */
export interface MonitorOpportunity {
  id: string;
  kalshi: { book: { status: string; fetchedAt: string | null; exchangeTimestamp: string | null } };
  polymarketUS: { book: { status: string; fetchedAt: string | null; exchangeTimestamp: string | null } };
  pairs: { direction: string; grossSpread: number | null; availableSize: number | null; status: string }[];
}
export function observeOpportunity(target: Extract<MonitorTarget, { kind: "opportunity" }>, row: MonitorOpportunity | null, now = Date.now()): MonitorObservation {
  const unavailable: MonitorObservation = { status: "unavailable", value: null, observedAt: null, error: "Fresh pair quotes unavailable; no alert was triggered." };
  if (!row || row.id !== target.candidateId) return unavailable;
  const pair = row.pairs.find((item) => item.direction === target.pairDirection);
  if (!pair || pair.status !== "live" || pair.availableSize === null || !Number.isFinite(pair.availableSize) || pair.availableSize <= 0) return unavailable;
  const books = [row.kalshi.book, row.polymarketUS.book];
  const checked = books.map((book) => book.fetchedAt ? Date.parse(book.fetchedAt) : NaN);
  if (books.some((book, index) => book.status !== "live" || !Number.isFinite(checked[index]) || now - checked[index] > MONITOR_FRESHNESS_MS || checked[index] > now + 5_000)) return unavailable;
  // An explicit book timestamp can reveal old upstream data even after a new read.
  if (books.some((book) => book.exchangeTimestamp !== null && (!Number.isFinite(Date.parse(book.exchangeTimestamp)) || now - Date.parse(book.exchangeTimestamp) > MONITOR_FRESHNESS_MS || Date.parse(book.exchangeTimestamp) > now + 5_000))) return unavailable;
  return validateObservation({ status: "ok", value: pair.grossSpread, observedAt: new Date(Math.min(...checked)).toISOString(), error: null }, target, now);
}
