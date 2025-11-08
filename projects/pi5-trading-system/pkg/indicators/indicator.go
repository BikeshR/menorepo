package indicators

import "time"

// Indicator defines the interface all technical indicators must implement
type Indicator interface {
	// Update adds a new data point to the indicator
	Update(price float64, timestamp time.Time) error

	// Value returns the current indicator value
	// Returns 0 if not enough data to calculate
	Value() float64

	// IsReady returns true if the indicator has enough data to produce valid values
	IsReady() bool

	// Reset clears all data and resets the indicator to initial state
	Reset()

	// Name returns the indicator name
	Name() string
}

// PricePoint represents a single price data point
type PricePoint struct {
	Open      float64
	High      float64
	Low       float64
	Close     float64
	Volume    int64
	Timestamp time.Time
}

// OHLCVIndicator defines the interface for indicators that require full OHLCV data
type OHLCVIndicator interface {
	// UpdateOHLCV adds a new OHLCV bar to the indicator
	UpdateOHLCV(bar PricePoint) error

	// Value returns the current indicator value
	Value() float64

	// IsReady returns true if the indicator has enough data
	IsReady() bool

	// Reset clears all data
	Reset()

	// Name returns the indicator name
	Name() string
}

// MultiValueIndicator defines the interface for indicators that return multiple values
// For example, Bollinger Bands returns (middle, upper, lower)
type MultiValueIndicator interface {
	// UpdateOHLCV adds a new OHLCV bar to the indicator
	UpdateOHLCV(bar PricePoint) error

	// Values returns all indicator values
	// The meaning of each value depends on the specific indicator
	Values() []float64

	// IsReady returns true if the indicator has enough data
	IsReady() bool

	// Reset clears all data
	Reset()

	// Name returns the indicator name
	Name() string
}

// Common utility functions

// SMA calculates Simple Moving Average for a slice of prices
func SMA(prices []float64) float64 {
	if len(prices) == 0 {
		return 0
	}

	sum := 0.0
	for _, p := range prices {
		sum += p
	}
	return sum / float64(len(prices))
}

// StdDev calculates Standard Deviation for a slice of prices
func StdDev(prices []float64, mean float64) float64 {
	if len(prices) == 0 {
		return 0
	}

	sumSquaredDiff := 0.0
	for _, p := range prices {
		diff := p - mean
		sumSquaredDiff += diff * diff
	}

	variance := sumSquaredDiff / float64(len(prices))
	return sqrt(variance)
}

// sqrt calculates square root using Newton's method
// (avoiding math package dependency for simplicity)
func sqrt(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x == 0 {
		return 0
	}

	// Newton's method
	z := x
	for i := 0; i < 10; i++ {
		z -= (z*z - x) / (2 * z)
	}
	return z
}

// Max returns the maximum value in a slice
func Max(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	max := values[0]
	for _, v := range values[1:] {
		if v > max {
			max = v
		}
	}
	return max
}

// Min returns the minimum value in a slice
func Min(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	min := values[0]
	for _, v := range values[1:] {
		if v < min {
			min = v
		}
	}
	return min
}

// Abs returns the absolute value
func Abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
