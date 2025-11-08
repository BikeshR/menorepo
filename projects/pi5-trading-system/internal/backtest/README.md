# Backtesting Framework

The backtesting framework allows you to validate trading strategies using historical market data before risking real capital.

## Features

- **Historical Data Replay**: Simulate strategy execution with real historical bars
- **Transaction Cost Modeling**: Realistic slippage and commission calculations
- **Performance Metrics**: Comprehensive statistics including Sharpe ratio, max drawdown, win rate
- **Risk Management**: Daily loss limits and position size controls
- **Detailed Reporting**: Console reports, trade logs, and daily performance summaries

## Quick Start

### Run a backtest from command line:

```bash
# Basic backtest (last 30 days, SPY, RSI strategy)
go run cmd/backtest/main.go

# Custom date range and symbol
go run cmd/backtest/main.go \
  -symbol QQQ \
  -strategy rsi_mean_reversion \
  -start 2024-01-01 \
  -end 2024-02-01 \
  -capital 100000

# Test different strategy
go run cmd/backtest/main.go \
  -symbol AAPL \
  -strategy vwap_bounce \
  -start 2024-01-01 \
  -end 2024-03-01 \
  -verbose
```

### Available command line flags:

- `-symbol`: Stock symbol to test (default: SPY)
- `-strategy`: Strategy name (default: rsi_mean_reversion)
  - `rsi_mean_reversion`
  - `bollinger_band_bounce`
  - `vwap_bounce`
  - `opening_range_breakout`
  - `ma_crossover`
- `-start`: Start date in YYYY-MM-DD format (default: 30 days ago)
- `-end`: End date in YYYY-MM-DD format (default: yesterday)
- `-capital`: Initial capital in dollars (default: 100000)
- `-output`: Directory for detailed reports (default: ./backtest_results)
- `-verbose`: Enable detailed logging

## Programmatic Usage

```go
package main

import (
    "context"
    "github.com/bikeshrana/pi5-trading-system-go/internal/backtest"
    "github.com/bikeshrana/pi5-trading-system-go/internal/core/strategy"
    // ... other imports
)

func main() {
    // Create backtest configuration
    cfg := backtest.DefaultConfig()
    cfg.Symbol = "SPY"
    cfg.StartDate = time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
    cfg.EndDate = time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC)
    cfg.InitialCapital = 100000

    // Create strategy
    strat := strategy.NewRSIMeanReversionStrategy(
        "rsi-test",
        []string{"SPY"},
        14,    // RSI period
        30,    // Oversold
        70,    // Overbought
        eventBus,
        logger,
    )

    // Create and run backtest engine
    engine := backtest.NewEngine(cfg, strat, dataClient, eventBus, logger)
    result, err := engine.Run(context.Background())
    if err != nil {
        panic(err)
    }

    // Generate report
    reportGen := backtest.NewReportGenerator(result)
    fmt.Println(reportGen.GenerateConsoleReport())
}
```

## Configuration Options

### Transaction Costs

```go
cfg := backtest.DefaultConfig()
cfg.Commission = 1.0        // $1 per trade
cfg.CommissionPct = 0.001   // 0.1% of trade value
cfg.Slippage = 0.001        // 0.1% slippage
cfg.SlippageModel = "fixed" // or "volume_based"
```

### Risk Management

```go
cfg.MaxPositionSize = 1000      // Maximum 1000 shares
cfg.MaxDailyLoss = 2000         // Stop trading after $2k loss
cfg.MaxDailyLossPct = 0.02      // Or 2% of capital
```

## Performance Metrics

The backtest calculates the following metrics:

### Trade Statistics
- Total trades, winning/losing trades, win rate
- Average trade, average win, average loss
- Largest win, largest loss
- Average trade duration

### Profit Metrics
- Total return ($, %)
- Gross profit, gross loss
- Profit factor (gross profit / gross loss)
- Net profit after costs

