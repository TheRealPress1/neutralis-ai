# Robinhood agentic Customer Agreement: documentary findings

Observed 2026-09-07. Bounded public-document research; no account, registration, credentials, financial/MCP endpoint, or provider contact. This records contractual text and unresolved architecture questions, without deciding Neutralis's eligibility.

The [financial-entities privacy statement](https://robinhood.com/us/en/support/articles/rh-financial-entities-privacy-statement/) (effective August 18, 2026, section 2) directly links “Customer Agreement” for external-agent trading. That link resolves to the [RHF–RHS Customer Agreement](https://cdn.robinhood.com/assets/robinhood/legal/Robinhood-Customer-Agreement.pdf), revised September 1, 2026, 47 pages. The [disclosure library](https://robinhood.com/us/en/about/legal/) lists the same revision. Page references below are printed pages, also one-based PDF pages.

| Question | Documented finding and limit |
| --- | --- |
| Custom API/MCP client | §29.1, [p.22](https://cdn.robinhood.com/assets/robinhood/legal/Robinhood-Customer-Agreement.pdf#page=22): API Package includes Robinhood-hosted MCP; Licensee Products are third-party products using it. Package use or Product development requires Robinhood's “express written consent.” |
| Hosted client/server tokens | §§29.1–29.2, pp.22–23: Robinhood hosting its server does not specify customer-client hosting. Keys are sensitive credentials. No explicit server-token storage or OAuth deployment rules located. |
| Unattended agents | §29.8, [p.24](https://cdn.robinhood.com/assets/robinhood/legal/Robinhood-Customer-Agreement.pdf#page=24) explicitly contemplates autonomous agents without contemporaneous review; responsibility remains with the customer. This does not establish approval of a particular client. |
| Model/data sharing | §29.2 permits account/personal-information disclosure to API Products. §29.4 makes third-party feeds conditional on licensee agreements. §3 and Market Data Addendum §2, [pp.5/37–38](https://cdn.robinhood.com/assets/robinhood/legal/Robinhood-Customer-Agreement.pdf#page=37), separately restrict market-data redistribution. No explicit external-model processing/training or shared-archive exception located. |
| Ongoing access | §29.7, pp.23–24: personal use; authorization is revocable and connectivity may be disabled. |

Remaining unverified: existing Neutralis/founder consent and its coverage; accepted client/hosting/callback/token arrangements; field-specific data entitlements and downstream model permissions. Neither generic personal-use language nor silence settles these questions. No inference that independent offline domain work is prohibited.

Custody: public PDF retrieved with HTTP 200 at `2026-09-07T22:00:31.914163+00:00`; unchanged final URL; `Last-Modified: Tue, 01 Sep 2026 12:08:13 GMT`; 558,485 bytes; SHA-256 `62d1cf1622948e8892641afa2ac5eb7576e20f71b87e6fc8d3b062969013856c`. Saved [PDF](robinhood-agentic-customer-agreement.pdf) and [request/hash receipt](robinhood-agentic-agreement-request-receipt.json). Main agreement revision is September 1; the incorporated Market Data Addendum retains its own April 10, 2026 revision.
