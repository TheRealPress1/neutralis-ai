import test from "node:test";
import assert from "node:assert/strict";
import { estimateFees, issuePreview, readJsonBody, requireSameOrigin, validateMarketForOrder, validateOrderInput, verifyPreview } from "./trading-core.ts";
const input = { ticker: "KXTEST-26-T4.25", side: "yes", count: 10, limitPrice: 0.62 };
const now = Date.parse("2026-10-14T12:00:00Z");
const secret = Buffer.alloc(32, 17);
const market = { ticker: input.ticker, market_type: "binary", status: "active", result: "", open_time: "2026-10-01T00:00:00Z", close_time: "2026-11-01T00:00:00Z", notional_value_dollars: "1.0000", price_ranges: [{ start: "0.0000", end: "1.0000", step: "0.0100" }] };
const seed = { ...input, question: "Test?", action: "buy", timeInForce: "good_till_canceled", ...estimateFees(input, "quadratic", 1), tradingEnabled: false };

test("rejects non-finite, fractional, coerced, unbounded or extra order inputs", () => {
  assert.deepEqual(validateOrderInput(input), input);
  for (const change of [{ count: NaN }, { count: Infinity }, { count: 0 }, { count: 1.5 }, { count: "10" }, { count: 1001 }, { limitPrice: 0 }, { limitPrice: 1 }, { limitPrice: NaN }, { limitPrice: "0.62" }, { limitPrice: 0.12345 }, { ticker: " KXTEST" }, { ticker: "../../orders" }, { side: "sell" }, { user_id: "other" }]) assert.throws(() => validateOrderInput({ ...input, ...change }));
});
test("validates exact ticker, active window and dynamic YES-coordinate grid", () => {
  validateMarketForOrder(input, market, now);
  for (const change of [{ ticker: "OTHER" }, { status: "closed" }, { result: "yes" }, { close_time: "2026-10-01T00:00:00Z" }, { price_ranges: [] }, { market_type: "scalar" }, { notional_value_dollars: "100.00" }]) assert.throws(() => validateMarketForOrder(input, { ...market, ...change }, now));
  assert.throws(() => validateMarketForOrder({ ...input, limitPrice: 0.625 }, market, now));
  validateMarketForOrder({ ...input, side: "no", limitPrice: 0.375 }, { ...market, price_ranges: [{ start: "0.6000", end: "0.7000", step: "0.0050" }] }, now);
});
test("only verified quadratic fee schedules are supported and fee-free zero is preserved", () => {
  const fee = estimateFees(input, "quadratic", 1);
  assert.ok(fee.estimatedFeeDollars >= 0.07 * input.count * 0.62 * 0.38);
  assert.ok(fee.maxCostDollars >= fee.notionalDollars + fee.estimatedFeeDollars);
  assert.equal(estimateFees(input, "quadratic", 0).estimatedFeeDollars, 0);
  for (const type of [null, "flat", "quadratic_with_combo_maker_fees", "unknown"]) assert.throws(() => estimateFees(input, type, 1));
  for (const multiplier of [null, "1", NaN, Infinity, -1, 11]) assert.throws(() => estimateFees(input, "quadratic", multiplier));
});
test("signed review binds immutable order, user, credential and expiry", () => {
  const result = issuePreview(seed, "user-a", "key-a", secret, now);
  assert.equal(verifyPreview(result.previewToken, "user-a", "key-a", secret, now).preview.clientOrderId, result.preview.clientOrderId);
  assert.throws(() => verifyPreview(result.previewToken, "user-b", "key-a", secret, now));
  assert.throws(() => verifyPreview(result.previewToken, "user-a", "key-b", secret, now));
  assert.throws(() => verifyPreview(result.previewToken, "user-a", "key-a", secret, now + 60_000));
  assert.equal(verifyPreview(result.previewToken, "user-a", "key-a", secret, now + 120_000, true).preview.count, 10);
  const [encoded, signature] = result.previewToken.split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()); payload.preview.count = 100;
  assert.throws(() => verifyPreview(Buffer.from(JSON.stringify(payload)).toString("base64url") + "." + signature, "user-a", "key-a", secret, now));
});
test("mutations require exact same Origin; cross-site and absent origins fail", () => {
  requireSameOrigin(new Request("https://neutralis.test/api/terminal/orders", { headers: { origin: "https://neutralis.test", "sec-fetch-site": "same-origin" } }));
  for (const headers of [{}, { origin: "https://evil.test" }, { origin: "null" }, { origin: "https://neutralis.test", "sec-fetch-site": "cross-site" }]) assert.throws(() => requireSameOrigin(new Request("https://neutralis.test/api/terminal/orders", { headers })));
});
test("JSON boundaries reject wrong content types, malformed and oversized bodies", async () => {
  const request = (body, type = "application/json") => new Request("https://neutralis.test", { method: "POST", headers: { "content-type": type }, body });
  assert.deepEqual(await readJsonBody(request(JSON.stringify(input))), input);
  await assert.rejects(readJsonBody(request("{}", "text/plain")));
  await assert.rejects(readJsonBody(request("bad-json")));
  await assert.rejects(readJsonBody(request(JSON.stringify({ value: "x".repeat(9000) }))));
});
