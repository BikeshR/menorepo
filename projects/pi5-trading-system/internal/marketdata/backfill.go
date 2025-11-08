package marketdata

import (
	"context"
	"fmt"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/rs/zerolog"
)

// BackfillConfig defines parameters for historical data backfill
type BackfillConfig struct {
	// Lookback period (e.g., 7 days for 7 days of historical data)
	LookbackDays int

	// Timeframe for bars: "1Min", "5Min", "15Min", "1H", "1D"
	Timeframe string

	// Whether to publish backfilled data to event bus
	PublishEvents bool

	// Batch size for processing bars
	BatchSize int
}

// DefaultBackfillConfig returns sensible defaults
func DefaultBackfillConfig() *BackfillConfig {
	return &BackfillConfig{
		LookbackDays:  7,      // 7 days of data
		Timeframe:     "1Min", // 1-minute bars
		PublishEvents: true,   // Publish to event bus for strategy warm-up
		BatchSize:     100,    // Process 100 bars at a time
	}
}

// BackfillManager handles historical data loading
type BackfillManager struct {
	provider Provider
	eventBus *events.EventBus
	logger   zerolog.Logger
	config   *BackfillConfig
}

// NewBackfillManager creates a new backfill manager
func NewBackfillManager(provider Provider, eventBus *events.EventBus, config *BackfillConfig, logger zerolog.Logger) *BackfillManager {
	if config == nil {
		config = DefaultBackfillConfig()
	}

	return &BackfillManager{
		provider: provider,
		eventBus: eventBus,
		config:   config,
		logger:   logger.With().Str("component", "backfill_manager").Logger(),
	}
}

// BackfillSymbols loads historical data for symbols
func (bm *BackfillManager) BackfillSymbols(ctx context.Context, symbols []string) error {
	bm.logger.Info().
		Strs("symbols", symbols).
		Int("lookback_days", bm.config.LookbackDays).
		Str("timeframe", bm.config.Timeframe).
		Msg("Starting historical data backfill")

	startTime := time.Now()

	// Calculate time range
	end := time.Now()
	start := end.AddDate(0, 0, -bm.config.LookbackDays)

	// Process each symbol
	totalBars := 0
	for _, symbol := range symbols {
		barCount, err := bm.backfillSymbol(ctx, symbol, start, end)
		if err != nil {
			bm.logger.Error().
				Err(err).
				Str("symbol", symbol).
				Msg("Failed to backfill symbol")
			continue
		}

		totalBars += barCount

		bm.logger.Info().
			Str("symbol", symbol).
			Int("bars", barCount).
			Msg("Symbol backfill completed")
	}

	duration := time.Since(startTime)

	bm.logger.Info().
		Int("total_bars", totalBars).
		Int("symbols", len(symbols)).
		Dur("duration", duration).
		Msg("Backfill completed")

	return nil
}

// backfillSymbol backfills a single symbol
func (bm *BackfillManager) backfillSymbol(ctx context.Context, symbol string, start, end time.Time) (int, error) {
	bm.logger.Debug().
		Str("symbol", symbol).
		Time("start", start).
		Time("end", end).
		Msg("Fetching historical bars")

	// Fetch historical bars
	bars, err := bm.provider.GetHistoricalBars(ctx, symbol, bm.config.Timeframe, start, end)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch bars: %w", err)
	}

	if len(bars) == 0 {
		bm.logger.Warn().
			Str("symbol", symbol).
			Msg("No historical bars returned")
		return 0, nil
	}

	// Optionally publish to event bus
	if bm.config.PublishEvents {
		bm.logger.Info().
			Str("symbol", symbol).
			Int("bars", len(bars)).
			Msg("Publishing historical bars to event bus")

		// Process in batches to avoid overwhelming the event bus
		for i := 0; i < len(bars); i += bm.config.BatchSize {
			end := i + bm.config.BatchSize
			if end > len(bars) {
				end = len(bars)
			}

			batch := bars[i:end]
			for _, bar := range batch {
				// Create market data event from bar
				event := events.NewMarketDataEvent(
					bar.Symbol,
					bar.Open,
					bar.High,
					bar.Low,
					bar.Close,
					bar.Volume,
					bar.Timestamp,
				)

				// Publish to event bus
				bm.eventBus.Publish(ctx, event)
			}

			// Small delay between batches to avoid overwhelming
			select {
			case <-ctx.Done():
				return i, ctx.Err()
			case <-time.After(10 * time.Millisecond):
				// Continue
			}
		}
	}

	bm.logger.Info().
		Str("symbol", symbol).
		Int("bars_count", len(bars)).
		Time("first_bar", bars[0].Timestamp).
		Time("last_bar", bars[len(bars)-1].Timestamp).
		Msg("Backfill successful")

	return len(bars), nil
}

// BackfillSingleSymbol is a convenience method to backfill one symbol
func (bm *BackfillManager) BackfillSingleSymbol(ctx context.Context, symbol string, lookbackDays int) error {
	end := time.Now()
	start := end.AddDate(0, 0, -lookbackDays)

	_, err := bm.backfillSymbol(ctx, symbol, start, end)
	return err
}

// BackfillStats returns statistics about the backfill
type BackfillStats struct {
	SymbolsProcessed int
	TotalBars        int
	Duration         time.Duration
	Errors           []error
}

// BackfillWithStats performs backfill and returns detailed statistics
func (bm *BackfillManager) BackfillWithStats(ctx context.Context, symbols []string) (*BackfillStats, error) {
	stats := &BackfillStats{
		Errors: make([]error, 0),
	}

	startTime := time.Now()

	end := time.Now()
	start := end.AddDate(0, 0, -bm.config.LookbackDays)

	for _, symbol := range symbols {
		bars, err := bm.backfillSymbol(ctx, symbol, start, end)
		if err != nil {
			stats.Errors = append(stats.Errors, fmt.Errorf("%s: %w", symbol, err))
			continue
		}

		stats.SymbolsProcessed++
		stats.TotalBars += bars
	}

	stats.Duration = time.Since(startTime)

	return stats, nil
}
