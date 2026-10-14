# RH004 v2 — Offline authorization completion (revised scope for root challenge)

Date: 2026-09-07 UTC. Author: Fable co-head. Supersedes v1 (sha256 9725213b…8ae6c, preserved). Inputs: accepted RH003 c02 `3a20e655798a88aec04d9271b3ee66c56ccca2e2` (contract Decision table), frozen RH001 source at that head (`src/lib/brokers/robinhood`, subtree `79e412aa…`), Astra's factual source inventory (sha256 5b3ee654…2df2e). Proposal only; not a dispatch or approval to write product code.

## Base, owner, bounds
- Base: exact `3a20e655798a88aec04d9271b3ee66c56ccca2e2`. Product source is RH001 `3dd6343…`, unchanged.
- Owner: existing sole RH specialist `6b3800cf-a445-4f3c-a668-ea03f6d59c41`, workspace `cbda5480…`, new isolated worktree/branch; prior worktrees and evidence preserved.
- No packages, host route, database, server, HTTP, account/registration/token/MCP request, catalog/account bootstrap, research/order tools, shared-record edits or messages. Two-tool ceiling, `LIVE_ENABLED=false`, `requireLiveAccess`, `endpoints.ts`, `policy.ts`, `storage.ts`, `view-model.ts`, `errors.ts` untouched. Synthetic responses are standards-shaped (RFC 6749 §5.1/§5.2), not verified Robinhood schema.

## Closure of the three v1 gaps
1. **One coherent operation, not helpers.** v1 split callback → proof → `buildTokenRequest(proof)` although `AuthorizationProof` carries no code. v2 defines a single server-only `AuthorizationCompletion.complete(...)` that owns the code from validated callback through consume, one exchange, parse and install. The code, verifier and tokens never leave the operation; no exported installer accepts arbitrary tokens.
2. **Stale-completion fence.** The operation binds `proof.expectedRevision` and CASes exactly that revision; it rechecks actor, lifecycle and revision before the exchange and after every `await`; a newer `begin`/`disconnectLocally` or expired owner session denies without installing. Exactly one exchange attempt; an unknown or lost response or persistence acknowledgement is terminal for that code with no retry and no claimed success. Fresh owner `begin` remains the only recovery. No durable operation ledger.
3. **Token identity.** The envelope binds `revision = row.tokenVersion + 1` (matching `ConnectionDomain.identity`, connection.ts:85–88), while the connection row revision increments by one for CAS. Installed state is the existing `awaiting_authorization` with `credential` set and `verification: null`, which `ConnectionDomain.view` already renders as phase `account_verification` (connection.ts:126–127) and `readAccount` consumes unchanged.

## Files (additive, under `src/lib/brokers/robinhood/`)
| File | Content |
|---|---|
| `completion.ts` (imports `server-only`; no fetch/http imports) | `TokenExchangePort { exchange(input: { url: string; form: Readonly<Record<string,string>> }): Promise<ExchangeResult> }` with `ExchangeResult = { kind: "response"; status: number; body: string } \| { kind: "failed"; reason: "transport_failed" } \| { kind: "unknown" }`. `class AuthorizationCompletion` constructed with `{ store: ConnectionStore; transactions: AuthorizationTransactions; exchange: TokenExchangePort; vault: TokenVault; keyId: string; time: TimePolicy; config: Readonly<ClientConfiguration>; issuerPolicy: { absent: "reject" \| "allow_unadvertised" } }`; `issuerPolicy` and `config` are frozen at construction and hashed. Public: `complete(input: Principal \| null, connectionId: string, callback: { params: Readonly<Record<string, string \| string[]>>; browserBinding: string }): Promise<ConnectionView>`. Exported `createLiveExchangePort(): never { return requireLiveAccess(); }` is the **only** exported constructor for a real transport; the mock port exists only in tests; no environment or flag selects a transport. |
| `__tests__/completion-fixtures.ts`, `__tests__/authorization-completion.test.ts` | New only. Existing `foundation.test.ts`, `fixtures.ts`, `deny-network.ts` unchanged. |
No other file changes. Existing codes suffice: `authorization_mismatch`, `authorization_expired`, `authorization_used`, `stale_version`, `persistence_failed`, `transport_failed`, `invalid_response`, `token_expired`, `decrypt_failed`, `live_disabled`, `not_authenticated`.

