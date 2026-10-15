# Investment-team paper: bounded evidence note

2026-09-07. Independent GPT research helper, not Fable. Read the complete 14-page v1, submitted February 26, 2026: [primary abstract/version history](https://arxiv.org/abs/2602.23330), [pinned full paper](https://arxiv.org/pdf/2602.23330v1). No experiment, account, vendor-data request or product work.

Paper-derived summary and documentary limits:

- September 2023–November 2025: 27 monthly TOPIX 100 backtest periods; equal-weight long/short portfolios of 10–50 stocks, next-month opening execution, 50 stochastic trials/configuration. GPT-4o, temperature 1; no exact model snapshot specified. Inputs: Yahoo prices, EDINET filings, Ceek news and macro indicators. [§§3–4, pp.2–4](https://arxiv.org/pdf/2602.23330v1#page=2)
- Leakage controls claimed: August 2023 model cutoff and decision-time-public inputs. Historical constituent membership, macro revision vintages and snapshot-specific contamination audits are not documented. [§3.1, p.3](https://arxiv.org/pdf/2602.23330v1#page=3)
- Seven roles retain one final PM. Comparisons change analyst features/prompts and remove specialist roles; they do not test two-PM consensus. Precomputed indicators versus raw inputs prevent isolating prompt granularity alone. Fine settings outperform at four of five portfolio sizes; several agent removals improve performance. [§§5–6, pp.4–6](https://arxiv.org/pdf/2602.23330v1#page=4)
- Explicit transaction costing is 10bps one-way in portfolio blending; inference/data/hosting and borrow costs are unreported. [§6.4; Appendix C](https://arxiv.org/pdf/2602.23330v1#page=13)
- Limits: one market/model, short history, possible linguistic bias; repeated runs reuse that history. [§7.2, p.8](https://arxiv.org/pdf/2602.23330v1#page=8)

Our proposed implication, not a new mandate:

For any later empirical use of the already planned one-PM/two-PM comparison, preserve the same analyst task decomposition and exact shared packet/memo versions in both arms. Otherwise an apparent committee benefit could come from different evidence preparation. Keep the distinct decision protocol as the intended treatment, with the committee's extra calls and follow-ups charged explicitly. This paper supplies no expected benefit size for adding the second PM; our comparison still has to establish whether its additional decisions justify their costs.

[EQ001](../docs/agent/tasks/EQ001-investment-desk-foundation.md:13) already requires common packets/controls, separate holdings/arm identities and attributable synthetic costs. It remains an unimplemented offline protocol ticket, not an empirical validation. No alteration of the accepted strategy, unknown-evidence rule, source rights, budget or rollout scope follows from this note.
