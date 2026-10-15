# UI005 candidate01 — independent cross-family review (Fable co-head)

Date: 2026-09-07 UTC. Reviewer: Fable `e9a2da19-6038-4eb7-bb1e-a61f585f6fb6` (Claude family); builder: Exchange owner `e2558a2b` (GPT family). Review performed in my own detached worktree `.context/ui005-fable-c01-review/worktree` from `refs/reviews/ui005-investment-desk-c01`. Product code read-only; no messages, edits, purchases, network, database, service startup or publication.

## Exact candidate
HEAD `3e47e3a34855d61de751275ac3fe5cbe7fee8ae7`, parent `0167a6de8e13e3583356f14cc5b724a17e4ec269`, tree `42c1b0f66d71bb4e1b37cfaa0cec08675e29819d`, src tree unchanged `2b0f119e1c33075d1fa5c975bba63db95f108ab2`. Exactly three additions. File hashes: HTML 39,347 B `1a7b7583…c0381c`; design contract 8,824 B `28cacd15…962f9`; receipt 10,979 B `2f93d684…17fc1`. Matches `.context/ui005-review-transfer/c01-custody.json`. Builder's 18 screenshots were not transferred and were not inspected; all visual evidence below is my own fresh capture from these exact bytes.

## Method
1. Blind first: viewed accepted Exchange reference `exchange-dashboard-full-eb17d8a5.jpg`, then rendered the candidate via `file://` in Chrome (Playwright, `offline: true`, all http(s) routes aborted) at 1440×1000 and 390×844; recorded `01-blind-notes.md` before reading receipt, design contract or source.
2. Then read all three files in full and swept all eight scenarios × both arms × both viewports (`sweep.mjs`, `sweep-output.json`, 30 captures under `captures/`), keyboard traversal, reduced-motion emulation, storage, next-action behaviour, inner-element clipping and an independent axe WCAG 2 A/AA + 2.1 AA scan (`clip-axe.mjs`).

## Results against the ticket
- **Scenarios (8) + one-PM positive:** displayed outcomes match the ticket and the design contract exactly. Readiness appears only in complete, unknown-cost (protocol only, cost "Unknown") and arm A positive. Missing approval → "Waiting for PM B", 1/2 acceptances. Changed → current B-P01-v02 with both old B-P01-v01 acceptances shown "≠ current v02 / Old acceptance" and the prior target listed. Missing evidence → held in both arms, S02-A absent, risk "Reject · evidence" despite two acceptances. Concentration → NTH-X 50% vs 40% cap, no clipping. Disagreement → PM A Accept / PM B Reject, held. Expired → deadline 11:59 vs evaluation 12:00, "Expired by 1 min", prior acceptances only.
- **Arm switching during failure:** with arm B in missing-approval, arm A shows its own A-P01-v01, A-H04 $36k/$24k, one assigned PM, Ready; switching back restores arm B's failure. No pooling.
- **Targets:** every complete target sums to 100% (35/25/10/30; 40/20/10/30; 50/15/5/30; arm A 25/15/10/50).
- **Fixture clock:** single 2026-09-07T12:00:00Z in footer and detail; observations −120/−90/−60 min, cutoff −30, decisions −20/−15, v02 −10, expired deadline −1, other deadlines +30. All displayed instants consistent.
- **Cost arithmetic (recomputed):** R01 0.12+0.02+0.08=0.22; R02 0.12+0.12=0.24; R03 0.04 (failed call included); A01/B01/B02 0.08+0.01+0.08=0.17 each; shared 0.50 counted once; PM 0.51; subtotal 1.01; allocation 40/60 → 0.20/0.30; totals 0.57/0.94/1.51; unknown-cost partials 0.49/0.82/1.31 with complete totals "Unknown", never $0. Uncached = total − cached in every row. Units visible.
- **No action authority:** the only buttons are the two arm toggles and one "Inspect …" disclosure opener; "Accept/Reject" are labels; no Connect/Trade/Approve/Run controls; no forms; CSP `default-src 'none'; connect-src 'none'`; zero non-file requests; localStorage/sessionStorage untouched after interaction.
- **Keyboard:** logical tab order (skip link → nav → select → arm buttons → action → links → summaries), visible 2 px focus outline on every stop, select changes by arrow key, arm toggles by Enter with aria-pressed, details by Enter; "Inspect" moves focus to the opened summary.
- **Reduced motion:** no transitions or animations exist (count 0 under `prefers-reduced-motion: reduce` and normal).
- **Overflow/console:** scrollWidth equals viewport at both widths in all states; the only elements with hidden overflow are intentional `.sr-only` captions. Zero console errors/warnings, zero page errors.
- **Accessibility scan:** axe reports 0 violations, 29 passing rules, at both viewports in complete, changed, unknown-cost and missing-evidence with all disclosures open.
- **Receipt and design contract:** scenario→outcome→screenshot matrix present; network-disable method and negative control described; integration map lists contract item numbers only; synthetic attribution everywhere; broker "Not connected".

## Findings
No material defects. Three non-blocking polish notes for the designer:
1. Below 900 px the header "BROKER CONNECTION · Not connected" is hidden (`.broker{display:none}`); the footer still states it, so the ticket requirement is met once per page (HTML line 12 CSS, footer line 38).
2. Smallest rendered text is 9 px at 390 px (brand "EXCHANGE" small, `.brand small{font-size:9px}` line 13) and 10 px labels on desktop; consistent with the Exchange reference but at the legibility floor.
3. The "Inspect …↗" button uses an external-link glyph for an in-page disclosure; the reference uses the same glyph for internal links, so this is vocabulary consistency, not a defect.

## Verdict
**PASS — suitable for founder comparison only.** Not composition acceptance, not product integration, not EQ001 validation, not broker capability. Pending: the independent fresh critic's evidence for final settlement; builder screenshots remain untransferred and are not relied upon.
