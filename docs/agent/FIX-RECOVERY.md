# Exact local fix recovered

On 2026-09-06, the user-authorized Mac read succeeded at `/Users/costaxanthos/conductor/workspaces/neutralis-ai/orchestration-workspace`. Astra exported the original commit and patch without changing that checkout.

- Commit: `ad37071ae6bbc4a31289f9e662388c50e92ac3d3`.
- Parent: `d524b5a75643df5f508c068e3c4fb930ba54b4eb`.
- Tree: `e83cb4b7f5c91396ca58bbcb19e8e2e25e54d057`.
- Exact patch SHA-256: `668da51d0ef1036d43bf62ec1eb2301c9e510c0be4a385808bfd2b93a748ef28`.
- Bundle SHA-256: `aa56fb304a6ce8101ddc757ee5874a48139389f68c8de5bcf6af7e6fd14bb653`.

Astra verified the raw commit object's hash, applied the exported patch to a temporary Git index based on its exact parent, and confirmed the resulting tree matches the original commit. The exact commit is preserved at local `refs/recovery/neutralis-ad37071`. The bundle verifies and declares the original parent as prerequisite. No source working tree was changed, no branch was merged or renamed, and no repair SQL was executed. These are provenance checks, not a claim that regression tests or production repair passed.

The fix changes event-loop result tagging, portfolio fill/position matching, storage paper/live identity, regression tests and an opt-in audit/repair SQL file. Its code must be reviewed as source; the SQL must never be executed as a check. The arbitrage lane receives the exact bundle for a detached read-only audit worktree. Frontend and Robinhood branches keep their existing source bases until a separately coordinated integration; do not cherry-pick/apply the patch twice.

Artifacts: [original patch](artifacts/ad37071-original.patch), [exact commit bundle](artifacts/ad37071.bundle), [verification receipt](artifacts/ad37071-recovery.json). These records and artifacts are local and unpublished.
