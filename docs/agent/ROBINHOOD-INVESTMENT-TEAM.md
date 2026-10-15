# Neutralis Robinhood investment team

2026-09-07. Constantine wants the equities side organized like an investment firm: one or two portfolio managers directing specialist analysts, with a relationship similar to the development co-head desk. This accepts the organizational direction and further exploration. The operating rules below are a concrete proposal for research, not commissioned live trading or a claim of strategy performance. Arbitrage stays separate.

## Proposed first team

Use two peer portfolio managers responsible for one portfolio, supported by four analytical functions. Following Fable's returned co-head review, the proposed pilot combines company fundamentals and catalysts into one memo per company, produces one industry/macro memo per cycle, and computes quantitative measurements in code. These are bounded tasks in a shared research process; the role chart does not imply six continuously running servers or new Conductor coding sessions.

| Role | Responsibility | Output |
| --- | --- | --- |
| Fundamental analyst | Business economics, revenue quality, profitability, balance sheet and valuation | Cited thesis, valuation range, uncertainty and what would invalidate it |
| Industry and macro analyst | Industry structure, rates, policy and economic exposures | Drivers, scenarios and portfolio-wide exposure observations |
| News and catalyst analyst | Filings, earnings, guidance, corporate events and material new information | Dated event evidence, expected timing and conflicting information |
| Quantitative analyst | Price behavior, volatility, liquidity, correlations and simple benchmarks | Computed measurements with reproducible inputs; no invented statistics |
| Portfolio managers A and B | Commission research, compare opportunities, size the portfolio, challenge concentration and decide when a thesis has expired | One versioned portfolio decision with agreed weights, cash, reasons and dissent |
| Risk controls | Enforce the founders' explicit capital, position, turnover, liquidity and instrument limits | Deterministic pass/reject with reasons |
| Execution and accounting | Translate a permitted decision into orders, reconcile actual fills and retain the audit trail | One account-bound order plan and observed results |

The risk and execution roles need conventional software checks. LLM commentary can supplement those checks but cannot override them. Analysts have no broker credentials or order tools. Portfolio managers propose decisions; only the separate execution boundary can possess eventual authorized trading access. Research receives only the market data and redacted account information it requires.

## Two managers, one accountable decision

Both managers start with the same dated evidence snapshot and mandate. Different model families are the proposed first comparison; this may diversify errors but does not establish statistical independence. Each initially gives an independent allocation/thesis assessment before seeing the other's proposal, reducing simple anchoring. One is the proposal author for a cycle and the other is the challenger; responsibilities can rotate. Neither independently trades the same account.

Use one bounded discussion and one revised proposal. Every discretionary rebalance, including trims, reductions and exits, needs both managers to accept the same final decision version and the deterministic risk controls to pass. Neither manager may execute a subset of an unapproved plan. Remaining disagreement records dissent and produces no discretionary order. Existing holdings are retained pending the scheduled decision or founder review; disagreement is not an automatic liquidation instruction. A useful next proposal is an objective exit rule inside the paper mandate, with observable criteria, timestamps and explicit missing-data handling. Subjective thesis disagreement alone is not a mechanical trigger. Any future live emergency exit/stop behavior must be explicitly specified and approved in the mandate, with its own single execution authority; no such authority is granted here.

Missing analyst/model availability, stale inputs, unaffordable research or an expired decision does not silently become a one-manager approval. A separately configured one-PM-with-software-controls experiment is a legitimate cheaper comparison, not an automatic fallback. Agreement between models is not independent statistical evidence of an edge.

## Research cycle

