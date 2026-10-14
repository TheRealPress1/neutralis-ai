# Your reusable AI team

Prepared for Constantine, 2026-09-06. A portable starter extracted from the Moon Ops collaboration, not a replacement for that project's rules or an export of either model's internal memory.

## My recommendation

Use a **private GitHub repository named `agent-playbook`** for your reusable skills and workflows. Open a local checkout in **Obsidian** if you want a pleasant notebook for browsing, linking, and editing them. Keep **Conductor** as the place the agents run.

Think of it as three complementary tools:

| Tool | Its job |
| --- | --- |
| GitHub | Durable, versioned source that authorized new workspaces can retrieve |
| Obsidian, optional | Your interface for reading and editing the same Markdown files |
| Conductor | Astra and Fable sessions, isolated builders, messages, and reviews |

Obsidian stores notes as ordinary files, so the notebook does not lock up your instructions in an app-specific database. Open the playbook checkout as a vault; use ordinary Markdown links, not required Dataview queries or vault-only links. [Obsidian storage](https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data)

For this library, publish changes through Git. Do not add competing automatic sync writers to the same checkout. An optional device-sync service is not a substitute for review and version control. [Sync conflict guidance](https://help.obsidian.md/sync/troubleshoot)

Notion is an alternative if your priority is a web notebook. I would not make it the authoritative store for agent-readable files: its exports mix Markdown, CSV, and HTML depending on content. [Notion export](https://www.notion.com/help/export-your-content)

You do not need a vector database, a memory service, or a custom multi-agent app to start.

## What to save, and where

| Information | Example | Durable home |
| --- | --- | --- |
| Reusable skill | How to run a blind cross-family review | `agent-playbook/skills/` |
| Reusable workflow/template | Builder ticket, handoff, startup instructions | `agent-playbook/templates/` |
| Your approved preferences | Concise updates, show artifacts, ask before a major taste change | Private personal notes, separate from client facts |
| Project knowledge | Approved decisions, ownership, unfinished work | That project's `docs/agent/` |
| Evidence | Screenshots, test results, exact commit being reviewed | Committed evidence or durable artifacts linked from the project |
| Credentials and access | API tokens, OAuth grants, account permissions | Secret manager and per-environment authorization, never these files |
| Session scratch | Temporary builds, exploratory notes | `.context` or `/tmp`, never the only copy |

**Memory is what we learned. A skill is how to do something. A tool or MCP connection is what an agent can access.** Saving one does not create the other two.

A new session can read saved context and resume the method. It does not become the same conversation or inherit another model's private context automatically. This cloud workspace also cannot see your Mac's Obsidian vault. Files must be committed and checked out, uploaded, or delivered through an explicitly authorized connection. [GitHub checkout model](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)

## The team to recreate

```text
You
└── Orchestration workspace
    ├── Astra co-head: technical challenge and integrated acceptance
    ├── Fable co-head: decomposition, dispatch, continuity and verification
    └── Named builder lanes, each in a separate workspace
        ├── Shell/shared foundation
        ├── Feature A
        └── Feature B
```

These are two peer orchestrators with different responsibilities. Pick **one dispatch owner** so they do not issue duplicate or conflicting orders. The reviewer does not edit product code. You retain taste decisions and merge/deploy authority unless you explicitly delegate them.

In Conductor, implement the desk as **two sessions in one orchestration workspace**, with explicit messages and shared project records. Treat it as one coordinating desk, not one shared model context. Independent builders get separate workspaces and branches. Short read-only investigations can use internal subagents, which are not substitutes for isolated builder workspaces. [Conductor parallel agents](https://www.conductor.build/docs/concepts/parallel-agents)

The current catalog here lists Codex `gpt-6-astra` and Claude `fable-5-1`. Recheck `conductor model` in a new environment. Model names belong in the project profile, not permanently inside every skill.

MCP is a tool connection, not a memory store or automatic shared chat. Conductor loads the selected agent host's MCP configuration. Reconnect and test each required tool for each orchestrator; do not assume copying a Markdown file transfers credentials. The Conductor CLI can also create workspaces/sessions and relay messages without an extra MCP wrapper. [Conductor MCP](https://www.conductor.build/docs/reference/mcp)

## What is in this starter

- [Co-head orchestration skill](skills/co-head-orchestration/SKILL.md): ownership, spec challenge, dispatch and stopping rules.
- [Cross-family review skill](skills/cross-family-review/SKILL.md): evidence first, mechanical verification, disagreements and integrated acceptance.
- [Session handoff skill](skills/session-handoff/SKILL.md): survive retirement or a new session without copying the whole transcript.
- [Project profile](templates/PROJECT.md): scope, roles, references and permission boundaries.
- [Current state](templates/STATE.md): what is true now, with evidence and the next owner.
- [Task ticket](templates/TASK.md): outcome, allowed files, exclusions and proof.
- [Memory index](templates/MEMORY-INDEX.md) and [memory entry](templates/MEMORY-ENTRY.md): dated, typed, attributable notes.
- [AGENTS.md](templates/AGENTS.md) and [CLAUDE.md](templates/CLAUDE.md): thin startup entrypoints for both families.
- `scripts/check-lane.mjs`: an offline ownership/allowlist preflight. It does not send anything or install enforcement.
- [Lane preflight instructions](scripts/USAGE.md): required input schemas and tests for that helper.

The three skills are original extractions from our workflow. This does not redistribute Conductor's bundled proprietary skill or export your client data, secrets, raw chats, or every system skill available to this session.

See [validation and remaining setup](VALIDATION.md) for what was actually checked.

## Start a new project

1. Save this starter outside the disposable sandbox. Create the private playbook repository when you are ready; no repository has been created for you by this handoff.
2. In the new product repo, copy the project/state/memory templates to `docs/agent/`, preserving their filenames. Put task tickets under `docs/agent/tasks/`. Fill the project profile before dispatch.
3. Add the startup entrypoints at the product root. If `AGENTS.md` or `CLAUDE.md` already exists, merge the small additions without overwriting framework instructions or existing rules.
4. Bring only the selected skills into the project at a recorded playbook commit. For a few skills, explicit versioned copies are sufficient. Update them deliberately, not from an unpinned latest branch during a running task.
5. Create the orchestration workspace and the two sessions. Identify the founder, repository, actual workspace/session IDs, approved destinations and forbidden destinations from current metadata. Do not reuse Moon's IDs or infer ownership from a shared GitHub account.
6. Give each co-head the startup prompt below, with its own role. Verify they read the same profile/version and can exchange a harmless scoped test message before opening builder lanes.
7. Give each builder one ticket and its own workspace. Start with the smallest useful number of lanes; scale only where work is independent. Stop builders at PR open for review.

### Make the skills discoverable

Keep one maintained source in the playbook. Install selected project copies in the locations supported by each host:

| Host | Project skill path | Project entrypoint |
| --- | --- | --- |
| Codex | `.agents/skills/<name>/SKILL.md` | `AGENTS.md` |
| Claude Code | `.claude/skills/<name>/SKILL.md` | `CLAUDE.md` importing `@AGENTS.md` |

These are the current documented paths. Some bundled environments expose additional locations. Verify discovery in the actual new sessions; a file in an arbitrary `skills/` folder is not automatically installed. The shared `SKILL.md` format is portable, but tool names and host-specific metadata may need adapters. [OpenAI skills](https://learn.chatgpt.com/docs/build-skills), [Claude skills](https://code.claude.com/docs/en/skills), [shared startup instructions](https://code.claude.com/docs/en/memory#agentsmd)

You can use repo-relative symlinks if both hosts support them and the targets ship in the same checkout. Never rely on a link into the old sandbox or your Mac. With copies, record the source commit and compare installed copies when updating. Do not hand-maintain divergent Claude and Codex versions of the same policy.

Plugins can be a later distribution step. There is no plugin installer or MCP server bundled in this starter.

### Paste into each new co-head session

```text
We are starting a new project with two peer orchestrators, Astra and Fable.
Your role is [Astra co-head / Fable co-head].
Read AGENTS.md, docs/agent/PROJECT.md, docs/agent/STATE.md and the memory index.
Load the co-head-orchestration skill supplied with this project.
Do not assume access to the previous project's chats, credentials or filesystem.

Before dispatch, report the founder you serve, repository, your current workspace,
peer session, dispatch owner, allowed destinations and skill version.
Verify these against current metadata. List anything unresolved.
Do not create resources, spawn builder workspaces, merge or deploy yet.
Return a short proposed lane split and the first artifact-bound ticket for approval.
```

Replace the role in brackets. Once the founder approves a concrete split and budget, the dispatch owner may execute it within that scope.

## Keep memory useful

Give each retained note a date, type (`user`, `feedback`, `project`, `reference`), source, scope and status. Distinguish an approved decision from an agent suggestion. Keep an index pointing to the notes needed for the current task, not a demand to read the entire archive.

The dispatch owner maintains current state. Builders submit handoffs rather than simultaneously rewriting one shared status file. For decisions, record what the new ruling supersedes and who approved it. If the project uses numbered amendments, use that mechanism instead of rewriting its constitution in an unrelated feature PR.

After each PR boundary, decision or retirement: update state, link durable evidence, preserve the next action, and publish the approved change. Before resuming: check live commits and PR state. An accurate note from last week can be wrong today.

Keep personal memory separated by founder/account, then project. Never share one automatic memory directory between different founders. Do not import all old project rules into a new project: brand, donor commit, customer facts and ownership boundaries need fresh choices.

The important change is **a short maintained current contract plus task-specific skills**, not a longer always-loaded rulebook. Promote a demonstrated lesson into the relevant skill, test it on a small real task, and remove superseded instructions.

## Carry forward the lessons, not the accidents

- Preserve pinned clocks, fixture identities, reference commits and exact viewport dimensions when comparing screenshots. Five widths were a Moon acceptance choice; choose and record the next project's dimensions rather than silently inheriting them.
- A clean isolated screenshot is not integrated acceptance. Review the combined candidate at an exact commit before release.
- When reviewers disagree, reproducible evidence wins over either model's confidence. Keep the reviewer assignment stable while judging a builder candidate.
- Use one substantive cross-family review per new code head, then proportional delta checks for evidence-only changes. Model/cost budgets belong in the profile. Moon's Opus-verifier and cheaper workflow-agent choices are configuration, not universal requirements.
- Target wording carefully: a ban on newly added copy does not authorize a repository-wide sweep. For a requested full-page silence audit, enumerate the visible states separately.
- A draft PR needs its ready status changed before a normal merge. Check stacked PR bases against what has actually landed; retarget to `main` only when the intended dependency is on `main`, not merely because a branch still exists.
- Shared GitHub identity means `mergedBy` is not proof of which human or agent authorized an action.
- Recreate a retired page-master session in the same approved workspace at a PR boundary, using a concise charter, durable handoff path and open order. Confirm the replacement is ready and the old writer is stopped before it writes.

## Overnight operation and boundaries

Moon's reported overnight failure was an in-session schedule that stopped when the cloud session slept. The desk reports that an externally triggered API message woke it. Preserve that architectural lesson, **not an assumption that a 60-minute idle limit applies everywhere**.

For future unattended work, the platform owner should configure an external scheduler, such as GitHub Actions, with a scoped secret, bounded retries, duplicate-run protection and a freshly validated target session. Test wake-up in the actual environment. Scheduled Actions can be delayed; do not treat them as a precise clock. Grant `contents: read` when a job must check out a private repository rather than leaving its token permissions empty. [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)

The existing watcher/reboot scripts were not inspected or copied into this kit. They are migration candidates, not delivered, verified automation. Their paths, auth, project IDs and wake behavior must be reviewed before reuse.

Run the supplied lane preflight against freshly resolved metadata before a dispatch. It is a fail-closed validator, **not a permission boundary by itself**. A production messaging wrapper must call it on every operation, and credentials must be restricted to the intended account/project. Do not send to another team's workspace or use its data as an orchestration desk.

This kit has not created that wrapper, enabled a scheduler, installed skills, configured Obsidian, or created a new project. It is the portable starting material for those deliberate setup steps.
