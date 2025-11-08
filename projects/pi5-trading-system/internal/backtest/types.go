package backtest

import (
	"time"
)

// Trade represents a completed trade (entry + exit)
type Trade struct {
	// Trade identification
	Symbol   string
	TradeID  int

	// Entry details
	EntryTime  time.Time
	EntryPrice float64
	EntryQty   int

	// Exit details
	ExitTime  time.Time
	ExitPrice float64
	ExitQty   int

	// Trade results
	GrossProfit float64 // Before costs
	NetProfit   float64 // After costs (commission + slippage)
	Commission  float64
	Slippage    float64
	ReturnPct   float64 // Percentage return

	// Trade duration
	Duration time.Duration

	// Trade type
	Side string // "LONG" or "SHORT"

	// Strategy context
	EntryReason string
	ExitReason  string
}

// Position represents an open position
type Position struct {
	Symbol      string
	Side        string // "LONG" or "SHORT"
	EntryTime   time.Time
	EntryPrice  float64
	Quantity    int
	EntryReason string
}

// DailyStats holds statistics for a single trading day
type DailyStats struct {
	Date         time.Time
	StartingCash float64
	EndingCash   float64
	PnL          float64
	PnLPct       float64
	Trades       int
	Wins         int
	Losses       int
	Commission   float64
	Slippage     float64
}

// EquityPoint represents a point in the equity curve
type EquityPoint struct {
	Timestamp time.Time
	Equity    float64
	Cash      float64
	PnL       float64
}

// BacktestResult holds the complete results of a backtest
type BacktestResult struct {
	// Configuration
	Config *Config

	// Overall performance
	InitialCapital float64
	FinalCapital   float64
	TotalReturn    float64 // $
	TotalReturnPct float64 // %

	// Trade statistics
	TotalTrades int
	WinningTrades int
	LosingTrades  int
	WinRate       float64 // %

	// Profit metrics
	GrossProfit    float64
	GrossLoss      float64
	NetProfit      float64
	ProfitFactor   float64 // Gross profit / Gross loss
	AverageTrade   float64
	AverageWin     float64
	AverageLoss    float64
	LargestWin     float64
	LargestLoss    float64

	// Risk metrics
	MaxDrawdown    float64 // $
	MaxDrawdownPct float64 // %
	SharpeRatio    float64
	SortinoRatio   float64
	CalmarRatio    float64 // Return / Max Drawdown

	// Trading metrics
	AvgTradeDuration time.Duration
	MaxConsecutiveWins  int
	MaxConsecutiveLosses int

	// Costs
	TotalCommission float64
	TotalSlippage   float64

	// Time period
	StartDate time.Time
	EndDate   time.Time
	Duration  time.Duration

	// Detailed data
	Trades      []Trade
	DailyStats  []DailyStats
	EquityCurve []EquityPoint

	// Execution time
	BacktestDuration time.Duration
}

// IsWinningTrade checks if a trade was profitable
func (t *Trade) IsWinningTrade() bool {
	return t.NetProfit > 0
}

// GetHoldTime returns how long the position was held
func (t *Trade) GetHoldTime() time.Duration {
	return t.ExitTime.Sub(t.EntryTime)
}
