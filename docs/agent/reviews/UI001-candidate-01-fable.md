# UI001 candidate 01 — independent Fable review

Source: dedicated Fable reviewer `4e214372-3b88-437a-a31c-222cb43c9c60`, verified frontend workspace `71f761b2-e913-4149-9bd1-150c1b2a7553`. Retrieved through scoped Conductor transcript on 2026-09-06; review dispatch receipt `.context/frontend-review-candidate-01-receipt.json`. The report below is Fable's delivered review, not a root reproduction. Astra inspected small composition captures separately and accepted the revision scope. Sole builder received the three findings in `.context/frontend-revise-candidate-01.md`, with send receipt of the same stem. No merge/deploy action is authorized by this review.

Review of UI001 candidate `74239b4e46096f73f2faef36c32fbbab525a29d6` is complete. Decision: **REVISE**, with no blockers. The functional, accessibility, product-truth and isolation contracts all pass. What remains is one creative-acceptance gap and two concrete visual defects.

**Provenance and setup**

- The evidence commit touches only docs/design. The src, public, package, lockfile and config trees are byte-identical between the product commit and the evidence commit, and the manifest head and tree hashes match.
- I reviewed from a detached worktree at `/home/vercel-sandbox/review-ui001-c01` with its own production build on port 3100. The builder checkout was never touched. The worktree has zero tracked changes.
- One fresh read-only critic subagent was spawned for this candidate. Its report and 33 screenshots are at `.context/critic/critic-report.md` in the worktree. My own record, scripts and screenshots are under `.context/reviewer/`.

**Top three defects**

1. **Major, creative acceptance. Hero depth and interaction fall short of the amended brief.** Route `/design-preview?view=entry`, all viewports. The ribbon is a single-plane SVG strand cluster shaded by gradient. It has no fold, occlusion or layered response, and the composition is a conventional two-column hero rather than an immersive space. The "Shift perspective" control performs a 13 degree planar rotate and scale that reveals no new facet. Both the critic and I judged the founder's "unmistakable abstract market art with real spatial depth and intentional interaction" about half realised. Expected: keep this sculpture and push it, for example with a second occluding fold or parallax layer, a perspective interaction that genuinely changes the viewing angle, and a composition that lets the form cross the copy column. While there, give the button an accessible name that contains its visible text.

2. **Minor, visual framing collisions in the hero.** At 1280x800 the caption "FIG. 01 / THE SPACE BETWEEN" is struck by the dotted guide and crosshair. I measured the caption at y 705 to 717 and the guide group bottom at y 714. At 1440x1000 in the turned state, the ribbon tail crosses the hero's bottom hairline into the OBSERVE, EVALUATE, DECIDE strip. Expected: caption and strip stay clear of the form in both states at all three viewports.

3. **Minor, operational label legibility.** Route `/design-preview?view=dashboard`, all states. Position column headers render at 8px. The heading date, chart axis dates, "Account" tags and activity type labels render at 9px. Contrast passes, but these are below comfortable reading size for a data surface. Expected: no operational label below roughly 10px.

**Verified clean, no action needed**

- Network: only localhost requests across entry, all five states, all tabs, drawer, chart range, disclosure, search, reload and state selector. No /api, Supabase, exchange or Stripe traffic.
- No horizontal overflow at 1440, 1280 or 390. Drawer is a native dialog with focus in, Tab loop, Escape close, focus return and scroll lock.
- Reduced motion: zero running animations and a byte-identical hero across 1.5 seconds. Normal motion has one 18 second CSS drift confined to the hero, no canvas or timers.
- Contrast scan found nothing below threshold. Tabular numerals apply to metrics and balances. Focus rings are visible everywhere.
- Disconnected and error states show dashes, never zeros. Empty state zeros are labeled as an empty fixture. Homepage copy has no invented claims.
- Proxy exemption is exact-path only. Root PKCE redirect intact. AuthListener skips only the preview path. Preview imports no connected code. Connected PositionsTable keeps the scenario table and legs, ActivityFeed keeps guard details, DashboardShell keeps tab URL sync and gates.
- Build passes. Scoped lint passes. The BalanceBar lint error is baseline, reproduced at the base commit.

**Evidence hygiene, not a defect**

The builder's screenshots came from the dev server. The floating "N" badge in every shot is the Next.js dev indicator and does not exist in production. The clipped mobile drawer screenshot was captured mid slide-in with no settle wait. Recapture from a production build next cycle.

**Unverified boundaries**

I did not load the real homepage or the connected dashboard in a browser, since the homepage server component calls Supabase auth. I did not read the tracked `.env.production` file, which the production build did consume.

Non-blocking notes the builder may fold in: the sidebar workspace chevron is a dead affordance, and the reload status line persists across tabs.
