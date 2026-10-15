# Lane ownership preflight

Requires Node.js 20 or later. No package install is needed for this helper.

```sh
node --test scripts/check-lane.test.mjs
node scripts/check-lane.mjs profile.json workspace.json session.json
```

Run from the starter's root. Exit 0 means the supplied facts match the approved profile; 1 denies validation; 2 means invalid usage or unreadable/malformed JSON. A caller must stop on every nonzero exit.

## Inputs

These are illustrative schemas, not real IDs or a ready-to-run profile. Create the profile only after the founder approves the destinations. Do not derive its founder or allowlist from the very target you are checking.

`profile.json`:

```json
{
  "founderCreatorId": "FOUNDER_CREATOR_ID",
  "repoUrl": "https://github.com/OWNER/REPOSITORY",
  "projectId": "PROJECT_ID",
  "allowedPairs": [{ "workspaceId": "WORKSPACE_ID", "sessionId": "SESSION_ID" }],
  "forbiddenWorkspaceIds": [],
  "forbiddenSessionIds": [],
  "maxMetadataAgeSeconds": 60
}
```

`workspace.json`, normalized from freshly resolved trusted workspace metadata:

```json
{
  "id": "WORKSPACE_ID",
  "creatorId": "FOUNDER_CREATOR_ID",
  "repoUrl": "https://github.com/OWNER/REPOSITORY",
  "projectId": "PROJECT_ID",
  "state": "ready",
  "fetchedAt": "YYYY-MM-DDTHH:mm:ss.sssZ"
}
```

`session.json`, normalized from freshly resolved trusted session metadata:

```json
{
  "id": "SESSION_ID",
  "workspaceId": "WORKSPACE_ID",
  "fetchedAt": "YYYY-MM-DDTHH:mm:ss.sssZ"
}
```

`fetchedAt` is a caller-observed timestamp added after fetching, not an assumed provider field. Use an actual canonical UTC ISO timestamp. The session shape is an input contract for this helper, not a claim about the provider's response schema. Resolve field mappings using the current host CLI/API documentation; never fill missing ownership data from chat memory.

Exact strings are compared, including repository URL casing and any `.git` suffix. Choose the provider's verified representation in the approved profile; a mismatch is a denial, not an invitation to broaden matching. Missing fields, wrong creator/repository/project, crossed or forbidden pairs, stale/future metadata, conflicting allowlists and non-ready workspaces fail closed.

The creator-based policy intentionally denies a workspace created by a different founder even when someone else can technically access it. Any broader legitimate team access needs an explicit policy revision, not an exception invented by the agent.

## Security and coverage limits

This is a read-only consistency check. It cannot prove that metadata files are authentic, that the founder approved the profile, or that a caller will honor the result. Protect the profile, use trusted fresh lookups, enforce this check inside the messaging path and scope credentials separately. An offline green result does not authorize a send, prevent concurrent writers, or prove a task is in scope.

It does not fetch metadata, create sessions, send messages, watch a queue, wake a sleeping VM or restrict tools. Those integrations are deliberately not installed by this starter. The tests use synthetic data, not live workspaces.
