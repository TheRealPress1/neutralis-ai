# RH002 — Investment-team feasibility

2026-09-07. Complete specialist proposal for returned Fable co-head review.
Documentation/public discovery only; no experiment, service or connection was run.
The accepted ticket and RH-DISCOVERY-1 govern this memo. Fable owns experiment
direction; Astra dispatches builders and writes shared records. This memo maps
capabilities and unresolved inputs to that direction rather than selecting a new
experiment or replacing a product owner.

## Decision

Robinhood is a plausible **later broker and current-research input**, conditional
on client approval, owner onboarding, real schemas and data rights. The public
material does not establish a complete research feed, historical dataset or broker
paper sandbox. RH001 is an accepted offline security domain, not that connection.

The smallest next step is a source/rights and interface contract, followed only
if commissioned by on-demand paper research with verified inputs. There is no
evidence-based reason to buy duplicate current-data access now, and no verified
free-data package sufficient to run the proposed pilot in this scope. Historical
data for the separate momentum/profitability comparison remains a separate gap.

## Evidence and permitted access

All Robinhood observations below were refreshed on **2026-09-07, 17:13:29 UTC**.
The four public HTML pages returned 200 without authentication. Public metadata
was read by exact allowlisted GET with redirects disabled, no cookie persistence
and no credentials. Sources and byte hashes are in the dispatch receipt; private
snapshots are retained. The financial MCP resource itself was **not requested**.
Neither were advertised registration, authorization or token endpoints.

Use these source keys throughout; each link is a primary source:

