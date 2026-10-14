# ARB002 proposed contract review

2026-09-06 — documentation-only PASS. The ticket remains proposed and no implementation is dispatched.

Lead: GPT-6 Astra Ultra `50ea0c8e-5888-4d14-9f42-3c1ade31d33e` in the verified arbitrage workspace. Revised documentation commit: `a62c0f46bf5bd6195dfa649f11804f353c5b8943`, parent `e83bd1cbcbf0aa6d8f0abb3b5a18197fe56b529d`. Four documents changed: proposal, current handoff, readiness plan and first-ticket index. Lead reports whitespace checks passing, both worktrees clean and recovered original fix/ref unchanged. No product changes or runtime tests in this milestone.

Root received the full 28,200-character proposal in transcript row `c13086ac-b609-4e57-9daa-21d3f201a995`, stored at `.context/ARB002-proposed-ticket-export-a62c0f46.md`. Root and fresh independent GPT reviewer `/root/arb_contract_check` compared it against the preceding export and the three requested corrections. This is a same-family documentation assessment during the Claude quota limit, separate from Fable’s completed ARB001 source review.

- Lines 92–105 preserve original user/context, result handler and recording dependency for a response from an already-started request after revocation/orderly stop. Later outbound actions still require fresh controls. Lines 210–219 require the delayed-response test using the real continuation.
- Lines 23–29 and 58–73 make startup mode, arm and legacy veto immutable for the run. Lines 205–208 change the actual exact-user control provider while keeping the same executor and policy, so the revocation test cannot pass by reconstructing the system.
- Lines 114–150 name minimal policy, supplied inputs, control provider, run-local sinks and external factories, plus the shared import-safe preparation callable. Paper rejects production/delegated/wrong-run storage; positive tests retain real dispatch, gate, adapter payload and result handling.

No remaining material contradiction was found in those contracts. This is sufficient as a concrete reviewable proposal. It does not establish implementation correctness, confirmed fill semantics, recovery/exits, persistent paper isolation, production readiness or permission to trade. No M1 branch or product writer was created.
