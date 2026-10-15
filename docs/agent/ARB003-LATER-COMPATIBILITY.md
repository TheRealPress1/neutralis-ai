# Later Polymarket compatibility evidence and gaps

Read-only public-source review, **2026-09-07 UTC**, by `/root/institutional_data_screen`. Two substantive routes per venue were checked and the search stopped: international pinned legacy SDK plus current specification/migration; US Orders specification plus pinned official Python SDK/tests. This supplements `docs/agent/ARB003-VENUE-RESPONSE-CONTRACTS.md` and the action-ledger check without reopening accepted ARB-FILL-1 at planning commit `4200134`.

**Neither missing contract is established sufficiently to unlock the current milestone.** New evidence strengthens the need for a separately scoped international compatibility decision: the official legacy repository now warns that its client is no longer functional. No SDK was installed/upgraded, no downloaded code executed, and no clients, venue/account API calls, tests, product edits or Conductor messages were made.

## International: two evidence routes

**1. Exact legacy source.** Official tag [v0.34.6](https://github.com/Polymarket/py-clob-client/tree/v0.34.6) resolves to commit **`cc1740c11adf0be33590c1ee4976ce8bfd2f37c2`**, dated **2026-02-19**. The [pinned client](https://github.com/Polymarket/py-clob-client/blob/cc1740c11adf0be33590c1ee4976ce8bfd2f37c2/py_clob_client/client.py#L623) returns POST JSON; its GetTrades implementation at line 808 flattens paginated `data` into a list without transforming economic fields. The [HTTP helper](https://github.com/Polymarket/py-clob-client/blob/cc1740c11adf0be33590c1ee4976ce8bfd2f37c2/py_clob_client/http_helpers/helpers.py#L60) returns parsed JSON directly. Both fetched files byte-match the installed 0.34.6 sources. These are firm SDK-behavior anchors, **not a dated server response-unit contract**. The inspected tag documentation/source did not define POST `takingAmount`/`makingAmount` or GetTrades `size`/maker `matched_amount` scale.

**2. Current official specification and migration boundary.** [Current CLOB OpenAPI](https://docs.polymarket.com/api-spec/clob-openapi.yaml), declared **1.0.0**, explicitly describes response `makingAmount` and `takingAmount` using six-decimal fixed math (lines 4873–4879). This is stronger than inferring scale from samples. The same schema's Trade/maker-allocation descriptions still do not explicitly establish `size`/`matched_amount` scale (Trade starts line 6206; maker matched amount at 6327). Response amounts appear in resting/delayed as well as matched examples; they are not automatically confirmed fills. A current mutable specification does not prove the production schema served to February's legacy client, its historical responses, or cutover compatibility.

The [official deprecation warning pinned at `b076b04`](https://github.com/Polymarket/py-clob-client/blob/b076b04d61135657e25dccc1bbd6866a96bd8c6e/README.md#L1), commit dated **2026-05-25**, says: **“The client is no longer functional”** and directs migration to the unified SDK. The [current migration guide](https://docs.polymarket.com/getting-started/migrate-from-previous-sdks) demonstrates Python migration from `py-clob-client-v2` to `polymarket-client`, rather than furnishing a versioned response-unit compatibility guarantee for 0.34.6. These are vendor-published facts, not an independently tested outage or proof that every read endpoint fails.

**Remaining international questions for a later checkpoint:**

- Which supported server/API generation and SDK version will the existing account integration target? Obtain the effective transition/cutover contract and pin it; an unchanged host URL does not answer this.
- For that exact generation, what units and asset direction do POST response `makingAmount`/`takingAmount`, GetTrades `size`, and maker `matched_amount` use for BUY versus SELL? Are POST values requested, matched cumulative, or executed amounts; gross or net of any share-denominated charge?
- What execution/settlement evidence establishes acquired quantity and actual consideration? Resolving units alone does not repair the separate existing SELL-YES-as-NO request/action and dollars-versus-shares bug.

## US: two evidence routes

**1. Official Orders specification.** The [Create Order markdown specification](https://docs.polymarket.us/api-reference/orders/create-order.md), declared **Orders API v1.0.0**, describes `lastPx` as this execution's price (lines 241–243) and `avgPx` as average fill price (342–344). It does **not explicitly define BUY_SHORT's execution outcome-price basis**, fee inclusion, or cumulative-average precision. `legPrices` is described for multi-leg instruments, not as a general NO-cost override. The [Orders overview](https://docs.polymarket.us/api-reference/orders/overview) confirms buying-NO intent and the YES/long-side **request** price convention. That resolves intended acquisition direction, not the missing `lastPx`/`avgPx` convention.

**2. Official Python source/tests.** Current public repository head **`aa38c1620b2898d953ba65b6a36687ddec3dd3bb`**, dated **2026-06-02**, declares package version 0.1.2. Its [pinned Order/Execution types](https://github.com/Polymarket/polymarket-us-python/blob/aa38c1620b2898d953ba65b6a36687ddec3dd3bb/polymarket_us/types/orders.py#L70) byte-match the installed types and contain `avgPx: Amount` / `lastPx: Amount` without a NO-basis rule. The inspected [order tests](https://github.com/Polymarket/polymarket-us-python/blob/aa38c1620b2898d953ba65b6a36687ddec3dd3bb/tests/test_orders.py) and [WebSocket tests](https://github.com/Polymarket/polymarket-us-python/blob/aa38c1620b2898d953ba65b6a36687ddec3dd3bb/tests/test_websocket.py) provide no BUY_SHORT execution-price contract. Type-file equality is not a claim that the entire installed wheel equals current Git head. Community issue payloads and numeric examples were not promoted to unit evidence.

**Remaining US question:** For a single-market BUY_SHORT/NO acquisition, does raw REST execution `lastPx.value` represent NO acquisition cost per contract or the YES-side price, and is nested `avgPx` in the same convention? Require an explicit versioned answer identifying any REST/WS differences, aggregation/rounding, fees and currency. Until then, neither `lastPx` nor `1 - lastPx` is a justified NO basis. The intent remains buying NO; this is not the international physical SELL YES case.

## Source fingerprints

Hashes identify exact bytes read on the review date. Immutable Git links above pin code; mutable documentation hashes do not create a vendor version or prove runtime compatibility.

| Source | SHA256 |
| --- | --- |
| Legacy 0.34.6 `client.py` | `9b3035ac65913efe5a2db14159abc09d423fa754d9d9c1a823038d2967338856` |
| Legacy 0.34.6 HTTP helper | `22c1bcd78dbed4186f6330144769e71c7c3caaf05afd7166f21af0d962e593ee` |
| Pinned May 25 legacy README | `cfadd667a58235a6486a6784b359d4be07b30c64a589fe7fe17baec15b8620a5` |
| Current CLOB OpenAPI 1.0.0 | `82529177635db366c31a08777355b4b95c392a427298c3ba68904b937d4594da` |
| US Create Order markdown / OpenAPI v1.0.0 | `0f7ffdcb944bc4b630177c2dfeeadc58462f55c28722bd1699d7caf4ea39d32d` |
| US Orders overview markdown | `b85c0a22add6046ebfacf09b528f203bbb0f48843b5543e6bb586008a87c0d7f` |
| Pinned US `types/orders.py` | `fbcc9ddef8a9af05bfd0ab0f65621cd8b564b20c2b1f424c9cd67c726befdaa4` |
| Pinned US `tests/test_orders.py` | `926c86c6de8ab930bf118169dcb83769d03dd651a7e492d682d746a249cb0028` |
| Pinned US `tests/test_websocket.py` | `47ce8c56815a6322b16ad390e9fdc5e164ae49b0be824b01cd230e607b411221` |

**Later-checkpoint evidence only. Keep ARB-FILL-1's unsupported cases and zero-order preflight unchanged.**
