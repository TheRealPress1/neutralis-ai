# UI004 P&L history candidate01 — independent GPT review

**PASS, accepted by Astra** at exact `0167a6de8e13e3583356f14cc5b724a17e4ec269`, direct parent accepted UI003 `e5d9f705ad3978377bb573065ee2f571ef4cf3b8`. Src tree `2b0f119e1c33075d1fa5c975bba63db95f108ab2`, full tree `fd218b2ceca67e0d7326a11ece3cc58cd12ea282`. No material reproducible findings. The combined Exchange design/history-read candidate is accepted for the founder-authorized publication after the pending Railway trigger preflight; it has not been pushed.

Stable reviewer `c8639b0a-38dd-41fe-b014-5c31e915cc6d` completed this exact-head review and collected a final fresh critic. This is the established same-family GPT quota exception, not a new Fable pass. Root freshly verified the approved creator/repository/project/workspace/session tuple and observed the matching final report in the assigned Conductor session. Receipt `.context/ui004-review-completion-provenance.json`; final transcript cursor `07744548-d046-4ae6-972b-10adb20e4ea5`.

This file summarizes the independent report; it is not the original report bytes. Original remote review checkout: `/home/vercel-sandbox/review-ui004-pnl-history-c01-gpt`, clean and detached at0167a6de. Report `.context/reviewer/REVIEW-UI004-candidate-01.md`, reported SHA256 `32bbd69826476667f130542b2753b34032f6e52806af4f3ce7b9e5399106bf44`; index `.context/reviewer/evidence-index.json`, reported SHA256 `59d0587f3dfb1eeb12cebbbebba8402c540e4c9fe06582d49b0186c117689a30`. Reproduction scripts, command receipts, font hashes, provenance and closure evidence remain there.

## Scope and result

The existing P&L history GET now rejects query errors, incomplete or malformed P&L/date rows and non-finite aggregates through a generic500 response. Real empty arrays remain200 and valid numeric zero/positive/negative totals remain supported. Authentication and original exact-user/live/date filters are preserved. It changes only getPnLTimeline and its UTC-date helper (+24/-4); all267 other tracked files and component/dashboard/lib/auth/non-src trees match UI003. Combined main diff is35 src files; fresh remote main remainedd524 during review. Evidence-only commit3f800d deliberately retains UI003 source; the reviewer verified all19 supplied artifact hashes and indexSHA cb39929f726e5b24fb9ecc92201355d656d61c114d55d9a9fd672c9a8c9cf990.

## Independent verification

- Inspected `handler-test.cjs` with deny-network preload:54 real exported GET/NextResponse cases pass, five original-baseline failures reproduced, three unchanged real-client-to-GET boundary cases pass.
- Reviewer's `date-boundaries.cjs`:34 additional actual-GET cases pass, including all14 supported UTC forms, leap-century/date normalization, whole-read failures, zero/negative values and loss overflow.
- `audit.cjs`: changed-function lint and new diagnostics bothzero; rest-of-route exact parity. Full API ESLint still exits1 with the same six inherited no-explicit-any errors and one unusedtestToken warning outside scope. Nothing is suppressed; full-file lint is not claimed green.
- Guarded `npm run build -- --webpack` passes at exacthead, buildID `8mddLrjFgzrbCUDtOD59w`, using inspected local Next font hooks and cached accepted C02 font bytes. Zero network attempts. Existing optional wallet connector resolution warnings remain. This is not a new default-Turbopack or hosting build proof.

Final fresh critic `/root/ui004_pnl_history_c01_critic`: **PASS,109/109 independent actual-GET checks**, zero network attempts. Original `.context/critic/REVIEW.md` reported SHA256 `108e42a290afb07115479b460f4a28b4f85d66ad93f6b81873bd551c33963d27`; manifestSHA `50969cc24db3dfa01d630758abaa95ba7c9da4210f51175ed14eedd461d4bcc7`. Its results.json and SHA256SUMS remain alongside. Final critic was collected, not merely requested.

No review server was started; all owned test/build processes finished. Prior UI003 previews/report/index/evidence remain unchanged. Real Supabase/auth seams were offline doubles; no account/DB/venue/SDK or trading operation occurred. Other API query readers are unchanged and are not claimed fixed. Existing UI003 rejected-HTTP→unavailable/stale proof connects through the unchanged fetch client/read hook; no redundant browser rerun was required.

## Publication routing

Root holds the exact commit at `refs/reviews/ui004-pnl-history-c01` and verified bundle/parity receipt `.context/ui003-release-transfer/ui004-c01-verified-custody.json`. The accepted implementation/review is complete. Publication still awaits existing Railway authentication so current source/autodeploy/watch-path metadata can be read. Before a nonforced main update, recheck fresh main/branch state; afterward verify both production aliases serve the exact published SHA. No new founder publication approval is requested, no arbitrage publication is authorized, and no hosting/process-health claim follows from this review.
