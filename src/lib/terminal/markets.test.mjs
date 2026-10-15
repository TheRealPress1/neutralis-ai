import assert from "node:assert/strict";
import { test } from "node:test";
import { createMarketProvider, normalizeHistory, normalizeMarket, normalizeOrderbook, parsePrice, parseQuantity } from "./markets.ts";

const checkedAt = "2026-10-14T20:00:00.000Z";
const initialTime = Date.parse(checkedAt);
const sports = { ticker: "KXNBA", category: "Sports", label: "NBA championship", slug: "pro-basketball-champion" };
const politics = { ticker: "CONTROLS", category: "Politics", label: "US Senate control", slug: "senate-control" };
const ticker = "KXNBA-27-OKC";
const rawMarket = (overrides = {}) => ({
  ticker, event_ticker: "KXNBA-27", title: "Will **Oklahoma City** win the 2027 Finals?", yes_sub_title: "Oklahoma City", status: "active",
  yes_bid_dollars: "0.2200", yes_ask_dollars: "0.2300", no_bid_dollars: "0.7700", no_ask_dollars: "0.7800",
  yes_bid_size_fp: "100.5", yes_ask_size_fp: "200", last_price_dollars: "0.2300", previous_price_dollars: "0.2100", volume_fp: "10000.5", volume_24h_fp: "23.5", open_interest_fp: "2000",
  close_time: "2029-07-30T14:00:00Z", expected_expiration_time: "2027-07-31T14:00:00Z", expiration_time: "2029-07-30T14:00:00Z", rules_primary: "Oklahoma City must win the 2027 Finals.", rules_secondary: "The market closes after the outcome.", ...overrides,
});
const candleTime = Math.floor(initialTime / 1000) - 3600;
const rawHistory = () => ({ ticker, candlesticks: [{ end_period_ts: candleTime, price: { close_dollars: "0.22" } }] });
const rawBook = () => ({ orderbook_fp: { yes_dollars: [["0.21", "100.5"], ["0.22", "200"]], no_dollars: [["0.77", "400"]] } });

