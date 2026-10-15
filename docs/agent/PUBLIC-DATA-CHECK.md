# Public-data check: one original annual filing

Verified 2026-09-06 by Astra and an independent internal reviewer using SEC pages through the web tool. This is a bounded input example, not a strategy backtest or a recommendation concerning Apple. Programmatic SEC ingestion and provider delivery were not tested.

The original Apple FY2023 Form 10-K has accession `0000320193-23-000106`, report period ending 2023-09-30, displayed acceptance `2023-11-02 18:08:27`, and filing date 2023-11-03. The index's acceptance display does not state a timezone; the extracted record preserves it as raw text pending a verified normalization rule. [Original SEC index](https://www.sec.gov/Archives/edgar/data/320193/000032019323000106/0000320193-23-000106-index.html)

| Input | USD millions |
| --- | ---: |
| Annual net sales | 383,285 |
| Annual cost of sales | 214,137 |
| Gross profit, labeled gross margin in the statement | 169,148 |
| Fiscal-year-end total assets | 352,583 |

These figures appear in the original annual filing's consolidated income statement and balance sheet. The report identifies FY2023 as a 53-week year; retain the fiscal duration instead of silently converting it into a standard 365-day observation. [Original SEC 10-K](https://www.sec.gov/Archives/edgar/data/320193/000032019323000106/aapl-20230930.htm)

Calculated gross profitability is `(383285 - 214137) / 352583 = 0.4797395223`, approximately **47.97%**. This is gross profit/assets; gross profit/revenue is a different metric. The calculation does not measure a predicted stock return.

Under the proposed monthly decision schedule, these original annual-filing inputs cannot be used for September or October 2023 decisions. Their earliest possible scheduled decision is November 30, with hypothetical execution on December 1, conditional on usable pipeline delivery before the cutoff and the separate eligibility rules. We did not establish whether Apple would be selected, nor whether the strategy would benefit from selecting it.

The example demonstrates why period-end is not an availability timestamp. Original accession evidence also distinguishes this filing from later reports that might repeat or revise the same fiscal period. It does not establish vendor point-in-time coverage across many issuers or years.

A small structured fact record is retained in [evidence/apple-fy2023-original.json](evidence/apple-fy2023-original.json). It contains extracted public facts and source links, not a raw source-file capture or a production ingestion receipt. Its creation date is 2026; that must not be confused with when the filing became public in 2023.
