import test from "node:test";
import assert from "node:assert/strict";
import { alertDisclaimer, conditionMet, observeOpportunity, readKalshiMonitorQuote, validateCreateMonitor, validateObservation, validateUpdateMonitor, workerHealth } from "./persistent-monitor-core.ts";
const now = Date.parse("2026-10-15T12:00:00Z");
const target = { kind: "market", ticker: "KXTEST-26-YES" };
const pairTarget = { kind: "opportunity", candidateId: "v1~KXTEST-26-YES~test-game-yes", pairDirection: "kalshi_yes_polymarket_no" };
const input = { target, direction: "below", threshold: .4 };
const observed = { status: "ok", value: .32, observedAt: new Date(now).toISOString(), error: null };
function pairRow() {
  const book = () => ({ status: "live", fetchedAt: new Date(now).toISOString(), exchangeTimestamp: null });
  return { id: pairTarget.candidateId, kalshi: { book: book() }, polymarketUS: { book: book() }, pairs: [
    { direction: "kalshi_yes_polymarket_no", grossSpread: .03, availableSize: 12, status: "live" },
    { direction: "polymarket_yes_kalshi_no", grossSpread: .12, availableSize: 9, status: "live" },
  ] };
}
test("strict monitor inputs reject coercion, extra authority fields, malformed identities and nonfinite thresholds", () => {
  assert.deepEqual(validateCreateMonitor(input), input);
  assert.equal(validateCreateMonitor({ ...input, target: pairTarget, threshold: -.1 }).target.pairDirection, pairTarget.pairDirection);
  for (const changed of [{ threshold: NaN }, { threshold: Infinity }, { threshold: -.1 }, { threshold: "0.4" }, { threshold: .12345 }, { user_id: "other" }, { state: "triggered" }, { target: { kind: "market", ticker: "../../keys" } }, { target: { ...target, url: "https://evil.test" } }, { label: "\nprivate" }]) assert.throws(() => validateCreateMonitor({ ...input, ...changed }));
  for (const changed of [{ pairDirection: null }, { pairDirection: "best" }, { candidateId: "https://evil.test" }]) assert.throws(() => validateCreateMonitor({ ...input, target: { ...pairTarget, ...changed } }));
  for (const changed of [{ version: "1" }, { version: 0 }, { version: Infinity }, { action: "start_trade" }, { threshold: .9 }]) assert.throws(() => validateUpdateMonitor({ action: "pause", version: 1, ...changed }));
});
test("stale, missing, nonfinite and future observations never satisfy threshold", () => {
  assert.equal(conditionMet("below", .4, validateObservation(observed, target, now)), true);
  assert.equal(conditionMet("above", .32, validateObservation(observed, target, now)), true);
  for (const changed of [{ observedAt: new Date(now - 45_001).toISOString() }, { observedAt: new Date(now + 5_001).toISOString() }, { observedAt: null }, { value: null }, { value: NaN }, { value: -1 }, { status: "closed" }, { status: "unavailable" }]) {
    const result = validateObservation({ ...observed, ...changed }, target, now);
    assert.notEqual(result.status, "ok"); assert.equal(result.value, null); assert.equal(conditionMet("below", .4, result), false);
  }
});
test("pair evaluation binds original exact identity and direction, not currently larger spread", () => {
  const row = pairRow();
  assert.equal(observeOpportunity(pairTarget, row, now).value, .03);
  assert.equal(observeOpportunity({ ...pairTarget, pairDirection: "polymarket_yes_kalshi_no" }, row, now).value, .12);
  row.pairs.reverse();
  assert.equal(observeOpportunity(pairTarget, row, now).value, .03);
  assert.equal(observeOpportunity({ ...pairTarget, candidateId: "v1~OTHER~other" }, row, now).status, "unavailable");
  assert.match(alertDisclaimer(pairTarget), /before fees and slippage/);
  assert.match(alertDisclaimer(pairTarget), /Settlement equivalence is unverified/);
});
test("pair requires both live fresh books, nonstale explicit book timestamps, and positive size", () => {
  for (const mutate of [
    (row) => { row.polymarketUS.book.status = "stale"; },
    (row) => { row.kalshi.book.fetchedAt = new Date(now - 45_001).toISOString(); },
    (row) => { row.polymarketUS.book.exchangeTimestamp = new Date(now - 45_001).toISOString(); },
    (row) => { row.kalshi.book.fetchedAt = new Date(now + 10_000).toISOString(); },
    (row) => { row.pairs[0].availableSize = 0; },
    (row) => { row.pairs[0].grossSpread = null; },
  ]) { const row = pairRow(); mutate(row); assert.equal(observeOpportunity(pairTarget, row, now).status, "unavailable"); }
  const row = pairRow(); row.kalshi.book.fetchedAt = new Date(now - 20_000).toISOString();
  assert.equal(observeOpportunity(pairTarget, row, now).observedAt, row.kalshi.book.fetchedAt);
});
test("worker health reflects actual completed runs, failures and clock bounds rather than configuration", () => {
  assert.equal(workerHealth(true, null, now).status, "never_run");
  const row = { completed_at: new Date(now).toISOString(), checked_count: 0, failure_count: 0 };
  assert.equal(workerHealth(false, row, now).status, "not_configured");
  assert.equal(workerHealth(true, row, now).status, "healthy");
  assert.equal(workerHealth(true, { ...row, failure_count: 1 }, now).status, "degraded");
  assert.equal(workerHealth(true, { ...row, completed_at: new Date(now - 181_000).toISOString() }, now).status, "stale");
  assert.equal(workerHealth(true, { ...row, completed_at: new Date(now + 6_000).toISOString() }, now).status, "stale");
});
test("market reader uses one fixed public endpoint without authentication and preserves real zero after trades", async () => {
  let calls = 0;
  const payload = { market: { ticker: target.ticker, market_type: "binary", status: "active", result: "", close_time: "2099-01-01T00:00:00Z", last_price_dollars: "0.0000", volume_fp: "10.00" } };
  const fetcher = async (url, options) => {
    calls++; assert.equal(url, `https://api.elections.kalshi.com/trade-api/v2/markets/${target.ticker}`);
    assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, { Accept: "application/json" });
    return Response.json(payload);
  };
  assert.equal((await readKalshiMonitorQuote(target.ticker, fetcher, () => now)).value, 0);
  assert.equal(calls, 1);
  payload.market.volume_fp = "0.00";
  assert.equal((await readKalshiMonitorQuote(target.ticker, fetcher, () => now)).status, "unavailable");
  payload.market.volume_fp = "10.00"; payload.market.ticker = "OTHER";
  assert.equal((await readKalshiMonitorQuote(target.ticker, fetcher, () => now)).status, "unavailable");
  assert.equal(calls, 3);
});
test("market reader preserves closed/unavailable instead of inventing observations or retrying", async () => {
  let calls = 0;
  const failed = await readKalshiMonitorQuote(target.ticker, async () => { calls++; throw new Error("failure"); }, () => now);
  assert.equal(failed.status, "unavailable"); assert.equal(calls, 1);
  const closed = await readKalshiMonitorQuote(target.ticker, async () => Response.json({ market: { ticker: target.ticker, market_type: "binary", status: "closed" } }), () => now);
  assert.equal(closed.status, "closed");
});