test("normalize finite prices, fractional quantities, and zero-size unavailable quotes", () => {
  assert.equal(parsePrice("0.0045"), 0.0045);
  assert.equal(parsePrice(0), 0);
  for (const value of [null, undefined, "", " ", true, NaN, Infinity, -1, "1.01"]) assert.equal(parsePrice(value), null);
  assert.equal(parseQuantity("12.75"), 12.75);
  for (const value of [null, "", true, -1, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(parseQuantity(value), null);

  const normalized = normalizeMarket(rawMarket(), sports, checkedAt, ticker);
  assert.equal(normalized.title, "Will Oklahoma City win the 2027 Finals?");
  assert.equal(normalized.lastPrice, 0.23);
  assert.equal(normalized.change24h, 0.02);
  assert.equal(normalized.volume24h, 23.5);
  assert.equal(normalized.updatedAt, checkedAt);
  assert.equal(normalized.url, `https://kalshi.com/markets_by_ticker/${ticker}`);

  const empty = normalizeMarket(rawMarket({ volume_fp: "0", yes_bid_size_fp: "0", yes_ask_size_fp: "0" }), sports, checkedAt);
  assert.equal(empty.lastPrice, null);
  assert.equal(empty.yesAsk, null);
  assert.equal(empty.noBid, null);
  assert.equal(empty.status, "unavailable");
  const closed = normalizeMarket(rawMarket({ status: "finalized", result: "yes", last_price_dollars: "1" }), sports, checkedAt);
  assert.equal(closed.status, "closed");
  assert.equal(closed.change24h, null);
});

test("market normalization rejects ticker/series/event mismatches and missing identity", () => {
  assert.throws(() => normalizeMarket(rawMarket(), sports, checkedAt, "KXNBA-27-SAS"));
  assert.throws(() => normalizeMarket(rawMarket(), politics, checkedAt));
  assert.throws(() => normalizeMarket(rawMarket({ event_ticker: "KXNBA-28" }), sports, checkedAt));
  assert.throws(() => normalizeMarket(rawMarket({ title: "" }), sports, checkedAt));
});

test("chart keeps real trade candle timestamps, sorts, deduplicates, and rejects mismatched markets", () => {
  const payload = { ticker, candlesticks: [
    { end_period_ts: 3, price: { close_dollars: "0.22" } },
    { end_period_ts: 1, price: { close_dollars: "0" } },
    { end_period_ts: 2, price: { previous_dollars: "0.1" } },
    { end_period_ts: 3, price: { close_dollars: "0.23" } },
    { end_period_ts: -1, price: { close_dollars: "0.4" } },
    { end_period_ts: 4, price: { close_dollars: "2" } },
  ] };
  assert.deepEqual(normalizeHistory(payload, ticker), [{ time: 1, price: 0 }, { time: 3, price: 0.23 }]);
  assert.throws(() => normalizeHistory(payload, "KXNBA-27-SAS"));
  assert.throws(() => normalizeHistory({}, ticker));
});

test("order books keep the bid side, fractional depth, descending prices, and reject bad values", () => {
  const book = normalizeOrderbook({ orderbook_fp: {
    yes_dollars: [["0.1", "12.5"], ["0.2", "3"], ["0.1", "2"], ["0.5", "0"], ["1.1", "9"], ["0.3", "NaN"], [null, "7"]],
    no_dollars: [["0.75", "5"]],
  } });
  assert.deepEqual(book.yes, [{ price: 0.2, quantity: 3 }, { price: 0.1, quantity: 14.5 }]);
  assert.deepEqual(book.no, [{ price: 0.75, quantity: 5 }]);
  assert.deepEqual(normalizeOrderbook({ orderbook_fp: { yes_dollars: null, no_dollars: [] } }), { yes: [], no: [] });
  assert.throws(() => normalizeOrderbook({}));
  assert.throws(() => normalizeOrderbook({ ...rawBook(), ticker: "WRONG" }, ticker));
});

test("list searches within curated categories and coalesces refreshes; partial outage stays explicit", async () => {
  let time = initialTime;
  let calls = 0;
  let failSports = false;
  const provider = createMarketProvider(async (url) => {
    calls++;
    const series = new URL(url).searchParams.get("series_ticker");
    if (series === "KXNBA" && failSports) return new Response("Down", { status: 503 });
    return Response.json({ markets: [series === "KXNBA" ? rawMarket() : rawMarket({ ticker: "CONTROLS-2026-D", event_ticker: "CONTROLS-2026", title: "Will Democrats win the US Senate in 2026?", yes_sub_title: "Democrats", volume_24h_fp: "500" })], cursor: "" });
  }, () => time, [sports, politics]);
  const [first, concurrent] = await Promise.all([provider.getMarkets(), provider.getMarkets()]);
  assert.equal(calls, 2);
  assert.deepEqual(first.markets, concurrent.markets);
  assert.equal(first.markets[0].ticker, "CONTROLS-2026-D");
  assert.match(first.scope, /selected Kalshi series/);
  const filtered = await provider.getMarkets({ query: "oklahoma 2027", category: "Sports" });
  assert.equal(filtered.total, 1);
  assert.equal(calls, 2);
  assert.equal((await provider.getMarkets({ query: "democrats", category: "Sports" })).total, 0);

  time += 31_000;
  failSports = true;
  const partial = await provider.getMarkets();
  assert.equal(partial.status, "stale");
  assert.equal(partial.markets.find((market) => market.ticker === ticker).status, "stale");
  assert.equal(partial.markets.find((market) => market.ticker === ticker).updatedAt, checkedAt);
  assert.equal(partial.warnings.length, 1);
  time += 121_000;
  const expired = await provider.getMarkets();
  assert.equal(expired.markets.length, 1);
  assert.equal(expired.markets[0].category, "Politics");
});

test("cold list outage and malformed payloads return no invented markets", async () => {
  const offline = createMarketProvider(async () => { throw new Error("offline"); }, () => initialTime, [sports]);
  const feed = await offline.getMarkets();
  assert.equal(feed.status, "unavailable");
  assert.deepEqual(feed.markets, []);
  const wrongSeries = createMarketProvider(async () => Response.json({ markets: [rawMarket({ ticker: "WRONG-27-OKC" })] }), () => initialTime, [sports]);
  assert.deepEqual((await wrongSeries.getMarkets()).markets, []);
});

test("detail loads seven real days, uses cache/inflight, and preserves independent book/history errors", async () => {
  let time = initialTime;
  let calls = 0;
  let bookFails = false;
  let quoteFails = false;
  let historyFails = false;
  const provider = createMarketProvider(async (url) => {
    calls++;
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/candlesticks")) {
      assert.equal(Number(parsed.searchParams.get("end_ts")) - Number(parsed.searchParams.get("start_ts")), 7 * 86400);
      if (historyFails) return new Response("Down", { status: 503 });
      return Response.json(rawHistory());
    }
    if (parsed.pathname.endsWith("/orderbook")) return bookFails ? new Response("Down", { status: 503 }) : Response.json(rawBook());
    return quoteFails ? new Response("Down", { status: 503 }) : Response.json({ market: rawMarket() });
  }, () => time, [sports]);
  const [first, concurrent] = await Promise.all([provider.getMarket(ticker), provider.getMarket(ticker)]);
  assert.equal(calls, 3);
  assert.deepEqual(first, concurrent);
  assert.equal(first.market.yesAsk, 0.23);
  assert.deepEqual(first.history, [{ time: candleTime, price: 0.22 }]);
  assert.equal(first.orderbook.yes[0].price, 0.22);
  assert.equal(first.settlementTime, "2027-07-31T14:00:00.000Z");
  assert.match(first.rules.primary, /Oklahoma City/);
  await provider.getMarket(ticker);
  assert.equal(calls, 3);

  time += 16_000;
  bookFails = true;
  const partial = await provider.getMarket(ticker);
  assert.equal(partial.market.status, "live");
  assert.equal(partial.orderbookStatus, "stale");
  assert.equal(partial.orderbookUpdatedAt, checkedAt);
  assert.equal(partial.historyStatus, "live");
  assert.equal(calls, 5);

  time += 121_000;
  historyFails = true;
  const expiredBook = await provider.getMarket(ticker);
  assert.equal(expiredBook.orderbookStatus, "unavailable");
  assert.deepEqual(expiredBook.orderbook, { yes: [], no: [] });
  assert.equal(expiredBook.historyStatus, "unavailable");
  assert.deepEqual(expiredBook.history, []);
  assert.equal(expiredBook.market.status, "live");

  time += 16_000;
  quoteFails = true;
  assert.equal((await provider.getMarket(ticker)).market.status, "stale");
  time += 121_000;
  await assert.rejects(provider.getMarket(ticker), (error) => error.status === 503);
});

test("detail rejects invalid IDs before fetching, missing contracts, and mismatched upstream identity", async () => {
  let calls = 0;
  const missing = createMarketProvider(async () => { calls++; return new Response("Not found", { status: 404 }); }, () => initialTime, [sports]);
  await assert.rejects(missing.getMarket("../../portfolio"), (error) => error.status === 400);
  assert.equal(calls, 0);
  await assert.rejects(missing.getMarket("OTHER-27-OKC"), (error) => error.status === 404);
  assert.equal(calls, 1);
  await assert.rejects(missing.getMarket(ticker), (error) => error.status === 404);
  assert.equal(calls, 2);
  const mismatch = createMarketProvider(async () => Response.json({ market: rawMarket({ ticker: "KXNBA-27-SAS" }) }), () => initialTime, [sports]);
  await assert.rejects(mismatch.getMarket(ticker), (error) => error.status === 503);
});

test("account market detail outside curated series resolves verified event metadata and preserves list scope", async () => {
  const externalTicker = "WEATHER-NY-26OCT15-T70";
  const paths = [];
  const provider = createMarketProvider(async (url) => {
    const path = new URL(url).pathname;
    paths.push(path);
    if (path.includes("/events/")) return Response.json({ event: { event_ticker: "WEATHER-NY-26OCT15", series_ticker: "WEATHER-NY", category: "Climate and Weather", title: "New York temperature" } });
    if (path.endsWith("/candlesticks")) {
      assert.ok(path.includes("/series/WEATHER-NY/"));
      return Response.json({ ticker: externalTicker, candlesticks: [] });
    }
    if (path.endsWith("/orderbook")) return Response.json(rawBook());
    if (new URL(url).searchParams.has("series_ticker")) return Response.json({ markets: [rawMarket()], cursor: "" });
    return Response.json({ market: rawMarket({ ticker: externalTicker, event_ticker: "WEATHER-NY-26OCT15", title: "Will New York reach 70 degrees?" }) });
  }, () => initialTime, [sports]);
  const detail = await provider.getMarket(externalTicker);
  assert.equal(detail.market.ticker, externalTicker);
  assert.equal(detail.market.category, "Other");
  assert.equal(detail.market.status, "live");
  assert.ok(paths.includes("/trade-api/v2/events/WEATHER-NY-26OCT15"));
  assert.equal("seriesTicker" in detail, false);
  assert.deepEqual((await provider.getMarkets()).markets.map((market) => market.ticker), [ticker]);
});

test("out-of-universe detail rejects mismatched event/series metadata and does not fetch dependent books", async () => {
  for (const event of [
    { event_ticker: "WRONG-26", series_ticker: "OUTSIDE", category: "Sports" },
    { event_ticker: "OUTSIDE-26", series_ticker: "UNRELATED", category: "Sports" },
    { event_ticker: "OUTSIDE-26", series_ticker: "https://example.com", category: "Sports" },
  ]) {
    const paths = [];
    const provider = createMarketProvider(async (url) => {
      paths.push(url);
      if (url.includes("/events/")) return Response.json({ event });
      return Response.json({ market: rawMarket({ ticker: "OUTSIDE-26-YES", event_ticker: "OUTSIDE-26" }) });
    }, () => initialTime, [sports]);
    await assert.rejects(provider.getMarket("OUTSIDE-26-YES"), (error) => error.status === 503);
    assert.equal(paths.length, 2);
    assert.ok(paths.every((url) => url.startsWith("https://api.elections.kalshi.com/trade-api/v2/")));
  }
});

test("detail excludes future and out-of-window candles without inventing no-trade points", async () => {
  const end = Math.floor(initialTime / 1000);
  const provider = createMarketProvider(async (url) => {
    if (url.includes("/candlesticks")) return Response.json({ ticker, candlesticks: [
      { end_period_ts: end + 3600, price: { close_dollars: "0.8" } },
      { end_period_ts: end - 7 * 86400 - 1, price: { close_dollars: "0.7" } },
      { end_period_ts: end - 7 * 86400, price: { close_dollars: "0.2" } },
      { end_period_ts: end - 3600, price: { previous_dollars: "0.3" } },
      { end_period_ts: end, price: { close_dollars: "0.25" } },
    ] });
    if (url.includes("/orderbook")) return Response.json(rawBook());
    return Response.json({ market: rawMarket() });
  }, () => initialTime, [sports]);
  assert.deepEqual((await provider.getMarket(ticker)).history, [{ time: end - 7 * 86400, price: 0.2 }, { time: end, price: 0.25 }]);
});

test("a mismatched refresh never replaces a valid quote or refreshes its freshness timestamp", async () => {
  let time = initialTime;
  let mismatch = false;
  const provider = createMarketProvider(async (url) => {
    if (url.includes("/candlesticks")) return Response.json(rawHistory());
    if (url.includes("/orderbook")) return Response.json(rawBook());
    return Response.json({ market: rawMarket(mismatch ? { ticker: "KXNBA-27-SAS", title: "Different team", last_price_dollars: "0.9" } : {}) });
  }, () => time, [sports]);
  await provider.getMarket(ticker);
  time += 16_000;
  mismatch = true;
  const detail = await provider.getMarket(ticker);
  assert.equal(detail.market.ticker, ticker);
  assert.equal(detail.market.lastPrice, 0.23);
  assert.equal(detail.market.status, "stale");
  assert.equal(detail.market.updatedAt, checkedAt);
  time += 121_000;
  await assert.rejects(provider.getMarket(ticker), (error) => error.status === 503);
});

test("arbitrary ticker traffic cannot grow the retained cache without bound", async () => {
  let calls = 0;
  const provider = createMarketProvider(async (url) => {
    calls++;
    const path = new URL(url).pathname;
    const id = path.split("/markets/")[1].split("/")[0];
    if (path.endsWith("/candlesticks")) return Response.json({ ticker: id, candlesticks: [] });
    if (path.endsWith("/orderbook")) return Response.json(rawBook());
    return Response.json({ market: rawMarket({ ticker: id }) });
  }, () => initialTime, [sports]);
  await provider.getMarket(ticker);
  await provider.getMarket(ticker);
  assert.equal(calls, 3);
  // Each new detail uses three cache entries. Enough unique contracts must
  // evict the original while the clock stays inside every resource's TTL.
  for (let index = 0; index < 87; index++) await provider.getMarket(`KXNBA-27-TEST${index}`);
  const before = calls;
  await provider.getMarket(ticker);
  assert.equal(calls - before, 3);
});

test("concurrent unique ticker requests are bounded without evicting or duplicating pending requests", async () => {
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  let quoteCalls = 0;
  const provider = createMarketProvider(async (url) => {
    const path = new URL(url).pathname;
    const id = path.split("/markets/")[1].split("/")[0];
    if (path.endsWith("/candlesticks")) return Response.json({ ticker: id, candlesticks: [] });
    if (path.endsWith("/orderbook")) return Response.json(rawBook());
    quoteCalls++;
    await barrier;
    return Response.json({ market: rawMarket({ ticker: id }) });
  }, () => initialTime, [sports]);
  const requests = Array.from({ length: 65 }, (_, index) => provider.getMarket(`KXNBA-27-TEST${index}`));
  const completed = Promise.allSettled(requests);
  const duplicate = provider.getMarket("KXNBA-27-TEST0");
  await assert.rejects(requests[64], (error) => error.status === 503);
  assert.equal(quoteCalls, 64);
  release();
  const outcomes = await completed;
  assert.ok(outcomes.slice(0, 64).every((outcome) => outcome.status === "fulfilled"));
  assert.equal((await duplicate).market.ticker, "KXNBA-27-TEST0");
  assert.equal(quoteCalls, 64);
});
