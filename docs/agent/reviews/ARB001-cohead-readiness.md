# ARB001 — co-head readiness review

2026-09-06. Fable co-head led independent source/venue verification and directly coordinated corrections with the existing arbitrage lead after fresh lane validation. Astra and Fable agreed the conclusions below. Planning package is local, documentation-only, at `ca2b3e62f5c186468ba133ef1b38fe5cb00097f7`, following `173421bdbd63e7d843e4b57f5cc006e8cb7a6ef0` and `f6d4a582bc4eff731fd0f067dd7d747aab81b76c`. No implementation ticket was dispatched.

## Verified outcome

Original recovered `ad37071ae6bbc4a31289f9e662388c50e92ac3d3` remains intact in root and arbitrage recovery refs. The planning branch remains based on d524b5a; the recovered source is used only in detached audit worktrees. Original patch was not reapplied to any product branch.

Fable independently reproduced source findings and reports 64 passed / 1 failed across the offline suite at exact ad37071 with sockets blocked. The failure is the historical directional duplicate-position test; it remains an unresolved test result, not a green full-suite claim. This VM uses Python 3.9; the full requirements file does not install there, so only pytest, psycopg and httpx were installed for that reproduction. The lead separately reports 30 focused tests passing at ad37071 using `unshare -rn`, and the recovered portfolio test file failing 6 of 7 against parent d524b5a with a 7-of-7 control on ad37071. These results do not establish production or authenticated integration readiness. Fable’s detailed notes and evidence are under `.context/cohead-arbitrage/`.

The original fix removes positional fallback, skips unmatched result legs, preserves Polymarket order IDs and separates paper/live lookup. It does not eliminate all phantom-fill paths or complete mode isolation: the storage unique index still excludes is_paper. Remaining work includes side-aware single-use result matching, exchange-confirmed quantity/price, directional polling identity, durable accounting of partial fills, recovery/unwind, exchange-confirmed exits and exchange-fee-aware reconciliation. Polymarket US cross-platform results already include ticker/venue; the missing ticker finding is specific to directional polling paths.

## Planning corrections

The lead’s corrected package separates route, book and clearing identities; qualifies Robinhood event-contract API access as not verified in official documentation reviewed; includes options in Trading MCP’s documented equities/options/crypto scope; narrows the result-tagging claim; and labels the midterm basket arithmetic illustrative rather than executable arbitrage or expected profit.

Primary sources checked by Fable: [international fees](https://docs.polymarket.com/trading/fees), [US fees](https://docs.polymarket.us/fees.md), [Kalshi series fee changes](https://docs.kalshi.com/api-reference/exchange/get-series-fee-changes.md), and [Robinhood event-contract venues](https://robinhood.com/us/en/support/articles/robinhood-event-contracts/).

Fable checked official Polymarket fee formulas: international Politics coefficient 0.04 in C×rate×p×(1−p), and US theta 0.06 taker / −0.0125 maker effective 2026-07-01. Neither is a flat percent-of-notional statement. Kalshi’s fee PDF remained unavailable with HTTP429, so the draft coefficient is not primary-verified; use documented per-series fee metadata as the next fixture source. The static basket examples also have non-equivalent settlement terms and stale single-fetch prices, so their numeric sign supports no executable-opportunity conclusion.

## Co-head agreement and next scope

An explicit execution mode with a fail-closed default must precede scanner or fee changes that could feed live behavior. One owner must own shared Python execution/accounting; R003 remains unassigned/frozen to avoid overlapping writers. A future local implementation branch should start directly at exact ad37071, preserving its identity. Creating an isolated branch is routine and reversible; no merge or founder approval of branch mechanics is implied.

Venue eligibility gates venue selection, access checks and executable-opportunity claims. It does not gate preparation of offline mode/fill/accounting correctness work useful across venues. Any international Polymarket-specific normalization or fixtures remain explicitly venue-conditional. No account-opening request is needed for this completed planning milestone.

Fable drafted proposed ARB002 criteria at `.context/cohead-arbitrage/ARB002-draft-acceptance.md`: mode controls first, confirmed fill identity second, then bounded registry/fee/recorder work. It is not an accepted implementation ticket. Before dispatch, reconcile exact file ownership for Polymarket US executor confirmation changes; require an explicit-live mocked positive control as well as zero-order proofs for inactive modes; and separate unresolved primary fee evidence from passing correctness tests. Storage uniqueness, actual exits, fee-aware P&L and recovery/unwind remain later explicit scopes. The next milestone must stay bounded rather than silently absorbing them all.

No trading or deployment date was set. The accepted ARB001 source/venue/readiness planning milestone is complete with the documented unresolved access, fee and settlement evidence. A profitable strategy, complete execution fix or live-ready platform is not claimed.
