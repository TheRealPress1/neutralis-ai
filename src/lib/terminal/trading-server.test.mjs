import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as kalshi from "./kalshi.ts";
import * as core from "./trading-core.ts";
import * as execution from "./trading-execution.ts";

// Transpile the real server and route modules; replace only external boundaries.
// No Supabase, HTTP client, credentials or network connection is instantiated.
const compiled = new Map();
function loadModule(relative, dependencies, env) {
  const filename = new URL(relative, import.meta.url);
  if (!compiled.has(filename.href)) compiled.set(filename.href, ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const compiledModule = { exports: {} };
  runInNewContext(compiled.get(filename.href), {
    module: compiledModule, exports: compiledModule.exports, Buffer, Date, URL, Response, Request,
    process: { env },
    fetch: () => { throw new Error("Network access is forbidden in this test."); },
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unmocked import: ${name}`);
      return dependencies[name];
    },
  }, { filename: filename.pathname });
  return compiledModule.exports;
}

const input = { ticker: "KXTEST-26-T4.25", side: "no", count: 10, limitPrice: 0.34 };
const secretHex = "17".repeat(32);
const orderId = "10000000-0000-4000-8000-000000000001";
function rawOrder(changes = {}) {
  return { order_id: orderId, client_order_id: "20000000-0000-4000-8000-000000000001", ticker: input.ticker,
    outcome_side: "no", status: "resting", yes_price_dollars: "0.6600", no_price_dollars: "0.3400",
    initial_count_fp: "10.00", fill_count_fp: "3.25", remaining_count_fp: "6.75", subaccount_number: 0,
    created_time: "2026-10-14T12:00:00Z", ...changes };
}

function harness(options = {}) {
  const state = {
    userId: options.userId === undefined ? "user-a" : options.userId,
    keys: [{ user_id: "user-a", platform: "kalshi", api_key_id: "key-a", private_key_pem: "encrypted-a", is_valid: true },
      { user_id: "user-b", platform: "kalshi", api_key_id: "key-b", private_key_pem: "encrypted-b", is_valid: true }],
    ledger: [], queries: [], calls: [], decrypted: [], credentials: [], authCalls: 0,
    missingLedger: false, failedUpdate: false, decryptFailure: false, postMode: "accepted", deleteMode: "accepted",
    orders: [], fills: [], positions: [], balance: { balance_dollars: "100.1234", portfolio_value: 1025 },
    market: { ticker: input.ticker, title: "Test contract?", event_ticker: "KXTEST-26", market_type: "binary", status: "active", result: "",
      open_time: "2020-01-01T00:00:00Z", close_time: "2099-01-01T00:00:00Z", notional_value_dollars: "1.0000",
      price_ranges: [{ start: "0.0000", end: "1.0000", step: "0.0100" }] },
    event: { event_ticker: "KXTEST-26", series_ticker: "KXTEST" },
    series: { ticker: "KXTEST", fee_type: "quadratic", fee_multiplier: 1 },
    exchange: { trading_active: true, exchange_active: true },
    ...options,
  };
  const env = { KALSHI_MANUAL_TRADING_ENABLED: "true", KALSHI_ORDER_PREVIEW_SECRET: secretHex,
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-service-role", ...options.env };

  function query(table, role) {
    const q = { table, role, operation: "select", filters: [], payload: null };
    let result;
    function execute(single = false) {
      if (result) return result;
      state.queries.push(q);
      const matches = (row) => q.filters.every(([kind, key, value]) => kind === "eq" ? row[key] === value : value.includes(row[key]));
      if (table === "user_api_keys") {
        assert.equal(role, "session", "Credentials must never be loaded through the service-role client.");
        assert.ok(q.filters.some(([kind, key, value]) => kind === "eq" && key === "user_id" && value === state.userId));
        assert.ok(q.filters.some(([kind, key, value]) => kind === "eq" && key === "platform" && value === "kalshi"));
        return result = { data: state.keys.find(matches) ?? null, error: null };
      }
      assert.equal(table, "terminal_order_submissions");
      if (state.missingLedger) return result = { data: null, error: { code: "42P01" } };
      if (q.operation === "insert") {
        assert.equal(role, "service");
        assert.equal(q.payload.user_id, state.userId);
        const conflict = state.ledger.some((row) => row.client_order_id === q.payload.client_order_id ||
          row.user_id === q.payload.user_id && ["submitting", "unknown"].includes(row.status));
        if (conflict) return result = { data: null, error: { code: "23505" } };
        state.ledger.push({ order_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...q.payload });
        return result = { data: null, error: null };
      }
      assert.ok(q.filters.some(([kind, key, value]) => kind === "eq" && key === "user_id" && value === state.userId), "Every ledger operation must be user-scoped.");
      if (q.operation === "update") {
        assert.equal(role, "service");
        assert.ok(q.filters.some(([kind, key]) => kind === "eq" && key === "client_order_id"));
        if (state.failedUpdate) return result = { data: null, error: { code: "unavailable" } };
        state.ledger.filter(matches).forEach((row) => Object.assign(row, q.payload));
        return result = { data: null, error: null };
      }
      assert.equal(role, "session");
      const rows = state.ledger.filter(matches);
      return result = { data: single ? rows[0] ?? null : rows, error: null };
    }
    const builder = {
      select() { return builder; },
      eq(key, value) { q.filters.push(["eq", key, value]); return builder; },
      in(key, value) { q.filters.push(["in", key, value]); return builder; },
      returns() { return builder; },
      insert(payload) { q.operation = "insert"; q.payload = payload; return builder; },
      update(payload) { q.operation = "update"; q.payload = payload; return builder; },
      maybeSingle() { return Promise.resolve(execute(true)); },
      then(resolve, reject) { return Promise.resolve().then(() => execute()).then(resolve, reject); },
    };
    return builder;
  }
  const session = { auth: { getUser: async () => { state.authCalls++; return { data: { user: state.userId ? { id: state.userId } : null }, error: null }; } }, from: (table) => query(table, "session") };
  const service = { from: (table) => query(table, "service") };
  const client = { request: async (path, method = "GET", body) => {
    state.calls.push({ path, method, body });
    const url = new URL(path, "https://exchange.invalid");
    if (state.override) {
      const overridden = await state.override(path, method, body);
      if (overridden !== undefined) return overridden;
    }
    if (method === "POST") {
      assert.equal(path, "/portfolio/events/orders");
      assert.ok(state.ledger.some((row) => row.client_order_id === body.client_order_id && row.user_id === state.userId && row.status === "submitting"), "Durable claim must precede any exchange write.");
      if (state.postMode === "rejected") throw new kalshi.KalshiRequestError(400, false);
      if (state.postMode === "unknown") throw new kalshi.KalshiRequestError(null, true);
      const row = rawOrder({ client_order_id: body.client_order_id, ticker: body.ticker });
      state.orders.push(row);
      if (state.postMode === "accepted-timeout") throw new kalshi.KalshiRequestError(null, true);
      if (state.postMode === "invalid-ack") return { order_id: orderId, fill_count: "garbage" };
      return { order_id: orderId, client_order_id: body.client_order_id, fill_count: "3.25", remaining_count: "6.75", ts_ms: Date.now() };
    }
    if (method === "DELETE") {
      assert.equal(url.pathname, `/portfolio/events/orders/${orderId}`);
      assert.equal(url.searchParams.get("market_ticker"), input.ticker);
      assert.equal(url.searchParams.get("subaccount"), "0");
      assert.equal(url.searchParams.get("exchange_index"), "-1");
      if (state.deleteMode === "unknown") throw new kalshi.KalshiRequestError(null, true);
      const row = state.orders.find((value) => value.order_id === orderId);
      const reduced = row.remaining_count_fp;
      row.remaining_count_fp = "0.00";
      row.status = "canceled";
      return { order_id: orderId, reduced_by: reduced, ts_ms: Date.now() };
    }
    assert.equal(method, "GET");
    if (url.pathname === `/markets/${input.ticker}`) return { market: state.market };
    if (url.pathname === "/exchange/status") return state.exchange;
    if (url.pathname === "/events/KXTEST-26") return { event: state.event };
    if (url.pathname === "/series/KXTEST") return { series: state.series };
    if (url.pathname === "/portfolio/balance") return state.balance;
    if (url.pathname === "/portfolio/orders") return { orders: state.orders.filter((row) =>
      (!url.searchParams.has("ticker") || row.ticker === url.searchParams.get("ticker")) &&
      (!url.searchParams.has("status") || row.status === url.searchParams.get("status"))), cursor: "" };
    if (url.pathname.startsWith("/portfolio/orders/")) {
      const row = state.orders.find((value) => value.order_id === url.pathname.split("/").at(-1));
      if (!row) throw new kalshi.KalshiRequestError(404, false);
      return { order: row };
    }
    if (url.pathname === "/portfolio/fills") return { fills: state.fills, cursor: "" };
    if (url.pathname === "/portfolio/positions") return { market_positions: state.positions, cursor: "" };
    throw new Error(`Unexpected mock exchange path: ${path}`);
  } };
  const api = loadModule("./trading-server.ts", {
    "server-only": {}, "@supabase/supabase-js": { createClient: () => service },
    "@/lib/supabase/server": { createClient: async () => session },
    "@/lib/encryption": { decrypt: (ciphertext) => {
      state.decrypted.push(ciphertext);
      if (state.decryptFailure) throw new Error("Sensitive internal decrypt detail");
      assert.equal(ciphertext, state.userId === "user-a" ? "encrypted-a" : "encrypted-b");
      return "TEST_PRIVATE_KEY";
    } },
    "@/lib/rate-limit": { rateLimit: () => ({ success: !state.rateLimited }) },
    "./kalshi": { ...kalshi, createKalshiClient: (credentials) => { state.credentials.push(credentials); return client; } },
    "./trading-core": core, "./trading-execution": execution,
  }, env);
  function route(name) {
    const relative = name === "account" ? "../../app/api/terminal/account/route.ts" : `../../app/api/terminal/orders/${name ? name + "/" : ""}route.ts`;
    return loadModule(relative, { "@/lib/terminal/trading-core": core, "@/lib/terminal/trading-server": api }, env);
  }
  function review(issuedAt = Date.now()) {
    return core.issuePreview({ ...input, question: "Test contract?", action: "buy", timeInForce: "good_till_canceled",
      ...core.estimateFees(input, "quadratic", 1), tradingEnabled: true }, state.userId, state.userId === "user-a" ? "key-a" : "key-b", Buffer.from(secretHex, "hex"), issuedAt);
  }
  function record(preview, status = "unknown", changes = {}) {
    const row = { client_order_id: preview.preview.clientOrderId, user_id: state.userId, ticker: input.ticker, status,
      preview_hash: core.previewHash(preview.previewToken), credential_binding: core.credentialBinding(state.userId === "user-a" ? "key-a" : "key-b", Buffer.from(secretHex, "hex")), order_id: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...changes };
    state.ledger.push(row);
    return row;
  }
  return { state, api, route, review, record, writes: () => state.calls.filter((call) => call.method !== "GET") };
}

function request(body, origin = "https://neutralis.test", method = "POST") {
  return new Request("https://neutralis.test/api/terminal/orders", { method,
    headers: { origin, "content-type": "application/json" }, ...(method !== "DELETE" ? { body: JSON.stringify(body) } : {}) });
}
const confirmed = (review) => ({ previewToken: review.previewToken, confirmed: true });

test("all route mutations enforce CSRF before authentication; unauthenticated account cannot load credentials", async () => {
  const h = harness({ userId: null });
  for (const name of ["", "preview", "reconcile"]) {
    const result = await h.route(name).POST(request({}, "https://evil.test"));
    assert.equal(result.status, 403);
    assert.equal((await result.json()).code, "invalid_origin");
  }
  assert.equal((await h.route("[id]").DELETE(request({}, "https://evil.test", "DELETE"), { params: Promise.resolve({ id: orderId }) })).status, 403);
  assert.equal(h.state.authCalls, 0);
  assert.equal((await h.route("account").GET()).status, 401);
  assert.equal((await h.route("").POST(request({}))).status, 401);
  assert.equal(h.state.queries.length, 0);
  assert.equal(h.state.calls.length, 0);
});

test("only the authenticated user's encrypted Kalshi key is loaded, and decrypt failures never fall back", async () => {
  const h = harness({ userId: "user-b" });
  const context = await h.api.tradingContext();
  assert.equal(context.keyId, "key-b");
  assert.deepEqual(h.state.decrypted, ["encrypted-b"]);
  assert.equal(h.state.credentials[0].keyId, "key-b");
  h.state.decryptFailure = true;
  const account = await h.api.getTradingAccount(await h.api.tradingContext());
  assert.equal(account.connection, "unavailable");
  assert.equal(account.tradingEnabled, false);
  assert.equal(account.balanceDollars, null);
  assert.equal(h.state.credentials.length, 1);
  assert.equal(h.state.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(account), /Sensitive|TEST_PRIVATE_KEY|encrypted-b/);
});

test("disabled trading still returns direct account balances, fractional fills and signed positions", async () => {
  const h = harness({ env: { KALSHI_MANUAL_TRADING_ENABLED: "false" }, orders: [rawOrder()],
    fills: [{ fill_id: "fill-1", order_id: orderId, ticker: input.ticker, outcome_side: "no", no_price_dollars: "0.3300", count_fp: "3.25", fee_cost: "0.0500", created_time: "2026-10-14T12:00:00Z" }],
    positions: [{ ticker: input.ticker, position_fp: "-3.25", market_exposure_dollars: "1.0725", realized_pnl_dollars: "0.0000", fees_paid_dollars: "0.0500" }] });
  const response = await h.route("account").GET();
  const account = await response.json();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(account.connection, "connected");
  assert.equal(account.tradingEnabled, false);
  assert.equal(account.balanceDollars, 100.1234);
  assert.equal(account.portfolioValueDollars, 10.25);
  assert.equal(account.orders.length, 1, "Resting/recent overlap must be deduplicated.");
  assert.equal(account.orders[0].remainingCount, 6.75);
  assert.equal(account.fills[0].price, 0.33);
  assert.equal(account.fills[0].count, 3.25);
  assert.equal(account.positions[0].side, "no");
  assert.equal(account.positions[0].count, 3.25);
  assert.equal(h.writes().length, 0);
});

test("review stays available when disabled, while explicit confirmed submit fails closed", async () => {
  const h = harness({ env: { KALSHI_MANUAL_TRADING_ENABLED: "false" } });
  const previewResponse = await h.route("preview").POST(request(input));
  assert.equal(previewResponse.status, 200);
  const review = await previewResponse.json();
  assert.equal(review.preview.tradingEnabled, false);
  assert.equal(review.preview.action, "buy");
  assert.equal(review.preview.limitPrice, 0.34);
  const response = await h.route("").POST(request(confirmed(review)));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "trading_disabled");
  assert.equal(h.state.ledger.length, 0);
  assert.equal(h.writes().length, 0);
});

test("missing ledger migration disables account/review and blocks submission before exchange writes", async () => {
  const h = harness({ missingLedger: true });
  const account = await (await h.route("account").GET()).json();
  assert.equal(account.connection, "connected");
  assert.equal(account.tradingEnabled, false);
  assert.match(account.reason, /migration/);
  const review = await (await h.route("preview").POST(request(input))).json();
  assert.equal(review.preview.tradingEnabled, false);
  const response = await h.route("").POST(request(confirmed(review)));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "ledger_unavailable");
  assert.equal(h.writes().length, 0);
});

test("a signed review from another user or prior credential cannot submit or reconcile", async () => {
  const a = harness();
  const review = await a.api.previewTradingOrder(await a.api.tradingContext(), input);
  const b = harness({ userId: "user-b", ledger: a.state.ledger });
  for (const [name, body] of [["", confirmed(review)], ["reconcile", { previewToken: review.previewToken }]]) {
    const response = await b.route(name).POST(request(body));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "invalid_preview");
  }
  a.state.keys[0].api_key_id = "reconnected-key";
  const changed = await a.route("").POST(request(confirmed(review)));
  assert.equal(changed.status, 403);
  assert.equal(b.state.calls.length, 0);
  assert.equal(a.writes().length, 0);
});

test("preview uses current event fee overrides, checks balance and rejects unsupported schedules", async () => {
  const h = harness();
  const context = await h.api.tradingContext();
  h.state.event.fee_type_override = "quadratic_with_maker_fees";
  h.state.event.fee_multiplier_override = 2;
  const review = await h.api.previewTradingOrder(context, input);
  assert.equal(review.preview.estimatedFeeDollars, core.estimateFees(input, "quadratic_with_maker_fees", 2).estimatedFeeDollars);
  assert.match(review.preview.feeDescription, /2×/);
  h.state.event.fee_type_override = "flat";
  await assert.rejects(h.api.previewTradingOrder(context, input), { code: "unsupported_fees" });
  delete h.state.event.fee_type_override;
  await assert.rejects(h.api.previewTradingOrder(context, input), { code: "unsupported_fees" });
  delete h.state.event.fee_multiplier_override;
  h.state.balance.balance_dollars = "0.0000";
  await assert.rejects(h.api.previewTradingOrder(context, input), { code: "insufficient_balance" });
  assert.equal(h.writes().length, 0);
});

test("submit rechecks exchange pause, exact market, price grid, fees and balance before claiming", async () => {
  for (const [change, code] of [
    [(state) => { state.exchange.trading_active = false; }, "exchange_paused"],
    [(state) => { state.market.ticker = "DIFFERENT"; }, "market_mismatch"],
    [(state) => { state.market.price_ranges[0].step = "0.0500"; }, "invalid_price_grid"],
    [(state) => { state.series.fee_multiplier = 2; }, "fees_changed"],
    [(state) => { state.balance.balance_dollars = "0.0000"; }, "insufficient_balance"],
  ]) {
    const h = harness();
    const context = await h.api.tradingContext();
    const review = await h.api.previewTradingOrder(context, input);
    change(h.state);
    await assert.rejects(h.api.submitTradingOrder(context, confirmed(review)), { code });
    assert.equal(h.state.ledger.length, 0);
    assert.equal(h.writes().length, 0);
  }
});

test("confirmed NO order claims durably, submits V2 YES-coordinate price once and reconciles retries", async () => {
  const h = harness();
  const review = await (await h.route("preview").POST(request(input))).json();
  const unconfirmed = await h.route("").POST(request({ previewToken: review.previewToken, confirmed: false }));
  assert.equal(unconfirmed.status, 400);
  const first = await (await h.route("").POST(request(confirmed(review)))).json();
  assert.equal(first.status, "accepted");
  assert.equal(first.order.limitPrice, 0.34);
  assert.equal(first.order.filledCount, 3.25);
  assert.equal(first.order.remainingCount, 6.75);
  assert.equal(h.state.ledger[0].status, "accepted");
  const second = await (await h.route("").POST(request(confirmed(review)))).json();
  assert.equal(second.status, "accepted");
  assert.equal(second.clientOrderId, first.clientOrderId);
  assert.equal(h.writes().length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes()[0].body)), {
    ticker: input.ticker, client_order_id: review.preview.clientOrderId, side: "ask", count: "10.00", price: "0.6600",
    time_in_force: "good_till_canceled", self_trade_prevention_type: "taker_at_cross", cancel_order_on_pause: true, subaccount: 0, exchange_index: -1,
  });
});

test("unknown submit remains locked; repeated submit and reconcile never blindly send another order", async () => {
  const h = harness({ postMode: "unknown" });
  const context = await h.api.tradingContext();
  const review = await h.api.previewTradingOrder(context, input);
  assert.equal((await h.api.submitTradingOrder(context, confirmed(review))).status, "unknown");
  assert.equal(h.state.ledger[0].status, "unknown");
  assert.equal((await h.api.submitTradingOrder(context, confirmed(review))).status, "unknown");
  assert.equal((await h.api.reconcileTradingOrder(context, review.previewToken)).status, "unknown");
  await assert.rejects(h.api.previewTradingOrder(context, input), { code: "pending_submission" });
  const account = await h.api.getTradingAccount(context);
  assert.equal(account.pendingSubmission.clientOrderId, review.preview.clientOrderId);
  assert.equal(h.writes().length, 1);
});

test("an accepted write with lost/invalid acknowledgement is recovered through direct exchange reconciliation", async () => {
  for (const postMode of ["accepted-timeout", "invalid-ack"]) {
    const h = harness({ postMode });
    const context = await h.api.tradingContext();
    const review = await h.api.previewTradingOrder(context, input);
    const result = await h.api.submitTradingOrder(context, confirmed(review));
    assert.equal(result.status, "accepted");
    assert.equal(result.order.clientOrderId, review.preview.clientOrderId);
    assert.equal(h.state.ledger[0].status, "accepted");
    assert.equal(h.writes().length, 1);
  }
});

test("definitive rejection is durable and can be recovered without retrying the exchange write", async () => {
  const h = harness({ postMode: "rejected" });
  const context = await h.api.tradingContext();
  const review = await h.api.previewTradingOrder(context, input);
  assert.equal((await h.api.submitTradingOrder(context, confirmed(review))).status, "rejected");
  assert.equal(h.state.ledger[0].status, "rejected");
  assert.equal((await h.api.submitTradingOrder(context, confirmed(review))).status, "rejected");
  assert.equal((await h.api.reconcileTradingOrder(context, review.previewToken)).status, "rejected");
  assert.equal((await h.api.getTradingAccount(context)).pendingSubmission, null);
  assert.equal(h.writes().length, 1);
});

test("reconciliation accepts expired signed reviews but absence before expiry never proves rejection", async () => {
  const h = harness();
  const active = h.review(), expired = h.review(Date.now() - 120_000);
  const reconcile = (review) => h.route("reconcile").POST(request({ previewToken: review.previewToken })).then((response) => response.json());
  assert.equal((await reconcile(active)).status, "unknown");
  assert.equal((await reconcile(expired)).status, "rejected");
  h.record(expired, "accepted", { order_id: orderId });
  h.state.orders.push(rawOrder({ client_order_id: expired.preview.clientOrderId }));
  assert.equal((await reconcile(expired)).status, "accepted");
  assert.equal((await (await h.route("").POST(request(confirmed(expired)))).json()).status, "accepted");
  assert.equal(h.writes().length, 0);
});

test("account reconciliation clears only its bound pending submission and preserves a different credential's lock", async () => {
  const h = harness();
  const review = h.review();
  const row = h.record(review);
  h.state.orders.push(rawOrder({ client_order_id: review.preview.clientOrderId }));
  const context = await h.api.tradingContext();
  const accepted = await h.api.getTradingAccount(context);
  assert.equal(accepted.pendingSubmission, null);
  assert.equal(row.status, "accepted");
  row.status = "unknown";
  row.credential_binding = core.credentialBinding("old-key", Buffer.from(secretHex, "hex"));
  const mismatch = await h.api.getTradingAccount(context);
  assert.equal(mismatch.pendingSubmission.clientOrderId, review.preview.clientOrderId);
  assert.match(mismatch.reason, /different connected credentials/);
  assert.equal(row.status, "unknown");
  assert.equal((await h.api.reconcileTradingOrder(context, review.previewToken)).status, "unknown");
  assert.equal(h.writes().length, 0);
});

test("concurrent signed reviews cannot both pass the database unresolved-submission constraint", async () => {
  const h = harness({ postMode: "unknown" });
  const context = await h.api.tradingContext();
  const a = h.review(), b = h.review();
  const results = await Promise.allSettled([h.api.submitTradingOrder(context, confirmed(a)), h.api.submitTradingOrder(context, confirmed(b))]);
  assert.equal(results.filter((result) => result.status === "fulfilled" && result.value.status === "unknown").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && result.reason.code === "submission_blocked").length, 1);
  assert.equal(h.state.ledger.length, 1);
  assert.equal(h.writes().length, 1);
});

test("cancel checks connected primary-account ownership, cancels only remaining contracts and preserves fills", async () => {
  const h = harness({ orders: [rawOrder()] });
  const response = await h.route("[id]").DELETE(request({}, "https://neutralis.test", "DELETE"), { params: Promise.resolve({ id: orderId }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, "canceled");
  assert.equal(result.canceledCount, 6.75);
  assert.equal(h.state.orders[0].fill_count_fp, "3.25");
  assert.equal(h.state.orders[0].remaining_count_fp, "0.00");
  assert.equal(h.writes().length, 1);
  assert.equal((await h.api.cancelTradingOrder(await h.api.tradingContext(), orderId)).status, "not_open");
  assert.equal(h.writes().length, 1);
  for (const orders of [[], [rawOrder({ subaccount_number: 1 })]]) {
    const other = harness({ orders });
    await assert.rejects(other.api.cancelTradingOrder(await other.api.tradingContext(), orderId));
    assert.equal(other.writes().length, 0);
  }
});

test("ambiguous cancellation never claims contracts were canceled and does not retry", async () => {
  const h = harness({ orders: [rawOrder()], deleteMode: "unknown" });
  const result = await h.api.cancelTradingOrder(await h.api.tradingContext(), orderId);
  assert.equal(result.status, "unknown");
  assert.equal(result.canceledCount, null);
  assert.equal(h.state.orders[0].remaining_count_fp, "6.75");
  assert.equal(h.writes().length, 1);
});
