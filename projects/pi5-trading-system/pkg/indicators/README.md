# Technical Indicators Library

**Production-ready technical analysis indicators for day trading**

---

## Overview

This package provides battle-tested technical indicators commonly used in day trading. All indicators follow a consistent interface and are optimized for real-time streaming data.

### Available Indicators

1. **RSI** - Relative Strength Index (momentum oscillator)
2. **EMA** - Exponential Moving Average (trend following)
3. **Bollinger Bands** - Volatility and mean reversion
4. **VWAP** - Volume Weighted Average Price (intraday benchmark)
5. **ATR** - Average True Range (volatility measurement)
6. **MACD** - Moving Average Convergence Divergence (trend + momentum)

---

## Quick Start

```go
package main

import (
    "fmt"
    "time"
    "github.com/bikeshrana/pi5-trading-system-go/pkg/indicators"
)

func main() {
    // Create RSI indicator (14-period)
    rsi := indicators.NewRSI(14)

    // Update with price data
    prices := []float64{100, 102, 101, 103, 105, 104, 106, 108}
    for _, price := range prices {
        rsi.Update(price, time.Now())

        if rsi.IsReady() {
            fmt.Printf("RSI: %.2f\n", rsi.Value())

            if rsi.IsOversold() {
                fmt.Println("Buy signal: Oversold!")
            }
        }
    }
}
```

---

## Indicator Interfaces

### Basic Indicator

```go
type Indicator interface {
    Update(price float64, timestamp time.Time) error
    Value() float64
    IsReady() bool
    Reset()
    Name() string
}
```

### OHLCV Indicator

For indicators that need full bar data (High, Low, Close, Volume):

```go
type OHLCVIndicator interface {
    UpdateOHLCV(bar PricePoint) error
    Value() float64
    IsReady() bool
    Reset()
    Name() string
}
```

### Multi-Value Indicator

For indicators that return multiple values (e.g., Bollinger Bands):

```go
type MultiValueIndicator interface {
    UpdateOHLCV(bar PricePoint) error
    Values() []float64
    IsReady() bool
    Reset()
    Name() string
}
```

---

## RSI (Relative Strength Index)

### What It Does

Measures momentum and identifies overbought/oversold conditions.

**Range**: 0-100
- **> 70**: Overbought (potential sell)
- **< 30**: Oversold (potential buy)

**Period**: Typically 14

### Usage

```go
// Create RSI with 14-period
rsi := indicators.NewRSI(14)

// Update with prices
rsi.Update(150.0, time.Now())

// Check if ready
if rsi.IsReady() {
    value := rsi.Value()

    // Check conditions
    if rsi.IsOversold() {
        fmt.Println("Buy signal!")
    }
    if rsi.IsOverbought() {
        fmt.Println("Sell signal!")
    }

    // Custom thresholds
    if rsi.IsOversoldCustom(25) {
        fmt.Println("Strong buy!")
    }
}
```

### Day Trading Strategy

```go
// RSI Mean Reversion
if rsi.IsOversold() && rsi.Value() < 25 {
    // Strong buy signal
    // Entry: Market order
    // Target: RSI > 50
    // Stop: Below recent low
}
```

---

## EMA (Exponential Moving Average)

### What It Does

Trend-following indicator that gives more weight to recent prices.

**Common Periods**:
- 9 (fast)
- 12 (MACD fast)
- 20 (medium)
- 26 (MACD slow)
- 50 (intermediate trend)
- 200 (long-term trend)

### Usage

```go
// Create EMA with 20-period
ema := indicators.NewEMA(20)

// Update with prices
ema.Update(150.0, time.Now())

if ema.IsReady() {
    value := ema.Value()

    // Price above EMA: Uptrend
    // Price below EMA: Downtrend
}
```

### Day Trading Strategy

```go
// EMA Crossover
ema9 := indicators.NewEMA(9)
ema21 := indicators.NewEMA(21)

// ... update both ...

if ema9.IsReady() && ema21.IsReady() {
    if ema9.Value() > ema21.Value() {
        // Golden cross: Bullish
    } else {
        // Death cross: Bearish
    }
}
```

---

## Bollinger Bands

### What It Does

Measures volatility and identifies potential reversal points.

**Components**:
- Middle Band: 20-period SMA
- Upper Band: Middle + (2 × StdDev)
- Lower Band: Middle - (2 × StdDev)

**Signals**:
- Price touches upper band: Overbought
- Price touches lower band: Oversold
- Bands squeeze: Low volatility (breakout coming)
- Bands expand: High volatility

### Usage

