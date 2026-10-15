# P1 constant-mix post-cost sizing — proposed contract (Fable co-head, for root challenge)

Date: 2026-09-07 UTC. Closes the "P1 implementation contract pending" gap in accepted-for-planning v4 (sha256 e3611354…bcc04) under the planning settlement. Documentation proposal only; no run, data, code, implementation, contact or shared-record change. Weights remain frozen from the development window (v4 §7); nothing here selects from outcomes.

## 1. Definitions at the fill instant (after v4 §5 pre-fill actions)
- `S` exact held shares (arbitrary decimal precision; includes any sub-increment dust). `u = 0.000001` trade increment. `floor6(x)` rounds toward zero to `u`.
- `p` official open price (> 0, finite decimal). `k` per-side all-in cost fraction from the registered scenario (0.0005, 0.001, 0.002; domain 0 ≤ k < 1).
- `C` available (settled) cash ≥ 0; the only funding source. `Rk` value of acknowledged known dividend receivables ≥ 0; in NAV, never spendable. `U` set of unknown claims.
- `E = S·p` marked equity. `N0 = E + C + Rk` pre-trade total NAV. `w` fixed target weight, 0 ≤ w ≤ 1.
- All arithmetic in exact decimal; no floats; money kept exact (no cent rounding) in the paper ledger.

## 2. Post-trade NAV and target equations
Trading `q` shares changes NAV only by the cost: buy `N1 = (S+q)p + (C − q·p·(1+k)) + Rk = N0 − q·p·k`; sell `N1 = (S−q)p + (C + q·p·(1−k)) + Rk = N0 − q·p·k`. The target is equity = `w · N1` (post-trade NAV, not pre-cost).

- **Buy** (when `E < w·N0`): `(S+q)p = w(N0 − q p k)` ⇒ `q*_buy = (w·N0 − E) / (p·(1 + w·k))`.
- **Sell** (when `E > w·N0`): `(S−q)p = w(N0 − q p k)` ⇒ `q*_sell = (E − w·N0) / (p·(1 − w·k))`. (`w·k < 1` always.)
- **Bounds:** buy `q ≤ C / (p(1+k))` (no borrowing; receivables never fund); sell `q ≤ S`.
- **Executed quantity:** `q = floor6(min(q*, bound))`. If `q < u` → no trade (`no_trade_below_increment`). If `E = w·N0` → `exact_target_no_trade`.
- **Ledger effects:** buy `S1 = S + q`, `C1 = C − q p (1+k) ≥ 0`; sell `S1 = S − q`, `C1 = C + q p (1−k)`. `Rk` unchanged by trading. Dust `S1 − floor6(S1)` retained and reported. Full exit at `w = 0` sells `floor6(S)`; sub-increment dust remains.
- **Conservation identities (asserted every fill):** `N1 = N0 − q·p·k`; `S1·p + C1 + Rk = N1`; `C1 ≥ 0`; `0 ≤ S1`; shares exact through split multiplication; `q` is a six-decimal multiple.
- **Post-trade weight and residual:** `w1 = S1·p / N1`; `residual = w1 − w` reported with its cause (`target`, `funding`, `shares`, `increment`).

## 3. Unmet target: disclosed residual versus denied effect (one rule)
Effects are **denied** only when ownership or valuation is unknown: any unknown claim (`U ≠ ∅`), missing or unadmitted `p`, or unresolved action coverage (v4 §5). Then no P1 trade, `denied_unknown_claim` (or the v4 reason), `known_assets_subtotal` reported, spans withheld. In every other case the best feasible trade under the bounds executes and the shortfall is a **disclosed residual**, never a hidden clip and never a denial. This rule is shared by all cases below.

## 4. Relation to v4's all-equity formula
At `w = 1`: `q*_buy = (N0 − E)/(p(1+k)) = (C + Rk)/(p(1+k))`. With the funding bound `C/(p(1+k))` and `Rk ≥ 0`, the executed quantity is `floor6(C/(p(1+k)))`, exactly v4 §4's equity-state buy. When `Rk > 0` the residual is disclosed as `funding`. v4's formula is the `w = 1` special case; nothing in v4 changes.

