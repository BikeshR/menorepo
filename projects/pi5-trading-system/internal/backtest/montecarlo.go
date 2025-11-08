package backtest

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"time"
)

// MonteCarloConfig holds configuration for Monte Carlo simulation
type MonteCarloConfig struct {
	// Number of simulation runs
	Simulations int

	// Random seed (0 = use current time)
	Seed int64

	// Confidence level for intervals (e.g., 0.95 for 95%)
	ConfidenceLevel float64
}

// MonteCarloResult holds results of Monte Carlo simulation
type MonteCarloResult struct {
	// Configuration
	Config *MonteCarloConfig

	// Original backtest result
	OriginalResult *BacktestResult

	// Simulation results
	Simulations []SimulationRun

	// Statistics on final returns
	MeanFinalReturn       float64
	MedianFinalReturn     float64
	StdDevFinalReturn     float64
	MinFinalReturn        float64
	MaxFinalReturn        float64
	ConfidenceIntervalLow float64
	ConfidenceIntervalHigh float64

	// Statistics on max drawdown
	MeanMaxDrawdown       float64
	MedianMaxDrawdown     float64
	StdDevMaxDrawdown     float64
	WorstMaxDrawdown      float64
	BestMaxDrawdown       float64

	// Statistics on Sharpe ratio
	MeanSharpe       float64
	MedianSharpe     float64
	StdDevSharpe     float64
	MinSharpe        float64
	MaxSharpe        float64

	// Probability metrics
	ProbabilityOfProfit float64 // % of simulations with positive return
	ProbabilityOfTarget float64 // % of simulations meeting target return

	// Risk of ruin
	RiskOfRuin float64 // % of simulations with > 50% drawdown

	// Execution time
	Duration time.Duration
}

// SimulationRun represents a single Monte Carlo simulation
type SimulationRun struct {
	RunNumber      int
	FinalReturn    float64
	FinalReturnPct float64
	MaxDrawdown    float64
	MaxDrawdownPct float64
	SharpeRatio    float64
	Trades         []Trade
}

// MonteCarloSimulator performs Monte Carlo simulation on backtest results
type MonteCarloSimulator struct {
	config *MonteCarloConfig
	rand   *rand.Rand
}

// NewMonteCarloSimulator creates a new Monte Carlo simulator
func NewMonteCarloSimulator(config *MonteCarloConfig) *MonteCarloSimulator {
	seed := config.Seed
	if seed == 0 {
		seed = time.Now().UnixNano()
	}

	return &MonteCarloSimulator{
		config: config,
		rand:   rand.New(rand.NewSource(seed)),
	}
}

// Simulate runs Monte Carlo simulation on backtest results
func (mcs *MonteCarloSimulator) Simulate(result *BacktestResult) *MonteCarloResult {
	startTime := time.Now()

	if len(result.Trades) == 0 {
		return &MonteCarloResult{
			Config:         mcs.config,
			OriginalResult: result,
			Duration:       time.Since(startTime),
		}
	}

	// Run simulations
	simulations := make([]SimulationRun, mcs.config.Simulations)

	for i := 0; i < mcs.config.Simulations; i++ {
		simulations[i] = mcs.runSimulation(i+1, result)
	}

	// Calculate statistics
	mcResult := mcs.calculateStatistics(result, simulations, time.Since(startTime))

	return mcResult
}

// runSimulation runs a single Monte Carlo simulation
func (mcs *MonteCarloSimulator) runSimulation(runNumber int, originalResult *BacktestResult) SimulationRun {
	// Randomly shuffle trades (sampling with replacement)
	shuffledTrades := mcs.shuffleTrades(originalResult.Trades)

	// Calculate equity curve and metrics from shuffled trades
	finalReturn, maxDrawdown, sharpe := mcs.calculateMetrics(shuffledTrades, originalResult.InitialCapital)

	return SimulationRun{
		RunNumber:      runNumber,
		FinalReturn:    finalReturn,
		FinalReturnPct: (finalReturn / originalResult.InitialCapital) * 100,
		MaxDrawdown:    maxDrawdown,
		MaxDrawdownPct: (maxDrawdown / originalResult.InitialCapital) * 100,
		SharpeRatio:    sharpe,
		Trades:         shuffledTrades,
	}
}

// shuffleTrades randomly reorders trades (bootstrap sampling)
func (mcs *MonteCarloSimulator) shuffleTrades(original []Trade) []Trade {
	n := len(original)
	shuffled := make([]Trade, n)

	// Sample with replacement
	for i := 0; i < n; i++ {
		idx := mcs.rand.Intn(n)
		shuffled[i] = original[idx]
	}

	return shuffled
}

