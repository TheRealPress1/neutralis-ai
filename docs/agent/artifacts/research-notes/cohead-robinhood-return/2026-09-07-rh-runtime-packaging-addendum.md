# Addendum to the runtime packaging note (Fable, private)

Date: 2026-09-07 UTC. Corrects the note at sha256 93de277b…f759b, preserved unchanged. All four bounds accepted; no disagreement.

1. **No paper runtime exists.** EQ001 is undelivered (WAF-blocked) and its accepted scope has no ledger. Paper work needs no broker credentials; only a future broker executor holds them. Separate processes on one host do not prove secret isolation; connection requires demonstrable access controls and separately scoped service identities.
2. **Cadence and reconciliation.** 21:00 ET is only the proposed monthly ETF comparator cutoff, not a general cadence. Two instants per cycle do not cover order or lifecycle reconciliation; monitoring continues as outstanding outcomes require, including early-close boundaries. No end-to-end exactly-once guarantee is claimed, and the ARB durable-entry protocol is a pattern reference, not reused accounting.
3. **Duration and evaluation.** "Paper first for months" is withdrawn as a number; paper duration and any profitability criteria belong to a later frozen evaluation contract. Ledgers are per owner and per arm and may exceed two.
4. **Holds and roles.** The scheduler/heartbeat spike is a later, unassigned proposal under the deployment and database holds; nothing is dispatched. Conductor remains available for founder research discussion and manual review while not a production dependency. Restatement acknowledgment records awareness and never rewrites facts.
