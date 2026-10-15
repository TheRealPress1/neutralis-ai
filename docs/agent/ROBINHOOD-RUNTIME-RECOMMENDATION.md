# Robinhood investment desk: proposed runtime

2026-09-07 UTC. Astra synthesis for Constantine's hosting and interaction question, using current primary documentation and returned Fable's design challenge. Research only: no runtime, paper experiment, connection, database or deployment was commissioned or performed by this note.

Founder acceptance, 2026-09-07: Constantine replied “Okay sounds good” to the complete recommendation. The website/Railway/Supabase/Conductor division is now the agreed architecture direction. The detailed runtime contracts, research cadence and budgets remain to be established; this acknowledgment does not itself start a connection, deployment or experiment.

Use the Neutralis website as the operating desk, Railway for scheduled work, and Supabase for authorized durable records. Continue discussing strategies and building/reviewing the software in Conductor. Neither an open browser tab nor this coding conversation should own the lifetime of a future investment job. This recommendation fits the previously accepted stack; it is not a claim that Railway is universally preferable to other providers.

## Proposed package

| Component | Responsibility |
| --- | --- |
| Existing website on Vercel | Owner sign-in; research briefs; portfolio proposals and approval status; paper/live labels; costs; last completed run, freshness and failures; explicit pause controls |
| Scheduled research job on Railway | Assemble permitted, frozen inputs; run analyst roles and one-PM/two-PM comparisons at the accepted cadence; apply deterministic checks; save versioned results |
| Later restricted broker service | Own one account-bound Robinhood execution path, authenticated lifecycle and reconciliation; accept only admitted versions; keep brokerage tokens inaccessible to research workers and browser payloads |
| Supabase, after its persistence scope is approved | Owner and arm isolation; small packet indices, decisions, approvals, cost and run records; later connection/order evidence. Licensed source files remain in permitted private storage |
| Conductor | Founder research dialogue, development, debugging and review; no requirement that a coding session stay active for production jobs |

Analyst and PM roles are bounded model calls within jobs; they do not each require a server. Paper research needs no broker credentials. Before a broker service is introduced, separate scoped identities and demonstrable secret access controls must establish isolation. Merely starting two processes on the same host does not prove it. Two founders have separate account/connection custody and potentially multiple experiment-arm ledgers, not a fixed count of two ledgers.

## Clock and workload

