package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/backtest"
	"github.com/bikeshrana/pi5-trading-system-go/internal/config"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/strategy"
	"github.com/bikeshrana/pi5-trading-system-go/internal/marketdata"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Command line flags
	symbol := flag.String("symbol", "SPY", "Symbol to optimize")
	strategyName := flag.String("strategy", "rsi_mean_reversion", "Strategy to optimize")
	mode := flag.String("mode", "grid", "Optimization mode: grid, walkforward, montecarlo")
	startDate := flag.String("start", "", "Start date (YYYY-MM-DD)")
	endDate := flag.String("end", "", "End date (YYYY-MM-DD)")
	capital := flag.Float64("capital", 100000, "Initial capital")
	workers := flag.Int("workers", 4, "Number of parallel workers")
	metric := flag.String("metric", "sharpe_ratio", "Optimization metric (sharpe_ratio, total_return, profit_factor)")
	outputDir := flag.String("output", "./optimization_results", "Output directory")
	verbose := flag.Bool("verbose", false, "Enable verbose logging")
	flag.Parse()

	// Setup logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if *verbose {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})
	}

	logger := log.With().Str("component", "optimize").Logger()

	logger.Info().Msg("Starting Pi5 Trading System - Optimizer")

	// Load configuration
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Parse dates
	var start, end time.Time
	if *startDate != "" {
		start, err = time.Parse("2006-01-02", *startDate)
		if err != nil {
			logger.Fatal().Err(err).Msg("Invalid start date format (use YYYY-MM-DD)")
		}
	} else {
		// Default: 90 days ago
		start = time.Now().AddDate(0, 0, -90)
	}

	if *endDate != "" {
		end, err = time.Parse("2006-01-02", *endDate)
		if err != nil {
			logger.Fatal().Err(err).Msg("Invalid end date format (use YYYY-MM-DD)")
		}
	} else {
		// Default: yesterday
		end = time.Now().AddDate(0, 0, -1)
	}

	// Create base backtest configuration
	backtestCfg := backtest.DefaultConfig()
	backtestCfg.Symbol = *symbol
	backtestCfg.StartDate = start
	backtestCfg.EndDate = end
	backtestCfg.InitialCapital = *capital

	logger.Info().
		Str("symbol", *symbol).
		Str("strategy", *strategyName).
		Str("mode", *mode).
		Time("start_date", start).
		Time("end_date", end).
		Float64("capital", *capital).
		Msg("Optimization configuration")

	// Create Alpaca client
	mdConfig := &marketdata.Config{
		Provider:             "alpaca",
		APIKey:               cfg.MarketData.Alpaca.APIKey,
		APISecret:            cfg.MarketData.Alpaca.APISecret,
		DataURL:              cfg.MarketData.Alpaca.DataURL,
		StreamURL:            cfg.MarketData.Alpaca.StreamURL,
		PaperTrading:         cfg.MarketData.Alpaca.PaperTrading,
		FeedType:             cfg.MarketData.Alpaca.FeedType,
		MaxReconnectAttempts: cfg.MarketData.Reconnection.MaxAttempts,
		ReconnectDelay:       cfg.MarketData.Reconnection.InitialDelay,
		MaxReconnectDelay:    cfg.MarketData.Reconnection.MaxDelay,
	}

	eventBus := events.NewEventBus(1000, logger)
	alpacaClient, err := marketdata.NewAlpacaClient(mdConfig, eventBus, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to create Alpaca client")
	}

	ctx := context.Background()

	// Run optimization based on mode
	switch *mode {
	case "grid":
		runGridSearch(ctx, *strategyName, backtestCfg, alpacaClient, *workers, *metric, *outputDir, logger)

	case "walkforward":
		runWalkForward(ctx, *strategyName, backtestCfg, alpacaClient, *workers, *metric, *outputDir, logger)

	case "montecarlo":
		runMonteCarlo(ctx, *strategyName, backtestCfg, alpacaClient, *outputDir, logger)

	default:
		logger.Fatal().Str("mode", *mode).Msg("Unknown optimization mode")
	}

	logger.Info().Msg("Optimization complete")
}

