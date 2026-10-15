# Neutralis equity research: options and working proposal

Prepared 2026-09-06 by Astra for Constantine and Gaspar, with Fable independently researching the method and data requirements. Status: options for discussion. Research is authorized; budget, suppliers, infrastructure and implementation lanes are not selected. Prices below were checked on this date and are not a total project quote.

## Proposed storage structure

Use Supabase Postgres for accounts, instrument identifiers, dataset catalogs, strategy versions, experiment metadata, decisions and small dashboard summaries. Preserve original provider responses/files and curated tabular history as immutable files in durable object storage. Query curated files with Python and DuckDB. Keep code, source receipts, experiment manifests and review reports in private Git; keep bulk licensed data outside Git and outside disposable workspaces.

Parquet is a compressed tabular file format; DuckDB can query it directly and read only the columns/filtered data an analysis needs. That makes exact frozen dataset snapshots practical without tying the research code to a particular cloud vendor. [DuckDB Parquet documentation](https://duckdb.org/docs/current/data/parquet/overview)

Postgres can also handle a modest daily-price dataset. The proposed split is for reproducibility, portable files, and separating experimental scans from the app's queries, not because daily stock data necessarily requires a large warehouse. An illustrative 500-stock universe over 15 years at roughly 252 sessions/year is about 1.89 million daily rows; this says nothing about the size of news archives, raw filings or intraday data.

| Option | What it uses | When it fits | Verified cost basis and limits |
| --- | --- | --- | --- |
| A. Small research pilot | Python/DuckDB and Parquet on a research computer, with a durable remote copy and manifest; add Supabase metadata when a shared app needs it | Lowest initial infrastructure commitment; useful for a sample-data feasibility experiment | No DuckDB service subscription is needed for local execution. Machine/remote-storage costs, data and model usage are separate. A disposable Conductor disk is only a cache. |
| B. Supabase-centered | Supabase database plus ordinary private Storage buckets and a tested independent file backup; the same Python/DuckDB research code | Few primary service accounts and straightforward future dashboard integration | Pro starts at $25/month with one project, 8 GB database disk and 100 GB file storage; additional projects start at $10/month. Data licenses, research compute, backups and usage beyond quotas are separate. |
| C. Separate historical store | Supabase database for metadata plus Cloudflare R2 or Amazon S3 for raw/Parquet snapshots | Larger archive, many downloads, or specific independent retention/versioning requirements | R2 Standard currently lists $0.015/GB-month with a 10 GB-month free allowance, request charges and no internet egress charge. Supabase and research compute remain separate. S3 regional costs and retention configuration need a specific comparison before selection. |

Sources: [Supabase pricing](https://supabase.com/pricing), [R2 pricing](https://developers.cloudflare.com/r2/pricing/). As an illustration only, 100 GB-month in R2 Standard produces $1.35 in storage charges after the 10 GB allowance, before requests, backup copies, taxes and every other service. This is not the price of a stock-data subscription or the whole research system.

Recommendation after Fable's challenge: begin with a small sample-data pilot using the portable file structure. For sustained shared research, favor option C with an isolated research metadata database, R2 as one candidate historical store, and a tested independent backup. Option B remains viable for a modest pilot, but it also requires the separate file backup and is not a complete one-service durability solution. Do not buy a warehouse or build a distributed data platform before measuring actual workload. Supplier choice remains open while data quality and the first experiment are defined.

Research should use storage/credentials isolated from the existing trading services. Do not restore the old inactive Supabase project as a research setup shortcut while daemon state is unknown. A separate research project is a candidate if Supabase is selected, and its additional project/compute charge must be included in the quote. A schema within a stopped project is not enough to establish service isolation.

Two material Supabase details: database backups contain Storage metadata, not file bytes, and standard Storage does not support S3 versioning. Immutable object names alone are not a backup. Preserve dataset manifests and a separate restorable copy with appropriate access controls, and test restoration. [Database backup scope](https://supabase.com/docs/guides/platform/backups), [S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility)

Supabase also documents Analytics Buckets based on Iceberg, currently labeled alpha. They are not required for this initial program. [Analytics Buckets](https://supabase.com/docs/guides/storage/analytics/introduction)

## What every dataset and experiment retains

- Original source, provider dataset/version, retrieval timestamp, coverage, licensing/authorized-user scope, identifiers, schema, content hashes and quality checks.
- Separate observation period, actual public availability time and ingestion time. Preserve corrections/restatements instead of replacing the old version silently.
- Frozen input-file manifest, transformation code commit, strategy/configuration, train/validation/final-test boundaries, model/prompt versions if used, every attempted variant, execution/cost assumptions, trade ledger and results.
- Outcomes include rejected, inconclusive, needs better data, or candidate for forward testing. Failed experiments are retained so a future session cannot unknowingly repeat or cherry-pick them.

Git holds the versioned experiment manifest; Postgres indexes/mirrors it for queries and dashboards. Reproduction requires the code checkout plus authorized access to the referenced data, not the checkout alone. Pin environments and seeds and retain generated model outputs. Compare deterministic ledgers exactly where appropriate and define tolerances for floating-point outputs; volatile timestamps or stochastic generations need explicit treatment rather than a blanket byte-match requirement.

## Data options before a budget decision

| Research scope | Candidate data | What it can establish | What remains to verify |
| --- | --- | --- | --- |
| Price-data pilot | Small licensed/free sample of daily prices, with corporate-action examples | Ingestion, accounting and backtest plumbing; a properly specified price-only strategy can later be evaluated on adequate data | A small biased sample of surviving companies is not evidence of broad historical profitability |
| Prices plus fundamentals | Delisted-inclusive price/security history plus as-reported fundamentals; Sharadar is one candidate, SEC filings a source and cross-check, ALFRED for selected macro variables | A direct test of whether fundamentals add information beyond a price-only baseline | Vendor delisting-return handling, announcement versus filing timing, corrections, two-person/cloud retention and model-processing rights; actual subscription quote |
| News/intraday expansion | Timestamped licensed news archives and/or intraday market data | Additional hypotheses only when a concrete candidate needs them | First-publication/revision semantics, timestamp alignment, execution modeling, volume and licensing costs; defer broad ingestion |

The SEC publishes structured financial data taken from filings, with datasets back to 2009. Current extracted files can be reprocessed; retain source versions and accession/availability evidence instead of assuming a current download reproduces an old feed exactly. [SEC financial data](https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets), [EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)

Sharadar documents as-reported and most-recent-reported dimensions, including active and delisted companies. Its as-reported data is indexed to form-10 filing dates, and the docs note information may have appeared earlier in form-8 disclosures. That distinction matters for any earnings-event strategy; the vendor's point-in-time label is a starting claim to test, not automatic acceptance. [Sharadar fundamentals](https://sharadar.com/docs/fundamentals)

Its public subscription page lists personal-use bundles at $29/month for five years, $49/month for ten years and $69/month for full history. These are not a quote for our shared platform: the personal license restricts access/data sharing and includes deletion obligations after termination. A suitable arrangement for Constantine and Gaspar, cloud storage and long-term reproducibility must be established before treating this as a purchase option. We have not contacted the vendor or subscribed. [Published prices](https://sharadar.com/subscribe), [Personal-use terms](https://sharadar.com/terms)

ALFRED preserves economic vintages. It helps reconstruct what macro values were available on past dates, but a daily strategy still needs a specified release/availability lag when intraday times are unknown. [ALFRED vintages](https://alfred.stlouisfed.org/help/downloaddata)

Recommendation: aim the first substantive research at daily prices plus a small, justified set of fundamentals. Use a sample-data pilot to verify the plumbing first. Data quality/engineering/licensing may cost more than file storage; this is a planning expectation, not a verified total budget. No vendor or plan is selected.

## Research program and stopping points

1. Define a written research question and provisional daily/weekly horizon. Start with a small historically eligible universe and one hypothesis. Specify a plausible mechanism, benchmark, entry/exit/sizing rules, evaluation measures and permitted search count before seeing the final test results.
2. Compare data sources and audit samples before purchase. Distinguish a cheap price-only plumbing pilot from a credible fundamentals study. Confirm delisted coverage, stable security IDs, corporate actions, original filing/release timestamps, correction policy, allowed local/cloud storage and use by both people. Macro/news availability must be evidenced, not assumed.
3. Build a reproducible offline baseline after agreeing its data and file contract. Use as-known data, executable timing, spreads/slippage/fees and a simple benchmark. Verify the return ledger, adjusted/unadjusted prices, dividends, splits, cash and position accounting with known examples.
4. Research in bounded experiments. One co-head proposes and the other independently challenges the hypothesis and evaluation plan. Separate tuning from chronological evaluation, record all attempted variants, use appropriate validation for overlapping horizons, and investigate parameter sensitivity and different market periods. Do not use a test set as a repeated optimization target.
5. Freeze a candidate and record forward paper decisions before outcomes occur. Preserve the actual model/prompt and data available at each decision. Measure operational discrepancies and enough independent events for the strategy's frequency; elapsed weeks alone do not establish evidence.
6. Consider real money only after a separate user decision with agreed limits and independently verified data, execution/accounting, stop controls and performance evidence. No promised deadline or profitable result; a candidate may be rejected at any stage.

The relevant work will likely span repeated research cycles. Use evidence milestones, bounded experiment batches and recurring user reviews rather than announcing a launch date. Literature reviews inform candidate hypotheses; reproducible tests decide which deserve further work. Stronger models can help develop and critique experiments but do not establish a financial edge.

## Co-heads, lanes and continuity

Astra and Fable are verified peers in the current orchestration workspace and can exchange Conductor messages. They share files, not a private conversation history. Astra currently consolidates this research plan and shared state. Fable independently challenges it. Name exactly one dispatcher before product builders start; Fable remains the proposed implementation dispatcher, without an approved builder budget.

Proposed future lanes are data preparation, strategy/backtest implementation and independent validation. Each independent writer gets an isolated Conductor workspace/branch, exact file ownership and a ticket; reviewers keep product code read-only. Begin with the smallest useful number of lanes. The monitoring UI lane comes later and should preserve the overall design Constantine likes. The existing arbitrage program can remain a separate strategy/lane; stock-strategy feasibility does not depend on first rewriting it.

Dataset snapshots and accepted findings need durable storage outside this VM. The current documents are still local and unpublished. Before retiring a workspace, publish approved records to the private project store and verify they can be retrieved. Long downloads or unattended research jobs eventually need a persistent worker/queue and explicit cost limits; a chat session or an in-session timer is not an always-on service. No scheduler is being configured now.

## Research capabilities and optional external reports

Astra has web search, source reading, coding and internal read-only research delegation in this environment. No dedicated Deep Research invocation is exposed in Astra's current tool list. OpenAI documents separate Deep Research products/API workflows, but that does not establish a callable integration or authorization to spend API credits here. [OpenAI Deep Research guide](https://developers.openai.com/api/docs/guides/deep-research)

Fable confirmed a built-in Deep Research workflow is available in his session, correcting his initial report that it was absent. His first memo used direct primary-source research, not that workflow. He reports the named workflow can fan out substantially, so the options-first plan is to scope a specific question before any larger run. External ChatGPT/Claude research reports are optional additional inputs, not replacements for independent evidence checks. The reusable prompts in `RESEARCH-PROMPTS.md` let Constantine request them without acting as messenger between the co-heads.

The most useful next scoped research brief is historical-data quality and rights: compare a small vendor shortlist for as-reported fundamentals, delisted securities/returns, exact usable dates, two-person cloud retention and pricing. Bring back documented tradeoffs and sample-validation steps for discussion before purchasing. The first literature/hypothesis brief can run independently; both feed one frozen experiment specification.
