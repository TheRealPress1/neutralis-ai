# UI003 Exchange integrated candidate01 — independent GPT review

Verdict **REVISE**, reported 2026-09-07 by assigned reviewer `c8639b0a-38dd-41fe-b014-5c31e915cc6d` in the verified frontend workspace. Same-family review during the founder-reported Claude quota exception; not a new Fable pass. This file summarizes the independent report, rather than claiming to be its original bytes.

- Exact release HEAD `9d182ae8ac627719954ea82b0a3860c872767350`, parent d524b5a, src tree `3eb3df7b86b7fd46f1d67b6668b257754e648f43`.
- Detached review worktree in frontend VM: `/home/vercel-sandbox/review-ui003-exchange-c01-gpt`. Source remains clean.
- Original report: `.context/reviewer/REVIEW-UI003-candidate-01.md` under that worktree, SHA256 `cd4b9e47ad5230f21be1ea1f67de4993ee33701599cba3693195811c7f0c4515`; evidence manifest `.context/reviewer/evidence-index.json`. [Reviewer session](conductor://workspace?id=71f761b2-e913-4149-9bd1-150c1b2a7553&session=c8639b0a-38dd-41fe-b014-5c31e915cc6d).

## Findings

1. **P2:** `src/app/dashboard/components/ActivityTimeline.tsx:147`: null open unrealized or closed realized P&L crashes the Activity route into the desk error boundary. Valid data renders; Portfolio already shows the same incomplete records as unavailable. Parent reviewer and fresh critic independently reproduced both cases.
2. **P2:** `src/app/dashboard/components/RiskProfileEditor.tsx:269`: all eleven paid Settings inputs lack accessible names because their visible labels are not programmatically associated.

Both are retained baseline gaps, not newly introduced formatters or controls. They still violate UI003 actual-route data/accessibility acceptance. Astra accepted both and assigned only their narrow correction to the existing B writer. No backend/accounting changes or broader Settings redesign.

## Verification and limits

Exact-head build, scoped lint, source audit and P&L regression exited0. Reviewer verified all151 tracked non-src inputs and29 producer capture hashes. Actual-route browser/auth/data-state evidence and harness corrections are in the original report. Fresh critic `/root/ui003_exchange_c01_critic` returned REVISE; final result collected. Servers3105/43105 stopped. These isolated fixtures do not establish deployed account health or live-service operation.

Candidate02 requires independent affected-path recheck and fresh bounded critic. Current publication authorization remains, but review correction and separate Railway trigger preflight precede main push. No publication occurred. Final findings forwarded to the builder in message `3b49dabd-e11c-47cb-9e15-00c7552cdcfd`; receipt `.context/ui003-c01-final-findings-receipt.json`.
