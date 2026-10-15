# Addendum v2 — corrected co-head experiment proposal (Fable co-head, private draft)

Date: 2026-09-07 UTC. Supersedes §3A, §4 and the paper-mode claim in the 2026-09-07 peer note, which is preserved unchanged. Proposal only: no experiment, model call, purchase, connection or live rule is authorized by this document. Astra retains shared pen and dispatch.

## Correction 1 — paper mode claim withdrawn
Re-fetched both official pages today asking only for verbatim sentences. Tools page: the only sentence containing simulate/paper/sandbox/test/demo is the review_equity_order description, "Simulate an equity order and get pre-trade warnings". Overview page: no sentence contains those words. My earlier "no paper/simulation trading mode" line was a fetch-summary inference, not source text. Corrected claim and ticket demand: **no full broker paper sandbox is documented or verified; review_equity_order is a pre-trade simulation of a single order, not a paper account or ledger; Neutralis keeps its own paper ledger.** Sources: https://robinhood.com/us/en/support/articles/trading-with-your-agent/ and https://robinhood.com/us/en/support/articles/agentic-trading-overview/ (both 2026-09-07).

## Correction 2 — invalidation exits as a proposed paper-mandate parameter, not authority
Discretionary changes, including every sell, still need joint approval. The proposal adds only a **pre-agreed objective exit rule inside the paper mandate**, evaluated by code, recorded as a rule output. Draft definition (all values are placeholders for founder review):
- Observed inputs: adjusted daily close from the accepted price feed; original-filing facts from SEC EDGAR companyfacts (filed date ≤ cutoff); exchange halt/delisting status from the feed.
- Cutoff: Friday 16:00 ET close; evaluation Saturday; paper action Monday open.
- Executable criteria (any one triggers): (a) close ≤ entry close × (1 − 0.15); (b) a metric named at entry falls below the floor recorded at entry, using only the first filing available after the floor was set (e.g., trailing-four-quarter gross margin below X%); (c) delisting or halt longer than five sessions → exit at next available open.
- Missing or ambiguous data: no exit; position flagged "unevaluable" in the ledger and surfaced to both PMs at the next cycle. Ambiguity never triggers a sale.
- Scope: paper ledger only. No live automatic exit or emergency reduction exists or is implied. Model disagreement never liquidates anything.

## Correction 3 — chosen small design and attribution limits
Arms (all from one frozen analyst packet per cycle):
- **P0 passive:** equal-weight of the frozen universe, monthly rebalance. **P1 passive:** broad index reference series (report only).
- **A1:** one PM + software controls.
- **A2:** two independently briefed cross-family PMs + joint acceptance + identical controls.
The sequential-challenger arm is deferred as an optional later comparison. Cross-family choice is a diversity hypothesis, not statistical independence.

Attribution limits, stated up front:
- A1 vs A2 isolates only the PM stage; analyst quality is common to both.
- Weekly decisions over 12–26 weeks give few effective observations. Four-week forecasts made weekly overlap by 75%; names cluster by sector and by market beta. Therefore **no count-based "above chance" threshold**. Diagnostics use rates with block-bootstrap intervals over non-overlapping four-week blocks; return comparisons use dependence-aware standard errors (overlapping-window correction) and are reported as intervals, never as an alpha claim at 12 weeks.
- Diagnostics (model utility): audited factual error rate per memo; hard-control violations caught before paper execution; Brier calibration on pre-registered four-week questions vs base rate; A2 decision changes relative to A1 with the paper outcome of each change logged. Profitability (net paper return, drawdown, turnover, cost) is a separate report.
- Preregistered review at week 12: continue to week 26 only if (i) A1 and A2 factual error rate is below the threshold set before start, (ii) no unhandled control breach, and (iii) A2's incremental token cost is within its ceiling. Otherwise stop or redesign. Extension is a judgement about model utility, not evidence of edge.

## Correction 4 — cost accounting
Per cycle, N names (draft N = 40):
| Stage | Calls | Input tokens each | Cached-prefix tokens each | Output tokens each |
|---|---|---|---|---|
| Company memo (fundamentals + catalysts) | N | ~5k packet + ~1k instructions | ~1k shared instructions | ~1.5k |
| Macro memo | 1 | ~8k | ~1k | ~2k |
| A1 PM decision | 1 | N × 1.5k memos + ~2k holdings/mandate | memos | ~3k |
| A2 PM decisions | 2 | same as A1 | memos | ~3k |
| A2 joint acceptance | 2 | ~10k (both proposals + mandate) | ~4k | ~1k |
| Follow-up ceiling | ≤1 per PM per cycle, ≤3 names | ~6k | — | ~1.5k |
Cost = Σ_calls (input × p_in + cached × p_cached + output × p_out) at the provider's current published rates for the chosen model IDs; rates are not asserted here. Report three lines every cycle: incremental equities cost (tokens + any data fee), fully allocated cost (adds a stated share of Railway/Supabase), and cumulative cost vs an assumed capital K (unanswered). No claim that subscription access equals API access.

## Draft parameters (for founder review, all placeholders)
| Parameter | Draft |
|---|---|
| Universe | 40 US large caps by trailing 60-day dollar volume within a public index list, frozen at start; no LLM selection |
| Cadence | weekly; cutoff Friday close; paper fill Monday open |
| Fill assumption | open price + 5 bp + half quoted spread, labelled assumption |
| Position limits | max 10% per name, max 30% per sector, cash 0–30%, turnover ≤ 40%/month |
| Duration | 12 weeks, preregistered extension to 26 |
| Models | PM families differ; model IDs and prompt hashes frozen at start |
| Decision step tools | none; frozen packet only |
| Records | packet hash, prompts, outputs, approvals, timestamps stored before Monday open |

## Dated input list (2026-09-07)
- docs/agent/ROBINHOOD-INVESTMENT-TEAM.md, ROBINHOOD-AGENTIC-RESEARCH-UPDATE.md, tasks/RH002-investment-team-feasibility.md, reviews/RH002-architecture-gpt.md, reviews/RH002-dispatch-gpt.md, FIRST-EXPERIMENT.md (separate numerical test), DATA-PURCHASE-REVIEW.md (price/actions feed still unresolved; public availability ≠ usable licensed feed).
- Robinhood public pages fetched 2026-09-07: overview, tools, product page (URLs in peer note).
- Astra corrections message 2026-09-07 (four items).

## Open items
Usable price/actions feed with fill-time coverage and licence for two founders; capital K; provider rates and model IDs; founder review of exit-rule placeholders; RH002 coverage matrix against this specification's inputs.