- **S1:** [support index](https://robinhood.com/us/en/support/agentic-trading/).
- **S2:** [Agentic Trading overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/).
- **S3:** [Trading with your agent](https://robinhood.com/us/en/support/articles/trading-with-your-agent/).
- **S4:** [Agentic product workflow](https://robinhood.com/us/en/agentic-trading/).
- **S5:** [protected-resource metadata](https://agent.robinhood.com/.well-known/oauth-protected-resource/mcp/trading).
- **S6:** [authorization-server metadata](https://agent.robinhood.com/.well-known/oauth-authorization-server/mcp/trading).

For this bounded discovery, external feed sites, SEC/EDGAR and macro-data services
were not added to the public-request allowlist. Their access conditions, data
completeness and rights are therefore **unverified here**, not presumed unavailable
or unsuitable. No public market dataset was downloaded. Publicly readable broker
documentation establishes documentation access, not free data entitlement, storage,
redistribution or permission to send that data to model providers. The verdicts
below deliberately distinguish these facts.

### Documented broker facts

S2 describes account/position/transaction/watchlist/scanner reads across the owner's
Robinhood accounts, with trading restricted to the Agentic account. It supports
other MCP-capable platforms generally. Authentication/onboarding is desktop-based
and requires an eligible primary investing account. That establishes neither
permission nor prohibition for Neutralis's private server-held-token client.
S2 says an agent can place trades "without your confirmation" when instructed to
act without approval. This is documented autonomous-order capability, not authority
for this project. [S2](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)

S4 describes a third-party agent/account workflow, in-app activity and owner
disconnect. It does not establish a Neutralis scheduler, committee, research audit
trail or API revocation contract. Its disclosure describes data leaving Robinhood's
security environment when shared with the selected AI provider. Our role and
privacy restrictions must therefore be implemented outside the grant.
[S4](https://robinhood.com/us/en/agentic-trading/)

The following compact catalog is the documented vocabulary used in later mappings.
Descriptions are public help text, not negotiated schemas or entitlements.

| Group | Published names and documented granularity |
| --- | --- |
| **F — company evidence** | `get_financials`: quarterly/yearly revenue, gross profit, net income/margin; `get_equity_fundamentals`: valuation, capitalization, dividend and current-day price information. |
| **P — prices/quant** | `get_equity_historicals`: OHLCV bars; `get_equity_quotes`: current/prior-close quotes, up to 20 symbols; `get_equity_price_book`: Level 2, up to four stocks; `get_equity_technical_indicators`. |
| **E — earnings** | `get_earnings_results`: EPS estimates/results and next-report information; `get_earnings_calendar`: windows up to 31 days. |
| **D — discovery/context** | `search`, `get_indexes`, `get_index_quotes`, `get_scans`, `get_scanner_filter_specs`, `run_scan`; scan creation/configuration changes are also listed. |
| **A — private account** | `get_accounts`, `get_portfolio`, `get_realized_pnl`, `get_pnl_trade_history`, `get_equity_positions`, `get_equity_tax_lots`, `get_equity_orders`, `get_equity_tradability`. |
| **X — execution** | `review_equity_order`, `place_equity_order`, `cancel_equity_order`. Review provides simulation/warnings. Long equities, options and crypto are described. |

Catalog source: [S3](https://robinhood.com/us/en/support/articles/trading-with-your-agent/),
observed 2026-09-07. All groups remain disabled/unverified in our live integration.
Order-review simulation is **not evidence of a complete broker paper sandbox**.
No verbatim claim that Robinhood has no paper environment was found or fabricated.

### Public discovery, compared with frozen RH001

Parsed S5/S6 metadata is unchanged from the committed 2026-09-06 receipt.

| Field | Actual advertised value; consequence |
| --- | --- |
| Resource and issuer | `https://agent.robinhood.com/mcp/trading`; this identifier was not requested as a financial endpoint. |
| Authorization URL | `https://robinhood.com/oauth`; observed in JSON only. |
| Token URL | `https://api.robinhood.com/oauth2/token/`; observed in JSON only. |
| Registration URL | `https://agent.robinhood.com/oauth/trading/register`; advertisement is not successful registration. |
| Grants / response / PKCE | `authorization_code`, `refresh_token`; `code`; `S256`. |
| Token authentication / bearer placement | `none`; header. Public-client authentication is advertised; no client-secret requirement is inferred. |
| Scope | `internal`; semantics, account restriction and read-only granularity are unverified. |
| Revocation / introspection | No endpoints advertised in these retrieved documents. Absence is not proof none exists. |

The root-path versions of the two metadata documents also returned identical 200
JSON. Both previously retained OpenID-discovery URLs returned 404. These six exact
well-known URLs are listed in the receipt. No route guessing or fallback request
to a financial endpoint occurred. [S5](https://agent.robinhood.com/.well-known/oauth-protected-resource/mcp/trading),
[S6](https://agent.robinhood.com/.well-known/oauth-authorization-server/mcp/trading)

## Founder-directed roles and the broker boundary

The roles, weekly illustrative cadence, shared research, comparison arms and
approval rules come from the supplied team document and RH-DISCOVERY-1. All
numeric settings/model choices below remain proposals. They are not a budget or
live mandate. One PM with software controls is a separately configured comparison;
it is never the fallback when one of two PMs is unavailable.

| Supplied role | Capability relationship and permitted input boundary |
| --- | --- |
| Fundamental analyst | F could supply selected research facts after entitlement/schema/rights validation; original filings and missing balance-sheet/cash-flow evidence still need a source. Receives cited research packets, never private account access or X. |
| Industry/macro analyst | D may support selected market context; no verified macro release/vintage feed. Receives one cycle packet and minimum approved derived exposures, not account records or broker tools. |
| News/catalyst analyst | E/F could support the combined company memo. Attributable guidance/news/filing vintages need separate evidence. No account or order tools. |
| Quantitative analyst | P could supply validated inputs; returns, volatility, liquidity, correlations and benchmark diagnostics are deterministic calculations in later code. Tool output is not a substitute for reproducible inputs. No direct broker account access. |
| Portfolio managers A/B | Consume the same frozen research and their arm's minimum approved paper/derived holdings, cash and exposures. They do not call A or X. Their output is a versioned decision, not broker authority. |
| Risk controls | Later conventional software checks the explicit mandate, data freshness and approved derived/paper portfolio. Real private-account checks, if commissioned, occur inside the restricted boundary, not in an analyst prompt. Commentary cannot override a rejection. |
| Execution/accounting | One later account-bound execution owner alone can translate an approved version into X and reconcile A evidence. No such live owner, order adapter or accounting implementation is commissioned here. RH001's frozen allowlist excludes X and most of A. |

**Conflicts and consequences, identified 2026-09-07:** broad S2 reads and autonomous
ordering do not enforce role separation or joint PM approval. A prompt restriction
cannot narrow that underlying access. S4's bring-your-agent model also permits a
separately authorized personal desktop agent: it would be a second executor on
the Agentic account. The eventual single-executor policy must cover that actor,
including reconciliation/ownership rules, before activation. No current personal
agent or account state is assumed. [S2](https://robinhood.com/us/en/support/articles/agentic-trading-overview/),
[S4](https://robinhood.com/us/en/agentic-trading/)

Keep Constantine's and Gaspar's consent, tokens, private data, budget and account
audit records separate. Common market research can be shared only with verified
rights; private portfolio material stays scoped to its owner and experiment arm.
Do not pool credentials or interpret a brokerage read as Agentic readiness.

Every discretionary rebalance, including sells, trims and exits, requires both
PMs to accept the same final version in the two-PM arm and deterministic controls
to pass. Disagreement, outage, stale input or exhausted budget generates no
discretionary order and no silent one-PM fallback. There is no emergency or automatic
exit authority here. Any objective exit proposal belongs to the co-heads' later
explicit paper mandate, with observable triggers and unknown-data handling.

## RH-DISCOVERY-1: complete input coverage

Every verdict is dated **2026-09-07**. **Public** means actually retrieved public
source/access conditions; **Broker-dependent** means documented capability pending
onboarding and schemas; **Missing/unverified** means an input is not established.
An internal requirement or calculation is labeled separately; it is not a vendor
field. Group letters refer to the sourced catalog above. No row means “ready to run.”

| Input | Coverage verdict and evidence | Concrete gap / implication |
| --- | --- | --- |
| **I01 — universe/identity** | **Broker-dependent, partial:** D and A list discovery/tradability functions (S3). **Missing/unverified:** a dated eligible list and share-class/security-ID history. | No verified listing history, ticker-change mapping, delisted names or contemporaneous volume sequence supports the proposed fixed rule. A prospective frozen list of 30–50 names would not establish a survivor-free historical universe. The co-heads retain the selection rule. |
| **I02 — prices/liquidity** | **Broker-dependent, partial:** P (S3). Public descriptions identify bars/quotes and the explicit symbol limits above. | Raw versus adjusted convention, bar interval/depth, timestamps/timezone, market calendar, availability lag, corrections and reliable security joins are unverified. No usable licensed trailing-history feed was obtained. Volatility/returns/liquidity are later computations, not verified provider statistics. |
| **I03 — paper observations** | **Missing/unverified:** a reliable next-eligible-session observation feed. P is a **Broker-dependent** candidate; X is order-review functionality, not a paper account (S3). | No guaranteed open-price timestamp, halt/gap indicator, venue convention or subsequent observation window. The co-heads must fix the execution convention. Missing observations stay unfilled/unknown; no fabricated fill, hindsight substitution or inference of paper execution from a preview. |
| **I04 — corporate actions/cash** | **Missing/unverified:** complete action and terminal-event coverage. F's dividend description is only **Broker-dependent partial** evidence (S3). | Split effective dates/factors; dividend effective/ex/payment dates; mergers, delistings, share/cash consideration and adjustments are not established. Price adjustment plus separately credited dividends could double count. Unknown terminal proceeds cannot be invented. This blocks clean total-return and ledger comparisons. |
| **I05 — company financial evidence** | **Broker-dependent, partial:** F (S3); **Missing/unverified:** original point-in-time filing evidence. | Named financial metrics do not establish original accession, acceptance/publication time, fiscal period semantics, units/currency, balance-sheet/cash-flow completeness or restatement vintages. Original filing-source access and rights require a later scoped primary-source check. Later-revised values must not be treated as then-known facts. |
| **I06 — events** | **Broker-dependent, partial:** E (S3). **Missing/unverified:** attributable full event coverage and rights. | A calendar estimate is not a known future outcome. Need actual publication/retrieval times, revisions, source attribution, guidance and filing/corporate-event completeness. No general licensed news corpus or article redistribution/model-use right is established. |
| **I07 — industry/macro** | **Missing/unverified:** reproducible sector taxonomy/exposures and macro release/vintage data. D offers only **Broker-dependent partial** market context (S3). | No verified macro calendar, release timestamp, vintage/revision or taxonomy history. One shared macro memo is the proposed cycle workload, not one macro call per company. Macro facts and exposure calculations need separately versioned inputs; model knowledge cannot fill missing observations. |
| **I08 — benchmarks/diagnostics** | **Missing/unverified:** comparable total-return inputs. P/D are **Broker-dependent partial** price candidates (S3); diagnostic definitions are **internal**. | Index quotes do not establish total-return histories. Fixed-universe passive and broad-index references need compatible dividends/actions, timing, cash, turnover, costs and exposure conventions. Do not choose a new benchmark here or treat related stocks/overlapping horizons as independent trials. |
| **I09 — frozen packet** | **Public:** S1–S6 were retrieved and hashed under the stated access conditions; this proves source-document retrieval only. Packet specification is **internal** in the supplied inputs; production coverage remains **missing/unverified**. | Need versioned rights and source snapshots, cutoff/retrieval/availability times, gaps, calculations and prompt/model/config IDs. Actual data feeds are not licensed by hashing them. No fresh browsing during decisions; absent required data prevents a complete packet. |
| **I10 — paper mandate/portfolio** | **Internal requirement; missing implementation/accepted mandate.** Team document and RH-DISCOVERY-1 supply the direction, not provider records. A is **Broker-dependent** eventual reconciliation evidence (S3). | Separate arm holdings, cash, receivables, costs, explicit limits, timestamped decisions/approvals and missing-fill rules remain to be frozen by the co-heads. Broker portfolio/P&L tools do not supply the comparison-arm paper ledgers. No capital amount or automatic exit is accepted. |
| **I11 — costs/quality** | **Internal accounting proposal** below; **missing/unverified** API rates/access, real token usage, data fees and hosting bills. | No model/provider is selected for production. Record per-role/per-arm calls, bounded follow-ups, total input, its cached subset, output, rejected decisions and failure reasons before outcomes. Record counterfactual limits. Coding subscription access does not verify deployment credentials or price. |
| **I12 — eventual broker** | **Public:** actual S5/S6 metadata. **Broker-dependent:** S2–S4 account/tool workflow. **Missing/unverified:** our actual client/account connection. | Need registration/redirect acceptance, consent semantics, account identity/types, authenticated catalog, position/order/fill schemas, entitlements/limits, token renewal/disconnect evidence and single-executor coverage. Generic authorization failure is not confirmed revocation. Each founder/account is isolated. |

Thus no proposed feed is declared fully free, licensed or sufficient. Current
research candidates through Robinhood are F/P/E/D; privately scoped account
candidates are A. The long-history/factor comparison additionally needs identity
survival, corporate actions, original vintages, delisting outcomes and compatible
benchmark data. The next source ticket should resolve those gaps before any purchase,
including whether permitted existing sources already cover current research.

The supplied Lira/Autopilot research update is retained as an input, not re-verified
return evidence. No screenshot period, live prompts, performance attribution or
use of Agentic MCP is inferred. The historical momentum/profitability proposal
remains separate and untested; current-model hindsight and a short forward pilot
cannot establish investment profitability.

## Connection questions and smallest later owner steps

Public metadata does not answer custom-client eligibility, redirect registration,
scope semantics or account entitlements. The actual Neutralis URL and offered
custom-client documentation remain pending. No owner step is commissioned by this
memo, and no secrets are requested in chat.

| Later separately scoped step | What it could establish / what it cannot |
| --- | --- |
| **First, owner supplies the actual intended web origin and offered developer documentation through the approved project channel.** | Establishes the intended callback host and possibly the published client-registration contract. No login required. It does not prove Robinhood accepted that client or callback. This is the smallest missing preparatory input. |
| **After a reviewed client/redirect contract, owner uses a desktop browser for Robinhood's consent/onboarding flow.** | Could establish that owner's eligibility, visible consent wording, whether an Agentic account setup is required, actual chosen account and success/failure for that specific client. A generic desktop-client success would not prove Neutralis server-client support. No funding or order is needed to answer authentication questions. |
| **Separately authorized, narrowly scoped catalog and read verification under that owner's grant.** | Would establish actual named tools, schemas, account identity/type, effective permission/entitlement, returned token/account evidence and observed read success. Record account ID, tool, timestamp and credential version; do not generalize across accounts. Initial permitted reads must be explicitly bounded. This memo performs none. |
| **Separately scoped lifecycle/operations observation.** | Could establish observed expiry/refresh behavior, disconnect propagation, limits and whether another desktop agent remains an executor. No repeated stress calls, endpoint guesses or autonomous trading follow. One observation does not prove all rate or rotation policies. |

Before live planning, fill/order reconciliation schemas and ambiguous-acknowledgment
handling require their own evidence and mandate; there is no order probe in these
steps. A claimed sandbox would require explicit provider evidence and a separate
scope. Local RH001 disconnect deletes local access only; it cannot claim to revoke
an unobserved provider grant.

## Actual RH001 reuse and narrow future file map

Static inspection only at exact `3dd6343cf08b2793da456744e757db67e2abb82e`.
No imports, tests or execution occurred for RH002. Source subtree object:
`79e412aa3a8e6196986b9e7f79de569a23287980`.

| Existing interface | Reuse / remaining boundary |
| --- | --- |
| `endpoints.ts`: `ENDPOINTS`, `TOKEN_AUTH_METHOD`, `validateConfiguration`, `requireLiveAccess` | Exact provider pins, injected HTTPS configuration and hard live-disabled gate. Discovery did not establish registration acceptance. |
| `authorization.ts`: `AuthorizationTransactions.begin/consume`, `AuthorizationProof` | State/PKCE, session/browser/configuration/revision binding. Proof is server-only. No OAuth route, cookie/session plumbing, code exchange or initial-token installer exists. |
| `token-vault.ts`: `TokenVault`, `KeySource`, `EnvelopeIdentity` | Strict authenticated envelope with owner/provider/connection/key/purpose/revision binding. Actual key provisioning/rotation and durable persistence are absent. |
| `storage.ts`: `ConnectionStore.readOwned/compareAndSwap`, `AuthorizationStore.putReplacing/consume` | Required ownership, atomic replacement and one-time state contracts. Implementations exist only in tests; a real database must prove validation, atomicity and isolation separately. |
| `connection.ts`: `ReadPort.catalog/read`, `RefreshPort.refresh`, `ConnectionDomain` | Internal normalized account receipt and token semantics; metadata/read/refresh/local-disconnect domain. No raw research-price/financial packet interface or production transport. A successful mock cannot certify a provider schema. |
| `policy.ts`: `ReadPolicy`, `CatalogEvidence`; `view-model.ts`: `ConnectionView` | Default-empty tools, fixed ceiling of two account reads, bound catalog evidence and redacted account/tool/time metadata. F/P/E/D/X cannot be enabled by injecting a broader allowlist. View remains `liveEnabled: false`, `canConnect: false`, Agentic readiness unassessed. |
| `security.ts`, `errors.ts` | Principal/time/skew helpers and fixed errors. Malformed persisted-record TypeErrors and configurable maximum token/catalog lifetimes remain documented future hardening, not new work here. |

Existing paths are under `src/lib/brokers/robinhood/`. The user-reported exact-head
acceptance is the GPT revision PASS; Fable's original b60fcf3 review stays prior-head
evidence. Neither is relabeled as a Fable PASS on the current implementation.

A later Python research batch cannot directly import these TypeScript interfaces.
Its broker inputs would require an explicitly reviewed, server-owned serialized
projection; the offline paper path needs no broker dependency at all. Do not solve
that boundary by reusing exchange credential rows or the shared Python executor.

**Proposed later stages, requiring new tickets, not files created now:**

1. Source/rights contract only: proposed `docs/robinhood/RH003-source-rights-contract.md`;
   obtain approved primary-data documentation/access/rights samples for I01–I08,
   real web-client contract and account-isolation mapping. No dataset purchase is
   justified until current versus historical coverage is compared.
2. Once co-heads freeze a paper mandate and sources, isolated local research files:
   `research/equities/contracts.py`, `packet.py`, `metrics.py`, `paper_ledger.py`,
   `cost_records.py`, and `run_batch.py`. Responsibilities follow I09/I10/I11 and
   supplied roles; no broker credentials, new strategy choice or shared Python
   execution/accounting edits. These paths are a staged proposal, not implementation
   authorization. Tests would belong to that later scope.
3. Only after separate broker-contract approval: proposed
   `src/lib/brokers/robinhood/provider-contract.ts`, `transport.ts`,
   `persistence.ts`, and `research-projection.ts`. Real response validation, storage,
   authenticated catalog and minimum-role projections must precede any enablement.
   A distinct reviewed research contract is needed; silently broadening RH001's
   two-tool ceiling is not reuse. Callback/routes/initial installer stay a later
   explicit host/security ticket; no guessed working URL is proposed.
4. Execution, reconciliation and any live exits require another mandate/owner
   decision. This memo does not specify order code or authorize X. Frontend insertion
   retains its later sole owner. UI003/UI004 and Railway holds remain in force.

## Workload and cost feasibility without a budget claim

The co-head comparison stays one PM plus software controls versus two independently
briefed PMs with identical controls, shared research, separate paper portfolios and
passive references. Different families are proposed, not selected API models or
independent errors. A sequential challenger stays an optional later comparison.

For accounting only, take **40 companies** within the proposed 30–50 range and
one proposed weekly cycle. Counts below price a bounded realization of the supplied
workflow; they are not accepted cadence, prompts, limits or budget. Quant metrics,
risk checks and paper-ledger arithmetic have **zero LLM calls**. One optional shared
targeted follow-up is counted at its maximum and frozen into both arms' packet;
it grants no additional decision-time browsing. Additional events/cycles would
need separate bounded accounting rather than silently multiplying this estimate.

| Call group | Calls/cycle | Input per call I | Cached subset per call C | Output per call O |
| --- | ---: | ---: | ---: | ---: |
| Shared combined fundamentals/catalyst memo | 40 | 6,000 | 2,000 | 800 |
| Shared industry/macro memo | 1 | 8,000 | 2,000 | 1,200 |
| Shared targeted follow-up, maximum | 1 | 4,000 | 1,000 | 600 |
| One-PM arm: initial assessment | 1 | 14,000 | 10,000 | 1,200 |
| One-PM arm: final proposal | 1 | 16,000 | 10,000 | 1,200 |
| Two-PM arm: independent initial briefs | 2 | 14,000 | 10,000 | 1,200 |
| Two-PM arm: one bounded discussion, one turn each | 2 | 17,000 | 10,000 | 800 |
| Two-PM arm: author revises final version | 1 | 18,000 | 10,000 | 1,200 |
| Two-PM arm: peer accepts/rejects that exact version | 1 | 19,000 | 10,000 | 400 |

The proposal author must explicitly accept its final version; peer disagreement
still means no discretionary order. This accounting example does not add a second
revision round or relax either arm's controls.

| Accounting bucket | Calls | Total input I | Cached C | Uncached I−C | Output O |
| --- | ---: | ---: | ---: | ---: | ---: |
| Shared research | 42 | 252,000 | 83,000 | 169,000 | 33,800 |
| One-PM stage only | 2 | 30,000 | 20,000 | 10,000 | 2,400 |
| Two-PM stage only | 6 | 99,000 | 60,000 | 39,000 | 5,600 |
| Combined run, shared research paid once | 50 | 381,000 | 163,000 | 218,000 | 41,800 |

For model j with selected-provider rates per million tokens:

`model_cost = Σj [ (Ij − Cj) × r_uncached,j + Cj × r_cached,j + Oj × r_output,j ] / 1,000,000`

Require `0 ≤ Cj ≤ Ij`. Cached tokens are not added to total input again. The table
is a proposed cache-hit bound, not guaranteed provider cache eligibility. With no
cache hit, set C to zero and price all I as uncached. No model/rate is selected,
so dollar rates and approved dollar budget are **unverified**, not zero. Before
execution, record dated provider rates, API access, model/config IDs and actual
per-call usage; coding subscriptions confer none of those facts.

For per-arm comparison, report PM-stage cost separately and allocate shared research
once using declared weights `w_one + w_two = 1` (equal halves is an illustrative
reporting option, not policy). Report both:

- **Incremental equities cost:** additional model/data fees plus measured extra
  compute/storage/egress caused by equities.
- **Allocated shared cost:** a separately stated share of existing hosting/storage
  bills based on an approved usage/capacity allocation. Do not charge the same
  incremental bill again as baseline allocation or assume arbitrage absorbs it.

`equities_total = incremental_equities + allocated_existing_shared`

Current bills, marginal headroom, storage retention, data licenses, cache behavior
and API prices are not verified. A purchase recommendation would be premature.

## Smallest runtime shape, later only

Conductor is the development/review IDE, not the investment runtime. Begin, if later
commissioned, with an owner-triggered local/batch process and versioned portable
JSON/CSV/Parquet-style files chosen in that ticket. Keep large licensed snapshots
in permitted private file storage; use Supabase only for small packet indices,
decision/approval and cost records once its persistence contract is authorized.
This is a proposed use of the accepted stack, not a claim of spare capacity or
free tiers. No database work occurred.

A future Railway worker could execute those same bounded jobs without an open
Conductor session. It is optional and subject to the existing hold, operating
ownership, scheduling/session constraints and incremental/allocated cost review.
No paid infrastructure, always-on agents, service or scheduler is assumed. The
co-heads must resolve mandate/data readiness and review this complete artifact
before Astra issues any implementation ticket.