### Risk Metrics
- **Max Drawdown**: Peak to trough decline ($ and %)
- **Sharpe Ratio**: Risk-adjusted return (annualized)
- **Sortino Ratio**: Sharpe but only penalizes downside volatility
- **Calmar Ratio**: Return / Max Drawdown
- Max consecutive wins/losses

## Understanding the Results

### Profit Factor
- `>= 2.0`: Excellent (winning trades 2x losing trades)
- `>= 1.5`: Good
- `>= 1.0`: Break-even
- `< 1.0`: Losing strategy

### Sharpe Ratio (annualized)
- `>= 2.0`: Excellent risk-adjusted returns
- `>= 1.0`: Good
- `>= 0.5`: Fair
- `< 0.5`: Poor

### Win Rate
- `>= 60%`: Excellent
- `>= 50%`: Good
- `>= 40%`: Fair (can still be profitable with good risk/reward)
- `< 40%`: Poor

### Max Drawdown
- `<= 10%`: Excellent
- `<= 20%`: Good
- `<= 30%`: Fair
- `> 30%`: High risk

## Example Output

```
═══════════════════════════════════════════════════════════════════════════════
                           BACKTEST RESULTS
═══════════════════════════════════════════════════════════════════════════════

CONFIGURATION
─────────────────────────────────────────────────────────────────────────────
Symbol:           SPY
Timeframe:        1Min
Start Date:       2024-01-01
End Date:         2024-02-01
Duration:         31 days
Initial Capital:  $100000.00

OVERALL PERFORMANCE
─────────────────────────────────────────────────────────────────────────────
Final Capital:    $102450.00
Total Return:     $2450.00 (2.45%)
Net Profit:       $2450.00

TRADE STATISTICS
─────────────────────────────────────────────────────────────────────────────
Total Trades:     45
Winning Trades:   28 (62.2%)
Losing Trades:    17 (37.8%)
Avg Trade:        $54.44
Avg Win:          $125.50
Avg Loss:         -$82.30
Largest Win:      $450.00
Largest Loss:     -$220.00
Avg Duration:     1h 23m

RISK METRICS
─────────────────────────────────────────────────────────────────────────────
Max Drawdown:     $1250.00 (1.25%)
Sharpe Ratio:     1.85
Sortino Ratio:    2.34
Calmar Ratio:     1.96
```

## Output Files

Backtest results are saved to `./backtest_results/` by default:

- `backtest_SPY_20240315_143022.txt`: Full report with all metrics, daily stats, and trade-by-trade log

## Tips for Backtesting

1. **Test Multiple Time Periods**: Don't just test one period. Try bull markets, bear markets, and sideways markets.

2. **Walk-Forward Testing**: Test on one period, optimize, then validate on a different out-of-sample period.

3. **Account for Costs**: Real trading has slippage and commissions. Don't ignore them.

4. **Avoid Over-Optimization**: If you tweak parameters until you get perfect results, you're curve-fitting. Keep it simple.

5. **Check Sample Size**: 10 trades isn't statistically significant. Aim for 30+ trades minimum.

6. **Paper Trade First**: Backtest results ≠ live results. Always paper trade before going live.

7. **Be Conservative**: If backtest shows 20% return, expect 10-15% in live trading.

## Limitations

- **No Market Impact**: Assumes your orders don't move the market (valid for small positions in liquid stocks)
- **Perfect Fills**: Assumes all orders fill instantly at expected price + slippage
- **Historical Bias**: Past performance doesn't guarantee future results
- **Data Quality**: Results depend on quality of historical data

## Next Steps

After backtesting:

1. Review metrics and trade log
2. Identify weaknesses (consecutive losses, drawdown periods)
3. Refine strategy parameters
4. Test on different symbols and time periods
5. Paper trade for 4-6 weeks
6. Start with small position sizes in live trading
7. Scale up gradually as strategy proves itself
