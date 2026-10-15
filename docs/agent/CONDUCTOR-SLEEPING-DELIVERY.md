# Existing sleeping-workspace delivery reconciliation

Accepted by Astra on 2026-09-07 after Fable peer challenge and independent exact-wrapper verification. This addresses two already authorized, fully prepared coordination messages; it grants no product, account, paid-service or publication authority.

## Evidence

The pinned imported `playbook/scripts/check-lane.mjs` treats every workspace state other than `ready` as a validation error. Its original source remains byte-identical, SHA256 `8153ee78d8199486d7c16ee5243c4cff4d95b2d696e89f3b25e196413f3d7bf8`. Earlier RH002 and ARB005 correction attempts stopped at this local check; Conductor's message endpoint was never called. Those were not host rejections or automatic approval-review rejections.

[Conductor 0.83.0 release notes](https://www.conductor.build/changelog/0.83.0-auto-port-forwarding), August 27, 2026, explicitly document that a message wakes a sleeping cloud workspace and is delivered. Root independently read that primary source. The installed CLI at `/conductor/bin/conductor-cli.js:20674` sends message creation directly to `POST /v0/sessions/{id}/messages`; no readiness check appears in that client operation. The public OpenAPI does not provide a separate sleeping-workspace wake endpoint. These facts support trying the authorized message itself; actual delivery still needs its receipt and destination verification.

## Narrow current policy

For the two messages below, the local wrapper may send once after either an ordinary successful pinned validation, or the documented sleeping-state reconciliation. The latter requires the actual host state to be exactly `sleeping`, with the raw pinned validation reporting exactly one error, `workspace is not ready`. Every creator, repository, project, workspace/session association, allowlist, denylist and freshness check must pass. The wrapper additionally pins the intended session, workspace, model, and an idle/working session status.

Never relabel sleeping metadata as ready or claim the imported validator returned PASS. Retain the raw result and explicit basis in the receipt. Archived, stopped, starting, unknown states and any additional validation error deny the operation. No new destination, session, writer, model or automatic retry. The original unused message IDs remain fixed. A durable local attempt marker is written before invoking message creation; an uncertain result must be inspected by message ID instead of resent.

Only these existing prepared root dispatches use this reconciliation:

- RH002 documentation/public-discovery ticket: owner `6b3800cf-a445-4f3c-a668-ea03f6d59c41`, workspace `cbda5480-4b47-4ffb-81af-186d42414dfc`, message `615c3dbf-ca0f-46e4-b0c6-d5d6d567b3cb`.
- ARB005 candidate01 bounded corrections: owner `50ea0c8e-5888-4d14-9f42-3c1ade31d33e`, workspace `381b00ed-cf4a-4c8c-9ab8-090faad31cc0`, message `6d383097-55ad-4347-9315-64f34f265bf8`.

The artifact is `.context/send-prepared-sleeping-lane.mjs`. Prior failed-attempt evidence remains preserved. This is a documented update to the root coordinator's lifecycle assumption under existing founder authorization, not a change to the imported playbook source or a blanket callback rule. Existing callback instructions still apply until separately updated. No action follows merely from writing this proposal; record review and actual receipts below.

## Acceptance and execution boundary

Returned Fable independently verified the primary changelog and installed client and found no missing authority; his requested exact-state/error match, pre-existing message check, no-retry behavior, destination custody and explicit policy attribution were reconciled. The [independent concrete wrapper addendum](reviews/CONDUCTOR-sleeping-delivery-gpt.md) verifies exact wrapper SHA256 `fdfdea6ccef773d8ea201f79a918baf109b6026de1f291be0c8e15bc485abcba` with fifteen offline probes. Lookup requires exact CLI HTTP404; all other lookup results deny. A lookup absence is not sole proof of non-delivery. Payload hashes are fixed per message and verified bytes are sent through stdin, so no second mutable-file read changes the approved content.

Only ARB005 correction content is currently eligible. Its SHA256 is `637ff3a88e449c493a0729dece36dc3d9c4f12cea7f71da5e0f784c48d5e9141`. RH002 has a separate substantive Fable ticket correction pending; no RH send follows until complete revised content is reviewed and its exact hash is explicitly repinned. The original imported helper remains unchanged; this current coordinator policy supersedes only its ready-before-message lifecycle assumption for these two root dispatches. All recipient source custody and product scope checks remain required.

## RH002 corrected-content acceptance

Returned Fable read both complete corrected artifacts and returned [PASS](reviews/RH002-scope-fable.md), preserving first findings. Root verified draft ticket SHA256 `1f4d9b05cb5881bce69ba2428c3a1883feaff597b4099e8d98a6115dcaba882b` and input reference SHA256 `64f074347f677f3dfe4aeeedb62d78e5478a2a8d1b0b4f6a75acd4c296a96f34`, changing only their explicitly permitted accepted-status labels. Corrected full RH payload is 32929 bytes, SHA256 `eaf416430ef64691736548fc580fbce7d206117c429baf1c8fb3336ed1b80053`; the original unsent payload is preserved separately. Custody `.context/rh002-corrected-dispatch-content-custody.json` names all four complete supplied documents. Wrapper operational logic remains byte-identical to the reviewed fdfdea6 version except the single RH payload digest constant; current wrapper SHA256 `38e45a8fcadc71b7217708b7701cf7e013affda988dfa657e3422f1fa39f5445`. The content hold is resolved and exactly one existing RH message is now eligible. No broader lifecycle policy, destination or product scope changed.
