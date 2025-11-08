package strategy

import (
	"context"
	"fmt"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/pkg/indicators"
	"github.com/rs/zerolog"
)

// OpeningRangeBreakoutStrategy implements the classic Opening Range Breakout (ORB) strategy
// 1. Define opening range: First 15-30 minutes of market open (9:30-9:45 or 9:30-10:00 AM ET)
// 2. Entry: Price breaks above OR high → BUY, Price breaks below OR low → SELL
// 3. Exit: End of day (3:55 PM ET) OR stop loss
// Timeframe: Works best with 1-5 minute bars, focus on market open
type OpeningRangeBreakoutStrategy struct {
	*BaseStrategy

	// Opening range parameters
	rangeMinutes int // Minutes after market open to define range (15 or 30)

	// Market hours (US Eastern Time)
	marketOpen  time.Duration // 9:30 AM ET
	marketClose time.Duration // 4:00 PM ET
	exitTime    time.Duration // 3:55 PM ET (close positions before market close)

	// Opening range tracking for each symbol
	openingRanges map[string]*OpeningRange

	// ATR for stop loss (optional but recommended)
	atrIndicators map[string]*indicators.ATR
	atrPeriod     int

	// Position tracking
	positions   map[string]*Position
	tradedToday map[string]bool // Track if we already traded this symbol today
}

// OpeningRange stores the high/low of opening period
type OpeningRange struct {
	High       float64
	Low        float64
	IsComplete bool
	StartTime  time.Time
	EndTime    time.Time
	BarCount   int
}

// Position tracks current position details
type Position struct {
	Side       string  // "LONG" or "SHORT"
	EntryPrice float64
	StopLoss   float64
	Quantity   int
}

// NewOpeningRangeBreakoutStrategy creates a new ORB strategy
func NewOpeningRangeBreakoutStrategy(
	id string,
	symbols []string,
	rangeMinutes int,
	atrPeriod int,
	eventBus *events.EventBus,
	logger zerolog.Logger,
) *OpeningRangeBreakoutStrategy {
	// Set defaults
	if rangeMinutes != 15 && rangeMinutes != 30 {
		rangeMinutes = 15 // Standard ORB-15
	}
	if atrPeriod < 1 {
		atrPeriod = 14 // Standard ATR
	}

	strategy := &OpeningRangeBreakoutStrategy{
		BaseStrategy:  NewBaseStrategy(id, fmt.Sprintf("ORB-%d", rangeMinutes), symbols, eventBus, logger),
		rangeMinutes:  rangeMinutes,
		marketOpen:    9*time.Hour + 30*time.Minute,  // 9:30 AM
		marketClose:   16 * time.Hour,                // 4:00 PM
		exitTime:      15*time.Hour + 55*time.Minute, // 3:55 PM
		openingRanges: make(map[string]*OpeningRange),
		atrIndicators: make(map[string]*indicators.ATR),
		atrPeriod:     atrPeriod,
		positions:     make(map[string]*Position),
		tradedToday:   make(map[string]bool),
	}

	// Initialize for each symbol
	for _, symbol := range symbols {
		strategy.openingRanges[symbol] = &OpeningRange{IsComplete: false}
		strategy.atrIndicators[symbol] = indicators.NewATR(atrPeriod)
		strategy.positions[symbol] = nil
		strategy.tradedToday[symbol] = false
	}

	return strategy
}

// Initialize prepares the strategy
func (s *OpeningRangeBreakoutStrategy) Initialize(ctx context.Context) error {
	s.logger.Info().
		Int("range_minutes", s.rangeMinutes).
		Int("atr_period", s.atrPeriod).
		Strs("symbols", s.symbols).
		Msg("Initializing Opening Range Breakout strategy")

	// Subscribe to events
	s.Subscribe()

	return nil
}

// Start begins the strategy execution
func (s *OpeningRangeBreakoutStrategy) Start(ctx context.Context) error {
	if s.running {
		return fmt.Errorf("strategy already running")
	}

	s.logger.Info().Msg("Starting Opening Range Breakout strategy")
	s.SetRunning(true)

	// Publish system status event
	statusEvent := events.NewSystemStatusEvent(
		s.Name(),
		"RUNNING",
		fmt.Sprintf("ORB-%d strategy started", s.rangeMinutes),
	)
	s.EventBus().Publish(ctx, statusEvent)

	// Start goroutine to process events
	go s.processEvents(ctx)

	return nil
}

