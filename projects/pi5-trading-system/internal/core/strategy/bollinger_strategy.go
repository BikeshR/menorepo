package strategy

import (
	"context"
	"fmt"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/pkg/indicators"
	"github.com/rs/zerolog"
)

// BollingerBandStrategy implements a mean reversion strategy using Bollinger Bands
// Entry: Price touches/crosses lower band → BUY (bounce)
//        Price touches/crosses upper band → SELL (reversal)
// Exit: Price returns to middle band OR opposite band touched
// Timeframe: Works best with 5-minute bars
type BollingerBandStrategy struct {
	*BaseStrategy

	// Bollinger Band parameters
	period int
	stdDev float64

	// Bollinger Band indicators for each symbol
	bbIndicators map[string]*indicators.BollingerBands

	// Position tracking
	positions map[string]bool // true = long position

	// Price tracking for band cross detection
	previousPrices map[string]float64
}

// NewBollingerBandStrategy creates a new Bollinger Band strategy
func NewBollingerBandStrategy(
	id string,
	symbols []string,
	period int,
	stdDev float64,
	eventBus *events.EventBus,
	logger zerolog.Logger,
) *BollingerBandStrategy {
	// Set defaults
	if period < 2 {
		period = 20 // Standard period
	}
	if stdDev <= 0 {
		stdDev = 2.0 // Standard deviation multiplier
	}

	strategy := &BollingerBandStrategy{
		BaseStrategy:   NewBaseStrategy(id, "Bollinger Band Mean Reversion", symbols, eventBus, logger),
		period:         period,
		stdDev:         stdDev,
		bbIndicators:   make(map[string]*indicators.BollingerBands),
		positions:      make(map[string]bool),
		previousPrices: make(map[string]float64),
	}

	// Initialize Bollinger Bands for each symbol
	for _, symbol := range symbols {
		strategy.bbIndicators[symbol] = indicators.NewBollingerBands(period, stdDev)
		strategy.positions[symbol] = false
		strategy.previousPrices[symbol] = 0
	}

	return strategy
}

// Initialize prepares the strategy
func (s *BollingerBandStrategy) Initialize(ctx context.Context) error {
	s.logger.Info().
		Int("period", s.period).
		Float64("std_dev", s.stdDev).
		Strs("symbols", s.symbols).
		Msg("Initializing Bollinger Band strategy")

	// Subscribe to events
	s.Subscribe()

	return nil
}

// Start begins the strategy execution
func (s *BollingerBandStrategy) Start(ctx context.Context) error {
	if s.running {
		return fmt.Errorf("strategy already running")
	}

	s.logger.Info().Msg("Starting Bollinger Band strategy")
	s.SetRunning(true)

	// Publish system status event
	statusEvent := events.NewSystemStatusEvent(
		s.Name(),
		"RUNNING",
		"Bollinger Band strategy started",
	)
	s.EventBus().Publish(ctx, statusEvent)

	// Start goroutine to process events
	go s.processEvents(ctx)

	return nil
}

