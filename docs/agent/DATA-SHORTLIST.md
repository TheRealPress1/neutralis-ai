# Historical equity data acceptance gates

Updated 2026-09-07. The founder requested a broad provider comparison and API assessment before purchase. The initial three-provider shortlist is superseded by the [fifteen-route purchase review](DATA-PURCHASE-REVIEW.md), including Sharadar, Tiingo, FMP, Intrinio, SimFin, EODHD, Alpha Vantage, Norgate, Massive, Databento, Alpaca, QuantConnect/Morningstar, CRSP/S&P, FactSet and LSEG. No supplier is accepted, contacted or purchased.

The next technical-clarification candidates are Sharadar, Tiingo and FactSet, with FMP as a practical challenger and CRSP/S&P as a quality/price benchmark. Budget, exact coverage, package entitlements and suitable two-person terms remain unresolved. That order is provisional and does not assume every institutional option is affordable.

Corrections to the initial screen are retained in the purchase review: Sharadar documents historical SIC changes and partial acquisition-consideration coverage but explicitly lacks historical exchange changes; Norgate explicitly offers a paid friend/relative sharing route; EODHD bulk fundamentals requires an additional quoted plan. Tiingo and FactSet have documented original-information/PIT API routes and deserve comparison.

A small [public Sharadar AAPL check](SHARADAR-PUBLIC-DEMO-CHECK.md) matched one original annual filing's financial values and dates. That is not population-wide sample acceptance. The following checks remain pending on authorized broader samples.

## Five sample acceptance checks

Run these on data we are authorized to evaluate, before a substantive subscription commitment where evaluation access permits. They are proposed checks, not completed tests or proof of population-wide quality.

1. **Universe and identity:** reconstruct five month-ends across the proposed history, including firms that subsequently disappeared. Reconcile changing/reused tickers, secondary share classes, dated classifications and then-known shares or market capitalization. Record eligible counts and fundamentals exclusions. Later survival or today's metadata must not determine membership.
2. **As-known annual financials:** sample at least twenty original annual filings across early/recent history, including restatements and late filings. Match gross profit/assets, fiscal period and units to SEC originals; retain accession and acceptance timestamp plus vendor availability semantics. Confirm no later correction is attached to an earlier decision date. If the proposed historical acceptance evidence cannot be obtained, label that coverage limitation explicitly.
3. **Corporate-action ledger:** reconcile ten splits, ten dividends and selected spinoff, cash-merger, stock-merger, bankruptcy and exchange-transfer cases. Reconstruct shares, cash and event-period returns. An adjusted/raw price ratio is a cumulative adjustment factor, not the dividend amount. Unknown terminal proceeds remain an explicit data failure, with any sensitivity assumption labeled separately.
4. **Executable prices and delivery:** reconcile raw closes and reconstructed/raw opens against independent event examples; test split days and missing/suspended sessions. Check when each feed could actually have delivered the values. Same-day public filing date alone does not prove timely vendor delivery.
5. **Reproduction and revision:** load authorized samples on Linux into the proposed Parquet/DuckDB structure, hash source files and retain manifests. Reproduce the same ledger from frozen inputs and test backup restoration. Compare a later download for revisions. This detects current correction behavior; it does not establish what the vendor delivered many years ago.

## Decision rule and comparable request

Essential gates are history/universe, original annual inputs and availability, price/action correctness, reproducible delivery and suitable actual-use rights/price. An unresolved essential gate means the quoted package has not qualified for the current experiment. A sample can justify a bounded pilot; it cannot establish complete historical quality.

Vendor-delivery archives from every historical day and unrestricted external-model uploads are not mandatory. The proposed contract permits a labelled public-information reconstruction with a declared delivery lag and numeric processing within licensed infrastructure. Dividend payment-date gaps require the existing documented cash-delay sensitivity, not silent same-day reinvestment. Missing terminal outcomes require resolution or explicit bounds before affected returns are interpreted.

The [vendor-neutral inquiry draft](DATA-INQUIRY-DRAFT.md) is concrete and unsent. It requests the full study window and initialization history, adverse cases and historical cross-sections, exact API/bulk/correction entitlements, and a suitable two-user quote. No supplier contact or purchase is authorized by this public review. Storage follows the [accepted initial architecture](STACK-RECOMMENDATION.md).
