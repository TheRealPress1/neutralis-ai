# Fable bootstrap review

2026-09-06, Claude Fable co-head `e9a2da19-6038-4eb7-bb1e-a61f585f6fb6`. Reviewed product source at `d524b5a75643df5f508c068e3c4fb930ba54b4eb` and local draft R001 v1. This is a bootstrap challenge, not candidate acceptance or merge authority.

The scoped Conductor message passed the supplied lane validator against freshly fetched workspace and session-status membership metadata. Message ID `d8ec67a0-1eaa-4f38-81c4-6bb85f1fda43`; transcript result event `bea02a4f-01fb-4ac0-bf60-68ddd29abbe6`. Fable independently confirmed founder/repository/project/workspace, both co-head session identities, current commit and missing `ad37071` object. It accepted Astra as bootstrap coordinator and sole record writer; Fable remains read-only, with implementation dispatch only proposed.

Fable read all three linked skills and matched their hashes to the receipt. Its host initialization also lists all three as available skills. Astra read the same source files and verified both sets of symlinks. Fable made no edits or product assignments.

## Material challenge and disposition

1. R001 excluded profile provisioning while implying both users could edit profiles. Actual account rows remain unverified; Fable's statement that Gaspar has no row is not established by a database check. R001 v2 now states an existing owned profile as a precondition and makes missing-profile handling explicit.
2. The Python profile loader reads `WHERE is_active = TRUE AND user_id IS NULL`. Astra independently confirmed this source at `neutralis/profiles.py:167` and its use from configuration loading. R001 v2 limits its claim to action security; R003 owns account-specific effective risk propagation and associated tests before live readiness.
3. There was no frontend test harness. R001 v2 names Node's built-in runner, TypeScript transpilation of the actual actions, restricted mocked imports and isolated plus integrated build/check evidence. No new test framework is assumed.

The revised ticket is still draft and has not received a new approval. All product builders remain unassigned.

Fable also agreed the equities concept is feasible to investigate and proposed point-in-time data, realistic costs, later-period evaluation and forward paper decisions as the research boundary. This exchange establishes neither strategy profitability nor authorization for live execution.
