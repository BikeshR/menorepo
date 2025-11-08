package strategy

import (
	"context"
	"fmt"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/pkg/indicators"
	"github.com/rs/zerolog"
)

// RSIMeanReversionStrategy implements a mean reversion strategy using RSI
// Entry: RSI < oversoldThreshold (default 30) → BUY
// Exit: RSI > overboughtThreshold (default 70) OR RSI crosses above 50 → SELL
// Timeframe: Works best with 1-5 minute bars
type RSIMeanReversionStrategy struct {
	*BaseStrategy

	// RSI parameters
	rsiPeriod          int
	oversoldThreshold  float64
	overboughtThreshold float64

	// RSI indicators for each symbol
	rsiIndicators map[string]*indicators.RSI

	// Position tracking (to avoid multiple entries)
	positions map[string]bool // true = long position
}

// NewRSIMeanReversionStrategy creates a new RSI mean reversion strategy
func NewRSIMeanReversionStrategy(
	id string,
	symbols []string,
	rsiPeriod int,
	oversoldThreshold, overboughtThreshold float64,
	eventBus *events.EventBus,
	logger zerolog.Logger,
) *RSIMeanReversionStrategy {
	// Set defaults
	if rsiPeriod < 2 {
		rsiPeriod = 14 // Standard RSI period
	}
	if oversoldThreshold <= 0 {
		oversoldThreshold = 30 // Standard oversold level
	}
	if overboughtThreshold <= 0 {
		overboughtThreshold = 70 // Standard overbought level
	}

	strategy := &RSIMeanReversionStrategy{
		BaseStrategy:        NewBaseStrategy(id, "RSI Mean Reversion", symbols, eventBus, logger),
		rsiPeriod:           rsiPeriod,
		oversoldThreshold:   oversoldThreshold,
		overboughtThreshold: overboughtThreshold,
		rsiIndicators:       make(map[string]*indicators.RSI),
		positions:           make(map[string]bool),
	}

	// Initialize RSI indicator for each symbol
	for _, symbol := range symbols {
		strategy.rsiIndicators[symbol] = indicators.NewRSI(rsiPeriod)
		strategy.positions[symbol] = false
	}

	return strategy
}

// Initialize prepares the strategy
func (s *RSIMeanReversionStrategy) Initialize(ctx context.Context) error {
	s.logger.Info().
		Int("rsi_period", s.rsiPeriod).
		Float64("oversold", s.oversoldThreshold).
		Float64("overbought", s.overboughtThreshold).
		Strs("symbols", s.symbols).
		Msg("Initializing RSI Mean Reversion strategy")

	// Subscribe to events
	s.Subscribe()

	return nil
}

// Start begins the strategy execution
func (s *RSIMeanReversionStrategy) Start(ctx context.Context) error {
	if s.running {
		return fmt.Errorf("strategy already running")
	}

	s.logger.Info().Msg("Starting RSI Mean Reversion strategy")
	s.SetRunning(true)

	// Publish system status event
	statusEvent := events.NewSystemStatusEvent(
		s.Name(),
		"RUNNING",
		"RSI Mean Reversion strategy started",
	)
	s.EventBus().Publish(ctx, statusEvent)

	// Start goroutine to process events
	go s.processEvents(ctx)

	return nil
}

// processEvents is the main event processing loop
func (s *RSIMeanReversionStrategy) processEvents(ctx context.Context) {
	s.logger.Info().Msg("Event processing loop started")

	for {
		select {
		case event := <-s.marketDataCh:
			if mdEvent, ok := event.(*events.MarketDataEvent); ok {
				if err := s.OnMarketData(ctx, mdEvent); err != nil {
					s.logger.Error().Err(err).Msg("Error processing market data")
				}
			}

		case event := <-s.orderFilledCh:
			if ofEvent, ok := event.(*events.OrderFilledEvent); ok {
				if err := s.OnOrderFilled(ctx, ofEvent); err != nil {
					s.logger.Error().Err(err).Msg("Error processing order filled")
				}
			}

		case <-s.stopCh:
			s.logger.Info().Msg("Stop signal received, exiting event loop")
			return

		case <-ctx.Done():
			s.logger.Info().Msg("Context canceled, exiting event loop")
			return
		}
	}
}

