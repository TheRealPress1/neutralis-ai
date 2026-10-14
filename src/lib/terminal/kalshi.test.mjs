import test from "node:test";
import assert from "node:assert/strict";
import { constants, generateKeyPairSync, verify } from "node:crypto";
import { createKalshiClient, findOrderByClientId, KalshiRequestError, normalizeBalance, normalizeFill, normalizeOrder, normalizePosition, signKalshiRequest, toKalshiOrder } from "./kalshi.ts";

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const credentials = { keyId: "test-key", privateKeyPem: rsa.privateKey.export({ type: "pkcs8", format: "pem" }) };
const row = { order_id: "order-1", ticker: "KXTEST-26-T1", client_order_id: "client-1", outcome_side: "no", book_side: "ask", yes_price_dollars: "0.6600", no_price_dollars: "0.3400", initial_count_fp: "10.00", fill_count_fp: "3.25", remaining_count_fp: "6.75", status: "resting", created_time: "2026-10-14T12:00:00Z" };

test("RSA-PSS signs timestamp, uppercase method and query-free full path using digest-length salt", () => {
  const headers = signKalshiRequest(credentials, "get", "/trade-api/v2/portfolio/orders?limit=100", 12345);
  assert.equal(headers["KALSHI-ACCESS-TIMESTAMP"], "12345");
  assert.ok(verify("sha256", Buffer.from("12345GET/trade-api/v2/portfolio/orders"), { key: rsa.publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST }, Buffer.from(headers["KALSHI-ACCESS-SIGNATURE"], "base64")));
});
test("Ed25519 signs the original message directly", () => {
  const pair = generateKeyPairSync("ed25519");
  const headers = signKalshiRequest({ keyId: "ed-key", privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }) }, "POST", "/trade-api/v2/portfolio/events/orders", 100);
  assert.ok(verify(null, Buffer.from("100POST/trade-api/v2/portfolio/events/orders"), pair.publicKey, Buffer.from(headers["KALSHI-ACCESS-SIGNATURE"], "base64")));
});
test("NO buy is an ask in YES-price coordinates; count and price are fixed-point strings", () => {
  const order = toKalshiOrder({ ticker: row.ticker, side: "no", count: 10, limitPrice: 0.34 }, "client-1");
  assert.equal(order.side, "ask"); assert.equal(order.price, "0.6600"); assert.equal(order.count, "10.00");
  assert.equal(order.client_order_id, "client-1"); assert.equal(order.exchange_index, -1);
  assert.equal(toKalshiOrder({ ticker: row.ticker, side: "yes", count: 1, limitPrice: 0.001 }, "a").price, "0.0010");
});
test("normalization preserves fractional fills and selected-outcome price", () => {
  const order = normalizeOrder(row);
  assert.equal(order.side, "no"); assert.equal(order.limitPrice, 0.34); assert.equal(order.filledCount, 3.25); assert.equal(order.remainingCount, 6.75);
  assert.equal(normalizeOrder({ ...row, outcome_side: undefined, book_side: undefined, action: "sell", side: "no" }).side, "yes");
  const fill = normalizeFill({ ...row, fill_id: "f1", count_fp: "0.25", fee_cost: "0.000010" });
  assert.equal(fill.count, 0.25); assert.equal(fill.price, 0.34); assert.equal(fill.feeDollars, 0.00001);
  const position = normalizePosition({ ticker: row.ticker, position_fp: "-2.25", market_exposure_dollars: "0.7600", realized_pnl_dollars: "-0.1000", fees_paid_dollars: "0.0000" });
  assert.equal(position.side, "no"); assert.equal(position.count, 2.25); assert.equal(position.realizedPnlDollars, -0.1);
});
test("missing/null prices are never invented as zero; actual zero remains zero", () => {
  assert.equal(normalizeOrder({ ...row, no_price_dollars: null }).limitPrice, null);
  assert.equal(normalizeOrder({ ...row, no_price_dollars: "0.0000" }).limitPrice, 0);
  assert.equal(normalizeBalance({ balance_dollars: "0.0000", balance: 100, portfolio_value: 250 }).balanceDollars, 0);
  assert.equal(normalizeBalance({ balance: null, portfolio_value: null }).balanceDollars, null);
});
test("authenticated adapter uses the real V2 endpoint and does not retry successful writes", async () => {
  const calls = [];
  const client = createKalshiClient(credentials, async (url, options) => { calls.push({ url, options }); return Response.json({ order_id: "o1", fill_count: "0.00", remaining_count: "1.00" }, { status: 201 }); });
  await client.request("/portfolio/events/orders", "POST", { client_order_id: "stable" });
  assert.equal(calls.length, 1); assert.match(calls[0].url, /external-api\.kalshi\.com\/trade-api\/v2\/portfolio\/events\/orders$/);
  assert.equal(calls[0].options.redirect, "error"); assert.equal(calls[0].options.headers["KALSHI-ACCESS-KEY"], "test-key");
});
test("transport failure, duplicate ID, and 5xx are uncertain; explicit 400 rejects; never retries", async () => {
  for (const status of [null, 409, 500, 400]) {
    let calls = 0;
    const client = createKalshiClient(credentials, async () => { calls++; if (status === null) throw new DOMException("timed out", "TimeoutError"); return Response.json({ error: "mock" }, { status }); });
    await assert.rejects(client.request("/portfolio/events/orders", "POST", {}), (error) => error instanceof KalshiRequestError && error.uncertain === (status !== 400));
    assert.equal(calls, 1);
  }
});
test("reconciliation follows pagination and matches client order ID exactly", async () => {
  const paths = [];
  const client = { request: async (path) => { paths.push(path); return paths.length === 1 ? { orders: [{ ...row, client_order_id: "other" }], cursor: "next" } : { orders: [row], cursor: "" }; } };
  const found = await findOrderByClientId(client, row.ticker, "client-1");
  assert.equal(found.id, "order-1"); assert.match(paths[1], /cursor=next/);
});
