package indicators

import (
	"fmt"
	"time"
)

// EMA (Exponential Moving Average) gives more weight to recent prices
// Responds faster to price changes than SMA
// Common periods: 9, 12, 20, 26, 50, 200
type EMA struct {
	period int
	name   string

	// EMA calculation
	multiplier float64
	emaValue   float64

	// Price history for initial SMA calculation
	prices []float64

	// Track if we have enough data
	isReady bool
}

// NewEMA creates a new EMA indicator
func NewEMA(period int) *EMA {
	if period < 1 {
		period = 20 // Default period
	}

	multiplier := 2.0 / float64(period+1)

	return &EMA{
		period:     period,
		name:       fmt.Sprintf("EMA(%d)", period),
		multiplier: multiplier,
		prices:     make([]float64, 0, period),
		isReady:    false,
	}
}

// Update adds a new price to the EMA calculation
func (e *EMA) Update(price float64, timestamp time.Time) error {
	if price <= 0 {
		return fmt.Errorf("price must be positive")
	}

	if !e.isReady {
		// Collect prices until we have enough for initial SMA
		e.prices = append(e.prices, price)

		if len(e.prices) == e.period {
			// Calculate initial EMA as SMA
			e.emaValue = SMA(e.prices)
			e.isReady = true
			e.prices = nil // Clear price history (no longer needed)
		}
	} else {
		// Calculate EMA using previous EMA value
		e.emaValue = (price-e.emaValue)*e.multiplier + e.emaValue
	}

	return nil
}

// Value returns the current EMA value
func (e *EMA) Value() float64 {
	return e.emaValue
}

// IsReady returns true if EMA has enough data
func (e *EMA) IsReady() bool {
	return e.isReady
}

// Reset clears all data and resets the indicator
func (e *EMA) Reset() {
	e.prices = make([]float64, 0, e.period)
	e.emaValue = 0
	e.isReady = false
}

// Name returns the indicator name
func (e *EMA) Name() string {
	return e.name
}

// Period returns the EMA period
func (e *EMA) Period() int {
	return e.period
}

// Multiplier returns the smoothing multiplier
func (e *EMA) Multiplier() float64 {
	return e.multiplier
}
