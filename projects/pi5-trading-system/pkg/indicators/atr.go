package indicators

import (
	"fmt"
	"time"
)

// ATR (Average True Range) measures market volatility
// Used for:
// - Position sizing (risk per trade)
// - Stop loss placement
// - Volatility filtering
// Standard period: 14
type ATR struct {
	period int
	name   string

	// True Range calculation
	trueRanges []float64
	previousClose float64

	// ATR value (smoothed average of true ranges)
	atrValue float64

	// Track if we have enough data
	isReady bool
	count   int
}

// NewATR creates a new ATR indicator
func NewATR(period int) *ATR {
	if period < 1 {
		period = 14 // Default standard period
	}

	return &ATR{
		period:     period,
		name:       fmt.Sprintf("ATR(%d)", period),
		trueRanges: make([]float64, 0, period),
		isReady:    false,
	}
}

// UpdateOHLCV adds a new bar to the ATR calculation
func (atr *ATR) UpdateOHLCV(bar PricePoint) error {
	if bar.High < bar.Low {
		return fmt.Errorf("high price cannot be less than low price")
	}

	// Calculate True Range
	var tr float64
	if atr.count == 0 {
		// First bar: True Range = High - Low
		tr = bar.High - bar.Low
	} else {
		// True Range is the greatest of:
		// 1. Current High - Current Low
		// 2. |Current High - Previous Close|
		// 3. |Current Low - Previous Close|
		tr1 := bar.High - bar.Low
		tr2 := Abs(bar.High - atr.previousClose)
		tr3 := Abs(bar.Low - atr.previousClose)

		tr = Max([]float64{tr1, tr2, tr3})
	}

	atr.trueRanges = append(atr.trueRanges, tr)
	atr.previousClose = bar.Close
	atr.count++

	// Keep only 'period' true ranges
	if len(atr.trueRanges) > atr.period {
		atr.trueRanges = atr.trueRanges[1:]
	}

	// Need at least 'period' true ranges to calculate ATR
	if len(atr.trueRanges) < atr.period {
		atr.isReady = false
		return nil
	}

	// Calculate ATR
	if atr.count == atr.period {
		// First ATR is simple average
		atr.atrValue = SMA(atr.trueRanges)
	} else {
		// Subsequent ATR values use Wilder's smoothing
		// ATR = ((Previous ATR * (period - 1)) + Current TR) / period
		atr.atrValue = ((atr.atrValue * float64(atr.period-1)) + tr) / float64(atr.period)
	}

	atr.isReady = true
	return nil
}

// Value returns the current ATR value
func (atr *ATR) Value() float64 {
	return atr.atrValue
}

// IsReady returns true if ATR has enough data
func (atr *ATR) IsReady() bool {
	return atr.isReady
}

// Reset clears all data and resets the indicator
func (atr *ATR) Reset() {
	atr.trueRanges = make([]float64, 0, atr.period)
	atr.previousClose = 0
	atr.atrValue = 0
	atr.isReady = false
	atr.count = 0
}

// Name returns the indicator name
func (atr *ATR) Name() string {
	return atr.name
}

// Period returns the ATR period
func (atr *ATR) Period() int {
	return atr.period
}

// GetStopLossDistance returns a suggested stop loss distance based on ATR
// multiplier is typically 2.0 or 3.0
func (atr *ATR) GetStopLossDistance(multiplier float64) float64 {
	if !atr.isReady {
		return 0
	}
	return atr.atrValue * multiplier
}

// GetPositionSize calculates position size based on risk and ATR
// riskAmount: How much $ you're willing to lose
// stopLossMultiplier: ATR multiplier for stop loss (typically 2-3)
// Returns: Number of shares to buy
func (atr *ATR) GetPositionSize(riskAmount float64, stopLossMultiplier float64) int {
	if !atr.isReady || atr.atrValue == 0 {
		return 0
	}

	stopLossDistance := atr.atrValue * stopLossMultiplier
	if stopLossDistance == 0 {
		return 0
	}

	// Position Size = Risk Amount / Stop Loss Distance
	positionSize := riskAmount / stopLossDistance
	return int(positionSize)
}

// IsHighVolatility checks if current ATR is above threshold
// threshold is typically the SMA of ATR over a longer period
func (atr *ATR) IsHighVolatility(threshold float64) bool {
	return atr.isReady && atr.atrValue > threshold
}

// IsLowVolatility checks if current ATR is below threshold
func (atr *ATR) IsLowVolatility(threshold float64) bool {
	return atr.isReady && atr.atrValue < threshold
}
