/** Public, read-only comparison data. All prices/spreads are USD per contract. */
export type OpportunityVenue = "kalshi" | "polymarket_us";
export type OpportunityDataStatus = "live" | "stale" | "unavailable";
export type OpportunityPairDirection = "kalshi_yes_polymarket_no" | "polymarket_yes_kalshi_no";
export interface OpportunityLevel { price: number; size: number }
export interface OpportunityBook {
  yesAsks: OpportunityLevel[];
  noAsks: OpportunityLevel[];
  status: OpportunityDataStatus;
  /** Local successful read time; never advanced by serving stale cache. */
  fetchedAt: string | null;
  /** Exchange book timestamp when supplied; not metadata updatedAt. */
  exchangeTimestamp: string | null;
}
export interface OpportunityFee {
  status: "unknown" | "schedule_available";
  sourceUrl: string;
  coefficient: number | null;
  note: string;
}
export interface OpportunityMarket {
  venue: OpportunityVenue;
  marketId: string;
  title: string;
  yesOutcome: string;
  url: string;
  rulesUrl: string;
  rules: string;
  closeTime: string | null;
  expectedSettlementTime: string | null;
  exchangeStatus: string;
  metadataFetchedAt: string;
  book: OpportunityBook;
  fee: OpportunityFee;
}
export interface OpportunityPair {
  direction: OpportunityPairDirection;
  kalshiOutcome: "yes" | "no";
  polymarketOutcome: "yes" | "no";
  kalshiAsk: number | null;
  polymarketAsk: number | null;
  /** Best ask sum; no fees, no fill guarantee. */
  combinedPrice: number | null;
  /** 1 minus combinedPrice. A hypothetical $1 payout, NOT verified profit. */
  grossSpread: number | null;
  netEdge: null;
  /** Minimum displayed quantity at the two best asks, not total book size. */
  availableSize: number | null;
  status: OpportunityDataStatus;
  warnings: string[];
}
export interface Opportunity {
  /** Versioned reversible identity: v1~KALSHI-TICKER~polymarket-us-slug. */
  id: string;
  title: string;
  category: "Sports";
  league: string;
  eventDate: string;
  outcome: string;
  status: OpportunityDataStatus;
  fetchedAt: string;
  kalshi: OpportunityMarket;
  polymarketUS: OpportunityMarket;
  pairs: OpportunityPair[];
  match: {
    status: "review_required";
    identity: string;
    evidence: string[];
    unresolvedReasons: string[];
  };
}
export interface OpportunityVenueHealth {
  venue: OpportunityVenue;
  status: OpportunityDataStatus;
  fetchedAt: string | null;
  marketsDiscovered: number;
  message: string;
}
export interface OpportunityFeed {
  opportunities: Opportunity[];
  venues: { kalshi: OpportunityVenueHealth; polymarket_us: OpportunityVenueHealth };
  fetchedAt: string;
  status: OpportunityDataStatus;
  warnings: string[];
  scope: string;
}
