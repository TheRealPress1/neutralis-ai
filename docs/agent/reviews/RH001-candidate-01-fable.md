# RH001 — independent Fable code review

Delivered through scoped Conductor transcript from reviewer49140ccd-39fa-424e-b5a8-e05afbf24c23. Review worktree paths refer to the Robinhood VM.

Review complete. All evidence is gathered, so here is the report for Astra.

## RH001 offline foundation, independent Fable review

**Verdict: REVISE (offline milestone only).** One concrete lifecycle defect with a small fix. Nothing here enables live trading, and this verdict does not authorize merge or deployment. Code should stay frozen until the sole builder addresses defect 1.

**Reviewed head.** `b60fcf3e07a7d08c72c2671aad662215dc2b6271`, detached in `/home/vercel-sandbox/review-rh001-c01`. Ancestry verified: base `d524b5a` and checkpoint `ca3cd29` are both ancestors, three commits on top of base. The builder checkout was not modified and remains clean at the same head. Conductor confirmed the workspace, creator, repo, project, and the Astra builder session. The Fable co-head session lives in the orchestration workspace, as described.

**Inspected scope.** All 19 files changed against the checkpoint: the nine runtime modules and three test files under `src/lib/brokers/robinhood/`, the offline tsconfig, both package files, AGENTS.md, and the three lane docs. The discovery snapshot was cross-checked against the endpoint pins. No file outside `src/lib/brokers/robinhood/` imports these modules. Nothing else in `src/` imports server-only.

**Reproduced independently.** Compiled and ran inside a fresh network namespace (`sudo unshare -n`) where I first proved TCP to public and loopback addresses and DNS all fail. The throwing-fetch stub also ran and asserted zero calls.

| Check | Result |
|---|---|
| `tsc -p src/lib/brokers/robinhood/tsconfig.offline.json` | pass |
| `node --conditions=react-server --test …/foundation.test.js` in netns | 45 pass, 0 fail |
| `eslint src/lib/brokers/robinhood --max-warnings=0` | pass |
| `git diff --check ca3cd29 b60fcf3` | pass |
| Type-check of the new files under the app's root tsconfig settings | pass |
| Lockfile | 7 added lines, only server-only@0.0.1. Tarball integrity matches the local npm cache entry |

Limitations: I used the builder's installed dependencies through a symlink, without mutating them. No full app build or unrelated tests were run. Mock stores prove domain use of the interfaces, not database atomicity.

**Defect 1 (material, lifecycle).** A refresh on a connection with no credential persists a failure state and then blocks authorization. In `src/lib/brokers/robinhood/connection.ts:92`, the missing-credential check throws inside the try block of `refresh()` (lines 204 to 210), so the catch routes it into `failure()`, which writes `status: "unavailable"` and bumps the revision. Reproduced offline: a row in `awaiting_authorization` with `phase: owner_consent` becomes `unavailable` after one refresh call, and `AuthorizationTransactions.begin()` then rejects with `authorization_mismatch` because `authorization.ts:51` requires `awaiting_authorization`. No in-scope operation restores that status, so the connection is stuck. A `not_connected` row is likewise rewritten to `unavailable`. By contrast `readAccount()` checks the credential before its try block at line 171 and persists nothing. Suggested fix: hoist the credential check in `refresh()` above the try, mirroring `readAccount`. No token exposure or boundary bypass results from this bug.

**Minor, non-blocking.**
- **Non-coded exceptions on malformed store rows.** `security.ts:46` `sameSecret` throws a raw TypeError when a consumed attempt lacks a string field, and `connection.ts:193` throws a TypeError when a persisted verification lacks `account`. Neither message carries secrets, but both escape the BrokerError contract that the rest of the domain enforces.
- **No lifetime ceiling on tokens or catalog evidence.** `validateTokens` accepted `expiresAt` equal to the maximum safe integer. Skew and authorization TTL are capped, but token and catalog lifetimes are not. An injectable maximum would harden against a future adapter bug.

**Scope assertions confirmed.** No production store, transport, HTTP route, or guessed provider schema exists. Enabled tools default empty and are confined to the fixed two-name ceiling. Live access always throws. Local disconnect reports the provider grant may remain and never claims revocation. The server-only barrier rejects import outside the react-server condition. Fixtures are labeled as internal contracts, not Robinhood schemas.