// OnMarketData processes new market data and generates signals
func (s *RSIMeanReversionStrategy) OnMarketData(ctx context.Context, event *events.MarketDataEvent) error {
	// Only process symbols we're trading
	if !s.isSymbolTracked(event.Symbol) {
		return nil
	}

	// Get RSI indicator for this symbol
	rsi := s.rsiIndicators[event.Symbol]

	// Update RSI with new price
	if err := rsi.Update(event.Close, event.DataTimestamp); err != nil {
		return fmt.Errorf("failed to update RSI: %w", err)
	}

	// Wait until RSI is ready
	if !rsi.IsReady() {
		s.logger.Debug().
			Str("symbol", event.Symbol).
			Msg("RSI not ready yet, waiting for more data")
		return nil
	}

	rsiValue := rsi.Value()
	hasPosition := s.positions[event.Symbol]

	s.logger.Debug().
		Str("symbol", event.Symbol).
		Float64("rsi", rsiValue).
		Float64("price", event.Close).
		Bool("has_position", hasPosition).
		Msg("RSI updated")

	// Generate signals based on RSI
	var signal string
	var reason string
	var confidence float64

	if !hasPosition {
		// No position - look for entry signal
		if rsi.IsOversoldCustom(s.oversoldThreshold) {
			signal = "BUY"
			confidence = calculateRSIConfidence(rsiValue, s.oversoldThreshold, true)
			reason = fmt.Sprintf("RSI oversold: %.2f < %.2f (extreme oversold)",
				rsiValue, s.oversoldThreshold)
		}
	} else {
		// Have position - look for exit signal
		if rsi.IsOverboughtCustom(s.overboughtThreshold) {
			signal = "SELL"
			confidence = calculateRSIConfidence(rsiValue, s.overboughtThreshold, false)
			reason = fmt.Sprintf("RSI overbought: %.2f > %.2f (take profit)",
				rsiValue, s.overboughtThreshold)
		} else if rsiValue >= 50 {
			// Also exit when RSI returns to middle (mean reversion complete)
			signal = "SELL"
			confidence = 0.7
			reason = fmt.Sprintf("RSI returned to middle: %.2f >= 50 (mean reversion complete)",
				rsiValue)
		}
	}

	// Generate signal if we have one
	if signal != "" {
		signalEvent := events.NewSignalEvent(
			s.ID(),
			event.Symbol,
			signal,
			confidence,
			event.Close,
			100, // Default quantity
			reason,
		)

		s.PublishSignal(ctx, signalEvent)

		// Update position tracking (will be confirmed in OnOrderFilled)
		// This is optimistic - we assume the order will be filled
		if signal == "BUY" {
			s.positions[event.Symbol] = true
		} else {
			s.positions[event.Symbol] = false
		}
	}

	return nil
}

// OnOrderFilled is called when an order is filled
func (s *RSIMeanReversionStrategy) OnOrderFilled(ctx context.Context, event *events.OrderFilledEvent) error {
	// Only process our orders
	if event.StrategyID != s.ID() {
		return nil
	}

	s.logger.Info().
		Str("order_id", event.OrderID).
		Str("symbol", event.Symbol).
		Str("action", event.Action).
		Int("quantity", event.Quantity).
		Float64("filled_price", event.Price).
		Msg("RSI strategy order filled")

	// Update position tracking based on actual fill
	if event.Action == "BUY" {
		s.positions[event.Symbol] = true
	} else if event.Action == "SELL" {
		s.positions[event.Symbol] = false
	}

	return nil
}

// Helper methods

func (s *RSIMeanReversionStrategy) isSymbolTracked(symbol string) bool {
	for _, sym := range s.symbols {
		if sym == symbol {
			return true
		}
	}
	return false
}

// calculateRSIConfidence returns confidence score based on how extreme the RSI is
func calculateRSIConfidence(rsiValue, threshold float64, oversold bool) float64 {
	if oversold {
		// The lower the RSI below threshold, the higher the confidence
		// RSI 20 (10 below 30) = higher confidence than RSI 28 (2 below 30)
		distance := threshold - rsiValue
		if distance <= 0 {
			return 0.6 // Minimum confidence
		}
		// Cap at 0.95 for extreme oversold (RSI < 20)
		confidence := 0.6 + (distance / 30.0 * 0.35)
		if confidence > 0.95 {
			confidence = 0.95
		}
		return confidence
	} else {
		// The higher the RSI above threshold, the higher the confidence
		distance := rsiValue - threshold
		if distance <= 0 {
			return 0.6
		}
		confidence := 0.6 + (distance / 30.0 * 0.35)
		if confidence > 0.95 {
			confidence = 0.95
		}
		return confidence
	}
}

// GetRSIValue returns the current RSI value for a symbol (for testing/monitoring)
func (s *RSIMeanReversionStrategy) GetRSIValue(symbol string) float64 {
	if rsi, ok := s.rsiIndicators[symbol]; ok {
		return rsi.Value()
	}
	return 0
}

// HasPosition returns whether we have a position in the symbol
func (s *RSIMeanReversionStrategy) HasPosition(symbol string) bool {
	return s.positions[symbol]
}
