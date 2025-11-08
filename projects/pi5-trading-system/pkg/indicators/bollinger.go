package indicators

import (
	"fmt"
	"time"
)

// BollingerBands measures price volatility and identifies potential reversal points
// Consists of:
// - Middle Band: SMA
// - Upper Band: Middle + (k * StdDev)
// - Lower Band: Middle - (k * StdDev)
// Standard settings: 20-period, k=2
type BollingerBands struct {
	period int
	stdDev float64 // Number of standard deviations (k)
	name   string

	// Price history
	prices []float64

	// Band values
	middle float64
	upper  float64
	lower  float64

	// Track if we have enough data
	isReady bool
}

// NewBollingerBands creates a new Bollinger Bands indicator
// period: typically 20
// stdDev: typically 2.0
func NewBollingerBands(period int, stdDev float64) *BollingerBands {
	if period < 2 {
		period = 20 // Default period
	}
	if stdDev <= 0 {
		stdDev = 2.0 // Default standard deviation multiplier
	}

	return &BollingerBands{
		period: period,
		stdDev: stdDev,
		name:   fmt.Sprintf("BB(%d,%.1f)", period, stdDev),
		prices: make([]float64, 0, period),
		isReady: false,
	}
}

// Update adds a new price to the Bollinger Bands calculation
func (bb *BollingerBands) Update(price float64, timestamp time.Time) error {
	if price <= 0 {
		return fmt.Errorf("price must be positive")
	}

	bb.prices = append(bb.prices, price)

	// Keep only the last 'period' prices
	if len(bb.prices) > bb.period {
		bb.prices = bb.prices[1:]
	}

	// Need at least 'period' prices to calculate
	if len(bb.prices) < bb.period {
		bb.isReady = false
		return nil
	}

	// Calculate bands
	bb.calculateBands()
	bb.isReady = true

	return nil
}

// calculateBands computes the middle, upper, and lower bands
func (bb *BollingerBands) calculateBands() {
	// Middle band is SMA
	bb.middle = SMA(bb.prices)

	// Calculate standard deviation
	stdDevValue := StdDev(bb.prices, bb.middle)

	// Upper and lower bands
	bb.upper = bb.middle + (bb.stdDev * stdDevValue)
	bb.lower = bb.middle - (bb.stdDev * stdDevValue)
}

// UpdateOHLCV implements OHLCVIndicator interface (uses close price)
func (bb *BollingerBands) UpdateOHLCV(bar PricePoint) error {
	return bb.Update(bar.Close, bar.Timestamp)
}

// Value returns the middle band (SMA)
func (bb *BollingerBands) Value() float64 {
	return bb.middle
}

// Values returns all three band values [lower, middle, upper]
func (bb *BollingerBands) Values() []float64 {
	return []float64{bb.lower, bb.middle, bb.upper}
}

// Middle returns the middle band (SMA)
func (bb *BollingerBands) Middle() float64 {
	return bb.middle
}

// Upper returns the upper band
func (bb *BollingerBands) Upper() float64 {
	return bb.upper
}

// Lower returns the lower band
func (bb *BollingerBands) Lower() float64 {
	return bb.lower
}

// BandWidth returns the width of the bands (upper - lower)
// Useful for measuring volatility
func (bb *BollingerBands) BandWidth() float64 {
	if !bb.isReady {
		return 0
	}
	return bb.upper - bb.lower
}

// PercentB returns where the price is relative to the bands
// %B = (Price - Lower) / (Upper - Lower)
// > 1.0: Above upper band
// 0.5: At middle band
// < 0.0: Below lower band
func (bb *BollingerBands) PercentB(price float64) float64 {
	if !bb.isReady {
		return 0
	}

	bandwidth := bb.upper - bb.lower
	if bandwidth == 0 {
		return 0.5 // Price at middle when no volatility
	}

	return (price - bb.lower) / bandwidth
}

// IsAboveUpperBand checks if price is above upper band (potential sell)
func (bb *BollingerBands) IsAboveUpperBand(price float64) bool {
	return bb.isReady && price > bb.upper
}

// IsBelowLowerBand checks if price is below lower band (potential buy)
func (bb *BollingerBands) IsBelowLowerBand(price float64) bool {
	return bb.isReady && price < bb.lower
}

// IsReady returns true if Bollinger Bands has enough data
func (bb *BollingerBands) IsReady() bool {
	return bb.isReady
}

// Reset clears all data and resets the indicator
func (bb *BollingerBands) Reset() {
	bb.prices = make([]float64, 0, bb.period)
	bb.middle = 0
	bb.upper = 0
	bb.lower = 0
	bb.isReady = false
}

// Name returns the indicator name
func (bb *BollingerBands) Name() string {
	return bb.name
}

// Period returns the period
func (bb *BollingerBands) Period() int {
	return bb.period
}

// StdDevMultiplier returns the standard deviation multiplier
func (bb *BollingerBands) StdDevMultiplier() float64 {
	return bb.stdDev
}
