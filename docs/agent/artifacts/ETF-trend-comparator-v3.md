# ETF trend/cash comparator — proposed process-comparator contract v3 (Fable co-head, for root review)

Date: 2026-09-07 UTC. Supersedes v2 (sha256 40f8da73…dd81a) and v1 (0816d2c2…de99), both preserved. Status: **accepted-for-planning process comparator only**; not an investment-evidence registration. Proposal only: no run, data pull, browsing, provider contact, purchase, code or dispatch. Separate comparator; not an overlay on the momentum/profitability experiment; not a portfolio recommendation. Registration date R is bound in the later ticket.

## 1. Instrument and limit
SPY (SPDR S&P 500 ETF Trust), CUSIP 78462F103, ISIN US78462F1030, inception 1993-01-22 per the issuer page cited in ETF-SOURCE-OPTIONS; long documented history and quarterly distributions. Survivorship limit: chosen knowing it survived; the comparator informs only the timing rule on this instrument.

## 2. Frozen rule
At each month-end decision: split-adjusted month-end close versus the simple mean of the closes of the **exact last 200 scheduled XNYS sessions ending on the month-end session (inclusive)**. Close > mean → equity state; close ≤ mean → cash state. Rationale: the candidate already named in the reviewed evidence note; a slow month-end rule of the class the reviewed literature (Clare, Seaton, Smith, Thomas) found favourable under a 20 bp cost assumption; pre-committed rather than swept, following the reviewed data-snooping warning. Any other lookback, band or filter is a new registration. The parameter is published, so no historical window is treated as virgin.

**Input completeness:** if any of the 200 scheduled sessions lacks an admitted close, the month is `deferred_missing_input`: prior position persists, no order. Missing bars are never skipped to reach 200 observations. Both the signal series and the mean use split-adjusted closes for splits effective on or before the decision instant (§5).

## 3. Clocks, admission, capture and execution (UTC-aware instants; calendar XNYS)
- `session_close(t)`: official close time of session t from the exchange calendar, including early closes.
- `decision_instant(m)` = `capture_deadline(m)` = 21:00 America/New_York on the last scheduled session of month m.
- **Admission rule (prospective packet):** a record is admitted for decision m only if `source_record_time ≤ capture_deadline(m)` **and** `retrieved_at ≤ capture_deadline(m)`. A later retrieval carrying an earlier source timestamp is not admitted and cannot reconstruct a prospective packet; such records are stored as `late_arrival` evidence only.
- **Execution observation:** the paper fill price is the source's official regular-session opening price for the first scheduled session after the decision instant (`open_price_type = official_open` as defined by the source's field documentation; the auction/open definition must be quoted from the accepted source before use). `fill_capture_deadline` = 12:00 America/New_York on that session; the open record must satisfy `source_record_time ≤ fill_capture_deadline` and `retrieved_at ≤ fill_capture_deadline`.
- Missing open, halt flag, or open not admitted by the fill capture deadline → `unexecuted_missing_observation`; prior position persists; never rolled to a later open; next opportunity is the next month-end decision.
- Corrections arriving after either deadline create `correction_event` records that flag the affected spans `corrected_input`. The original decision and fill records are never edited or retroactively deferred.
- Three classifications are kept distinct in every record: registered paper convention, missing observation, actual execution (none; paper).

## 4. Initialization, quantities, funding
- Before the first decision at the first month-end ≥ R: `uninitialized`, 100% cash, no position.
- Paper capital C0 in USD (required field, synthetic/paper).
- **Equity-state target:** total portfolio equity exposure = 100% of NAV where NAV = position value at the fill open + settled cash (receivables excluded). Buy quantity = floor6((available settled cash − all-in cost of the buy) / fill price); round down to six decimals; cash never negative. Sell quantity in a switch to cash = entire position, six-decimal exact.
- Months without a state switch in equity state: buy with available settled cash under the same rule (monthly reinvestment of settled dividends).
- P1 buys or sells to its total-NAV weight w under the identical cost, funding and rounding convention.

