package backtest

import (
	"context"
	"fmt"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/marketdata"
	"github.com/rs/zerolog"
)

// WalkForwardConfig holds configuration for walk-forward analysis
type WalkForwardConfig struct {
	// Base backtest config
	BacktestConfig *Config

	// Parameter ranges for optimization
	ParameterRanges []ParameterRange

	// Optimization metric
	OptimizationMetric string

	// In-sample period (days to optimize on)
	InSampleDays int

	// Out-of-sample period (days to test on)
	OutOfSampleDays int

	// Step size (days to move window forward)
	StepDays int

	// Anchored mode: if true, always start from beginning
	// if false, use rolling window
	Anchored bool

	// Number of parallel workers for optimization
	Workers int
}

// WalkForwardPeriod represents one walk-forward period
type WalkForwardPeriod struct {
	PeriodNumber int

	// In-sample (optimization) period
	InSampleStart time.Time
	InSampleEnd   time.Time

	// Out-of-sample (testing) period
	OutOfSampleStart time.Time
	OutOfSampleEnd   time.Time

	// Best parameters found in in-sample
	BestParameters ParameterSet

	// In-sample optimization result
	InSampleResult *BacktestResult

	// Out-of-sample test result
	OutOfSampleResult *BacktestResult

	// Performance metrics
	InSampleMetric  float64
	OutOfSampleMetric float64
	PerformanceRatio float64 // out-of-sample / in-sample
}

// WalkForwardResult holds results of walk-forward analysis
type WalkForwardResult struct {
	Config  *WalkForwardConfig
	Periods []WalkForwardPeriod

	// Aggregate statistics
	TotalPeriods           int
	AvgInSampleMetric      float64
	AvgOutOfSampleMetric   float64
	AvgPerformanceRatio    float64
	PeriodsWithPositiveOOS int // Out-of-sample periods with positive returns

	// Combined out-of-sample results
	CombinedOOSReturn    float64
	CombinedOOSTrades    int
	CombinedOOSWinRate   float64
	CombinedOOSSharpe    float64
	CombinedOOSMaxDD     float64

	// Execution time
	TotalDuration time.Duration
}

// WalkForwardAnalyzer performs walk-forward analysis
type WalkForwardAnalyzer struct {
	config     *WalkForwardConfig
	dataClient *marketdata.AlpacaClient
	logger     zerolog.Logger
}

// NewWalkForwardAnalyzer creates a new walk-forward analyzer
func NewWalkForwardAnalyzer(
	config *WalkForwardConfig,
	dataClient *marketdata.AlpacaClient,
	logger zerolog.Logger,
) *WalkForwardAnalyzer {
	return &WalkForwardAnalyzer{
		config:     config,
		dataClient: dataClient,
		logger:     logger,
	}
}

// Analyze runs walk-forward analysis
func (wfa *WalkForwardAnalyzer) Analyze(
	ctx context.Context,
	strategyFactory StrategyFactory,
) (*WalkForwardResult, error) {
	startTime := time.Now()

	wfa.logger.Info().Msg("Starting walk-forward analysis")

	// Generate walk-forward periods
	periods := wfa.generatePeriods()

	wfa.logger.Info().
		Int("total_periods", len(periods)).
		Int("in_sample_days", wfa.config.InSampleDays).
		Int("out_of_sample_days", wfa.config.OutOfSampleDays).
		Bool("anchored", wfa.config.Anchored).
		Msg("Walk-forward configuration")

	results := make([]WalkForwardPeriod, len(periods))

	// Run each period sequentially
	for i, period := range periods {
		wfa.logger.Info().
			Int("period", period.PeriodNumber).
			Int("total", len(periods)).
			Time("in_sample_start", period.InSampleStart).
			Time("out_sample_end", period.OutOfSampleEnd).
			Msg("Processing walk-forward period")

		result, err := wfa.runPeriod(ctx, strategyFactory, period)
		if err != nil {
			wfa.logger.Error().
				Err(err).
				Int("period", period.PeriodNumber).
				Msg("Period failed")
			// Continue with other periods
			continue
		}

		results[i] = *result

		wfa.logger.Info().
			Int("period", period.PeriodNumber).
			Float64("in_sample_metric", result.InSampleMetric).
			Float64("out_sample_metric", result.OutOfSampleMetric).
			Float64("ratio", result.PerformanceRatio).
			Msg("Period completed")
	}

	// Calculate aggregate statistics
	finalResult := wfa.calculateAggregateStats(results, time.Since(startTime))

	wfa.logger.Info().
		Int("periods", finalResult.TotalPeriods).
		Float64("avg_oos_metric", finalResult.AvgOutOfSampleMetric).
		Float64("avg_ratio", finalResult.AvgPerformanceRatio).
		Float64("combined_return", finalResult.CombinedOOSReturn).
		Msg("Walk-forward analysis complete")

	return finalResult, nil
}

