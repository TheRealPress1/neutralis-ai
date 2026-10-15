# RH004 — Offline authorization completion (proposal for root challenge)

Date: 2026-09-07 UTC. Author: Fable co-head (technical decomposition). Proposal only: not a dispatch, not approval to write product code. Inputs: RH003 candidate01 (`fe94aeef…`, in `.context/rh003-c01-custody`) and my review, RH002 c02, frozen RH001 source (`3dd6343…`, subtree `79e412aa…`).

## Why this slice
RH002 and RH003 both name the same concrete gap: RH001 has PKCE state/proof and a token vault but "no OAuth route, code exchange or initial-token installer exists" and no transport. The finite owner proof (RH003 §"Smallest later owner-authorized proof", steps 2–3) cannot run without exactly these pieces. Every field they touch is defined by standards already retained in RH003's receipt (RFC 6749 §4.1.3/§5.1/§5.2, PKCE, RFC 8707 resource, RFC 9207 `iss`), so nothing provider-specific has to be invented. Account and catalog schemas remain unobserved, so the catalog/account bootstrap gap is explicitly **not** in this slice.

## Base, owner, isolation
- Base: the accepted RH003 corrected child above `fe94aeef3e9a8f56f405d97f7dd6f0f002995633` once my same-reviewer check passes; exact hash bound at dispatch. Product source at that base is still RH001 `3dd6343`.
- Owner: existing sole RH specialist `6b3800cf-a445-4f3c-a668-ea03f6d59c41`, workspace `cbda5480-4b47-4ffb-81af-186d42414dfc`, new isolated worktree/branch; all prior worktrees and evidence preserved.
- No packages, no host framework route, no database, no server start, no HTTP, no account/registration/token/MCP request, no shared-record edits, no messages.

## Allowed files (additive, all under `src/lib/brokers/robinhood/`)
| File | Content |
|---|---|
| `transport.ts` | Interface only: `TokenEndpointTransport { post(input: { url: string; form: Record<string,string> }): Promise<{ status: number; body: string }> }`. A `liveGuard()` that calls `requireLiveAccess()` whenever `LIVE_ENABLED` is false; no fetch implementation. |
| `callback.ts` | `validateAuthorizationResponse(config, binding, params: { code?: string; state?: string; iss?: string; error?: string })` → consumes the one-time transaction via existing `AuthorizationTransactions.consume`; rejects `error` responses before exchange; `iss` policy: if present must equal `ENDPOINTS.issuer` exactly; if absent, behaviour is an explicit configuration value `issAbsent: "reject" | "allow_unadvertised"` with `"reject"` default. Returns the existing `AuthorizationProof`. |
| `token-exchange.ts` | `buildTokenRequest(proof, config)` → `{ url: ENDPOINTS.token, form }` with `grant_type=authorization_code`, `code`, `redirect_uri` (= configured callback), `client_id`, `code_verifier`, `resource` (= `ENDPOINTS.issuer`, equal to the advertised resource per RH003 P05); no `client_secret`, no Authorization header (advertised auth method `none`). `parseTokenResponse(status, body, time)` → existing `TokenMaterial` via `validateTokens`: requires 200, JSON object, `access_token` string, `token_type` equal to `Bearer` case-insensitively, `expires_in` positive integer, optional `refresh_token` string, optional `scope`; unknown extra members tolerated per RFC 6749 §5.1; any other status or shape → `invalid_response` with redacted evidence. |
| `install.ts` | `installInitialCredential(store, vault, keyId, principal, connectionId, tokens, time)`: read owned row; require `credential === null`; encrypt with existing `TokenVault` and `EnvelopeIdentity { purpose: "tokens", revision: row.revision + 1 }`; `compareAndSwap` at expected revision; status stays an unverified state (no verification record written); returns the existing redacted `ConnectionView` with `canConnect:false`, `liveEnabled:false`. Second install or CAS conflict → conflict, old row untouched. |
| `__tests__/authorization-completion.test.ts`, `__tests__/completion-fixtures.ts` | New tests and fixtures only; existing `foundation.test.ts`, `fixtures.ts`, `deny-network.ts` unchanged. |
Modification exception: if a genuinely new issue code is required, exactly one additive enumeration entry in `errors.ts`, listed in the receipt; otherwise reuse `authorization_mismatch`, `invalid_response`, `invalid_configuration`, `live_disabled`. No other existing file changes. Two-tool ceiling, `ReadPolicy`, `LIVE_ENABLED=false` and `requireLiveAccess` untouched.

## Interfaces deliberately not touched
`ReadPort.catalog`, `readAccount`, `ReadPolicy` ceiling, `view-model.ts` fields, `endpoints.ts` pins, `storage.ts` contracts. No production store implementation; `MemoryConnections`/`MemoryAuthorization` remain test-only.

## Tests (node:test, existing offline tsconfig; zero fetch calls asserted by the existing deny-network guard)
Positive: callback with matching state/binding and `iss` equal to the pinned issuer yields a proof; callback without `iss` under `allow_unadvertised` yields a proof; token request contains exactly the six form members and no secret; mock 200 response with standard members parses to `TokenMaterial` with computed expiry; extra members tolerated; install writes revision +1 with an envelope that decrypts only under the exact identity; installed view remains `canConnect:false`, `liveEnabled:false`, no verification.
Denial: state mismatch; browser-binding mismatch; callback URI mismatch; `iss` present and different; `iss` absent under `reject`; `error=access_denied` (no exchange attempted, transport never called); replayed callback (second consume fails); expired transaction; token endpoint URL differing from the pin; non-200; non-JSON; missing `access_token`; `token_type` not Bearer; `expires_in` zero, negative, non-integer; oversized token (existing opaque limit); install when a credential already exists; CAS revision mismatch; any attempt to construct a live transport with `LIVE_ENABLED=false` → `live_disabled`; suite-wide fetch count zero.
Metamorphic: identical inputs → identical request form and identical envelope identity bytes; a changed `redirect_uri` in config changes the request and fails the callback-URI check.

## Acceptance table
| Item | Required evidence |
|---|---|
| Exact head/parent/tree; bundle above the bound base | Custody as in prior lanes |
| File list | Only the additive files above (plus at most one `errors.ts` line, if listed) |
| Test run | `tsc -p src/lib/brokers/robinhood/tsconfig.offline.json` then `node --test` over the compiled output, as RH001; all tests pass; fetch calls = 0; exact command, interpreter and counts reported |
| Denial coverage | Every denial case above present and passing; each failure names an existing or the one new issue code |
| No enablement | `LIVE_ENABLED` false; `requireLiveAccess` unchanged; `CEILING` unchanged; `canConnect:false` in every returned view |
| Redaction | No token, code, verifier or state in thrown errors or logs (test with sentinel strings) |
| Boundary statement | Receipt states mock-verified only: no provider acceptance, no registration, no callback deployment, no durable store, no owner consent, no cloud operation |

## Explicitly deferred (separate tickets)
Host framework callback route and session handling; real HTTPS transport implementation and its live gate review; durable store adapter and database proof; catalog acquisition and owner account selection (schemas unobserved); provider registration, callback acceptance and owner consent (the RH003 proof); cloud worker operation; any research projection.

## What this slice does and does not establish
Does: tested, reusable code for the three missing authorization-completion steps against standards-defined shapes, removing the RH002/RH003 "no code exchange or installer" gap while keeping every live path disabled. Does not: prove Robinhood accepts a Neutralis client, deploy a callback, persist anything durably, obtain consent, or operate in the cloud.
