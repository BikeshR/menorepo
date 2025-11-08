package strategy

import (
	"context"
	"fmt"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/pkg/indicators"
	"github.com/rs/zerolog"
)

// VWAPBounceStrategy implements a day trading strategy using VWAP as support/resistance
// Entry: Price bounces off VWAP (within tolerance) → BUY (if trending up)
// Exit: Price moves away from VWAP by target % OR crosses VWAP to opposite side
// Timeframe: Works best with 1-5 minute bars during market hours
// Note: VWAP resets each trading day
type VWAPBounceStrategy struct {
	*BaseStrategy

	// VWAP parameters
	bounceTolerance float64 // % distance from VWAP to consider a "bounce" (e.g., 0.3%)
	targetProfit    float64 // % distance from VWAP for profit target (e.g., 1.0%)

	// VWAP indicators for each symbol
	vwapIndicators map[string]*indicators.VWAP

	// EMA for trend detection (optional but recommended)
	emaIndicators map[string]*indicators.EMA
	emaPeriod     int

	// Position tracking
	positions   map[string]bool    // true = long position
	entryPrices map[string]float64 // track entry price for profit calculation

	// Previous prices for bounce detection
	previousPrices map[string]float64
}

// NewVWAPBounceStrategy creates a new VWAP bounce strategy
func NewVWAPBounceStrategy(
	id string,
	symbols []string,
	bounceTolerance float64,
	targetProfit float64,
	emaPeriod int,
	eventBus *events.EventBus,
	logger zerolog.Logger,
) *VWAPBounceStrategy {
	// Set defaults
	if bounceTolerance <= 0 {
		bounceTolerance = 0.3 // 0.3% from VWAP
	}
	if targetProfit <= 0 {
		targetProfit = 1.0 // 1.0% profit target
	}
	if emaPeriod < 1 {
		emaPeriod = 20 // Use 20 EMA for trend
	}

	strategy := &VWAPBounceStrategy{
		BaseStrategy:    NewBaseStrategy(id, "VWAP Bounce", symbols, eventBus, logger),
		bounceTolerance: bounceTolerance,
		targetProfit:    targetProfit,
		emaPeriod:       emaPeriod,
		vwapIndicators:  make(map[string]*indicators.VWAP),
		emaIndicators:   make(map[string]*indicators.EMA),
		positions:       make(map[string]bool),
		entryPrices:     make(map[string]float64),
		previousPrices:  make(map[string]float64),
	}

	// Initialize indicators for each symbol
	for _, symbol := range symbols {
		strategy.vwapIndicators[symbol] = indicators.NewVWAP()
		strategy.emaIndicators[symbol] = indicators.NewEMA(emaPeriod)
		strategy.positions[symbol] = false
		strategy.entryPrices[symbol] = 0
		strategy.previousPrices[symbol] = 0
	}

	return strategy
}

// Initialize prepares the strategy
func (s *VWAPBounceStrategy) Initialize(ctx context.Context) error {
	s.logger.Info().
		Float64("bounce_tolerance_pct", s.bounceTolerance).
		Float64("target_profit_pct", s.targetProfit).
		Int("ema_period", s.emaPeriod).
		Strs("symbols", s.symbols).
		Msg("Initializing VWAP Bounce strategy")

	// Subscribe to events
	s.Subscribe()

	return nil
}

// Start begins the strategy execution
func (s *VWAPBounceStrategy) Start(ctx context.Context) error {
	if s.running {
		return fmt.Errorf("strategy already running")
	}

	s.logger.Info().Msg("Starting VWAP Bounce strategy")
	s.SetRunning(true)

	// Publish system status event
	statusEvent := events.NewSystemStatusEvent(
		s.Name(),
		"RUNNING",
		"VWAP Bounce strategy started",
	)
	s.EventBus().Publish(ctx, statusEvent)

	// Start goroutine to process events
	go s.processEvents(ctx)

	return nil
}

