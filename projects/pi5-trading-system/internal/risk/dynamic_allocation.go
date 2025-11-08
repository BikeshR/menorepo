package risk

import (
	"fmt"
	"math"
	"sort"
	"time"
)

// AllocationMethod defines how to allocate capital across strategies
type AllocationMethod string

const (
	// EqualWeight allocates equally to all strategies
	AllocationEqualWeight AllocationMethod = "equal_weight"

	// PerformanceWeighted allocates based on recent performance
	AllocationPerformanceWeighted AllocationMethod = "performance_weighted"

	// SharpeWeighted allocates based on Sharpe ratios
	AllocationSharpeWeighted AllocationMethod = "sharpe_weighted"

	// RiskParity allocates to equalize risk contribution
	AllocationRiskParity AllocationMethod = "risk_parity"

	// AdaptiveKelly uses Kelly Criterion with recent performance
	AllocationAdaptiveKelly AllocationMethod = "adaptive_kelly"
)

// DynamicAllocator adjusts strategy allocations based on performance
type DynamicAllocator struct {
	Method              AllocationMethod
	LookbackPeriod      int     // Days to look back for performance
	MinAllocation       float64 // Minimum allocation per strategy
	MaxAllocation       float64 // Maximum allocation per strategy
	RebalanceThreshold  float64 // Minimum allocation change to trigger rebalance
	AdaptationSpeed     float64 // How quickly to adapt (0.0 to 1.0)
}

// NewDynamicAllocator creates a new dynamic allocator
func NewDynamicAllocator(method AllocationMethod) *DynamicAllocator {
	return &DynamicAllocator{
		Method:             method,
		LookbackPeriod:     30,   // 30 days lookback
		MinAllocation:      0.05, // 5% minimum
		MaxAllocation:      0.40, // 40% maximum
		RebalanceThreshold: 0.02, // 2% change triggers rebalance
		AdaptationSpeed:    0.3,  // 30% adaptation per rebalance
	}
}

// CalculateAllocations calculates optimal allocations for strategies
func (da *DynamicAllocator) CalculateAllocations(
	manager *PortfolioRiskManager,
	activeStrategies []string,
) ([]StrategyAllocation, error) {
	if len(activeStrategies) == 0 {
		return nil, fmt.Errorf("no active strategies")
	}

	var allocations []StrategyAllocation

	switch da.Method {
	case AllocationEqualWeight:
		allocations = da.equalWeightAllocations(activeStrategies)

	case AllocationPerformanceWeighted:
		allocations = da.performanceWeightedAllocations(manager, activeStrategies)

	case AllocationSharpeWeighted:
		allocations = da.sharpeWeightedAllocations(manager, activeStrategies)

	case AllocationRiskParity:
		allocations = da.riskParityAllocations(manager, activeStrategies)

	case AllocationAdaptiveKelly:
		allocations = da.adaptiveKellyAllocations(manager, activeStrategies)

	default:
		return nil, fmt.Errorf("unknown allocation method: %s", da.Method)
	}

	// Apply constraints
	allocations = da.applyConstraints(allocations)

	return allocations, nil
}

// equalWeightAllocations allocates equally to all strategies
func (da *DynamicAllocator) equalWeightAllocations(strategies []string) []StrategyAllocation {
	allocation := 1.0 / float64(len(strategies))

	allocations := make([]StrategyAllocation, len(strategies))
	for i, strategyID := range strategies {
		allocations[i] = StrategyAllocation{
			StrategyID: strategyID,
			Allocation: allocation,
			Active:     true,
		}
	}

	return allocations
}

// performanceWeightedAllocations weights by recent returns
func (da *DynamicAllocator) performanceWeightedAllocations(
	manager *PortfolioRiskManager,
	strategies []string,
) []StrategyAllocation {
	// Calculate recent returns for each strategy
	returns := make(map[string]float64)
	totalReturn := 0.0

	for _, strategyID := range strategies {
		recentReturn := da.calculateRecentReturn(manager, strategyID)

		// Only allocate to strategies with positive returns
		if recentReturn > 0 {
			returns[strategyID] = recentReturn
			totalReturn += recentReturn
		}
	}

	// If no strategies have positive returns, use equal weight
	if totalReturn == 0 {
		return da.equalWeightAllocations(strategies)
	}

	// Weight by proportion of total returns
	allocations := make([]StrategyAllocation, 0)
	for _, strategyID := range strategies {
		allocation := 0.0
		if returns[strategyID] > 0 {
			allocation = returns[strategyID] / totalReturn
		}

		allocations = append(allocations, StrategyAllocation{
			StrategyID: strategyID,
			Allocation: allocation,
			Active:     allocation > 0,
		})
	}

	return allocations
}

