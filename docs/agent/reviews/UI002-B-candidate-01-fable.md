# UI002 B — Fable independent review and final round-one provenance

Delivered through the verified dedicated reviewer’s scoped transcript. Paths below refer to the frontend VM. Critic provenance is the reviewer-reported fresh role, assigned exact head and isolated report path; host-internal task IDs were not supplied. C’s later glyph revision supersedes its round-one status when reviewed.

All three reviews are complete. My review servers on ports 3100 to 3102 are stopped, the three review worktrees have zero tracked changes, and builder ports 3000 to 3002 were never touched. The observatory server on 3002 was restarted by its own lane while I was finishing.

## Concept B — EXCHANGE / market board: PASS, reviewable for the founder's comparison

Reviewed evidence head `eb17d8a5bcdf9f4cae52351131be40314a78309d`, product commit `ab0e4df25100ebbccbb3843e16ce216a757ba9f8`. Pass means reviewable as an option, not selected, not merge or deploy authorized.

**Provenance.** Product and evidence commits share the same src tree, the evidence commit is docs only, and every frozen shared file is byte-identical to the governance base. Changes are confined to the exchange concept directory and this lane's preview wrapper. Manifest records production mode, build ID, 39 captures and 462 logged requests with zero failures.

**Fresh critic.** New identity, distinct from the A and C critics and the stopped candidate 02 critic. Identity line: "Fresh critic subagent (UI002 concept B EXCHANGE), reviewed SHA eb17d8a5…, 2026-09-06". Report at `/home/vercel-sandbox/review-ui002-exchange-c01/.context/critic/critic-report.md` with 44 screenshots, scripts and logs. Verdict PASS with six minor items.

**Material defects: none.** Non-blocking polish, highest value first, all reproduced by me:

1. The Connections register hardcodes "Not connected / Setup required" for all three venues in every state, so sample venues with SAMPLE balances on the Portfolio read the same as Robinhood. An intro sentence reconciles it, so it is honest but under-differentiated.
2. "Review setup" on the Robinhood card lands on Connections with the Robinhood panel collapsed and focus dropped to the body.
3. Decorative labels at 7 to 9px in the artwork and wordmark subline, and one art caption hidden under the bands in the default perspective.

**Verified clean.** Only localhost requests. No horizontal overflow across 30 checks. Zero warm hues in any state. Mobile drawer is a native dialog with focus placement, Escape close and focus return. Artwork is CSS planes with no per-frame React. Reduced motion fully static, including a runtime switch mid-transition. Robinhood has zero inputs and no success copy. No pitch copy on the entry.

**Limits.** Real homepage and protected dashboard not loaded. Env file not read. CPU-throttled motion not re-measured by me. Record at `/home/vercel-sandbox/review-ui002-exchange-c01/.context/reviewer/REVIEW-UI002-B-c01.md`.

## Concept C — OBSERVATORY / market art: REVISE, one narrow material defect

Reviewed evidence head `f260b10e323dffcbb5a3dc72c95879c416eba79b`, product commit `74259ae31c25729bb8b42b7709a9e3d2429ccea9`. This is unchanged from the report I gave earlier and is now final in the record.

**Fresh critic.** New identity, distinct from A and B. Identity line: "Fresh critic subagent (UI002 concept C OBSERVATORY), reviewed SHA f260b10e…, 2026-09-06". Report at `/home/vercel-sandbox/review-ui002-observatory-c01/.context/critic/critic-report.md` with zoom crops, axe results and reduced-motion series. Verdict REVISE, narrow.

**Material defect, reproduced by both of us.** The warning and empty-state icon is the text character U+2298 in Geist. Neither loaded font has it and no system font here supplies it, so it renders as a missing-glyph box in the disconnected and error banners, the status chip and every empty-state card at all viewports. The builder's own captures show the box, so the comparison material is affected. Fix: an inline SVG icon or a glyph present in the loaded fonts.

**Non-blocking notes.** About fifty terminal nodes at exactly 10px including money sub-readouts. Runtime reduced motion is honored by CSS while the parallax handler keeps updating an inline transform. Duplicate Enter desk action.

**Verified clean.** Isolation, overflow, palette, single display serif from root fonts, complete mobile tabs, static idle, bounded mouse-only parallax disabled under reduced motion, honest states, Robinhood disclosure with no inputs. Record at `/home/vercel-sandbox/review-ui002-observatory-c01/.context/reviewer/REVIEW-UI002-C-c01.md`.

## Concept A provenance addendum

Identity line: "Fresh critic subagent (UI002 concept A PHOSPHOR), reviewed SHA 689e7d51…, 2026-09-06". Report at `/home/vercel-sandbox/review-ui002-terminal-c01/.context/critic/critic-report.md`. Decision PASS with the two retained polish notes: bracket over caption at 1440 and 1280, and the `tab=journal` deep link falling back to Overview.

Host-internal task identifiers for the three critics are not exposed in user-facing text. Each critic's identity is the report's identity line, reviewed SHA and saved path above.