## Operation contract (`complete`)
1. `actor(input, time)`; parse `params`: any array-valued (duplicate) `code`, `state`, `iss` or `error` → `authorization_mismatch`; any `error` present (with or without `code`) → `authorization_mismatch`, no consume, no exchange; `code` and `state` required single strings within `opaque` bounds.
2. Issuer: `iss` present must equal `ENDPOINTS.issuer` byte-exactly or `authorization_mismatch`. `iss` absent: `issuerPolicy.absent === "reject"` → `authorization_mismatch`; `"allow_unadvertised"` → proceed and record `issuerObserved: false` internally; no issuer value is fabricated. The policy is a trusted construction parameter, never a browser or request parameter. The consume binding passes `issuer: ENDPOINTS.issuer` and `callbackUri: config.callbackUri` from trusted configuration.
3. `transactions.consume(input, connectionId, { state, browserBinding, callbackUri, issuer })` → `proof` (one-time; replay fails inside consume with `authorization_used`/`authorization_mismatch`). Deny with `authorization_mismatch` if `proof.clientId !== config.clientId` or `proof.callbackUri !== config.callbackUri` (config altered after consumption → no request for the altered configuration).
4. Pre-exchange fence: `actor(input, time)` again; `row = store.readOwned(userId, connectionId)`; require `row.revision === proof.expectedRevision`, `row.status === "awaiting_authorization"`, `row.credential === null`; else `stale_version` (revision) or `authorization_mismatch`; no exchange.
5. Request: `url = ENDPOINTS.token`; form exactly `{ grant_type: "authorization_code", code, redirect_uri: config.callbackUri, client_id: config.clientId, code_verifier: proof.verifier, resource: ENDPOINTS.resource }`; no `client_secret`, no Authorization header (advertised auth method `none`). `requestedAt = now(time)` captured immediately before the single `exchange.exchange(...)` call.
6. Result: `failed` → `transport_failed`; `unknown` → `transport_failed` and terminal (code discarded, no retry, no install, no status change); `response` with status ≠ 200 → `invalid_response` (or mapped `PortFailure` when the RFC 6749 §5.2 `error` member is one of the existing port failures; otherwise `invalid_response`).
7. Parse: body ≤ 65,536 bytes, JSON object; `access_token` non-empty string ≤ 8,192; `token_type` equals `Bearer` case-insensitively; `expires_in` integer with `1 ≤ expires_in ≤ 31,536,000`; optional `refresh_token` string ≤ 8,192; optional `scope` string; unknown members tolerated. `issuedAt = requestedAt`, `expiresAt = requestedAt + expires_in × 1000` (request-time arithmetic). If `now(time) ≥ expiresAt` after processing delay → `token_expired`, no install. Result validated through existing `validateTokens`.
8. Post-exchange fence: `actor(input, time)`; re-read row; require `row.revision === proof.expectedRevision` and unchanged lifecycle as in step 4; else `stale_version`, tokens discarded.
9. Install: `version = row.tokenVersion + 1`; `envelope = vault.seal(JSON.stringify(tokens), { userId, provider: "robinhood", connectionId, keyId, purpose: "tokens", revision: version })`; `next = { ...row, revision: row.revision + 1, tokenVersion: version, credential: { envelope, keyId, expiresAt }, status: "awaiting_authorization", issue: null, verification: null }`; `store.compareAndSwap(userId, connectionId, proof.expectedRevision, next)`. `false` → `stale_version`; throw → `persistence_failed` with unknown persistence outcome, no retry, no success claim. Return `ConnectionDomain.metadata`-equivalent view via the existing domain (phase `account_verification`, `liveEnabled:false`, `canConnect:false`).
10. Redaction: only `IssueCode`s are thrown; no code, state, verifier, token or body fragment appears in errors, receipts or logs. Internal receipt (returned only to tests via an injected optional `observer`) records `issuerObserved`, `requestedAt`, `exchangeAttempts` (always 0 or 1), `outcome`.