// generatePeriods generates walk-forward periods
func (wfa *WalkForwardAnalyzer) generatePeriods() []WalkForwardPeriod {
	periods := make([]WalkForwardPeriod, 0)

	startDate := wfa.config.BacktestConfig.StartDate
	endDate := wfa.config.BacktestConfig.EndDate

	periodNumber := 1
	currentStart := startDate

	for {
		// Calculate in-sample period
		inSampleStart := currentStart
		inSampleEnd := inSampleStart.AddDate(0, 0, wfa.config.InSampleDays)

		// Calculate out-of-sample period
		outOfSampleStart := inSampleEnd
		outOfSampleEnd := outOfSampleStart.AddDate(0, 0, wfa.config.OutOfSampleDays)

		// Check if we've reached the end
		if outOfSampleEnd.After(endDate) {
			break
		}

		period := WalkForwardPeriod{
			PeriodNumber:     periodNumber,
			InSampleStart:    inSampleStart,
			InSampleEnd:      inSampleEnd,
			OutOfSampleStart: outOfSampleStart,
			OutOfSampleEnd:   outOfSampleEnd,
		}

		periods = append(periods, period)
		periodNumber++

		// Move window forward
		if wfa.config.Anchored {
			// Anchored: keep same start, move end forward
			currentStart = startDate
		} else {
			// Rolling: move both start and end forward
			currentStart = currentStart.AddDate(0, 0, wfa.config.StepDays)
		}
	}

	return periods
}

