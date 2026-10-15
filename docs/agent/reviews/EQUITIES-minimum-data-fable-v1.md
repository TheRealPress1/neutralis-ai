# Minimum-data feasibility challenge — SEC originals + delayed Alpaca vs the v4 paper contract (Fable co-head, private)

Date: 2026-09-07 UTC. First Fable challenge of docs/agent/EQUITIES-MINIMUM-DATA-20260907.md (18,666 B, sha256 7e550eed…ec6b8), read in full, against accepted-for-planning ETF comparator v4 (sha256 e3611354…bcc04) and the planning settlement (sha256 12522706…3635). Documents only; no browsing, data, account, contact, run or shared-record change. The note's research is attributed internal GPT work; not repeated, no entitlement inferred.

## Verdict in one line
Timing and coverage feasibility is **conditional on two registered conventions and one mapping proof**; without them the note's feeds cannot satisfy v4 as written. Rights are a separate, unadmitted decision. The note claims neither readiness nor entitlement.

## Finding 1 — v4's price-observation clock is a requirement the suggested feed cannot supply as written
v4 §3 admits a record only if `source_record_time ≤ deadline` **and** `retrieved_at ≤ deadline`, and v4 §8 requires this admission for warm-up, development and validation sessions. The note establishes that Alpaca bar timestamps mark interval starts with no publication or revision clock; auctions and action events carry clocks, bars do not. Consequences:
- Forward decisions can be made admissible only by a **registered convention**: for bars, `source_record_time` is defined as the prospective capture's own `retrieved_at`, with corrections detected by later re-retrieval and recorded as `correction_event`. Cost: v4's two-clock guarantee collapses to one clock for bars, so the late-retrieval guard must be carried by the capture schedule.
- Historical windows cannot be admitted under §3 at all, because no contemporaneous retrieval exists. Development and validation must be reclassified as a distinct `historical_reconstruction` admission class (v4 already labels validation contaminated but still routes it through §3). Cost: P1's frozen `w` derives from reconstructed data and must be labelled so everywhere.
I do not adopt either change; both are v4 registration revisions for co-head acceptance.

## Finding 2 — positive action coverage cannot come from the vendor alone; for one ETF it can come from the issuer
v4 §5 requires an admitted coverage statement before any fill; the note correctly states that Alpaca disclaims creation timing, an empty response is not proof, and replay proves only published mutations. The vendor cannot supply the prerequisite. What can: for a single instrument with a small, scheduled action set (SPY's quarterly distributions per the issuer page), a coverage statement can be **constructed** by agreement between the issuer's declared distribution schedule and the vendor's action records through the fill session, with disagreement or absence producing v4's `unexecuted_unresolved_action`. This needs a registered convention naming the issuer document as coverage reference. Consequence: feasible for the comparator; **not** for a 30–50 stock desk universe with no per-name issuer reference, so the desk's I04 gap stays open.

## Finding 3 — the official-open requirement is satisfiable only after a mapping proof, and the sample needed to prove it requires an account
v4 §3 requires the primary regular-session official opening price with the source's definition quoted. The note's auction schema is a concrete candidate, but which record is SPY's NYSE Arca 09:30 core opening auction, rather than the early auction or another venue's print, is unproven and needs documentation plus a delivered sample. Calendar and auction routes are authenticated, so the decisive sample requires a data account: a founder decision, not a documentation step.

## Rights, kept separate
Settled: SEC's affirmative copying policy with attribution. Unadmitted: Alpaca's personal/non-commercial scope for two founders, durable shared storage, hosted-model processing, post-termination retention. Rights and Findings 1–3 are independent gates; both must pass.

## Smallest defensible next step, ranked, with stop conditions
1. **Registration decision (zero cost, documents only).** Co-heads accept or reject two v4 revisions: bar-clock convention (Finding 1) and issuer-referenced coverage statement (Finding 2), plus the historical-reconstruction admission class for §8 windows. Stop: if either revision is rejected, the comparator is infeasible on these feeds under v4 and stays not registration-ready; no purchase follows.
2. **Documentary and schema sample without an account.** Pin the Alpaca OpenAPI schema version, the auction condition and exchange code tables from public documentation, the SPY issuer distribution documentation and the NYSE calendar. Decide from documents alone whether a candidate mapping to the primary regular-session opening auction exists. Stop: no documented condition or venue mapping → the official-open requirement cannot be met with this feed; report infeasible rather than substitute daily OHLC open.
3. **Founder decision, then finite sample proof.** One free-tier data account under one founder, one written rights question, and the note's fixture list: one filing with amendment counterexample, one ordinary stock and SPY bar/auction day, DST boundary, early-close day, dividend, split, rename, terminal action, halt or missing observation, action update/delete replay. Accept or reject each record against the v4 fields. Stop: any required clock, coverage or right unevidenced → input unadmitted, observation unexecuted, no integration.
4. Only then a registered prospective 12-decision process pilot on the comparator. Expense so far: zero beyond time.

Conviction before expense: this buys process evidence for one instrument at no data cost, or an honest infeasibility result. It is not a strategy result and yields no return.

## Material disagreement
None with the note's conclusions. One emphasis: "smallest promising combination" holds for the comparator only; for the analyst desk, SEC originals remain the only admitted input and desk market data stays unresolved.
