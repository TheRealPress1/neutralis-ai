import type { TickerFeed, TickerQuote } from "./types";

const API_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const QUOTE_TTL = 30_000;
const HISTORY_TTL = 5 * 60_000;
const MAX_STALE_AGE = 5 * 60_000;

// These are specific contracts, not interchangeable topic searches. Keep the
// year/quarter visible, and replace a contract here when its successor opens.
export const TICKER_MARKETS = [
  { id: "KXRATECUT-26DEC31", series: "KXRATECUT", label: "FED CUT BEFORE 2027", question: "Will the Federal Reserve cut rates before 2027?", url: "https://kalshi.com/markets/kxratecut/fed-rate-cut-before-2027/kxratecut-26dec31" },
  { id: "KXBTCMAXY-26DEC31-99999.99", series: "KXBTCMAXY", label: "BTC HITS $100K · 2026", question: "Will Bitcoin hit $100,000 by December 31, 2026?", url: "https://kalshi.com/markets/kxbtcmaxy/how-high-will-bitcoin-get-this-year/kxbtcmaxy-26dec31?op_market_ticker=KXBTCMAXY-26DEC31-99999.99" },
  { id: "KXNBA-27-OKC", series: "KXNBA", label: "OKC CHAMPIONSHIP · 2027", question: "Will Oklahoma City win the 2027 Pro Basketball Finals?", url: "https://kalshi.com/markets/kxnba/pro-basketball-champion/kxnba-27?op_market_ticker=KXNBA-27-OKC" },
  { id: "KXGDP-26OCT30-T2.0", series: "KXGDP", label: "US GDP > 2% · Q3 2026", question: "Will real GDP increase by more than 2.0% in Q3 2026?", url: "https://kalshi.com/markets_by_ticker/KXGDP-26OCT30-T2.0" },
] as const;

type MarketDefinition = (typeof TICKER_MARKETS)[number];
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject : {};
}

export function parsePrice(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

export function normalizeHistory(payload: unknown): number[] {
  const candles = object(payload).candlesticks;
  if (!Array.isArray(candles)) return [];
  return candles
    .map(object)
    .filter((candle) => typeof candle.end_period_ts === "number")
    .sort((a, b) => Number(a.end_period_ts) - Number(b.end_period_ts))
    .map((candle) => {
      const price = object(candle.price);
      // No-trade candles carry the exchange's last observed trade forward.
      return parsePrice(price.close_dollars) ?? parsePrice(price.previous_dollars);
    })
    .filter((price): price is number => price !== null)
    .slice(-24);
}

export function normalizeMarket(definition: MarketDefinition, payload: unknown, history: number[], checkedAt: string): TickerQuote {
  const market = object(object(payload).market);
  if (market.ticker !== definition.id || typeof market.status !== "string") {
    throw new Error("Invalid market response");
  }
  const closed = ["closed", "determined", "disputed", "amended", "finalized"].includes(market.status) || Boolean(market.result);
  // A never-traded market can report a zero placeholder. A real zero-price
  // trade remains valid when volume is present.
  const hasNoTrades = market.volume_fp != null && Number(market.volume_fp) === 0;
  const price = hasNoTrades ? null : parsePrice(market.last_price_dollars);
  const previous = parsePrice(market.previous_price_dollars);
  return {
    id: definition.id,
    label: definition.label,
    question: typeof market.title === "string" ? market.title.replace(/\*\*/g, "") : definition.question,
    url: definition.url,
    price,
    change24h: !closed && price !== null && previous !== null ? Number((price - previous).toFixed(6)) : null,
    history: closed ? [] : history,
    status: closed ? "closed" : market.status === "active" && price !== null ? "live" : "unavailable",
    // Market updated_time is metadata time, not the last trade timestamp.
    updatedAt: checkedAt,
  };
}

function unavailable(definition: MarketDefinition): TickerQuote {
  return { id: definition.id, label: definition.label, question: definition.question, url: definition.url, price: null, change24h: null, history: [], status: "unavailable", updatedAt: null };
}

// Share requests across visitors in each server instance. A failed refresh can
// retain a recent quote, explicitly stale, for at most five minutes.
export function createTickerProvider(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  let cached: { feed: TickerFeed; at: number } | undefined;
  let inFlight: Promise<TickerFeed> | undefined;
  const lastGood = new Map<string, TickerQuote>();
  const histories = new Map<string, { points: number[]; at: number }>();

  async function readJson(path: string): Promise<unknown> {
    const response = await fetcher(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`Market data HTTP ${response.status}`);
    return response.json();
  }

  async function historyFor(market: MarketDefinition): Promise<number[]> {
    const existing = histories.get(market.id);
    if (existing && now() - existing.at < HISTORY_TTL) return existing.points;
    const end = Math.floor(now() / 1000);
    try {
      const payload = await readJson(`/series/${market.series}/markets/${market.id}/candlesticks?start_ts=${end - 86400}&end_ts=${end}&period_interval=60`);
      const points = normalizeHistory(payload);
      histories.set(market.id, { points, at: now() });
      return points;
    } catch {
      // A chart outage must not suppress a valid current quote.
      return [];
    }
  }

  async function quoteFor(market: MarketDefinition): Promise<TickerQuote> {
    try {
      const [payload, history] = await Promise.all([readJson(`/markets/${market.id}`), historyFor(market)]);
      const quote = normalizeMarket(market, payload, history, new Date(now()).toISOString());
      lastGood.set(market.id, quote);
      return quote;
    } catch {
      const previous = lastGood.get(market.id);
      if (previous?.updatedAt && previous.price !== null && now() - Date.parse(previous.updatedAt) < MAX_STALE_AGE) {
        return { ...previous, status: previous.status === "closed" ? "closed" : "stale" };
      }
      return unavailable(market);
    }
  }

  return async function getFeed(): Promise<TickerFeed> {
    if (cached && now() - cached.at < QUOTE_TTL) return cached.feed;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const markets = await Promise.all(TICKER_MARKETS.map(quoteFor));
      const feed: TickerFeed = { markets, fetchedAt: new Date(now()).toISOString() };
      cached = { feed, at: now() };
      return feed;
    })();
    try {
      return await inFlight;
    } finally {
      inFlight = undefined;
    }
  };
}

export const getTickerFeed = createTickerProvider();
