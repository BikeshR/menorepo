package backtest

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/strategy"
	"github.com/bikeshrana/pi5-trading-system-go/internal/marketdata"
	"github.com/rs/zerolog"
)

// ParameterSet represents a set of parameters to test
type ParameterSet map[string]interface{}

// ParameterRange defines a range of values to test for a parameter
type ParameterRange struct {
	Name   string
	Values []interface{}
}

// OptimizationConfig holds configuration for parameter optimization
type OptimizationConfig struct {
	// Base backtest config
	BacktestConfig *Config

	// Parameter ranges to test
	ParameterRanges []ParameterRange

	// Optimization metric to maximize
	// Options: "sharpe_ratio", "total_return", "profit_factor", "calmar_ratio"
	OptimizationMetric string

	// Number of parallel workers
	Workers int

	// Maximum number of combinations to test (0 = all)
	MaxCombinations int
}

// OptimizationResult holds results for a single parameter set
type OptimizationResult struct {
	Parameters     ParameterSet
	BacktestResult *BacktestResult
	MetricValue    float64
	Rank           int
}

// Optimizer performs parameter optimization using grid search
type Optimizer struct {
	config     *OptimizationConfig
	dataClient *marketdata.AlpacaClient
	logger     zerolog.Logger
}

// NewOptimizer creates a new parameter optimizer
func NewOptimizer(config *OptimizationConfig, dataClient *marketdata.AlpacaClient, logger zerolog.Logger) *Optimizer {
	return &Optimizer{
		config:     config,
		dataClient: dataClient,
		logger:     logger,
	}
}

// Optimize runs grid search optimization
func (o *Optimizer) Optimize(ctx context.Context, strategyFactory StrategyFactory) ([]*OptimizationResult, error) {
	o.logger.Info().Msg("Starting parameter optimization")

	// Generate all parameter combinations
	combinations := o.generateCombinations()

	totalCombinations := len(combinations)
	if o.config.MaxCombinations > 0 && totalCombinations > o.config.MaxCombinations {
		o.logger.Warn().
			Int("total", totalCombinations).
			Int("max", o.config.MaxCombinations).
			Msg("Limiting combinations to max")
		combinations = combinations[:o.config.MaxCombinations]
		totalCombinations = o.config.MaxCombinations
	}

	o.logger.Info().
		Int("total_combinations", totalCombinations).
		Int("workers", o.config.Workers).
		Str("metric", o.config.OptimizationMetric).
		Msg("Grid search configuration")

	// Run backtests in parallel
	results := make([]*OptimizationResult, totalCombinations)
	resultsChan := make(chan *OptimizationResult, totalCombinations)
	semaphore := make(chan struct{}, o.config.Workers)

	var wg sync.WaitGroup
	startTime := time.Now()

	for i, params := range combinations {
		wg.Add(1)

		go func(index int, paramSet ParameterSet) {
			defer wg.Done()

			// Acquire semaphore
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			// Run backtest with this parameter set
			result := o.runBacktest(ctx, strategyFactory, paramSet, index, totalCombinations)
			resultsChan <- result
		}(i, params)
	}

	// Close results channel when all goroutines complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	resultIndex := 0
	for result := range resultsChan {
		results[resultIndex] = result
		resultIndex++
	}

	// Sort results by metric value (descending)
	sort.Slice(results, func(i, j int) bool {
		return results[i].MetricValue > results[j].MetricValue
	})

	// Assign ranks
	for i, result := range results {
		result.Rank = i + 1
	}

	elapsed := time.Since(startTime)
	o.logger.Info().
		Int("combinations_tested", totalCombinations).
		Str("duration", elapsed.String()).
		Float64("best_metric", results[0].MetricValue).
		Msg("Optimization complete")

	return results, nil
}

// runBacktest runs a single backtest with given parameters
func (o *Optimizer) runBacktest(
	ctx context.Context,
	strategyFactory StrategyFactory,
	params ParameterSet,
	index int,
	total int,
) *OptimizationResult {
	logger := o.logger.With().
		Int("combination", index+1).
		Int("total", total).
		Logger()

	logger.Debug().
		Interface("params", params).
		Msg("Testing parameter combination")

	// Create event bus for this backtest
	eventBus := events.NewEventBus(1000, logger)

	// Create strategy with these parameters
	strat, err := strategyFactory(params, eventBus, logger)
	if err != nil {
		logger.Error().Err(err).Msg("Failed to create strategy")
		return &OptimizationResult{
			Parameters:  params,
			MetricValue: -999999, // Penalty for failed strategy creation
		}
	}

	// Create backtest engine
	engine := NewEngine(o.config.BacktestConfig, strat, o.dataClient, eventBus, logger)

	// Run backtest
	result, err := engine.Run(ctx)
	if err != nil {
		logger.Error().Err(err).Msg("Backtest failed")
		return &OptimizationResult{
			Parameters:  params,
			MetricValue: -999999, // Penalty for failed backtest
		}
	}

	// Extract metric value
	metricValue := o.extractMetric(result)

	logger.Debug().
		Float64("metric_value", metricValue).
		Int("trades", result.TotalTrades).
		Float64("return_pct", result.TotalReturnPct).
		Msg("Backtest completed")

	return &OptimizationResult{
		Parameters:     params,
		BacktestResult: result,
		MetricValue:    metricValue,
	}
}

