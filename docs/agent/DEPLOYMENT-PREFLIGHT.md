# UI003 deployment mapping preflight

Read-only checks, 2026-09-07, by Astra and independent `/root/frontend_audit`. No deployment, restart, configuration change, secret read or trading/account request was performed.

Repository verified as private `TheRealPress1/neutralis-ai`. Fresh remote main and root checkout were `d524b5a75643df5f508c068e3c4fb930ba54b4eb`. GitHub records associate this source with both Vercel and Railway; a frontend main push must not be described as Vercel-only on current evidence.

| Component | Latest inspected GitHub record for d524 |
| --- | --- |
| Vercel | Deployment `4394983178`, environment named Production, success on 2026-04-17. Recorded URL: `https://neutralis-od2g3gcps-timetospammyline-7173s-projects.vercel.app`. |
| Railway API | Context `beautiful-beauty - API`, success on 2026-04-17. Project `d39f4099-bfc0-4199-bb2d-9dd86099ce3e`; service `fba888b8-5419-41fa-89fc-c579da5e4048`; environment `59b9c218-e96a-490f-93fc-6945373cb91b`. |
| Railway daemon | Context `beautiful-beauty - Daemon`, failure on 2026-05-23. Same project/environment; service `bc159ff6-ae20-4781-95fc-8f8f63204345`. |

These are historical hosting reports, not current process-health or serving-version observations. A failed deployment does not prove that an older daemon stopped. The founder confirms Kalshi/Polymarket previously connected and actually traded; current positions/process activity remain unknown.

GitHub receipt endpoints inspected: `/repos/therealpress1/neutralis-ai/deployments`, `/deployments/4394983178/statuses`, `/deployments/4394980756/statuses` and `/commits/d524b5a75643df5f508c068e3c4fb930ba54b4eb/status`. The inspected repository returned zero Actions workflows/runs and zero check runs; the hosting reports come from external integrations.

Tracked `railway.toml` documents multiple build targets from the repository and dashboard-selected targets. `Dockerfile` launches API, event daemon and Next targets. No tracked source-branch, automatic-deployment or watch-path settings establish which services follow main today. Read the Railway API/daemon services' current source branch, auto-deployment setting and watch paths before claiming publication isolation.

The cloud VM has no Railway CLI. A scoped Mac check found Railway and Vercel CLIs installed. `railway status --json` in the historical orchestration directory failed with expired OAuth (`invalid_grant`) and no linked project. No authentication files or variables were read. Constantine has a pending text request to run `railway login` on his Mac. After authentication, use the exact verified Neutralis project/service IDs; any needed local CLI link is not a service deployment.

The Vercel connector's read of the exact recorded deployment/team slug failed with `oauth_token_invalid_grant`, but a subsequent scoped Mac CLI fallback succeeded. Both `neutralis.ai` and `www.neutralis.ai` resolve in Vercel's current deployment metadata to `dpl_7UAPvLRFJ1kprekugojGUyMSp5Pr`, target production, READY with aliases assigned. `gitSource.sha` and `meta.githubCommitSha` both equal `d524b5a75643df5f508c068e3c4fb930ba54b4eb`, GitHub repository `TheRealPress1/neutralis-ai`, branch main. Project `neutralis-ai`, ID `prj_8KBr92skNmCaUeKrNSuuyuLfmXKR`, team slug `timetospammyline-7173s-projects`.

The read-only evidence used local `vercel inspect` for both domains and authenticated GET `/v13/deployments/dpl_7UAPvLRFJ1kprekugojGUyMSp5Pr`, filtered to deployment, aliases, state and Git identity. No runtime page, logs or environment endpoint was read. After publication, resolve both domains again and require their deployment source to equal the approved new main SHA; the mere existence of a new deployment is insufficient.

Railway trigger settings remain unresolved pending local CLI reauthentication. These access limits do not block offline implementation or review. Main publication is already authorized by the founder under UI003; do not ask for the same approval again. Track publication and actual hosting state separately, and do not inadvertently roll out trading changes through the frontend task.

Current [Railway autodeployment documentation](https://docs.railway.com/deployments/github-autodeploys) confirms connected-branch pushes can trigger deployment and describes per-service disable controls and watch-path filtering. No documented commit-message bypass was established in the inspected official pages. Do not invent a skip token as a substitute for checking actual trigger settings. A bounded metadata-only CLI/query recipe is being prepared without authentication/configuration changes; the installed Mac CLI currently does not recognize the newer `railway api` command, so that path also requires a compatible CLI or another verified metadata-only interface.

The CLI compatibility issue is now resolved without changing the global installation. A task-local official Railway CLI 5.49.2 ARM64 binary is prepared at `/Users/costaxanthos/conductor/workspaces/neutralis-ai/orchestration-workspace/.context/ui003-tools/railway-v5.49.2-arm64/railway` (workspace alias resolves to the `dubai` Mac worktree). The investigator verified the published archive SHA256 and GitHub immutable-release asset attestation, then checked version and `api --help`. This establishes tool provenance/compatibility, not service access. No login or authenticated Railway query ran. The metadata-only recipe is `.context/ui003-railway-readonly-recipe.md`; use its explicit task-local executable after login is restored. No user CLI upgrade is needed.

Root made one metadata-only authentication recheck using the verified task-local CLI and the recipe's exact Neutralis identity query. It exited1 with filtered `Railway authentication unavailable`; no project/settings response was returned and no login was attempted. The incompatible old CLI is therefore no longer the limiting factor. The pending Mac `railway login` action is still needed before service-trigger metadata can be verified.
