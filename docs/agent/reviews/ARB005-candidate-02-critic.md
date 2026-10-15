# ARB005 Stage A candidate02 — stable independent entry critic

**Scoped PASS: C01 account-association finding is resolved; no material remaining finding in this bounded slice.** This is stable same-family GPT review continuity. Fable has returned; this report is neither a new Fable review nor an assertion of an ongoing quota outage. The main reviewer owns the metadata-method correction, full affected suite and overall acceptance routing.

## Exact custody and scope

Reviewed/tested clean detached `/home/vercel-sandbox/neutralis-ai/.context/arb005-review-c02` at HEAD `69f0f2b3fc3325e0b6c44229d4b09bc666260134`, source parent `0783369aa8fe07eb67dc4e8a31b2385028848945`, full tree `9f57bd080c72d7fe4a4f1ef5c7227d1b8bde0231`, above preserved C01 `449d5ea6aa02d4aa183a2c7d174d9ac4197b042f`. Review began only after the parent delivered the verified checkout and root custody receipt. The root receipt records the 42,687-byte bundle SHA256 `ca83db21f3a9a6ed841355f745f5a7ded477f19af6efdb95c36949d7ba9c05fc` and sole C01 prerequisite; bundle transport verification remains attributed to root. Independently checked the exact checkout identity, empty product status and complete accepted contract SHA256 `9e9f3625c4fb71a9b7cf3958820fc6aa908272dd558a4e446726cda6ff0090f0`.

Read all 160 lines of `docs/arbitrage/ARB005-candidate02.md`, the mode/provider and polling revisions, preserved and adapted account probes, changed fixtures and new external credential double. Compared the strict runner, root fixture and cursor double against C01: those guards/cursor algorithms are unchanged. Inspected the provider changes before any product imports/tests. This slice covers actual credential/account association, supported Kalshi/US adapters, both event/polling dispatchers, original entry bindings/late responses and the final start scope fence. It does not duplicate the main review's metadata failure-latch or database algorithm coverage.

## C01 F1 closure: product enforces the supplied provider association

`neutralis/execution/mode.py:119–177` introduces an explicit provider and returned immutable association/private single-use construction resolution. Lines 204–244 require the original provider/factories/descriptor, call its resolver, compare the returned association/owner/run/provider/factories before registering the resolution and reject a mismatch before construction. The product no longer converts loose config/per-user kwargs into its own account-labelled construction closure. Existing adapter construction consumes the returned resolution; original adapter handle checks remain at mutation. `scripts/run_once.py:554–565` retains the named dependency denial in its original outcome sink and returns before admission. Event integration continues to retain its existing named denial.

The supplied provider's authentic external provenance is still an explicit dependency. This bounded wrapper does not infer actual ownership from a label or verify production credentials against an account API. The relevant assertion tested here is that the provider's **actual selected synthetic record** and the private arguments sent to the fixed factory stay associated, and that the product compares that returned record against the original recording scope.

Independent matrix `.context/entry-review/test_independent_provider_routes.py`: **16 passed in 1.97s, exit 0**. These are both runtimes × Kalshi/Polymarket US × configuration/per-user selection × valid A/A or adverse A/B. The independent external resolver does not import the builder's credential-double helper, does not compare its selected record with account A, does not read storage, and does not raise a denial. It returns the actual selected A or B association and a private construction closure carrying those same selected arguments. One pinned synthetic factory maps the private key to the actual SDK account for US, or to the synthetic signer header used by the HTTP transport to select the actual Kalshi account. Thus constructor labels alone are not the observation.

- Eight A/A controls call the targeted factory once, execute that account's actual adapter order method against the external double, complete the selected two-leg route, and persist both trades. The targeted original request binding and durable trade retain account A; outcomes are resolved.
- Eight A/B cases return B's independently selected association with B's private arguments while the recording descriptor remains A. The product raises `CREDENTIAL_ASSOCIATION_MISMATCH`; the targeted construction factory is never called, no venue order is submitted, no durable order is admitted and no trade is written. Outcomes are unresolved. There is no fixture-side A/B denial.
- The per-user cases call the original private lookup exactly once for the run user; their deliberately unusable configuration key is not selected. Configuration cases never call the per-user lookup. The pinned factory object remains the same through each preparation/construction path.

## Preserved probes and seam adaptation