// processEvents is the main event processing loop
func (s *OpeningRangeBreakoutStrategy) processEvents(ctx context.Context) {
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
func (s *OpeningRangeBreakoutStrategy) OnMarketData(ctx context.Context, event *events.MarketDataEvent) error {
	// Only process symbols we're trading
	if !s.isSymbolTracked(event.Symbol) {
		return nil
	}

	// Get opening range and indicators
	or := s.openingRanges[event.Symbol]
	atr := s.atrIndicators[event.Symbol]
	position := s.positions[event.Symbol]

	// Update ATR
	bar := indicators.PricePoint{
		High:      event.High,
		Low:       event.Low,
		Close:     event.Close,
		Timestamp: event.DataTimestamp,
	}
	atr.UpdateOHLCV(bar)

	// Get time of day
	timeOfDay := s.getTimeOfDay(event.DataTimestamp)

	// Check if new trading day (reset state)
	if s.isNewTradingDay(event.DataTimestamp, or) {
		s.resetDayState(event.Symbol)
		or = s.openingRanges[event.Symbol]
	}

	// Phase 1: Build opening range (first rangeMinutes after market open)
	if !or.IsComplete && timeOfDay >= s.marketOpen && timeOfDay < s.marketOpen+time.Duration(s.rangeMinutes)*time.Minute {
		s.updateOpeningRange(event.Symbol, event.High, event.Low, event.DataTimestamp)
		return nil
	}

	// Mark range complete if time passed
	if !or.IsComplete && timeOfDay >= s.marketOpen+time.Duration(s.rangeMinutes)*time.Minute {
		or.IsComplete = true
		s.logger.Info().
			Str("symbol", event.Symbol).
			Float64("high", or.High).
			Float64("low", or.Low).
			Int("bars", or.BarCount).
			Msg("Opening range complete")
	}

	// Phase 2: Trade breakouts (after opening range completes, before exit time)
	if or.IsComplete && timeOfDay < s.exitTime && !s.tradedToday[event.Symbol] {
		s.checkBreakoutSignals(ctx, event, or, atr)
	}

	// Phase 3: Monitor position and check stop loss
	if position != nil && timeOfDay < s.exitTime {
		s.checkStopLoss(ctx, event, position, atr)
	}

	// Phase 4: Close all positions before market close
	if position != nil && timeOfDay >= s.exitTime {
		s.closePosition(ctx, event.Symbol, event.Close, "End of day exit")
	}

	return nil
}

// updateOpeningRange updates the opening range high/low
func (s *OpeningRangeBreakoutStrategy) updateOpeningRange(symbol string, high, low float64, timestamp time.Time) {
	or := s.openingRanges[symbol]

	if or.BarCount == 0 {
		// First bar
		or.High = high
		or.Low = low
		or.StartTime = timestamp
	} else {
		// Update range
		if high > or.High {
			or.High = high
		}
		if low < or.Low {
			or.Low = low
		}
	}

	or.BarCount++
	or.EndTime = timestamp
}

// checkBreakoutSignals looks for breakout above/below opening range
func (s *OpeningRangeBreakoutStrategy) checkBreakoutSignals(
	ctx context.Context,
	event *events.MarketDataEvent,
	or *OpeningRange,
	atr *indicators.ATR,
) {
	currentPrice := event.Close

	var signal string
	var reason string
	var confidence float64

	// Bullish breakout: Price breaks above opening range high
	if currentPrice > or.High {
		signal = "BUY"
		confidence = 0.80
		breakoutSize := ((currentPrice - or.High) / or.High) * 100
		reason = fmt.Sprintf("ORB bullish breakout: %.2f > %.2f (%.2f%% above OR high)",
			currentPrice, or.High, breakoutSize)

		// Higher confidence for larger breakouts
		if breakoutSize > 0.5 {
			confidence = 0.85
		}
	}

	// Bearish breakout: Price breaks below opening range low
	// Note: For long-only day trading, we might skip short signals
	// Uncomment to enable short trades
	/*
	if currentPrice < or.Low {
		signal = "SELL"
		confidence = 0.80
		breakoutSize := ((or.Low - currentPrice) / or.Low) * 100
		reason = fmt.Sprintf("ORB bearish breakout: %.2f < %.2f (%.2f%% below OR low)",
			currentPrice, or.Low, breakoutSize)

		if breakoutSize > 0.5 {
			confidence = 0.85
		}
	}
	*/

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

		// Mark as traded for today (ORB typically one trade per day per symbol)
		s.tradedToday[event.Symbol] = true

		// Create position tracking
		stopLoss := s.calculateStopLoss(currentPrice, or, atr, signal == "BUY")
		s.positions[event.Symbol] = &Position{
			Side:       map[string]string{"BUY": "LONG", "SELL": "SHORT"}[signal],
			EntryPrice: currentPrice,
			StopLoss:   stopLoss,
			Quantity:   100,
		}
	}
}

