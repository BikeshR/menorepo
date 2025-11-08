package backtest

import (
	"time"
)

// Config holds backtesting configuration
type Config struct {
	// Symbol to backtest
	Symbol string

	// Time range for backtest
	StartDate time.Time
	EndDate   time.Time

	// Initial capital
	InitialCapital float64

	// Transaction costs
	Commission      float64 // Fixed commission per trade (e.g., $1)
	CommissionPct   float64 // Commission as % of trade value (e.g., 0.001 = 0.1%)
	Slippage        float64 // Slippage in % (e.g., 0.001 = 0.1%)
	SlippageModel   string  // "fixed" or "volume_based"

	// Risk management
	MaxPositionSize int     // Maximum shares per position
	MaxDailyLoss    float64 // Maximum loss per day ($)
	MaxDailyLossPct float64 // Maximum loss per day (%)

	// Data settings
	Timeframe string // "1Min", "5Min", etc.

	// Output settings
	GenerateReport   bool
	GenerateEquity   bool
	DetailedTrades   bool
	OutputDir        string
}

// DefaultConfig returns a sensible default configuration
func DefaultConfig() *Config {
	return &Config{
		Symbol:          "SPY",
		InitialCapital:  100000, // $100k
		Commission:      1.0,    // $1 per trade
		CommissionPct:   0.0,    // No percentage commission
		Slippage:        0.001,  // 0.1% slippage
		SlippageModel:   "fixed",
		MaxPositionSize: 1000,
		MaxDailyLoss:    2000,    // $2k daily loss limit
		MaxDailyLossPct: 0.02,    // 2% daily loss limit
		Timeframe:       "1Min",
		GenerateReport:  true,
		GenerateEquity:  true,
		DetailedTrades:  true,
		OutputDir:       "./backtest_results",
	}
}

// Validate checks if configuration is valid
func (c *Config) Validate() error {
	if c.InitialCapital <= 0 {
		return ErrInvalidCapital
	}
	if c.StartDate.After(c.EndDate) {
		return ErrInvalidDateRange
	}
	if c.Symbol == "" {
		return ErrInvalidSymbol
	}
	return nil
}