Regular U.S. equities trading runs **09:30–16:00 Eastern**, with holidays and some 13:00 closes. Use an authoritative exchange-session calendar and `America/New_York`; a weekday timer or fixed UTC offset is insufficient. September 7, 2026 is a NYSE holiday. [NYSE calendar](https://www.nyse.com/trade/hours-calendars).

Robinhood also documents extended and overnight sessions for eligible securities. That general retail capability does not verify our Agentic MCP permissions, tools or order-session parameters. Initial regular-session scope is a proposal, not an observed account restriction. [Robinhood extended hours](https://robinhood.com/us/en/support/articles/extendedhours-trading/).

Keep four responsibilities separate:

1. Research runs when the registered strategy needs fresh evidence. Weekly or monthly decisions do not imply continuous AI inference during every trading session. The proposed monthly ETF comparator's 21:00 ET cutoff belongs only to that proposal.
2. New discretionary orders require a current mandate, accepted proposal, fresh controls and an eligible session. Recheck deadlines after slow model calls; late results do not become timely decisions.
3. Outstanding orders and uncertain results need reconciliation independent of permission to start new orders. Closing the session, pausing a strategy or ending a research job does not cancel a previously accepted order or liquidate holdings.
4. Authentication lifecycle and post-session accounting run when their verified contracts require them. An unknown or stale connection blocks new activity. Do not hard-stop all operations at 16:00 or assume every uncertainty resolves by a fixed after-close deadline.

For infrequent research, prefer a scheduled job that finishes and exits. Railway cron uses UTC, has a five-minute minimum interval and can start a few minutes late. A still-running prior execution causes the next trigger to be skipped. Therefore start preparation ahead of critical windows, enforce run identity and deadlines, and expose missed runs. Do not depend on cron to submit at the exact opening second. [Railway cron](https://docs.railway.com/cron-jobs).

If an eventual strategy requires continuous session monitoring, use a lightweight background service for those checks and trigger expensive inference separately. Railway auto-sleep responds to traffic inactivity; it is not a market calendar or a guarantee of scheduled wake. [Railway serverless](https://docs.railway.com/deployments/serverless).

Vercel supports scheduled Functions and durable Workflows too. Its cron can overlap or duplicate invocations; Function duration depends on plan/runtime. It is a viable option for bounded jobs. Railway's container/job model is our proposed fit for the existing backend direction, not proof Vercel cannot run background work. [Vercel cron behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Function duration](https://vercel.com/docs/functions/configuring-functions/duration), [Workflows](https://vercel.com/docs/workflows).

## What the founder would see

The website should answer: What does the team recommend? What evidence supports it? Did the PMs agree on the same version? What did risk controls reject? What is held in each paper arm or verified account? What happened on the last run, when is the next one, and what has this cost?

Show verified connection/read freshness separately from worker health and portfolio completeness. Missing evidence is not zero P&L. A proposed pause control means stop new activity while retaining reconciliation. Acknowledging a correction must not rewrite financial facts. Local disconnect must be labelled local unless provider revocation is established. Exact action contracts and UI insertion remain future scopes with the existing frontend owner.

## Costs and remaining proof

Railway currently advertises $5 Hobby and $20 Pro monthly floors including equivalent resource usage, with usage above that billed additionally. The subscription is not added again to every included compute dollar. This is public pricing, not an audit of our bill or a plan-change recommendation. Scheduled runs may reduce incremental compute; they do not eliminate hosting minima, storage, data subscriptions or external model charges. [Railway plans](https://docs.railway.com/pricing/plans).

Fable's reported quota reset restores development/review availability. It does not establish production API credentials, rates or a free inference budget. Record actual per-role usage and cost; stop initiating new research when its budget is exhausted. Do not let a research cost cap terminate an outstanding broker reconciliation path.

Robinhood documents third-party MCP clients and desktop onboarding; account reads can span accounts while trading is restricted to the Agentic account. Those facts do not establish that Robinhood accepts our custom hosted client and callback, or that its actual schemas, entitlements and refresh lifecycle match our offline assumptions. Verify that specific client contract before committing to a hosted connection. [Agentic overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/).

RH001 remains an offline TypeScript domain with live access disabled; the root product checkout does not yet contain that reviewed broker subtree. RH002 is accepted feasibility documentation. EQ001 is an accepted synthetic research-foundation ticket whose dispatch remains WAF-blocked; it does not implement a paper ledger. No live/paper runtime exists as a result of these milestones.

Next proposed work is the data/rights and custom-client contract, plus completing the already scoped offline foundation when its host delivery block is resolved. A fixture demonstration, an actual paper evaluation, a hosted scheduler/persistence proof and owner-authorized read-only onboarding each need their corresponding scope. Existing Railway/UI and database holds remain. No fixed number of paper months or profitability verdict is accepted here, and arbitrage accounting code is not silently reused for equities.

Private evidence: `.context/rh-runtime-hosting-research-20260907.md` (Cicero, current official hosting sources), `.context/cohead-robinhood-return/2026-09-07-rh-runtime-packaging-challenge.md` (Fable, complete original design opinion). Fable accepted all four Astra corrections in `.context/cohead-robinhood-return/2026-09-07-rh-runtime-packaging-addendum.md`, SHA256 `92fd592342f9ebd8cbb6a1a551c200ebd356461e0debe1fee842ee5d8dfe2ebc`; root read it completely and verified its bytes. This synthesis and addendum supersede the original challenge's statements about an existing paper runtime, universal two-instant cadence and mandatory paper duration. Fresh verified request `21a6b695-f19d-4999-8012-2eec03ddc923` completed; Fable is idle, with no further task in flight.
