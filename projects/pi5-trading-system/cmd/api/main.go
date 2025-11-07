package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/api"
	"github.com/bikeshrana/pi5-trading-system-go/internal/audit"
	"github.com/bikeshrana/pi5-trading-system-go/internal/circuitbreaker"
	"github.com/bikeshrana/pi5-trading-system-go/internal/config"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/execution"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/risk"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/signal"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/strategy"
	"github.com/bikeshrana/pi5-trading-system-go/internal/data"
	"github.com/bikeshrana/pi5-trading-system-go/internal/data/timescale"
	"github.com/bikeshrana/pi5-trading-system-go/internal/metrics"
)

func main() {
	// Exit code
	var exitCode int
	defer func() {
		os.Exit(exitCode)
	}()

	// Run the application
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		exitCode = 1
	}
}

func run() error {
	// Load configuration
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Setup logger
	logger := setupLogger(cfg.Logging)
	logger.Info().Msg("Pi5 Trading System - Go Implementation")
	logger.Info().Str("version", "1.0.0").Msg("Starting application")

	// Create context that listens for termination signals
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Create event bus (the heart of the system!)
	eventBus := events.NewEventBus(cfg.Trading.EventBusBuffer, logger)
	defer eventBus.Close()

	logger.Info().
		Int("buffer_size", cfg.Trading.EventBusBuffer).
		Msg("Event bus created")

	// Connect to TimescaleDB
	db, err := timescale.NewClient(ctx, &cfg.Database, logger)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer db.Close()

	logger.Info().Msg("Database connected")

	// Initialize repositories for execution engine
	ordersRepo := data.NewOrdersRepository(db.GetPool(), logger)
	portfolioRepo := data.NewPortfolioRepository(db.GetPool(), logger)

	// Initialize audit logger
	auditLogger := audit.NewAuditLogger(db.GetPool(), logger)
	if err := auditLogger.InitSchema(ctx); err != nil {
		return fmt.Errorf("failed to initialize audit schema: %w", err)
	}
	logger.Info().Msg("Audit logger initialized")

	// Initialize risk manager with default limits
	riskLimits := risk.GetDefaultLimits()
	riskManager := risk.NewRiskManager(riskLimits, portfolioRepo, ordersRepo, logger)

	logger.Info().
		Int("max_position_size", riskLimits.MaxPositionSize).
		Float64("max_daily_loss", riskLimits.MaxDailyLoss).
		Float64("max_concentration", riskLimits.MaxConcentration).
		Msg("Risk manager initialized")

	// Initialize circuit breaker manager
	cbManager := circuitbreaker.NewManager(logger)
	logger.Info().Msg("Circuit breaker manager initialized")

	// Initialize Prometheus metrics
	tradingMetrics := metrics.NewTradingMetrics("pi5_trading")
	logger.Info().Msg("Prometheus metrics initialized")

	// Initialize execution engine
	executionEngine := execution.NewExecutionEngine(
		eventBus,
		ordersRepo,
		portfolioRepo,
		riskManager,
		auditLogger,
		cbManager,
		tradingMetrics,
		cfg.Trading.DemoMode,
		cfg.Trading.PaperTrading,
		logger,
	)

	// Start execution engine
	if err := executionEngine.Start(ctx); err != nil {
		return fmt.Errorf("failed to start execution engine: %w", err)
	}

	logger.Info().
		Bool("demo_mode", cfg.Trading.DemoMode).
		Bool("paper_trading", cfg.Trading.PaperTrading).
		Msg("Execution engine started")

	// Initialize signal-to-order converter for autonomous trading
	signalConverter := signal.NewSignalToOrderConverter(
		eventBus,
		riskManager,
		auditLogger,
		signal.Config{
			Enabled:       true,  // Enable autonomous trading
			MinConfidence: 0.6,   // Only trade signals with >= 60% confidence
		},
		logger,
	)

	// Start signal converter
	if err := signalConverter.Start(ctx); err != nil {
		return fmt.Errorf("failed to start signal converter: %w", err)
	}

	logger.Info().
		Bool("enabled", true).
		Float64("min_confidence", 0.6).
		Msg("Signal-to-order converter started")

	// Initialize strategies
	strategies := make([]strategy.Strategy, 0)

	for _, stratCfg := range cfg.Trading.Strategies {
		if !stratCfg.Enabled {
			logger.Info().
				Str("strategy_id", stratCfg.ID).
				Msg("Strategy disabled, skipping")
			continue
		}

		var strat strategy.Strategy

		// Create strategy based on ID
		switch stratCfg.ID {
		case "moving_avg_crossover":
			shortPeriod := int(stratCfg.Params["short_period"].(float64))
			longPeriod := int(stratCfg.Params["long_period"].(float64))

			strat = strategy.NewMovingAverageCrossoverStrategy(
				stratCfg.ID,
				stratCfg.Symbols,
				shortPeriod,
				longPeriod,
				eventBus,
				logger,
			)

		default:
			logger.Warn().
				Str("strategy_id", stratCfg.ID).
				Msg("Unknown strategy type, skipping")
			continue
		}

		// Initialize strategy
		if err := strat.Initialize(ctx); err != nil {
			logger.Error().
				Err(err).
				Str("strategy_id", stratCfg.ID).
				Msg("Failed to initialize strategy")
			continue
		}

		// Start strategy
		if err := strat.Start(ctx); err != nil {
			logger.Error().
				Err(err).
				Str("strategy_id", stratCfg.ID).
				Msg("Failed to start strategy")
			continue
		}

		strategies = append(strategies, strat)

		logger.Info().
			Str("strategy_id", stratCfg.ID).
			Str("strategy_name", stratCfg.Name).
			Strs("symbols", stratCfg.Symbols).
			Msg("Strategy started")
	}

	// Create HTTP server with database, auth config, audit logger, event bus, and circuit breaker manager
	server := api.NewServer(&cfg.Server, &cfg.Auth, db, eventBus, auditLogger, cbManager, logger)

	// Start HTTP server in a goroutine
	serverErrChan := make(chan error, 1)
	go func() {
		logger.Info().
			Str("addr", fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)).
			Msg("Starting HTTP server")

		if err := server.Start(); err != nil {
			serverErrChan <- err
		}
	}()

	// Demo: Simulate market data events
	// TODO (Phase 3): Replace with real market data provider integration
	// Options to consider:
	//   - Alpaca Markets API (free tier available)
	//   - Interactive Brokers TWS API
	//   - TD Ameritrade API
	//   - Polygon.io (real-time + historical data)
	//   - Yahoo Finance (webscraping, rate limits)
	// Implementation requirements:
	//   - WebSocket connection for real-time data
	//   - Reconnection logic with exponential backoff
	//   - Rate limiting to avoid API throttling
	//   - Data validation and sanitization
	//   - Historical data backfill on startup
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		symbols := []string{"AAPL", "MSFT", "GOOGL"}
		basePrice := map[string]float64{
			"AAPL":  150.0,
			"MSFT":  350.0,
			"GOOGL": 140.0,
		}

		for {
			select {
			case <-ticker.C:
				// Publish market data events for each symbol
				for _, symbol := range symbols {
					price := basePrice[symbol] + (float64(time.Now().Unix()%10) - 5)
					event := events.NewMarketDataEvent(
						symbol,
						price-0.5,
						price+1.0,
						price-1.0,
						price,
						1000000,
						time.Now(),
					)

					eventBus.Publish(ctx, event)

					logger.Debug().
						Str("symbol", symbol).
						Float64("price", price).
						Msg("Published market data event")
				}

			case <-ctx.Done():
				return
			}
		}
	}()

	// Wait for termination signal or server error
	select {
	case sig := <-sigChan:
		logger.Info().
			Str("signal", sig.String()).
			Msg("Received shutdown signal")

	case err := <-serverErrChan:
		logger.Error().
			Err(err).
			Msg("Server error")
		return err
	}

	// Graceful shutdown
	logger.Info().Msg("Shutting down...")

	// Create shutdown context with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// Stop execution engine
	if err := executionEngine.Stop(shutdownCtx); err != nil {
		logger.Error().
			Err(err).
			Msg("Error stopping execution engine")
	}

	// Stop strategies
	for _, strat := range strategies {
		if err := strat.Stop(shutdownCtx); err != nil {
			logger.Error().
				Err(err).
				Str("strategy_id", strat.ID()).
				Msg("Error stopping strategy")
		}
	}

	// Shutdown HTTP server
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error().
			Err(err).
			Msg("Error shutting down server")
	}

	// Print event bus metrics
	metrics := eventBus.GetMetrics()
	for eventType, metric := range metrics {
		logger.Info().
			Str("event_type", string(eventType)).
			Int64("published", metric.PublishedCount).
			Int64("dropped", metric.DroppedCount).
			Msg("Event bus metrics")
	}

	// Print execution engine metrics
	execMetrics := executionEngine.GetMetrics()
	logger.Info().
		Int64("total_executions", execMetrics["total_executions"].(int64)).
		Int64("total_rejections", execMetrics["total_rejections"].(int64)).
		Float64("total_volume", execMetrics["total_volume"].(float64)).
		Int("pending_orders", execMetrics["pending_orders"].(int)).
		Msg("Execution engine metrics")

	logger.Info().Msg("Shutdown complete")
	return nil
}

// setupLogger creates and configures the logger
func setupLogger(cfg config.LoggingConfig) zerolog.Logger {
	// Set log level
	level, err := zerolog.ParseLevel(cfg.Level)
	if err != nil {
		level = zerolog.InfoLevel
	}

	zerolog.SetGlobalLevel(level)

	// Configure output format
	var logger zerolog.Logger
	if cfg.Format == "console" {
		// Pretty console output for development
		logger = zerolog.New(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: cfg.TimeFormat,
		}).With().Timestamp().Logger()
	} else {
		// JSON output for production
		logger = zerolog.New(os.Stdout).With().Timestamp().Logger()
	}

	return logger
}