// calculateStopLoss calculates stop loss based on opening range or ATR
func (s *OpeningRangeBreakoutStrategy) calculateStopLoss(entryPrice float64, or *OpeningRange, atr *indicators.ATR, isLong bool) float64 {
	// Option 1: Use opening range low/high as stop
	// Option 2: Use ATR-based stop
	// We'll use the tighter of the two

	var orStop float64
	var atrStop float64

	if isLong {
		// Long position: stop below opening range low
		orStop = or.Low

		// Or 2 ATR below entry
		if atr.IsReady() {
			atrStop = entryPrice - atr.GetStopLossDistance(2.0)
		} else {
			atrStop = entryPrice * 0.98 // Default 2% stop
		}

		// Use the higher stop (tighter)
		if orStop > atrStop {
			return orStop
		}
		return atrStop

	} else {
		// Short position: stop above opening range high
		orStop = or.High

		if atr.IsReady() {
			atrStop = entryPrice + atr.GetStopLossDistance(2.0)
		} else {
			atrStop = entryPrice * 1.02
		}

		// Use the lower stop (tighter)
		if orStop < atrStop {
			return orStop
		}
		return atrStop
	}
}

// checkStopLoss monitors position and exits if stop loss hit
func (s *OpeningRangeBreakoutStrategy) checkStopLoss(
	ctx context.Context,
	event *events.MarketDataEvent,
	position *Position,
	atr *indicators.ATR,
) {
	currentPrice := event.Close

	stopHit := false
	if position.Side == "LONG" && currentPrice <= position.StopLoss {
		stopHit = true
	} else if position.Side == "SHORT" && currentPrice >= position.StopLoss {
		stopHit = true
	}

	if stopHit {
		reason := fmt.Sprintf("Stop loss hit: %.2f (stop: %.2f)",
			currentPrice, position.StopLoss)
		s.closePosition(ctx, event.Symbol, currentPrice, reason)
	}
}

// closePosition sends signal to close position
func (s *OpeningRangeBreakoutStrategy) closePosition(ctx context.Context, symbol string, price float64, reason string) {
	position := s.positions[symbol]
	if position == nil {
		return
	}

	// Send SELL signal to close position
	signal := "SELL"
	confidence := 0.90 // High confidence for exit

	signalEvent := events.NewSignalEvent(
		s.ID(),
		symbol,
		signal,
		confidence,
		price,
		position.Quantity,
		reason,
	)

	s.PublishSignal(ctx, signalEvent)

	// Clear position
	s.positions[symbol] = nil
}

// getTimeOfDay returns time since midnight in Eastern Time
// Note: This is simplified - in production, handle timezone conversions properly
func (s *OpeningRangeBreakoutStrategy) getTimeOfDay(t time.Time) time.Duration {
	return time.Duration(t.Hour())*time.Hour +
		time.Duration(t.Minute())*time.Minute +
		time.Duration(t.Second())*time.Second
}

// isNewTradingDay checks if this is a new trading day
func (s *OpeningRangeBreakoutStrategy) isNewTradingDay(t time.Time, or *OpeningRange) bool {
	if or.StartTime.IsZero() {
		return true
	}
	return t.Format("2006-01-02") != or.StartTime.Format("2006-01-02")
}

// resetDayState resets all state for a new trading day
func (s *OpeningRangeBreakoutStrategy) resetDayState(symbol string) {
	s.openingRanges[symbol] = &OpeningRange{IsComplete: false}
	s.positions[symbol] = nil
	s.tradedToday[symbol] = false

	s.logger.Info().
		Str("symbol", symbol).
		Msg("New trading day - reset state")
}

// OnOrderFilled is called when an order is filled
func (s *OpeningRangeBreakoutStrategy) OnOrderFilled(ctx context.Context, event *events.OrderFilledEvent) error {
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
		Msg("ORB strategy order filled")

	// Position tracking is handled in checkBreakoutSignals and closePosition

	return nil
}

// Helper methods

func (s *OpeningRangeBreakoutStrategy) isSymbolTracked(symbol string) bool {
	for _, sym := range s.symbols {
		if sym == symbol {
			return true
		}
	}
	return false
}

// GetOpeningRange returns the opening range for a symbol (for testing/monitoring)
func (s *OpeningRangeBreakoutStrategy) GetOpeningRange(symbol string) (high, low float64, complete bool) {
	if or, ok := s.openingRanges[symbol]; ok {
		return or.High, or.Low, or.IsComplete
	}
	return 0, 0, false
}

// HasPosition returns whether we have a position in the symbol
func (s *OpeningRangeBreakoutStrategy) HasPosition(symbol string) bool {
	return s.positions[symbol] != nil
}
