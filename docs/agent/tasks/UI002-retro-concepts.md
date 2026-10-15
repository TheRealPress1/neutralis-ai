# UI002 — three cool retro market concepts

Accepted comparison-stage ticket, 2026-09-06. Authority: Constantine explicitly requested two to three distinct iterations for his choice, parallel agents, a cool retro markets theme on BOTH front page and terminal, and an art-first front page without sales/pitch content. This supersedes UI001's single-concept palette and writer limit for these isolated lanes. Astra is sole dispatcher and shared orchestration-record writer; Fable co-head challenged the concept brief and isolation plan. Dedicated Fable remains the reviewer. Founder chooses the concept after comparison; no integration of competing concepts or publication before that choice.

Common product foundation: candidate02 evidence HEAD `5826a6141d73c9df90628d33b346ce019057c9d8`, product `d67ffda19ecf06591031ea7224326f49e92ab3fc`, src tree `5cb35d21654212cab4655b9d88b8821baea52bfa`. Candidate02 was withdrawn for new creative direction. Its partial independent review confirmed the prior depth, framing and type findings fixed and found no functional regression; the fresh critic was stopped. Keep its reduced-motion, containment and fixture-isolation fixes. A documentation-only lane-governance commit may precede branching; prove its product tree unchanged.

## Lanes

All three are separate git worktrees/branches in the existing frontend VM, workspace `71f761b2-e913-4149-9bd1-150c1b2a7553`. One product writer per checkout/branch; no branch renames. Root/shared files are never concurrently edited.

- A — PHOSPHOR / retro terminal. Astra `c8639b0a-38dd-41fe-b014-5c31e915cc6d`. Worktree `/home/vercel-sandbox/neutralis-concept-terminal`, new branch `concept/retro-terminal`, preview port3001. Full-screen terminal surface, character/line art, one mono type system, midnight blue and mint/cyan. Deliberate local line reveals or cursor/ladder accents; a static reduced-motion composition. A designed screen object, not the existing dashboard recoloured.
- B — EXCHANGE / market board. Existing Astra `e2558a2b-4981-4d9b-8547-72c234ff2603`, existing checkout `/home/vercel-sandbox/neutralis-ai` and current branch, port3000. A wall of horizontal bands, hard rules and column registers; cool paper/ink-blue with mechanical market-board numerals. One sculptural gap/fold motif beyond the table; restrained flap/row motion on explicit local changes. Front page is the board as art, not a sales funnel.
- C — OBSERVATORY / market art. Astra `3d587748-dd4f-40cc-9b57-aee4ce95744b`. Worktree `/home/vercel-sandbox/neutralis-concept-observatory`, new branch `concept/market-observatory`, port3002. Immersive cool space with paths/ribbons, a horizon or luminous seam, one restrained display role and edge mono readouts. The front page gives art the canvas; the terminal shares the identity on a readable flatter surface. Bounded perspective/parallax interaction with a deliberate static fallback.

## Common design and behavior

Each concept implements both views at `/design-preview?view=entry` and `?view=dashboard&state=sample` in its own checkout. These are reviewable design options; actual protected routes keep the foundation behavior until the founder selects a direction. Preserve sample/empty/disconnected/stale/error states and honest unavailable values. Visible sample identification and fixture clock `2026-09-06T12:00:00Z`, UTC. No false engine health, performance, quotes, account connection or order success.

Front page: wordmark, interactive market artwork and a simple Enter desk action. Remove pitch headlines, benefit sections, testimonials and pricing/funnel composition. Minimal functional/art labels are fine. Across both views, use cool navy/ink, mint/cyan and cool paper. No orange/yellow/amber or warm acid accents, including preview banner and stale-state colors. Loss/warning states need labels/icons plus a cool rose or other distinct cool treatment; color alone is insufficient.

Keep operational type comfortably legible (at least10px, generally11–12 where practical), normal contrast4.5:1 / large text and essential controls3:1, tabular numbers, visible keyboard focus, complete mobile navigation and no page horizontal overflow. Motion should express each concept rather than add unrelated effects. Static CRT texture is optional; no flashing/flicker. The old camera re-renders roughly430 SVG paths per frame and showed100–125ms long tasks at4x CPU throttling: avoid stacking motion and improve/reduce animated geometry if reused. No new heavy shader/font/package dependency just for effect. Use existing React/Motion and existing fonts, or concept-local assets with verified licenses.