// sharpeWeightedAllocations weights by Sharpe ratios
func (da *DynamicAllocator) sharpeWeightedAllocations(
	manager *PortfolioRiskManager,
	strategies []string,
) []StrategyAllocation {
	// Calculate Sharpe ratio for each strategy
	sharpes := make(map[string]float64)
	totalSharpe := 0.0

	for _, strategyID := range strategies {
		sharpe := da.calculateSharpeRatio(manager, strategyID)

		// Only allocate to strategies with positive Sharpe
		if sharpe > 0 {
			sharpes[strategyID] = sharpe
			totalSharpe += sharpe
		}
	}

	// If no strategies have positive Sharpe, use equal weight
	if totalSharpe == 0 {
		return da.equalWeightAllocations(strategies)
	}

	// Weight by proportion of total Sharpe
	allocations := make([]StrategyAllocation, 0)
	for _, strategyID := range strategies {
		allocation := 0.0
		if sharpes[strategyID] > 0 {
			allocation = sharpes[strategyID] / totalSharpe
		}

		allocations = append(allocations, StrategyAllocation{
			StrategyID: strategyID,
			Allocation: allocation,
			Active:     allocation > 0,
		})
	}

	return allocations
}

// riskParityAllocations equalizes risk contribution
func (da *DynamicAllocator) riskParityAllocations(
	manager *PortfolioRiskManager,
	strategies []string,
) []StrategyAllocation {
	// Calculate volatility (std dev of returns) for each strategy
	volatilities := make(map[string]float64)

	for _, strategyID := range strategies {
		vol := da.calculateVolatility(manager, strategyID)
		if vol > 0 {
			volatilities[strategyID] = vol
		}
	}

	// If no volatility data, use equal weight
	if len(volatilities) == 0 {
		return da.equalWeightAllocations(strategies)
	}

	// Inverse volatility weighting (lower vol = higher allocation)
	invVolSum := 0.0
	for _, vol := range volatilities {
		invVolSum += 1.0 / vol
	}

	allocations := make([]StrategyAllocation, 0)
	for _, strategyID := range strategies {
		allocation := 0.0
		if vol, ok := volatilities[strategyID]; ok && vol > 0 {
			allocation = (1.0 / vol) / invVolSum
		}

		allocations = append(allocations, StrategyAllocation{
			StrategyID: strategyID,
			Allocation: allocation,
			Active:     allocation > 0,
		})
	}

	return allocations
}

// adaptiveKellyAllocations uses Kelly Criterion with recent stats
func (da *DynamicAllocator) adaptiveKellyAllocations(
	manager *PortfolioRiskManager,
	strategies []string,
) []StrategyAllocation {
	// Calculate Kelly fraction for each strategy
	kellyFractions := make(map[string]float64)
	totalKelly := 0.0

	for _, strategyID := range strategies {
		// Get recent win rate and win/loss ratio
		winRate, winLossRatio := da.calculateWinStats(manager, strategyID)

		if winRate > 0 && winLossRatio > 0 {
			// Kelly formula: W - ((1-W) / B) where W=win rate, B=win/loss ratio
			kelly := winRate - ((1.0 - winRate) / winLossRatio)

			// Use fractional Kelly (25%) for safety
			kelly *= 0.25

			if kelly > 0 {
				kellyFractions[strategyID] = kelly
				totalKelly += kelly
			}
		}
	}

	// If no positive Kelly fractions, use equal weight
	if totalKelly == 0 {
		return da.equalWeightAllocations(strategies)
	}

	// Normalize to sum to 1.0
	allocations := make([]StrategyAllocation, 0)
	for _, strategyID := range strategies {
		allocation := 0.0
		if kelly, ok := kellyFractions[strategyID]; ok {
			allocation = kelly / totalKelly
		}

		allocations = append(allocations, StrategyAllocation{
			StrategyID: strategyID,
			Allocation: allocation,
			Active:     allocation > 0,
		})
	}

	return allocations
}

// calculateRecentReturn calculates cumulative return over lookback period
func (da *DynamicAllocator) calculateRecentReturn(manager *PortfolioRiskManager, strategyID string) float64 {
	returns := manager.StrategyReturns[strategyID]
	if len(returns) == 0 {
		return 0
	}

	// Take last N returns
	start := 0
	if len(returns) > da.LookbackPeriod {
		start = len(returns) - da.LookbackPeriod
	}

	recentReturns := returns[start:]

	// Calculate cumulative return
	cumulative := 1.0
	for _, r := range recentReturns {
		cumulative *= (1.0 + r)
	}

	return cumulative - 1.0
}

