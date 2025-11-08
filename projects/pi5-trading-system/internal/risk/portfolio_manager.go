package risk

import (
	"fmt"
	"math"
	"time"
)

// StrategyAllocation represents allocation to a single strategy
type StrategyAllocation struct {
	StrategyID string
	Allocation float64 // Percentage of portfolio (0.0 to 1.0)
	Active     bool
}

// PortfolioRiskLimits defines risk limits for the entire portfolio
type PortfolioRiskLimits struct {
	// Maximum total portfolio drawdown before halting all trading
	MaxPortfolioDrawdownPct float64

	// Maximum daily loss for entire portfolio
	MaxDailyLoss float64

	// Maximum number of concurrent positions across all strategies
	MaxConcurrentPositions int

	// Maximum correlation allowed between strategies
	MaxCorrelation float64

	// Minimum cash reserve to maintain
	MinCashReserve float64

	// Maximum leverage (total exposure / account value)
	MaxLeverage float64
}

// PortfolioState represents current portfolio state
type PortfolioState struct {
	// Account metrics
	TotalEquity       float64
	Cash              float64
	PositionValue     float64
	PeakEquity        float64
	CurrentDrawdown   float64
	CurrentDrawdownPct float64

	// Daily tracking
	DailyPnL      float64
	DailyStartEquity float64

	// Position tracking
	OpenPositions     int
	PositionsByStrategy map[string]int

	// Exposure
	TotalExposure float64
	Leverage      float64

	// Timestamp
	LastUpdate time.Time
}

// PortfolioRiskManager manages risk across multiple strategies
type PortfolioRiskManager struct {
	Limits     *PortfolioRiskLimits
	State      *PortfolioState
	Allocations []StrategyAllocation

	// Performance tracking
	StrategyReturns map[string][]float64 // Daily returns by strategy
	StrategyMetrics map[string]*StrategyMetrics
}

// StrategyMetrics tracks performance metrics for a strategy
type StrategyMetrics struct {
	TotalReturn    float64
	SharpeRatio    float64
	MaxDrawdown    float64
	WinRate        float64
	TotalTrades    int
	LastUpdateTime time.Time
	Active         bool
}

// NewPortfolioRiskManager creates a new portfolio risk manager
func NewPortfolioRiskManager(limits *PortfolioRiskLimits, initialEquity float64) *PortfolioRiskManager {
	return &PortfolioRiskManager{
		Limits: limits,
		State: &PortfolioState{
			TotalEquity:         initialEquity,
			Cash:                initialEquity,
			PeakEquity:          initialEquity,
			DailyStartEquity:    initialEquity,
			PositionsByStrategy: make(map[string]int),
			LastUpdate:          time.Now(),
		},
		Allocations:     make([]StrategyAllocation, 0),
		StrategyReturns: make(map[string][]float64),
		StrategyMetrics: make(map[string]*StrategyMetrics),
	}
}

// UpdateEquity updates portfolio equity and calculates drawdown
func (prm *PortfolioRiskManager) UpdateEquity(newEquity float64) {
	prm.State.TotalEquity = newEquity

	// Update peak equity
	if newEquity > prm.State.PeakEquity {
		prm.State.PeakEquity = newEquity
	}

	// Calculate drawdown
	prm.State.CurrentDrawdown = prm.State.PeakEquity - newEquity
	if prm.State.PeakEquity > 0 {
		prm.State.CurrentDrawdownPct = (prm.State.CurrentDrawdown / prm.State.PeakEquity) * 100
	}

	// Calculate daily P&L
	prm.State.DailyPnL = newEquity - prm.State.DailyStartEquity

	prm.State.LastUpdate = time.Now()
}

// UpdatePositions updates position counts
func (prm *PortfolioRiskManager) UpdatePositions(strategyID string, positionCount int) {
	oldCount := prm.State.PositionsByStrategy[strategyID]
	prm.State.PositionsByStrategy[strategyID] = positionCount

	// Recalculate total open positions
	prm.State.OpenPositions = 0
	for _, count := range prm.State.PositionsByStrategy {
		prm.State.OpenPositions += count
	}

	// Log change
	if positionCount != oldCount {
		fmt.Printf("Strategy %s positions: %d → %d (Total: %d)\n",
			strategyID, oldCount, positionCount, prm.State.OpenPositions)
	}
}

