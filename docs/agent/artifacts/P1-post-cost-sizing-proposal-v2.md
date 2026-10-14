# P1 constant-mix post-cost sizing — proposed contract v2 (Fable co-head, for final root challenge)

Date: 2026-09-07 UTC. Self-contained; supersedes v1 (sha256 23b66054…45cd2, preserved unchanged). Closes the "P1 implementation contract pending" gap in accepted-for-planning ETF comparator v4 (sha256 e3611354…bcc04, bytes preserved). Documentation proposal only; no run, data, code, implementation, contact or shared-record change. Weights remain frozen from the development window (v4 §7); nothing selects from outcomes. Root-settled planning choices adopted: exact paper money without cent rounding; no discretionary band beyond the trade increment; owned dust valued at `p` and separately disclosed.

## 1. Definitions at the fill instant (after v4 §5 pre-fill actions)
- `S` exact held shares (exact rational; includes sub-increment dust). Trade increment `u = 10⁻⁶`.
- `p` official open price; `k` per-side all-in cost fraction from the registered scenario (0.0005, 0.001, 0.002).
- `C` available (settled) cash, the only funding source. `Rk` value of acknowledged known dividend receivables (amount known; pay date known or unknown-but-declared): in NAV, never spendable. `U` set of unknown-amount claims.
- `E = S·p` marked equity (dust included). `N0 = E + C + Rk` pre-trade total NAV. `w` fixed target weight.
- All quantities are exact rationals from decimal literals; display values may be rounded but are never fed back into sizing.

## 2. Input domain (checked before any comparison or arithmetic)
Every one of `S, p, C, Rk, w, k` must be a finite exact rational (no float, NaN, infinity or missing value). Then: `S ≥ 0`, `p > 0`, `C ≥ 0`, `Rk ≥ 0`, `0 ≤ w ≤ 1`, `0 ≤ k < 1`. Any failure → `refused_invalid_input` naming the field; no effect. Inherited v4 guards remain refusals: unadmitted `p` (v4 §3), unproven action coverage (v4 §5), and the unknown-claim guard (§6 below).

**Zero total NAV:** if the domain passes and `N0 = 0` (all known assets zero), the state is valid: `q = 0`, no economic effect, `status = zero_nav`, weight and residual reported `unavailable (zero_nav)`. Never `0/0`, never an invented zero exposure.

## 3. Post-trade NAV and target equations
Trading `q` shares changes NAV only by cost: buy `N1 = (S+q)p + (C − q·p·(1+k)) + Rk = N0 − q·p·k`; sell `N1 = (S−q)p + (C + q·p·(1−k)) + Rk = N0 − q·p·k`. Target: equity = `w · N1` (post-trade NAV).
- **Buy** (`E < w·N0`): `q*_buy = (w·N0 − E) / (p·(1 + w·k))`. Bound: `q ≤ C / (p·(1+k))` (no borrowing; receivables never fund).
- **Sell** (`E > w·N0`): `q*_sell = (E − w·N0) / (p·(1 − w·k))` (`w·k < 1` in-domain). Bound: `q ≤ S`.
- **Exact-rational floor:** `q = floor6(min(q*, bound))` where `floor6(a/b) = ⌊(a·10⁶) / b⌋ / 10⁶` computed with integer numerator and denominator; no intermediate rounding and no finite-precision division. If `q < u` → `no_trade_below_increment`. If `E = w·N0` → `exact_target_no_trade`.
- **Ledger effects:** buy `S1 = S + q`, `C1 = C − q·p·(1+k)`; sell `S1 = S − q`, `C1 = C + q·p·(1−k)`; `Rk` unchanged. Dust `S1 − floor6(S1)` retained and disclosed. Full exit at `w = 0` sells `floor6(S)`; sub-increment dust remains.
- **Positivity:** for valid `N0 > 0`, `0 ≤ k < 1` and the bounds: buy `q·p ≤ C/(1+k) ≤ C ≤ N0`, so `N1 = N0 − q·p·k ≥ N0(1−k) > 0`; sell `q·p ≤ E ≤ N0`, same bound. `C1 ≥ 0` by the funding bound; `S1 ≥ 0` by the share bound.
- **Conservation identities (asserted every fill):** `N1 = N0 − q·p·k`; `S1·p + C1 + Rk = N1`; `C1 ≥ 0`; `S1 ≥ 0`; `q` is a multiple of `u`; shares exact through split multiplication.
- **Post-trade weight and residual:** `w1 = S1·p / N1`, `residual = w1 − w`, reported with every applicable cause from {`target` (none), `funding`, `shares`, `increment`}. Multiple causes are listed together (e.g., funding and increment).

## 4. Unmet target: disclosed residual versus denied or refused effect
- **Refused:** any §2 domain failure or inherited v4 admission/coverage guard → no sizing, reason named.
- **Denied:** unknown ownership or valuation (§6) → no new simulated economic effect for that holdings state.
- **Disclosed residual:** in every other case the best feasible trade under the bounds executes, and the shortfall is disclosed with its causes; never a hidden clip.
This qualifies v1's "only" wording: denial is for unknown ownership/valuation; refusal is for invalid inputs and inherited guards; everything else executes with disclosure.

## 5. Relation to v4's all-equity formula
At `w = 1`: `q*_buy = (N0 − E)/(p(1+k)) = (C + Rk)/(p(1+k))`; the funding bound `C/(p(1+k))` with `Rk ≥ 0` makes the executed quantity `floor6(C/(p(1+k)))`, exactly v4 §4's equity-state buy. With `Rk > 0` the residual is disclosed as `funding`. v4 is the `w = 1` special case; its bytes are unchanged.