// calculateSharpeRatio calculates Sharpe ratio over lookback period
func (da *DynamicAllocator) calculateSharpeRatio(manager *PortfolioRiskManager, strategyID string) float64 {
	returns := manager.StrategyReturns[strategyID]
	if len(returns) < 2 {
		return 0
	}

	// Take last N returns
	start := 0
	if len(returns) > da.LookbackPeriod {
		start = len(returns) - da.LookbackPeriod
	}

	recentReturns := returns[start:]

	// Calculate mean return
	mean := 0.0
	for _, r := range recentReturns {
		mean += r
	}
	mean /= float64(len(recentReturns))

	// Calculate standard deviation
	variance := 0.0
	for _, r := range recentReturns {
		diff := r - mean
		variance += diff * diff
	}
	variance /= float64(len(recentReturns) - 1)
	stdDev := math.Sqrt(variance)

	if stdDev == 0 {
		return 0
	}

	// Annualized Sharpe (assuming 252 trading days)
	sharpe := (mean / stdDev) * math.Sqrt(252)

	return sharpe
}

// calculateVolatility calculates volatility (std dev of returns)
func (da *DynamicAllocator) calculateVolatility(manager *PortfolioRiskManager, strategyID string) float64 {
	returns := manager.StrategyReturns[strategyID]
	if len(returns) < 2 {
		return 0
	}

	// Take last N returns
	start := 0
	if len(returns) > da.LookbackPeriod {
		start = len(returns) - da.LookbackPeriod
	}

	recentReturns := returns[start:]

	// Calculate mean
	mean := 0.0
	for _, r := range recentReturns {
		mean += r
	}
	mean /= float64(len(recentReturns))

	// Calculate standard deviation
	variance := 0.0
	for _, r := range recentReturns {
		diff := r - mean
		variance += diff * diff
	}
	variance /= float64(len(recentReturns) - 1)

	// Annualize volatility
	annualizedVol := math.Sqrt(variance) * math.Sqrt(252)

	return annualizedVol
}

// calculateWinStats calculates win rate and win/loss ratio
func (da *DynamicAllocator) calculateWinStats(manager *PortfolioRiskManager, strategyID string) (float64, float64) {
	returns := manager.StrategyReturns[strategyID]
	if len(returns) == 0 {
		return 0, 0
	}

	// Take last N returns
	start := 0
	if len(returns) > da.LookbackPeriod {
		start = len(returns) - da.LookbackPeriod
	}

	recentReturns := returns[start:]

	wins := 0
	totalWin := 0.0
	totalLoss := 0.0

	for _, r := range recentReturns {
		if r > 0 {
			wins++
			totalWin += r
		} else if r < 0 {
			totalLoss += math.Abs(r)
		}
	}

	winRate := float64(wins) / float64(len(recentReturns))

	avgWin := 0.0
	avgLoss := 0.0
	if wins > 0 {
		avgWin = totalWin / float64(wins)
	}
	losses := len(recentReturns) - wins
	if losses > 0 {
		avgLoss = totalLoss / float64(losses)
	}

	winLossRatio := 0.0
	if avgLoss > 0 {
		winLossRatio = avgWin / avgLoss
	}

	return winRate, winLossRatio
}

// applyConstraints applies min/max allocation constraints
func (da *DynamicAllocator) applyConstraints(allocations []StrategyAllocation) []StrategyAllocation {
	constrained := make([]StrategyAllocation, len(allocations))
	copy(constrained, allocations)

	// Apply min/max constraints
	totalAllocation := 0.0
	for i := range constrained {
		if constrained[i].Allocation < da.MinAllocation && constrained[i].Active {
			constrained[i].Allocation = da.MinAllocation
		}
		if constrained[i].Allocation > da.MaxAllocation {
			constrained[i].Allocation = da.MaxAllocation
		}
		totalAllocation += constrained[i].Allocation
	}

	// Normalize to sum to 1.0
	if totalAllocation > 0 {
		for i := range constrained {
			constrained[i].Allocation /= totalAllocation
		}
	}

	return constrained
}

// ShouldRebalance checks if allocations have changed enough to warrant rebalancing
func (da *DynamicAllocator) ShouldRebalance(
	currentAllocations []StrategyAllocation,
	newAllocations []StrategyAllocation,
) bool {
	// Create maps for easy lookup
	current := make(map[string]float64)
	for _, alloc := range currentAllocations {
		current[alloc.StrategyID] = alloc.Allocation
	}

	// Check if any allocation changed by more than threshold
	for _, newAlloc := range newAllocations {
		currentAlloc := current[newAlloc.StrategyID]
		change := math.Abs(newAlloc.Allocation - currentAlloc)

		if change > da.RebalanceThreshold {
			return true
		}
	}

	return false
}

