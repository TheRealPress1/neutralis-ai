# RH004 candidate01 — independent SAME-FAMILY GPT review

**Verdict: REVISE for the bounded offline milestone. One reproducible P2 correctness/contract finding.**

Reviewer: original session `a7c736c6-2103-45ba-a4e3-bf845dc05076`, GPT-6 Astra. This is an independent same-family GPT review under the continuing Claude quota exception. Fable remains the original peer co-head and contract author; this is not a Fable or new cross-family implementation pass. Prior Fable RH001 and RH003 evidence is preserved at its original scope/head.

## Exact candidate and custody

- Head: `da47a4bce132c48a958f399aaa6ab8c945d9c530`.
- Direct parent and sole bundle prerequisite: `3a20e655798a88aec04d9271b3ee66c56ccca2e2`.
- Tree: `58db47b2d3aa877e2fc0dfc3184cd0627d42ee0c`.
- Prior broker subtree: `79e412aa3a8e6196986b9e7f79de569a23287980`; candidate subtree: `08525f477933ff8864e1f26e6bd4906034445785`.
- Review worktree: `/home/vercel-sandbox/review-rh004-c01-gpt`, newly created detached at the exact head.
- Builder: `/home/vercel-sandbox/rh004-offline-completion`, branch `feat/rh004-offline-authorization-completion`; unchanged, clean and idle at final verification.

Fresh read-only Conductor queries confirmed workspace `cbda5480-4b47-4ffb-81af-186d42414dfc`, creator `a3d90092-333e-4447-8d36-9d44255a20c0`, repository `https://github.com/therealpress1/neutralis-ai`, original builder `6b3800cf-a445-4f3c-a668-ea03f6d59c41`, and my membership, with no remaining membership page. Current workspace metadata omits projectId. The existing RH003/RH004 receipt retains root's desktop association `ee20ce95-6eab-4adb-8654-f87590cd6bf0`; I did not reconstruct a cloud project or independently query the Mac. No cross-session message was sent.

I read CLAUDE.md, AGENTS.md, the lane accepted task, RH004-HANDOFF.md, the exact RH004 contract, the three additions, and the actual authorization, vault, domain, security, error, storage and policy contracts. The RH004 accepted-ticket bytes hash to `d335f078dba67c9e56c7dbfd4c59aa85c6f76019a62f9521c2edd558c99b813e`.

Independent custody verification checked all 56 indexed member hashes against disk and archive bytes, the separate custody member, all nine part hashes and reassembly, full diff equality against Git, all three exported source files against committed/review bytes, and the sole-prerequisite Git bundle. Archive: 74,728 bytes, SHA256 `39026d8f0fc82eaba132abfeee08a51597be2c06367d2d8d118001de58126057`; bundle: 12,318 bytes, SHA256 `1790c5bc8ad589e77ae25020f6dbdcce06647103703f6a7bad2770e72a79bf2c`; full diff: 42,668 bytes, SHA256 `07ddf1ca4ed5d8ab3268e2ca72039596dfabf839e3cff907d8ce1bec71f173a1`. All 273 inherited files are byte-identical. Only completion.ts, __tests__/completion-fixtures.ts and __tests__/authorization-completion.test.ts are added. All 31 source/compiled hashes in the builder's tested-artifact receipt match my candidate/recompiled output. I inspected transferred helper scripts and did not execute them.

## Material finding RH004-R1 (P2): admitted token limits exceed the unchanged vault's plaintext capacity

**Source anchors:** `src/lib/brokers/robinhood/completion.ts:63` admits each access/refresh token up to 8,192 UTF-8 bytes; `completion.ts:206` seals their JSON-serialized normalized representation. The inherited `token-vault.ts:47` rejects plaintext above 32,768 bytes. Existing `validateTokens` also admits the reproducer.

