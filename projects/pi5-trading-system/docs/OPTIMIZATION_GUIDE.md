# Strategy Optimization Guide

Complete guide to optimizing and validating trading strategies using the Pi5 Trading System.

## Table of Contents

1. [Overview](#overview)
2. [Grid Search Optimization](#grid-search-optimization)
3. [Walk-Forward Analysis](#walk-forward-analysis)
4. [Monte Carlo Simulation](#monte-carlo-simulation)
5. [Visualization](#visualization)
6. [Best Practices](#best-practices)
7. [Common Pitfalls](#common-pitfalls)

## Overview

The Pi5 Trading System provides three powerful tools for strategy validation:

- **Grid Search**: Find optimal parameters by testing all combinations
- **Walk-Forward Analysis**: Validate strategy robustness over time
- **Monte Carlo Simulation**: Test if results are due to skill or luck

### Why Optimize?

Default parameters rarely produce optimal results. Optimization helps you:
- Maximize risk-adjusted returns
- Minimize drawdowns
- Adapt strategies to different market conditions
- Validate that strategies aren't overfitted

## Grid Search Optimization

Grid search tests every combination of parameters to find the best settings.

### Basic Usage

```bash
go run cmd/optimize/main.go \
  -mode grid \
  -symbol SPY \
  -strategy rsi_mean_reversion \
  -start 2024-01-01 \
  -end 2024-03-01 \
  -workers 4 \
  -metric sharpe_ratio
```

### Parameters

- `-symbol`: Stock to optimize on (default: SPY)
- `-strategy`: Strategy name
  - `rsi_mean_reversion`
  - `bollinger_band_bounce`
  - `vwap_bounce`
  - `opening_range_breakout`
- `-start`, `-end`: Date range for optimization
- `-workers`: Number of parallel workers (default: 4)
- `-metric`: Optimization metric
  - `sharpe_ratio` (recommended - risk-adjusted)
  - `total_return` (maximize return %)
  - `profit_factor` (gross profit / gross loss)
  - `sortino_ratio` (downside risk only)
  - `calmar_ratio` (return / max drawdown)
- `-output`: Output directory (default: ./optimization_results)
- `-capital`: Initial capital (default: $100,000)

### Parameter Ranges

Default parameter ranges for each strategy:

**RSI Mean Reversion**:
- `rsi_period`: 10, 12, 14, 16, 18, 20
- `oversold_threshold`: 25, 30, 35
- `overbought_threshold`: 65, 70, 75

**Bollinger Band Bounce**:
- `period`: 15, 20, 25
- `std_dev`: 1.5, 2.0, 2.5

**VWAP Bounce**:
- `bounce_tolerance_pct`: 0.001, 0.002, 0.003, 0.004, 0.005
- `target_profit_pct`: 0.005, 0.010, 0.015
- `ema_period`: 15, 20, 25

**Opening Range Breakout**:
- `range_minutes`: 10, 20, 30
- `atr_period`: 10, 15, 20

### Example Output

```
═══════════════════════════════════════════════════════════════════════════════
                    OPTIMIZATION RESULTS (Top 10)
═══════════════════════════════════════════════════════════════════════════════

Rank #1
─────────────────────────────────────────────────────────────────────────────
Parameters:
  overbought_threshold: 70
  oversold_threshold: 30
  rsi_period: 14

Performance:
  Metric Value:  2.1534
  Total Return:  4.25%
  Sharpe Ratio:  2.15
  Max Drawdown:  1.85%
  Profit Factor: 2.45
  Win Rate:      61.2%
  Total Trades:  38
```

### Interpreting Results

1. **Rank #1** shows the best parameter combination based on your metric
2. **Metric Value** is the optimization target (e.g., Sharpe ratio)
3. **Total Trades** should be >= 30 for statistical significance
4. **Win Rate** of 50-60% is good (higher isn't always better)
5. **Profit Factor** >= 1.5 is good, >= 2.0 is excellent

### Tips

- Use **Sharpe ratio** as primary metric (balances return and risk)
- Test on at least 30-60 days of data
- Require minimum 30 trades for valid results
- Compare top 5 results to find stable parameters
- Avoid parameters that only work in one rank (overfitting)

## Walk-Forward Analysis

Walk-forward analysis prevents overfitting by simulating realistic trading:
1. Optimize on in-sample period (e.g., 30 days)
2. Test on out-of-sample period (e.g., 10 days)
3. Roll forward and repeat
4. Combine all out-of-sample results

This mimics real trading where you periodically re-optimize.

### Basic Usage

```bash
go run cmd/optimize/main.go \
  -mode walkforward \
  -symbol QQQ \
  -strategy rsi_mean_reversion \
  -start 2024-01-01 \
  -end 2024-04-01 \
  -workers 4
```

### How It Works

For a 90-day period with 30-day in-sample and 10-day out-of-sample:

```
Period 1:
  In-Sample:  Jan 1 - Jan 30  (optimize)
  Out-Sample: Jan 31 - Feb 9  (test)

Period 2:
  In-Sample:  Jan 11 - Feb 9  (optimize)
  Out-Sample: Feb 10 - Feb 19 (test)

Period 3:
  In-Sample:  Jan 21 - Feb 19 (optimize)
  Out-Sample: Feb 20 - Mar 1  (test)
...
```

### Example Output

```
═══════════════════════════════════════════════════════════════════════════════
                      WALK-FORWARD ANALYSIS RESULTS
═══════════════════════════════════════════════════════════════════════════════

AGGREGATE RESULTS
─────────────────────────────────────────────────────────────────────────────
Avg In-Sample Metric:     1.8542
Avg Out-of-Sample Metric: 1.4231
Avg Performance Ratio:    0.7677 (OOS/IS)
Periods with Positive OOS: 6 / 8 (75.0%)

COMBINED OUT-OF-SAMPLE PERFORMANCE
─────────────────────────────────────────────────────────────────────────────
Total Return:         3.45%
Avg Sharpe Ratio:     1.42
Max Drawdown:         2.15%
Total Trades:         64
Win Rate:             58.3%
```

### Interpreting Results

**Performance Ratio**: OOS / IS metric
- `>= 0.8`: Excellent (OOS performance close to IS)
- `0.6 - 0.8`: Good (some degradation expected)
- `< 0.6`: Poor (overfitting, parameters don't generalize)

**Periods with Positive OOS**:
- `>= 70%`: Good consistency
- `50-70%`: Moderate consistency
- `< 50%`: Inconsistent, may not be robust

**Combined OOS Return**:
- This is the realistic estimate of future performance
- Should be positive for viable strategy
- Compare to buy-and-hold

### Tips

- Performance ratio of 0.7-0.8 is realistic
- Prefer strategies with consistent positive OOS periods
- OOS Sharpe > 1.0 is good for day trading
- If ratio < 0.5, strategy is likely overfitted

## Monte Carlo Simulation

Monte Carlo tests robustness by randomly shuffling trade sequences. If a strategy's good performance depends on specific trade order, results will vary widely. Robust strategies show consistent results regardless of trade order.

### Basic Usage

```bash
go run cmd/optimize/main.go \
  -mode montecarlo \
  -symbol SPY \
  -strategy rsi_mean_reversion \
  -start 2024-01-01 \
  -end 2024-02-01
```

### How It Works

1. Run a standard backtest to get actual trades
2. Randomly shuffle trades (bootstrap sampling)
3. Recalculate equity curve and metrics
4. Repeat 1,000 times
5. Analyze distribution of outcomes

### Example Output

```
═══════════════════════════════════════════════════════════════════════════════
                      MONTE CARLO SIMULATION RESULTS
═══════════════════════════════════════════════════════════════════════════════

FINAL RETURN STATISTICS
─────────────────────────────────────────────────────────────────────────────
Mean:                 2.45%
Median:               2.38%
Std Deviation:        0.82%
Minimum:              0.15%
Maximum:              4.92%
95% Confidence Int.:  1.12% to 3.85%

RISK METRICS
─────────────────────────────────────────────────────────────────────────────
Probability of Profit:    87.3%
Probability of 10% Target: 12.5%
Risk of Ruin (>50% DD):   1.2%

INTERPRETATION
─────────────────────────────────────────────────────────────────────────────
✓ High probability of profit (>= 70%)
✓ Low risk of ruin (<= 5%)
✓ Low variability in outcomes
```

### Interpreting Results

**Probability of Profit**:
- `>= 80%`: Excellent (very likely to profit)
- `60-80%`: Good
- `< 60%`: Risky (significant chance of loss)

**Risk of Ruin** (>50% drawdown):
- `<= 5%`: Low risk
- `5-15%`: Moderate risk
- `> 15%`: High risk (dangerous)

**Coefficient of Variation** (Std Dev / Mean):
- `<= 0.5`: Low variability (consistent)
- `0.5-1.0`: Moderate variability
- `> 1.0`: High variability (luck-based)

**95% Confidence Interval**:
- Your true return likely falls in this range
- Narrower is better (more predictable)
- If includes 0 or negative, strategy is risky

### Tips

- Probability of profit >= 70% is minimum for viable strategy
- Risk of ruin should be < 10%
- If std deviation is large relative to mean, results may be luck
- Use 95% CI lower bound as conservative return estimate

## Visualization

After running optimizations, export data for visualization.

### Automatic Export

Monte Carlo mode automatically exports:
- `visualization_data.json` - All data in JSON format
- `equity_curve.csv` - Equity over time
- `trades.csv` - Individual trade details
- `monthly_returns.csv` - Monthly P&L
- `plot_backtest.py` - Python plotting script

### Using the Python Script

```bash
# Navigate to output directory
cd optimization_results

# Install dependencies
pip install pandas matplotlib seaborn

# Generate plots
python plot_backtest.py
```

This creates `backtest_visualization.png` with 6 subplots:
1. Equity curve
2. Cumulative returns
3. Drawdown over time
4. Trade P&L distribution
5. Trade returns % distribution
6. Monthly P&L

### Manual Visualization

Use the CSV files with Excel, Google Sheets, or any data visualization tool.

**Equity Curve CSV**:
```
Timestamp,Equity,Cash,Drawdown,DrawdownPct,CumulativeReturn
2024-01-01T09:30:00Z,100000.00,100000.00,0.00,0.00,0.00
2024-01-01T10:00:00Z,100125.50,100125.50,0.00,0.00,0.13
```

**Trades CSV**:
```
TradeID,Symbol,Side,EntryTime,EntryPrice,ExitTime,ExitPrice,NetProfit,ReturnPct
1,SPY,LONG,2024-01-01T09:35:00Z,475.20,2024-01-01T11:15:00Z,476.15,142.50,0.30
```

## Best Practices

### 1. Multiple Time Periods

Test on different market conditions:
- Bull market (rising prices)
- Bear market (falling prices)
- Sideways market (choppy, no trend)

Example:
```bash
# Bull market (Jan-Mar 2024)
go run cmd/optimize/main.go -start 2024-01-01 -end 2024-03-01

# Bear market (Aug-Oct 2023)
go run cmd/optimize/main.go -start 2023-08-01 -end 2023-10-01

# Sideways market
go run cmd/optimize/main.go -start 2023-11-01 -end 2024-01-01
```

### 2. Multiple Symbols

Test on correlated symbols to verify robustness:
```bash
go run cmd/optimize/main.go -symbol SPY
go run cmd/optimize/main.go -symbol QQQ
go run cmd/optimize/main.go -symbol IWM
```

If parameters work well on all three, strategy is robust.

### 3. Conservative Position Sizing

After optimization, use conservative position sizes:
- Start with 25-50% of optimized size
- Increase gradually as strategy proves itself
- Never risk more than 2% of capital per trade

### 4. Realistic Expectations

Adjust expected returns based on testing:
- **Backtest return**: 20%
- **Walk-forward OOS return**: 14% (ratio 0.7)
- **Monte Carlo 95% CI lower**: 8%
- **Realistic expectation**: 6-10% (50% of backtest)

### 5. Regular Re-optimization

Markets change. Re-optimize periodically:
- Monthly: Check if current parameters still work
- Quarterly: Full walk-forward analysis
- After major market events: Validate robustness

### 6. Combine Multiple Metrics

Don't optimize for just one metric. Check all:
- Primary: Sharpe ratio (risk-adjusted return)
- Secondary: Max drawdown (risk management)
- Tertiary: Win rate, profit factor (consistency)

Example ranking:
1. Sharpe >= 1.5 AND Max DD <= 15%
2. Sort by Sharpe descending

## Common Pitfalls

### 1. Overfitting (Curve Fitting)

**Problem**: Parameters work perfectly on historical data but fail in live trading.

**Signs**:
- Walk-forward ratio < 0.5
- Works on only one symbol/time period
- Requires very specific parameters
- Too many parameters (>5)

**Solution**:
- Use walk-forward analysis
- Test on multiple symbols
- Require minimum 30 trades
- Prefer simple strategies

### 2. Look-Ahead Bias

**Problem**: Using future information not available at trade time.

**Examples**:
- Using today's closing price to make today's entry decision
- Calculating indicators using data from future bars

**Solution**:
- Be careful with indicator calculations
- Review strategy logic carefully
- Test with time-based assertions

### 3. Survivorship Bias

**Problem**: Testing only on stocks that still exist today.

**Example**: Testing 2020-2024 on current S&P 500 stocks ignores stocks that failed and were removed.

**Solution**:
- Test on index ETFs (SPY, QQQ) instead
- Use point-in-time constituent lists
- Be aware historical data may be biased

### 4. Too Many Parameters

**Problem**: More parameters = more ways to overfit.

**Signs**:
- Strategy has >5 adjustable parameters
- Adding parameters keeps improving backtest
- Small parameter changes cause large performance swings

**Solution**:
- Keep strategies simple (2-4 parameters)
- Use fixed values for minor parameters
- Test parameter stability

### 5. Ignoring Transaction Costs

**Problem**: Strategies look profitable but fees eat all profits.

**Example**: Strategy with 200 trades/day @ $1/trade = $200/day in fees

**Solution**:
- Always include realistic commissions ($1/trade minimum)
- Add slippage (0.1-0.2% per trade)
- Avoid high-frequency strategies with free data

### 6. Insufficient Data

**Problem**: Not enough trades for statistical significance.

**Rule of Thumb**:
- Minimum 30 trades for basic validity
- Prefer 100+ trades for robust strategies
- More trades = more confidence

**Solution**:
- Test on longer time periods
- Test on multiple symbols
- Use walk-forward to accumulate more OOS trades

### 7. Cherry-Picking Results

**Problem**: Only showing the best results, hiding the bad ones.

**Example**: "This strategy has 150% annual return!" (tested on only Q1 2020)

**Solution**:
- Test full years (all 4 quarters)
- Report all walk-forward periods, not just best
- Use Monte Carlo to show range of outcomes

## Optimization Workflow

Recommended step-by-step workflow:

### Step 1: Initial Backtest (Week 1)

```bash
# Run basic backtest with default parameters
go run cmd/backtest/main.go \
  -symbol SPY \
  -strategy rsi_mean_reversion \
  -start 2024-01-01 \
  -end 2024-03-01
```

**Goal**: Verify strategy works at all. If default parameters show promise, proceed.

### Step 2: Grid Search (Week 1)

```bash
# Optimize parameters
go run cmd/optimize/main.go \
  -mode grid \
  -symbol SPY \
  -strategy rsi_mean_reversion \
  -start 2024-01-01 \
  -end 2024-03-01 \
  -metric sharpe_ratio
```

**Goal**: Find optimal parameters. Save top 5 parameter sets.

### Step 3: Walk-Forward Validation (Week 2)

```bash
# Validate parameters don't overfit
go run cmd/optimize/main.go \
  -mode walkforward \
  -symbol SPY \
  -strategy rsi_mean_reversion \
  -start 2023-10-01 \
  -end 2024-03-01
```

**Goal**: Confirm parameters work out-of-sample. OOS ratio should be >= 0.6.

### Step 4: Monte Carlo Robustness (Week 2)

```bash
# Test robustness
go run cmd/optimize/main.go \
  -mode montecarlo \
  -symbol SPY \
  -strategy rsi_mean_reversion \
  -start 2024-01-01 \
  -end 2024-03-01
```

**Goal**: Verify consistent outcomes. Probability of profit should be >= 70%.

### Step 5: Multi-Symbol Test (Week 3)

```bash
# Test on correlated symbols
go run cmd/optimize/main.go -mode walkforward -symbol QQQ -start 2023-10-01 -end 2024-03-01
go run cmd/optimize/main.go -mode walkforward -symbol IWM -start 2023-10-01 -end 2024-03-01
```

**Goal**: Confirm parameters work on different instruments.

### Step 6: Paper Trading (Weeks 4-9)

Deploy to paper trading with optimized parameters. Monitor for 4-6 weeks.

**Acceptance Criteria**:
- Returns within 50% of backtest expectation
- Max drawdown <= 1.5x backtest
- Strategy executes without errors
- No major behavioral differences

### Step 7: Live Trading (Week 10+)

Start with 25% of intended position size. Gradually increase to 100% over 4 weeks if performance meets expectations.

## Conclusion

Strategy optimization is both science and art:
- **Science**: Use rigorous testing (walk-forward, Monte Carlo)
- **Art**: Interpret results, consider market context, manage risk

Keys to success:
1. Test on multiple time periods and symbols
2. Use walk-forward to prevent overfitting
3. Require statistical significance (30+ trades)
4. Be conservative with expectations
5. Paper trade before going live

Remember: **No amount of optimization guarantees future profits.** Markets change, strategies degrade, and risk management is paramount.
