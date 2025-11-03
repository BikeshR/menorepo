package strategy

import (
	"context"
	"fmt"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/rs/zerolog"
)

// MovingAverageCrossoverStrategy implements a simple MA crossover strategy
// When short MA crosses above long MA → BUY signal
// When short MA crosses below long MA → SELL signal
type MovingAverageCrossoverStrategy struct {
	*BaseStrategy

	shortPeriod int
	longPeriod  int

	// Price history for each symbol
	priceHistory map[string][]float64

	// Current MA values
	shortMA map[string]float64
	longMA  map[string]float64

	// Previous crossover state (to detect new crossovers)
	prevCrossState map[string]string // "ABOVE", "BELOW", or "NONE"
}

// NewMovingAverageCrossoverStrategy creates a new MA crossover strategy
func NewMovingAverageCrossoverStrategy(
	id string,
	symbols []string,
	shortPeriod, longPeriod int,
	eventBus *events.EventBus,
	logger zerolog.Logger,
) *MovingAverageCrossoverStrategy {
	return &MovingAverageCrossoverStrategy{
		BaseStrategy: NewBaseStrategy(id, "Moving Average Crossover", symbols, eventBus, logger),
		shortPeriod:  shortPeriod,
		longPeriod:   longPeriod,
		priceHistory: make(map[string][]float64),
		shortMA:      make(map[string]float64),
		longMA:       make(map[string]float64),
		prevCrossState: make(map[string]string),
	}
}

// Initialize prepares the strategy
func (s *MovingAverageCrossoverStrategy) Initialize(ctx context.Context) error {
	s.logger.Info().
		Int("short_period", s.shortPeriod).
		Int("long_period", s.longPeriod).
		Strs("symbols", s.symbols).
		Msg("Initializing Moving Average Crossover strategy")

	// Initialize data structures for each symbol
	for _, symbol := range s.symbols {
		s.priceHistory[symbol] = make([]float64, 0, s.longPeriod)
		s.shortMA[symbol] = 0.0
		s.longMA[symbol] = 0.0
		s.prevCrossState[symbol] = "NONE"
	}

	// Subscribe to events
	s.Subscribe()

	return nil
}

// Start begins the strategy execution
func (s *MovingAverageCrossoverStrategy) Start(ctx context.Context) error {
	if s.running {
		return fmt.Errorf("strategy already running")
	}

	s.logger.Info().Msg("Starting Moving Average Crossover strategy")
	s.SetRunning(true)

	// Publish system status event
	statusEvent := events.NewSystemStatusEvent(
		s.Name(),
		"RUNNING",
		"Strategy started successfully",
	)
	s.EventBus().Publish(ctx, statusEvent)

	// Start goroutine to process events
	go s.processEvents(ctx)

	return nil
}