// runGridSearch runs grid search parameter optimization
func runGridSearch(
	ctx context.Context,
	strategyName string,
	backtestCfg *backtest.Config,
	alpacaClient *marketdata.AlpacaClient,
	workers int,
	metric string,
	outputDir string,
	logger zerolog.Logger,
) {
	logger.Info().Msg("Running grid search optimization")

	// Define parameter ranges based on strategy
	paramRanges := getParameterRanges(strategyName)

	// Create optimization config
	optConfig := &backtest.OptimizationConfig{
		BacktestConfig:     backtestCfg,
		ParameterRanges:    paramRanges,
		OptimizationMetric: metric,
		Workers:            workers,
		MaxCombinations:    0, // Test all combinations
	}

	// Create strategy factory
	strategyFactory := createStrategyFactory(strategyName, backtestCfg.Symbol)

	// Run optimization
	optimizer := backtest.NewOptimizer(optConfig, alpacaClient, logger)
	results, err := optimizer.Optimize(ctx, strategyFactory)
	if err != nil {
		logger.Fatal().Err(err).Msg("Optimization failed")
	}

	// Print top results
	fmt.Println(backtest.PrintTopResults(results, 10))

	// Save detailed results
	os.MkdirAll(outputDir, 0755)
	saveOptimizationResults(results, outputDir, logger)

	logger.Info().
		Int("total_combinations", len(results)).
		Float64("best_metric", results[0].MetricValue).
		Msg("Grid search complete")
}

// runWalkForward runs walk-forward analysis
func runWalkForward(
	ctx context.Context,
	strategyName string,
	backtestCfg *backtest.Config,
	alpacaClient *marketdata.AlpacaClient,
	workers int,
	metric string,
	outputDir string,
	logger zerolog.Logger,
) {
	logger.Info().Msg("Running walk-forward analysis")

	// Define parameter ranges
	paramRanges := getParameterRanges(strategyName)

	// Create walk-forward config
	wfConfig := &backtest.WalkForwardConfig{
		BacktestConfig:      backtestCfg,
		ParameterRanges:     paramRanges,
		OptimizationMetric:  metric,
		InSampleDays:        30, // Optimize on 30 days
		OutOfSampleDays:     10, // Test on 10 days
		StepDays:            10, // Roll forward 10 days
		Anchored:            false,
		Workers:             workers,
	}

	// Create strategy factory
	strategyFactory := createStrategyFactory(strategyName, backtestCfg.Symbol)

	// Run analysis
	analyzer := backtest.NewWalkForwardAnalyzer(wfConfig, alpacaClient, logger)
	result, err := analyzer.Analyze(ctx, strategyFactory)
	if err != nil {
		logger.Fatal().Err(err).Msg("Walk-forward analysis failed")
	}

	// Print results
	fmt.Println(backtest.PrintWalkForwardResults(result))

	logger.Info().
		Int("periods", result.TotalPeriods).
		Float64("avg_oos_metric", result.AvgOutOfSampleMetric).
		Msg("Walk-forward complete")
}

// runMonteCarlo runs Monte Carlo simulation
func runMonteCarlo(
	ctx context.Context,
	strategyName string,
	backtestCfg *backtest.Config,
	alpacaClient *marketdata.AlpacaClient,
	outputDir string,
	logger zerolog.Logger,
) {
	logger.Info().Msg("Running Monte Carlo simulation")

	// First, run a standard backtest
	eventBus := events.NewEventBus(1000, logger)
	strat, err := createStrategyForBacktest(strategyName, backtestCfg.Symbol, eventBus, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to create strategy")
	}

	engine := backtest.NewEngine(backtestCfg, strat, alpacaClient, eventBus, logger)
	backtestResult, err := engine.Run(ctx)
	if err != nil {
		logger.Fatal().Err(err).Msg("Backtest failed")
	}

	// Run Monte Carlo simulation
	mcConfig := &backtest.MonteCarloConfig{
		Simulations:     1000,
		Seed:            0,
		ConfidenceLevel: 0.95,
	}

	simulator := backtest.NewMonteCarloSimulator(mcConfig)
	result := simulator.Simulate(backtestResult)

	// Print results
	fmt.Println(backtest.PrintMonteCarloResults(result))

	// Export visualization data
	os.MkdirAll(outputDir, 0755)
	if err := backtest.ExportAllVisualizationData(backtestResult, outputDir); err != nil {
		logger.Error().Err(err).Msg("Failed to export visualization data")
	} else {
		logger.Info().Str("directory", outputDir).Msg("Visualization data exported")
	}

	// Generate Python plot script
	if err := backtest.GeneratePythonPlotScript(outputDir); err != nil {
		logger.Error().Err(err).Msg("Failed to generate plot script")
	} else {
		logger.Info().Msg("Python plot script generated (plot_backtest.py)")
	}

	logger.Info().
		Int("simulations", result.Config.Simulations).
		Float64("probability_of_profit", result.ProbabilityOfProfit).
		Msg("Monte Carlo complete")
}