**Reproducer:** Run real begin/consume/completion with a successful synthetic response containing `access_token = "\\".repeat(8192)`, `refresh_token = "\\".repeat(8192)`, `token_type = "Bearer"` and `expires_in = 3600`. Each token is exactly 8,192 bytes, nonempty and permitted by existing opaque validation; the response JSON is 32,846 bytes, below the 65,536-byte body ceiling. The normalized JSON at the fixture's valid request time is 32,843 bytes. JSON escaping therefore puts it 75 bytes over the vault limit, and completion rejects with `encryption_unavailable` after consuming state and performing its single exchange. Two 8,192-byte quote tokens reproduce the same defect.

**Expected under the accepted individual token/body admission limits:** completion can install the admitted token material and return account_verification. **Actual:** no credential is installed for this admitted response, despite an available valid key. The permitted input range and composed storage capacity disagree. This is a deterministic offline contract defect, not a claim about actual Robinhood token contents or a security bypass.

The independent normative regression fails on this exact head. A bounded localization follow-up proves the cause with the actual vault and confirms terminal safety: one consumed state, one exchange, zero CAS, unchanged connection row, no compensating write/retry, replay rejected, redacted code-only error, and a separately invoked new begin remains possible under the existing pending-consent precondition.

Positive controls: two 8,150-byte backslash tokens complete (32,675-byte normalized JSON); two 8,192-byte alphanumeric tokens complete (16,459 bytes); an 8,192-byte backslash access token without refresh completes (16,461 bytes). The actual domain reads/decrypts ordinary successful completion with unequal row/token counters in the separate independent control.

**Closure needed:** reconcile the accepted admission range/normalized plaintext budget with the immutable vault ceiling and add a composed boundary regression. An explicit total serialized-material admission rule is one contract decision for the owner; simply documenting 8,192-byte token limits leaves the mismatch. This review makes no source correction and does not authorize changing the inherited vault or widening the three-file scope.

## Independently reproduced checks

The supplied suite was run once on the exact candidate after one scoped compilation. No installation. Existing Node `v24.14.1`, TypeScript `5.9.3`, ESLint `9.39.2`, server-only `0.0.1`, @types/node `20.19.33`; the four package metadata hashes match the indexed toolchain receipt. Dependencies are a symlink in this new review worktree to the original node_modules, without mutation.

Every compile, test, lint and diff subprocess ran through my retained `run-isolated.py`. It invokes sudo/unshare with a fresh network namespace, verifies a different namespace identity and no IPv4 routes, and requires bounded public-range TCP, loopback TCP and DNS UDP sends to fail with ENETUNREACH before launching the tool. The valid DNS question bytes for rh004.invalid are retained as hex `00010100000100000000000005726830303407696e76616c69640000010001`; destinations are 192.0.2.1:443, 127.0.0.1:9 and 192.0.2.53:53. No packet succeeds. Tool environment is freshly scrubbed to only `PATH=/usr/local/bin:/usr/bin:/bin`. Node's test child adds its own NODE_TEST_CONTEXT. A review preload installs a throwing fetch guard before Node tools or product imports; both supplied suites also retain their original zero-fetch after-hooks. All guards report zero calls. No network-enabled fallback occurred.

From the detached review root, command prefix:

```sh
python3 .context/review/run-isolated.py LABEL /usr/local/bin/node \
  --require /home/vercel-sandbox/review-rh004-c01-gpt/.context/review/fetch-guard.cjs
```

Append the following arguments for each LABEL (the complete executable argv, UTC, environment, namespace proof, stdout/stderr and exits are retained in the correspondingly named files):