```go
// Create Bollinger Bands (20-period, 2 std dev)
bb := indicators.NewBollingerBands(20, 2.0)

// Update with prices
bb.Update(150.0, time.Now())

if bb.IsReady() {
    middle := bb.Middle()
    upper := bb.Upper()
    lower := bb.Lower()

    // Check position
    currentPrice := 148.0
    if bb.IsBelowLowerBand(currentPrice) {
        fmt.Println("Buy signal: Price below lower band")
    }

    // Check %B
    percentB := bb.PercentB(currentPrice)
    if percentB < 0 {
        fmt.Println("Strong buy: Price below lower band")
    }

    // Check band width
    width := bb.BandWidth()
    fmt.Printf("Volatility: %.2f\n", width)
}
```

### Day Trading Strategy

```go
// Bollinger Band Bounce
currentPrice := 145.0

if bb.IsReady() {
    if bb.IsBelowLowerBand(currentPrice) {
        // Entry: Buy when price touches lower band
        // Target: Middle band
        // Stop: 1 ATR below entry
    }

    if bb.IsAboveUpperBand(currentPrice) {
        // Entry: Sell when price touches upper band
        // Target: Middle band
    }
}
```

---

## VWAP (Volume Weighted Average Price)

### What It Does

Shows the average price weighted by volume for the current trading day. Essential benchmark for day traders.

**Uses**:
- Price above VWAP: Uptrend, support
- Price below VWAP: Downtrend, resistance
- VWAP acts as dynamic support/resistance

**Resets**: Every trading day

### Usage

```go
// Create VWAP
vwap := indicators.NewVWAP()

// Update with OHLCV bars
bar := indicators.PricePoint{
    Open:      150.0,
    High:      152.0,
    Low:       149.0,
    Close:     151.0,
    Volume:    1000000,
    Timestamp: time.Now(),
}

vwap.UpdateOHLCV(bar)

if vwap.IsReady() {
    vwapValue := vwap.Value()

    currentPrice := 151.5
    if vwap.IsPriceAboveVWAP(currentPrice) {
        fmt.Println("Price above VWAP: Bullish")
    }

    // Distance from VWAP
    distance := vwap.PriceDistanceFromVWAP(currentPrice)
    fmt.Printf("Distance from VWAP: %.2f%%\n", distance)
}
```

### Day Trading Strategy

```go
// VWAP Bounce
if vwap.IsReady() {
    currentPrice := getCurrentPrice()
    distance := vwap.PriceDistanceFromVWAP(currentPrice)

    if distance > 0 && distance < 0.3 {
        // Price slightly above VWAP
        // Wait for pullback to VWAP
    }

    if distance > -0.2 && distance < 0.2 {
        // Price near VWAP
        if trendIsUp {
            // Buy at VWAP support
        }
    }
}
```

---

## ATR (Average True Range)

### What It Does

Measures market volatility. **Critical for position sizing and stop losses.**

**Uses**:
- Position sizing (risk per trade)
- Stop loss placement (2-3× ATR)
- Volatility filtering (trade only when ATR is favorable)

**Period**: Typically 14

### Usage

```go
// Create ATR (14-period)
atr := indicators.NewATR(14)

// Update with OHLCV bars
bar := indicators.PricePoint{
    High:   152.0,
    Low:    149.0,
    Close:  151.0,
    // ... other fields
}

atr.UpdateOHLCV(bar)

if atr.IsReady() {
    atrValue := atr.Value()
    fmt.Printf("ATR: %.2f\n", atrValue)

    // Stop loss distance (2× ATR)
    stopDistance := atr.GetStopLossDistance(2.0)
    fmt.Printf("Stop loss: %.2f points away\n", stopDistance)

    // Position sizing
    riskAmount := 200.0 // Willing to lose $200
    shares := atr.GetPositionSize(riskAmount, 2.0)
    fmt.Printf("Position size: %d shares\n", shares)
}
```

### Day Trading Strategy

```go
// ATR-Based Position Sizing
if atr.IsReady() {
    portfolioValue := 100000.0
    riskPercent := 0.01 // Risk 1% per trade
    riskAmount := portfolioValue * riskPercent

    // Calculate position size
    shares := atr.GetPositionSize(riskAmount, 2.0)

    // Entry price
    entryPrice := 150.0

    // Stop loss at 2 ATR
    stopLoss := entryPrice - atr.GetStopLossDistance(2.0)

    // Target at 3 ATR (1:1.5 risk/reward)
    target := entryPrice + atr.GetStopLossDistance(3.0)
}
```

---

## MACD (Moving Average Convergence Divergence)

### What It Does

Trend-following momentum indicator that shows the relationship between two EMAs.

**Components**:
- MACD Line: 12 EMA - 26 EMA
- Signal Line: 9 EMA of MACD
- Histogram: MACD - Signal

**Signals**:
- MACD crosses above Signal: Bullish
- MACD crosses below Signal: Bearish
- Histogram expanding: Strengthening trend
- Histogram contracting: Weakening trend

**Standard Settings**: 12, 26, 9

### Usage

