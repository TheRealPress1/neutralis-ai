# Sharadar public demonstration: bounded input check

Checked 2026-09-07 by Astra at repository HEAD `d524b5a75643df5f508c068e3c4fb930ba54b4eb`. No product source changed. This is a small procurement check, not a backtest, complete ingestion test, supplier acceptance or purchase. Sharadar documents a public AAPL demonstration key; no user credential, registration or paid subscription was used. [Public demonstration access](https://sharadar.com/docs/auth)

Three bounded GETs returned HTTP 200 at approximately 2026-09-07T00:22:14Z: one annual as-reported fundamentals observation and three trading sessions each of prices and daily market capitalization. Raw responses and request/retrieval/hash receipts remain private under `.context/data-procurement-20260907/`, outside Git. This disposable copy is evaluation evidence, not the durable storage arrangement proposed for purchased inputs.

| Response | Bytes | SHA-256 |
| --- | ---: | --- |
| fundamentals-public-demo.json | 221 | `0927dd68376a8865d7f745ec784141f308cb911c5237e44553a3700f64adde06` |
| stocks-public-demo.json | 551 | `ba0c07719b5073bc6b37e69c6c1fac93f056215f5a98bc59ffbb78709ba9218a` |
| daily-public-demo.json | 281 | `21f86cc3c899936cb2bf36de96542c4e94180c9d0b6f79d4c3083273489570c1` |

The annual request selected AAPL, `dimension=ARY`, dates 2023-10-01 through 2023-12-31, and a ten-row limit. The returned period end was 2023-09-30 and filing-indexed date 2023-11-03. Revenue, cost of revenue, gross profit and assets exactly matched the previously independently verified [original SEC filing facts](PUBLIC-DATA-CHECK.md) after converting the SEC statement's USD millions to the API's currency units. Gross profit/assets was approximately 0.4797395223. A local Python 3 arithmetic/hash check passed all seven value/date/identity comparisons; its result is `crosscheck-result.json` in the evaluation directory.

The result is limited:

- The requested documented `fiscalperiod` field was absent from this projected response. We did not silently substitute it; fiscal duration still comes from the original filing. This is a schema/sample question for the supplier.
- The annual row's `lastupdated` was 2026-07-31. Today's reconstructed ARY record does not prove the exact contents or timing of a historical vendor delivery. The proposed study permits a clearly labelled public-information reconstruction with a declared delivery delay; it does not claim archival feed replay.
- Prices cover only November 1–3, 2023. They were not independently reconciled to market prints. These ordinary sessions do not test a split, merger, suspended open or terminal outcome.
- Daily market capitalization is documented in USD millions, unlike the fundamentals currency-unit amounts. A successful response does not establish its security/share-class aggregation or full historical-universe coverage. [Daily table definitions](https://sharadar.com/docs/daily)
- No restatement case, disappeared issuer, classification change, dividend payment, share-class join, bulk entitlement, incremental correction, shared license or backup restoration was accepted by this example.

The public five-year/Dow-30 sample is useful for pipeline mechanics, but cannot establish the original experiment's long history and disappearing-company coverage. Broader authorized samples and package/rights answers remain necessary. [Sample scope](https://sharadar.com/sample), [procurement assessment](DATA-PURCHASE-REVIEW.md)