// calculateMetrics calculates performance metrics from trade sequence
func (mcs *MonteCarloSimulator) calculateMetrics(trades []Trade, initialCapital float64) (float64, float64, float64) {
	equity := initialCapital
	peak := initialCapital
	maxDrawdown := 0.0

	// Track daily returns for Sharpe calculation
	dailyReturns := make([]float64, 0)
	previousEquity := initialCapital

	for _, trade := range trades {
		// Update equity
		equity += trade.NetProfit

		// Track drawdown
		if equity > peak {
			peak = equity
		}
		drawdown := peak - equity
		if drawdown > maxDrawdown {
			maxDrawdown = drawdown
		}

		// Calculate daily return (simplified - treat each trade as a day)
		dailyReturn := (equity - previousEquity) / previousEquity
		dailyReturns = append(dailyReturns, dailyReturn)
		previousEquity = equity
	}

	finalReturn := equity - initialCapital

	// Calculate Sharpe ratio
	sharpe := calculateSharpeFromReturns(dailyReturns)

	return finalReturn, maxDrawdown, sharpe
}

// calculateSharpeFromReturns calculates Sharpe ratio from returns
func calculateSharpeFromReturns(returns []float64) float64 {
	if len(returns) < 2 {
		return 0
	}

	// Calculate mean return
	mean := 0.0
	for _, r := range returns {
		mean += r
	}
	mean /= float64(len(returns))

	// Calculate standard deviation
	variance := 0.0
	for _, r := range returns {
		diff := r - mean
		variance += diff * diff
	}
	variance /= float64(len(returns) - 1)
	stdDev := math.Sqrt(variance)

	if stdDev == 0 {
		return 0
	}

	// Annualize (assume 252 trading days)
	sharpe := (mean / stdDev) * math.Sqrt(252)

	return sharpe
}

// calculateStatistics calculates aggregate statistics from simulations
func (mcs *MonteCarloSimulator) calculateStatistics(
	originalResult *BacktestResult,
	simulations []SimulationRun,
	duration time.Duration,
) *MonteCarloResult {
	result := &MonteCarloResult{
		Config:         mcs.config,
		OriginalResult: originalResult,
		Simulations:    simulations,
		Duration:       duration,
	}

	n := len(simulations)
	if n == 0 {
		return result
	}

	// Extract arrays for statistical calculations
	returns := make([]float64, n)
	drawdowns := make([]float64, n)
	sharpes := make([]float64, n)

	profitCount := 0
	targetCount := 0 // Count simulations meeting 10% target
	ruinCount := 0   // Count simulations with >50% drawdown

	for i, sim := range simulations {
		returns[i] = sim.FinalReturnPct
		drawdowns[i] = sim.MaxDrawdownPct
		sharpes[i] = sim.SharpeRatio

		if sim.FinalReturnPct > 0 {
			profitCount++
		}
		if sim.FinalReturnPct >= 10.0 {
			targetCount++
		}
		if sim.MaxDrawdownPct > 50.0 {
			ruinCount++
		}
	}

	// Sort for percentile calculations
	sortedReturns := make([]float64, n)
	copy(sortedReturns, returns)
	sort.Float64s(sortedReturns)

	sortedDrawdowns := make([]float64, n)
	copy(sortedDrawdowns, drawdowns)
	sort.Float64s(sortedDrawdowns)

	sortedSharpes := make([]float64, n)
	copy(sortedSharpes, sharpes)
	sort.Float64s(sortedSharpes)

	// Calculate statistics for returns
	result.MeanFinalReturn = mean(returns)
	result.MedianFinalReturn = median(sortedReturns)
	result.StdDevFinalReturn = stdDev(returns, result.MeanFinalReturn)
	result.MinFinalReturn = sortedReturns[0]
	result.MaxFinalReturn = sortedReturns[n-1]

	// Confidence intervals
	alpha := 1.0 - mcs.config.ConfidenceLevel
	lowerIdx := int(float64(n) * alpha / 2.0)
	upperIdx := int(float64(n) * (1.0 - alpha/2.0))
	result.ConfidenceIntervalLow = sortedReturns[lowerIdx]
	result.ConfidenceIntervalHigh = sortedReturns[upperIdx]

	// Calculate statistics for drawdown
	result.MeanMaxDrawdown = mean(drawdowns)
	result.MedianMaxDrawdown = median(sortedDrawdowns)
	result.StdDevMaxDrawdown = stdDev(drawdowns, result.MeanMaxDrawdown)
	result.WorstMaxDrawdown = sortedDrawdowns[n-1]
	result.BestMaxDrawdown = sortedDrawdowns[0]

	// Calculate statistics for Sharpe
	result.MeanSharpe = mean(sharpes)
	result.MedianSharpe = median(sortedSharpes)
	result.StdDevSharpe = stdDev(sharpes, result.MeanSharpe)
	result.MinSharpe = sortedSharpes[0]
	result.MaxSharpe = sortedSharpes[n-1]

	// Probability metrics
	result.ProbabilityOfProfit = float64(profitCount) / float64(n) * 100
	result.ProbabilityOfTarget = float64(targetCount) / float64(n) * 100
	result.RiskOfRuin = float64(ruinCount) / float64(n) * 100

	return result
}

// Helper functions for statistics

func mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func median(sortedValues []float64) float64 {
	n := len(sortedValues)
	if n == 0 {
		return 0
	}
	if n%2 == 0 {
		return (sortedValues[n/2-1] + sortedValues[n/2]) / 2.0
	}
	return sortedValues[n/2]
}

