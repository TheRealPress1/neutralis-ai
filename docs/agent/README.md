# Neutralis research archive

Research and planning for Constantine and Gaspar, collected into the repository on October 14, 2026. The existing records cover September 6–8, 2026; their dates, source citations, review findings and revisions are preserved. Prices, provider terms and operational status describe those investigations and need fresh verification before use.

Start with the [investment-desk decision memo](INVESTMENT-DESK-DECISION.md). It explains the proposed investment team, strategy comparisons, costs and remaining evidence gaps.

| Topic | Reading |
| --- | --- |
| Investment team and architecture | [Investment-team proposal](ROBINHOOD-INVESTMENT-TEAM.md), [runtime recommendation](ROBINHOOD-RUNTIME-RECOMMENDATION.md), [delivery plan](NEUTRALIS-DELIVERY-PLAN.md) |
| Strategy research | [Primary strategy evidence](EQUITIES-STRATEGY-EVIDENCE-20260907.md), [first momentum/profitability experiment](FIRST-EXPERIMENT.md), [intraday-level hypothesis](INTRADAY-LEVELS-HYPOTHESIS.md) |
| Proposed ETF comparison and sizing | [ETF comparator v4](artifacts/ETF-trend-comparator-v4.md), [planning settlement](reviews/ETF-comparator-planning-settlement.md), [P1 sizing v2](artifacts/P1-post-cost-sizing-proposal-v2.md) |
| Data providers and usage rights | [Fifteen-route comparison](DATA-PURCHASE-REVIEW.md), [source feasibility](EQUITIES-SOURCE-FEASIBILITY-20260907.md), [minimum data](EQUITIES-MINIMUM-DATA-20260907.md), [exchange-data rights report](artifacts/astra-data-rights-20260907/report.md) |
| Cost assumptions | [Interactive worksheet](artifacts/equities-cost-worksheet.html), [independent worksheet check](reviews/EQUITIES-cost-worksheet-check.md), [accepted Robinhood feasibility study](artifacts/rh002-candidate-02/RH002-investment-team-feasibility.md) |
| Arbitrage hardening | [Fill/accounting plan](tasks/ARB003-fill-accounting-plan.md), [durable-entry contract](artifacts/ARB-DURABLE-1-proposed-contract-c5bbaf3.md), [offline Stage A review](reviews/ARB005-candidate-02-gpt.md) |
| Broker integration | [Hosted-client evidence](ROBINHOOD-HOSTED-EVIDENCE-20260907.md), [accepted hosted-client contract](artifacts/rh003-candidate-02/RH003-hosted-client-contract.md), [agreement research](ROBINHOOD-AGENTIC-AGREEMENT-20260907.md), [offline host-boundary review](reviews/RH005-candidate-01-gpt.md) |
| Project history and ownership | [Project profile](PROJECT.md), [last recorded state](STATE.md), [complete reference index](MEMORY-INDEX.md), [task tickets](tasks/), [reviews](reviews/) |

Open the HTML cost worksheet locally in a browser after downloading or cloning it; GitHub displays its source.

The last recorded research state contains no completed equity backtest, paper pilot or demonstrated investment edge. Accepted offline engineering reviews establish only their stated scope. Candidate implementation commits named in the reports belong to separate workstreams; this archive preserves their documentation without integrating those implementations.

The archive includes the original recovered-fix patch, Git bundle and [receipt](FIX-RECOVERY.md) as evidence. Packaging does not apply that patch or execute its SQL. The imported playbook and its [pinned source receipt](playbook-source.json) preserve the shared review and handoff procedures.

The [original research notes](artifacts/research-notes/README.md) preserve additional specialist findings and co-head proposals previously held only in temporary storage, with source hashes and links to their later corrections or settlements. The complete accepted RH003 documentation and supporting ARB-FILL contract reviews are also copied unchanged, with [RH003 provenance](artifacts/rh003-candidate-02/source-manifest.json) and [ARB-FILL provenance](artifacts/reviews/source-manifest.json).

Historical references to `.context/`, absolute workspace paths and remote specialist workspaces identify original local evidence. Those locations are not generally available in a fresh clone. Raw session transcripts, temporary test environments and bulk external data are outside this archive. Earlier statements that these research notes are uncommitted or unpublished describe their original recording time.
