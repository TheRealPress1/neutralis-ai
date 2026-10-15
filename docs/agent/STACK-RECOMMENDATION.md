# Stack recommendation for the private platform

2026-09-07 — Constantine accepted this architecture direction with “Sounds good” after the role explanation. This records direction, not a migration or infrastructure purchase. Constantine confirms the previous Railway/Supabase/Vercel stack and prioritizes simple internal metrics and research/strategy quality.

Keep the three existing platforms. Their roles fit the expected workload; the verified source findings do not establish a reason to migrate providers.

| Role | Recommended location | Scope |
| --- | --- | --- |
| Website and internal desk | Next.js/React on Vercel | Simple balances, positions/exposure, P&L history, agent activity and clear operating/connection state; selected Shadcnblocks controls when useful |
| Background services | Railway | Existing Python strategy services, broker adapters and scheduled ingestion; use a separate research job/service for resource-heavy backtests so experiments cannot starve trading |
| Operational records | Supabase Postgres and Auth | Two users, strategy settings, experiment index/results, controls, order/fill records and small dashboard summaries; existing accounting defects still need correction |
| Historical research files | Ordinary private Supabase Storage initially | Original source files and frozen Parquet snapshots with manifests and an independent file backup; research data/access isolated from the trading environment |
| Research computation | Python plus DuckDB | Reproducible runs over frozen files; saved config/code version, ledger and results. Polars can be added only for a measured transformation need |

Railway documents both persistent services and run-to-completion scheduled jobs. Its default container disk is ephemeral, so durable history does not belong only on a worker filesystem or a disposable Conductor VM. Disable Railway's optional serverless sleeping for a service intended to run continuously. [Services](https://docs.railway.com/services), [sleeping behavior](https://docs.railway.com/deployments/serverless).

Ordinary Vercel Functions have finite request durations, including the current extended-duration beta. Persistent market connections and the existing daemon fit Railway's service model. This is a workload-fit recommendation, not a claim that Vercel has no background-workflow products. [Function duration](https://vercel.com/docs/functions/configuring-functions/duration).

Supabase supports file storage and S3-compatible access. DuckDB can query Parquet directly, preserving portability if the archive later moves. Given the latest simplicity preference, start with the existing provider for a modest pilot; the earlier [separate-store option](RESEARCH-OPTIONS.md) remains appropriate when archive size, download costs or retention requirements justify R2/S3. No provider or plan is purchased by this recommendation. [Storage](https://supabase.com/docs/guides/storage), [DuckDB/Parquet](https://duckdb.org/docs/current/data/parquet/overview).

Database backups exclude Storage file bytes, and ordinary Supabase Storage does not support S3 versioning. Frozen filenames and manifests need a separate restorable file copy. Choosing Supabase for the pilot does not remove that requirement. [Backup scope](https://supabase.com/docs/guides/platform/backups), [S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility).

The codebase already contains Next.js/React, Recharts/Motion, Python/FastAPI and Supabase integration. `railway.toml` and Dockerfile also retain a Railway frontend target; this is possible configuration, not evidence that two frontends are currently deployed. Before any later rollout, reconcile the actual service targets and deployed revisions against the founder's intended Vercel frontend/Railway backend split. No live platform configuration, daemon health, account connectivity or current costs were audited here.

Independent read-only baseline audit by `/root/frontend_audit` confirms that Next server routes already authenticate Supabase sessions, Python uses its Postgres database and the dashboard subscribes to Realtime. Future research-file storage and DuckDB/Parquet are additions, not currently implemented integrations. Existing research calls go directly to `NEXT_PUBLIC_API_URL`; Python backtest handlers lack an authentication dependency, and optimizer progress is process-local memory. A later research-service ticket must define the private authenticated boundary and durable job/results storage before exposing that flow. Existing health endpoints also need to distinguish process response from dependency/engine readiness. Those are implementation contracts to fix within this stack; no provider migration is implied.

Illustrative future flow: the website submits a bounded experiment request; Supabase records its settings/status; a Railway research worker reads a frozen Parquet dataset and runs Python/DuckDB analysis; the worker saves results; the website displays progress and metrics. Closing the browser does not own or terminate the job. This is the proposed behavior, not a claim about the current request-bound backtest implementation.

Do not add a warehouse, distributed queue, vector database, orchestration framework or multi-provider service layer without a concrete workload requirement. The near-term work is dataset quality, reproducible backtests, realistic costs and execution correctness. Research/paper/live environments must remain distinct; keeping the current stack does not authorize restoring the old database or enabling trading.

Constantine explicitly clarified that Conductor is the IDE powering coding sessions. Keep it outside the deployed application architecture. This recommendation does not add a new production agent-hosting role to Conductor.
