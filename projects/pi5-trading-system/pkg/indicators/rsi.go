package indicators

import (
	"fmt"
	"time"
)

// RSI (Relative Strength Index) measures momentum and identifies overbought/oversold conditions
// Values range from 0 to 100
// - Above 70: Overbought (potential sell signal)
// - Below 30: Oversold (potential buy signal)
// Standard period: 14
type RSI struct {
	period int
	name   string

	// Price history
	prices []float64

	// Average gain and loss (for smoothing)
	avgGain float64
	avgLoss float64

	// Current RSI value
	currentValue float64

	// Track if we have enough data
	isReady bool
}

// NewRSI creates a new RSI indicator
func NewRSI(period int) *RSI {
	if period < 2 {
		period = 14 // Default standard period
	}

	return &RSI{
		period:  period,
		name:    fmt.Sprintf("RSI(%d)", period),
		prices:  make([]float64, 0, period+1),
		isReady: false,
	}
}

// Update adds a new price to the RSI calculation
func (r *RSI) Update(price float64, timestamp time.Time) error {
	if price <= 0 {
		return fmt.Errorf("price must be positive")
	}

	r.prices = append(r.prices, price)

	// Keep only period + 1 prices (we need one extra for calculating change)
	if len(r.prices) > r.period+1 {
		r.prices = r.prices[1:]
	}

	// Need at least period+1 prices to calculate RSI
	if len(r.prices) < r.period+1 {
		r.isReady = false
		return nil
	}

	// Calculate RSI
	r.calculateRSI()
	r.isReady = true

	return nil
}

// calculateRSI computes the RSI value
func (r *RSI) calculateRSI() {
	// Calculate gains and losses
	gains := make([]float64, 0, r.period)
	losses := make([]float64, 0, r.period)

	for i := 1; i < len(r.prices); i++ {
		change := r.prices[i] - r.prices[i-1]
		if change > 0 {
			gains = append(gains, change)
			losses = append(losses, 0)
		} else {
			gains = append(gains, 0)
			losses = append(losses, -change) // Make positive
		}
	}

	// First RSI calculation (simple average)
	if r.avgGain == 0 && r.avgLoss == 0 {
		r.avgGain = SMA(gains)
		r.avgLoss = SMA(losses)
	} else {
		// Subsequent calculations (smoothed average - Wilder's method)
		lastGain := gains[len(gains)-1]
		lastLoss := losses[len(losses)-1]

		r.avgGain = ((r.avgGain * float64(r.period-1)) + lastGain) / float64(r.period)
		r.avgLoss = ((r.avgLoss * float64(r.period-1)) + lastLoss) / float64(r.period)
	}

	// Calculate RS and RSI
	if r.avgLoss == 0 {
		r.currentValue = 100 // All gains, no losses
	} else {
		rs := r.avgGain / r.avgLoss
		r.currentValue = 100 - (100 / (1 + rs))
	}
}

// Value returns the current RSI value (0-100)
func (r *RSI) Value() float64 {
	return r.currentValue
}

// IsReady returns true if RSI has enough data to produce valid values
func (r *RSI) IsReady() bool {
	return r.isReady
}

// Reset clears all data and resets the indicator
func (r *RSI) Reset() {
	r.prices = make([]float64, 0, r.period+1)
	r.avgGain = 0
	r.avgLoss = 0
	r.currentValue = 0
	r.isReady = false
}

// Name returns the indicator name
func (r *RSI) Name() string {
	return r.name
}

// IsOverbought returns true if RSI indicates overbought condition (>70)
func (r *RSI) IsOverbought() bool {
	return r.isReady && r.currentValue > 70
}

// IsOversold returns true if RSI indicates oversold condition (<30)
func (r *RSI) IsOversold() bool {
	return r.isReady && r.currentValue < 30
}

// IsOverboughtCustom returns true if RSI is above the custom threshold
func (r *RSI) IsOverboughtCustom(threshold float64) bool {
	return r.isReady && r.currentValue > threshold
}

// IsOversoldCustom returns true if RSI is below the custom threshold
func (r *RSI) IsOversoldCustom(threshold float64) bool {
	return r.isReady && r.currentValue < threshold
}

// Period returns the RSI period
func (r *RSI) Period() int {
	return r.period
}
