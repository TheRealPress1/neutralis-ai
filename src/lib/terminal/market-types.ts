export type MarketCategory = "Politics" | "Sports" | "Crypto" | "Economics" | "Other";
export type MarketDataStatus = "live" | "stale" | "unavailable";

export interface TerminalMarket {
  ticker: string;
  eventTicker: string;
  title: string;
  subtitle: string;
  category: MarketCategory;
  /** All prices are dollars in [0, 1]; null means unavailable. */
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  lastPrice: number | null;
  /** Absolute dollar price change, not percentage return. */
  change24h: number | null;
  /** Contract counts, not dollar volume. */
  volume24h: number | null;
  openInterest: number | null;
  closeTime: string | null;
  status: MarketDataStatus | "closed";
  exchangeStatus: string;
  url: string;
  /** When these quotes were successfully fetched; not exchange metadata time. */
  updatedAt: string;
}

export interface TerminalMarketList {
  markets: TerminalMarket[];
  total: number;
  fetchedAt: string;
  status: MarketDataStatus;
  /** Search only covers the curated series loaded by this service. */
  scope: string;
  query: string;
  category: MarketCategory | null;
  warnings: string[];
}

export interface MarketHistoryPoint {
  /** Exchange candle end timestamp, Unix seconds. */
  time: number;
  /** Last traded YES price in dollars; only actual trade candles included. */
  price: number;
}

export interface OrderbookLevel {
  /** Resting bid price in dollars. */
  price: number;
  quantity: number;
}

export interface TerminalMarketDetail {
  market: TerminalMarket;
  history: MarketHistoryPoint[];
  historyStatus: MarketDataStatus;
  historyUpdatedAt: string | null;
  /** YES and NO bid depth, highest bids first. These are not ask books. */
  orderbook: { yes: OrderbookLevel[]; no: OrderbookLevel[] };
  orderbookStatus: MarketDataStatus;
  orderbookUpdatedAt: string | null;
  rules: { primary: string; secondary: string };
  /** Expected resolution date versus final contractual expiration deadline. */
  settlementTime: string | null;
  expirationTime: string | null;
  fetchedAt: string;
  warnings: string[];
}

export interface TerminalApiError {
  error: string;
  code: "INVALID_REQUEST" | "NOT_FOUND" | "UPSTREAM_UNAVAILABLE";
}