func stdDev(values []float64, mean float64) float64 {
	if len(values) < 2 {
		return 0
	}
	variance := 0.0
	for _, v := range values {
		diff := v - mean
		variance += diff * diff
	}
	variance /= float64(len(values) - 1)
	return math.Sqrt(variance)
}

// PrintMonteCarloResults formats Monte Carlo results for display
func PrintMonteCarloResults(result *MonteCarloResult) string {
	output := "\n"
	output += "═══════════════════════════════════════════════════════════════════════════════\n"
	output += "                      MONTE CARLO SIMULATION RESULTS\n"
	output += "═══════════════════════════════════════════════════════════════════════════════\n\n"

	output += "CONFIGURATION\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Simulations:          %d\n", result.Config.Simulations)
	output += fmt.Sprintf("Confidence Level:     %.0f%%\n", result.Config.ConfidenceLevel*100)
	output += fmt.Sprintf("Random Seed:          %d\n", result.Config.Seed)
	output += "\n"

	output += "ORIGINAL BACKTEST\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Total Return:         %.2f%%\n", result.OriginalResult.TotalReturnPct)
	output += fmt.Sprintf("Max Drawdown:         %.2f%%\n", result.OriginalResult.MaxDrawdownPct)
	output += fmt.Sprintf("Sharpe Ratio:         %.2f\n", result.OriginalResult.SharpeRatio)
	output += fmt.Sprintf("Total Trades:         %d\n", result.OriginalResult.TotalTrades)
	output += "\n"

	output += "FINAL RETURN STATISTICS\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Mean:                 %.2f%%\n", result.MeanFinalReturn)
	output += fmt.Sprintf("Median:               %.2f%%\n", result.MedianFinalReturn)
	output += fmt.Sprintf("Std Deviation:        %.2f%%\n", result.StdDevFinalReturn)
	output += fmt.Sprintf("Minimum:              %.2f%%\n", result.MinFinalReturn)
	output += fmt.Sprintf("Maximum:              %.2f%%\n", result.MaxFinalReturn)
	output += fmt.Sprintf("%.0f%% Confidence Int.:  %.2f%% to %.2f%%\n",
		result.Config.ConfidenceLevel*100,
		result.ConfidenceIntervalLow,
		result.ConfidenceIntervalHigh)
	output += "\n"

	output += "MAX DRAWDOWN STATISTICS\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Mean:                 %.2f%%\n", result.MeanMaxDrawdown)
	output += fmt.Sprintf("Median:               %.2f%%\n", result.MedianMaxDrawdown)
	output += fmt.Sprintf("Std Deviation:        %.2f%%\n", result.StdDevMaxDrawdown)
	output += fmt.Sprintf("Best (Lowest):        %.2f%%\n", result.BestMaxDrawdown)
	output += fmt.Sprintf("Worst (Highest):      %.2f%%\n", result.WorstMaxDrawdown)
	output += "\n"

	output += "SHARPE RATIO STATISTICS\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Mean:                 %.2f\n", result.MeanSharpe)
	output += fmt.Sprintf("Median:               %.2f\n", result.MedianSharpe)
	output += fmt.Sprintf("Std Deviation:        %.2f\n", result.StdDevSharpe)
	output += fmt.Sprintf("Minimum:              %.2f\n", result.MinSharpe)
	output += fmt.Sprintf("Maximum:              %.2f\n", result.MaxSharpe)
	output += "\n"

	output += "RISK METRICS\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Probability of Profit:    %.1f%%\n", result.ProbabilityOfProfit)
	output += fmt.Sprintf("Probability of 10%% Target: %.1f%%\n", result.ProbabilityOfTarget)
	output += fmt.Sprintf("Risk of Ruin (>50%% DD):   %.1f%%\n", result.RiskOfRuin)
	output += "\n"

	// Interpretation
	output += "INTERPRETATION\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"

	if result.ProbabilityOfProfit >= 70 {
		output += "✓ High probability of profit (>= 70%)\n"
	} else if result.ProbabilityOfProfit >= 50 {
		output += "⚠ Moderate probability of profit (50-70%)\n"
	} else {
		output += "✗ Low probability of profit (< 50%)\n"
	}

	if result.RiskOfRuin <= 5 {
		output += "✓ Low risk of ruin (<= 5%)\n"
	} else if result.RiskOfRuin <= 15 {
		output += "⚠ Moderate risk of ruin (5-15%)\n"
	} else {
		output += "✗ High risk of ruin (> 15%)\n"
	}

	if result.StdDevFinalReturn/math.Abs(result.MeanFinalReturn) <= 0.5 {
		output += "✓ Low variability in outcomes\n"
	} else if result.StdDevFinalReturn/math.Abs(result.MeanFinalReturn) <= 1.0 {
		output += "⚠ Moderate variability in outcomes\n"
	} else {
		output += "✗ High variability in outcomes (results may be due to luck)\n"
	}

	output += "\n"
	output += fmt.Sprintf("Simulation completed in %s\n", result.Duration.String())
	output += "═══════════════════════════════════════════════════════════════════════════════\n"

	return output
}
