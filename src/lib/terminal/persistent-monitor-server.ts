import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { TradingError } from "./trading-core";
import { opportunityProvider } from "./opportunities";
import { MONITOR_BATCH_SIZE, MonitorError, defaultLabel, normalizeAlert, normalizeMonitor, object, observeOpportunity, readKalshiMonitorQuote, validateCreateMonitor, validateMonitorId, validateObservation, validateUpdateMonitor, validateVersion, workerHealth } from "./persistent-monitor-core";
import type { MonitorListResponse, MonitorObservation, MonitorTarget } from "./persistent-monitor-types";

interface StorageResult<T> { data: T | null; error: unknown }
interface MonitorQuery extends PromiseLike<StorageResult<unknown[]>> {
  select(columns: string): MonitorQuery;
  eq(column: string, value: unknown): MonitorQuery;
  order(column: string, options: { ascending: boolean }): MonitorQuery;
  limit(count: number): MonitorQuery;
  maybeSingle(): PromiseLike<StorageResult<unknown>>;
}
/** Narrow PostgREST boundary, separately typed from the application's legacy schema. */
export interface MonitorClient {
  from(table: string): MonitorQuery;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<StorageResult<unknown>>;
}
interface MonitorContext { userId: string; client: MonitorClient }
const MONITOR_FIELDS = "id,target,label,direction,threshold,state,version,arm_version,created_at,updated_at,next_check_at,last_checked_at,last_check_status,last_value,last_observed_at,last_error,triggered_at";
const ALERT_FIELDS = "id,monitor_id,arm_version,target,label,direction,threshold,observed_value,observed_at,created_at";
function secret() { const value = process.env.TERMINAL_MONITOR_WORKER_SECRET; return value && value.length >= 32 && value.length <= 512 && !/\s/.test(value) ? value : null; }
export function monitorWorkerConfigured() { return Boolean(secret() && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
function requireConfigured() {
  if (!monitorWorkerConfigured()) throw new MonitorError("monitor_worker_not_configured", "Persistent checking is not configured on this deployment. No monitor was saved.", 503);
}
export function requireMonitorWorker(request: Request) {
  requireConfigured();
  const expected = Buffer.from(`Bearer ${secret()}`), supplied = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new MonitorError("not_authorized", "Worker authentication is required.", 401);
}
function storageError(error: unknown): never {
  const row = error && typeof error === "object" ? error as { message?: string; code?: string } : {};
  const message = row.message ?? "";
  const mappings: [string, string, string, number][] = [
    ["MONITOR_UNAUTHENTICATED", "not_authenticated", "Sign in to manage your saved monitors.", 401],
    ["MONITOR_NOT_FOUND", "monitor_not_found", "This monitor was not found in your account.", 404],
    ["MONITOR_QUOTA", "monitor_quota", "You can save up to 25 monitors. Delete one before adding another.", 409],
    ["MONITOR_VERSION_CONFLICT", "monitor_changed", "This monitor changed. Refresh before trying again.", 409],
    ["MONITOR_STATE_CONFLICT", "monitor_state_changed", "This action is not available in the monitor's current state. Refresh and try again.", 409],
    ["MONITOR_INVALID", "invalid_monitor", "The monitor request is invalid.", 400],
  ];
  const mapped = mappings.find(([prefix]) => message.includes(prefix));
  if (mapped) throw new MonitorError(mapped[1], mapped[2], mapped[3]);
  throw new MonitorError("monitor_storage_unavailable", "Saved monitoring storage is unavailable. The terminal monitor migration and database connection must be ready.", 503);
}
export async function monitorContext(mutation = false): Promise<MonitorContext> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new MonitorError("not_authenticated", "Sign in to manage your saved monitors.", 401);
  if (!rateLimit(`terminal-monitor:${mutation ? "write" : "read"}:${user.id}`, { limit: mutation ? 30 : 90, windowMs: 60_000 }).success) throw new MonitorError("rate_limited", "Too many requests. Try again shortly.", 429);
  // These new RPCs/tables have their own migration; no exchange credential table is accessed.
  return { userId: user.id, client: client as unknown as MonitorClient };
}
async function rpc(client: MonitorClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) storageError(error);
  return data as unknown;
}
export async function listPersistentMonitors(context: MonitorContext): Promise<MonitorListResponse> {
  const [monitors, alerts, health] = await Promise.all([
    context.client.from("terminal_monitors").select(MONITOR_FIELDS).eq("user_id", context.userId).order("created_at", { ascending: false }).limit(25),
    context.client.from("terminal_monitor_alerts").select(ALERT_FIELDS).eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100),
    context.client.from("terminal_monitor_worker").select("completed_at,checked_count,failure_count").eq("singleton", true).maybeSingle(),
  ]);
  for (const result of [monitors, alerts, health]) if (result.error) storageError(result.error);
  if (!health.data || !Array.isArray(monitors.data) || !Array.isArray(alerts.data)) storageError(null);
  return { monitors: monitors.data.map(normalizeMonitor), alerts: alerts.data.map(normalizeAlert), workerHealth: workerHealth(monitorWorkerConfigured(), health.data), fetchedAt: new Date().toISOString() };
}
export async function createPersistentMonitor(context: MonitorContext, body: unknown) {
  requireConfigured();
  const input = validateCreateMonitor(body);
  // Candidate identities are resolved through the public read provider. This never
  // reads account keys, creates orders, or treats match confidence as settlement proof.
  const target = input.target;
  if (target.kind === "opportunity") {
    const candidate = await opportunityProvider.getOpportunity(target.candidateId);
    if (!candidate || !candidate.pairs.some((pair: { direction: string }) => pair.direction === target.pairDirection)) throw new MonitorError("pair_unavailable", "This exact comparison pair is not currently available. Refresh the opportunities list.", 409);
  }
  const row = await rpc(context.client, "terminal_monitor_create", { p_target: input.target, p_label: input.label ?? defaultLabel(input.target).slice(0, 160), p_direction: input.direction, p_threshold: input.threshold });
  return { monitor: normalizeMonitor(row) };
}
export async function updatePersistentMonitor(context: MonitorContext, id: string, body: unknown) {
  validateMonitorId(id); const input = validateUpdateMonitor(body);
  if (input.action !== "pause") requireConfigured();
  const row = await rpc(context.client, "terminal_monitor_update", { p_id: id, p_version: input.version, p_action: input.action });
  return { monitor: normalizeMonitor(row) };
}
export async function deletePersistentMonitor(context: MonitorContext, id: string, version: unknown) {
  validateMonitorId(id); validateVersion(version);
  await rpc(context.client, "terminal_monitor_delete", { p_id: id, p_version: version });
}

