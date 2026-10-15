# RH002 private architecture challenge

2026-09-07. Bounded planning note for the root coordinator. Read PROJECT, STATE, MEMORY-INDEX, ROBINHOOD-AGENTIC-RESEARCH-UPDATE, FIRST-EXPERIMENT and STACK-RECOMMENDATION. Root checkout observed at `d524b5a75643df5f508c068e3c4fb930ba54b4eb`. No product code, shared records, Conductor session, broker connection or database was changed. No runtime tests were appropriate for this documentation task. RH001 remains the frozen offline foundation described in STATE; this proposal neither replaces its owner nor grants implementation or trading authority.

## Recommendation

Build a small investment desk with two PM decision roles, three analyst functions and one conventional account-scoped execution component. Start by evaluating its decisions in an internal forward paper ledger. The useful co-head analogy is independent judgment followed by one agreed decision and one writer. Conductor remains development tooling; it is not the proposed deployed trading host.

| Role | Responsibility and concrete output | Authority |
| --- | --- | --- |
| Fundamentals analyst | Read dated filings/financials; produce valuation assumptions, bull/base/bear cases, thesis-break conditions and source links for a bounded shortlist | Research only |
| Events analyst | Check earnings, company announcements, industry and macro events; distinguish facts, scenarios and unsupported claims | Research only |
| Quant/risk analyst function | Deterministic report of momentum, liquidity, exposures, concentration, turnover and scenario sensitivities; use an LLM only when interpretation adds value | Calculate and challenge; cannot change hard limits |
| PM A, allocator | Compare opportunities with current holdings and cash; propose a complete target portfolio, intended holding period and reasons for each change | Propose; no direct broker tool |
| PM B, independent challenger | First write an independent assessment from the same dated evidence packet; then inspect PM A's proposed portfolio for weak premises, omissions and concentration | Approve or reject the exact proposal; no direct broker tool |
| Risk/execution software | Validate the agreed target, derive bounded order intents from current account state, enforce controls and reconcile outcomes | Sole potential broker writer in a separately authorized future live milestone |

These are short-lived tasks, not six persistent model processes. For the smallest pilot, the third analyst function can be Python calculations interpreted by PM B; only two specialist analyst model calls are essential. A single PM plus an independent reviewer is a cheaper comparison arm. Two full independently constructed portfolios should be earned by evidence of improvement over that comparison, not assumed to improve returns.

## Decision and disagreement contract

1. Freeze one research packet and its decision cutoff. Give both PMs the same permitted evidence, mandate, proposed limits and sanitized account snapshot. Neither sees the other's first assessment. Source differences can be investigated in a later bounded request; they must be recorded rather than quietly changing the inputs halfway through comparison.
2. PM A submits one complete target, including cash. PM B either accepts that exact revision or returns specific objections. Permit one reconciliation round, then stop. Do not average conflicting weights or choose whichever model sounds more confident: neither rule has established investment validity.
3. Require both approvals on the same immutable internal proposal identity: owner, account, mode, strategy/run, mandate version, evidence manifest, portfolio-state version, target weights and expiry. These are proposed Neutralis fields, not claimed Robinhood input schemas. A revision invalidates prior approvals.
4. Unresolved discretionary disagreement means no new rebalance for that account. Record both views and alert the founder. Do not silently execute only the agreed trades because each PM evaluated the combined portfolio. Holding is itself an exposure, so report its remaining risks and the failed decision explicitly.
5. A hard control violation blocks new risk regardless of PM agreement. Any future automatic reduction must follow a separately explicit founder-approved rule through the same sole executor; absent that authority, halt new risk and alert. PM disagreement does not invent liquidation authority or cancel existing protection. This planning note defines no live reduction rule.
6. Refresh account/order state and quote validity before any future submission. Expired approvals, changed mandate, unresolved prior orders or account-state changes outside the approved execution envelope invalidate the proposal. During an admitted rebalance, expected fills advance the recorded execution state; they do not authorize a new portfolio target. Material deviations return for review. Broker rejection cannot be repaired by letting a PM improvise another trade.

