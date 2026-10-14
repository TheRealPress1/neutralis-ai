export interface TickerQuote {
  id: string;
  label: string;
  question: string;
  url: string;
  /** YES last trade price in dollars, from 0 to 1. */
  price: number | null;
  /** Absolute change in dollars over 24 hours, not percentage return. */
  change24h: number | null;
  /** Recorded YES prices in chronological order, in dollars. */
  history: number[];
  status: "live" | "stale" | "closed" | "unavailable";
  updatedAt: string | null;
}

export interface TickerFeed {
  markets: TickerQuote[];
  fetchedAt: string;
}
