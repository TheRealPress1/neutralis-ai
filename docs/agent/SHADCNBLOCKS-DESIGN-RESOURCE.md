# Shadcnblocks design resource

2026-09-06: Constantine reports a purchased Shadcnblocks subscription and suggests its use for dashboard and financial views. Exact account entitlement and authenticated registry access are not yet verified. Public catalog research is complete; no paid source or credentials were accessed and no components were installed.

Use selected components within the preferred Exchange paper/ink-blue identity. The current Exchange entry-art refinement continues under UI002, with its terminal unchanged for comparison. This resource does not select the final whole-site design or expand that candidate into a dependency/theme migration.

## Shortlist for a subsequent desk pass

| Public block | Proposed use | Adaptation requirement |
| --- | --- | --- |
| [Data Table 26](https://www.shadcnblocks.com/block/data-table26) | Position/order/fill tables with sticky columns, sorting and contained horizontal scrolling | Keep identifiers, units, unavailable states and distinct order/fill status; selection is not trading authority |
| [Dashboard 3](https://www.shadcnblocks.com/block/dashboard3) | Compact metrics and timestamped activity | Extract useful sections; show sparklines only from supplied history or labelled deterministic fixtures |
| [Chart Group 5](https://www.shadcnblocks.com/block/chart-group5) | Strategy/benchmark comparison and adjacent summary | Define portfolio-return calculations explicitly; summing equity-curve observations is not performance |
| [Chart Group 13](https://www.shadcnblocks.com/block/chart-group13) | Preset/custom date controls | Align each chart's stated window; replace generated sample data with fixed preview fixtures |
| [Application Shell 14](https://www.shadcnblocks.com/block/application-shell14) | Favorites/search, account menu and mobile navigation patterns | Adapt individual interactions to Exchange geometry and current private-account capabilities |

Catalog descriptions establish presentation patterns, not trading-specific OHLC/session/depth behavior or execution. Such behavior needs its own supplied data and tested contracts.

## Access and compatibility

The [official MCP guide](https://www.shadcnblocks.com/docs/shadcn-mcp/overview) describes the shadcn MCP server and `@shadcnblocks` registry in `components.json`. The [CLI authentication guide](https://www.shadcnblocks.com/docs/shadcn-cli/overview) uses `SHADCNBLOCKS_API_KEY` from the account's API Keys page for Pro access, with `Authorization: Bearer ${SHADCNBLOCKS_API_KEY}`. Credential values belong in the intended frontend environment, not chat, source, browser bundles or orchestration records. Adding a subscription does not automatically expose its MCP tools to this session.

Root baseline `d524b5a75643df5f508c068e3c4fb930ba54b4eb` has React 19, Next 16, Tailwind 4, Motion and Recharts 3.7. Root has no `components.json` or shadcn MCP tool exposed, and no named Shadcnblocks key in its process environment. The separate frontend VM’s verified sole writer also reports no configured shadcn MCP/registry and no named key in the process or project environment files. This check reported presence only; no secret value was transferred.

The [current shadcn chart documentation](https://ui.shadcn.com/docs/components/radix/chart) uses Recharts v3. Exact selected-block dependencies still need entitled source inspection. Root lacks Radix/Base UI, Lucide and TanStack Table; TanStack Query is a different dependency. Use one primitive family, deliberate aliases and scoped token mapping from the [setup](https://www.shadcnblocks.com/docs/blocks/getting-started), [Base UI](https://www.shadcnblocks.com/docs/blocks/base-ui) and [theme](https://www.shadcnblocks.com/docs/blocks/theming) guidance. Preserve unrelated global styling and authentication/data contracts.

Later founder clarification prioritizes research and simple internal metrics. After Exchange review, keep UI frozen until a useful small desk change is commissioned; no automatic Shadcn pass. A subsequent accepted change can inspect selected source and name exact component/dependency changes. Existing independent critique and honest-fixture requirements continue to apply.