export interface MonitorWorkerDependencies {
  readMarket: (ticker: string) => Promise<MonitorObservation>;
  readOpportunity: (target: Extract<MonitorTarget, { kind: "opportunity" }>) => Promise<MonitorObservation>;
  now: () => number;
}
const workerDependencies: MonitorWorkerDependencies = {
  readMarket: readKalshiMonitorQuote,
  readOpportunity: async (target) => observeOpportunity(target, await opportunityProvider.getOpportunity(target.candidateId)),
  now: Date.now,
};
/** One finite batch. SQL owns claim/lease/version checks and atomic alert deduplication. */
export async function runMonitorWorker(client: MonitorClient, dependencies: MonitorWorkerDependencies = workerDependencies) {
  const started = dependencies.now();
  const claimed = object(await rpc(client, "terminal_monitor_claim_batch", { p_limit: MONITOR_BATCH_SIZE }));
  if (claimed.busy === true) return { status: "busy", checked: 0, failed: 0, triggered: 0 };
  if (typeof claimed.runId !== "string" || !Array.isArray(claimed.jobs) || claimed.jobs.length > MONITOR_BATCH_SIZE) storageError(null);
  const jobs = claimed.jobs as unknown[];
  let checked = 0, failed = 0, triggered = 0;
  // Five concurrent checks, at most two waves / forty public requests for ten pairs.
  for (let offset = 0; offset < jobs.length; offset += 5) {
    await Promise.all(jobs.slice(offset, offset + 5).map(async (value) => {
      let row: Record<string, unknown>;
      try { row = object(value); } catch { failed++; return; }
      try {
        const monitor = normalizeMonitor(row);
        const observation = dependencies.now() - started > 40_000
          ? { status: "unavailable" as const, value: null, observedAt: null, error: null }
          : await (monitor.target.kind === "market" ? dependencies.readMarket(monitor.target.ticker) : dependencies.readOpportunity(monitor.target));
        const accepted = validateObservation(observation, monitor.target, dependencies.now());
        const result = object(await rpc(client, "terminal_monitor_complete", { p_id: monitor.id, p_version: monitor.version, p_lease_token: row.lease_token, p_status: accepted.status, p_value: accepted.value, p_observed_at: accepted.observedAt }));
        if (result.applied === true) {
          checked++;
          if (accepted.status !== "ok") failed++;
          if (result.triggered === true) triggered++;
        }
      } catch { failed++; /* Claim expires; no blind completion or alert retry. */ }
    }));
  }
  const finished = await rpc(client, "terminal_monitor_finish_run", { p_run_id: claimed.runId, p_checked: checked, p_failed: failed });
  if (finished !== true) throw new MonitorError("monitor_run_expired", "Worker run lost its lease. A fresh completed heartbeat was not recorded.", 503);
  return { status: "completed", checked, failed, triggered, completedAt: new Date(dependencies.now()).toISOString() };
}
export async function executeMonitorWorker() {
  requireConfigured();
  const client = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return runMonitorWorker(client as unknown as MonitorClient);
}
export function monitorJson(value: unknown, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); }
export function monitorErrorResponse(error: unknown) {
  if (error instanceof MonitorError || error instanceof TradingError) return monitorJson({ code: error.code, error: error.message }, error.status);
  return monitorJson({ code: "monitor_unavailable", error: "Saved monitoring is temporarily unavailable. Existing monitors have not been replaced." }, 503);
}
