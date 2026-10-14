# ETF trend/cash comparator — proposed process-comparator contract v4 (Fable co-head, for root planning acceptance)

Date: 2026-09-07 UTC. Supersedes v3 (sha256 b578c955…52e5), v2 (40f8da73…dd81a) and v1 (0816d2c2…de99), all preserved. Status: **proposed for root planning acceptance**; planning acceptance never authorizes a run. Accepted-for-planning process comparator only; not an investment-evidence registration. No run, data pull, browsing, provider contact, purchase, code or dispatch. Separate comparator; not an overlay on the momentum/profitability experiment; not a portfolio recommendation. Registration date R is bound in the later ticket.

## 1. Instrument and limit
SPY (SPDR S&P 500 ETF Trust), CUSIP 78462F103, ISIN US78462F1030, inception 1993-01-22 per the issuer page cited in ETF-SOURCE-OPTIONS; long documented history and quarterly distributions. Survivorship limit: chosen knowing it survived; the comparator informs only the timing rule on this instrument.

## 2. Frozen rule
At each month-end decision: split-adjusted month-end close versus the simple mean of the closes of the exact last 200 scheduled XNYS sessions ending on the month-end session (inclusive). Close > mean → equity state; close ≤ mean → cash state. Rationale: the candidate already named in the reviewed evidence note; a slow month-end rule of the class the reviewed literature (Clare, Seaton, Smith, Thomas) found favourable under a 20 bp cost assumption; pre-committed rather than swept, per the reviewed data-snooping warning. Any other lookback, band or filter is a new registration. The parameter is published; no historical window is treated as virgin.

Input completeness: if any of the 200 scheduled sessions lacks an admitted close, the month is `deferred_missing_input`: prior position persists, no order. Missing bars are never skipped. Signal series and mean use split-adjusted closes for splits effective on or before the decision instant and admitted by the capture deadline.

## 3. Clocks, admission, capture and execution (UTC-aware instants; calendar XNYS)
- `session_close(t)`: official close time of session t from the exchange calendar, including early closes.
- `decision_instant(m)` = `capture_deadline(m)` = 21:00 America/New_York on the last scheduled session of month m.
- Admission (prospective packet): a record is admitted for decision m only if `source_record_time ≤ capture_deadline(m)` and `retrieved_at ≤ capture_deadline(m)`. Later retrievals with earlier source timestamps are stored as `late_arrival` evidence only.
- Execution observation: the source's official regular-session opening price (`open_price_type = official_open`, definition quoted from the accepted source's field documentation before use) for the first scheduled session after the decision instant. `fill_capture_deadline` = 12:00 America/New_York on that session; the open record must satisfy both admission conditions against it.
- Missing open, halt flag, or open not admitted by the fill deadline → `unexecuted_missing_observation`; prior position persists; never rolled; next opportunity is the next month-end decision.
- Corrections after either deadline create `correction_event` records flagging affected spans `corrected_input`; original decision and fill records are never edited or retroactively deferred.
- Three classifications are kept distinct: registered paper convention, missing observation, actual execution (none; paper).

## 4. Initialization, measures, quantities, funding
- Before the first decision at the first month-end ≥ R: `uninitialized`, 100% cash, no position.
- Paper capital C0 in USD (required field, synthetic/paper).
- **Two measures, always reported separately:**
  - `available_cash`: settled cash only; the sole funding source for buys and costs.
  - `total_nav` = position value at the valuation price + available_cash + **value of acknowledged known dividend receivables** (amount known, pay date known or unknown-but-declared). Receivables are in NAV but are not spendable. A known dividend's ex-date therefore produces no artificial NAV loss.
  - Unknown claims (amount unknown) deny complete NAV: reports show `known_assets_subtotal` (position value + available cash + known receivables) plus the unresolved claim list; complete `total_nav`, return, drawdown and comparisons are withheld over affected spans.
- **Quantity budget (all-in cost fraction k for the scenario, price p):**
  - Buy: `q = floor6(available_cash / (p × (1 + k)))` unless a smaller target quantity applies, in which case `q = floor6(target_qty)`; cash debited `q × p × (1 + k)`; cash never negative.
  - Sell: quantity `q` (six-decimal) credits `q × p × (1 − k)`.
  - Share ownership is exact and unbounded in precision through split multiplication; six-decimal rounding applies only to trade quantities, and any residual position below the trade increment is **retained as explicitly reported dust**, never erased or rounded away.
- Equity-state target: total portfolio equity exposure = 100% of `total_nav` (receivables included in the target but only available_cash funds the buy, so the achievable buy is `q = floor6(available_cash / (p × (1 + k)))`). Months without a switch in equity state buy with available settled cash under the same rule.
- P1 target and effect sizing: P1 rebalances toward equity weight w of post-trade `total_nav`. The exact post-cost target equation and effect-sizing contract (how w interacts with costs, receivables and dust) is **pending** and not frozen here; until it is accepted, P1 is reported as "planning definition, implementation contract pending".

