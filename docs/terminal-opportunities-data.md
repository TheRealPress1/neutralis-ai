# Public opportunity comparison feed

This workspace compares **Kalshi with Polymarket US**, using unauthenticated, read-only HTTP. It does not use international Polymarket, credentials, accounts, orders, a database or a trading daemon. `opportunityProvider.getOpportunities()` returns the typed feed; `getOpportunity(id)` revalidates a saved exact identity with at most four public requests. `GET /api/terminal/opportunities` returns structured health even during an outage. The detail route returns the raw `Opportunity`, or 400/404/503 with an error.

## Coverage and identity

Discovery reads the first 200 open contracts in each of `KXNBAGAME`, `KXNHLGAME`, `KXNFLGAME`, `KXMLBGAME`, and the first 500 US markets using the observed working `marketTypes=moneyline` filter. It never claims a complete scan. The first twelve exact identities by scheduled date receive books. Public API filters are treated as hints: market status, full-game moneyline type, two tradable sides and identities are validated locally.

Identity requires the same supported league, both explicit team abbreviations (with a small documented alias map), the original scheduled date in **both rule texts**, agreement with source identifiers, and the same YES/long team. It does not use text similarity, `outcomePrices`, last trade, source `updatedAt`, expiration date or UTC start-date slicing. US `outcomes` array order has been observed to disagree with its price array; the explicit `marketSides.long` field determines YES.

Ambiguous duplicate same-day identities are excluded. MLB additionally requires original rule time, Eastern-time source start, and Kalshi ticker time to agree. Missing formats or contradictory start times exclude that market; therefore MLB coverage is deliberately limited. Saved candidate IDs are versioned `v1~KALSHI-TICKER~us-slug`, parsed against a fixed allowlist, then revalidated from the exact sources. No user-provided URL is fetched.

Every candidate remains `match.status=review_required`. These are identity joins, not settlement-equivalence receipts. Observed NFL/MLB postponement windows differ (US two weeks versus Kalshi two days/48 hours); NBA wording uses calendar days versus elapsed hours. Ties, cancellations, independent fair-value payouts, timing and source authority require review. Exact venue rule text and separate deadlines are returned. Polymarket US links point to its verified market-by-slug JSON source rather than an unverified retail SPA route.

## Prices and economics

Kalshi books contain bids: YES ask is `1 - best NO bid`, and NO ask is `1 - best YES bid`. US books contain YES-coordinate offers/bids: offers are YES asks; `1 - bid` is the NO ask. Positive fractional quantities are preserved. No metadata, midpoint or last-trade fallback is executable depth. Invalid prices/currencies, crossed books, mismatched IDs and missing/future US timestamps fail closed. Both pair directions are explicit and stable.

`combinedPrice` is the two best displayed asks. `grossSpread=1-combinedPrice` assumes a hypothetical combined $1 payout. `availableSize` is the minimum quantity at those exact levels, not total depth. Fees, slippage, funding, rule differences and non-atomic execution are not priced. `netEdge` is always null. Kalshi effective fees remain unknown; the US public fee coefficient and current official schedule link are exposed without assuming account rebates or rounding. A positive gross spread is not a verified arbitrage or profit claim.

## Freshness and bounds

Each public resource has a 30-second cache and in-flight deduplication. Failed refreshes retain successful data for at most 120 seconds, marked stale with **original successful timestamps**. An exchange book timestamp older than 45 seconds is stale even after a successful HTTP fetch. Kalshi does not expose a snapshot timestamp on this endpoint, so its timestamp is explicitly the local successful read. A missing quote remains unavailable. Known closed/removed contracts are excluded. `feed.fetchedAt` is response assembly time, not the time of every underlying quote; consumers must use per-book/per-pair status and timestamps.

HTTP requests time out after 2.4 seconds, with at most eight concurrent requests, a bounded queue, bounded 256-entry resource/failure caches, and no retries. US requests are spaced at least 250ms apart. A 429 starts a ten-second per-host cooldown and is exposed in venue health; queued requests stop without hitting the source. Absent/oldest books are refreshed first so repeated rate limits do not permanently starve the same candidates. Limits are per application process, not a distributed quota. A worker should bound jobs and use the same exact pair direction; never trigger from stale data.

## Evidence and verification

Official documentation verified 2026-10-14:

- [US markets](https://docs.polymarket.us/api-reference/markets/get-markets), [market by slug](https://docs.polymarket.us/api-reference/markets/get-market-by-slug), [book](https://docs.polymarket.us/api-reference/markets/get-market-book), [fees](https://docs.polymarket.us/fees), [rate limits](https://docs.polymarket.us/api-reference/rate-limits).
- [Kalshi orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook), [series/fees metadata](https://docs.kalshi.com/api-reference/market/get-series).

Live unauthenticated reads on 2026-10-15 around 00:39 UTC discovered 222 Kalshi game contracts and 500 US moneyline markets, yielding 86 exact identity candidates. Twelve books were selected; five US books responded before a 429 and remaining books stayed unavailable. This is an observed source limit, despite the current public docs describing a broader 25 requests/second retail limit. The feed reports it rather than filling missing prices. Snapshot counts/prices are transient, not fixtures or production defaults.

Offline tests: `node --experimental-strip-types --test src/lib/terminal/opportunities.test.mjs`. Tests cover explicit long mapping, book complements and fractional size, absence of last-price fallback, malformed/crossed books, source age, cache boundaries and outages, closed states, ambiguity, MLB timing, direct rehydration and request bounds. Also run scoped ESLint and TypeScript `--noEmit`.
