# Robinhood hosted-client evidence update

Root public-document research, 2026-09-07 UTC. This complements accepted RH002 and the prepared RH003 specialist ticket. No client registration, authentication, MCP resource request, account call or runtime was performed. RH003 has not been delivered because current Conductor project metadata fails verification.

Robinhood explicitly describes use through MCP-capable platforms beyond its named examples, and requires initial Agentic onboarding/authentication on a desktop device. That supports investigating a Neutralis HTTP client with desktop-browser consent. It does not demonstrate acceptance of our exact hosted client or callback, or its token lifecycle. Reads may span the owner's Robinhood accounts while trading is restricted to the Agentic account, so our role and account boundaries remain necessary. [Robinhood overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)

The 2025-11-25 MCP authorization specification describes HTTP clients acting for resource owners, discovery, public/confidential-client security and multiple registration approaches. Dynamic registration is optional in this version. This is standard-level design guidance, not a Robinhood eligibility agreement or tested compatibility. Pin the version used by any later implementation. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

The overview's general API link leads to Robinhood's crypto-trading documentation. That destination does not establish an Agentic equities custom-client contract. No API method was exercised. [Linked developer portal](https://docs.robinhood.com/crypto/trading/)

## Concrete position

| Question | Evidence / next proof |
| --- | --- |
| Can research run separately from a desktop conversation? | The accepted architecture uses bounded jobs. HTTP/OAuth standards make a hosted client plausible; Robinhood's actual acceptance remains untested. |
| What application origin should we plan around? | Existing root Vercel preflight identified neutralis.ai and www.neutralis.ai as production aliases. Propose `https://neutralis.ai`; exact callback path and provider approval are still unimplemented/unverified. No new founder URL is needed merely to continue design. |
| What is already built? | RH001 is an accepted offline TypeScript security/domain foundation. Production transport, durable persistence, host routes, initial token installation and raw provider schemas remain absent from that milestone. |
| What must the later connection proof establish? | Exact client/redirect acceptance, desktop consent, owner/account identity, permitted tool schemas and reads, refresh behavior and disconnect semantics. No funding or order is needed for an authentication proof. |
| What can the paper desk do first? | Synthetic packet/decision/risk/cost records and a design preview can be built without brokerage credentials. Real paper outcomes additionally need admitted observation and accounting inputs. |

The browser retrieved the Robinhood overview and MCP specification successfully in this update. The trading-tools help page timed out; the two exact well-known metadata opens were rejected by the browser tool as non-retryable. No alternative transport was used to bypass those rejections. The accepted RH002 metadata remains dated historical evidence, not newly reproduced discovery. No result here upgrades a planned hosted connection into an enabled one.

The practical consequence is to retain website operations plus bounded cloud jobs as the agreed packaging direction while completing RH003's provider-specific contract before implementing or enabling a connection. Conductor is still the place to discuss research and coordinate builders; the website should ultimately show durable decisions and state independently of a chat session.
