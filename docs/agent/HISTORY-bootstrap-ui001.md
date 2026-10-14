# Bootstrap and UI001 history

Historical record retained from STATE on 2026-09-06. Statements about missing artifacts, ownership, active candidates and blockers describe earlier observations. Consult [current state](STATE.md) and [project profile](PROJECT.md) for the superseding facts.


Current work: UI001 frontend redesign, explicitly commissioned after the research pass. Astra is the single frontend dispatcher; Fable is the independent peer/reviewer. Builder workspace `71f761b2-e913-4149-9bd1-150c1b2a7553`, session `e2558a2b-4981-4d9b-8547-72c234ff2603`, gpt-6-astra (created high, now observed ultra), verified creator/repository/project before dispatch. Accepted ticket: `tasks/UI001-frontend-redesign.md`; order receipt `.context/frontend-builder-order-receipt.json`. Scope is actual entry/dashboard presentation plus a safe sample preview, stopping at local committed/reviewed candidate before push/merge/deploy. Earlier statements below about no builder work describe the completed research/bootstrap phase.

Constantine then explicitly requested a recurring critique loop with fresh subagents. Dedicated Fable reviewer `4e214372-3b88-437a-a31c-222cb43c9c60` was created and verified in the frontend workspace; onboarding receipt `.context/frontend-reviewer-onboarding-receipt.json`. Builder was notified with `.context/frontend-builder-loop-receipt.json`. Protocol: `FRONTEND-REVIEW-LOOP.md`. Each local candidate gets a fresh bounded read-only critique, fixes return to the sole builder, and the cycle repeats until the ticket has no material unresolved findings. This is an active supervised Conductor workflow, not an installed perpetual background daemon.

## UI001 candidate 02 — withdrawn; partial verification retained

Product commit `d67ffda19ecf06591031ea7224326f49e92ab3fc`; evidence HEAD `5826a6141d73c9df90628d33b346ce019057c9d8`; builder reports unchanged `src` tree `5cb35d21654212cab4655b9d88b8821baea52bfa` in the evidence commit. Product edits are frozen. Dedicated Fable received this exact candidate at 2026-09-06T21:53:25.787Z; receipt `.context/frontend-review-candidate-02-receipt.json`. It will use a new fresh critic and a separate review worktree.

Builder reports a projected ribbon with camera-angle changes and face occlusion, clear caption/strip framing, larger operational labels, live reduced-motion preference handling and small navigation cleanup. Production build/scoped lint pass; 38 screenshots, 23 interaction groups, 37 axe scans, no page exceptions or external/API requests. Evidence is under `docs/design/evidence/candidate-02/` in the frontend VM. These candidate02 results remain builder-reported until the new independent verdict. The production preview remains on local port3000. Credentialed routes remain untested; baseline BalanceBar lint issue remains documented.

## UI001 candidate 01 — revised in candidate 02

Builder reports product commit `45a03008efbb583d90810fada183325884038911`, evidence HEAD `74239b4e46096f73f2faef36c32fbbab525a29d6`, and unchanged `src` tree `4340919baa817d043db52261a12f44ef08294bcc`. Exact candidate assigned to dedicated Fable at 2026-09-06T21:20:24.099Z; receipt `.context/frontend-review-candidate-01-receipt.json`. Evidence lives in the frontend VM at `docs/design/evidence/candidate-01/` (manifest, screenshots, RESULT and source audit). Builder-reported results (subsequently independently checked by Fable as detailed below): build pass, 34 screenshots, 20 interaction groups, 37 axe scans, keyboard/reduced-motion checks and zero external/Supabase/exchange/API calls from the fixture preview. Presentation lint passes; full scoped lint retains one verified baseline BalanceBar effect error. Credentialed routes remain untested.

Frontend preview runs locally on port 3000 at `/design-preview?view=entry` and `/design-preview?view=dashboard&state=sample`. No forwarding URL was exposed. Candidate01 review completed with REVISE: strengthen spatial depth/perspective, fix hero caption/boundary collisions, and increase operational label sizes. Functional, accessibility, data-truth and fixture-network contracts passed independent checks. Full review: `reviews/UI001-candidate-01-fable.md`. Astra dispatched the three focused revisions to the sole builder; receipt `.context/frontend-revise-candidate-01-receipt.json`. Candidate02 will receive another fresh critique after its local commit and production-browser evidence. A bounded read-only request asks the builder for small fixture screenshots to transfer through scoped Conductor transcript output for orchestration composition inspection; no product changes or external uploads.

- Cloud branch: `constantinexanthos/paris`, unchanged.
- Cloud HEAD and live upstream main: `d524b5a75643df5f508c068e3c4fb930ba54b4eb`.
- Local Mac reviewed head: handoff reports `ad37071ae6bbc4a31289f9e662388c50e92ac3d3`, one commit ahead. The object is unavailable in the cloud checkout/origin. No supplied patch exists in the starter ZIP; no patch applied and no execution code changed.
- Remote deployment head and active services: unknown. Historical handoff says Supabase INACTIVE; this is not a fresh cloud observation.
- Active playbook: archive hash and per-file manifest in `playbook-source.json`; installed links in `.agents/skills` and `.claude/skills`.

