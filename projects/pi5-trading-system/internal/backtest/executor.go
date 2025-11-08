package backtest

import (
	"fmt"
	"time"

	"github.com/rs/zerolog"
)

// SimulatedExecutor handles simulated order execution for backtesting
type SimulatedExecutor struct {
	config   *Config
	logger   zerolog.Logger

	// Account state
	cash      float64
	position  *Position
	tradeID   int

	// Completed trades
	trades []Trade

	// Daily tracking
	dailyPnL     float64
	dailyDate    string
	dailyStats   []DailyStats
	startingCash float64

	// Equity curve
	equityCurve []EquityPoint
}

// NewSimulatedExecutor creates a new simulated executor
func NewSimulatedExecutor(config *Config, logger zerolog.Logger) *SimulatedExecutor {
	return &SimulatedExecutor{
		config:       config,
		logger:       logger,
		cash:         config.InitialCapital,
		position:     nil,
		tradeID:      0,
		trades:       make([]Trade, 0),
		dailyStats:   make([]DailyStats, 0),
		equityCurve:  make([]EquityPoint, 0),
		startingCash: config.InitialCapital,
	}
}

// ExecuteBuy executes a buy order
func (e *SimulatedExecutor) ExecuteBuy(symbol string, price float64, quantity int, timestamp time.Time, reason string) error {
	if quantity <= 0 {
		return ErrInvalidQuantity
	}
	if price <= 0 {
		return ErrInvalidPrice
	}

	// Check if we already have a position
	if e.position != nil {
		e.logger.Warn().
			Str("symbol", symbol).
			Msg("Already have position, ignoring buy signal")
		return nil
	}

	// Apply slippage (price goes against us)
	executionPrice := e.applySlippage(price, "BUY")

	// Calculate costs
	commission := e.calculateCommission(executionPrice, quantity)
	totalCost := executionPrice*float64(quantity) + commission

	// Check if we have enough capital
	if totalCost > e.cash {
		e.logger.Warn().
			Float64("required", totalCost).
			Float64("available", e.cash).
			Msg("Insufficient capital for trade")
		return ErrInsufficientCapital
	}

	// Check position size limit
	if quantity > e.config.MaxPositionSize {
		quantity = e.config.MaxPositionSize
		totalCost = executionPrice*float64(quantity) + commission
	}

	// Execute trade
	e.cash -= totalCost
	e.position = &Position{
		Symbol:      symbol,
		Side:        "LONG",
		EntryTime:   timestamp,
		EntryPrice:  executionPrice,
		Quantity:    quantity,
		EntryReason: reason,
	}

	e.logger.Info().
		Str("symbol", symbol).
		Float64("price", executionPrice).
		Int("quantity", quantity).
		Float64("commission", commission).
		Float64("cash_remaining", e.cash).
		Msg("BUY executed")

	return nil
}

// ExecuteSell executes a sell order (closes position)
func (e *SimulatedExecutor) ExecuteSell(symbol string, price float64, timestamp time.Time, reason string) error {
	if e.position == nil {
		e.logger.Warn().Msg("No position to close")
		return ErrNoPosition
	}

	if price <= 0 {
		return ErrInvalidPrice
	}

	// Apply slippage (price goes against us)
	executionPrice := e.applySlippage(price, "SELL")

	// Calculate costs
	commission := e.calculateCommission(executionPrice, e.position.Quantity)
	slippage := (price - executionPrice) * float64(e.position.Quantity)

	// Calculate proceeds
	proceeds := executionPrice*float64(e.position.Quantity) - commission

	// Calculate P&L
	costBasis := e.position.EntryPrice * float64(e.position.Quantity)
	grossProfit := proceeds + commission - costBasis // Gross before commission
	netProfit := proceeds - costBasis                 // Net after commission

	// Update cash
	e.cash += proceeds

	// Create trade record
	e.tradeID++
	trade := Trade{
		Symbol:      symbol,
		TradeID:     e.tradeID,
		EntryTime:   e.position.EntryTime,
		EntryPrice:  e.position.EntryPrice,
		EntryQty:    e.position.Quantity,
		ExitTime:    timestamp,
		ExitPrice:   executionPrice,
		ExitQty:     e.position.Quantity,
		GrossProfit: grossProfit,
		NetProfit:   netProfit,
		Commission:  commission * 2, // Entry + Exit commission
		Slippage:    slippage,
		ReturnPct:   (netProfit / costBasis) * 100,
		Duration:    timestamp.Sub(e.position.EntryTime),
		Side:        e.position.Side,
		EntryReason: e.position.EntryReason,
		ExitReason:  reason,
	}

	e.trades = append(e.trades, trade)
	e.dailyPnL += netProfit

	e.logger.Info().
		Str("symbol", symbol).
		Float64("price", executionPrice).
		Int("quantity", e.position.Quantity).
		Float64("net_profit", netProfit).
		Float64("return_pct", trade.ReturnPct).
		Float64("cash", e.cash).
		Msg("SELL executed")

	// Clear position
	e.position = nil

	return nil
}

