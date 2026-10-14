# Investment desk: proposed website read contract

2026-09-07. Astra, proposed semantics after a bounded GPT contract challenge; no implementation assignment. This specifies how the eventual website can consume the accepted EQ001 requirements without pretending UI005 fixtures are research results. It assigns no writer, route, persistence implementation or runtime. EQ001 has not delivered an output schema; its original owner and host WAF hold remain. UI005 composition acceptance is pending.

References: accepted EQ001 ticket SHA256 `ebe264cccbd411607e19e54d2f63990243b603726e3f650a6541ad390599b991`; UI005 `3e47e3a34855d61de751275ac3fe5cbe7fee8ae7`; `.context/investment-desk-projection-inventory.md`. Existing dashboard decisions and browser refresh timestamps are not EQ001 research receipts.

## One owned result, with explicit evidence

The server resolves the authenticated founder before reading. An arm selector narrows that owner's allowed arms; it never selects the owner. PM A/B are decision actors, not account owners. A result from another owner or arm is denied before any title, memo, count or identifier reaches the browser. Shared research may be referenced only through an explicitly permitted projection with verified rights; shared market facts do not share private holdings or cost records automatically.

A read returns one of: available result; no result for the authorized selection; unavailable/invalid result. Empty is possible only after a successful authorized read. Read failure cannot become an empty portfolio, zero cost or a current prior result. If a prior valid result is retained for display, its original identity and times remain visible with the new read failure.

An available result binds an immutable manifest to the producing source and schema version, original owner/arm, decision receipt, exact proposal, mandate, packet, memos and holdings versions. The server verifies required references, content hashes and matching ownership before publishing a coherent view. It never combines the latest proposal with older approvals, holdings or risk receipt. Unknown schema or incomplete/inconsistent references yield an unavailable/invalid result. The later implementation ticket must pin the actual accepted producer fields, serialization and hash rules; this note creates no competing EQ001 wire format.

Any displayed cost summary separately binds its cycle, exact call records, model/configuration IDs, dated rate table and declared shared allocation, with verified owner/arm attribution. A new decision cannot silently inherit a prior cycle's price or another allocation. Missing or inconsistent cost provenance makes costing unavailable independently of an otherwise valid decision. A later completed pricing record needs its own version and valuation time; it cannot rewrite the original usage or decision receipt.

## Visible meaning

| Website element | Required meaning |
| --- | --- |
| Research | Cited facts and original availability/capture/cutoff instants, required gaps and distinct unverified analyst judgment. Memo count does not imply data completeness. Source bodies appear only if their display and downstream rights permit it. |
| Proposal | Complete target including cash, bound input versions and deadline. Changing a bound value changes proposal identity. Weight-only inputs show weights; no inferred dollar balances or share quantities. |
| PM decisions | Roster actor and exact proposal-version acceptance/rejection with recorded time. Two-PM approval requires distinct assigned actors accepting that same version. No fallback to a different decision arm. |
| Controls | Complete admission result and every recorded reason, with evaluation time. A subset of passing risk checks cannot produce a ready badge when evidence, approval or deadline checks reject. |
| Cost | Model subtotal with pricing completeness; all failed and successful chargeable calls, shared allocation and arm-only cost separately. Missing required rate means unknown total, not a partial total labelled complete. Hosting/data expenses remain separately unknown until their own record contract exists. |
| Provenance | Clearly labelled synthetic/offline result versus later admitted research. Passing EQ001 protocol checks is not a paper fill, return, profitability result or broker instruction. |

Read time, source availability, research cutoff, holdings valuation, decision evaluation and result production are different clocks. Display each relevant source time; browser refresh never advances it. A receipt records admission at its evaluation instant. Once the recorded deadline passes, show it as expired for new action without rewriting the historical receipt. The browser cannot certify that inputs remain actionable; any later action must be freshly checked at its trusted boundary.

Job execution, decision admission and read availability are separate states. A completed research job may produce a rejected decision; a failed call need not imply that an already published result vanished. EQ001 currently defines neither hosted job lifecycle nor scheduler health, so last/next scheduled run, attempt, heartbeat and missed trigger remain unavailable until an actual job contract provides them. A loaded page never implies a healthy worker. A cycle label is not a durable job identity.

## Actions and integration proof

This read contract grants no connect, start, approve, pause, trade or disconnect action. UI action controls need their own accepted server behavior; explanatory prototype controls remain clearly illustrative. Broker connection state must come from its own owner-bound domain and remain separate from research readiness.

After accepted EQ001 output delivery and composition acceptance, a narrow integration ticket can pin that exact schema and the sole Exchange owner's component/read boundary. Verification must cover an authorized coherent result; cross-owner and cross-arm denial; mismatched proposal/approval; missing manifest reference; successful empty versus failed read; stale retained result and passed deadline; incomplete pricing; and weight-only display. A read-only UI proof may use declared synthetic producer outputs, but must label them as such and cannot certify hosted scheduling, persistence, real data rights or broker access. No publication or existing Railway/database hold changes here.