| Label | Appended arguments | Result |
| --- | --- | --- |
| compile | `node_modules/typescript/bin/tsc -p src/lib/brokers/robinhood/tsconfig.offline.json` | PASS |
| supplied | `--conditions=react-server --test .context/rh001-offline-build/__tests__/foundation.test.js .context/rh001-offline-build/__tests__/authorization-completion.test.js` | 157 pass: 110 completion + 47 foundation; 0 fail, 0 skipped |
| lint | `node_modules/eslint/bin/eslint.js src/lib/brokers/robinhood --max-warnings=0` | PASS, zero warnings |
| independent | `--conditions=react-server --test .context/review/independent-controls.cjs` | 10 pass, 1 fail (RH004-R1); 0 skipped |
| capacity-followup | `--conditions=react-server --test .context/review/token-capacity-followup.cjs` | 1 diagnostic test passes, covering five positive/failure variants; confirms RH004-R1 |

Committed-delta whitespace command, inside the same proven-isolation runner:

```sh
python3 .context/review/run-isolated.py whitespace-fixed /usr/bin/git \
  -c safe.directory=/home/vercel-sandbox/review-rh004-c01-gpt \
  diff --check 3a20e655798a88aec04d9271b3ee66c56ccca2e2 da47a4bce132c48a958f399aaa6ab8c945d9c530
```

PASS. The initial whitespace invocation under scrubbed root lacked Git ownership recognition and failed with `Could not access` the base argument. That evidence remains as whitespace.*. Adding only the command-local safe.directory for this exact review worktree resolved it; no Git config was written. No compile/test/lint failure was hidden or rerouted.

## Composed contract assessment

The supplied cases cover the complete ticket table, including owner/provider/proof mismatches, malformed counters, callback duplicates/errors/issuer policy, bounded token/error parsing, request-time expiry, safe-integer overflow, original-session expiry at seven stages, newer begin/disconnect, failed/unknown/thrown exchange, CAS false/throw/lost acknowledgement, and post-CAS replacement/read failure. They pass independently.

My additional finite controls use actual AuthorizationTransactions, TokenVault and ConnectionDomain, a reviewer-written CAS store, and the inherited test-only atomic authorization store; they do not replace completion with a mock. Successful completion is followed by the real public domain's synthetic allowed account read, proving envelope compatibility with unequal row/token counters and exact request/PKCE binding. Other controls suspend real authorization consumption while caller/config/callback values change, mutate returned proof/result objects before later awaits, race replay/new-begin/disconnect, expire the original session during the final pre-CAS read, and exercise lost acknowledgement and post-CAS failures without recovery writes. They also verify separately invoked metadata/disconnect/new-begin preconditions: a credential left after lost acknowledgement blocks begin; disconnect leaves not_connected, from which begin is still blocked by existing code. Pending rows without a commit permit a separate begin. Completion performs no automatic reset.

No additional material defects found. Inspected errors/views retain code-only redaction and no secret cause; request has exactly six form fields, fixed token URL and no Authorization header/client secret. Runtime imports server-only, browser import rejection passes, real-transport factory unconditionally calls the live gate, enabled tools default empty, fixed two-tool ceiling is unchanged, and no application imports this broker subtree. No provider schema or revoked-state inference is introduced.

## Preservation, limits and disposition

All six prior worktrees, their HEAD/branch identities, tracked bytes and captured private evidence are unchanged. Both candidate builder and new review checkout are clean. Source remained frozen; only this review worktree's gitignored context/symlink and Git's new detached-worktree administrative records were created. No source corrections, commits, packages, provider/account requests, routes, database/SQL, services, agents, messages, pushes, publication or deployment occurred. No full app build or unrelated tests were run. No background watcher remains.

This is an offline review. Mocks do not establish database atomicity/durability, provider schemas, registration/client acceptance, owner consent, callback deployment or live broker readiness. The Customer Agreement evidence supplied in the ticket was not fetched and no legal exemption is asserted. UI003/UI004/Railway, arbitrage and EQ001 firewall holds remain intact. Return the one finding to the sole writer/coordinator through this transcript; retain this reviewer for any authorized revision. The exact candidate does not receive an offline PASS until the admission/capacity gap is resolved or its contract is explicitly reconciled.