// BlendAllocations blends current and new allocations based on adaptation speed
func (da *DynamicAllocator) BlendAllocations(
	currentAllocations []StrategyAllocation,
	newAllocations []StrategyAllocation,
) []StrategyAllocation {
	current := make(map[string]float64)
	for _, alloc := range currentAllocations {
		current[alloc.StrategyID] = alloc.Allocation
	}

	blended := make([]StrategyAllocation, len(newAllocations))

	for i, newAlloc := range newAllocations {
		currentAlloc := current[newAlloc.StrategyID]

		// Blend: new = (1-speed) * current + speed * target
		blendedAlloc := (1.0-da.AdaptationSpeed)*currentAlloc + da.AdaptationSpeed*newAlloc.Allocation

		blended[i] = StrategyAllocation{
			StrategyID: newAlloc.StrategyID,
			Allocation: blendedAlloc,
			Active:     newAlloc.Active,
		}
	}

	return blended
}

// RankStrategiesByPerformance ranks strategies by performance metric
func RankStrategiesByPerformance(manager *PortfolioRiskManager, metric string) []string {
	type strategyScore struct {
		ID    string
		Score float64
	}

	scores := make([]strategyScore, 0)

	for strategyID, metrics := range manager.StrategyMetrics {
		var score float64

		switch metric {
		case "sharpe":
			score = metrics.SharpeRatio
		case "return":
			score = metrics.TotalReturn
		case "win_rate":
			score = metrics.WinRate
		default:
			score = metrics.SharpeRatio
		}

		scores = append(scores, strategyScore{
			ID:    strategyID,
			Score: score,
		})
	}

	// Sort by score descending
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].Score > scores[j].Score
	})

	ranked := make([]string, len(scores))
	for i, s := range scores {
		ranked[i] = s.ID
	}

	return ranked
}

// AllocationReport generates a report of allocation changes
type AllocationReport struct {
	Timestamp    time.Time
	Method       AllocationMethod
	Changes      []AllocationChange
	TotalChange  float64
	Rebalanced   bool
}

// AllocationChange represents a change in strategy allocation
type AllocationChange struct {
	StrategyID       string
	OldAllocation    float64
	NewAllocation    float64
	Change           float64
	ChangePct        float64
}

// GenerateAllocationReport creates a report of allocation changes
func GenerateAllocationReport(
	method AllocationMethod,
	oldAllocations []StrategyAllocation,
	newAllocations []StrategyAllocation,
	rebalanced bool,
) *AllocationReport {
	oldMap := make(map[string]float64)
	for _, alloc := range oldAllocations {
		oldMap[alloc.StrategyID] = alloc.Allocation
	}

	changes := make([]AllocationChange, 0)
	totalChange := 0.0

	for _, newAlloc := range newAllocations {
		oldAlloc := oldMap[newAlloc.StrategyID]
		change := newAlloc.Allocation - oldAlloc
		changePct := 0.0

		if oldAlloc > 0 {
			changePct = (change / oldAlloc) * 100
		}

		changes = append(changes, AllocationChange{
			StrategyID:    newAlloc.StrategyID,
			OldAllocation: oldAlloc,
			NewAllocation: newAlloc.Allocation,
			Change:        change,
			ChangePct:     changePct,
		})

		totalChange += math.Abs(change)
	}

	return &AllocationReport{
		Timestamp:   time.Now(),
		Method:      method,
		Changes:     changes,
		TotalChange: totalChange,
		Rebalanced:  rebalanced,
	}
}

// PrintReport prints the allocation report
func (ar *AllocationReport) PrintReport() string {
	output := "\n"
	output += "═══════════════════════════════════════════════════════════════\n"
	output += "               ALLOCATION REBALANCE REPORT\n"
	output += "═══════════════════════════════════════════════════════════════\n"
	output += fmt.Sprintf("Timestamp:       %s\n", ar.Timestamp.Format("2006-01-02 15:04:05"))
	output += fmt.Sprintf("Method:          %s\n", ar.Method)
	output += fmt.Sprintf("Rebalanced:      %t\n", ar.Rebalanced)
	output += fmt.Sprintf("Total Change:    %.2f%%\n", ar.TotalChange*100)
	output += "───────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("%-20s %10s %10s %10s %8s\n", "Strategy", "Old", "New", "Change", "Change%")
	output += "───────────────────────────────────────────────────────────────\n"

	for _, change := range ar.Changes {
		output += fmt.Sprintf("%-20s %9.1f%% %9.1f%% %+9.1f%% %+7.1f%%\n",
			change.StrategyID,
			change.OldAllocation*100,
			change.NewAllocation*100,
			change.Change*100,
			change.ChangePct,
		)
	}

	output += "═══════════════════════════════════════════════════════════════\n"

	return output
}
