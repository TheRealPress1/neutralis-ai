# ETF trend/cash comparator — proposed registration contract v2 (Fable co-head, for root whole-artifact review)

Date: 2026-09-07 UTC. Supersedes v1 (sha256 0816d2c2…de99, preserved). Proposal only: not registration-ready until §9's forward horizon is accepted and §8's source rights are evidenced. No run, data pull, browsing, provider contact, purchase or implementation. Separate comparator; not an overlay on the momentum/profitability experiment and not a portfolio recommendation.

## 1. Instrument and limit
SPY (SPDR S&P 500 ETF Trust), CUSIP 78462F103, ISIN US78462F1030, inception 1993-01-22 per the issuer page cited in ETF-SOURCE-OPTIONS. Chosen because it has a long, documented history and quarterly distributions. Survivorship limit: the instrument is chosen knowing it survived; the comparator informs only the timing rule on this instrument.

## 2. Frozen rule
Signal at each month-end decision: split-adjusted month-end close versus the simple mean of the 200 most recent eligible session closes ending on the month-end session (inclusive). Close > mean → equity state; close ≤ mean → cash state. Rationale: the candidate already named in the reviewed evidence note, and a slow month-end rule of the class the reviewed literature (Clare, Seaton, Smith, Thomas) found favourable under a 20 bp cost assumption; pre-committed instead of swept, following the reviewed data-snooping warning. Any other lookback, band or filter is a new registration. Because the parameter is published, no historical window is treated as virgin.

**SMA eligibility:** exactly 200 eligible session closes are required. If any is missing, unavailable by the capture deadline, or flagged corrected after capture, the month's state is `deferred_missing_input`; prior position persists; no order. 190 is not accepted.

## 3. Clocks, capture and execution (all instants UTC-aware, calendar XNYS)
- `session_close(t)`: the official close time of session t from the exchange calendar, including early closes.
- `capture_deadline(m)`: 21:00 America/New_York on the last session of month m. Only bar and action records with `source_record_time ≤ capture_deadline` are usable. A month-end close not present by the deadline → `deferred_missing_input`.
- `decision_instant(m)` = `capture_deadline(m)`; recorded in the receipt.
- Execution convention (paper): a state change or reinvestment order executes at the official regular-session **open** of the first eligible session after the decision instant, at raw price plus the registered cost scenario. Eligible = the source provides an open with `source_record_time` after that session's open and no halt flag for that session.
- Missing or halted open on that session: the order is **not** filled and is **not** rolled to a later open. It is recorded `unexecuted_missing_observation`; the prior position persists; the next opportunity is the next month-end decision. No retrospective selection of a later open.
- Three classifications are kept distinct in every record: registered paper convention (what the rule intended), missing observation (source gap), and actual execution (none; this is paper).

## 4. Initialization, quantities, funding
- Registration date R: first decision at the first month-end ≥ R. Before it: state `uninitialized`, 100% cash, no position.
- Paper capital C0: a configured amount in USD (required field, synthetic/paper); fees and costs are deducted from cash; cash may not go negative (order size = min(target, available cash)).
- Fractional units allowed to 6 decimal places.
- Equity state target: 100% of (cash + settled receivables) invested at the next eligible open, including months with no state switch (monthly reinvestment of settled dividend cash). Cash state target: 0% equity.

## 5. Actions and accounting
- Bar fields (required): `session_date, open, high, low, close, volume, halt_flag, source_id, source_record_time, retrieved_at, correction_version`.
- Action fields (required): `type ∈ {split, cash_dividend}, ex_date, pay_date, record_date (nullable), amount_or_ratio, currency, source_id, source_record_time, retrieved_at, correction_version`.
- Only actions with `ex_date ≤ decision_instant` and `source_record_time ≤ capture_deadline` affect that decision. Split adjustment applies to the signal series for splits effective by the decision instant; the ledger keeps raw prices and adjusts share count on ex-date.
- Dividend: receivable at ex-date = amount × shares at prior-session close; settled to cash at pay date.
- **Unresolved claims:** if amount or pay date is unknown, the receivable is recorded as `unresolved_claim` with no value. Reports show `known_assets_subtotal` plus the unresolved claim list. Complete NAV, return, drawdown and any comparison are **withheld** for every span touching an unresolved claim, a stale valuation, a deferred decision or an unexecuted order; those spans are reported `incomplete` with reason codes. Carry-forward never becomes complete performance.
- Corrections: a bar or action revised after capture creates a correction event; the original decision stands and the span is flagged `corrected_input`.

## 6. Costs
Registered scenarios: all-in 5, 10 and 20 bp per side on traded value, always reported together. Observed half-spread is a **separate diagnostic** computed only when bid and ask fields exist at the fill timestamp; otherwise the diagnostic is omitted and labelled. Taxes omitted and stated.

## 7. Controls (identical data, clocks, cost scenarios and accounting)
- P0 buy-and-hold: fully invested at first decision; settled dividend cash reinvested at the first month-end next-open after pay date.
- P1 constant mix: equity weight w = comparator's mean month-end equity exposure over the development window; rebalanced at every month-end next-open including settled cash; w frozen for validation and forward. Label: matched to development-window exposure only; not matched to future exposure or risk.
- P2 all cash at zero interest (no external rate input of any kind).
- Reported per arm: NAV path where complete, incomplete spans with reasons, drawdown where complete, mean exposure, switch count, unexecuted/deferred counts, turnover, cost paid. No intervals, no significance language, no economic verdict in this artifact.

## 8. Sources, rights and windows
- Candidate sources per ETF-SOURCE-OPTIONS (Alpaca historical SIP; Tiingo Commercial; Alpha Vantage premium). None is selected; none is a default. Acceptance requires written evidence of: durable storage in a private two-founder archive, internal analysis, the required fields above, and source timestamps. Paid access stays conditional on demonstrable need. FRED and Treasury are not inputs (the zero-cash comparator needs none).
- Windows relative to source start S0 and registration R, all non-overlapping: warm-up = first 200 eligible sessions from S0; development = the 24 calendar months after warm-up; validation = the following 36 months; both must end before R, else not registration-ready. Development is used only for accounting fixtures and w; validation is context labelled contaminated by literature knowledge.

## 9. Forward process pilot and inference status
- Process pilot: exactly **12 forward month-end decisions** after R. Outputs are the §7 reports and counts. Its purpose is to prove the process: capture, deferral, execution classification, accounting completeness and cost recording.
- Investment inference: **pending**. No verdict rule, drawdown-versus-cost calculation or utility is defined here. A separate statistical contract must fix the evaluation horizon, dependence handling and decision rule before any comparative statement. Until that contract and §8 evidence exist, this artifact is explicitly **not registration-ready**.

## 10. Refusal conditions
Refuse to initialize or continue if: raw prices unavailable (adjusted-only); any required bar or action field missing; storage rights unevidenced; development or validation windows overlap R; any §2–§7 parameter changed after data inspection without a new registration; or paper capital, R, or cost scenarios unset.

## 11. Non-claims
No return, drawdown or risk figure is stated or implied; no superlative claim about the instrument or parameter; no purchase, provider contact, account, implementation or overlay authorised.
