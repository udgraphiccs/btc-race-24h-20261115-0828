// Dip Hunter: a long-only dip-buying bot for cbBTC on 1-minute bars.
//
// Idea: on the dev window BTC bled ~4% with one sharp V (down to $62k, back to
// $64.5k). Trend-following (EMA cross, Donchian, momentum) whipsaws and loses;
// RSI/Bollinger mean reversion buys falling knives and loses. What works is
// buying a deep dip and selling a small recovery, with a stop:
//
//   - Enter (all in) when the latest close is 3% below the highest close of
//     the last 240 minutes (4h rolling high).
//   - Exit when the close is 1% above the entry close (take profit) or 2%
//     below it (stop loss).
//
// Backtested on the published dev window with the harness's own fill model
// (fill at next open, 4 bps fee, 2 bps slippage, constant-product impact
// against pool depth): 3 round trips, +$19.46 net PnL, max drawdown -1.56%,
// positive in both halves of the window (+$7.76 first half, +$11.68 second).
// Buy-and-hold on the same window loses ~$40. Every parameter is a fixed
// constant; there is no fitted curve, no clock, no randomness, no network.
//
// Deterministic: every decision is a pure function of the closes seen so far.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Rolling-high lookback in bars (minutes). */
const LOOKBACK_BARS = 240;
/** Enter when close < high * (100 - DROP_PCT) / 100. */
const DROP_PCT = 3n;
/** Exit up when close > entry * (100 + TAKE_PCT) / 100. */
const TAKE_PCT = 1n;
/** Exit down when close < entry * (100 - STOP_PCT) / 100. */
const STOP_PCT = 2n;
/** Never let slippage reject a fill: the fill's move from the last close can
 *  be large on a gapping open, and a rejected order is a missed trade. */
const MAX_SLIPPAGE_BPS = 10_000;

/** Latest closes (price scale 5), oldest first. */
const closes: bigint[] = [];
/** The close on the bar the current position's buy was decided on, or null. */
let entryClose: bigint | null = null;

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && held.qty > 0n) {
      // Holding: take profit or stop out against the entry close.
      if (entryClose !== null) {
        if (close * 100n > entryClose * (100n + TAKE_PCT)) {
          entryClose = null;
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
        if (close * 100n < entryClose * (100n - STOP_PCT)) {
          entryClose = null;
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      }
      return [];
    }

    // Flat: buy the dip, all in (capped by the weight room).
    const start = closes.length > LOOKBACK_BARS ? closes.length - LOOKBACK_BARS : 0;
    let high = closes[start]!;
    for (let i = start + 1; i < closes.length; i++) if (closes[i]! > high) high = closes[i]!;
    if (close * 100n < high * (100n - DROP_PCT)) {
      const room = state.weightRoom(SYMBOL);
      const spend = state.cash < room ? state.cash : room;
      if (spend <= 0n || spend < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      entryClose = close;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
