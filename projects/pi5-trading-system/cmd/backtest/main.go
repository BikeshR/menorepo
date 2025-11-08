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
	symbol := flag.String("symbol", "SPY", "Symbol to backtest")
	strategyName := flag.String("strategy", "rsi_mean_reversion", "Strategy to backtest")
	startDate := flag.String("start", "", "Start date (YYYY-MM-DD)")
	endDate := flag.String("end", "", "End date (YYYY-MM-DD)")
	capital := flag.Float64("capital", 100000, "Initial capital")
	outputDir := flag.String("output", "./backtest_results", "Output directory for reports")
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

	logger := log.With().Str("component", "backtest").Logger()

	logger.Info().Msg("Starting Pi5 Trading System - Backtest Engine")

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
		// Default: 30 days ago
		start = time.Now().AddDate(0, 0, -30)
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

	// Create backtest configuration
	backtestCfg := backtest.DefaultConfig()
	backtestCfg.Symbol = *symbol
	backtestCfg.StartDate = start
	backtestCfg.EndDate = end
	backtestCfg.InitialCapital = *capital
	backtestCfg.OutputDir = *outputDir

	logger.Info().
		Str("symbol", backtestCfg.Symbol).
		Str("strategy", *strategyName).
		Time("start_date", backtestCfg.StartDate).
		Time("end_date", backtestCfg.EndDate).
		Float64("capital", backtestCfg.InitialCapital).
		Msg("Backtest configuration")

	// Create event bus
	eventBus := events.NewEventBus(1000, logger)

	// Create Alpaca client for historical data
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

	alpacaClient, err := marketdata.NewAlpacaClient(mdConfig, eventBus, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to create Alpaca client")
	}

	// Create strategy
	strat, err := createStrategy(*strategyName, []string{*symbol}, cfg, eventBus, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to create strategy")
	}

	// Create backtest engine
	engine := backtest.NewEngine(backtestCfg, strat, alpacaClient, eventBus, logger)

	// Run backtest
	ctx := context.Background()
	result, err := engine.Run(ctx)
	if err != nil {
		logger.Fatal().Err(err).Msg("Backtest failed")
	}

	// Generate and display report
	reportGen := backtest.NewReportGenerator(result)

	// Print console report
	fmt.Println(reportGen.GenerateConsoleReport())

	// Save detailed report to file
	if backtestCfg.GenerateReport {
		if err := reportGen.SaveToFile(backtestCfg.OutputDir); err != nil {
			logger.Error().Err(err).Msg("Failed to save report")
		} else {
			logger.Info().
				Str("directory", backtestCfg.OutputDir).
				Msg("Detailed report saved")
		}
	}

	// Print summary
	logger.Info().
		Float64("return_pct", result.TotalReturnPct).
		Float64("sharpe", result.SharpeRatio).
		Float64("max_dd_pct", result.MaxDrawdownPct).
		Int("trades", result.TotalTrades).
		Float64("win_rate", result.WinRate).
		Msg("Backtest completed successfully")
}

// createStrategy creates a strategy based on name
func createStrategy(
	name string,
	symbols []string,
	cfg *config.Config,
	eventBus *events.EventBus,
	logger zerolog.Logger,
) (strategy.Strategy, error) {
	// Find strategy config
	var stratCfg *config.StrategyConfig
	for _, s := range cfg.Trading.Strategies {
		if s.Name == name {
			stratCfg = &s
			break
		}
	}

	if stratCfg == nil {
		return nil, fmt.Errorf("strategy %s not found in config", name)
	}

	// Create strategy based on type
	switch name {
	case "rsi_mean_reversion":
		rsiPeriod := int(stratCfg.Params["rsi_period"].(float64))
		oversoldThreshold := stratCfg.Params["oversold_threshold"].(float64)
		overboughtThreshold := stratCfg.Params["overbought_threshold"].(float64)

		return strategy.NewRSIMeanReversionStrategy(
			stratCfg.ID,
			symbols,
			rsiPeriod,
			oversoldThreshold,
			overboughtThreshold,
			eventBus,
			logger,
		), nil

	case "bollinger_band_bounce":
		period := int(stratCfg.Params["period"].(float64))
		stdDev := stratCfg.Params["std_dev"].(float64)

		return strategy.NewBollingerBandStrategy(
			stratCfg.ID,
			symbols,
			period,
			stdDev,
			eventBus,
			logger,
		), nil

	case "vwap_bounce":
		bounceTolerance := stratCfg.Params["bounce_tolerance_pct"].(float64)
		targetProfit := stratCfg.Params["target_profit_pct"].(float64)
		emaPeriod := int(stratCfg.Params["ema_period"].(float64))

		return strategy.NewVWAPBounceStrategy(
			stratCfg.ID,
			symbols,
			bounceTolerance,
			targetProfit,
			emaPeriod,
			eventBus,
			logger,
		), nil

	case "opening_range_breakout":
		rangeMinutes := int(stratCfg.Params["range_minutes"].(float64))
		atrPeriod := int(stratCfg.Params["atr_period"].(float64))

		return strategy.NewOpeningRangeBreakoutStrategy(
			stratCfg.ID,
			symbols,
			rangeMinutes,
			atrPeriod,
			eventBus,
			logger,
		), nil

	case "ma_crossover":
		fastPeriod := int(stratCfg.Params["fast_period"].(float64))
		slowPeriod := int(stratCfg.Params["slow_period"].(float64))

		return strategy.NewMovingAverageCrossoverStrategy(
			stratCfg.ID,
			symbols,
			fastPeriod,
			slowPeriod,
			eventBus,
			logger,
		), nil

	default:
		return nil, fmt.Errorf("unknown strategy type: %s", name)
	}
}
