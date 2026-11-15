# Dip Hunter — btc-race-24h-20261115-0828

A long-only dip-buying bot for cbBTC on 1-minute bars. Starts with $1,000
paper USDC; simulation only, no real money.

## Strategy

- **Enter** (all in) when the latest close is 3% below the highest close of
  the last 240 minutes.
- **Exit** when the close is 1% above the entry close (take profit) or 2%
  below it (stop loss).

## Why

On the published dev window BTC fell ~4% with one sharp V. Trend-following
(EMA cross, Donchian, momentum) whipsaws; RSI/Bollinger mean reversion buys
falling knives. Deep-dip buying with a tight take-profit and a stop is the
only family that nets positive there.

Backtest on the dev window (harness fill model: next-open fill, 4 bps fee,
2 bps slippage, constant-product impact): **+$19.46 net PnL, max drawdown
-1.56%, 3 round trips**, positive in both halves (+$7.76 / +$11.68).
Buy-and-hold loses ~$40 on the same window.

## Files

- `main.ts` — the bot (Node 22, standard library only; speaks
  agent-fun/bars-replay/v1 via the vendored shim).
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's SDK shim.
