package backtest

import (
	"context"
	"fmt"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/strategy"
	"github.com/bikeshrana/pi5-trading-system-go/internal/marketdata"
	"github.com/bikeshrana/pi5-trading-system-go/pkg/types"
	"github.com/rs/zerolog"
)

// Engine is the main backtesting engine
type Engine struct {
	config     *Config
	logger     zerolog.Logger
	eventBus   *events.EventBus
	dataClient *marketdata.AlpacaClient
	executor   *SimulatedExecutor
	strategy   strategy.Strategy
}

// NewEngine creates a new backtesting engine
func NewEngine(
	config *Config,
	strategy strategy.Strategy,
	dataClient *marketdata.AlpacaClient,
	eventBus *events.EventBus,
	logger zerolog.Logger,
) *Engine {
	executor := NewSimulatedExecutor(config, logger)

	return &Engine{
		config:     config,
		logger:     logger,
		eventBus:   eventBus,
		dataClient: dataClient,
		executor:   executor,
		strategy:   strategy,
	}
}

// Run executes the backtest
func (e *Engine) Run(ctx context.Context) (*BacktestResult, error) {
	startTime := time.Now()

	e.logger.Info().
		Str("symbol", e.config.Symbol).
		Time("start_date", e.config.StartDate).
		Time("end_date", e.config.EndDate).
		Float64("initial_capital", e.config.InitialCapital).
		Msg("Starting backtest")

	// Validate configuration
	if err := e.config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	// Load historical data
	bars, err := e.loadHistoricalData(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load historical data: %w", err)
	}

	if len(bars) == 0 {
		return nil, ErrNoData
	}

	e.logger.Info().
		Int("bars", len(bars)).
		Msg("Historical data loaded")

	// Initialize strategy
	if err := e.strategy.Initialize(ctx); err != nil {
		return nil, fmt.Errorf("failed to initialize strategy: %w", err)
	}

	// Start strategy
	if err := e.strategy.Start(ctx); err != nil {
		return nil, fmt.Errorf("failed to start strategy: %w", err)
	}

	// Subscribe to signal events from strategy
	signalCh := e.eventBus.Subscribe(events.EventTypeSignal)

	// Replay historical data
	if err := e.replayBars(ctx, bars, signalCh); err != nil {
		return nil, fmt.Errorf("failed to replay bars: %w", err)
	}

	// Stop strategy
	if err := e.strategy.Stop(ctx); err != nil {
		e.logger.Warn().Err(err).Msg("Error stopping strategy")
	}

	// Force close any open positions
	if len(bars) > 0 {
		lastBar := bars[len(bars)-1]
		if err := e.executor.ForceClosePosition(lastBar.Close, lastBar.Timestamp); err != nil {
			e.logger.Warn().Err(err).Msg("Error force closing position")
		}
	}

	// Calculate metrics and generate report
	result := e.generateResult(startTime)

	e.logger.Info().
		Float64("final_capital", result.FinalCapital).
		Float64("total_return", result.TotalReturn).
		Float64("total_return_pct", result.TotalReturnPct).
		Int("total_trades", result.TotalTrades).
		Float64("win_rate", result.WinRate).
		Float64("sharpe_ratio", result.SharpeRatio).
		Float64("max_drawdown_pct", result.MaxDrawdownPct).
		Msg("Backtest completed")

	return result, nil
}

// loadHistoricalData fetches historical bars from data provider
func (e *Engine) loadHistoricalData(ctx context.Context) ([]types.Bar, error) {
	e.logger.Info().
		Str("symbol", e.config.Symbol).
		Str("timeframe", e.config.Timeframe).
		Time("start", e.config.StartDate).
		Time("end", e.config.EndDate).
		Msg("Loading historical data")

	bars, err := e.dataClient.GetHistoricalBars(
		ctx,
		e.config.Symbol,
		e.config.Timeframe,
		e.config.StartDate,
		e.config.EndDate,
	)

	if err != nil {
		return nil, err
	}

	if len(bars) == 0 {
		return nil, fmt.Errorf("no data returned for %s", e.config.Symbol)
	}

	return bars, nil
}

// replayBars replays historical bars through the strategy
func (e *Engine) replayBars(ctx context.Context, bars []types.Bar, signalCh <-chan events.Event) error {
	totalBars := len(bars)
	progressInterval := totalBars / 10 // Log every 10%

	for i, bar := range bars {
		// Check for context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Check daily loss limit
		currentDate := bar.Timestamp.Format("2006-01-02")
		if e.executor.CheckDailyLossLimit(currentDate) {
			e.logger.Warn().
				Str("date", currentDate).
				Msg("Daily loss limit hit, skipping rest of day")

			// Skip rest of day
			for i+1 < len(bars) && bars[i+1].Timestamp.Format("2006-01-02") == currentDate {
				i++
			}
			continue
		}

		// Create market data event
		mdEvent := events.NewMarketDataEvent(
			e.config.Symbol,
			bar.Open,
			bar.High,
			bar.Low,
			bar.Close,
			bar.Volume,
			bar.Timestamp,
		)

		// Publish to strategy
		e.eventBus.Publish(ctx, mdEvent)

		// Process any signals generated
		e.processSignals(ctx, signalCh, bar)

		// Update equity curve (every bar)
		e.executor.UpdateEquityCurve(bar.Timestamp, bar.Close)

		// Log progress
		if i > 0 && i%progressInterval == 0 {
			progress := float64(i) / float64(totalBars) * 100
			e.logger.Info().
				Float64("progress", progress).
				Str("timestamp", bar.Timestamp.Format("2006-01-02 15:04")).
				Str("status", e.executor.Summary()).
				Msg("Backtest progress")
		}
	}

	return nil
}