1. The data step records a decision cutoff and gathers shared inputs once. Analysts receive bounded questions, sources and deadlines. External articles, filings and tool responses are evidence, never instructions that can change permissions.
2. Each company/macro research task returns a short structured memo: security IDs, facts and dates, original sources, calculations, thesis, counterargument, missing data and invalidation conditions. Unknown facts remain unknown. Quotes and metrics carry freshness/availability information.
3. The managers compare those memos with existing positions, available cash, upcoming events and competing opportunities. They may request one targeted follow-up inside the cycle budget.
4. The decision step uses only the frozen packet, with additional browsing disabled. Its final proposal names the exact source/prompt/model/config versions, time, intended account, existing holdings snapshot, target weights, cash, rationale and decision expiry. Founder/account authorization never comes from a source document or model-generated label.
5. A paper ledger first simulates execution with explicit prices, timing, costs and unavailable-fill handling. Later live integration, if separately commissioned, would recheck current account state and permissions and use a single order dispatcher. An unknown broker acknowledgement requires reconciliation, not blindly resending an order.
6. Record all candidate decisions, rejected ideas, model/research cost and subsequent outcomes. Keep separate paper portfolios for one PM with software controls and two independently briefed PMs with identical controls, sharing analyst packets and comparing with passive references. This isolates the PM-stage difference, not the value of the shared analysts. Forecasts across related companies and overlapping horizons are dependent; a short pilot or a fixed count of successful objections cannot establish an investment edge. Separate factual/control diagnostics from net returns, drawdown and costs.

Illustrative cadence for the first proposal: a weekly decision meeting, cached research between meetings and event-triggered updates for material filings/earnings. Exact cadence/universe/risk/capital limits must be frozen with the experiment; this document does not silently replace the monthly momentum/profitability proposal. Current models can know historical outcomes, so forward decisions saved before returns occur are particularly useful for evaluating judgment-heavy LLM strategies. A handful of successful weeks is insufficient proof.

## Robinhood fit and unresolved capabilities

The official [overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/) describes third-party agents connected through Trading MCP, dedicated Agentic accounts and both interactive and user-authorized autonomous orders. Its [tool list](https://robinhood.com/us/en/support/articles/trading-with-your-agent/) provides market/account research, financials, earnings, scans, order review and execution. This supports an external research-and-decision process feeding a broker connection; Robinhood does not provide our multi-agent committee, risk policy, durable scheduling or strategy validation.

The documented grant reads across Robinhood accounts while trading is restricted to the Agentic account. Treat the underlying grant as potentially broad. A proposed role-specific read proxy and an isolated execution credential owner require implementation and verification; a prompt saying 'do not trade' is not that boundary. Preserve one account owner's consent, tokens, budget and audit records per account. Constantine's and Gaspar's individual accounts must not be pooled or share credentials; common market research can be reused without exposing private account records.

RH001 already has an independently reviewed offline connection/security foundation at `3dd6343cf08b2793da456744e757db67e2abb82e`; it is not an authenticated broker connection. Remaining discovery includes custom server-client registration/callback support, actual permission granularity, account catalog and schemas, token renewal/disconnect, tool limits, scheduling/session constraints, historical coverage and point-in-time availability. A pre-trade order review is not evidence of a broker paper-trading sandbox.

The proposed first forward paper experiment can be independent of a Robinhood connection, if a usable licensed price/actions/filing feed is verified. Use public documents and exact permitted well-known discovery metadata first. Do not install a trading connector, authenticate/register a client, open/fund an account, invoke financial account/order tools or start a service from this architecture exploration. Those steps need their own concrete scope; no new permission question is necessary for the current documentation work.

## Cost and deployment

For the first research experiment, use on-demand batches, cache the shared data, limit candidate count, permit only one follow-up round and record model calls/tokens/cost. Price uncached input, cached input and output separately; cached input is a subset of total input and must not be charged twice. Show both incremental equities costs and a stated allocation of shared hosting; current bills and capital remain unverified. A model outage or exhausted budget ends the cycle explicitly. Do not let autonomous analyst spawning create unbounded spend. Subscription coding access does not establish deployed API access or pricing.

Conductor remains the IDE where we develop and review this system. A future deployed worker can run the investment process on the accepted stack: Python jobs, private file snapshots and small database records, with a simple Vercel dashboard. It need not remain open in Conductor. A standalone local/batch research version can precede a dedicated Railway service or additional Supabase plan.

The co-heads own the experiment definition. Next deliverable: RH002 public capability and architecture feasibility memo from the existing Robinhood lead, mapping each co-head-specified research input to documented Robinhood coverage, usable public coverage or an unresolved gap. Include bounded cost accounting, actual RH001 reuse and narrow future implementation files. Fable will independently review the complete specialist artifact across model families; Astra retains dispatch and shared-record writing. No dataset purchase, infrastructure change, production credentials or performance claim follows from this design.
