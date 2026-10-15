# Neutralis design decisions

2026-09-07. Astra's implementation brief under Constantine's accepted Exchange choice, runtime direction and request to settle design. The accepted visual identity is settled; the new investment-page composition awaits its first prototype and Fable review. This document is not a claim of a deployed redesign.

## Keep the accepted foundation

The reference is combined UI003/UI004 commit `0167a6de8e13e3583356f14cc5b724a17e4ec269`. Use its cool paper, dark ink and blue palette, clear ledger rows, strong typography and direct navigation. Actual source tokens include paper `#e1e9ee`, ink `#132d46`, blue `#235b8a`, positive teal `#14636a` and negative plum `#8a365e`. Use the accepted source recipes rather than recreating them from this short list. Root statically checked `exchange.css`, `integrated.css` and `ExchangeFrame.tsx` at that exact ref.

Keep the interactive market-art front page. The investment workspace belongs inside the operating desk. No new identity, warm accent palette or marketing funnel is commissioned. The original Exchange owner remains the sole UI writer, and original accepted source/evidence remains frozen.

## What the investment view must make clear

The first screen should answer five questions: which owner and paper arm am I viewing; how current and complete is the research; what portfolio change is proposed; do the required managers and controls accept that exact proposal; and what did the research cost?

| Surface | Information that deserves space | Detail available on demand |
| --- | --- | --- |
| Desk summary | Owner/arm, research cutoff, decision status, connection state, cost completeness | Snapshot version and why the next step is unavailable |
| Research register | Company, thesis summary, evidence completeness | Cited facts, contrary evidence, unresolved claims and observation times |
| PM decision | Final proposal version, each required PM's stance and reason | Initial independent briefs and changed-version history |
| Risk result | Clear accepted/rejected/unknown state and exact reason | Displayed mandate limit, proposed value and required missing input |
| Cost record | Known subtotal, unknown components, shared research versus arm work | Token usage, rates, allocation and failed-call costs |

The two-PM arm keeps its own approvals and paper snapshot. One-PM is a separate comparison arm; absence of a second approval cannot silently change the configuration. Neither approvals nor figures can migrate across owners or arms. A proposal change invalidates the prior version's displayed approvals. Show unavailable data as unavailable, and distinguish a known zero from an unknown amount.

Do not fill the first screen with a transcript. Research and PM discussion are supporting evidence accessible from the decision. The product should let Constantine inspect the team without requiring him to orchestrate each analyst manually. Conductor remains useful for deeper discussion and development.

## First reviewable artifact

UI005 proposes a self-contained local HTML prototype with fixed synthetic research, approval, risk and cost scenarios, desktop/mobile behavior and keyboard navigation. Its persistent design-preview label and disconnected broker state must be visible. It demonstrates the proposed information architecture; it cannot authorize orders, create genuine PM approvals, run models or imply a paper ledger exists.

That ticket remains draft and undelivered: the new Fable scope-review message stopped before sending because current Conductor metadata no longer verifies the expected Neutralis project. No product writer has begun this addition. A separate internal GPT draft critique is supplementary and cannot stand in for Fable's review.

After reviewed EQ001 output exists, a later narrow projection/integration ticket can bind the design to real offline records. Actual route names and components belong to that ticket. Accepted UI003/UI004 publication remains separately held for the existing Railway trigger preflight; the founder's earlier publication authorization is preserved.
