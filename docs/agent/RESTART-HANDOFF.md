# Neutralis restart handoff

Recorded 2026-09-05 America/New_York (2026-09-06 UTC). Prepared by the Codex session in the local Dubai workspace for the user's move to Conductor Cloud.

## User intent and current scope

Constantine and a friend want to reopen Neutralis, assess the existing trading platform, and rebuild it with Astra and Fable as peer orchestrators. The user supplied the agent-playbook starter and then said they are transferring to a cloud workspace.

Read-only technical/product restart assessment and local frontend startup have been completed. No new product changes, deployments, database changes, or trading orders were made by this session. Private trading first versus public SaaS first is still unresolved; private use first was recommended, not approved as a final product decision.

Do not treat this document as authorization to enable real-money trading or repair historical financial records. The inactive database and unverified daemon state must be assessed together: live execution defaults to enabled in the code. Do not launch the daemon or polling scripts as a startup check.

## Repository and transfer

- Product upstream: https://github.com/TheRealPress1/neutralis-ai.git (`origin`).
- Additional remote: https://github.com/constantinexanthos/neutralis-ai.git (`mine`). Do not substitute this as the upstream silently.
- Target: `origin/main`.
- Local branch: `constantinexanthos/fix-kalshi-balance`; user has not authorized renaming it.
- Local reviewed code head: `ad37071ae6bbc4a31289f9e662388c50e92ac3d3`.
- Freshly fetched `origin/main`: `d524b5a75643df5f508c068e3c4fb930ba54b4eb`.
- Local head is one commit ahead of upstream main. The extra commit is Fable's `Fix inflated realized P&L: stop recording unfilled legs as positions`. It was already present before this restart assessment; this session did not author it or push it.
- Working tree was clean before writing this handoff.
- The transfer bundle includes a Git patch of that one local commit. Check the destination history first; do not apply it twice. If starting exactly from the recorded upstream head, `git am ad37071-phantom-fill-fix.patch` imports it into the new workspace branch; reverify the resulting head and tests. Do not merge or push merely because this handoff describes a patch.
- This handoff and bundle are local artifacts, not remotely published. Attach the bundle to the cloud session; a new checkout does not automatically receive these files.

## Co-head setup

Conductor's documented API/MCP messaging addresses cloud sessions. A local sender can contact cloud sessions with authentication; authenticating the local CLI does not make another local chat an API destination. Sources: https://www.conductor.build/docs/api and https://www.conductor.build/docs/api/mcp.

The local CLI has no configured API token. It could not resolve peer sessions, and no messages were sent to another Conductor chat. `conductor model` does list `gpt-6-astra` and `fable-5-1`; recheck in the destination. The internal audit agents were Codex subagents, not the Fable co-head.

Recommended arrangement: Astra and Fable sessions in one cloud orchestration workspace, one explicitly named dispatch owner, independent builders in separate workspaces/branches. Verify founder, repository, creator, workspace/session IDs, permissions, and model budget from live metadata before dispatch. Do not reuse Dubai's local workspace ID as a cloud destination.

The user supplied three playbook skills (co-head-orchestration, cross-family-review, session-handoff), seven templates, and a lane preflight helper. All were read. The helper passed 59 offline tests. The transfer bundle includes those supplied files plus START-HERE.md and VALIDATION.md under `agent-playbook-starter/`. They have not been installed into this repository and no founder-approved project profile exists yet; unpacking the bundle does not install or approve them.

## Verified environment and checks

- `npm run build`: passed at `ad37071`; includes TypeScript and page generation.
- Local production frontend started on `http://127.0.0.1:55010`. This URL belongs to the Mac, not the destination cloud workspace.
- Local landing and login GET: HTTP 200. Unauthenticated `/api/dashboard?type=stats`: HTTP 401. Authenticated dashboard/exchange connections were not tested.
- Production domain: https://neutralis.ai redirects to https://www.neutralis.ai; the final HEAD response is HTTP 200 from Vercel. This does not establish the deployed Git commit or authenticated product health.
- Vercel connector previously returned reauthentication required; no deployment commit verified.
- Supabase `get_project` succeeded for project `xbiifeqzbxfqpjrpdhjk` (Neutralis), reporting `INACTIVE`. Prior SQL attempts timed out. No database data was read or modified.
- Local `.env.local` contains only the public Supabase URL and anon-key variables. Shell lacks `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_KEY_ENC_KEY`, and other backend secrets. No credential values are included here or in the bundle.
- Existing Python suite: audit subagent reported 64 passed, 1 failed with network connections and `psycopg.connect` blocked and pytest plugin autoload disabled. Fable's seven portfolio regressions passed. This is an agent-reported result, not committed CI evidence; reproduce safely in the destination.
- The failed test is `tests/test_directional.py:326`: duplicate-position fixture expects reject but receives pass. The fixture has no signal legs, while the guard iterates legs; this alone does not prove ordinary scanner output bypasses the guard.
- Build warnings: Next inferred the Mac user's home as workspace root because of another lockfile; local Node is v26.7.0. Pin the appropriate runtime/build root for the destination after inspecting deployment configuration.

