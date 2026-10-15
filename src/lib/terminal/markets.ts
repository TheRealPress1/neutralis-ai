import type { MarketCategory, MarketDataStatus, MarketHistoryPoint, OrderbookLevel, TerminalMarket, TerminalMarketDetail, TerminalMarketList } from "./market-types";

const API_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const LIST_TTL = 30_000;
const DETAIL_TTL = 15_000;
const HISTORY_TTL = 120_000;
const FAILURE_TTL = 10_000;
const MAX_STALE_AGE = 120_000;
const MAX_CACHE_ENTRIES = 256;
const MAX_IN_FLIGHT = 64;
const SCOPE = "Search open contracts in selected Kalshi series: NBA and NFL championships, US Senate control, Fed cuts, US GDP, Bitcoin and Ethereum yearly highs.";

export interface MarketSeries {
  ticker: string;
  category: MarketCategory;
  label: string;
  slug: string;
}

// Series membership and open contracts were verified against Kalshi's public
// API. This is a curated universe, not an exchange-wide search endpoint.
export const MARKET_SERIES: readonly MarketSeries[] = [
  { ticker: "KXNBA", category: "Sports", label: "NBA championship", slug: "pro-basketball-champion" },
  { ticker: "KXSB", category: "Sports", label: "NFL championship", slug: "pro-football-champion" },
  { ticker: "CONTROLS", category: "Politics", label: "US Senate control", slug: "senate-control" },
  { ticker: "KXRATECUT", category: "Economics", label: "Fed cuts", slug: "fed-rate-cut-before-2027" },
  { ticker: "KXGDP", category: "Economics", label: "US GDP growth", slug: "us-gdp-growth" },
  { ticker: "KXBTCMAXY", category: "Crypto", label: "Bitcoin yearly highs", slug: "how-high-will-bitcoin-get-this-year" },
  { ticker: "KXETHMAXY", category: "Crypto", label: "Ethereum yearly highs", slug: "how-high-will-ethereum-get-this-year" },
];

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\*\*/g, "").trim() : "";
}

