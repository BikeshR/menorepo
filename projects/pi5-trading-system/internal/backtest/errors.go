package backtest

import "errors"

var (
	// Configuration errors
	ErrInvalidCapital   = errors.New("initial capital must be positive")
	ErrInvalidDateRange = errors.New("start date must be before end date")
	ErrInvalidSymbol    = errors.New("symbol cannot be empty")

	// Execution errors
	ErrInsufficientCapital = errors.New("insufficient capital for trade")
	ErrNoPosition          = errors.New("no position to close")
	ErrInvalidQuantity     = errors.New("invalid quantity")
	ErrInvalidPrice        = errors.New("invalid price")

	// Data errors
	ErrNoData         = errors.New("no historical data available")
	ErrInvalidBarData = errors.New("invalid bar data")
)