// UpdateExposure updates total exposure and leverage
func (prm *PortfolioRiskManager) UpdateExposure(totalExposure float64) {
	prm.State.TotalExposure = totalExposure

	if prm.State.TotalEquity > 0 {
		prm.State.Leverage = totalExposure / prm.State.TotalEquity
	}
}

// ResetDailyTracking resets daily P&L tracking (call at start of each day)
func (prm *PortfolioRiskManager) ResetDailyTracking() {
	prm.State.DailyStartEquity = prm.State.TotalEquity
	prm.State.DailyPnL = 0
}

// CanTrade checks if trading is allowed based on risk limits
func (prm *PortfolioRiskManager) CanTrade(strategyID string) (bool, string) {
	// Check portfolio drawdown limit
	if prm.State.CurrentDrawdownPct > prm.Limits.MaxPortfolioDrawdownPct {
		return false, fmt.Sprintf("Portfolio drawdown %.2f%% exceeds limit %.2f%%",
			prm.State.CurrentDrawdownPct, prm.Limits.MaxPortfolioDrawdownPct)
	}

	// Check daily loss limit
	if prm.Limits.MaxDailyLoss > 0 && prm.State.DailyPnL < -prm.Limits.MaxDailyLoss {
		return false, fmt.Sprintf("Daily loss $%.2f exceeds limit $%.2f",
			-prm.State.DailyPnL, prm.Limits.MaxDailyLoss)
	}

	// Check max concurrent positions
	if prm.State.OpenPositions >= prm.Limits.MaxConcurrentPositions {
		return false, fmt.Sprintf("Max concurrent positions reached (%d)",
			prm.Limits.MaxConcurrentPositions)
	}

	// Check cash reserve
	if prm.State.Cash < prm.Limits.MinCashReserve {
		return false, fmt.Sprintf("Cash $%.2f below minimum reserve $%.2f",
			prm.State.Cash, prm.Limits.MinCashReserve)
	}

	// Check leverage limit
	if prm.State.Leverage > prm.Limits.MaxLeverage {
		return false, fmt.Sprintf("Leverage %.2fx exceeds limit %.2fx",
			prm.State.Leverage, prm.Limits.MaxLeverage)
	}

	// Check if strategy is allocated and active
	allocated := false
	for _, alloc := range prm.Allocations {
		if alloc.StrategyID == strategyID && alloc.Active && alloc.Allocation > 0 {
			allocated = true
			break
		}
	}

	if !allocated {
		return false, fmt.Sprintf("Strategy %s not allocated or inactive", strategyID)
	}

	return true, ""
}

// GetStrategyAllocation returns the capital allocated to a strategy
func (prm *PortfolioRiskManager) GetStrategyAllocation(strategyID string) float64 {
	for _, alloc := range prm.Allocations {
		if alloc.StrategyID == strategyID && alloc.Active {
			return prm.State.TotalEquity * alloc.Allocation
		}
	}
	return 0
}

// SetAllocations sets strategy allocations
func (prm *PortfolioRiskManager) SetAllocations(allocations []StrategyAllocation) error {
	// Validate allocations sum to <= 1.0
	totalAllocation := 0.0
	for _, alloc := range allocations {
		if alloc.Active {
			totalAllocation += alloc.Allocation
		}
	}

	if totalAllocation > 1.0 {
		return fmt.Errorf("total allocation %.2f exceeds 100%%", totalAllocation*100)
	}

	prm.Allocations = allocations
	return nil
}

// UpdateStrategyMetrics updates performance metrics for a strategy
func (prm *PortfolioRiskManager) UpdateStrategyMetrics(strategyID string, metrics *StrategyMetrics) {
	prm.StrategyMetrics[strategyID] = metrics
}

// RecordStrategyReturn records daily return for a strategy
func (prm *PortfolioRiskManager) RecordStrategyReturn(strategyID string, dailyReturn float64) {
	if prm.StrategyReturns[strategyID] == nil {
		prm.StrategyReturns[strategyID] = make([]float64, 0)
	}
	prm.StrategyReturns[strategyID] = append(prm.StrategyReturns[strategyID], dailyReturn)
}