## 5. Signal cutoff versus ledger timeline
- **Signal action cutoff:** only actions with `ex_date ≤ decision_instant` and admitted by the capture deadline adjust the signal series.
- **Ledger timeline:** actions with an ex-date after the decision instant and on or before the fill session are applied **before sizing and filling**, using dated action evidence admitted by the fill capture deadline: split → share count × ratio; dividend → receivable at ex-date for shares held at the prior close. If such an action's evidence is not admitted by the fill deadline, the fill proceeds on the pre-action share count and the action is recorded `late_action` with an `unresolved_claim` if it is a dividend; a later revision adds evidence records but never rewrites the original packet or fill.
- Dividend receivable settles to cash on pay date; after transfer the receivable is closed and cash increases once. Receivables are never counted in cash and never counted twice.
- Field semantics: `split` has `ratio`, `ex_date`, and **no pay_date** (null by definition); `cash_dividend` has `amount`, `currency`, `ex_date`, `pay_date` (nullable only when the source has not yet published it, which creates an `unresolved_claim`).
- Unresolved claims are retained with no value. Reports show `known_assets_subtotal` plus the unresolved claim list; complete NAV, return, drawdown and comparisons are withheld over any span touching an unresolved claim, stale valuation, deferred decision, unexecuted order or corrected input, with reason codes. Carry-forward never becomes complete performance.

## 6. Costs
Registered scenarios: all-in 5, 10 and 20 bp per side on traded value, always reported together and applied in sizing. Observed half-spread is a separate diagnostic only when bid and ask fields at the fill timestamp are admitted; otherwise omitted and labelled. Taxes omitted and stated.

## 7. Controls (identical data, clocks, admission, costs, funding)
- P0 buy-and-hold: fully invested at the first decision; settled dividend cash reinvested at the first month-end next-open after pay date under §4 rules.
- P1 constant mix: w = comparator's mean month-end equity exposure over the development window; rebalanced to total-NAV weight at every month-end next-open; w frozen thereafter. Label: matched to development-window exposure only, not to future exposure or risk.
- P2 all cash at zero interest; no external rate input.
- Reported per arm: NAV path where complete; incomplete spans with reasons; drawdown where complete; mean exposure; switch, deferred, unexecuted and late-action counts; turnover; cost paid. No intervals, significance language or economic verdict.

## 8. Sources, rights and windows
- Candidate sources per ETF-SOURCE-OPTIONS (Alpaca historical SIP; Tiingo Commercial; Alpha Vantage premium); none selected, none default; paid access conditional on demonstrable need. Acceptance requires written evidence of durable private two-founder storage, internal analysis, all §3 and §5 fields including `source_record_time`, `retrieved_at`, `correction_version`, `halt_flag`, the source's official-open definition, and action fields. FRED and Treasury are not inputs.
- **Window boundaries:** warm-up = the first 200 scheduled sessions on or after source start S0. Development = the first 24 **complete** calendar months beginning on the first day of the month following the warm-up's last session; a partial month is excluded from development, not counted. Validation = the following 36 complete calendar months. Both must end on or before the last day of the month preceding R; otherwise not registration-ready. Development is used only for accounting fixtures and w; validation is context labelled contaminated by literature knowledge.

## 9. Forward process pilot and inference status
Exactly **12 forward month-end decisions** after R, a process pilot proving admission, deferral, execution classification, action timing, accounting completeness and cost recording. Outputs are the §7 reports and counts. Investment inference is **pending** a separate statistical contract fixing horizon, dependence handling and decision rule; no verdict rule is defined here.

## 10. Refusal and continuation
- Refuse to **initialize** if: raw prices unavailable (adjusted-only); any §3/§5 required field absent from the source schema; official-open definition unquoted; storage rights unevidenced; development or validation windows overlap R; C0, R or cost scenarios unset.
- **Continue with flags** (never blanket-halt) when individual records are missing or late: apply §2 deferral, §3 unexecuted classification, §5 unresolved claims and withheld spans. A missing field on one record is a flagged span, not a refusal.
- Any §2–§7 parameter change after data inspection requires a new registration.

## 11. Non-claims
No return, drawdown or risk figure is stated or implied; no superlative about instrument or parameter; no purchase, provider contact, account, code, implementation or overlay authorised; no founder decision requested now.
