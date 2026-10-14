# Strategy prioritization and cost-evidence challenge (Fable co-head, private)

Date: 2026-09-07 UTC. Inputs read in full: docs/agent/EQUITIES-STRATEGY-EVIDENCE-20260907.md (sha256 f0c8cfbc…804a4) and docs/agent/ETF-SOURCE-OPTIONS-20260907.md (sha256 d185eeee…2bb9). Independently re-verified today: FRED legal clauses (p), (q), (k), (l) prohibit ML/software development use and any storing/caching/archiving; Alpaca FAQ: historical SIP without subscription when `end` is at least 15 minutes old, silent on storage. EQ001 final hash ebe264cc…9991 confirmed with evaluation_instant, research/desk/tests and d524b5a base. No purchase, run or FIRST-EXPERIMENT change.

## 1. Agreement
The evidence ranking is right: momentum/profitability is the only candidate with a substantial published signal base; broad-index trend is a cheap exposure/risk comparator, not a selection signal; the LLM team has no published support for a low-turnover long-only committee edge. Kim/Muhn/Nikolaev is correctly excluded. Lopez-Lira & Tang (daily long-short, ~190% turnover, negative at 20 bp) and Anic et al. (overlay, 15-month test, p<0.10, 2 bp costs) do not transfer to our mandate; TradingAgents is a 3-month demonstration.

## 2. The question is cost-to-first-honest-evidence, not expected alpha
No route has an expected return we can quote. What differs is what it costs to get a result that can fail. Ranked by that:

| Route | Data cost to first evidence | Compute/model cost | Rights status today | First evidence obtainable |
|---|---|---|---|---|
| Factor core (FIRST-EXPERIMENT) | Highest: PIT universe, filings, actions, delistings; paid vendor class, unresolved | ≈0 | Vendor shared-use unresolved | Historical net-of-cost comparison vs its own controls, once data accepted |
| Trend/cash comparator | Near 0 if Alpaca SIP archive/shared use is permitted; Treasury feed for rate; FRED excluded | ≈0 | Alpaca storage/shared use unresolved; Treasury retention terms unchecked | Historical since 2016 (Alpaca) + prospective |
| LLM desk forward diagnostics | Near 0: SEC EDGAR (public domain) + Alpaca prices + Treasury rate | Tokens only; rate table unset | Model-provider processing of Alpaca data unresolved | Protocol diagnostics after EQ001 lands; no return claim |

Consequence: the desk's first forward cycle is cheaper to start than the factor core's first result, because the factor core needs a paid point-in-time archive and the desk needs only public filings plus a conditional free price feed. That does not make the desk more promising; it makes its diagnostics cheap. Recommended order: (a) settle capital K and account tax status; (b) run the factor core when data is accepted; (c) register the trend comparator now at ~0 cost; (d) start desk forward diagnostics after EQ001 with public sources and no model budget beyond a small dated rate table.

## 3. Challenges to the notes
1. **K first.** The C/K table is illustrative but the founders have not stated K. Without K no route can be justified or rejected; make it decision zero. Also state whether accounts are taxable, since turnover drag differs by an order of magnitude.
2. **Trend comparator must be exposure-matched.** Its historical benefit is mostly lower average equity exposure. Register three baselines before results: buy-and-hold ETF, a static equity/cash mix with the same average exposure as the rule realised over the development window, and the rule. Report exposure-adjusted differences; raw drawdown comparisons are not evidence of timing skill. Keep it out of the factor mandate unless separately registered.
3. **Treasury as cash rate is probably resolvable; verify, don't assume.** treasury.gov content is generally a US government work; the note leaves retention "not established". One check of the site's terms page closes it. First-pass paper cash may simply be declared zero-interest, labelled as a modelling choice.
4. **Alpaca rights question is concrete and small.** The blocking question is whether raw historical bars may be stored durably in a private two-founder research database and sent to a third-party model provider. Draft one written question for founder approval; do not send now. Each founder holding their own account does not answer it.
5. **Tiingo Starter excluded correctly; Commercial is a fallback with a retention question.** Do not spend $300–$499/yr before Alpaca's answer.
6. **Desk cost hurdle should be stated as tokens per decision, not per year.** With EQ001 cost records, report cost per admitted decision and per rejected decision; the desk is unjustified if its per-decision cost exceeds the factor rule's cost by more than the diagnostics can plausibly earn. That is a diagnostics statement, not an alpha statement.
7. **Buffer variant** (Novy-Marx & Velikov) belongs in the factor track as a separately registered hypothesis after the first result, not before.
8. **Contamination checks** (Levy 2026) should be a required EQ001 follow-on for the desk: numerical perturbation of a packet must not change a PM's cited facts; prompt/model versions frozen. Cheap and decisive for honesty.

## 4. Decisions for the founders (via Astra)
- Capital K per strategy and account tax status.
- Approve one written rights question to Alpaca (storage, shared two-founder use, model processing).
- Register the trend comparator with exposure-matched baselines at zero data spend.
- Confirm no model API budget until EQ001 diagnostics exist; then a small dated rate table.
