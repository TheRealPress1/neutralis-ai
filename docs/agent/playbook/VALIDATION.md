# Starter validation

Checked 2026-09-06 in the Moon Ops orchestration sandbox. This is a package receipt, not proof that a new project is configured.

- Three `SKILL.md` files passed the skill-creator frontmatter/name validation.
- The read-only ownership helper passed 59 synthetic Node tests, including wrong founder/repository/project, crossed or forbidden destinations, missing fields and stale metadata.
- An independent agent simulated a stale handoff, foreign-owned target, pending CI, old screenshots and missing Claude skill installation. It correctly held dispatch/merge and reported unresolved setup. Its two documentation findings were corrected: explicit screenshot source-tree provenance, and visual-first review limited to visual changes.
- Conductor CLI help and model catalog were inspected. Current observed model IDs include `gpt-6-astra` and `fable-5-1`; recheck in the destination environment.
- Official OpenAI, Claude, Conductor, Obsidian, GitHub and Notion documentation informed installation/storage guidance; supporting links are in START-HERE.md.
- Fable challenged the kit's ownership, review, scheduling and portability assumptions. Moon-specific values remain examples/configuration, not universal skill rules.
- No product source, tracked repository configuration, accounts, credentials, MCP installations, schedules or deployments were changed. No new builder workspace was launched.

Still to do in a destination project: founder-approved profile, actual skill installation/discovery in both hosts, trusted metadata normalization and enforcement in the messaging path, scoped credentials, and a harmless end-to-end startup test. Watcher/reboot scripts and external scheduling are not bundled or tested here.
