# Investment-team runtime hosting — 2026-09-07

Private, read-only official-documentation research for Astra/Fable. No service, daemon, scheduler, account, credential, purchase, deployment, dataset download, implementation or Conductor message was created or changed. No additional agents were spawned. This preserves the current offline work and does not authorize Robinhood connectivity. Root separately investigates brokerage sessions, exchange calendars and local integration seams.

**Practical inference:** the existing website can display decisions, evidence, costs and controls while a hosted job performs the investment-team work. The browser need not remain open. Several analyst/PM roles can be calls within one bounded job; role count does not require an equal number of continuously running servers. Railway's scheduled container model is a straightforward candidate for that job. Hosting selection does not establish brokerage entitlement, authentication persistence or trade authority.

| Runtime pattern | Appropriate use | Material tradeoff |
| --- | --- | --- |
| Railway cron service | A scheduled research/decision cycle that finishes and exits | Saves compute between runs; coarse start timing and skipped overlaps require explicit deadlines and run records |
| Railway persistent background service | Continuous event/stream handling or genuinely long-lived monitoring | Active memory and other usage continue; an idle loop is still a running service |
| Railway service with Serverless enabled | An intermittently requested API | Traffic-driven sleep/wake and cold starts; unsuitable as the sole market-session clock |
| Vercel Cron + Function | Bounded scheduled work close to the existing web app | Plan-specific cadence/duration; possible duplicate and overlapping invocations |
| Vercel Workflow | A separately scoped durable, multi-step process | Managed replay/persistence and additional integration/billing considerations; not necessary merely to name multiple agent roles |

## Railway verified behavior

