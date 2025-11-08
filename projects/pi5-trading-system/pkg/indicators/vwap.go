package indicators

import (
	"fmt"
)

// VWAP (Volume Weighted Average Price) is the average price weighted by volume
// Essential for day trading - shows if you're getting a good price
// Typical use:
// - Price above VWAP: Uptrend, support
// - Price below VWAP: Downtrend, resistance
// VWAP resets each trading day
type VWAP struct {
	name string

	// Cumulative values
	cumulativePriceVolume float64 // Σ(Typical Price * Volume)
	cumulativeVolume      float64 // Σ(Volume)

	// Current VWAP value
	vwapValue float64

	// Current trading day (to detect day change)
	currentDay string

	// Track if we have data
	isReady bool
}

// NewVWAP creates a new VWAP indicator
func NewVWAP() *VWAP {
	return &VWAP{
		name:    "VWAP",
		isReady: false,
	}
}

// UpdateOHLCV adds a new bar to the VWAP calculation
func (v *VWAP) UpdateOHLCV(bar PricePoint) error {
	if bar.Volume <= 0 {
		return fmt.Errorf("volume must be positive")
	}

	// Check if we're in a new trading day
	day := bar.Timestamp.Format("2006-01-02")
	if day != v.currentDay {
		// New day, reset VWAP
		v.Reset()
		v.currentDay = day
	}

	// Calculate typical price: (High + Low + Close) / 3
	typicalPrice := (bar.High + bar.Low + bar.Close) / 3.0

	// Update cumulative values
	v.cumulativePriceVolume += typicalPrice * float64(bar.Volume)
	v.cumulativeVolume += float64(bar.Volume)

	// Calculate VWAP
	if v.cumulativeVolume > 0 {
		v.vwapValue = v.cumulativePriceVolume / v.cumulativeVolume
		v.isReady = true
	}

	return nil
}

// Value returns the current VWAP value
func (v *VWAP) Value() float64 {
	return v.vwapValue
}

// IsReady returns true if VWAP has data
func (v *VWAP) IsReady() bool {
	return v.isReady
}

// Reset clears all data (called on new trading day)
func (v *VWAP) Reset() {
	v.cumulativePriceVolume = 0
	v.cumulativeVolume = 0
	v.vwapValue = 0
	v.isReady = false
	// Don't reset currentDay here - it's set in UpdateOHLCV
}

// Name returns the indicator name
func (v *VWAP) Name() string {
	return v.name
}

// IsPriceAboveVWAP checks if current price is above VWAP (bullish)
func (v *VWAP) IsPriceAboveVWAP(price float64) bool {
	return v.isReady && price > v.vwapValue
}

// IsPriceBelowVWAP checks if current price is below VWAP (bearish)
func (v *VWAP) IsPriceBelowVWAP(price float64) bool {
	return v.isReady && price < v.vwapValue
}

// PriceDistanceFromVWAP returns the distance of price from VWAP as a percentage
// Positive: Price above VWAP
// Negative: Price below VWAP
func (v *VWAP) PriceDistanceFromVWAP(price float64) float64 {
	if !v.isReady || v.vwapValue == 0 {
		return 0
	}
	return ((price - v.vwapValue) / v.vwapValue) * 100
}

// GetCumulativeVolume returns the total volume for the current trading day
func (v *VWAP) GetCumulativeVolume() float64 {
	return v.cumulativeVolume
}

// GetCurrentDay returns the current trading day being tracked
func (v *VWAP) GetCurrentDay() string {
	return v.currentDay
}
