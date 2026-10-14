import assert from "node:assert/strict";
import { test } from "node:test";
import { createTickerProvider, normalizeHistory, normalizeMarket, parsePrice, TICKER_MARKETS } from "./provider.ts";

const checkedAt = "2026-10-14T20:00:00.000Z";
const market = TICKER_MARKETS[0];
const raw = (id = market.id, overrides = {}) => ({ market: { ticker: id, status: "active", title: "A real question?", last_price_dollars: "0.0450", previous_price_dollars: "0.0310", volume_fp: "1200.0", ...overrides } });

test("dollar prices preserve zero/sub-cent values and reject missing or invalid data", () => {
  assert.equal(parsePrice("0.0450"), 0.045);
  assert.equal(parsePrice(0), 0);
  for (const value of [null, undefined, "", " ", true, "NaN", Infinity, -0.1, 1.01]) assert.equal(parsePrice(value), null);
  const quote = normalizeMarket(market, raw(undefined, { last_price_dollars: "0", previous_price_dollars: "0.1" }), [], checkedAt);
  assert.equal(quote.price, 0);
  assert.equal(quote.change24h, -0.1);
  assert.equal(quote.status, "live");
});

test("use absolute price changes, identify closed contracts, and never invent untraded prices", () => {
  const quote = normalizeMarket(market, raw(), [0.03, 0.04], checkedAt);
  assert.equal(quote.change24h, 0.014);
  assert.equal(quote.updatedAt, checkedAt);
  const closed = normalizeMarket(market, raw(undefined, { status: "finalized", result: "no" }), [0.03, 0.04], checkedAt);
  assert.equal(closed.status, "closed");
  assert.equal(closed.change24h, null);
  assert.deepEqual(closed.history, []);
  const untraded = normalizeMarket(market, raw(undefined, { volume_fp: "0", last_price_dollars: "0" }), [], checkedAt);
  assert.equal(untraded.price, null);
  assert.equal(untraded.status, "unavailable");
  assert.throws(() => normalizeMarket(market, raw("WRONG-TICKER"), [], checkedAt));
});

test("history uses chronological exchange candles, including real zero and carry-forward prices", () => {
  assert.deepEqual(normalizeHistory({ candlesticks: [
    { end_period_ts: 3, price: { close_dollars: "0.04" } },
    { end_period_ts: 1, price: { close_dollars: "0" } },
    { end_period_ts: 2, price: { previous_dollars: "0.01" } },
    { end_period_ts: 4, price: { close_dollars: null } },
    { end_period_ts: 5, price: { close_dollars: "5" } },
  ] }), [0, 0.01, 0.04]);
  assert.deepEqual(normalizeHistory({}), []);
});

test("provider coalesces requests, retains partial quotes as stale, and expires stale prices", async () => {
  let time = Date.parse(checkedAt);
  let calls = 0;
  let failingId = null;
  const fetcher = async (url) => {
    calls++;
    const pathname = new URL(url).pathname;
    if (failingId && pathname.endsWith(`/markets/${failingId}`)) return new Response("Unavailable", { status: 503 });
    if (pathname.endsWith("/candlesticks")) return Response.json({ candlesticks: [] });
    return Response.json(raw(pathname.split("/").at(-1)));
  };
  const provider = createTickerProvider(fetcher, () => time);
  const [first, concurrent] = await Promise.all([provider(), provider()]);
  assert.equal(first, concurrent);
  assert.equal(calls, 8);
  assert.ok(first.markets.every((quote) => quote.status === "live"));
  await provider();
  assert.equal(calls, 8);

  time += 31_000;
  failingId = market.id;
  const partial = await provider();
  assert.equal(calls, 12); // chart cache survives quote refresh
  assert.equal(partial.markets[0].status, "stale");
  assert.equal(partial.markets[0].updatedAt, first.markets[0].updatedAt);
  assert.ok(partial.markets.slice(1).every((quote) => quote.status === "live"));

  time += 301_000;
  const expired = await provider();
  assert.equal(expired.markets[0].status, "unavailable");
  assert.equal(expired.markets[0].price, null);
});

test("cold outage returns no fabricated prices and chart outages leave quotes available", async () => {
  const offline = createTickerProvider(async () => { throw new Error("offline"); });
  const unavailable = await offline();
  assert.ok(unavailable.markets.every((quote) => quote.status === "unavailable" && quote.price === null));
  const noCharts = createTickerProvider(async (url) => {
    if (new URL(url).pathname.endsWith("candlesticks")) throw new Error("chart outage");
    return Response.json(raw(new URL(url).pathname.split("/").at(-1)));
  });
  const quotes = await noCharts();
  assert.ok(quotes.markets.every((quote) => quote.status === "live" && quote.history.length === 0));
});