// runPeriod runs optimization and testing for one walk-forward period
func (wfa *WalkForwardAnalyzer) runPeriod(
	ctx context.Context,
	strategyFactory StrategyFactory,
	period WalkForwardPeriod,
) (*WalkForwardPeriod, error) {
	// Step 1: Optimize on in-sample period
	inSampleConfig := &Config{
		Symbol:         wfa.config.BacktestConfig.Symbol,
		StartDate:      period.InSampleStart,
		EndDate:        period.InSampleEnd,
		InitialCapital: wfa.config.BacktestConfig.InitialCapital,
		Commission:     wfa.config.BacktestConfig.Commission,
		CommissionPct:  wfa.config.BacktestConfig.CommissionPct,
		Slippage:       wfa.config.BacktestConfig.Slippage,
		SlippageModel:  wfa.config.BacktestConfig.SlippageModel,
		Timeframe:      wfa.config.BacktestConfig.Timeframe,
	}

	optimizerConfig := &OptimizationConfig{
		BacktestConfig:     inSampleConfig,
		ParameterRanges:    wfa.config.ParameterRanges,
		OptimizationMetric: wfa.config.OptimizationMetric,
		Workers:            wfa.config.Workers,
	}

	optimizer := NewOptimizer(optimizerConfig, wfa.dataClient, wfa.logger)
	optimResults, err := optimizer.Optimize(ctx, strategyFactory)
	if err != nil {
		return nil, fmt.Errorf("in-sample optimization failed: %w", err)
	}

	if len(optimResults) == 0 {
		return nil, fmt.Errorf("no optimization results")
	}

	// Get best parameters
	best := optimResults[0]
	period.BestParameters = best.Parameters
	period.InSampleResult = best.BacktestResult
	period.InSampleMetric = best.MetricValue

	wfa.logger.Info().
		Int("period", period.PeriodNumber).
		Interface("best_params", best.Parameters).
		Float64("in_sample_metric", best.MetricValue).
		Msg("In-sample optimization complete")

	// Step 2: Test on out-of-sample period
	outOfSampleConfig := &Config{
		Symbol:         wfa.config.BacktestConfig.Symbol,
		StartDate:      period.OutOfSampleStart,
		EndDate:        period.OutOfSampleEnd,
		InitialCapital: wfa.config.BacktestConfig.InitialCapital,
		Commission:     wfa.config.BacktestConfig.Commission,
		CommissionPct:  wfa.config.BacktestConfig.CommissionPct,
		Slippage:       wfa.config.BacktestConfig.Slippage,
		SlippageModel:  wfa.config.BacktestConfig.SlippageModel,
		Timeframe:      wfa.config.BacktestConfig.Timeframe,
	}

	// Create strategy with best parameters
	eventBus := events.NewEventBus(1000, wfa.logger)
	strat, err := strategyFactory(best.Parameters, eventBus, wfa.logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create strategy for OOS test: %w", err)
	}

	// Run out-of-sample test
	engine := NewEngine(outOfSampleConfig, strat, wfa.dataClient, eventBus, wfa.logger)
	oosResult, err := engine.Run(ctx)
	if err != nil {
		return nil, fmt.Errorf("out-of-sample test failed: %w", err)
	}

	period.OutOfSampleResult = oosResult
	period.OutOfSampleMetric = wfa.extractMetric(oosResult)

	// Calculate performance ratio
	if period.InSampleMetric != 0 {
		period.PerformanceRatio = period.OutOfSampleMetric / period.InSampleMetric
	}

	return &period, nil
}

// extractMetric extracts the specified metric from backtest result
func (wfa *WalkForwardAnalyzer) extractMetric(result *BacktestResult) float64 {
	switch wfa.config.OptimizationMetric {
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
	default:
		return result.SharpeRatio
	}
}

// calculateAggregateStats calculates aggregate statistics
func (wfa *WalkForwardAnalyzer) calculateAggregateStats(
	periods []WalkForwardPeriod,
	duration time.Duration,
) *WalkForwardResult {
	result := &WalkForwardResult{
		Config:        wfa.config,
		Periods:       periods,
		TotalPeriods:  len(periods),
		TotalDuration: duration,
	}

	if len(periods) == 0 {
		return result
	}

	var sumISMetric, sumOOSMetric, sumRatio float64
	var totalReturn float64
	var totalTrades, totalWins int
	var maxDD float64
	var periodsWithPositiveOOS int

	for _, period := range periods {
		sumISMetric += period.InSampleMetric
		sumOOSMetric += period.OutOfSampleMetric
		sumRatio += period.PerformanceRatio

		if period.OutOfSampleResult != nil {
			totalReturn += period.OutOfSampleResult.TotalReturnPct
			totalTrades += period.OutOfSampleResult.TotalTrades
			totalWins += period.OutOfSampleResult.WinningTrades

			if period.OutOfSampleResult.MaxDrawdownPct > maxDD {
				maxDD = period.OutOfSampleResult.MaxDrawdownPct
			}

			if period.OutOfSampleResult.TotalReturnPct > 0 {
				periodsWithPositiveOOS++
			}
		}
	}

	n := float64(len(periods))
	result.AvgInSampleMetric = sumISMetric / n
	result.AvgOutOfSampleMetric = sumOOSMetric / n
	result.AvgPerformanceRatio = sumRatio / n
	result.PeriodsWithPositiveOOS = periodsWithPositiveOOS

	result.CombinedOOSReturn = totalReturn
	result.CombinedOOSTrades = totalTrades
	if totalTrades > 0 {
		result.CombinedOOSWinRate = (float64(totalWins) / float64(totalTrades)) * 100
	}
	result.CombinedOOSMaxDD = maxDD

	// Calculate average Sharpe ratio across all OOS periods
	var sumSharpe float64
	validPeriods := 0
	for _, period := range periods {
		if period.OutOfSampleResult != nil {
			sumSharpe += period.OutOfSampleResult.SharpeRatio
			validPeriods++
		}
	}
	if validPeriods > 0 {
		result.CombinedOOSSharpe = sumSharpe / float64(validPeriods)
	}

	return result
}