// GetPortfolioSummary returns a formatted summary of portfolio state
func (prm *PortfolioRiskManager) GetPortfolioSummary() string {
	return fmt.Sprintf(`Portfolio Summary
═══════════════════════════════════════════════════
Total Equity:      $%.2f
Cash:              $%.2f (%.1f%%)
Position Value:    $%.2f (%.1f%%)
Peak Equity:       $%.2f
Current Drawdown:  $%.2f (%.2f%%)
Daily P&L:         $%.2f
Open Positions:    %d
Leverage:          %.2fx
Last Update:       %s
───────────────────────────────────────────────────
Risk Limits:
  Max DD:          %.1f%%
  Max Daily Loss:  $%.2f
  Max Positions:   %d
  Max Leverage:    %.2fx
  Min Cash:        $%.2f
═══════════════════════════════════════════════════`,
		prm.State.TotalEquity,
		prm.State.Cash,
		(prm.State.Cash/prm.State.TotalEquity)*100,
		prm.State.PositionValue,
		(prm.State.PositionValue/prm.State.TotalEquity)*100,
		prm.State.PeakEquity,
		prm.State.CurrentDrawdown,
		prm.State.CurrentDrawdownPct,
		prm.State.DailyPnL,
		prm.State.OpenPositions,
		prm.State.Leverage,
		prm.State.LastUpdate.Format("2006-01-02 15:04:05"),
		prm.Limits.MaxPortfolioDrawdownPct,
		prm.Limits.MaxDailyLoss,
		prm.Limits.MaxConcurrentPositions,
		prm.Limits.MaxLeverage,
		prm.Limits.MinCashReserve,
	)
}

// GetStrategyAllocationSummary returns summary of strategy allocations
func (prm *PortfolioRiskManager) GetStrategyAllocationSummary() string {
	summary := "Strategy Allocations\n"
	summary += "═══════════════════════════════════════════════════\n"

	totalAllocated := 0.0
	for _, alloc := range prm.Allocations {
		status := "INACTIVE"
		if alloc.Active {
			status = "ACTIVE"
			totalAllocated += alloc.Allocation
		}

		capital := prm.State.TotalEquity * alloc.Allocation
		positions := prm.State.PositionsByStrategy[alloc.StrategyID]

		summary += fmt.Sprintf("%-20s %6.1f%% $%10.2f  Pos: %2d  [%s]\n",
			alloc.StrategyID,
			alloc.Allocation*100,
			capital,
			positions,
			status,
		)
	}

	summary += "───────────────────────────────────────────────────\n"
	summary += fmt.Sprintf("Total Allocated:     %6.1f%%\n", totalAllocated*100)
	summary += fmt.Sprintf("Cash Reserve:        %6.1f%%\n", (1.0-totalAllocated)*100)
	summary += "═══════════════════════════════════════════════════\n"

	return summary
}

// DefaultRiskLimits returns conservative default risk limits
func DefaultRiskLimits() *PortfolioRiskLimits {
	return &PortfolioRiskLimits{
		MaxPortfolioDrawdownPct: 15.0,   // 15% max portfolio drawdown
		MaxDailyLoss:            3000.0, // $3k max daily loss
		MaxConcurrentPositions:  5,      // Max 5 positions at once
		MaxCorrelation:          0.7,    // Max 0.7 correlation between strategies
		MinCashReserve:          10000,  // Keep $10k cash reserve
		MaxLeverage:             1.5,    // 1.5x max leverage
	}
}

// AggressiveRiskLimits returns aggressive risk limits for experienced traders
func AggressiveRiskLimits() *PortfolioRiskLimits {
	return &PortfolioRiskLimits{
		MaxPortfolioDrawdownPct: 25.0,
		MaxDailyLoss:            5000.0,
		MaxConcurrentPositions:  10,
		MaxCorrelation:          0.8,
		MinCashReserve:          5000,
		MaxLeverage:             2.0,
	}
}

// ConservativeRiskLimits returns very conservative risk limits
func ConservativeRiskLimits() *PortfolioRiskLimits {
	return &PortfolioRiskLimits{
		MaxPortfolioDrawdownPct: 10.0,
		MaxDailyLoss:            2000.0,
		MaxConcurrentPositions:  3,
		MaxCorrelation:          0.5,
		MinCashReserve:          20000,
		MaxLeverage:             1.0,
	}
}