Robinhood is now an explicit platform integration requirement, being developed in a separate lane. Each terminal should include a coherent Robinhood connection location and an honest Not connected/setup-required view. No fake successful connection, credential input or live authentication in these isolated previews. A safe local details panel may illustrate the intended flow; real OAuth/MCP handling belongs to the integration owner. Do not conflate Robinhood equities agentic tools with prediction-market execution.

## Ownership and exclusions

Allowed per concept: its exclusive `src/app/components/concepts/<id>/` directory and scoped CSS/assets, its own checkout's `/design-preview` page/wrapper for selecting that concept, and its own docs/evidence under `docs/design/concepts/<id>/`. Existing pure presentation/fixture modules may be imported read-only. A wrapper edit in an isolated branch is owned by that branch's sole writer, not a shared mutation. Common packages/lockfile, globals.css, root layout/fonts, proxy, AuthListener, connected dashboard components and backend remain frozen. Request a concrete shared-contract change through Astra if one is necessary; do not bypass preview/auth isolation.

No Python, execution/accounting, API/server actions, credential storage, database operations, live requests/orders, daemon/polling startup checks, secret reads, pushes, PRs, merges or deployments. Missing original fix `ad37071ae6bbc4a31289f9e662388c50e92ac3d3` remains untransferred and must not be reconstructed or applied twice. No other concept/worktree writes, no extra product agents, no direct messages to other lanes; Astra coordinates.

## Proof and stop

Inspect entry and terminal at1440x1000,1280x800,390x844, normal and reduced motion, keyboard/mobile, honest states and representative safe interactions. Network assertion: no external/Supabase/exchange/API calls from the fixture preview. Check CPU-throttled motion for pathological frame stalls; reduce motion complexity if needed. Build, scoped lint and actual browser evidence from a production server. Full screenshot matrix may focus on changed visual/interaction states; do not mechanically duplicate unaffected evidence. Base failures stay separate.

Commit local candidate before captures; record exact source/product-tree provenance, screenshot manifest, reproduction commands and preview port. Prefer serial production builds/browser captures if the VM strains; do not kill another lane's processes. Freeze edits and report candidate SHA and evidence to Astra. Dedicated Fable performs an independent critique with one fresh critic per completed concept candidate; fix material defects before presenting three options. The founder makes the aesthetic choice. No combining branches before selection.

Source amendment: the exact original ad37071 commit and patch have now been recovered and cryptographically verified from the Mac. See ../FIX-RECOVERY.md (or the scoped recovery packet). This supersedes the earlier missing-artifact observation; it does not rebase any product branch or authorize executing repair SQL. ARB001 has a scoped detached audit import; frontend/RH001 keep their current bases pending later coordinated integration.

## Founder refinement — Exchange market study

After viewing the concepts, Constantine said Exchange looks best, with Phosphor also a contender, and asked for graphs/market elements in place of the giant central banner. He could not see the trading desk through the comparison artifact. Astra recommends Exchange’s visual identity and has shown direct desk captures; larger direct images are being transferred.

B’s sole builder may refine its entry art into a coherent chart/market composition while retaining the cool paper/ink-blue mechanical identity. The existing terminal stays available for comparison. Preserve visible sample/illustrative truth, bounded motion, all isolation/accessibility requirements and the existing allowed file scope. New local product/evidence head gets a fresh independent GPT critique during the Claude quota limit. A/C stay frozen. This is a comparison refinement, not final selection or authorization to integrate competing branches/deploy. The founder’s verbal direction supersedes the earlier untouched-B comparison freeze for this specific change.

## Founder resource — Shadcnblocks

Constantine purchased a Shadcnblocks subscription and suggests dashboard/financial use. [The resource shortlist and access notes](../SHADCNBLOCKS-DESIGN-RESOURCE.md) record selected table, chart and navigation patterns for a subsequent desk pass. Preserve Exchange's visual identity. The current entry refinement and terminal comparison remain scoped as above; authenticated access and exact block dependencies are not yet verified. No package/theme migration is implied by the reference alone.

## Founder priority — simple internal desk

Constantine clarified that metrics should be simple and easily read; research/strategy is the main priority. Finish the accepted Exchange refinement and bounded critique, then freeze. No new Shadcn dashboard, dependency migration or extended cosmetic iteration is dispatched. A future desk pass should focus only on balances, positions/exposure, P&L history, activity and clear operating/connection states.