// PrintWalkForwardResults formats walk-forward results for display
func PrintWalkForwardResults(result *WalkForwardResult) string {
	output := "\n"
	output += "═══════════════════════════════════════════════════════════════════════════════\n"
	output += "                      WALK-FORWARD ANALYSIS RESULTS\n"
	output += "═══════════════════════════════════════════════════════════════════════════════\n\n"

	output += "CONFIGURATION\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Total Periods:        %d\n", result.TotalPeriods)
	output += fmt.Sprintf("In-Sample Days:       %d\n", result.Config.InSampleDays)
	output += fmt.Sprintf("Out-of-Sample Days:   %d\n", result.Config.OutOfSampleDays)
	output += fmt.Sprintf("Step Days:            %d\n", result.Config.StepDays)
	output += fmt.Sprintf("Anchored:             %t\n", result.Config.Anchored)
	output += fmt.Sprintf("Optimization Metric:  %s\n", result.Config.OptimizationMetric)
	output += "\n"

	output += "AGGREGATE RESULTS\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Avg In-Sample Metric:     %.4f\n", result.AvgInSampleMetric)
	output += fmt.Sprintf("Avg Out-of-Sample Metric: %.4f\n", result.AvgOutOfSampleMetric)
	output += fmt.Sprintf("Avg Performance Ratio:    %.4f (OOS/IS)\n", result.AvgPerformanceRatio)
	output += fmt.Sprintf("Periods with Positive OOS: %d / %d (%.1f%%)\n",
		result.PeriodsWithPositiveOOS,
		result.TotalPeriods,
		float64(result.PeriodsWithPositiveOOS)/float64(result.TotalPeriods)*100)
	output += "\n"

	output += "COMBINED OUT-OF-SAMPLE PERFORMANCE\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("Total Return:         %.2f%%\n", result.CombinedOOSReturn)
	output += fmt.Sprintf("Avg Sharpe Ratio:     %.2f\n", result.CombinedOOSSharpe)
	output += fmt.Sprintf("Max Drawdown:         %.2f%%\n", result.CombinedOOSMaxDD)
	output += fmt.Sprintf("Total Trades:         %d\n", result.CombinedOOSTrades)
	output += fmt.Sprintf("Win Rate:             %.1f%%\n", result.CombinedOOSWinRate)
	output += "\n"

	output += "PERIOD DETAILS\n"
	output += "─────────────────────────────────────────────────────────────────────────────\n"
	output += fmt.Sprintf("%-6s %-12s %-12s %-12s %-12s %-8s\n",
		"Period", "IS Start", "IS End", "OOS Start", "OOS End", "Ratio")
	output += "─────────────────────────────────────────────────────────────────────────────\n"

	for _, period := range result.Periods {
		output += fmt.Sprintf("%-6d %-12s %-12s %-12s %-12s %.4f\n",
			period.PeriodNumber,
			period.InSampleStart.Format("2006-01-02"),
			period.InSampleEnd.Format("2006-01-02"),
			period.OutOfSampleStart.Format("2006-01-02"),
			period.OutOfSampleEnd.Format("2006-01-02"),
			period.PerformanceRatio)
	}

	output += "\n"
	output += fmt.Sprintf("Analysis completed in %s\n", result.TotalDuration.String())
	output += "═══════════════════════════════════════════════════════════════════════════════\n"

	return output
}
