# RH002 corrected-scope check — Fable co-head result (private)

Date: 2026-09-07 UTC. Full-document read of both artifacts.
- .context/RH002-RESEARCH-INPUTS-draft.md — 6315 bytes — sha256 b86fc5be4f9e6e6a470b7d8bdcecb4de7352c3e6840cf21cf53abea44361bc26
- .context/rh002-ticket-fable-revision.md — 8051 bytes — sha256 03fc55c35f1655ce0d1b5d87a23e3eead51cdddefed5f94f14aae5f03be80427

Verdict: CORRECT BEFORE SEND (two material, one minor). Inputs reference RH-DISCOVERY-1 is acceptable as written apart from the minor item.

M1 (ticket §3, material). §3 still instructs the connection lead to "Develop two peer PMs plus ... analyst roles", to "Specify role inputs/outputs, information freshness, source isolation, missing data, correlated agreement, deadlock/unavailable-agent behavior, decision expiration", and to "Compare the cheaper one-PM-plus-reviewer alternative". That is experiment/desk design authored by the lead, contradicting §4 ("do not create a competing universe/cadence/model/benchmark policy") and RH-DISCOVERY-1 (co-heads own the experiment; arms are one PM vs two-PM committee; sequential challenger deferred). Two documents would define the comparison differently.
Replacement §3 text: "**Team boundary mapping.** Take the founder's team direction and RH-DISCOVERY-1 as given; do not redesign roles, cadence, comparison arms or approval rules. Map each role in ROBINHOOD-INVESTMENT-TEAM.md to the documented Robinhood capability it would or would not touch, and state the broker-boundary consequences: analysts and PMs receive no account data or order tools; one execution owner; per-founder account authorization and records kept separate; any independently authorized personal desktop agent on the Agentic account is a second executor that the eventual single-executor policy must cover. Flag any conflict between the team design and documented Robinhood behavior with source and date. Joint approval covers every discretionary rebalance including sells; no emergency or automatic-exit authority is granted here, and any objective exit proposal belongs to the co-heads' later explicit paper mandate."

M2 (ticket §1 and §2, material reinterpretation). "Do not request the `/mcp/trading` path, even with GET" can be read to forbid the permitted well-known document, whose URL ends in `/mcp/trading` (https://agent.robinhood.com/.well-known/oauth-authorization-server/mcp/trading). Add one sentence to §1: "The permitted well-known metadata document URL retained in the RH001 receipt is allowed even though its path ends in `/mcp/trading`; the forbidden request is to `https://agent.robinhood.com/mcp/trading` itself and to any registration, authorization or token endpoint."

m3 (inputs I11 and ticket §5, minor precision). "separate input/output/cache tokens" should read "input, output and cached-prefix tokens, with cached counted as a subset of input (uncached = input − cached)" so the coverage memo cannot double-count.

Artifact-bound acceptance otherwise present: exact base 3dd6343, three named additive files, full diff/bundle/hashes, per-ID dated verdicts, public-source URLs/dates, onboarding steps described not performed, cross-family review routed to Fable, no historical review relabelled. No GET to the MCP path, no runtime/account/source edits.

## Recheck after corrections — 2026-09-07 (later)
- .context/rh002-ticket-fable-revision.md — 8177 bytes — sha256 1f4d9b05cb5881bce69ba2428c3a1883feaff597b4099e8d98a6115dcaba882b
- .context/RH002-RESEARCH-INPUTS-draft.md — 6600 bytes — sha256 64f074347f677f3dfe4aeeedb62d78e5478a2a8d1b0b4f6a75acd4c296a96f34
M1 closed: §3 is now "Team boundary mapping", forbids redesign of roles/cadence/comparison arms/approval rules; no "develop"/"compare the cheaper"/one-PM-plus-reviewer text remains; joint-approval and no-exit-authority sentences present. Astra's precision ("no direct broker account access or order tools; only permitted research and minimum approved paper/derived portfolio inputs through our boundary") accepted — PMs do need paper holdings/cash.
M2 closed: §1 names the permitted well-known URL explicitly and forbids only https://agent.robinhood.com/mcp/trading and registration/authorization/token endpoints; inputs doc line 26 mirrors it.
m3 closed: I11 states cached-prefix tokens are a subset of input (uncached = input − cached).
Verdict: PASS for docs-only dispatch (three additive files at exact 3dd6343; cross-family full-artifact review by Fable on delivery). First findings preserved above.
