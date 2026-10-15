# Equities research direction

2026-09-06. Astra assessment in response to Constantine's theoretical question, with a bounded independent research challenge. This is a proposal, not a strategy implementation or live-trading order.

Constantine confirmed Neutralis will be an internal platform only for him and Gaspar and will not be sold. He asked whether stock prices, fundamentals, news and macroeconomic history could support backtested strategies monitored and traded by an agent.

He clarified that this is a new strategy within Neutralis, independent of the current arbitrage implementation: discover measurable historical conditions associated with subsequent price increases, formalize them and test a buy/hold/exit policy. Existing-code investigation is not a prerequisite for answering that conceptual question.

The concept is feasible as a research system. Profitability remains an empirical question. Data aggregation, repeatable strategy tests, risk controls and broker execution are separate capabilities; providing an agent with order access establishes none of the others.

Robinhood's current primary documentation describes connecting a third-party agent through its Trading MCP, reading account information and placing orders in an Agentic account. This verifies the product premise, not strategy performance or account eligibility for either user. [Robinhood Agentic Trading overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)

## A bounded first experiment

Choose one hypothesis, one holding horizon measured in days or weeks, and a modest historically eligible stock universe. For example, test whether improving reported fundamentals plus subsequent price strength predict later returns beyond a simple price-only rule. This is an illustrative untested hypothesis; no parameter or return claim is established.

Define the full entry, exit, position-sizing and risk rules before final evaluation. Build a timeline of what was knowable at each simulated decision; simulate the next executable price after the release/signal. Fit on earlier periods, evaluate frozen rules on later untouched periods, compare with simple benchmarks at similar risk, and then log forward paper decisions without retuning against the evaluation record. Track every attempted hypothesis and model version.

Required evidence should include net returns after plausible spread/slippage/fees, drawdowns, turnover, exposure, sample size, results across several market environments, and sensitivity to execution assumptions. Rising-market exposure alone is not proof of an incremental signal. Increasing parameter searches can produce false discoveries; ordinary holdouts also lose value when repeatedly consulted. [Bailey et al., The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf)

## Data and model integrity

- Store observation period and actual publication/availability time separately. Use the release/filing timestamp, including after-hours timing. Preserve news revisions, financial restatements, corporate actions, delisted names and historical universe membership where relevant.
- Economic series are revised. A present-day historical series can include facts unavailable to a past trader. ALFRED preserves data vintages for this purpose. [St. Louis Fed real-time periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html)
- A modern LLM can have knowledge of events after a simulated historical decision, even if its supplied articles are old. Historical LLM-sentiment results need leakage checks; a frozen forward paper experiment gives cleaner evidence than asking today's model to pretend it is in the past. [Glasserman and Lin, Assessing Look-Ahead Bias](https://arxiv.org/abs/2309.17322)
- One stock provides few independent fundamental events: ten years of quarterly reporting is roughly forty reports. More ticks around those reports do not create more independent earnings events. Cross-company and cross-period checks need to account for shared market shocks.

## Proposed Neutralis division of work

An agent can gather cited evidence, extract structured information, propose hypotheses, run reproducible experiments and explain monitored signals. Frozen strategy code should calculate signals and permitted sizes; independent controls should enforce account scope, exposure limits, stale-data rejection and stopping conditions. The execution/accounting system must reconcile confirmed orders and fills independently of narrative explanations.

The first useful deliverable would be a research view showing the hypothesis, input data versions, rules, evaluation periods, benchmark comparison, drawdown, costs and reasons a candidate failed. Stock brokerage integration is a later decision. The current restart's missing phantom-fill patch and execution/accounting findings remain dependencies for trusted live execution, including any future equity adapter.

No new data subscription, broker connection, strategy build, product builder lane or live execution has been commissioned by the theoretical discussion. Proposed choices still needed: initial stock universe, decision horizon, research data budget and first testable hypothesis.