## 5. Hand-checkable examples (k = 0.001 in all; exact decimals)
| # | Case | Inputs (S, p, C, Rk, w) | q* | q executed | Cash after | N1 = N0 − q·p·k | Post weight | Outcome |
|---|---|---|---|---|---|---|---|---|
| 1 | Buy | 100, 500, 60,000, 0, 0.6 | 31.980811513… | 31.980811 | 43,993.6040945 | 109,984.0095945 | 0.5999999977 | target; residual −2.3e-9 |
| 2 | Sell | 200, 400, 10,000, 0, 0.5 | 87.543771886… | 87.543771 | 44,982.4908916 | 89,964.9824916 | 0.5000000039 | target; residual +3.9e-9 |
| 3 | Cash-limited buy with receivable | 50, 100, 1,000, 2,000, 0.9 | 21.980217804… | 9.990009 (bound 1,000/100.1) | 0.0000991 | 7,999.0009991 | 0.7499687649 | funding; residual −0.1500 disclosed |
| 4 | Full exit / dust | 12.3456789, 250, 0, 0, 0 | 12.3456789 | 12.345678 | 3,083.3330805 | 3,083.3333055 | 7.3e-8 | shares; dust 0.0000009 retained |
| 5a | Exact target | 60, 100, 4,000, 0, 0.6 | 0 | none | 4,000 | 10,000 | 0.6 | exact_target_no_trade |
| 5b | Below increment | 60, 100, 4,000.0001, 0, 0.6 | 5.996e-7 | none | 4,000.0001 | 10,000.0001 | 0.59999999 | no_trade_below_increment; residual disclosed |
| 6 | Unknown claim | 100, 50, 1,000, 0 known + 1 unknown, 0.5 | undefined | none | 1,000 | withheld | withheld | denied_unknown_claim; known_assets_subtotal 6,000 |
| 7 | w = 1 vs v4 | 100, 500, 60,000, 0, 1 | 119.880119880… | 119.880119 = floor6(60,000/500.5) | 0.0004405 | 109,940.0599405 | 0.9999999960 | equals v4 formula |
| 8 | w = 1 with receivable | 100, 500, 60,000, 2,000, 1 | 123.876123876… | 119.880119 (funding) | 0.0004405 | 111,940.0599405 | 0.9821332913 | funding residual −0.0179 disclosed; v4 quantity unchanged |
Checks: in every executed row `N1 = N0 − q·p·k` holds to the digit (e.g., row 1: 110,000 − 15.9904055 = 109,984.0095945) and `S1·p + C1 + Rk = N1`.

## 6. Valid input domain and refusals
Refuse to size (report reason, no trade) if: `p ≤ 0` or non-finite; `k ∉ [0,1)`; `w ∉ [0,1]`; `C < 0`; `S < 0`; any non-decimal or float input; `U ≠ ∅`; `p` not admitted (v4 §3); action coverage not proven (v4 §5). Zero-effect cases (§2) are outcomes, not refusals.

## 7. Unresolved material choices for root settlement
1. **Money precision:** exact decimal cash (proposed) versus rounding cash to cents at each fill; exactness keeps the conservation identity exact, cents would mirror a broker statement.
2. **No-trade band:** proposed none beyond the one-increment floor. Any tolerance band (e.g., skip trades below 0.1% of NAV) is a parameter that must be registered before data inspection.
3. **Comparator arm under unknown claims:** P1 is denied (needs `N0`). v4's `w = 1` equity-state buy is cash-funded and computable without `N0`; proposed: it may still execute while NAV and comparisons are withheld, consistent with v4 §4. Root should confirm or align both arms to deny.
4. **Dust valuation:** dust is valued at `p` inside `E`; proposed yes (it is owned), reported separately.