// getParameterRanges returns parameter ranges for a given strategy
func getParameterRanges(strategyName string) []backtest.ParameterRange {
	switch strategyName {
	case "rsi_mean_reversion":
		return []backtest.ParameterRange{
			backtest.GenerateParameterRangeInt("rsi_period", 10, 20, 2),
			backtest.GenerateParameterRangeFloat("oversold_threshold", 25, 35, 5),
			backtest.GenerateParameterRangeFloat("overbought_threshold", 65, 75, 5),
		}

	case "bollinger_band_bounce":
		return []backtest.ParameterRange{
			backtest.GenerateParameterRangeInt("period", 15, 25, 5),
			backtest.GenerateParameterRangeFloat("std_dev", 1.5, 2.5, 0.5),
		}

	case "vwap_bounce":
		return []backtest.ParameterRange{
			backtest.GenerateParameterRangeFloat("bounce_tolerance_pct", 0.001, 0.005, 0.001),
			backtest.GenerateParameterRangeFloat("target_profit_pct", 0.005, 0.015, 0.005),
			backtest.GenerateParameterRangeInt("ema_period", 15, 25, 5),
		}

	case "opening_range_breakout":
		return []backtest.ParameterRange{
			backtest.GenerateParameterRangeInt("range_minutes", 10, 30, 10),
			backtest.GenerateParameterRangeInt("atr_period", 10, 20, 5),
		}

	default:
		return []backtest.ParameterRange{}
	}
}

// createStrategyFactory creates a strategy factory function
func createStrategyFactory(strategyName, symbol string) backtest.StrategyFactory {
	return func(params backtest.ParameterSet, eventBus *events.EventBus, logger zerolog.Logger) (strategy.Strategy, error) {
		symbols := []string{symbol}

		switch strategyName {
		case "rsi_mean_reversion":
			return strategy.NewRSIMeanReversionStrategy(
				"optimize-"+strategyName,
				symbols,
				params["rsi_period"].(int),
				params["oversold_threshold"].(float64),
				params["overbought_threshold"].(float64),
				eventBus,
				logger,
			), nil

		case "bollinger_band_bounce":
			return strategy.NewBollingerBandStrategy(
				"optimize-"+strategyName,
				symbols,
				params["period"].(int),
				params["std_dev"].(float64),
				eventBus,
				logger,
			), nil

		case "vwap_bounce":
			return strategy.NewVWAPBounceStrategy(
				"optimize-"+strategyName,
				symbols,
				params["bounce_tolerance_pct"].(float64),
				params["target_profit_pct"].(float64),
				params["ema_period"].(int),
				eventBus,
				logger,
			), nil

		case "opening_range_breakout":
			return strategy.NewOpeningRangeBreakoutStrategy(
				"optimize-"+strategyName,
				symbols,
				params["range_minutes"].(int),
				params["atr_period"].(int),
				eventBus,
				logger,
			), nil

		default:
			return nil, fmt.Errorf("unknown strategy: %s", strategyName)
		}
	}
}

// createStrategyForBacktest creates a strategy with default parameters
func createStrategyForBacktest(strategyName, symbol string, eventBus *events.EventBus, logger zerolog.Logger) (strategy.Strategy, error) {
	symbols := []string{symbol}

	switch strategyName {
	case "rsi_mean_reversion":
		return strategy.NewRSIMeanReversionStrategy(
			"backtest-"+strategyName,
			symbols,
			14, 30, 70,
			eventBus,
			logger,
		), nil

	case "bollinger_band_bounce":
		return strategy.NewBollingerBandStrategy(
			"backtest-"+strategyName,
			symbols,
			20, 2.0,
			eventBus,
			logger,
		), nil

	case "vwap_bounce":
		return strategy.NewVWAPBounceStrategy(
			"backtest-"+strategyName,
			symbols,
			0.002, 0.01, 20,
			eventBus,
			logger,
		), nil

	case "opening_range_breakout":
		return strategy.NewOpeningRangeBreakoutStrategy(
			"backtest-"+strategyName,
			symbols,
			15, 14,
			eventBus,
			logger,
		), nil

	default:
		return nil, fmt.Errorf("unknown strategy: %s", strategyName)
	}
}

// saveOptimizationResults saves optimization results to file
func saveOptimizationResults(results []*backtest.OptimizationResult, outputDir string, logger zerolog.Logger) {
	// Save top 20 results to file
	filename := fmt.Sprintf("%s/optimization_results_%s.txt",
		outputDir,
		time.Now().Format("20060102_150405"))

	content := backtest.PrintTopResults(results, 20)
	if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
		logger.Error().Err(err).Msg("Failed to save results")
	} else {
		logger.Info().Str("file", filename).Msg("Results saved")
	}
}
