# Intraday highs/lows — research candidate

Date: 2026-09-06. Source: Constantine supplied a trader’s description and asked for an assessment. Status: proposed hypothesis only; no strategy implementation, data purchase, backtest or live trading commissioned by that question. It does not replace UI002, ARB001 or RH001. Astra’s assessment and an independent bounded methodological challenge are recorded here for continuity.

## Assessment

The description combines two testable ideas: reversal after rejection of an established extreme, and continuation after a close beyond it. It does not supply evidence of current net profitability or universal applicability. The claimed advantage of untouched highs/lows is a separate hypothesis. Clothing, lifestyle claims and selected charts provide no return or risk evidence.

Older New York Fed research examined support/resistance levels published by six firms for three currency pairs in 1996–98 and found more intraday interruptions around those levels than random comparison levels. Another paper studies clustered stop-loss/take-profit orders at a foreign-exchange bank as an explanation for reversals and continuation. These are related evidence, not validation of this exact prior-day/week/session rule, present-day ES/NQ/metals/FX performance or a profitable executable strategy.

Sources checked 2026-09-06:

- [Osler, Support for Resistance (2000)](https://www.newyorkfed.org/medialibrary/media/research/epr/00v06n2/0007osle.pdf).
- [Osler, Currency Orders and Exchange-Rate Dynamics (2001; published 2003)](https://www.newyorkfed.org/research/staff_reports/sr125.html).
- [Bailey et al., The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf): relevant to searching many level/timeframe/filter/exit variants and reporting only the winner.

## Candidate minimal experiment — freeze before data inspection

One instrument and one bar size first; ES with 15-minute signals is an illustrative starting specification because it is one instrument the trader named, not a broker or data-purchase recommendation. Use the previous completed trading day’s high/low. Weekly/session levels, five-minute bars and other instruments would be declared replications, not discretionary ways to rescue an unsuccessful first result.

Specify historical exchange calendar, bar alignment, timezone/DST/holiday handling, executable contract series and a deterministic roll rule. Avoid artificial continuous-futures adjustment jumps when constructing levels. A final day/week/session extreme cannot be used before that period ends. Session replications need exact named start/end/timezone rules; “Asia/London/New York” is insufficient.

Publish a level after its source period closes. Expire it when replaced. Starting from publication, the first trade at or beyond it consumes the level, even when no signal results. This makes untouched status causal and prevents choosing a later, prettier retest.

Test independent strategies:

- Reversal: a first-touch bar trades at least one tick below the prior low and closes at least one tick above it; use the symmetric rule for a high-level short.
- Breakout: a first-touch bar closes at least one tick above the prior high for a long, or below the prior low for a short. No retrospectively selected trend filter or switching to whichever strategy won.

The signal becomes available at bar close. Enter only at the next executable price after a predeclared latency, including spread and costs. Never assume a fill at the earlier touched level after observing the close. An initial fixed horizon of four completed 15-minute bars would measure the entry signal without fitting stop/target parameters; this is an illustrative research exit, not a recommended live risk policy. Any eventual deployable rule also requires explicit risk, sizing, stop, gap and session-end behavior.

One position at a time per strategy; touches while a position is open still consume eligibility. Predetermine handling of missing quotes, gaps, both-level bars and roll transitions, and report exclusions. If only OHLC bars are available, next-open plus slippage is an approximation. Stops/targets in a later experiment need finer chronological data or conservative ordering when both are reached in one bar.

Compare each strategy separately against matched time-of-day entries and the same candle rule without the named historical level. Report net expectancy, trade/opportunity counts, drawdown, turnover, cost sensitivity and concentration by year/session; aggregate correlated signals by trading-day blocks when estimating uncertainty. Check whether untouched levels add information relative to touched levels in a separately declared comparison.

Freeze chronological development/validation/final-test periods before viewing outcomes and retain all attempted variants. Subsequent modifications create new hypotheses and consume fresh validation evidence. A favorable historical result warrants prospective paper observation; it does not establish a future return or authorize real orders.
