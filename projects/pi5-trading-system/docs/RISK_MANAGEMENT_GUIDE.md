# Risk & Portfolio Management Guide

Complete guide to managing risk and optimizing capital allocation across trading strategies.

## Table of Contents

1. [Overview](#overview)
2. [Position Sizing](#position-sizing)
3. [Portfolio Risk Management](#portfolio-risk-management)
4. [Dynamic Allocation](#dynamic-allocation)
5. [Best Practices](#best-practices)
6. [Examples](#examples)

## Overview

The Pi5 Trading System provides professional-grade risk management tools:

- **Position Sizing**: Determine optimal trade sizes based on risk
- **Portfolio Risk Limits**: Protect capital with hard stops
- **Dynamic Allocation**: Adapt to changing performance
- **Correlation Analysis**: Diversify strategy risk

### Why Risk Management Matters

- **Preserve Capital**: Losing 50% requires 100% gain to recover
- **Consistency**: Small, consistent gains beat volatile wins/losses
- **Psychological**: Defined rules prevent emotional decisions
- **Scalability**: Proven risk management allows larger capital

## Position Sizing

Position sizing determines how many shares to trade based on your risk tolerance.

### Available Methods

#### 1. Fixed Dollar Risk

Risk a fixed dollar amount per trade.

```go
sizer := risk.NewFixedDollarRiskSizer(500.0) // Risk $500 per trade

accountValue := 100000.0  // $100k account
entryPrice := 475.50      // Entry at $475.50
stopLoss := 470.00        // Stop at $470.00

shares, _ := sizer.CalculateSize(accountValue, entryPrice, stopLoss)
// Result: 90 shares (500 / (475.50 - 470.00))
```

**Pros**:
- Simple and predictable
- Easy to understand
- Consistent risk across all trades

**Cons**:
- Doesn't scale with account size
- May be too conservative or aggressive as account grows

**Best For**: Beginners, accounts < $50k

#### 2. Percent Risk

Risk a percentage of your account per trade.

```go
sizer := risk.NewPercentRiskSizer(0.01, 0.20)
// Risk 1% per trade, max 20% position size

accountValue := 100000.0
entryPrice := 475.50
stopLoss := 470.00

shares, _ := sizer.CalculateSize(accountValue, entryPrice, stopLoss)
// Result: 181 shares (1000 / 5.50, capped at 20% of account)
```

**Pros**:
- Scales with account size
- Percentage-based limits are intuitive
- Prevents oversized positions

**Cons**:
- Can be aggressive if stop is tight
- Requires discipline to set proper stops

**Best For**: Most traders, accounts $50k+

#### 3. Kelly Criterion

Mathematically optimal position sizing based on edge.

```go
sizer := risk.NewKellyCriterionSizer(
    0.55,  // 55% win rate
    150.0, // Average win $150
    100.0, // Average loss $100
    0.25,  // Use 25% of Kelly (fractional Kelly for safety)
    0.30,  // Max 30% per position
)

shares, _ := sizer.CalculateSize(accountValue, entryPrice, stopLoss)
```

**Kelly Formula**: `f = (p * (b + 1) - 1) / b`

Where:
- `f` = fraction of capital to bet
- `p` = win probability
- `b` = win/loss ratio (avg win / avg loss)

**Fractional Kelly**: Use 25-50% of full Kelly for safety.

**Pros**:
- Theoretically optimal for long-term growth
- Accounts for win rate and payoff ratio
- Self-adjusts to strategy edge

**Cons**:
- Requires accurate win rate/payoff estimates
- Full Kelly is too aggressive (use fractional)
- More complex to implement

**Best For**: Experienced traders with well-tested strategies

#### 4. Fixed Fractional

Allocate a fixed percentage of account to each position.

```go
sizer := risk.NewFixedFractionalSizer(0.05) // 5% per position

shares, _ := sizer.CalculateSize(accountValue, entryPrice, stopLoss)
// Result: 105 shares ($100k * 0.05 / $475.50)
```

**Pros**:
- Very simple
- Automatically scales with account
- Easy to implement

**Cons**:
- Ignores stop loss distance (higher risk with wide stops)
- May violate risk limits
- Not optimal for risk-adjusted returns

**Best For**: Simple strategies, index/ETF trading

#### 5. Volatility Adjusted (ATR-Based)

Adjusts position size based on volatility.

```go
sizer := risk.NewVolatilityAdjustedSizer(
    0.015, // Risk 1.5% of account
    2.0,   // Use 2x ATR for stop
    0.25,  // Max 25% position
)

atr := 3.50 // Current ATR
shares, _ := sizer.CalculateSize(accountValue, entryPrice, atr)
// Result: Larger position when ATR is low, smaller when high
```

**Pros**:
- Adapts to market volatility
- Smaller positions in volatile markets (safer)
- Larger positions in calm markets (higher returns)

**Cons**:
- Requires ATR calculation
- May miss opportunities in volatile markets
- More complex

**Best For**: Day traders, volatility-sensitive strategies

### Comparison Example

Given:
- Account: $100,000
- Entry: $475.50
- Stop: $470.00 (5.50 risk per share)

| Method | Shares | Position Value | $ Risk |
|--------|--------|----------------|--------|
| Fixed Dollar ($500) | 91 | $43,271 | $500 |
| Percent Risk (1%) | 182 | $86,541 | $1,000 |
| Kelly (0.25 fraction) | 158 | $75,129 | $869 |
| Fixed Fractional (5%) | 105 | $49,928 | $578 |
| Volatility (ATR 3.5, 2x) | 214 | $101,737 | $1,177 |

**Recommendation**: Start with Percent Risk (1-2%) for most strategies.

## Portfolio Risk Management

Manages risk across all strategies in your portfolio.

### Risk Limits

```go
limits := &risk.PortfolioRiskLimits{
    MaxPortfolioDrawdownPct: 15.0,  // Stop all trading at 15% DD
    MaxDailyLoss:            3000.0, // Max $3k loss per day
    MaxConcurrentPositions:  5,      // Max 5 positions at once
    MaxCorrelation:          0.7,    // Max 0.7 correlation between strategies
    MinCashReserve:          10000,  // Keep $10k in cash
    MaxLeverage:             1.5,    // Max 1.5x leverage
}

manager := risk.NewPortfolioRiskManager(limits, 100000.0)
```

### Pre-Configured Risk Profiles

#### Conservative (Retirement, Low Risk Tolerance)

```go
limits := risk.ConservativeRiskLimits()
// MaxDD: 10%, DailyLoss: $2k, Positions: 3, Leverage: 1.0x
```

#### Default (Balanced, Most Traders)

```go
limits := risk.DefaultRiskLimits()
// MaxDD: 15%, DailyLoss: $3k, Positions: 5, Leverage: 1.5x
```

#### Aggressive (Experienced, Higher Risk Tolerance)

```go
limits := risk.AggressiveRiskLimits()
// MaxDD: 25%, DailyLoss: $5k, Positions: 10, Leverage: 2.0x
```

### Monitoring Portfolio State

```go
// Update equity
manager.UpdateEquity(102500.0)

// Update positions
manager.UpdatePositions("rsi_strategy", 2)
manager.UpdatePositions("vwap_strategy", 1)

// Check if trading allowed
canTrade, reason := manager.CanTrade("rsi_strategy")
if !canTrade {
    log.Printf("Trading halted: %s", reason)
}

// Get status
fmt.Println(manager.GetRiskStatus())
// Output: "🟢 RISK OK: All limits within normal range"
//     or: "🟡 WARNING: [Drawdown near limit]"
//     or: "🔴 RISK LIMIT VIOLATED: Daily loss $3500 exceeds limit $3000"
```

### Daily Workflow

```go
// Start of day
manager.ResetDailyTracking()

// During trading
for {
    // Before each trade
    canTrade, _ := manager.CanTrade("strategy_id")
    if !canTrade {
        break // Stop trading for the day
    }

    // Execute trade...

    // After each trade
    manager.UpdateEquity(newEquity)
    manager.UpdatePositions("strategy_id", currentPositions)
}

// End of day
fmt.Println(manager.GetPortfolioSummary())
```

### Output Example

```
Portfolio Summary
═══════════════════════════════════════════════════
Total Equity:      $102,500.00
Cash:              $45,000.00 (43.9%)
Position Value:    $57,500.00 (56.1%)
Peak Equity:       $103,200.00
Current Drawdown:  $700.00 (0.68%)
Daily P&L:         $2,500.00
Open Positions:    3
Leverage:          1.06x
───────────────────────────────────────────────────
Risk Limits:
  Max DD:          15.0%
  Max Daily Loss:  $3000.00
  Max Positions:   5
  Max Leverage:    1.50x
  Min Cash:        $10000.00
═══════════════════════════════════════════════════
```

## Dynamic Allocation

Automatically adjust capital allocation based on strategy performance.

### Allocation Methods

#### 1. Equal Weight

Simplest method - allocate equally to all strategies.

```go
allocator := risk.NewDynamicAllocator(risk.AllocationEqualWeight)
allocations, _ := allocator.CalculateAllocations(manager,
    []string{"rsi_strategy", "vwap_strategy", "bb_strategy"})

// Result: Each strategy gets 33.3%
```

**Best For**: Uncorrelated strategies, initial allocation

#### 2. Performance Weighted

Allocate more to recently profitable strategies.

```go
allocator := risk.NewDynamicAllocator(risk.AllocationPerformanceWeighted)
allocator.LookbackPeriod = 30 // Use last 30 days

allocations, _ := allocator.CalculateAllocations(manager, strategies)

// Example Result:
// rsi_strategy: 45% (strong recent returns)
// vwap_strategy: 35% (moderate returns)
// bb_strategy: 20% (weak returns)
```

**Best For**: Momentum-based allocation, trending strategies

#### 3. Sharpe Weighted

Allocate based on risk-adjusted returns (Sharpe ratio).

```go
allocator := risk.NewDynamicAllocator(risk.AllocationSharpeWeighted)

allocations, _ := allocator.CalculateAllocations(manager, strategies)

// Example Result (based on Sharpe ratios):
// rsi_strategy: 40% (Sharpe 1.8)
// vwap_strategy: 35% (Sharpe 1.5)
// bb_strategy: 25% (Sharpe 1.1)
```

**Best For**: Risk-conscious traders, long-term allocation

#### 4. Risk Parity

Equalize risk contribution across strategies.

```go
allocator := risk.NewDynamicAllocator(risk.AllocationRiskParity)

allocations, _ := allocator.CalculateAllocations(manager, strategies)

// Lower allocation to high-volatility strategies
// Higher allocation to low-volatility strategies
```

**Best For**: Diversified portfolios, uncorrelated strategies

#### 5. Adaptive Kelly

Use Kelly Criterion with recent performance stats.

```go
allocator := risk.NewDynamicAllocator(risk.AllocationAdaptiveKelly)

allocations, _ := allocator.CalculateAllocations(manager, strategies)

// Allocates based on edge (win rate × payoff ratio)
```

**Best For**: Sophisticated traders, well-tested strategies

### Rebalancing

```go
allocator := risk.NewDynamicAllocator(risk.AllocationSharpeWeighted)
allocator.RebalanceThreshold = 0.02  // Rebalance if 2% change
allocator.AdaptationSpeed = 0.3      // Adapt 30% per rebalance

currentAllocations := manager.Allocations
newAllocations, _ := allocator.CalculateAllocations(manager, strategies)

// Check if rebalance needed
if allocator.ShouldRebalance(currentAllocations, newAllocations) {
    // Blend old and new (gradual transition)
    blended := allocator.BlendAllocations(currentAllocations, newAllocations)

    // Update allocations
    manager.SetAllocations(blended)

    // Generate report
    report := risk.GenerateAllocationReport(
        allocator.Method,
        currentAllocations,
        blended,
        true,
    )
    fmt.Println(report.PrintReport())
}
```

### Allocation Report Example

```
═══════════════════════════════════════════════════════════════
               ALLOCATION REBALANCE REPORT
═══════════════════════════════════════════════════════════════
Timestamp:       2024-03-15 14:30:00
Method:          sharpe_weighted
Rebalanced:      true
Total Change:    8.50%
───────────────────────────────────────────────────────────────
Strategy                  Old        New     Change  Change%
───────────────────────────────────────────────────────────────
rsi_strategy             30.0%      38.0%     +8.0%   +26.7%
vwap_strategy            35.0%      32.0%     -3.0%    -8.6%
bb_strategy              35.0%      30.0%     -5.0%   -14.3%
═══════════════════════════════════════════════════════════════
```

## Best Practices

### 1. Start Conservative

Begin with conservative limits and gradually increase as you gain confidence:

```go
// Month 1: Conservative
limits := risk.ConservativeRiskLimits()

// Month 3: Default (if performing well)
limits := risk.DefaultRiskLimits()

// Month 6+: Custom based on experience
limits := &risk.PortfolioRiskLimits{
    MaxPortfolioDrawdownPct: 12.0,  // Custom limit
    // ... other limits
}
```

### 2. Use Percent Risk Sizing

For most traders, percent risk (1-2%) is optimal:

```go
sizer := risk.NewPercentRiskSizer(0.02, 0.25)
// Risk 2% per trade, max 25% position size
```

### 3. Diversify Across Strategies

Don't put all capital in one strategy:

```go
// Bad: All capital in one strategy
allocations := []risk.StrategyAllocation{
    {StrategyID: "rsi_strategy", Allocation: 1.0, Active: true},
}

// Good: Diversified across multiple strategies
allocations := []risk.StrategyAllocation{
    {StrategyID: "rsi_strategy", Allocation: 0.35, Active: true},
    {StrategyID: "vwap_strategy", Allocation: 0.35, Active: true},
    {StrategyID: "bb_strategy", Allocation: 0.30, Active: true},
}
```

### 4. Monitor Correlation

High correlation = concentrated risk:

```go
correlationMatrix := manager.CalculateCorrelationMatrix()

// If rsi_strategy and vwap_strategy have 0.9 correlation:
// - They'll likely win/lose together
// - Diversification benefit is minimal
// - Consider reducing allocation or finding uncorrelated strategies
```

### 5. Respect Daily Loss Limits

Once hit, stop trading for the day:

```go
for {
    canTrade, reason := manager.CanTrade("strategy_id")
    if !canTrade {
        log.Printf("Stopping: %s", reason)
        break // STOP - don't revenge trade
    }

    // Trade...
}
```

### 6. Rebalance Periodically

Weekly or monthly rebalancing prevents strategy drift:

```go
// Weekly rebalancing schedule
if time.Now().Weekday() == time.Friday {
    // Calculate new allocations
    newAlloc, _ := allocator.CalculateAllocations(manager, strategies)

    // Apply if significant change
    if allocator.ShouldRebalance(manager.Allocations, newAlloc) {
        manager.SetAllocations(newAlloc)
    }
}
```

### 7. Scale Position Size with Account

As account grows, position size should too (if using % risk):

```go
// $10k account → Risk $100 (1%)
// $100k account → Risk $1,000 (1%)
// $1M account → Risk $10,000 (1%)

sizer := risk.NewPercentRiskSizer(0.01, 0.20)
// Automatically scales with account size
```

## Examples

### Example 1: Single Strategy with Percent Risk

```go
package main

import (
    "github.com/bikeshrana/pi5-trading-system-go/internal/risk"
)

func main() {
    // Setup position sizer
    sizer := risk.NewPercentRiskSizer(0.02, 0.25)

    // Trade parameters
    accountValue := 50000.0
    entryPrice := 150.00
    stopLoss := 148.50

    // Calculate position size
    shares, err := sizer.CalculateSize(accountValue, entryPrice, stopLoss)
    if err != nil {
        panic(err)
    }

    // Execute trade with calculated size
    fmt.Printf("Account: $%.2f\n", accountValue)
    fmt.Printf("Entry: $%.2f, Stop: $%.2f\n", entryPrice, stopLoss)
    fmt.Printf("Risk per share: $%.2f\n", entryPrice-stopLoss)
    fmt.Printf("Position size: %d shares\n", shares)
    fmt.Printf("Position value: $%.2f\n", float64(shares)*entryPrice)
    fmt.Printf("Total risk: $%.2f (%.2f%%)\n",
        float64(shares)*(entryPrice-stopLoss),
        (float64(shares)*(entryPrice-stopLoss)/accountValue)*100)
}
```

### Example 2: Multi-Strategy Portfolio

```go
package main

import (
    "github.com/bikeshrana/pi5-trading-system-go/internal/risk"
)

func main() {
    // Setup portfolio manager
    limits := risk.DefaultRiskLimits()
    manager := risk.NewPortfolioRiskManager(limits, 100000.0)

    // Set initial allocations
    allocations := []risk.StrategyAllocation{
        {StrategyID: "rsi_mean_reversion", Allocation: 0.40, Active: true},
        {StrategyID: "vwap_bounce", Allocation: 0.35, Active: true},
        {StrategyID: "bollinger_bounce", Allocation: 0.25, Active: true},
    }
    manager.SetAllocations(allocations)

    // Trading loop
    for tradingDay := range tradingDays {
        // Reset daily tracking
        manager.ResetDailyTracking()

        // For each strategy
        for _, allocation := range allocations {
            // Check if can trade
            canTrade, reason := manager.CanTrade(allocation.StrategyID)
            if !canTrade {
                log.Printf("%s: %s", allocation.StrategyID, reason)
                continue
            }

            // Get allocated capital
            capital := manager.GetStrategyAllocation(allocation.StrategyID)

            // Trade with allocated capital...

            // Update positions
            manager.UpdatePositions(allocation.StrategyID, currentPositions)
        }

        // End of day
        manager.UpdateEquity(getCurrentEquity())
        fmt.Println(manager.GetPortfolioSummary())
    }
}
```

### Example 3: Dynamic Rebalancing

```go
package main

import (
    "github.com/bikeshrana/pi5-trading-system-go/internal/risk"
    "time"
)

func main() {
    // Setup
    manager := risk.NewPortfolioRiskManager(risk.DefaultRiskLimits(), 100000.0)
    allocator := risk.NewDynamicAllocator(risk.AllocationSharpeWeighted)
    allocator.RebalanceThreshold = 0.03  // 3% change triggers rebalance
    allocator.LookbackPeriod = 30        // 30 days

    strategies := []string{
        "rsi_mean_reversion",
        "vwap_bounce",
        "bollinger_bounce",
    }

    // Initial allocation
    initialAlloc, _ := allocator.CalculateAllocations(manager, strategies)
    manager.SetAllocations(initialAlloc)

    // Weekly rebalancing
    ticker := time.NewTicker(7 * 24 * time.Hour)
    for range ticker.C {
        // Calculate new allocations based on recent performance
        newAlloc, _ := allocator.CalculateAllocations(manager, strategies)

        // Check if rebalancing warranted
        if allocator.ShouldRebalance(manager.Allocations, newAlloc) {
            // Blend for gradual transition
            blended := allocator.BlendAllocations(manager.Allocations, newAlloc)

            // Apply new allocations
            manager.SetAllocations(blended)

            // Generate and print report
            report := risk.GenerateAllocationReport(
                allocator.Method,
                manager.Allocations,
                blended,
                true,
            )
            fmt.Println(report.PrintReport())
        } else {
            fmt.Println("No rebalancing needed (change < 3%)")
        }
    }
}
```

## Conclusion

Risk management is the foundation of profitable trading:

1. **Start with 1-2% risk per trade** using Percent Risk sizing
2. **Use portfolio-level limits** to protect capital
3. **Diversify across strategies** to reduce correlation
4. **Rebalance periodically** based on performance
5. **Respect your limits** - no exceptions

Remember: **You can't profit if you blow up your account.** Conservative risk management allows you to stay in the game long enough to win.