## 5. Signal cutoff, ledger timeline, action coverage
- Signal action cutoff: only actions with `ex_date ≤ decision_instant` and admitted by the capture deadline adjust the signal series.
- **Action coverage proof is a prerequisite:** before any fill, the ledger must hold admitted action-coverage evidence for the instrument through the fill session (a source statement or record set establishing that all actions with ex-dates through that session are present). An empty action response is not coverage proof.
- **Ledger timeline:** actions with ex-date after the decision instant and on or before the fill session, with admitted dated evidence, are applied before sizing and filling: split → share count × ratio (exact); dividend → known receivable at ex-date for shares held at the prior close.
- **Unadmitted required action or incomplete coverage through the fill session → `unexecuted_unresolved_action`:** no fill; no invented adjusted shares or executed quantity; known exposure retained; the unresolved action recorded; affected comparisons withheld. Next opportunity is the next month-end decision, still subject to coverage proof.
- **Late discovery of an unknown action:** original records remain byte-immutable and are marked `invalidated_historical_assumption`; correction/restatement evidence is appended as new records; **new simulated economic effects for the affected arm pause** until a separately reconciled holdings state is accepted and recorded. Recording of observations, admissions and flags continues; "never blanket-halt" (§10) does not require producing economic effects with unknown ownership.
- Dividend receivable settles to `available_cash` once on pay date; the receivable closes; never counted twice.
- Field semantics: `split` has `ratio`, `ex_date`, no `pay_date` (null by definition); `cash_dividend` has `amount`, `currency`, `ex_date`, `pay_date` (nullable only when unpublished; amount known → known receivable in NAV; amount unknown → `unresolved_claim`).

## 6. Costs
Registered scenarios: all-in k = 5, 10 and 20 bp per side, always reported together and applied in §4 sizing. Observed half-spread is a separate diagnostic only when bid and ask fields at the fill timestamp are admitted; otherwise omitted and labelled. Taxes omitted and stated.

## 7. Controls (identical data, clocks, admission, costs, funding)
- P0 buy-and-hold: fully invested at the first decision; settled dividend cash reinvested at the first month-end next-open after pay date under §4 rules.
- P1 constant mix: w = comparator's mean month-end equity exposure over the development window, frozen thereafter; implementation contract pending per §4. Label: matched to development-window exposure only, not to future exposure or risk.
- P2 all cash at zero interest; no external rate input.
- Reported per arm: `total_nav` and `available_cash` paths where complete; `known_assets_subtotal` and claim lists where not; incomplete spans with reasons; drawdown where complete; mean exposure; switch, deferred, unexecuted (missing observation / unresolved action), late-action, invalidated-assumption and dust records; turnover; cost paid. No intervals, significance language or economic verdict.

## 8. Sources, rights and windows
- Candidate sources per ETF-SOURCE-OPTIONS (Alpaca historical SIP; Tiingo Commercial; Alpha Vantage premium); none selected or default; paid access conditional on demonstrable need. Acceptance requires written evidence of durable private two-founder storage, internal analysis, all §3/§5 fields including `source_record_time`, `retrieved_at`, `correction_version`, `halt_flag`, the official-open definition, action fields and **an action-coverage statement**. FRED and Treasury are not inputs.
- Windows: warm-up = first 200 scheduled sessions on or after source start S0. Development = first 24 complete calendar months beginning the month after the warm-up's last session (partial month excluded). Validation = following 36 complete months. Both end on or before the last day of the month preceding R, else not registration-ready. Development only for accounting fixtures and w; validation labelled contaminated by literature knowledge.

## 9. Forward process pilot and inference status
Exactly 12 forward month-end decisions after R: a process pilot proving admission, deferral, execution classification, action coverage and timing, receivable accounting, dust retention and cost recording. Investment inference is pending a separate statistical contract (horizon, dependence, decision rule); no verdict rule is defined here. Source rights remain a prerequisite.

## 10. Refusal and continuation
- Refuse to initialize if: raw prices unavailable (adjusted-only); any required §3/§5 field absent from the source schema; official-open definition unquoted; action-coverage statement unavailable; storage rights unevidenced; windows overlap R; C0, R or cost scenarios unset.
- Continue recording with flags for individual missing or late records (§2 deferral, §3 unexecuted observation, §5 unexecuted unresolved action, unresolved claims, withheld spans, paused economic effects after late discovery). Continuation never requires new economic effects with unknown ownership.
- Any §2–§7 parameter change after data inspection requires a new registration.

## 11. Non-claims
No return, drawdown or risk figure is stated or implied; no superlative about instrument or parameter; no purchase, provider contact, account, code, implementation, run or overlay authorised; no founder decision requested now.
