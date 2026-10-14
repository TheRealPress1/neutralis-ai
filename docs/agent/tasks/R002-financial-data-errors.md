# R002 — Honest financial-data errors

Status: proposed lane outline, not dispatchable. No owner/workspace/budget assigned. Await R001's test-harness contract if shared setup is needed.

- Outcome: failed account-stat queries cannot appear as trustworthy zero exposure or P&L. A successful empty account may display zero; loading, failure and stale prior values must remain distinguishable.
- Reference baseline: `d524b5a75643df5f508c068e3c4fb930ba54b4eb`.
- Proposed ownership: `src/app/api/dashboard/route.ts` stats path only; `src/app/dashboard/components/StatsBar.tsx`; `src/lib/api.ts` stats fetch only; dedicated frontend tests. Shared type changes require a reviewed contract before dispatch.
- Required proof: independently fail each stats query; successful empty data; true numerical zero; initial fetch error; failed refresh after success; recovery. API must return an error response on query failure, and UI must not silently retain a stale figure as current. Preserve user scoping and avoid leaking backend details.
- Exclusions: historical SQL repairs, P&L formula redesign, unrelated endpoint sweep, restored Live section, billing/product redesign, daemon or exchange access.
- Pending before dispatch: exact API/UI error contract, responsive states/viewports appropriate to the small UI delta, isolated builder assignment, frozen tests and peer challenge.
- Stop boundary if approved: PR open, no merge/deploy.
