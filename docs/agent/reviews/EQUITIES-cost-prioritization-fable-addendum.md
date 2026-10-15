# Addendum to the strategy prioritization note, and finite proposed sequence (Fable co-head, private)

Date: 2026-09-07 UTC. Corrects .context/cohead-robinhood-return/2026-09-07-strategy-prioritization-cost-challenge.md (preserved). Also records the read of docs/agent/INVESTMENT-DESK-DECISION.md (8,101 bytes, sha256 bcfe5d7d…0290a).

## Corrections accepted from Astra's three-line challenge
1. **K and tax status.** Needed to scope personalised spending and any live mandate; they do not gate the synthetic EQ001 foundation or zero-spend documentation. "Decision zero" is withdrawn as a blocker and retained as a prerequisite for spend decisions only.
2. **Conditional costs on every route.** Published factor history does not prove the combined Neutralis signal, and archival coverage requirements do not prove a paid vendor is mandatory. No complete cheap or free desk input package is established: SEC EDGAR is the only input with settled public-domain status; Alpaca storage/shared-use/model-processing rights and Treasury page/API rights remain open. "Near 0" in my table is replaced by "conditional on unresolved rights" for prices and cash rate.
3. **Treasury.** Government-work status must be shown from the actual page/source terms and does not establish API publication or correction behaviour. One terms check does not close the input contract; it closes only the rights sub-question.
4. **Tax drag.** The "order of magnitude" claim is withdrawn; the drag depends on jurisdiction, turnover and realised gains and is unquantified until those are stated.
5. **Exposure-matched control.** Its weight is frozen from the development window only and held fixed through validation and final periods; evaluation-period exposure is never used to choose it.
6. **Cost reporting.** Cost per admitted and per rejected decision is reported alongside annual portfolio overhead (incremental and allocated), not instead of it. Diagnostics measure process quality and do not earn investment returns.
7. **Metamorphic checks, specified.** Each has a distinct expected behaviour; none is a proof of decontamination or honesty:
   - Changed cited financial value in the packet → every dependent structured claim must change to the new value or fail validation; an unchanged claim is a defect.
   - Renamed security identity with identical facts (ticker or alias change, same entity_id) → decision and claims invariant; a changed decision is a defect.
   - Unit-consistent rescaling (thousands ↔ millions with unit field updated) → raw claims follow the new unit; derived ratios invariant.
   - Irrelevant perturbation (source URL string, item ordering, whitespace) → outputs byte-identical after canonicalisation.
   - Post-cutoff item injected → packet rejected before any stage runs.

## Challenge to INVESTMENT-DESK-DECISION.md
- **M1 (title).** "an investment desk with a measurable edge" asserts an edge the body explicitly treats as an unproven hypothesis. Rename to "with measurable decisions" or "with an edge hypothesis to test". Shared-record headline should not outrun its own text.
- **m2 (cost table).** The table allocates the entire $45 hosting baseline to equities as an illustration while the text says shared costs must not be charged twice. Add one line stating the incremental equities column is currently unknown (data, model, friction) so the table is not read as the whole hurdle.
- **m3 (diagram).** Fine. Consider labelling the L→E edge "separately approved; not in scope" so the flowchart does not imply a pipeline that exists.
- Otherwise consistent with EQ001, RH002 boundaries, the two-comparison framing (as-designed vs equal-spend) and the evidence note.

## Finite proposed sequence (no models, purchases or runs until separately scoped)
| Step | Deliverable | Spend | Gate to proceed | Stop condition |
|---|---|---|---|---|
| S0 | Founder inputs recorded: K per strategy, account tax status | 0 | Needed only for S6+ spend/live scoping | — |
| S1 | EQ001 foundation delivered; Fable exact-head cross-family review | 0 | PASS on acceptance list | Any acceptance failure → same-owner revision |
| S2 | Inputs rights register: Alpaca single written question (founder-approved before send), Treasury page/API terms check, FRED excluded, SEC public domain recorded | 0 | Written answers or documented denials per input | Unresolved → route stays conditional; no data pulled |
| S3 | Trend comparator registration doc: instrument, signal, warm-up, fill, distributions, cash convention, exposure-matched control frozen from development window | 0 | Co-head PASS | No run until S2 resolves price/cash rights |
| S4 | Desk forward-protocol spec v3: cadence, packet sources (SEC + conditional prices), metamorphic checks, cost ceiling, per-decision + annual reporting, dated rate table placeholder | 0 | Co-head PASS; EQ001 accepted | No model calls |
| S5 | Factor core: data acceptance per DATA-PURCHASE-REVIEW, then FIRST-EXPERIMENT run under its own ticket | data cost, conditional | Founder purchase decision informed by S0 | Unacceptable sample → no purchase |
| S6 | First real-packet desk dry run: one cycle, model calls under dated rate table and hard cost ceiling, all outputs labelled non-performance | tokens, capped | S1–S4 complete, S2 rights for every packet input | Ceiling hit or rights gap → stop |
Each step is its own ticket with one writer and cross-family review; none authorises live orders, broker connection, database stage or publication.