Two PMs directly trading the same account would compete for cash, reverse each other's changes, double size orders, and destroy attribution. A process lock alone is insufficient if an old process can resume. A future execution contract must define durable admission, stale-writer rejection, idempotency, cancellation, partial fills and uncertain responses before broker use. Do not import the arbitrage implementation automatically: its accepted source and existing sole owner remain separate.

## Judgment versus enforcement

LLMs may select candidates, assess qualitative catalysts, challenge accounting assumptions and propose weights. Their conviction scores and scenario probabilities are hypotheses, not calibrated risk limits. Quant calculations should use explicit code and frozen inputs; their correctness still depends on data quality.

Outside the model, enforce owner/account binding, allowed instruments, mode, an approved capital ceiling, available cash/settlement, maximum position/sector exposure, order and turnover limits, allowed sessions/order types, stale-data rejection and stop state. Founder-specific numerical limits remain unset. No PM can relax them by changing a prompt. The software should reject or return an invalid target for revision; silently clipping weights changes the portfolio that was approved. Authorization, provider review, submission, acknowledgement and actual fill must remain distinct records.

## Data and prompt isolation

Use a small dated source packet: stable security identity, original URL/provider, publication and retrieval times, financial period, units, source version, and explicitly missing fields. Preserve cited source bytes and derived metrics where rights allow. Store the final prompt/model/config, analyst outputs, counterarguments, approvals and decision timestamp before observing returns. A current model may have learned historical outcomes; replaying an old date with it does not establish prospective skill.

Treat articles, filings, tool descriptions and retrieved text as evidence, never as operational instructions. Research agents receive no broker-write capability, credentials, arbitrary execution tools or cross-account context. Prefer validated structured extracts plus source excerpts; preserve disagreements and missing data. A different model family can reduce one source of correlated error but does not make shared training data or a wrong source independent evidence.

Constantine and Gaspar may share public research only within its licence. Their OAuth grants, account snapshots, cash/tax constraints, mandate approvals, order state, logs and P&L remain owner-scoped. An identical model portfolio can yield different allowed orders in each account. No automatic propagation of one founder's mandate changes or approvals to the other. Do not assume a pooled account or shared investment authority.

## What Robinhood presently documents

Robinhood describes an external agent connected to `https://agent.robinhood.com/mcp/trading`, with desktop authentication/onboarding into an individual Agentic account. It permits per-order confirmation or user-instructed autonomous actions. Documented read access spans the customer's Robinhood accounts; trading is limited to the Agentic account. Consequently, dedicated trading funds do not by themselves isolate all readable personal data. Neutralis should filter account data before analyst exposure. [Robinhood overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)

The following public names are capability evidence, not discovered authenticated tool schemas:

| Needed function | Publicly documented tools |
| --- | --- |
| Account context | `get_accounts`, `get_portfolio` |
| Holdings and basis | `get_equity_positions`, `get_equity_tax_lots` |
| Current prices | `get_equity_quotes` (up to 20 symbols), `get_equity_price_book` (up to 4) |
| Research inputs | `get_equity_historicals`, `get_equity_fundamentals`, `get_financials`, `get_equity_technical_indicators` |
| Earnings | `get_earnings_results`, `get_earnings_calendar` |
| Screening | `get_scanner_filter_specs`, `get_scans`, `run_scan` |
| Pretrade and lifecycle | `get_equity_tradability`, `review_equity_order`, `place_equity_order`, `cancel_equity_order`, `get_equity_orders` |
| Broker performance | `get_realized_pnl`, `get_pnl_trade_history` |

