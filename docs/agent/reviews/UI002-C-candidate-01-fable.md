# UI002 C — Fable independent review

Delivered through the verified dedicated reviewer’s scoped Conductor transcript. Worktree paths below refer to the frontend VM.

## Concept C — OBSERVATORY / market art: REVISE, one narrow material defect

Reviewed evidence head `f260b10e323dffcbb5a3dc72c95879c416eba79b`, product commit `74259ae31c25729bb8b42b7709a9e3d2429ccea9`. Everything else measured passes, so a single small fix makes this reviewable for the founder's comparison.

**Provenance verified.** Product and evidence commits share the same src tree, the evidence commit is docs only, and all frozen shared files are byte-identical to the governance base. Changes are confined to the observatory concept directory and this lane's preview wrapper. Manifest records a production build ID, a clean tree at capture start, and declared viewports and clock that match live rendering.

**Fresh critic.** A new critic subagent, distinct from the A and B critics and from the stopped candidate 02 critic, reviewed the same SHA blind first and returned REVISE with the same primary finding. Its report, zoom crops and axe results are at `.context/critic/critic-report.md` in the C review worktree.

**Material defect, reproduced independently by both of us**

1. The warning and empty-state icon is the text character U+2298 set in Geist. Neither loaded font contains it and no system font on this VM supplies it, so Chrome draws a missing-glyph box. It appears in the disconnected and error banners, the top-right status chip, and every empty-state card, at all viewports. The builder's own evidence screenshots show the box, so the founder's comparison material is affected. Expected: an inline SVG icon or a glyph present in the loaded fonts. Introduced by the concept.

**Non-blocking notes**

- Around fifty terminal text nodes, including money sub-readouts, sit at exactly 10px. This meets the floor but not the 11 to 12px norm.
- A runtime switch to reduced motion is honored by CSS, so nothing visibly moves, but the parallax handler keeps updating an inline transform.

**Verified clean.** Only localhost requests in every state and interaction. No horizontal overflow across 30 checks. Zero warm hues in any state. One display serif role from the root fonts, no new font imports. Mobile navigation shows all five tabs. Idle is fully static, the perspective toggle is a single 900ms CSS transform with no per-frame React, and the mouse-only parallax is bounded and disabled under reduced motion. Throttled frame samples were clean under low contention. Robinhood is "Not connected / Setup required" with an explanatory disclosure, no inputs and no success copy. The entry has no pitch copy.

**Limits.** Real homepage and protected dashboard not loaded, env file not read, performance measured in headless Chrome only.

Record: `/home/vercel-sandbox/review-ui002-observatory-c01/.context/reviewer/REVIEW-UI002-C-c01.md`.

**Concept B** at `eb17d8a5bcdf9f4cae52351131be40314a78309d` is still with its fresh critic. My own probe on B is clean. Its report follows when the critic returns.
