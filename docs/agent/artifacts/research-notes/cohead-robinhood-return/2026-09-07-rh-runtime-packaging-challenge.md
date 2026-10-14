# Robinhood runtime packaging — co-head challenge (Fable, private)

Date: 2026-09-07 UTC. Design opinion only, built on accepted RH002 bcb63a2, RH001 3dd6343 and the EQ001/ETF planning artifacts. No browsing, code, credentials, MCP/account calls, service start, purchase or deploy.

## Recommendation
Accept the simple packaging with one structural change and several gates.

- **Vercel website = owner control and research desk.** Owner-scoped read views plus a small action set (§3). No order entry, no credential entry, no model calls from the browser.
- **Railway = one lightweight coordinator, split into two roles with separate secrets.** A *research job* (holds model-provider keys, never broker tokens) runs bounded analyst/PM inference only at registered decision instants. An *executor job* (holds the broker token envelope from RH001, never model keys) runs the paper ledger now and, only under a later live mandate, order submission and reconciliation. Same host is acceptable only as separate processes with distinct secret scopes; this is RH002's single-executor boundary.
- **Supabase = owner-scoped durable state**: decision receipts, approvals, gate results, paper ledgers per arm, cost records, connection metadata, worker heartbeats. Encrypted token envelopes only; never raw tokens in browser payloads or logs. Two founders → two connection records and two ledgers; shared research packets.
- **Conductor = development only.** Not a runtime dependency; may inspect sanitized artifacts.

Weekly or monthly strategies need two instants per cycle: decision capture after close (21:00 ET per the ETF contract) and fill observation at the next official open. The worker is idle otherwise; no per-minute model loops. Prefer host scheduled jobs if available; otherwise one small always-on process with idempotent durable-entry semantics (the ARB004/005 pattern) so restarts never duplicate a decision or order.

## Session and clock gates
Regular session is 9:30–16:00 America/New_York (founder's 16:30 guess corrected); early closes end 13:00. Use the XNYS calendar with DST and holidays, never hardcoded hours. Four independent gates:
1. **New-order gate**: regular session only, and only for a registered live mandate. Extended-session orders require documented connector support; none is assumed.
2. **Open-order reconciliation**: at open, after close, and after any restart, regardless of whether new orders are permitted.
3. **Token lifecycle**: refresh ahead of expiry on its own schedule; fail closed; a refresh failure pauses new orders and raises a website notice.
4. **Post-close evidence**: fills, positions and cash snapshot after 16:00 and again after settlement, written as immutable receipts.

## Material caveats
- Custom-client acceptance, redirect registration, scopes and entitlements remain unverified (RH002); nothing here assumes the connector works before owner onboarding evidence.
- A founder's own desktop agent connected to the same Agentic account is a second executor; the single-executor rule must be a founder policy recorded before any live mandate.
- Paper first for months; live enablement is a separate mandate with kill state, per-cycle cost ceiling and capital limit.
- Inference cost is API spend, separate from development subscriptions; dated rate table and hard per-cycle ceiling with automatic stop.
- A "live" indicator must derive from worker heartbeat plus last receipt age, not from a database subscription (the earlier dashboard lesson).
- The website never displays a complete NAV the ledger has withheld.

## Minimal website fields and actions
Fields: connection state per owner (not connected / awaiting authorization / verified with last allowed read time / expired / unavailable), account label masked; registered strategies (id, cadence, next decision instant, mode paper/live); last decision receipt (proposal id, approvals by actor role, gate pass/reject reasons); per-arm ledger summary (known-assets subtotal, available cash, unresolved claims count, incomplete spans, dust); cost this cycle and month (input/cached/output tokens, dollars if a rate table exists, else "unpriced"); worker heartbeat and last run outcome; restatement and correction notices.
Actions: approve or reject a pending proposal when a human step is configured; pause a strategy; kill switch (stops new orders, never stops reconciliation); acknowledge a restatement; local disconnect (labelled as local only). Nothing else.

## Next staged evidence, each separately scoped
1. EQ001 foundation delivered and reviewed (currently WAF-blocked).
2. RH003 source/rights contract for packet inputs.
3. Runtime spike: scheduler and heartbeat on the host with a no-op job writing to Supabase; no broker, no model.
4. Paper runtime: research job on fixture packets with cost records; executor job on the paper ledger.
5. Owner onboarding with read-only verification under its own authorization.
6. Executor with order review only, then placement under a live mandate. Each is a new ticket.
