---
name: cross-family-review
description: Independently verify a committed builder candidate using an assigned reviewer from the other model family, with blind-first visual inspection and evidence-based merge-readiness findings.
---

# Cross-family review

Read the project authority, review scope and acceptance ticket. Resolve the exact candidate head and reference. Keep product code read-only. Build and run in an isolated review worktree, not a builder's active checkout. No pushes, merges, deployments or GitHub comments unless the current user explicitly requests that action.

## Visual candidate

Inspect committed screenshots and the rendered reference before reading PR prose or the builder's explanation. Record your observations first. Use the agreed viewport dimensions, state, fixture identity, timezone and pinned clock. Missing evidence is not a pass.

Verify each capture's source commit or build tree. A PNG carried into a newer commit is not evidence of that candidate by itself. For an evidence-only follow-up commit, establish that the captured product tree matches the reviewed candidate; otherwise recapture the affected states.

Prioritize the project's approved visual composition, then product truth, then behavior; use speed only as an explicitly agreed tiebreaker. For nonvisual changes, prioritize their safety and functional contract instead.

## Mechanical verification

- For visual changes, read the diff and compare claims against code only after the blind visual pass. Nonvisual reviews can begin with their contract and diff.
- Reproduce the highest-risk assertions. Exercise actual harmless interactions, not just class-name tests or inferred event handlers.
- Check empty, missing, zero, stale, disconnected and permission states where relevant. Never equate a fixture with a live capability.
- Verify tests, build and CI for the exact head; inspect new failures and fixture/baseline changes. A recorded exception needs a cause and approval, not a green badge produced by accepting it.
- For UI, test clipping, shared type roles, keyboard/focus, responsive behavior and visible-copy rules in the specified states. Broad silence sweeps need explicit scope.
- Distinguish isolated candidate results from the same-build integrated result, and both from the currently deployed version. Report dependency heads and untested paths.

## Disagreement and cost

When reviewers disagree, compare file/screenshot anchors and reproduce the conflicting assertion. Evidence outranks narrative from either family. Escalate unresolved taste or policy decisions to the founder; do not invent a ruling in their name.

Keep the assigned reviewer stable for the candidate. Run one substantive review per new code head under the project's model budget. For evidence-only pushes, review the changed evidence and affected claims; broaden checks only if they reveal a new risk.

## Return

Give the requested scorecard, at most the three most important concrete defects with file:line or screenshot anchors and reproduction steps, then a one-line verdict. Do not pad a clean review with invented defects. Name pending CI, unverified capabilities or integration dependencies explicitly. A review recommendation is not merge authorization.
