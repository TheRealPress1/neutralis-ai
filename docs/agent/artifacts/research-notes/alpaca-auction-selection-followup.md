# Alpaca auction selection: bounded documentary follow-up

Observed 2026-09-07 UTC (clock receipt 23:01:51). Internal GPT research, not Fable or an implementation verdict. Read current `EQUITIES-OFFICIAL-OPEN-20260907.md` and `EQUITIES-MINIMUM-DATA-20260907.md`. Only public Alpaca documentation and the previously preserved public schema were examined; no market-data endpoint, account, dataset, stream, agreement retry or contact.

**Result:** candidate identification remains documented, but no sufficient historical-auction selection/correction/publication contract was found. The established SPY/Arca/Q bridge is retained without redoing its source-protocol research. “Undocumented in the sources examined” does not mean unsupported by the service.

The current [Alpaca OpenAPI document](https://docs.alpaca.markets/us/openapi/market-data-api.json), JSON pointers under `/components/schemas/`, documents:

| Schema / requirement | Documented fact and exact remaining gap |
|---|---|
| `stock_auction` | Required `t`, `x`, `p`, `c`; optional `s` (auction trade size). No documented trade/event ID, predecessor ID, cancellation state, revision or publication field. |
| `stock_daily_auctions` | Required `d` (date), `o` (opening array), `c` (closing array). No core/early session discriminator or guarantee of one opening record per venue/condition. |
| Opening selection | `o` is described only as opening auctions. No documented uniqueness, priority, supersession or first/last-selection rule. Only closing `c` deduplicates price/exchange/condition triplets using their earliest timestamp. |
| `timestamp` referenced by auction `t` | RFC-3339, nanosecond precision. No stated exchange-publication/SIP-processing/vendor-ingestion mapping, revision clock or availability guarantee. |
| `stock_auctions_resp_single` | Required `auctions`, `symbol`, `next_page_token`; optional `currency`. No documented version/vintage or coverage-completeness marker. |

These auction definitions also appear in the [previously pinned official CLI schema](https://raw.githubusercontent.com/alpacahq/cli/53606273aa230a40c64b783425dcb3f4423ede30/api/specs/market-data-api.json). Their omissions do not prove that historical results retain canceled records or fail to apply corrections; neither behavior is specified here.

The [historical-auctions reference](https://docs.alpaca.markets/us/reference/stockauctionsingle-1) documents SIP-only feed, inclusive interval boundaries, ascending/descending sorting and continuation through `next_page_token`. Its `asof` selects the underlying entity/name history, not the data vintage. Therefore query sorting, limiting or `asof` does not provide a documented official-open choice or reconstruct what a noon retrieval would have contained. No auction-specific correction or finality guarantee appears on this page. It displays “Updated 3 months ago,” without an immutable revision date.

Alpaca does document **separate stock-stream lineage**: trade `i`; correction `oi`/`ci` and original/corrected price, size and conditions; cancel/error `i` and `a`. Corrections and cancels arrive with trade-channel subscriptions. Their timestamps are described by format only. The page does not document a join to auction-array records, historical correction replay for that endpoint, or how those mutations are reflected in historical auctions. A stream capability cannot fill that REST contract gap by inference. [Real-time Stock Data, Trades / Trade Corrections / Trade Cancels](https://docs.alpaca.markets/us/docs/real-time-stock-pricing-data)

Two timestamp statements were checked without extending their scope: the [FAQ's aggregation section](https://docs.alpaca.markets/us/docs/market-data-faq) calls the underlying trade timestamp SIP time when explaining bars; it does not map auction `t`. The official JS SDK's [Timestamp precision note](https://raw.githubusercontent.com/alpacahq/alpaca-trade-api-js/master/docs/docs/market-data.md) preserves auction `timestampRaw` alongside millisecond `Date`; preserving wire precision supplies neither clock origin nor correction identity.

**Scoped fallback implication:** retain the auction endpoint as a candidate, with its selection, correction and source-clock evidence unadmitted. Under unchanged v4, leave the dependent opening-price observation unresolved; do not substitute daily OHLC, another venue, an arbitrary first/last Q, exactly 09:30, or a present-day snapshot for deadline evidence. No stream or alternative-provider acquisition is authorized by this note.

Custody: pinned CLI revision `53606273aa230a40c64b783425dcb3f4423ede30` (2026-08-28T16:19:45Z), schema API version 1.1, previously captured SHA-256 `56b0278e0eca3dde122304b5dd6b74abfab6848123141a7947bc15614d8843b7`; local `.context/official-open-pinned-market-data-api.json`. Current documentation was read through the public web reader and relevant definitions compared, not byte-hash matched. A separate direct request for the public OpenAPI JSON returned HTTP 403; no retry and no fresh hash claimed. SDK master documentation is mutable and was read as documentary text only, without installation or execution.
