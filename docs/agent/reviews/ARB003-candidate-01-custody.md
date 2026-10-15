# ARB003 candidate01 source custody

Root verified on2026-09-07. This is source/evidence custody, not a behavioral review verdict.

- Candidate `232fe82e00698776caf73c9b45cdff3f5319f22f`; parent `ccfb504b8c07e62959fb7b705600d46de83f6e36`; tree `7b9d230a651061d2189da9c3258eb839a5a6a6a4`.
- Exactly two commits above accepted M1 `2d1bcf6df6286d863e6e789de2cf776b76d9fa71`; recovered `ad37071ae6bbc4a31289f9e662388c50e92ac3d3` remains an ancestor. No original patch was reapplied.
- Nine-part private bundle:78,218bytes, SHA256 `7d2c79f0570f304c9895e3a905a7432f638999962c80d95a695f2b1287e525e8`. Bundle verify/list-heads pass; only accepted M1 is required. Imported into `refs/reviews/arb003-fill-c01` and a clean detached `.context/arb003-review-c01`.
- Full M1-to-candidate diff:40files, SHA256 `02c1e16acba720bb70e004a1c6efce8866032559c99772d9c3f63211ff93f2c0`; all changed paths are named product scope, focused tests/fixtures, task docs or the isolated worktree's instruction file. Both base and parent diff checks pass. Requirements, storage/schema, configuration, scanner/guard and wrappers have no delta.
- Final commit is limited to two US SDK excerpt trailing blank lines and their manifest hashes. Product source is identical to its immediate parent; the entire M1 delta remains the review scope.
- Accepted contract is byte-identical to root's exact4200134 artifact:23,823bytes, SHA256 `8ba8625dcfb603f72bc21f6b720988a915d2b894de601c8905a02310e6d7ce2c`.
- All10 fixture/excerpt files match declared hashes and sizes. Four installed SDK source files match their full-file hashes and declared excerpt slices (only trailing blank-line normalization).
- Fresh public documentation downloads match the builder's pinned bytes: Kalshi OpenAPI336,094bytes/SHA256 `1aea311542d8587e386deb40f8384b0d8a6d996845a98ffa8119f1df0c3c234f`; US Create Order18,860bytes/SHA256 `0f7ffdcb944bc4b630177c2dfeeadc58462f55c28722bd1699d7caf4ea39d32d`. All four selected schemas plus info from each source are structurally identical to the committed excerpts.

Reproduction: `.context/arb003-c01-custody.py`, result `.context/arb002-review-transfer/arb003-c01-verified-custody.json`; public-document bytes, download receipt and schema-parity receipt in `.context/arb003-source-provenance/`. These checks used Git, filesystem reads and public documentation only; no Neutralis modules, SDK clients/signers, keys, account/venue/DB calls or services were started. Documentation fidelity does not certify deployed SDK compatibility or economic performance.

Behavioral review is assigned separately to `/root/arb003_candidate_review` after the prior internal reviewer could not resume. Its predecessor's saved adversarial plan is preserved. Same-family GPT under the reported Claude quota exception; no new Fable review or publication authority.