// processEvents is the main event processing loop
func (s *BollingerBandStrategy) processEvents(ctx context.Context) {
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
func (s *BollingerBandStrategy) OnMarketData(ctx context.Context, event *events.MarketDataEvent) error {
	// Only process symbols we're trading
	if !s.isSymbolTracked(event.Symbol) {
		return nil
	}

	// Get Bollinger Bands indicator for this symbol
	bb := s.bbIndicators[event.Symbol]

	// Update Bollinger Bands with new price
	if err := bb.Update(event.Close, event.DataTimestamp); err != nil {
		return fmt.Errorf("failed to update Bollinger Bands: %w", err)
	}

	// Wait until Bollinger Bands is ready
	if !bb.IsReady() {
		s.logger.Debug().
			Str("symbol", event.Symbol).
			Msg("Bollinger Bands not ready yet, waiting for more data")
		return nil
	}

	currentPrice := event.Close
	previousPrice := s.previousPrices[event.Symbol]
	hasPosition := s.positions[event.Symbol]

	upper := bb.Upper()
	middle := bb.Middle()
	lower := bb.Lower()
	percentB := bb.PercentB(currentPrice)
	bandwidth := bb.BandWidth()

	s.logger.Debug().
		Str("symbol", event.Symbol).
		Float64("price", currentPrice).
		Float64("upper", upper).
		Float64("middle", middle).
		Float64("lower", lower).
		Float64("percent_b", percentB).
		Float64("bandwidth", bandwidth).
		Bool("has_position", hasPosition).
		Msg("Bollinger Bands updated")

	// Generate signals based on Bollinger Bands
	var signal string
	var reason string
	var confidence float64

	if !hasPosition {
		// No position - look for entry signals

		// Buy signal: Price at or below lower band (oversold bounce)
		if bb.IsBelowLowerBand(currentPrice) || percentB <= 0.1 {
			signal = "BUY"
			// Higher confidence for stronger oversold
			if percentB < 0 {
				confidence = 0.85 // Price below lower band
			} else {
				confidence = 0.75 // Price near lower band
			}
			reason = fmt.Sprintf("Price at lower band: %.2f <= %.2f (%%B=%.2f, bounce expected)",
				currentPrice, lower, percentB)
		}

		// Alternative: Buy on band squeeze breakout (low volatility → high volatility)
		// If bandwidth is very narrow and price breaks above middle
		if bandwidth < (middle * 0.02) && currentPrice > middle && previousPrice <= middle {
			signal = "BUY"
			confidence = 0.70
			reason = fmt.Sprintf("Band squeeze breakout: bandwidth=%.2f, price broke above middle",
				bandwidth)
		}

	} else {
		// Have position - look for exit signals

		// Exit at middle band (mean reversion complete)
		if previousPrice < middle && currentPrice >= middle {
			signal = "SELL"
			confidence = 0.75
			reason = fmt.Sprintf("Price returned to middle band: %.2f >= %.2f (take profit)",
				currentPrice, middle)
		}

		// Exit at upper band (strong overbought)
		if bb.IsAboveUpperBand(currentPrice) || percentB >= 0.9 {
			signal = "SELL"
			if percentB > 1.0 {
				confidence = 0.85 // Price above upper band
			} else {
				confidence = 0.75 // Price near upper band
			}
			reason = fmt.Sprintf("Price at upper band: %.2f >= %.2f (%%B=%.2f, take profit)",
				currentPrice, upper, percentB)
		}

		// Stop loss: Price breaks below lower band again (failed bounce)
		if bb.IsBelowLowerBand(currentPrice) && percentB < -0.1 {
			signal = "SELL"
			confidence = 0.90 // High confidence for stop loss
			reason = fmt.Sprintf("Stop loss: price broke below lower band again (%%B=%.2f)",
				percentB)
		}
	}

	// Update previous price
	s.previousPrices[event.Symbol] = currentPrice

	// Generate signal if we have one
	if signal != "" {
		signalEvent := events.NewSignalEvent(
			s.ID(),
			event.Symbol,
			signal,
			confidence,
			currentPrice,
			100, // Default quantity
			reason,
		)

		s.PublishSignal(ctx, signalEvent)

		// Update position tracking (optimistic)
		if signal == "BUY" {
			s.positions[event.Symbol] = true
		} else {
			s.positions[event.Symbol] = false
		}
	}

	return nil
}

// OnOrderFilled is called when an order is filled
func (s *BollingerBandStrategy) OnOrderFilled(ctx context.Context, event *events.OrderFilledEvent) error {
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
		Msg("Bollinger Band strategy order filled")

	// Update position tracking based on actual fill
	if event.Action == "BUY" {
		s.positions[event.Symbol] = true
	} else if event.Action == "SELL" {
		s.positions[event.Symbol] = false
	}

	return nil
}

// Helper methods

func (s *BollingerBandStrategy) isSymbolTracked(symbol string) bool {
	for _, sym := range s.symbols {
		if sym == symbol {
			return true
		}
	}
	return false
}

// GetBollingerBands returns the Bollinger Bands values for a symbol (for testing/monitoring)
func (s *BollingerBandStrategy) GetBollingerBands(symbol string) (upper, middle, lower float64, ready bool) {
	if bb, ok := s.bbIndicators[symbol]; ok {
		if bb.IsReady() {
			return bb.Upper(), bb.Middle(), bb.Lower(), true
		}
	}
	return 0, 0, 0, false
}

// HasPosition returns whether we have a position in the symbol
func (s *BollingerBandStrategy) HasPosition(symbol string) bool {
	return s.positions[symbol]
}