## 6. Unknown claims — planning addendum (not a statement that v4 already says this)
Root's proposal is incorporated and **supersedes v1 §7 item 3** (the asymmetry that let a cash-funded `w = 1` buy execute under an unknown claim): an unknown-amount claim denies **new simulated economic effects for every affected holdings state across the trend arm, P0 and P1**; observations, admissions and append-only reconciliation continue; known subtotals remain reportable. A known-amount receivable with unknown pay date stays an admitted known receivable in NAV, unspendable until admitted settlement. Claims and dust are never erased, and an invalidated state is never re-armed because a cash-only formula happens to be computable. P2 holds no instrument and has no invented claim; if its own state is unresolved the same guard applies. Comparisons involving affected arms stay withheld. I find no accepted boundary this contradicts: v4 §4 denies complete NAV under unknown claims and v4 §5 pauses new effects after late-discovered actions; this addendum makes the two consistent before any data or run.

## 7. Examples (exact rationals; displayed decimals rounded, marked ≈; k = 0.001 unless stated)
| # | Case | S, p, C, Rk, w | q* (≈) | q executed (exact) | Cash after (exact) | N1 = N0 − q·p·k | w1 (≈) | Status / causes |
|---|---|---|---|---|---|---|---|---|
| 1 | Buy | 100, 500, 60,000, 0, 0.6 | 31.9808115131 | 31.980811 | 43,993.6040945 | 109,984.0095945 | 0.5999999977 | executed; increment (residual ≈ −2.3e-9) |
| 2 | Sell | 200, 400, 10,000, 0, 0.5 | 87.5437718859 | 87.543771 | 44,982.4908916 | 89,964.9824916 | 0.5000000039 | executed; increment |
| 3 | Cash-limited buy, known receivable | 50, 100, 1,000, 2,000, 0.9 | 21.9802178040 | 9.990009 | 0.0000991 | 7,999.0009991 | 0.7499687649 | executed; funding + increment (residual ≈ −0.1500) |
| 4 | Full exit, dust | 12.3456789, 250, 0, 0, 0 | 12.3456789 | 12.345678 | 3,083.3330805 | 3,083.3333055 | ≈7.3e-8 | executed; increment; dust 0.0000009 retained and valued at p |
| 5a | Exact target | 60, 100, 4,000, 0, 0.6 | 0 | none | 4,000 | 10,000 | 0.6 | exact_target_no_trade |
| 5b | Below increment | 60, 100, 4,000.0001, 0, 0.6 | ≈5.996e-7 | none | 4,000.0001 | 10,000.0001 | 0.59999999 | no_trade_below_increment; increment |
| 6a | Unknown-amount claim | 100, 50, 1,000, 0 known + 1 unknown, 0.5 | n/a | none | 1,000 | withheld | withheld | denied_unknown_claim; known_assets_subtotal 6,000 |
| 6b | Control: same inputs, no unknown claim | 100, 50, 1,000, 0, 0.5 | 40.0200100050 | 40.02001 | 2,998.9994995 | 5,997.9989995 | 0.5000000000 | executed; increment |
| 7 | w = 1 vs v4 | 100, 500, 60,000, 0, 1 | 119.8801198801 | 119.880119 = floor6(60,000/500.5) | 0.0004405 | 109,940.0599405 | 0.9999999960 | executed; increment; equals v4 formula |
| 8 | w = 1, known receivable | 100, 500, 60,000, 2,000, 1 | 123.8761238761 | 119.880119 | 0.0004405 | 111,940.0599405 | 0.9821332913 | executed; funding + increment; v4 quantity unchanged |
| 9 | Zero total NAV | 0, 100, 0, 0, 0.6 | n/a | 0 | 0 | 0 | unavailable | zero_nav; no effect |
| 10a | Negative known receivable | 10, 100, 100, −5, 0.5 | n/a | none | 100 | n/a | n/a | refused_invalid_input (Rk) |
| 10b | Non-finite receivable | 10, 100, 100, NaN, 0.5 | n/a | none | 100 | n/a | n/a | refused_invalid_input (Rk) |
| 11 | Known amount, unknown pay date (sell) | 50, 100, 1,000, 2,000 (pay date unknown), 0.5 | 10.0050025013 | 10.005002 | 1,999.4996998 | 7,998.9994998 | 0.5000000063 | executed; increment; receivable in NAV, unspendable |
| 12a | Boundary exact | 0, 100, 1,001, 0, 1 | 10 | 10.000000 | 0 | 1,000 | 1.0 | executed; target (no residual) |
| 12b | Boundary adjacent | 0, 100, 1,000.9999, 0, 1 | 9.9999990010 | 9.999999 | 0.0000001 | 999.9999001 | 0.9999999999 | executed; increment |
| 13 | k = 0 control of case 1 | 100, 500, 60,000, 0, 0.6; k = 0 | 32 | 32.000000 | 44,000 | 110,000 | 0.6 | executed; target; N1 = N0 |
Every executed row satisfies `N1 = N0 − q·p·k` and `S1·p + C1 + Rk = N1` exactly. Row 12b illustrates §3's floor rule: a finite-precision decimal division near a six-decimal boundary can misround, while the integer quotient floor gives 9.999999 unambiguously. These are mathematical examples, not product test results.

## 8. Remaining unresolved choices
None material. Root-settled: exact money, no band, dust valued at `p`. The unknown-claim guard is now symmetric across arms (§6). Actual use still depends on source rights, admission/coverage evidence, C0, R and the later statistical contract, per the planning settlement.
