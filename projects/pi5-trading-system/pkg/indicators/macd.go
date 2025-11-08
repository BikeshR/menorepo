package indicators

import (
	"fmt"
	"time"
)

// MACD (Moving Average Convergence Divergence) is a trend-following momentum indicator
// Components:
// - MACD Line: Fast EMA - Slow EMA
// - Signal Line: EMA of MACD Line
// - Histogram: MACD Line - Signal Line
// Standard settings: 12, 26, 9
type MACD struct {
	fastPeriod   int
	slowPeriod   int
	signalPeriod int
	name         string

	// EMAs for calculation
	fastEMA   *EMA
	slowEMA   *EMA
	signalEMA *EMA

	// MACD values
	macdLine   float64
	signalLine float64
	histogram  float64

	// Track if we have enough data
	isReady bool
}

// NewMACD creates a new MACD indicator
// Standard parameters: fast=12, slow=26, signal=9
func NewMACD(fastPeriod, slowPeriod, signalPeriod int) *MACD {
	if fastPeriod < 1 {
		fastPeriod = 12
	}
	if slowPeriod < 1 {
		slowPeriod = 26
	}
	if signalPeriod < 1 {
		signalPeriod = 9
	}

	return &MACD{
		fastPeriod:   fastPeriod,
		slowPeriod:   slowPeriod,
		signalPeriod: signalPeriod,
		name:         fmt.Sprintf("MACD(%d,%d,%d)", fastPeriod, slowPeriod, signalPeriod),
		fastEMA:      NewEMA(fastPeriod),
		slowEMA:      NewEMA(slowPeriod),
		signalEMA:    NewEMA(signalPeriod),
		isReady:      false,
	}
}

// Update adds a new price to the MACD calculation
func (m *MACD) Update(price float64, timestamp time.Time) error {
	if price <= 0 {
		return fmt.Errorf("price must be positive")
	}

	// Update fast and slow EMAs
	m.fastEMA.Update(price, timestamp)
	m.slowEMA.Update(price, timestamp)

	// Both EMAs must be ready before we can calculate MACD
	if !m.fastEMA.IsReady() || !m.slowEMA.IsReady() {
		m.isReady = false
		return nil
	}

	// Calculate MACD line (Fast EMA - Slow EMA)
	m.macdLine = m.fastEMA.Value() - m.slowEMA.Value()

	// Update signal line (EMA of MACD line)
	m.signalEMA.Update(m.macdLine, timestamp)

	// Signal EMA must be ready
	if !m.signalEMA.IsReady() {
		m.isReady = false
		return nil
	}

	m.signalLine = m.signalEMA.Value()

	// Calculate histogram (MACD line - Signal line)
	m.histogram = m.macdLine - m.signalLine

	m.isReady = true
	return nil
}

// Value returns the MACD line value
func (m *MACD) Value() float64 {
	return m.macdLine
}

// Values returns all MACD values [macdLine, signalLine, histogram]
func (m *MACD) Values() []float64 {
	return []float64{m.macdLine, m.signalLine, m.histogram}
}

// MACDLine returns the MACD line (fast EMA - slow EMA)
func (m *MACD) MACDLine() float64 {
	return m.macdLine
}

// SignalLine returns the signal line (EMA of MACD line)
func (m *MACD) SignalLine() float64 {
	return m.signalLine
}

// Histogram returns the histogram (MACD line - signal line)
func (m *MACD) Histogram() float64 {
	return m.histogram
}

// IsReady returns true if MACD has enough data
func (m *MACD) IsReady() bool {
	return m.isReady
}

// Reset clears all data and resets the indicator
func (m *MACD) Reset() {
	m.fastEMA.Reset()
	m.slowEMA.Reset()
	m.signalEMA.Reset()
	m.macdLine = 0
	m.signalLine = 0
	m.histogram = 0
	m.isReady = false
}

// Name returns the indicator name
func (m *MACD) Name() string {
	return m.name
}

// IsBullishCrossover checks if MACD line crossed above signal line (buy signal)
// prevMACD and prevSignal are the previous values
func (m *MACD) IsBullishCrossover(prevMACD, prevSignal float64) bool {
	if !m.isReady {
		return false
	}
	// Previous: MACD below Signal
	// Current: MACD above Signal
	return prevMACD <= prevSignal && m.macdLine > m.signalLine
}

// IsBearishCrossover checks if MACD line crossed below signal line (sell signal)
func (m *MACD) IsBearishCrossover(prevMACD, prevSignal float64) bool {
	if !m.isReady {
		return false
	}
	// Previous: MACD above Signal
	// Current: MACD below Signal
	return prevMACD >= prevSignal && m.macdLine < m.signalLine
}

// IsBullish checks if MACD line is above signal line (uptrend)
func (m *MACD) IsBullish() bool {
	return m.isReady && m.macdLine > m.signalLine
}

// IsBearish checks if MACD line is below signal line (downtrend)
func (m *MACD) IsBearish() bool {
	return m.isReady && m.macdLine < m.signalLine
}

// IsHistogramIncreasing checks if momentum is strengthening
// prevHistogram is the previous histogram value
func (m *MACD) IsHistogramIncreasing(prevHistogram float64) bool {
	return m.isReady && m.histogram > prevHistogram
}

// IsHistogramDecreasing checks if momentum is weakening
func (m *MACD) IsHistogramDecreasing(prevHistogram float64) bool {
	return m.isReady && m.histogram < prevHistogram
}

// IsDivergenceBullish checks for bullish divergence
// priceMovingDown: Price making lower lows
// histogramMovingUp: Histogram making higher lows
// This suggests weakening downtrend and potential reversal
func (m *MACD) IsDivergenceBullish(priceMovingDown, histogramMovingUp bool) bool {
	return m.isReady && priceMovingDown && histogramMovingUp
}

// IsDivergenceBearish checks for bearish divergence
// priceMovingUp: Price making higher highs
// histogramMovingDown: Histogram making lower highs
// This suggests weakening uptrend and potential reversal
func (m *MACD) IsDivergenceBearish(priceMovingUp, histogramMovingDown bool) bool {
	return m.isReady && priceMovingUp && histogramMovingDown
}

// FastPeriod returns the fast EMA period
func (m *MACD) FastPeriod() int {
	return m.fastPeriod
}

// SlowPeriod returns the slow EMA period
func (m *MACD) SlowPeriod() int {
	return m.slowPeriod
}

// SignalPeriod returns the signal line period
func (m *MACD) SignalPeriod() int {
	return m.signalPeriod
}
