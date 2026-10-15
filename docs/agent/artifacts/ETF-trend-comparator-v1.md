# ETF trend/cash comparator — registration draft v1 (Fable co-head, for root challenge)

Date: 2026-09-07 UTC. Documentation proposal only. No experiment, implementation, data pull, purchase, provider contact or new browsing. Inputs: docs/agent/EQUITIES-STRATEGY-EVIDENCE-20260907.md, docs/agent/ETF-SOURCE-OPTIONS-20260907.md, FIRST-EXPERIMENT.md, my prior addenda. This comparator is separate from the momentum/profitability experiment and is not an overlay on any portfolio.

## 1. Purpose and status
A cheap exposure-management reference against which the factor experiment and the desk can be compared on risk and cost. It tests whether a slow, fixed, monthly trend rule on one broad-equity ETF changes drawdown and exposure enough, net of costs, to justify its whipsaw and cash drag. It does not rank stocks and has no LLM component. No return evidence is claimed anywhere in this document.

## 2. Rule, frozen before any data is examined
- **Instrument:** SPDR S&P 500 ETF Trust, ticker SPY, CUSIP 78462F103, ISIN US78462F1030, inception 1993-01-22 (issuer page cited in ETF-SOURCE-OPTIONS). Chosen for the longest US broad-equity ETF history and quarterly distributions; it is a reference instrument, not a recommendation to hold SPY. **Survivorship limit:** a single surviving instrument is chosen with hindsight of its survival; the comparator therefore says nothing about instrument selection, only about the timing rule on this instrument.
- **Signal:** at the last regular session of each calendar month, compare the split-adjusted close in current share units with the simple average of the trailing 200 split-adjusted daily closes (inclusive of the signal day). Above → equity state; at or below → cash state. Ties resolve to cash. Dividend-adjusted series are never used for the signal.
- **Why this rule and not a sweep:** it is the candidate already named in the reviewed evidence note; it is a slow rule with month-end decisions, the class Clare, Seaton, Smith and Thomas found favourable under a 20 bp cost assumption; and it is the single most widely published long-horizon moving-average length, so pre-committing to it is the honest alternative to selecting a lookback after inspection (Bajgrowicz and Scaillet's warning). No other lookback, band, or confirmation filter is registered. Any later variant is a new registered hypothesis.
- **What is already known:** because the parameter comes from published research over roughly 1952 to 2011 and is widely replicated, no historical window is virgin. Historical results are contaminated context for accounting checks; **forward observations from the registration date are the primary falsifiable test.**

## 3. Calendar, cutoff and execution
- Calendar: XNYS trading days. Cutoff: month-end regular-session close, 16:00 America/New_York. Signal computed from bars finalised after that close; no intraday data.
- Fill: state changes execute at the official regular-session **open** of the next trading day at raw (unadjusted) price, plus cost (§6). No fill at the signal close.
- Missing open on the fill day: carry the order up to 3 sessions; first available regular open fills; otherwise the switch is recorded as unfilled and the prior state persists until the next month-end, with a flag. No synthetic price.
- Trading halt on the fill day: treated as missing open. Halt inside the month: no action; valuation marked stale at last close with days-stale count.
- Missing daily bar inside the 200-session window: the average is computed only if at least 190 of the 200 sessions are present; otherwise no signal update, prior state persists, flagged. Corrections to past bars are recorded as events; the decision that used the original bar is never recomputed.

## 4. Corporate actions and cash accounting
- Splits: share count × ratio on the ex-date; raw prices throughout the ledger; the signal series uses split-adjusted closes only.
- Dividends: receivable recognised at ex-date (amount × shares held at prior close), settled to cash at pay date. NAV includes receivables. Cash from dividends stays in cash until the next month-end decision; no intra-month reinvestment.
- **Cash state:** paper cash earns **zero** interest by declared assumption. The 13-week Treasury bill rate is reported alongside as a **reference series only** and is never credited, because an unverified quoted yield is not earned cash and the Treasury feed's rights and publication behaviour are still open. If the founders later accept a specific cash vehicle with tradable prices and distributions, that becomes a new registered variant.
- Unknown or missing dividend amount or pay date: receivable recorded as unresolved, NAV shown with and without it, flagged; never invented.

## 5. Boundaries
- **Development:** first 24 months after the earliest date with a complete 200-session warm-up from the accepted source. Used only for (a) accounting fixture checks and (b) computing the exposure-matched control weight w in §7. No parameter is chosen here.
- **Validation:** the following 36 months, reported for context, labelled contaminated by literature knowledge.
- **Final (primary):** forward from the registration date, decisions logged before each fill. Minimum forward span before any comparative statement: to be fixed by the later statistical contract; this draft registers none and emits counts and paths only.

## 6. Costs and taxes
Per-side cost sensitivity at 5, 10 and 20 bp on traded value, plus observed half spread if a quote is available (else labelled none). All three reported every time; 20 bp mirrors the reviewed literature. Taxes omitted and stated as an omission; the comparator is paper-only.

## 7. Controls, all on identical data and conventions
- P0 buy-and-hold SPY with dividends as receivables then cash, never reinvested (same rule as the comparator's equity state).
- P1 exposure-matched constant mix: equity weight w = the comparator's average month-end equity exposure over the **development window only**, rebalanced at each month-end, frozen for validation and final. Never recomputed from later exposure.
- P2 all cash at zero interest.
- Reported: cumulative path, maximum drawdown, average exposure, number of switches, turnover, cost paid, unfilled and flagged months. Primary comparison is comparator minus P1 net of costs (exposure-adjusted). No confidence intervals or significance language in this stage.

## 8. Falsification, stated without statistics
The rule is judged not worth its complexity for our purposes if, over the frozen forward window and at 10 bp per side, its net path does not exceed P1's, or if its drawdown reduction versus P0 is smaller than its cumulative cost and cash drag. Formal inference belongs to the later statistical contract; this registration commits the comparison, the controls and the reporting, not a verdict rule.

## 9. Smallest rights, fields and sample for one falsifiable test
- Fields: SPY daily raw OHLC and volume; split events (ratio, ex-date); dividends (amount, ex-date, pay date); session calendar. Reference: 13-week bill rate series (not credited).
- Span: at least 200 sessions of warm-up plus the development window before the registration date, then forward daily.
- Rights: durable storage of raw bars and actions in a private two-founder research archive; internal analysis; no redistribution; no model processing needed for this comparator.
- Candidate sources per ETF-SOURCE-OPTIONS: Alpaca historical SIP (rights question unsent), Tiingo Commercial (paid, retention question), Alpha Vantage premium; FRED excluded; issuer distribution documents as cross-check only.

## 10. Missing inputs and refusal conditions
Missing: source rights answer; cost assumption approval; registration date; whether a cash vehicle is ever wanted. Refuse to run if: raw prices unavailable (adjusted-only series); dividend pay dates unavailable; more than 10 missing sessions in any 200-session window; storage rights unresolved; or any parameter in §2 is changed after data inspection without a new registration.

## 11. Explicit non-claims
No return, drawdown or Sharpe figure is stated or implied. The comparator does not select stocks, does not overlay the factor experiment, does not authorise any purchase, account, provider contact or implementation, and does not use Treasury yields as earned cash.