// processEvents is the main event processing loop
// This demonstrates Go's concurrency with select statement
func (s *MovingAverageCrossoverStrategy) processEvents(ctx context.Context) {
	s.logger.Info().Msg("Event processing loop started")

	for {
		select {
		case event := <-s.marketDataCh:
			// Type assert to MarketDataEvent
			if mdEvent, ok := event.(*events.MarketDataEvent); ok {
				if err := s.OnMarketData(ctx, mdEvent); err != nil {
					s.logger.Error().Err(err).Msg("Error processing market data")
				}
			}

		case event := <-s.orderFilledCh:
			// Type assert to OrderFilledEvent
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
func (s *MovingAverageCrossoverStrategy) OnMarketData(ctx context.Context, event *events.MarketDataEvent) error {
	// Only process symbols we're trading
	if !s.isSymbolTracked(event.Symbol) {
		return nil
	}

	// Add new price to history
	s.addPrice(event.Symbol, event.Close)

	// Calculate moving averages
	shortMA := s.calculateMA(event.Symbol, s.shortPeriod)
	longMA := s.calculateMA(event.Symbol, s.longPeriod)

	// Need enough data for long MA
	if len(s.priceHistory[event.Symbol]) < s.longPeriod {
		s.logger.Debug().
			Str("symbol", event.Symbol).
			Int("data_points", len(s.priceHistory[event.Symbol])).
			Int("required", s.longPeriod).
			Msg("Not enough data for analysis")
		return nil
	}

	// Update MA values
	s.shortMA[event.Symbol] = shortMA
	s.longMA[event.Symbol] = longMA

	// Detect crossover
	signal := s.detectCrossover(event.Symbol, shortMA, longMA, event.Close)

	// Generate signal if crossover detected
	if signal != "" {
		signalEvent := events.NewSignalEvent(
			s.ID(),
			event.Symbol,
			signal,
			0.75, // Confidence score
			event.Close,
			100, // Default quantity
			fmt.Sprintf("MA Crossover: Short MA (%.2f) %s Long MA (%.2f)",
				shortMA,
				map[string]string{"BUY": "crossed above", "SELL": "crossed below"}[signal],
				longMA),
		)

		s.PublishSignal(ctx, signalEvent)
	}

	return nil
}

// OnOrderFilled is called when an order is filled
func (s *MovingAverageCrossoverStrategy) OnOrderFilled(ctx context.Context, event *events.OrderFilledEvent) error {
	// Only process our orders
	if event.StrategyID != s.ID() {
		return nil
	}

	s.logger.Info().
		Str("order_id", event.OrderID).
		Str("symbol", event.Symbol).
		Str("action", event.Action).
		Int("quantity", event.Quantity).
		Float64("filled_price", event.FilledPrice).
		Msg("Order filled for our strategy")

	// Update strategy state based on filled order
	// (In a real strategy, track positions, update P&L, etc.)

	return nil
}

// Helper methods

func (s *MovingAverageCrossoverStrategy) isSymbolTracked(symbol string) bool {
	for _, sym := range s.symbols {
		if sym == symbol {
			return true
		}
	}
	return false
}

func (s *MovingAverageCrossoverStrategy) addPrice(symbol string, price float64) {
	history := s.priceHistory[symbol]
	history = append(history, price)

	// Keep only the data we need
	if len(history) > s.longPeriod {
		history = history[1:]
	}

	s.priceHistory[symbol] = history
}

func (s *MovingAverageCrossoverStrategy) calculateMA(symbol string, period int) float64 {
	history := s.priceHistory[symbol]

	if len(history) < period {
		return 0.0
	}

	// Take the last 'period' prices
	recentPrices := history[len(history)-period:]

	// Calculate average
	sum := 0.0
	for _, price := range recentPrices {
		sum += price
	}

	return sum / float64(period)
}

func (s *MovingAverageCrossoverStrategy) detectCrossover(symbol string, shortMA, longMA, currentPrice float64) string {
	prevState := s.prevCrossState[symbol]

	var currentState string
	if shortMA > longMA {
		currentState = "ABOVE"
	} else if shortMA < longMA {
		currentState = "BELOW"
	} else {
		currentState = "NONE"
	}

	var signal string

	// Detect bullish crossover (short crosses above long)
	if prevState == "BELOW" && currentState == "ABOVE" {
		signal = "BUY"
		s.logger.Info().
			Str("symbol", symbol).
			Float64("short_ma", shortMA).
			Float64("long_ma", longMA).
			Float64("price", currentPrice).
			Msg("Bullish crossover detected")
	}

	// Detect bearish crossover (short crosses below long)
	if prevState == "ABOVE" && currentState == "BELOW" {
		signal = "SELL"
		s.logger.Info().
			Str("symbol", symbol).
			Float64("short_ma", shortMA).
			Float64("long_ma", longMA).
			Float64("price", currentPrice).
			Msg("Bearish crossover detected")
	}

	// Update state
	s.prevCrossState[symbol] = currentState

	return signal
}