// extractMetric extracts the optimization metric from backtest result
func (o *Optimizer) extractMetric(result *BacktestResult) float64 {
	switch o.config.OptimizationMetric {
	case "sharpe_ratio":
		return result.SharpeRatio
	case "sortino_ratio":
		return result.SortinoRatio
	case "total_return":
		return result.TotalReturnPct
	case "profit_factor":
		return result.ProfitFactor
	case "calmar_ratio":
		return result.CalmarRatio
	case "win_rate":
		return result.WinRate
	default:
		o.logger.Warn().
			Str("metric", o.config.OptimizationMetric).
			Msg("Unknown metric, using Sharpe ratio")
		return result.SharpeRatio
	}
}

// generateCombinations generates all parameter combinations (Cartesian product)
func (o *Optimizer) generateCombinations() []ParameterSet {
	if len(o.config.ParameterRanges) == 0 {
		return []ParameterSet{{}}
	}

	// Calculate total combinations
	totalCombos := 1
	for _, paramRange := range o.config.ParameterRanges {
		totalCombos *= len(paramRange.Values)
	}

	combinations := make([]ParameterSet, 0, totalCombos)
	o.generateCombinationsRecursive(0, ParameterSet{}, &combinations)

	return combinations
}

// generateCombinationsRecursive recursively generates parameter combinations
func (o *Optimizer) generateCombinationsRecursive(
	depth int,
	current ParameterSet,
	results *[]ParameterSet,
) {
	if depth == len(o.config.ParameterRanges) {
		// Make a copy of current set
		combo := make(ParameterSet)
		for k, v := range current {
			combo[k] = v
		}
		*results = append(*results, combo)
		return
	}

	paramRange := o.config.ParameterRanges[depth]
	for _, value := range paramRange.Values {
		current[paramRange.Name] = value
		o.generateCombinationsRecursive(depth+1, current, results)
		delete(current, paramRange.Name)
	}
}

// StrategyFactory is a function that creates a strategy with given parameters
type StrategyFactory func(params ParameterSet, eventBus *events.EventBus, logger zerolog.Logger) (strategy.Strategy, error)

// PrintTopResults prints the top N results
func PrintTopResults(results []*OptimizationResult, topN int) string {
	if topN > len(results) {
		topN = len(results)
	}

	output := fmt.Sprintf("\n═══════════════════════════════════════════════════════════════════════════════\n")
	output += fmt.Sprintf("                    OPTIMIZATION RESULTS (Top %d)\n", topN)
	output += fmt.Sprintf("═══════════════════════════════════════════════════════════════════════════════\n\n")

	for i := 0; i < topN; i++ {
		result := results[i]
		output += fmt.Sprintf("Rank #%d\n", result.Rank)
		output += fmt.Sprintf("─────────────────────────────────────────────────────────────────────────────\n")
		output += fmt.Sprintf("Parameters:\n")

		// Sort parameter names for consistent output
		keys := make([]string, 0, len(result.Parameters))
		for k := range result.Parameters {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, key := range keys {
			output += fmt.Sprintf("  %s: %v\n", key, result.Parameters[key])
		}

		output += fmt.Sprintf("\nPerformance:\n")
		output += fmt.Sprintf("  Metric Value:  %.4f\n", result.MetricValue)

		if result.BacktestResult != nil {
			r := result.BacktestResult
			output += fmt.Sprintf("  Total Return:  %.2f%%\n", r.TotalReturnPct)
			output += fmt.Sprintf("  Sharpe Ratio:  %.2f\n", r.SharpeRatio)
			output += fmt.Sprintf("  Max Drawdown:  %.2f%%\n", r.MaxDrawdownPct)
			output += fmt.Sprintf("  Profit Factor: %.2f\n", r.ProfitFactor)
			output += fmt.Sprintf("  Win Rate:      %.1f%%\n", r.WinRate)
			output += fmt.Sprintf("  Total Trades:  %d\n", r.TotalTrades)
		}

		output += fmt.Sprintf("\n")
	}

	return output
}

// GenerateParameterRangeInt creates a parameter range for integer values
func GenerateParameterRangeInt(name string, start, end, step int) ParameterRange {
	values := make([]interface{}, 0)
	for i := start; i <= end; i += step {
		values = append(values, i)
	}
	return ParameterRange{
		Name:   name,
		Values: values,
	}
}

// GenerateParameterRangeFloat creates a parameter range for float values
func GenerateParameterRangeFloat(name string, start, end, step float64) ParameterRange {
	values := make([]interface{}, 0)
	for v := start; v <= end; v += step {
		values = append(values, v)
	}
	return ParameterRange{
		Name:   name,
		Values: values,
	}
}

// GenerateParameterRangeValues creates a parameter range from explicit values
func GenerateParameterRangeValues(name string, values ...interface{}) ParameterRange {
	return ParameterRange{
		Name:   name,
		Values: values,
	}
}