## Important findings at the reviewed head

### 1. Rebuild execution and accounting around confirmed fills

Fable's local fix prevents some unfilled legs becoming phantom positions, but does not fully reconcile real fills:

- `neutralis/portfolio/manager.py:27`: fill matching uses ticker and venue without side. The audit's mock with YES 3 contracts at $0.55 and NO 7 at $0.40 recorded both with the YES order ID and quantity 3. Add a side-specific regression and fix identity/quantities.
- `neutralis/engine/event_loop.py:2295`: Polymarket may fill, followed by a failed Kalshi depth check at line 2313 and an early return before live recording. The caller at line 1946 then executes paper fallback. A real filled leg can disappear from live accounting.
- `scripts/run_once.py:451` invokes `PortfolioManager.execute_exit`; `neutralis/portfolio/manager.py:758` only closes a database record at a quoted price. It submits no exchange sell. Live positions can be reported as realized while remaining open on the venue.
- Live trading defaults to enabled (`neutralis/config.py:227`); disabling it returns before event-mode scoring (`event_loop.py:1848`). Kill-switch lookup errors allow processing to continue (`event_loop.py:3000`). A read-only/shadow mode must be explicit and independently tested.

These are code-level defects and risks, not proof of how much of the user's historical P&L is wrong. Preserve exchange adapters, normalized models, scanning interfaces, and useful fixtures. Build durable order/fill reconciliation and exchange-confirmed exits before resuming trading.

### 2. Scope risk settings to the authenticated account

`src/app/actions/dashboard.ts:95` and line 112 use a Supabase service client without authenticating or filtering by user. They select the first active risk profile globally and update an arbitrary supplied profile ID. These actions are mounted by the visible RiskProfileEditor. RLS cannot protect service-role queries. Authenticate, scope reads/updates, and validate allowed values server-side before two accounts use the platform independently.

### 3. Reconcile historical data and show failures honestly

- Kalshi balance already adds cash plus position value (`src/app/actions/api-keys.ts:370`). Production/account verification remains outstanding.
- Dashboard stats ignore database query errors and fall back to zeros (`src/app/api/dashboard/route.ts:129`); StatsBar suppresses fetch failures. Missing data must not appear as a trustworthy zero balance or P&L.
- `migrations/026_positions_is_paper.sql` and the new audit SQL use ticker/venue/side joins without sufficient account/lifecycle linkage. Do not execute repairs based only on missing order IDs or these broad joins. Reconcile user-scoped exchange fills, positions, fees, and settlements first.

### 4. Restore meaningful operational visibility

The visible dashboard omits existing automation/health and execution components. Its “Live” indicator reflects a Supabase subscription, not a healthy engine or fresh venue data. The user previously requested removing the old Live section, so do not reinstate it wholesale without a product decision. Surface concise health, data freshness, errors, and appropriate controls within the approved UI.

Polymarket US key validation uses a public, unsigned endpoint after shape checks (`src/app/actions/api-keys.ts:158`); it cannot prove the supplied credentials work. A private read must establish connectivity.

### 5. Reconcile deployment and migration instructions

The repository contains Next.js frontend, FastAPI, and two Python execution runtime paths, with Railway manifests/Dockerfiles and a Vercel-hosted public website. Documentation disagrees about service count, configuration, and migration coverage. There are 29 SQL files through 026 including repeated prefixes; do not replay them blindly. Some frontend API URLs default to localhost. Inspect current deployed configuration and migration state before choosing a restart procedure.

## Proposed next order

1. Establish the two cloud co-head sessions, single dispatch owner, and shared short project/state records using the supplied playbook. Keep product builders unassigned until file ownership and first tickets are concrete.
2. Independently verify the above high-risk findings and local Fable commit. Keep review separate from implementation.
3. First implementation tickets: account-scoped risk settings; explicit financial-data errors; execution mode/fill identity/partial-fill/exit accounting. Keep shared Python execution/accounting changes in one owner lane.
4. Inventory existing service state and exchange read-only access. Restore database access only with a verified plan that prevents an old live daemon from resuming against it unexpectedly.
5. Reconcile historical records and run recorded-data/shadow checks. Define the intended first product milestone with both founders before a wider redesign or SaaS expansion.

The initial assessment supports preserving much of the product and concentrating the rebuild on execution/accounting correctness and trustworthy operational state. It does not establish strategy profitability.