// processEvents is the main event processing loop
func (s *VWAPBounceStrategy) processEvents(ctx context.Context) {
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
func (s *VWAPBounceStrategy) OnMarketData(ctx context.Context, event *events.MarketDataEvent) error {
	// Only process symbols we're trading
	if !s.isSymbolTracked(event.Symbol) {
		return nil
	}

	// Get indicators for this symbol
	vwap := s.vwapIndicators[event.Symbol]
	ema := s.emaIndicators[event.Symbol]

	// Update VWAP with OHLCV bar
	bar := indicators.PricePoint{
		Open:      event.Open,
		High:      event.High,
		Low:       event.Low,
		Close:     event.Close,
		Volume:    event.Volume,
		Timestamp: event.DataTimestamp,
	}

	if err := vwap.UpdateOHLCV(bar); err != nil {
		return fmt.Errorf("failed to update VWAP: %w", err)
	}

	// Update EMA for trend detection
	if err := ema.Update(event.Close, event.DataTimestamp); err != nil {
		return fmt.Errorf("failed to update EMA: %w", err)
	}

	// Wait until both indicators are ready
	if !vwap.IsReady() || !ema.IsReady() {
		s.logger.Debug().
			Str("symbol", event.Symbol).
			Msg("Indicators not ready yet, waiting for more data")
		return nil
	}

	currentPrice := event.Close
	vwapValue := vwap.Value()
	emaValue := ema.Value()
	hasPosition := s.positions[event.Symbol]
	entryPrice := s.entryPrices[event.Symbol]

	// Calculate distance from VWAP
	distanceFromVWAP := vwap.PriceDistanceFromVWAP(currentPrice)

	s.logger.Debug().
		Str("symbol", event.Symbol).
		Float64("price", currentPrice).
		Float64("vwap", vwapValue).
		Float64("ema", emaValue).
		Float64("distance_pct", distanceFromVWAP).
		Bool("has_position", hasPosition).
		Msg("VWAP updated")

	// Generate signals based on VWAP
	var signal string
	var reason string
	var confidence float64

	if !hasPosition {
		// No position - look for entry signals

		// Check trend: only trade if price and EMA are above VWAP (bullish trend)
		priceAboveVWAP := vwap.IsPriceAboveVWAP(currentPrice)
		emaAboveVWAP := ema.Value() > vwapValue

		if priceAboveVWAP && emaAboveVWAP {
			// Bullish trend - look for bounce off VWAP

			// Price touching VWAP from above (bounce scenario)
			// Previous price was further from VWAP, current price is close to VWAP
			absDistance := distanceFromVWAP
			if absDistance < 0 {
				absDistance = -absDistance
			}

			if absDistance <= s.bounceTolerance {
				// Price is within tolerance of VWAP
				signal = "BUY"
				confidence = 0.75 + (s.bounceTolerance-absDistance)/s.bounceTolerance*0.15 // 0.75-0.90
				reason = fmt.Sprintf("VWAP bounce: price %.2f near VWAP %.2f (%.2f%% away) in uptrend",
					currentPrice, vwapValue, distanceFromVWAP)
			}
		}

	} else {
		// Have position - look for exit signals

		// Calculate profit
		profitPct := ((currentPrice - entryPrice) / entryPrice) * 100

		// Exit 1: Target profit reached
		if profitPct >= s.targetProfit {
			signal = "SELL"
			confidence = 0.80
			reason = fmt.Sprintf("Target profit reached: %.2f%% >= %.2f%%",
				profitPct, s.targetProfit)
		}

		// Exit 2: Price crossed below VWAP (trend reversal)
		if vwap.IsPriceBelowVWAP(currentPrice) {
			signal = "SELL"
			confidence = 0.85
			reason = fmt.Sprintf("Price broke below VWAP: %.2f < %.2f (exit trend)",
				currentPrice, vwapValue)
		}

		// Exit 3: Price moved too far from VWAP (take profit)
		if distanceFromVWAP > s.targetProfit*2 {
			signal = "SELL"
			confidence = 0.75
			reason = fmt.Sprintf("Price far from VWAP: %.2f%% > %.2f%% (take profit)",
				distanceFromVWAP, s.targetProfit*2)
		}

		// Stop loss: Price dropped below entry by 0.5%
		stopLossPct := -0.5
		if profitPct < stopLossPct {
			signal = "SELL"
			confidence = 0.90
			reason = fmt.Sprintf("Stop loss: %.2f%% < %.2f%%",
				profitPct, stopLossPct)
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
			s.entryPrices[event.Symbol] = currentPrice
		} else {
			s.positions[event.Symbol] = false
			s.entryPrices[event.Symbol] = 0
		}
	}

	return nil
}

// OnOrderFilled is called when an order is filled
func (s *VWAPBounceStrategy) OnOrderFilled(ctx context.Context, event *events.OrderFilledEvent) error {
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
		Msg("VWAP strategy order filled")

	// Update position tracking based on actual fill
	if event.Action == "BUY" {
		s.positions[event.Symbol] = true
		s.entryPrices[event.Symbol] = event.Price
	} else if event.Action == "SELL" {
		s.positions[event.Symbol] = false
		s.entryPrices[event.Symbol] = 0
	}

	return nil
}

// Helper methods

func (s *VWAPBounceStrategy) isSymbolTracked(symbol string) bool {
	for _, sym := range s.symbols {
		if sym == symbol {
			return true
		}
	}
	return false
}

// GetVWAPValue returns the current VWAP value for a symbol (for testing/monitoring)
func (s *VWAPBounceStrategy) GetVWAPValue(symbol string) float64 {
	if vwap, ok := s.vwapIndicators[symbol]; ok {
		return vwap.Value()
	}
	return 0
}

// HasPosition returns whether we have a position in the symbol
func (s *VWAPBounceStrategy) HasPosition(symbol string) bool {
	return s.positions[symbol]
}