export function parsePrice(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

export function parseQuantity(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER ? parsed : null;
}

function date(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function isValidTicker(ticker: string): boolean {
  return /^[A-Z0-9][A-Z0-9.-]{1,119}$/.test(ticker);
}

function marketCategory(value: unknown): MarketCategory {
  const category = text(value).toLowerCase();
  if (category === "politics" || category === "elections") return "Politics";
  if (category === "sports") return "Sports";
  if (category === "crypto") return "Crypto";
  if (category === "economics" || category === "financials") return "Economics";
  return "Other";
}

export class MarketApiError extends Error {
  status: number;
  code: "INVALID_REQUEST" | "NOT_FOUND" | "UPSTREAM_UNAVAILABLE";
  constructor(message: string, status: number, code: "INVALID_REQUEST" | "NOT_FOUND" | "UPSTREAM_UNAVAILABLE") {
    super(message);
    this.name = "MarketApiError";
    this.status = status;
    this.code = code;
  }
}

class UpstreamError extends Error {
  status: number;
  constructor(status: number) {
    super(`Kalshi returned HTTP ${status}`);
    this.status = status;
  }
}

export function normalizeMarket(payload: unknown, series: MarketSeries, checkedAt: string, expectedTicker?: string): TerminalMarket {
  const market = object(payload);
  const ticker = text(market.ticker);
  const eventTicker = text(market.event_ticker);
  const title = text(market.title);
  const exchangeStatus = text(market.status);
  if (!isValidTicker(ticker) || !isValidTicker(eventTicker) || (ticker !== series.ticker && !ticker.startsWith(`${series.ticker}-`)) || (eventTicker !== series.ticker && !eventTicker.startsWith(`${series.ticker}-`)) || (ticker !== eventTicker && !ticker.startsWith(`${eventTicker}-`)) || !title || !exchangeStatus || (expectedTicker && ticker !== expectedTicker)) {
    throw new Error("Invalid or mismatched Kalshi market response");
  }

  const closed = ["closed", "determined", "disputed", "amended", "finalized", "settled"].includes(exchangeStatus) || Boolean(market.result);
  const lastPrice = parseQuantity(market.volume_fp) === 0 ? null : parsePrice(market.last_price_dollars);
  const previousPrice = parsePrice(market.previous_price_dollars);
  // Zero-size quote placeholders are not executable prices. The NO sizes
  // correspond to the opposite YES side in Kalshi's binary order book.
  const yesBid = parseQuantity(market.yes_bid_size_fp) === 0 ? null : parsePrice(market.yes_bid_dollars);
  const yesAsk = parseQuantity(market.yes_ask_size_fp) === 0 ? null : parsePrice(market.yes_ask_dollars);
  const noBid = parseQuantity(market.yes_ask_size_fp) === 0 ? null : parsePrice(market.no_bid_dollars);
  const noAsk = parseQuantity(market.yes_bid_size_fp) === 0 ? null : parsePrice(market.no_ask_dollars);
  return {
    ticker,
    eventTicker,
    title,
    subtitle: text(market.yes_sub_title) || text(market.subtitle),
    category: series.category,
    yesBid, yesAsk, noBid, noAsk, lastPrice,
    change24h: !closed && lastPrice !== null && previousPrice !== null ? Number((lastPrice - previousPrice).toFixed(6)) : null,
    volume24h: parseQuantity(market.volume_24h_fp),
    openInterest: parseQuantity(market.open_interest_fp),
    closeTime: date(market.close_time),
    status: closed ? "closed" : exchangeStatus === "active" && [yesBid, yesAsk, noBid, noAsk, lastPrice].some((price) => price !== null) ? "live" : "unavailable",
    exchangeStatus,
    // This official exact-ticker route avoids guessing marketing slugs or
    // selecting the first outcome of a multi-outcome event.
    url: `https://kalshi.com/markets_by_ticker/${encodeURIComponent(ticker)}`,
    updatedAt: checkedAt,
  };
}

export function normalizeHistory(payload: unknown, expectedTicker: string): MarketHistoryPoint[] {
  const response = object(payload);
  if (response.ticker !== expectedTicker || !Array.isArray(response.candlesticks)) throw new Error("Invalid or mismatched history response");
  const points = new Map<number, number>();
  for (const value of response.candlesticks) {
    const candle = object(value);
    const time = candle.end_period_ts;
    const price = parsePrice(object(candle.price).close_dollars);
    // Do not manufacture chart points for hours with no observed trade.
    if (typeof time === "number" && Number.isSafeInteger(time) && time > 0 && price !== null) points.set(time, price);
  }
  return [...points].sort(([a], [b]) => a - b).map(([time, price]) => ({ time, price }));
}

export function normalizeOrderbook(payload: unknown, expectedTicker?: string): TerminalMarketDetail["orderbook"] {
  const response = object(payload);
  if (expectedTicker && response.ticker !== undefined && response.ticker !== expectedTicker) throw new Error("Mismatched order book response");
  const book = object(response.orderbook_fp);
  if (!("yes_dollars" in book) || !("no_dollars" in book)) throw new Error("Invalid order book response");
  const side = (value: unknown): OrderbookLevel[] => {
    if (value === null) return [];
    if (!Array.isArray(value)) throw new Error("Invalid order book levels");
    const byPrice = new Map<number, number>();
    for (const level of value) {
      if (!Array.isArray(level) || level.length < 2) continue;
      const price = parsePrice(level[0]);
      const quantity = parseQuantity(level[1]);
      if (price === null || quantity === null || quantity === 0) continue;
      const total = (byPrice.get(price) ?? 0) + quantity;
      if (Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER) byPrice.set(price, total);
    }
    return [...byPrice].sort(([a], [b]) => b - a).slice(0, 20).map(([price, quantity]) => ({ price, quantity }));
  };
  return { yes: side(book.yes_dollars), no: side(book.no_dollars) };
}

type Resource<T> = { data: T | null; status: MarketDataStatus; updatedAt: string | null; upstreamStatus?: number };
type CachedResource = { data: unknown | null; loadedAt: number | null; checkedAt: number; status: MarketDataStatus; upstreamStatus?: number };
type MarketRecord = { market: TerminalMarket; seriesTicker: string; rules: TerminalMarketDetail["rules"]; settlementTime: string | null; expirationTime: string | null };

export function createMarketProvider(fetcher: typeof fetch = fetch, now: () => number = Date.now, seriesList: readonly MarketSeries[] = MARKET_SERIES) {
  const cache = new Map<string, CachedResource>();
  const inFlight = new Map<string, Promise<Resource<unknown>>>();

  async function readJson(path: string): Promise<unknown> {
    const response = await fetcher(`${API_BASE}${path}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new UpstreamError(response.status);
    return response.json();
  }

  function resource<T>(entry: CachedResource): Resource<T> {
    const expired = entry.status !== "live" && (entry.loadedAt === null || now() - entry.loadedAt > MAX_STALE_AGE);
    return { data: expired ? null : entry.data as T | null, status: expired ? "unavailable" : entry.status, updatedAt: expired || entry.loadedAt === null ? null : new Date(entry.loadedAt).toISOString(), upstreamStatus: entry.upstreamStatus };
  }

  async function load<T>(key: string, ttl: number, reader: () => Promise<T>): Promise<Resource<T>> {
    const existing = cache.get(key);
    if (existing && now() - existing.checkedAt < (existing.status === "live" ? ttl : FAILURE_TTL)) return resource<T>(existing);
    const pending = inFlight.get(key);
    if (pending) return pending as Promise<Resource<T>>;
    // Do not evict running promises: that would allow duplicate upstream work.
    // Bound distinct requests instead, retaining only explicitly stale cached
    // data when a burst of arbitrary account tickers exhausts this instance.
    if (inFlight.size >= MAX_IN_FLIGHT) {
      return existing ? resource<T>({ ...existing, status: "stale" }) : { data: null, status: "unavailable", updatedAt: null };
    }
    const request = (async (): Promise<Resource<T>> => {
      let entry: CachedResource;
      try {
        const data = await reader();
        entry = { data, loadedAt: now(), checkedAt: now(), status: "live" };
      } catch (error) {
        const upstreamStatus = error instanceof UpstreamError ? error.status : undefined;
        const canKeep = upstreamStatus !== 404 && existing?.data != null && existing.loadedAt !== null && now() - existing.loadedAt <= MAX_STALE_AGE;
        entry = { data: canKeep ? existing.data : null, loadedAt: canKeep ? existing.loadedAt : null, checkedAt: now(), status: canKeep ? "stale" : "unavailable", upstreamStatus };
      }
      cache.delete(key);
      cache.set(key, entry);
      if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
      return resource<T>(entry);
    })();
    inFlight.set(key, request);
    try { return await request; } finally { inFlight.delete(key); }
  }

  async function getMarkets(options: { query?: string; category?: MarketCategory | null } = {}): Promise<TerminalMarketList> {
    const query = (options.query ?? "").trim();
    if (query.length > 120) throw new MarketApiError("Search must be 120 characters or fewer.", 400, "INVALID_REQUEST");
    const groups = await Promise.all(seriesList.map(async (series) => {
      const result = await load(`series:${series.ticker}`, LIST_TTL, async () => {
        const response = object(await readJson(`/markets?series_ticker=${series.ticker}&status=open&limit=200`));
        if (!Array.isArray(response.markets)) throw new Error("Invalid market list");
        const checkedAt = new Date(now()).toISOString();
        const markets = response.markets.map((market) => normalizeMarket(market, series, checkedAt)).filter((market) => market.exchangeStatus === "active");
        return { markets, truncated: Boolean(response.cursor) };
      });
      return { series, ...result };
    }));
    const warnings: string[] = [];
    const markets: TerminalMarket[] = [];
    for (const group of groups) {
      if (group.status !== "live") warnings.push(`${group.series.label}: ${group.status === "stale" ? "showing recent cached quotes" : "data temporarily unavailable"}.`);
      if (group.data?.truncated) warnings.push(`${group.series.label}: showing the first 200 open contracts in this series.`);
      for (const market of group.data?.markets ?? []) markets.push({ ...market, status: group.status === "stale" && market.status === "live" ? "stale" : market.status });
    }
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = markets.filter((market) => (!options.category || market.category === options.category) && terms.every((term) => `${market.title} ${market.subtitle} ${market.ticker} ${market.category}`.toLowerCase().includes(term)))
      .sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1) || a.ticker.localeCompare(b.ticker));
    return { markets: filtered, total: filtered.length, fetchedAt: new Date(now()).toISOString(), status: groups.every((group) => group.status === "unavailable") ? "unavailable" : groups.some((group) => group.status !== "live") ? "stale" : "live", scope: SCOPE, query, category: options.category ?? null, warnings };
  }

  async function getMarket(ticker: string): Promise<TerminalMarketDetail> {
    if (!isValidTicker(ticker)) throw new MarketApiError("Invalid market ticker.", 400, "INVALID_REQUEST");
    const knownSeries = seriesList.find((item) => ticker.startsWith(`${item.ticker}-`));
    const quote = await load<MarketRecord>(`market:${ticker}`, DETAIL_TTL, async () => {
      const response = object(await readJson(`/markets/${encodeURIComponent(ticker)}`));
      const raw = object(response.market);
      // Account positions may belong to markets outside the curated browser.
      // Resolve their series from the exchange event, never a user URL or a
      // guessed ticker split (series identifiers can themselves contain '-').
      if (raw.ticker !== ticker || !isValidTicker(text(raw.event_ticker))) throw new Error("Invalid or mismatched market identity");
      let series = knownSeries;
      if (!series) {
        const eventTicker = text(raw.event_ticker);
        const metadata = await load<MarketSeries>(`event:${eventTicker}`, 300_000, async () => {
          const eventResponse = object(await readJson(`/events/${encodeURIComponent(eventTicker)}`));
          const event = object(eventResponse.event);
          const seriesTicker = text(event.series_ticker);
          if (event.event_ticker !== eventTicker || !isValidTicker(seriesTicker)) throw new Error("Invalid or mismatched event identity");
          return { ticker: seriesTicker, category: marketCategory(event.category), label: text(event.title), slug: "" };
        });
        if (!metadata.data) throw new Error("Market event metadata unavailable");
        series = metadata.data;
      }
      const market = normalizeMarket(raw, series, new Date(now()).toISOString(), ticker);
      return { market, seriesTicker: series.ticker, rules: { primary: text(raw.rules_primary), secondary: text(raw.rules_secondary) }, settlementTime: date(raw.expected_expiration_time), expirationTime: date(raw.expiration_time) };
    });
    if (!quote.data) {
      if (quote.upstreamStatus === 404) throw new MarketApiError("This Kalshi market was not found.", 404, "NOT_FOUND");
      throw new MarketApiError("Market data is temporarily unavailable. Please retry.", 503, "UPSTREAM_UNAVAILABLE");
    }
    const [history, orderbook] = await Promise.all([
      load(`history:${ticker}`, HISTORY_TTL, async () => {
        const end = Math.floor(now() / 1000);
        const payload = await readJson(`/series/${encodeURIComponent(quote.data!.seriesTicker)}/markets/${encodeURIComponent(ticker)}/candlesticks?start_ts=${end - 7 * 86400}&end_ts=${end}&period_interval=60`);
        return normalizeHistory(payload, ticker).filter((point) => point.time <= end && point.time >= end - 7 * 86400);
      }),
      load(`book:${ticker}`, DETAIL_TTL, async () => normalizeOrderbook(await readJson(`/markets/${encodeURIComponent(ticker)}/orderbook?depth=20`), ticker)),
    ]);
    const warnings: string[] = [];
    if (quote.status !== "live") warnings.push("Market quotes are cached. Fresh quotes are temporarily unavailable.");
    if (history.status !== "live") warnings.push(history.status === "stale" ? "Price history is cached." : "Price history is temporarily unavailable.");
    if (orderbook.status !== "live") warnings.push(orderbook.status === "stale" ? "Order book is cached; do not treat it as current liquidity." : "Order book is temporarily unavailable.");
    return {
      rules: quote.data.rules,
      settlementTime: quote.data.settlementTime,
      expirationTime: quote.data.expirationTime,
      market: { ...quote.data.market, status: quote.status === "stale" && quote.data.market.status === "live" ? "stale" : quote.data.market.status },
      history: history.data ?? [], historyStatus: history.status, historyUpdatedAt: history.updatedAt,
      orderbook: orderbook.data ?? { yes: [], no: [] }, orderbookStatus: orderbook.status, orderbookUpdatedAt: orderbook.updatedAt,
      fetchedAt: new Date(now()).toISOString(), warnings,
    };
  }

  return { getMarkets, getMarket };
}

export const terminalMarketProvider = createMarketProvider();
