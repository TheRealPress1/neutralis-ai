# Fable co-head peer note — Robinhood investment team, first experiment, RH002 challenge

Date: 2026-09-07 UTC. Author: Fable co-head e9a2da19-6038-4eb7-bb1e-a61f585f6fb6 (orchestration workspace 44048587). Private note; not a shared record, not a dispatch. Root checkout HEAD d524b5a unchanged; no product edits, no messages sent, no MCP/OAuth/account calls.

Inputs read in full: docs/agent/PROJECT.md, STATE.md, MEMORY-INDEX.md, ROBINHOOD-INVESTMENT-TEAM.md, ROBINHOOD-AGENTIC-RESEARCH-UPDATE.md, tasks/RH002-investment-team-feasibility.md, reviews/RH002-architecture-gpt.md, reviews/RH002-dispatch-gpt.md, NEXT-MILESTONES.md (head). Public GET only: three Robinhood support/product pages (below).

## 1. Facts verified today from Robinhood's public pages

- Overview (https://robinhood.com/us/en/support/articles/agentic-trading-overview/): "connect a third-party AI agent to a dedicated Robinhood account to automate investment decisions and order placement"; MCP link https://agent.robinhood.com/mcp/trading; read access to all Robinhood accounts (positions, balances, transactions, order history, watchlists, scans); trade access only in the dedicated Agentic account; agents may place trades without confirmation if so instructed; desktop device required for setup/authentication; primary individual account in good standing required; up to 10 self-directed individual accounts; named clients: Claude (Code, Desktop), ChatGPT, Codex, Codex CLI, Cursor, Grok, plus "other AI platforms that support MCP connections".
- Tools page (https://robinhood.com/us/en/support/articles/trading-with-your-agent/): equity historicals (OHLCV over a time range, depth unspecified), fundamentals, financials by quarter/year (revenue, gross profit, net income, margin), Level 2 book for up to 4 symbols, technical indicators, earnings results/calendar, index tools, get_accounts/get_portfolio/get_realized_pnl/get_pnl_trade_history, watchlists, equity/options/crypto order review/place/cancel, tradability. No stated rate limits. **No paper/simulation mode; orders execute live.** Limited margin only.
- Product page (https://robinhood.com/us/en/agentic-trading/): "Paste one URL into your MCP config to connect most agents out of the box"; dedicated budget, per-trade notifications, disconnect anytime; "Robinhood does not control, supervise, monitor, recommend, or audit these AI agents"; "Once your data is shared with an AI provider of your choice, it leaves Robinhood's security environment"; entire-loss risk disclaimer.

Consequences: (a) Robinhood supplies broker access and current-data lookups, not a research archive, not a paper sandbox, not scheduling, not a committee, not an audit trail. (b) Read scope is broad; our analyst layer must never see raw account reads. (c) The MCP URL is designed for standard MCP clients; whether a Neutralis server-side client is accepted remains unverified (RH001 open item). (d) Because autonomous orders are possible, any founder desktop agent connected to the same Agentic account is a second executor; the single-executor invariant must be a founder rule, not just software.

## 2. Split challenge

Accept Astra's proposed split with two amendments:
1. RH002 is unsent. Before it goes, its §4 (first paper experiment) moves out of the RH lead's memo into a co-head-owned experiment specification (this note is the draft). The RH lead's memo answers "what coverage does Robinhood give for each input of that specification" rather than designing the experiment. Otherwise FIRST-EXPERIMENT.md and RH002 §4 become two competing experiment definitions written by different owners.
2. Because the ticket, both RH002 reviews and the RH001 revision review are GPT-family, the RH002 deliverable's independent review should be cross-family (Fable) when it arrives. Not a rerun of RH001.
Astra keeps dispatch and sole shared-record writing. Peer status unchanged.

## 3. Architecture challenge

A. **Hold-on-disagreement is a decision nobody approved.** Joint acceptance of the same complete rebalance including sells means a broken thesis cannot be exited unless both PMs agree, which inverts the safety intent. Material change: every position carries a pre-registered invalidation condition recorded at entry (analysts already produce these). If the condition triggers, exit is a mechanical rule executed by risk software, not a PM vote. Discretionary changes still need both PMs. Disagreement then leaves a portfolio whose every position has a live, pre-approved exit rule, so "hold" is a defined state rather than an accident. This also gives the emergency-reduction policy a concrete, founder-approvable form.
B. **Four analyst roles is too many for the pilot.** Quant should be code, not a model. Fundamental and catalyst can be one memo per name. Macro is one memo per cycle, not per name. Two model calls per name plus one per cycle.
C. **Correlated PMs.** Use different model families for PM A and PM B (as with the co-heads). Same-family agreement is one opinion twice.
D. **Attribution.** Each arm keeps its own paper portfolio from identical inputs; otherwise the second PM's value is unmeasurable. See §4.
E. **No browsing during decision.** Frozen packets, model version and prompt hash recorded, tools disabled, so forward paper is not silently contaminated by post-cutoff news.
F. **Robinhood-independence of the experiment.** The first experiment must run without a Robinhood connection: public prices and SEC financials for a small universe. Robinhood enters at the later execution milestone. This removes RH001's open questions from the research critical path.

## 4. Strongest small first experiment (proposal, not commissioned)

Question: does an LLM investment desk make better decisions than a fixed rule at the same risk budget, and does a second PM add measurable value over one PM plus challenger?

Design, three arms from one shared evidence packet per cycle:
- Arm 0, mechanical benchmark: equal-weight of the fixed universe, rebalanced monthly; plus a broad index series as a second reference.
- Arm 1, one PM plus deterministic checklist reviewer (software validates completeness, limits, invalidation conditions; no second model).
- Arm 2, PM A plus PM B challenger (B objects or accepts; one reconciliation round).
- Arm 3, two independently briefed PMs with joint acceptance (the founder's stated shape).
Analyst memos are produced once and shared by arms 1 to 3, so the marginal cost of each arm is only its PM calls.

Universe: 30 to 50 liquid US large caps selected by a fixed non-LLM rule at start (e.g., top by dollar volume within a public index list), frozen for the experiment. Cadence: weekly; cutoff Friday close; paper fills at next Monday open with a stated cost assumption (label: assumption, not observed). Duration: 12 weeks minimum, extend to 26 if inconclusive; pre-registered stop rules. Decisions, prompts, packets and approvals are hashed and stored before outcomes.

What convinces us the extra agents earn their cost (pre-registered, observable at small N; returns alone are underpowered over 12 weeks):
1. Factual error rate per analyst memo, audited against sources (target and threshold set before start).
2. Calibration: each cycle every PM answers pre-registered short-horizon binary questions per candidate (e.g., outperform benchmark over 4 weeks); Brier score vs base rate. Gives 30 to 50 forecasts per week per arm.
3. Objection adjudication: for arm 2 and 3, every PM B objection that changes the decision is logged; at 4 weeks the counterfactual (arm 1 decision) is compared. Extra PM is worth keeping only if changed decisions beat unchanged ones at a rate above chance over at least 30 adjudicated cases, or if it catches control/factual errors the checklist missed.
4. Control violations caught pre-execution and turnover/cost per arm.
5. Returns, drawdown and exposure per arm vs arm 0, reported with intervals and explicitly labelled underpowered.
Kill rules: arm dropped if its incremental cost exceeds any measurable decision-quality gain at the review point.

Cost formula (no prices asserted): per cycle tokens = N_names × (memo_in + memo_out) + macro_call + Σ_arms PM_calls × (pm_in + pm_out). Workload example for N=40: about 40 × 8k memo tokens ≈ 320k, plus roughly 4 PM calls × 40k ≈ 160k, ≈ 0.5M tokens per week. Multiply by the provider's current published rate for the chosen models; compare annualised cost C to capital K: required extra return ≈ C/K before tax and risk. Illustrative only.

Data for the pilot: public daily closes for ≤50 names and SEC financials via EDGAR; no purchase. Robinhood historicals/financials become an option only after owner onboarding and are current-data lookups, not a vintage archive.

## 5. Robinhood provides vs Neutralis must supply

| Layer | Robinhood (documented) | Neutralis |
|---|---|---|
| Broker account, orders, fills, P&L | yes (Agentic account; live only) | executor adapter, idempotency, reconciliation (RH001 base) |
| Current quotes, bars, financials, earnings, scans | yes, after auth; depth/vintage unspecified | evidence packets, freshness, isolation from account data |
| Paper trading | no | forward paper ledger |
| Scheduling, cycles, decision records | no | batch jobs, immutable decision store |
| Risk limits, mandate, kill state | no (budget + notifications only) | deterministic controls |
| Multi-agent desk, attribution | no | arms, prompts, adjudication log |
| Per-founder consent/tokens | per account | strict separation (RH001) |

## 6. Recurring cost question

Railway and Supabase figures are shared platform costs carried by the arbitrage hardening and the dashboard; they do not need equities conviction. The equities pilot needs zero new infrastructure (local/batch Python, files). The conviction gate applies to (a) a paid historical dataset and (b) any dedicated always-on worker; neither is required until the pilot produces pre-registered evidence. Report incremental equities spend separately: model tokens, any data fee, and time.

## 7. RH002 three-line challenge

- Ambiguity: §4 assigns experiment design (universe, cadence, benchmark, cost model, PM-count comparison) to the connection lane while FIRST-EXPERIMENT and this note define experiments elsewhere; two owners, two definitions. Change: §4 becomes a coverage matrix against a co-head-supplied specification.
- Reinterpretation: "recheck exact previously discovered MCP/OAuth metadata" can be read as a GET to the MCP endpoint path itself; RH001 already observed a 401 that way. Change: permitted URLs are the well-known metadata document and support/product pages only; no request to /mcp/trading.
- Artifact-bound acceptance: add (i) a per-input coverage verdict (Robinhood-after-onboarding / public / missing) for every input of the specification, (ii) verbatim no-paper-mode and autonomous-order statements with URL and date, (iii) the exact owner onboarding sequence and the evidence each step would produce, (iv) the single-executor founder rule about personal desktop agents on the Agentic account.

## 8. Not done / limits
No MCP initialize/list/call, no OAuth or registration, no account read, no order, no model batch, no data purchase, no runtime. Robinhood page summaries are from public GET today; tool schemas unknown. Custom-client acceptance unverified. No return or edge claimed for any arm.