// applySlippage applies slippage to execution price
func (e *SimulatedExecutor) applySlippage(price float64, side string) float64 {
	if e.config.Slippage == 0 {
		return price
	}

	slippageAmount := price * e.config.Slippage

	if side == "BUY" {
		// Pay more when buying
		return price + slippageAmount
	}
	// Get less when selling
	return price - slippageAmount
}

// calculateCommission calculates commission for a trade
func (e *SimulatedExecutor) calculateCommission(price float64, quantity int) float64 {
	commission := e.config.Commission

	// Add percentage-based commission if configured
	if e.config.CommissionPct > 0 {
		commission += price * float64(quantity) * e.config.CommissionPct
	}

	return commission
}

// UpdateEquityCurve adds a point to the equity curve
func (e *SimulatedExecutor) UpdateEquityCurve(timestamp time.Time, currentPrice float64) {
	equity := e.cash

	// Add unrealized P&L if we have a position
	var unrealizedPnL float64
	if e.position != nil {
		costBasis := e.position.EntryPrice * float64(e.position.Quantity)
		currentValue := currentPrice * float64(e.position.Quantity)
		unrealizedPnL = currentValue - costBasis
		equity += currentValue
	}

	point := EquityPoint{
		Timestamp: timestamp,
		Equity:    equity,
		Cash:      e.cash,
		PnL:       unrealizedPnL,
	}

	e.equityCurve = append(e.equityCurve, point)
}

// CheckDailyLossLimit checks if daily loss limit exceeded
func (e *SimulatedExecutor) CheckDailyLossLimit(currentDate string) bool {
	if e.dailyDate != currentDate {
		// New day - record yesterday's stats and reset
		if e.dailyDate != "" {
			e.recordDailyStats(e.dailyDate)
		}
		e.dailyDate = currentDate
		e.dailyPnL = 0
		e.startingCash = e.cash
		return false
	}

	// Check dollar loss limit
	if e.config.MaxDailyLoss > 0 && e.dailyPnL < -e.config.MaxDailyLoss {
		e.logger.Warn().
			Float64("daily_pnl", e.dailyPnL).
			Float64("limit", e.config.MaxDailyLoss).
			Msg("Daily loss limit exceeded")
		return true
	}

	// Check percentage loss limit
	if e.config.MaxDailyLossPct > 0 {
		lossPct := -e.dailyPnL / e.startingCash
		if lossPct > e.config.MaxDailyLossPct {
			e.logger.Warn().
				Float64("loss_pct", lossPct*100).
				Float64("limit_pct", e.config.MaxDailyLossPct*100).
				Msg("Daily loss % limit exceeded")
			return true
		}
	}

	return false
}

// recordDailyStats records statistics for the trading day
func (e *SimulatedExecutor) recordDailyStats(dateStr string) {
	date, _ := time.Parse("2006-01-02", dateStr)

	// Count trades for this day
	var tradesCount, wins, losses int
	var commission, slippage float64

	for _, trade := range e.trades {
		if trade.EntryTime.Format("2006-01-02") == dateStr {
			tradesCount++
			commission += trade.Commission
			slippage += trade.Slippage

			if trade.IsWinningTrade() {
				wins++
			} else {
				losses++
			}
		}
	}

	stats := DailyStats{
		Date:         date,
		StartingCash: e.startingCash,
		EndingCash:   e.cash,
		PnL:          e.dailyPnL,
		PnLPct:       (e.dailyPnL / e.startingCash) * 100,
		Trades:       tradesCount,
		Wins:         wins,
		Losses:       losses,
		Commission:   commission,
		Slippage:     slippage,
	}

	e.dailyStats = append(e.dailyStats, stats)
}

// GetCash returns current cash balance
func (e *SimulatedExecutor) GetCash() float64 {
	return e.cash
}

// GetPosition returns current position
func (e *SimulatedExecutor) GetPosition() *Position {
	return e.position
}

// GetTrades returns all completed trades
func (e *SimulatedExecutor) GetTrades() []Trade {
	return e.trades
}

// GetDailyStats returns daily statistics
func (e *SimulatedExecutor) GetDailyStats() []DailyStats {
	// Record final day if needed
	if e.dailyDate != "" {
		e.recordDailyStats(e.dailyDate)
	}
	return e.dailyStats
}

// GetEquityCurve returns the equity curve
func (e *SimulatedExecutor) GetEquityCurve() []EquityPoint {
	return e.equityCurve
}

// ForceClosePosition closes any open position at given price
func (e *SimulatedExecutor) ForceClosePosition(price float64, timestamp time.Time) error {
	if e.position != nil {
		return e.ExecuteSell(e.position.Symbol, price, timestamp, "Backtest end - force close")
	}
	return nil
}

// Summary returns a formatted summary of current state
func (e *SimulatedExecutor) Summary() string {
	totalReturn := e.cash - e.config.InitialCapital
	returnPct := (totalReturn / e.config.InitialCapital) * 100

	return fmt.Sprintf(
		"Cash: $%.2f | Trades: %d | Return: $%.2f (%.2f%%)",
		e.cash, len(e.trades), totalReturn, returnPct,
	)
}