```go
// Create MACD (12, 26, 9)
macd := indicators.NewMACD(12, 26, 9)

// Track previous values for crossover detection
var prevMACD, prevSignal float64

// Update with prices
prices := []float64{100, 102, 101, 103, 105}
for _, price := range prices {
    macd.Update(price, time.Now())

    if macd.IsReady() {
        macdLine := macd.MACDLine()
        signalLine := macd.SignalLine()
        histogram := macd.Histogram()

        // Check for crossover
        if macd.IsBullishCrossover(prevMACD, prevSignal) {
            fmt.Println("Buy signal: MACD crossed above signal")
        }

        if macd.IsBearishCrossover(prevMACD, prevSignal) {
            fmt.Println("Sell signal: MACD crossed below signal")
        }

        // Update previous values
        prevMACD = macdLine
        prevSignal = signalLine
    }
}
```

### Day Trading Strategy

```go
// MACD Crossover with Histogram Confirmation
var prevMACD, prevSignal, prevHistogram float64

macd.Update(price, time.Now())

if macd.IsReady() {
    // Bullish crossover with increasing histogram
    if macd.IsBullishCrossover(prevMACD, prevSignal) &&
       macd.IsHistogramIncreasing(prevHistogram) {
        // Strong buy signal
        // Entry: Market order
        // Stop: Below recent swing low
    }

    // Update previous values
    prevMACD = macd.MACDLine()
    prevSignal = macd.SignalLine()
    prevHistogram = macd.Histogram()
}
```

---

## Combining Indicators

### Example: Multi-Indicator Strategy

```go
// Create indicators
rsi := indicators.NewRSI(14)
ema20 := indicators.NewEMA(20)
ema50 := indicators.NewEMA(50)
vwap := indicators.NewVWAP()
atr := indicators.NewATR(14)

// Update all with bar data
updateIndicators := func(bar indicators.PricePoint) {
    rsi.Update(bar.Close, bar.Timestamp)
    ema20.Update(bar.Close, bar.Timestamp)
    ema50.Update(bar.Close, bar.Timestamp)
    vwap.UpdateOHLCV(bar)
    atr.UpdateOHLCV(bar)
}

// Trading logic
checkSignals := func(bar indicators.PricePoint) {
    if !rsi.IsReady() || !ema20.IsReady() || !ema50.IsReady() ||
       !vwap.IsReady() || !atr.IsReady() {
        return
    }

    currentPrice := bar.Close

    // Buy signal: Multiple confirmations
    if rsi.IsOversold() &&                        // RSI < 30
       ema20.Value() > ema50.Value() &&           // Short EMA above long
       vwap.IsPriceAboveVWAP(currentPrice) &&     // Price above VWAP
       !atr.IsHighVolatility(2.0) {               // Not too volatile

        // Calculate position size based on ATR
        riskAmount := 1000.0
        shares := atr.GetPositionSize(riskAmount, 2.0)
        stopLoss := currentPrice - atr.GetStopLossDistance(2.0)

        fmt.Printf("BUY: %d shares @ %.2f, Stop: %.2f\n",
            shares, currentPrice, stopLoss)
    }
}
```

---

## Best Practices

### 1. Always Check `IsReady()`

```go
if indicator.IsReady() {
    // Safe to use value
    value := indicator.Value()
}
```

### 2. Handle Real-Time Updates

```go
// Update on each new bar
onNewBar := func(bar MarketDataEvent) {
    price := bar.Close
    timestamp := bar.Timestamp

    rsi.Update(price, timestamp)
    ema.Update(price, timestamp)

    if rsi.IsReady() && ema.IsReady() {
        // Your trading logic
    }
}
```

### 3. Reset on New Trading Day

```go
// For VWAP (auto-resets on new day)
vwap.UpdateOHLCV(bar) // Handles day change internally

// For other indicators (if needed)
if isNewTradingDay() {
    rsi.Reset()
    ema.Reset()
}
```

### 4. Backtest Before Live Trading

```go
// Load historical data
bars := loadHistoricalBars()

// Warm up indicators
for i, bar := range bars {
    updateIndicators(bar)

    if i >= warmupPeriod {
        // Test strategy
        checkSignals(bar)
    }
}
```

---

## Performance Notes

- **Memory**: All indicators use fixed-size buffers (no unbounded growth)
- **CPU**: O(1) updates (constant time per price update)
- **Thread Safety**: Not thread-safe (use separate instances per goroutine)

---

## Next Steps

1. **Use with Strategies**: Integrate indicators into `internal/core/strategy/`
2. **Backtest**: Validate with historical data
3. **Paper Trade**: Test with real-time Alpaca data
4. **Optimize**: Tune parameters for your symbols and timeframes

---

## References

- **RSI**: Wilder, J. Welles. "New Concepts in Technical Trading Systems"
- **Bollinger Bands**: Bollinger, John. "Bollinger on Bollinger Bands"
- **MACD**: Appel, Gerald. "Technical Analysis: Power Tools for Active Investors"
- **VWAP**: Institutional trading benchmark

---

**Ready to build profitable day trading strategies!** 🎯📈