| Lane | Owner | Workspace / head | State | Next action |
| --- | --- | --- | --- | --- |
| Bootstrap records | Astra `78ae8eee-9475-4bf5-a3b2-c19237ac2a13` | Current workspace / `d524b5a` | Shared records, installed skills and draft tickets prepared locally | Obtain original patch and settle implementation profile when commissioned |
| Peer research | Fable `e9a2da19-6038-4eb7-bb1e-a61f585f6fb6` | Same workspace, read-only | Supplier comparison and concrete first-experiment review received; qualifications incorporated | Sample/rights decision next; larger workflow not launched |
| Frontend UI001 | Astra builder `e2558a2b-4981-4d9b-8547-72c234ff2603`; Astra co-head dispatch | `71f761b2-e913-4149-9bd1-150c1b2a7553` / evidence HEAD `5826a61` | Candidate02 committed; product edits frozen | Await independent review |
| Frontend review | Fable reviewer `4e214372-3b88-437a-a31c-222cb43c9c60` | Frontend workspace / assigned `5826a61` | Candidate02 dispatched; fresh critic and independent checks | Return pass/revise on exact candidate |
| Risk settings | Unassigned | No workspace / draft R001 | Proposed | Peer challenge and founder approval |
| Financial-data errors | Unassigned | No workspace / draft R002 | Proposed | Approve data-error contract and ownership |
| Execution/accounting | Unassigned | No workspace / draft R003 | Proposed | Obtain exact local patch before candidate work |

## Decisions and blockers

- Astra owns shared orchestration records and UI001 dispatch. Fable's proposed dispatch ownership and unapproved builder assignments apply only to future backend lanes.
- Missing transfer artifact: `ad37071-phantom-fill-fix.patch` or the full Neutralis transfer archive containing it. The uploaded archive is the reusable playbook only.
- The old session named Fable Orchestrator is actually Astra and now shows archived in live metadata; Astra did not archive it. The verified Claude Fable peer is active in this workspace. Latest preflight reports Fable effort `ultracode`; Astra did not change it.
- Constantine clarified this is exclusively an internal platform for him and Gaspar, not a product for sale. He now authorizes deliberate research toward a new equity strategy and explicitly wants both co-heads working together. He requests storage/data options before discussing any budget; no purchases. The subsequent frontend redesign order superseded the earlier UI-later preference; data/cloud purchase decisions remain outstanding.
- Two earlier Mac-access attempts timed out. Their commands were not confirmed executed. No local Mac changes were made by this session.

## Evidence

- Read the uploaded handoff and all three supplied skills, templates and helper. Starter START-HERE/VALIDATION match earlier attachments byte for byte.
- Node `v24.14.1`: helper suite reproduced, 59 passed, 0 failed.
- Live Conductor metadata verifies creator, repository, project, workspace and initial sessions; current remote main verified with `git ls-remote`.
- Mac build and 64-pass/1-fail Python results in the handoff are historical agent reports at `ad37071`, not reproduced cloud CI evidence.
- Source inspection at cloud `d524b5a` confirms risk-profile actions use a service client without user authentication/scoping, and stats queries discard database errors before defaulting to zero. This is a source finding, not an authenticated production test.
- At completion of bootstrap/research, no builder work or product source edits had been performed. UI001 now has one active frontend builder. No pushes, merges, deployments, database operations or trading commands have been performed by Astra.
- Fable handshake verified via Conductor; review recorded in `reviews/bootstrap-fable.md`. Fable's host discovered all three installed skills. Both hosts' six links resolve to 15 pinned starter files, whose hashes all match.
- Bootstrap documentation is uncommitted and unpublished. Only the startup entrypoint and project/skill records changed; product source HEAD in the orchestration checkout remains `d524b5a`.
- User clarified equities would be a new strategy within Neutralis, independently of its current arbitrage code. `EQUITIES-RESEARCH.md` records the original concept. The storage/research-program proposal is complete and the subsequent first-experiment package is prepared; no broker, data purchase or strategy implementation has begun.
- Current proposal: `RESEARCH-OPTIONS.md`; optional independent briefs: `RESEARCH-PROMPTS.md`. Supabase, DuckDB, R2, SEC, ALFRED and Sharadar documentation was checked. Prices are listed as dated service rates, not a full research budget. No supplier has been selected.
- Co-head exchange verified in this turn: Astra sent scoped briefs after fresh lane checks and retrieved Fable's sourced replies. Fable confirmed the built-in Deep Research workflow exists but was not used for the initial memo; Astra's current tool list has ordinary web/code research without a dedicated Deep Research call.
- Fable's completed source-based review and the co-head synthesis are recorded in `reviews/research-plan-fable.md`. The current recommendation is a small portable pilot, followed by Supabase metadata plus separate object storage/backup for sustained research if chosen. Data/cloud/model budgets remain unapproved, as requested.
- Constantine authorized the next bounded pass with "Okay go ahead", then set `/goal keep going on this`. Current results: `FIRST-EXPERIMENT.md` specifies the proposed momentum/profitability test, `DATA-SHORTLIST.md` compares Sharadar/EODHD/Norgate, `RESEARCH-DATA-CONTRACT.md` specifies proposed data/ledger conventions, and `DATA-INQUIRY-DRAFT.md` is an unsent licensing/sample inquiry. No vendor has passed sample acceptance or quoted a suitable shared arrangement.
- `PUBLIC-DATA-CHECK.md` and its small JSON evidence record verify Apple's original FY2023 annual filing values and the period/availability distinction. Astra and an internal reviewer retrieved SEC page content; arithmetic and document links were checked. This is one public input example, not programmatic ingestion or a backtest.
- The supplier/experiment co-head review and corrections are recorded in `reviews/first-experiment-fable.md`. Sharadar is the best documented candidate among these three for the fundamentals study, conditional on rights and data checks. Published personal prices are not shared-platform quotes.
- This scoped research deliverable is complete for discussion. Final checks reconfirmed HEAD/upstream main at `d524b5a`, verified local links/formatting across nine changed research/state/review documents, parsed the public fact record and recomputed its ratio. No product tests were run for documentation-only work. The next phase requires choosing the research direction and obtaining suitable shared-use terms/evaluation data; the vendor inquiry remains unsent and its contracting-party facts unresolved.