All original C01 artifacts were hash-verified before review and reverified unchanged afterward. The C01 report remains SHA256 `37f6050aa75ef7d48b4806f919be6fdda29e8ea5c599285fd540cb69b4ea68d0`; manifest remains `0a414e822b1699611510d3eaee1c9d70e33f78725d2953387b94ade09e6d0c12`. New C02 copies of the three scripts preserve their exact bytes:

- Original account probe, 3,368 bytes, SHA256 `3998441304fc16ad73eea46e050db1a7d0a81d86db989c509c785d92ee91b189`.
- Original 16 entry probes, 7,333 bytes, SHA256 `b82aa1e194dab43f5d39cca399ac50408f94dbae9ac72d144e8b383d4e17a056`.
- Original six final-start controls, 3,413 bytes, SHA256 `3445e8d92ec7d679bf330752b0a531e6155acd953cbb329f9b86e4f7e6533067`.

The original account probe ran **unchanged** and produced **2 failed / 2 passed in 0.48s, exit 1**. Both old A/A positive assertions fail because that probe creates an owner with no now-required associated provider; all four cases are denied without account construction/orders. Both adverse A/B assertions pass. This is preserved separately in `original-account-denial.log`, not advertised as a green original probe or evidence that blanket denial fixes the product.

Separately extracted the builder's `arb005-c02-account_binding-provider.py.txt` byte-for-byte as `test_account_binding_provider.py` (4,365 bytes, SHA256 `239f3d679f2fdfc7459d238c9dd2e00c0f9e6212899a88813bd730d6625e3226`). Reviewed its entire diff: only the externally supplied provider/record selection seam is added; it returns the actual A/B association and retains the adverse B key, same fixed SDK factory, original positive/negative assertions and recording scope A. Its explicit `select` branch in the helper performs no A/B mismatch denial; product code performs the comparison. This is a supported-dependency adaptation, not deletion of the adverse input. `account-provider-adaptation.diff` retains the exact change.

The adapted four account cases plus **unchanged original 16 entry cases and six start-fence cases** pass together: **26 passed in 3.58s, exit 0**. Original quantity-defect expectations, partial/invalid/error/revoked later-leg receipt retention, real pending US future and late applied original-binding checks remain. The final-start controls retain actual first adapter submission/full durable fill, pre-admitted B with registration before/after A's later replay, commit-before/commit-after unknown A blockers, preserved first acquisition and legitimate acknowledged-replay positives.

Therefore this critic executed **42 passing supported-input cases**, plus the separately labelled four-case legacy dependency audit with its **two expected obsolete-positive assertion failures and two negative passes**. No unexplained in-scope test failure remains. The builder's 602 suite claim and the main review's independent results are not relabelled as this critic's execution.

## Reproduction and limits

Run from the exact candidate using the supplied installed Python 3.13.15 and strict prefix:

```sh
unshare --user --map-root-user --net env -i PATH=/usr/bin:/bin /home/vercel-sandbox/neutralis-ai/.context/arb002-review-venv/bin/python -B tests/arbitrage/offline_runner.py --installed-dependencies --disable-plugin-autoload -q -p no:cacheprovider .context/entry-review/test_independent_provider_routes.py --tb=short -s
```

For the 26-case run, replace the selected script with `.context/entry-review/test_original_entry_paths.py .context/entry-review/test_start_fence_controls.py .context/entry-review/test_account_binding_provider.py`. For the separately expected legacy failures use `.context/entry-review/test_account_binding.py`. Exact stdout/stderr and counts are frozen in the candidate private directory.

The namespace and pre-import guards deny TCP/DNS, key files and real DB access; external credentials, signers, SDK clients, transports and transaction/cursor effects are synthetic. Actual product preparation, start permission, adapters, outcome reduction and durable algorithm run; no fixture grants a ready-made submit permit or implements a replacement closure state machine. No real SDK/account/key/database/SQL operation, package installation, services/daemon/polling loop, Conductor control, source/shared-document edit, prior-evidence overwrite or publication occurred. The bounded polling dispatcher function was called directly. These tests do not prove production credential provenance, external SDK internals, PostgreSQL SQL/locks/constraints/atomicity, concurrent execution or restart durability. Stage B and publication holds remain outside this review.

Final product status is clean. New artifacts and this report are frozen under the permitted C02 paths and indexed by root `.context/arb005-c02-entry-critic-manifest.json`.