// processSignals processes any signals generated by the strategy
func (e *Engine) processSignals(ctx context.Context, signalCh <-chan events.Event, currentBar types.Bar) {
	// Process all pending signals (non-blocking)
	for {
		select {
		case event := <-signalCh:
			if signalEvent, ok := event.(*events.SignalEvent); ok {
				e.handleSignal(ctx, signalEvent, currentBar)
			}
		default:
			// No more signals
			return
		}
	}
}

// handleSignal executes a trade based on signal
func (e *Engine) handleSignal(ctx context.Context, signal *events.SignalEvent, currentBar types.Bar) {
	e.logger.Debug().
		Str("symbol", signal.Symbol).
		Str("action", signal.Action).
		Float64("price", signal.Price).
		Float64("confidence", signal.Confidence).
		Str("reason", signal.Reason).
		Msg("Processing signal")

	var err error

	switch signal.Action {
	case "BUY":
		err = e.executor.ExecuteBuy(
			signal.Symbol,
			signal.Price,
			signal.Quantity,
			currentBar.Timestamp,
			signal.Reason,
		)

	case "SELL":
		err = e.executor.ExecuteSell(
			signal.Symbol,
			signal.Price,
			currentBar.Timestamp,
			signal.Reason,
		)

	default:
		e.logger.Warn().
			Str("signal", signal.Action).
			Msg("Unknown signal type")
		return
	}

	if err != nil {
		e.logger.Debug().
			Err(err).
			Str("signal", signal.Action).
			Msg("Signal execution skipped")
	}
}

// generateResult compiles the backtest results
func (e *Engine) generateResult(startTime time.Time) *BacktestResult {
	trades := e.executor.GetTrades()
	dailyStats := e.executor.GetDailyStats()
	equityCurve := e.executor.GetEquityCurve()

	// Calculate metrics
	calculator := NewMetricsCalculator(trades, dailyStats, equityCurve, e.config.InitialCapital)
	metrics := calculator.CalculateAllMetrics()

	// Compile result
	finalCapital := e.executor.GetCash()
	totalReturn := finalCapital - e.config.InitialCapital
	totalReturnPct := (totalReturn / e.config.InitialCapital) * 100

	result := &BacktestResult{
		Config:         e.config,
		InitialCapital: e.config.InitialCapital,
		FinalCapital:   finalCapital,
		TotalReturn:    totalReturn,
		TotalReturnPct: totalReturnPct,

		TotalTrades:   int(metrics["total_trades"]),
		WinningTrades: int(metrics["winning_trades"]),
		LosingTrades:  int(metrics["losing_trades"]),
		WinRate:       metrics["win_rate"],

		GrossProfit:  metrics["gross_profit"],
		GrossLoss:    metrics["gross_loss"],
		NetProfit:    metrics["net_profit"],
		ProfitFactor: metrics["profit_factor"],
		AverageTrade: metrics["average_trade"],
		AverageWin:   metrics["average_win"],
		AverageLoss:  metrics["average_loss"],
		LargestWin:   metrics["largest_win"],
		LargestLoss:  metrics["largest_loss"],

		MaxDrawdown:    metrics["max_drawdown"],
		MaxDrawdownPct: metrics["max_drawdown_pct"],
		SharpeRatio:    metrics["sharpe_ratio"],
		SortinoRatio:   metrics["sortino_ratio"],
		CalmarRatio:    metrics["calmar_ratio"],

		AvgTradeDuration:     time.Duration(metrics["avg_trade_duration_minutes"]) * time.Minute,
		MaxConsecutiveWins:   int(metrics["max_consecutive_wins"]),
		MaxConsecutiveLosses: int(metrics["max_consecutive_losses"]),

		TotalCommission: metrics["total_commission"],
		TotalSlippage:   metrics["total_slippage"],

		StartDate: e.config.StartDate,
		EndDate:   e.config.EndDate,
		Duration:  e.config.EndDate.Sub(e.config.StartDate),

		Trades:      trades,
		DailyStats:  dailyStats,
		EquityCurve: equityCurve,

		BacktestDuration: time.Since(startTime),
	}

	return result
}