// CalculatePortfolioMetrics calculates aggregate portfolio metrics
func (prm *PortfolioRiskManager) CalculatePortfolioMetrics() map[string]float64 {
	metrics := make(map[string]float64)

	// Total return
	if prm.State.DailyStartEquity > 0 {
		initialEquity := prm.State.DailyStartEquity // Simplified: use daily start as initial
		metrics["total_return_pct"] = ((prm.State.TotalEquity - initialEquity) / initialEquity) * 100
	}

	// Current drawdown
	metrics["current_drawdown_pct"] = prm.State.CurrentDrawdownPct

	// Position utilization
	if prm.Limits.MaxConcurrentPositions > 0 {
		metrics["position_utilization_pct"] = (float64(prm.State.OpenPositions) / float64(prm.Limits.MaxConcurrentPositions)) * 100
	}

	// Cash utilization
	metrics["cash_utilization_pct"] = ((prm.State.TotalEquity - prm.State.Cash) / prm.State.TotalEquity) * 100

	// Leverage
	metrics["leverage"] = prm.State.Leverage

	// Active strategies
	activeCount := 0
	for _, alloc := range prm.Allocations {
		if alloc.Active {
			activeCount++
		}
	}
	metrics["active_strategies"] = float64(activeCount)

	return metrics
}

// GetRiskStatus returns current risk status
func (prm *PortfolioRiskManager) GetRiskStatus() string {
	canTrade, reason := prm.CanTrade("check")

	if !canTrade {
		return fmt.Sprintf("🔴 RISK LIMIT VIOLATED: %s", reason)
	}

	// Check warning levels (80% of limits)
	warnings := make([]string, 0)

	if prm.State.CurrentDrawdownPct > prm.Limits.MaxPortfolioDrawdownPct*0.8 {
		warnings = append(warnings, "Drawdown near limit")
	}

	if prm.Limits.MaxDailyLoss > 0 && -prm.State.DailyPnL > prm.Limits.MaxDailyLoss*0.8 {
		warnings = append(warnings, "Daily loss near limit")
	}

	if float64(prm.State.OpenPositions) > float64(prm.Limits.MaxConcurrentPositions)*0.8 {
		warnings = append(warnings, "Position count high")
	}

	if len(warnings) > 0 {
		return fmt.Sprintf("🟡 WARNING: %v", warnings)
	}

	return "🟢 RISK OK: All limits within normal range"
}

// CalculateCorrelationMatrix calculates correlation between strategies
func (prm *PortfolioRiskManager) CalculateCorrelationMatrix() map[string]map[string]float64 {
	matrix := make(map[string]map[string]float64)

	strategies := make([]string, 0)
	for strategyID := range prm.StrategyReturns {
		strategies = append(strategies, strategyID)
	}

	for _, s1 := range strategies {
		matrix[s1] = make(map[string]float64)
		for _, s2 := range strategies {
			if s1 == s2 {
				matrix[s1][s2] = 1.0
			} else {
				matrix[s1][s2] = calculateCorrelation(
					prm.StrategyReturns[s1],
					prm.StrategyReturns[s2],
				)
			}
		}
	}

	return matrix
}

// calculateCorrelation calculates Pearson correlation coefficient
func calculateCorrelation(x, y []float64) float64 {
	if len(x) != len(y) || len(x) < 2 {
		return 0
	}

	n := float64(len(x))

	// Calculate means
	var sumX, sumY float64
	for i := 0; i < len(x); i++ {
		sumX += x[i]
		sumY += y[i]
	}
	meanX := sumX / n
	meanY := sumY / n

	// Calculate covariance and standard deviations
	var covariance, varX, varY float64
	for i := 0; i < len(x); i++ {
		dx := x[i] - meanX
		dy := y[i] - meanY
		covariance += dx * dy
		varX += dx * dx
		varY += dy * dy
	}

	// Pearson correlation coefficient
	if varX == 0 || varY == 0 {
		return 0
	}

	correlation := covariance / math.Sqrt(varX*varY)
	return correlation
}
