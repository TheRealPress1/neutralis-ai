# UI002 A — Fable independent review

Delivered by verified dedicated Fable reviewer through scoped Conductor transcript. Review worktree paths below refer to the frontend VM. Astra viewed transferred composition captures; independent source/browser assertions are Fable’s recorded evidence.

Concept A review is complete. Concepts B and C have finished my own live probes and each has a fresh critic still running; their reports will follow when those critics return.

## Concept A — PHOSPHOR / retro terminal: PASS, reviewable for the founder's comparison

Reviewed evidence head `689e7d516a148310de015c5c9ddf4502021ac6ab`, product commit `0f8607244a16f4b0caa2a32cdd02ca545d18bc40`. Pass means reviewable as an option. It does not select the concept or authorize merge or deployment.

**Provenance verified**

- The governance commit changed only AGENTS.md and docs, and its src tree equals the candidate 02 foundation.
- Product and evidence commits share the same src tree, and the evidence commit touches docs only.
- Every frozen shared file is byte-identical to the foundation: package files, public assets, all configs, globals, root layout, proxy, AuthListener, dashboard, api, lib and the Python tree. Changes are confined to the concept directory and this lane's preview wrapper.
- Screenshots came from a production server with a recorded build ID, declared viewports and the fixture clock match live rendering, and the composition is static so settling is not in question.

**Fresh critic**

A new critic subagent, distinct from the stopped candidate 02 critic, reviewed the same SHA blind first and hash-matched three of its own captures against the builder manifest. It returned PASS. Its report and 33 screenshots are at `.context/critic/critic-report.md` in the A review worktree.

**Material defects: none.** Two minor polish items were reproduced and are left to the builder's discretion.

1. Entry at 1440x1000 and 1280x800, all channels. The artwork's bottom-right bracket corner is drawn over the caption "LOCAL INPUT / STATIC FIELD". Clear at 390. Expected: caption and bracket separated.
2. Deep link `?tab=journal` falls back to Overview because the tab id is "activity" while the visible label is "Journal". In-app navigation works. Expected: accept the label's id or align the label.

**Verified clean by me and the critic independently**

- Only localhost requests in every state, tab and interaction. No horizontal overflow across 30 checks. Zero warm hues in any state, including the preview and stale banners. No text under 10px. Tabular mono numerals. Visible mint focus on every control. Mobile navigation is five wrapped tab buttons with current state.
- Motion is two one-shot CSS reveals with no timers or per-frame work. Reduced motion is fully static, including a runtime preference switch mid-transition.
- Honest states use dashes and labeled empty fixtures. Robinhood is "Not connected / setup required" with an explanatory disclosure, no inputs and no success copy. The entry has no pitch copy.

**Limits.** I did not load the real homepage or protected dashboard, did not read the tracked env file, and did not re-measure CPU-throttled motion myself since the geometry is static and the builder and critic samples were clean.

Record: `/home/vercel-sandbox/review-ui002-terminal-c01/.context/reviewer/REVIEW-UI002-A-c01.md`.

## Concepts B and C — in progress

- **C OBSERVATORY** at `f260b10e323dffcbb5a3dc72c95879c416eba79b`: provenance verified, isolated worktree and server on port 3101, my probe clean on isolation, overflow, palette, type, reduced motion with runtime switch, and Robinhood honesty. One minor candidate finding so far: the notice icon is the text glyph U+2298, which neither loaded font contains, so it renders as a missing-glyph box in this VM's Chrome. Fresh critic running.
- **B EXCHANGE** at `eb17d8a5bcdf9f4cae52351131be40314a78309d`: provenance verified, isolated worktree and server on port 3102, my probe clean including the mobile drawer focus handling and runtime reduced-motion switch. One consistency note so far: the Connections tab calls Kalshi and Polymarket "Not connected" while the Portfolio shows their sample balances, with an explanatory sentence present. Fresh critic running.

Builds were serialized, builder ports 3000 to 3002 were not touched, and no product files were modified in any worktree.
