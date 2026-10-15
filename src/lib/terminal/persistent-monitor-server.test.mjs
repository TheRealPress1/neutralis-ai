import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { timingSafeEqual } from "node:crypto";
import ts from "typescript";
import * as core from "./persistent-monitor-core.ts";
import * as requestCore from "./trading-core.ts";

const now = Date.parse("2026-10-15T12:00:00Z");
const id = "10000000-0000-4000-8000-000000000001";
const lease = "20000000-0000-4000-8000-000000000001";
const runId = "30000000-0000-4000-8000-000000000001";
const input = { target: { kind: "market", ticker: "KXTEST-26-YES" }, direction: "above", threshold: .6 };
function monitor(changes = {}) {
  return { id, user_id: "user-a", ...input, label: "Test", state: "watching", version: 3, arm_version: 2,
    created_at: new Date(now - 1000).toISOString(), updated_at: new Date(now).toISOString(), next_check_at: new Date(now).toISOString(), last_checked_at: null,
    last_check_status: "never", last_value: null, last_observed_at: null, last_error: null, triggered_at: null, lease_token: lease, ...changes };
}
const compiled = new Map();
function load(relative, dependencies, env) {
  const file = new URL(relative, import.meta.url);
  if (!compiled.has(file.href)) compiled.set(file.href, ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  const result = { exports: {} };
  runInNewContext(compiled.get(file.href), { module: result, exports: result.exports, Buffer, Date, Response, Request, URL,
    process: { env }, fetch: () => { throw new Error("Network denied"); }, require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name];
    } }, { filename: file.pathname });
  return result.exports;
}
function harness(options = {}) {
  const state = { user: "user-a", rpcCalls: [], reads: [], authCalls: 0, serviceCalls: 0, candidateCalls: [], jobs: [], completed: [], readQuotes: [], ...options };
  const env = { TERMINAL_MONITOR_WORKER_SECRET: "s".repeat(40), NEXT_PUBLIC_SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-service", ...options.env };
  const client = {
    auth: { getUser: async () => { state.authCalls++; return { data: { user: state.user ? { id: state.user } : null }, error: null }; } },
    from: (table) => {
      const query = { table, filters: [] }; state.reads.push(query);
      const value = () => ({ data: table === "terminal_monitors" ? [monitor()] : table === "terminal_monitor_alerts" ? [] : { completed_at: null, checked_count: 0, failure_count: 0 }, error: state.missingMigration ? { code: "42P01" } : null });
      const builder = { select: () => builder, eq: (key, value) => { query.filters.push([key, value]); return builder; }, order: () => builder, limit: () => builder, maybeSingle: async () => value(), then: (resolve, reject) => Promise.resolve(value()).then(resolve, reject) }; return builder;
    },
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args });
      if (state.missingMigration) return { data: null, error: { code: "PGRST202", message: "missing function private database details" } };
      if (state.rpcError) return { data: null, error: { message: state.rpcError } };
      if (name === "terminal_monitor_create") return { data: monitor({ target: args.p_target, label: args.p_label, threshold: args.p_threshold, direction: args.p_direction }), error: null };
      if (name === "terminal_monitor_update") return { data: monitor({ state: "paused", version: 4 }), error: null };
      if (name === "terminal_monitor_delete") return { data: true, error: null };
      if (name === "terminal_monitor_claim_batch") return { data: { busy: Boolean(state.busy), runId, jobs: state.jobs }, error: null };
      if (name === "terminal_monitor_complete") {
        state.completed.push(args);
        return { data: { applied: !state.fenced, triggered: !state.fenced && args.p_status === "ok" && args.p_value >= .6 }, error: null };
      }
      if (name === "terminal_monitor_finish_run") return { data: !state.finishExpired, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  const api = load("./persistent-monitor-server.ts", {
    "server-only": {}, "node:crypto": { timingSafeEqual }, "@supabase/supabase-js": { createClient: () => { state.serviceCalls++; return client; } },
    "@/lib/supabase/server": { createClient: async () => client }, "@/lib/rate-limit": { rateLimit: () => ({ success: !state.rateLimited }) },
    "./trading-core": requestCore, "./persistent-monitor-core": core,
    "./opportunities": { opportunityProvider: { getOpportunity: async (candidateId) => { state.candidateCalls.push(candidateId); return state.candidate ?? null; } } },
  }, env);
  const dependencies = { now: () => now, readMarket: async (ticker) => { state.readQuotes.push(ticker); if (state.quoteFailure) throw new Error("No quote"); return state.observation ?? { status: "ok", value: .7, observedAt: new Date(now).toISOString(), error: null }; }, readOpportunity: async (target) => { state.readQuotes.push(target); return state.observation ?? { status: "unavailable", value: null, observedAt: null, error: null }; } };
  const route = (name) => load(name === "worker" ? "../../app/api/internal/terminal-monitors/route.ts" : `../../app/api/terminal/monitors/${name ? name + "/" : ""}route.ts`, { "@/lib/terminal/trading-core": requestCore, "@/lib/terminal/persistent-monitor-server": api }, env);
  return { api, state, env, client, dependencies, route };
}
function request(body = {}, origin = "https://neutralis.test", method = "POST", query = "") {
  return new Request(`https://neutralis.test/api/terminal/monitors${query}`, { method, headers: { origin, "content-type": "application/json" }, ...(method !== "DELETE" ? { body: JSON.stringify(body) } : {}) });
}
test("user mutations reject cross-origin before auth; unauthenticated users never read/write monitor storage", async () => {
  const h = harness({ user: null });
  assert.equal((await h.route("").POST(request(input, "https://evil.test"))).status, 403);
  assert.equal((await h.route("[id]").PATCH(request({}, "https://evil.test", "PATCH"), { params: Promise.resolve({ id }) })).status, 403);
  assert.equal((await h.route("[id]").DELETE(request({}, "https://evil.test", "DELETE"), { params: Promise.resolve({ id }) })).status, 403);
  assert.equal(h.state.authCalls, 0);
  assert.equal((await h.route("").GET()).status, 401);
  assert.equal(h.state.reads.length, 0); assert.equal(h.state.rpcCalls.length, 0);
});
test("list scopes every private table to authenticated user and reports configured-but-never-run honestly", async () => {
  const h = harness();
  const response = await h.route("").GET(); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(result.workerHealth.status, "never_run"); assert.equal(result.monitors.length, 1);
  assert.equal(result.monitors[0].lease_token, undefined); assert.equal(result.monitors[0].user_id, undefined);
  for (const query of h.state.reads.filter((read) => read.table !== "terminal_monitor_worker")) assert.deepEqual(query.filters, [["user_id", "user-a"]]);
  assert.equal(h.state.serviceCalls, 0);
});
test("creation requires configuration; existing rows and pause/delete remain usable without worker", async () => {
  const h = harness({ env: { TERMINAL_MONITOR_WORKER_SECRET: "" } });
  const list = await (await h.route("").GET()).json(); assert.equal(list.workerHealth.status, "not_configured"); assert.equal(list.monitors.length, 1);
  assert.equal((await h.route("").POST(request(input))).status, 503);
  const context = await h.api.monitorContext(true);
  assert.equal((await h.api.updatePersistentMonitor(context, id, { action: "pause", version: 3 })).monitor.state, "paused");
  await h.api.deletePersistentMonitor(context, id, 3);
  await assert.rejects(h.api.updatePersistentMonitor(context, id, { action: "resume", version: 3 }), { code: "monitor_worker_not_configured" });
});
test("CRUD delegates ownership and version to transactional session RPCs; forged user fields are rejected", async () => {
  const h = harness();
  const response = await h.route("").POST(request(input)); assert.equal(response.status, 201);
  const created = h.state.rpcCalls[0]; assert.equal(created.name, "terminal_monitor_create"); assert.equal(created.args.p_target.ticker, input.target.ticker); assert.equal(created.args.user_id, undefined);
  const forged = await h.route("").POST(request({ ...input, user_id: "user-b" })); assert.equal(forged.status, 400);
  const changed = await h.route("[id]").PATCH(request({ action: "pause", version: 3 }, "https://neutralis.test", "PATCH"), { params: Promise.resolve({ id }) }); assert.equal(changed.status, 200);
  assert.equal(h.state.rpcCalls.at(-1).args.p_version, 3);
  assert.equal((await h.route("[id]").DELETE(request({}, "https://neutralis.test", "DELETE", "?version=3"), { params: Promise.resolve({ id }) })).status, 204);
  assert.equal((await h.route("[id]").DELETE(request({}, "https://neutralis.test", "DELETE", "?version=NaN"), { params: Promise.resolve({ id }) })).status, 400);
  assert.equal(h.state.serviceCalls, 0);
});
test("missing migration, cross-user not-found, quota and version conflicts preserve typed failures", async () => {
  for (const [options, status, code] of [[{ missingMigration: true }, 503, "monitor_storage_unavailable"], [{ rpcError: "MONITOR_NOT_FOUND" }, 404, "monitor_not_found"], [{ rpcError: "MONITOR_QUOTA" }, 409, "monitor_quota"], [{ rpcError: "MONITOR_VERSION_CONFLICT" }, 409, "monitor_changed"]]) {
    const h = harness(options); const response = await h.route("").POST(request(input));
    assert.equal(response.status, status); const body = await response.json(); assert.equal(body.code, code); assert.doesNotMatch(body.error, /private database/);
  }
  const h = harness({ missingMigration: true }); assert.equal((await h.route("").GET()).status, 503);
});
test("worker bearer requires configured long secret; incorrect tokens cannot claim work or initialize service client", async () => {
  for (const authorization of [null, "Bearer wrong", "Bearer " + "s".repeat(39)]) {
    const h = harness();
    const response = await h.route("worker").POST(new Request("https://neutralis.test/api/internal/terminal-monitors", { method: "POST", headers: authorization ? { authorization } : {} }));
    assert.equal(response.status, 401); assert.equal(h.state.serviceCalls, 0); assert.equal(h.state.rpcCalls.length, 0);
  }
  const h = harness({ env: { TERMINAL_MONITOR_WORKER_SECRET: "short" } });
  assert.throws(() => h.api.requireMonitorWorker(new Request("https://neutralis.test")), { code: "monitor_worker_not_configured" });
});
test("bounded worker passes original claim/version to SQL; fenced completions do not become alerts", async () => {
  const h = harness({ jobs: [monitor()], fenced: true });
  const result = await h.api.runMonitorWorker(h.client, h.dependencies);
  assert.equal(result.status, "completed"); assert.equal(result.triggered, 0); assert.equal(result.checked, 0);
  assert.equal(h.state.completed[0].p_version, 3); assert.equal(h.state.completed[0].p_lease_token, lease);
  assert.equal(h.state.completed[0].p_id, id); assert.equal(h.state.completed[0].p_value, .7);
  assert.equal(h.state.rpcCalls.at(-1).name, "terminal_monitor_finish_run");
});
test("worker does not refresh stale observation timestamps or fabricate zero prices", async () => {
  const h = harness({ jobs: [monitor()], observation: { status: "ok", value: .9, observedAt: new Date(now - 90_000).toISOString(), error: null } });
  const result = await h.api.runMonitorWorker(h.client, h.dependencies);
  assert.equal(result.failed, 1); assert.equal(result.triggered, 0);
  assert.equal(h.state.completed[0].p_status, "unavailable"); assert.equal(h.state.completed[0].p_value, null); assert.equal(h.state.completed[0].p_observed_at, null);
});
test("worker claims at most ten, reads five concurrently, preserves pair direction and never starts a second batch", async () => {
  const target = { kind: "opportunity", candidateId: "v1~KXTEST-26-YES~test-game-yes", pairDirection: "polymarket_yes_kalshi_no" };
  const h = harness({ jobs: Array.from({ length: 10 }, (_, i) => monitor({ id: `${id.slice(0,-1)}${i}`, target: i === 9 ? target : input.target })) });
  let active = 0, peak = 0;
  h.dependencies.readMarket = async () => { active++; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 2)); active--; return { status: "ok", value: .5, observedAt: new Date(now).toISOString(), error: null }; };
  const result = await h.api.runMonitorWorker(h.client, h.dependencies);
  assert.equal(result.checked, 10); assert.ok(peak <= 5); assert.deepEqual(h.state.readQuotes[0], target);
  assert.equal(h.state.rpcCalls.filter((call) => call.name === "terminal_monitor_claim_batch").length, 1);
  assert.equal(h.state.rpcCalls[0].args.p_limit, 10);
});
test("busy worker and lost/expired final heartbeat do not claim completed health", async () => {
  const busy = harness({ busy: true, jobs: [monitor()] }); const result = await busy.api.runMonitorWorker(busy.client, busy.dependencies);
  assert.equal(result.status, "busy"); assert.equal(busy.state.readQuotes.length, 0); assert.equal(busy.state.rpcCalls.length, 1);
  const expired = harness({ finishExpired: true });
  await assert.rejects(expired.api.runMonitorWorker(expired.client, expired.dependencies), { code: "monitor_run_expired" });
});