## Tests (composed operation; node:test; existing fetch guard)
| Case | Expected |
|---|---|
| Success with `refresh_token` | Row revision +1, tokenVersion +1, envelope decrypts only under the exact identity, view `awaiting_authorization`/`account_verification`, exactly one exchange |
| Success without `refresh_token` | Same; `refreshToken: null`; later `refresh()` → `refresh_unavailable` |
| Unequal seed `revision` vs `tokenVersion` (e.g., 7 and 3) | Envelope bound to tokenVersion 4, CAS at revision 7 → 8; existing domain `open` decrypts; `metadata` view consistent |
| Superseding `begin` while mock exchange awaits | Post-fence `stale_version`; nothing installed; exchange count 1 |
| `disconnectLocally` while exchange awaits | `stale_version`; row stays disconnected |
| Expired principal (before consume; before exchange; after exchange) | `not_authenticated` at that fence; no exchange after the first two; no install after the third |
| Config altered after consume (different `clientId`/`callbackUri` instance) | `authorization_mismatch`; no request built |
| Replayed callback (same state/code) | Second call fails inside consume; exchange count 1 overall |
| Duplicate `code`/`state` params; `error` with `code`; missing `code` | `authorization_mismatch`; no consume/exchange |
| `iss` mismatch; `iss` absent under `reject`; `iss` absent under `allow_unadvertised` | mismatch / mismatch / success with `issuerObserved:false` |
| Malformed responses: non-JSON, missing `access_token`, `token_type` ≠ Bearer, `expires_in` 0/negative/float/string, oversized body, oversized token | `invalid_response`; no install |
| §5.2 error body `invalid_grant` | mapped `invalid_grant`; no install |
| Exchange `failed`; exchange `unknown` | `transport_failed`; exchange count 1; no retry; row unchanged |
| Delayed processing past expiry | `token_expired`; no install |
| CAS returns `false`; CAS throws (simulated commit with lost acknowledgement) | `stale_version` / `persistence_failed`; no success claim; no second exchange; row verified unchanged or unknown, never assumed installed |
| `createLiveExchangePort()` | throws `live_disabled` unconditionally |
| Sentinel redaction | No sentinel code/verifier/token substring in any thrown error or receipt |
| Suite | `after` hook: fetch calls = 0; existing 47 tests unchanged and passing |

## Commands (specialist's original offline toolchain; root VM lacks these dependencies)
```
./node_modules/.bin/tsc -p src/lib/brokers/robinhood/tsconfig.offline.json
sudo unshare -n -- node --conditions=react-server --test .context/rh001-offline-build/__tests__/foundation.test.js
sudo unshare -n -- node --conditions=react-server --test .context/rh001-offline-build/__tests__/authorization-completion.test.js
./node_modules/.bin/eslint src/lib/brokers/robinhood --max-warnings=0
git diff --check
```
Report exact head, commands, Node version, pass counts for both files, and that no package was installed. If `unshare` is unavailable, run without it and state so; the fetch guard still applies.

## Acceptance
Exact head/parent/tree and bundle above `3a20e655…`; only the three additive files; both test files pass with zero fetch calls; every table case present; `LIVE_ENABLED`, `CEILING`, `requireLiveAccess` untouched; sentinel redaction proven; receipt states mock-verified only — no provider acceptance, registration, callback deployment, durable store, owner consent or cloud operation.

## Deferred (separate tickets)
Host framework callback route and session resolution; real HTTPS transport and its live-gate review; durable store adapter and database proof; catalog acquisition and account selection (schemas unobserved); registration, callback acceptance and owner consent (RH003 proof); cloud worker; research projection.