The page describes long equities, options and crypto; margin borrowing is unavailable. Cash-account sale proceeds require settlement, while limited margin permits reuse of unsettled proceeds. `review_equity_order` supplies pretrade warnings; it does not establish a strategy paper-trading environment. [Robinhood tool catalogue](https://robinhood.com/us/en/support/articles/trading-with-your-agent/)

The product page describes a dedicated budget, trade notifications and disconnecting in the app. It explicitly places external agents outside Robinhood's supervision/audit. These affordances are not an investment committee, a scheduler, a strategy audit trail or our execution safety proof. [Robinhood product description](https://robinhood.com/us/en/agentic-trading/)

## Unknowns that the existing RH lead should resolve

- **Client feasibility:** supported custom-client onboarding, callback/registration policy, token storage and refresh/session lifetime, unattended operation, reconnect/revocation behavior, owner-specific entitlements and concurrency/rate limits. Existing public OAuth discovery and RH001 mock tests do not prove production acceptance.
- **Actual contracts:** authenticated tool input/output schemas, account targeting, permissions, pagination, timestamps, error/retry behavior, instrument IDs, quantity precision, allowed order forms, idempotency and order/fill status semantics. No schema should be invented from the public names.
- **Research coverage:** historical start dates, bar adjustments/total returns, original filing availability and restatements, assets needed for gross-profit/assets, historical share counts and universe membership, delisted outcomes, batch limits, retention and use by both founders. Public financials/historicals descriptions do not settle these requirements for FIRST-EXPERIMENT.
- **News and macro:** the public overview gives news/social research examples, but the opened tool catalogue does not identify a dedicated news/social/macro feed. Determine whether the external agent supplies this through separate sources and what rights/coverage are needed. Do not promise that all analyst inputs come from Robinhood.
- **Validation route:** a provider sandbox/paper account is unverified; plan a clearly internal forward paper ledger using observable data and explicit fill assumptions. An order review call must never be reported as a fill, performance test or broker sandbox.

These are documentation questions now. Actual account calls, discovery under authentication or schema capture require a separate concrete scope; no credentials are requested by this note.

## Keep costs tied to evidence

Run an on-demand or periodic research burst over a bounded candidate set and cache common evidence. Screening/calculations happen once; deepen only shortlisted names or material new events. Use small extraction passes and reserve higher-reasoning calls for difficult theses and PM review. Set per-run token/tool/concurrency/time limits and at most one reconciliation round; record an incomplete decision when the cap is reached. Do not add an endless debate loop or a separate always-on model for every ticker.

Estimate cost from measured input/output tokens, model prices, paid tool calls and worker time, plus licensed data/storage. A budget is not approved; do not translate agent count into a dollar promise. Separate incremental equities cost from existing shared hosting. Compare incremental annual cost with intended capital: a cost of C on capital K requires C/K additional annual return merely to cover it, before tax and added risk.

Follow the accepted stack direction: bounded Python research jobs and portable files first; a later Railway job may host the workflow, Supabase may store small immutable records, and the existing website can show decisions/status. No new orchestration platform, vector store, warehouse or continuous research daemon is needed for this pilot.

Freeze and forward-log the AI desk alongside the existing proposed numerical momentum/profitability comparisons. Compare one PM plus reviewer with two full PMs using the same inputs and risk budget; preserve all decisions, blocked cycles, costs, turnover and drawdowns. Model agreement, plausible theses and a short winning period do not establish an edge. FIRST-EXPERIMENT remains a distinct numerical test; this note does not quietly replace it or claim either strategy has been tested.

## Independent exact-dispatch challenge

Read the complete `.context/rh002-team-discovery-ticket-draft.md` and accompanying `docs/agent/ROBINHOOD-INVESTMENT-TEAM.md` as supplied by root. The two-PM peer allocation design is compatible with the note above; four analyst roles may be combined into fewer bounded model calls. Narrow clarification recommended before dispatch:

Ambiguity: The supplied team design requires joint acceptance for new/increased exposure but does not explicitly bind every discretionary trim or partial rebalance; require both PMs to approve the complete discretionary target, with any separately authorized reduction policy stated explicitly.

Reinterpretation risk: "Scoped receipt/current handoff" and a broad `docs/robinhood/` destination could be interpreted as permission to rewrite accepted RH001 documents; name additive artifact paths and preserve every file already present at the frozen base unless a precise documentation exception is declared.

Missing artifact-bound acceptance: Add the exact memo, receipt and handoff paths to the docs-only acceptance manifest, verifying that the full changed-file list contains only those additions. The existing exact-head/base/tree, full-diff, complete-text, dated-source and bundle requirements otherwise provide a concrete review boundary.

The remaining public-discovery prohibition, no-auth/no-tool-call boundary, exact RH001 base, sole existing owner, finite callback and whole-artifact review requirements are sufficiently explicit. No need for another founder permission question to complete these documentation clarifications.