**Cron timing and completion.** Railway runs the service start command on a five-field cron schedule evaluated in **UTC**, with a **five-minute minimum interval**. Its documentation warns that starts can differ by a few minutes; minute-exact execution is not guaranteed. A scheduled process should close connections and terminate when its task is done. If the prior execution remains running, the next is **skipped**, and Railway does **not** terminate the prior execution automatically. The reviewed cron reference does not state a numeric maximum job duration; that is not an unlimited-runtime guarantee. [Cron Jobs](https://docs.railway.com/cron-jobs).

UTC schedules must account for local offsets and daylight-saving behavior. Setting a process timezone should not be presumed to change Railway's platform scheduler. For a market-hours design, our inference is to evaluate an authoritative session calendar in `America/New_York` inside the job and enforce the permitted window before meaningful work. A weekday cron expression alone cannot encode exchange holidays, early closes or exceptional closures. Root owns exact session verification. [Railway's official cron explanation](https://blog.railway.com/p/run-scheduled-and-recurring-tasks-with-cron).

**Restart policy.** The documented default is `On Failure`, maximum 10 restarts. `Always` restarts after any stop, `On Failure` after an error/nonzero exit, and `Never` disables automatic restarts. Paid plans allow configurable retry counts; Free/Trial restrict these options. A bounded job must select this deliberately: restarting a crashed process is not proof that its preceding API request failed or is safe to repeat. An `Always` policy should not be assumed compatible with intentionally exiting after a decision cycle. [Restart Policy](https://docs.railway.com/deployments/restart-policy).

Railway distinguishes an always-on background worker from a scheduled service that runs and exits. Leaving an in-process scheduler, database pool or polling loop alive defeats the intended cron completion behavior. Neither packaging choice independently provides end-to-end exactly-once decisions or brokerage actions. [Cron, workers and queues guide](https://docs.railway.com/guides/cron-workers-queues).

**Serverless / auto-sleep.** The reference detects inactivity from outbound packets, including database connections, telemetry, private-network calls and responses. It describes a five-minute inactivity threshold sampled periodically, producing sleep roughly **5–10 minutes** after the last traffic. Internet/private-network requests wake the service; the first request has a cold start and may receive a 502. Enabling the setting affects newly created containers and requires deployment to affect an existing running one. The cost guide simplifies the interval to ten minutes; this documentation difference means we should not promise an exact sleep deadline. [Serverless reference](https://docs.railway.com/deployments/serverless); [idle-cost guide](https://docs.railway.com/guides/cut-idle-costs-serverless).

Our inference: auto-sleep is a cost optimization for an idle request-serving component, not a substitute for scheduled starts or a safe market-close shutdown. Polling and active connections can keep it awake. Conversely, a sleeping process cannot rely on its own in-memory timer to wake itself. Any proposed use must preserve completed work and recoverable state outside process memory.

**Billing baseline and resources.** Current ordinary-service prices are RAM **$10/GB-month**, CPU **$20/vCPU-month**, egress **$0.05/GB**, and volume storage **$0.15/GB-month**, with compute metered by minute. Hobby is **$5/month**, Pro **$20/month**; those subscriptions include the equivalent resource credit rather than being added again to all usage. For example, Hobby with $3 usage totals $5; with $8 usage totals $8. These are advertised platform rates, not an audit of Neutralis's existing bill. [Pricing](https://docs.railway.com/pricing); [plan and included-usage details](https://docs.railway.com/pricing/plans).

A slept service accrues no compute charges, while storage is independently usage-billed. Lower active hours can reduce the variable compute component, but cannot be assumed to reduce the plan minimum, existing shared services, retained storage, market-data subscriptions or external model API bills. Measure the equities increment separately; do not multiply the subscription floor by each analyst role. [Idle-cost guide](https://docs.railway.com/guides/cut-idle-costs-serverless); [volume billing](https://docs.railway.com/volumes/reference).

Railway supports hard usage limits that **shut down workloads** when reached, and per-replica CPU/memory limits. A hard account/workspace limit is not a graceful trading stop or a per-strategy budget by default. No such settings were changed. [Cost Control](https://docs.railway.com/pricing/cost-control).

## Vercel verified alternative

Vercel cron schedules are also **UTC** and invoke Functions. Current cron documentation lists Hobby as once daily with execution anywhere within the selected hour; Pro/Enterprise allow once per minute with invocation within the specified minute. Cron itself is included; Function usage/pricing applies. Neither plan promises execution at an exact second. [Cron overview](https://vercel.com/docs/cron-jobs); [cron usage/pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing).

A failed cron invocation is not automatically retried. A second invocation can overlap a long-running first one, and an event can occasionally be delivered twice. Vercel recommends both locking and idempotency. This differs from Railway's documented skip-when-still-running behavior, but neither removes the application's responsibility for durable run identity and handling uncertain external outcomes. [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

**Current duration correction:** the Function duration page, updated August 24, 2026, lists Fluid Compute defaults of **300 seconds**. Hobby's maximum is **300 seconds**; Pro/Enterprise's generally available maximum is **800 seconds**. A supported-runtime beta allows **1,800 seconds**, configured per function, with exclusions including Secure Compute/Static IPs. Actual project/runtime eligibility was not checked. Avoid claiming Vercel supports only a few seconds or cannot perform any background work. [Maximum Function duration](https://vercel.com/docs/functions/configuring-functions/duration).

`waitUntil()` permits work after returning an HTTP response, but it shares the Function timeout; promises are cancelled if the function times out. Returning a response does not establish durable execution. [Functions API reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).

Vercel also documents Workflows that persist state, retry steps and resume across crashes/deployments. They execute through Functions and queues, with recorded inputs/outputs/state and their own usage dimensions. This is a viable category if durable orchestration later justifies it, not an instruction to add it now or a guarantee of exactly-once broker effects. [Vercel Workflows](https://vercel.com/docs/workflows).

## Implications for the founder's packaging question

The least complicated proposed separation is **website for viewing/control, bounded hosted jobs for analysis/decisions, persistent records for results and status**. This hosting review does not propose operating the investment team inside an interactive development session or assert any Conductor production-host capability.

For infrequent decisions, invoke the job only on the accepted cadence and let it exit; a slow strategy need not pay to keep its LLM team working all six-and-a-half trading hours. If the accepted strategy instead requires continuous within-session monitoring, that is a different runtime requirement to specify and cost explicitly. The website may remain available after hours without causing analyst calls on every page view.

“Only during market hours” should distinguish **when new discretionary activity may start** from **what reconciliation or monitoring must finish after it starts**. A scheduled process exit does not cancel an order accepted elsewhere. Any eventual live design needs a documented handling path for unresolved outcomes and session boundaries, using verified broker capabilities; those details are outside this hosting task. Even a purely paper job should re-check its deadline after long model calls rather than let a late result silently become an in-window decision.

Before any runtime implementation, co-heads should freeze one cadence, maximum cycle duration, late/overlap/failure behavior, state custody, calendar source and budget accounting. This note supplies hosting constraints only; it creates no scheduler or live-operation authority.
