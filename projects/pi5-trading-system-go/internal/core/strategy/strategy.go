package strategy

import (
	"context"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/rs/zerolog"
)

// Strategy defines the interface all trading strategies must implement
type Strategy interface {
	// ID returns the unique identifier for this strategy
	ID() string

	// Name returns the human-readable name
	Name() string

	// Initialize prepares the strategy for trading
	Initialize(ctx context.Context) error

	// Start begins the strategy execution
	// It should start a goroutine to process market data events
	Start(ctx context.Context) error

	// Stop gracefully stops the strategy
	Stop(ctx context.Context) error

	// IsRunning returns true if the strategy is currently running
	IsRunning() bool

	// OnMarketData is called when new market data arrives
	// This is where the strategy analyzes data and generates signals
	OnMarketData(ctx context.Context, event *events.MarketDataEvent) error

	// OnOrderFilled is called when an order is filled
	OnOrderFilled(ctx context.Context, event *events.OrderFilledEvent) error
}

// BaseStrategy provides common functionality for all strategies
type BaseStrategy struct {
	id       string
	name     string
	symbols  []string
	running  bool
	eventBus *events.EventBus
	logger   zerolog.Logger

	// Channels for receiving events
	marketDataCh   <-chan events.Event
	orderFilledCh  <-chan events.Event
	stopCh         chan struct{}
}

// NewBaseStrategy creates a new base strategy
func NewBaseStrategy(id, name string, symbols []string, eventBus *events.EventBus, logger zerolog.Logger) *BaseStrategy {
	return &BaseStrategy{
		id:       id,
		name:     name,
		symbols:  symbols,
		running:  false,
		eventBus: eventBus,
		logger:   logger.With().Str("strategy_id", id).Str("strategy_name", name).Logger(),
		stopCh:   make(chan struct{}),
	}
}

// ID returns the strategy ID
func (bs *BaseStrategy) ID() string {
	return bs.id
}

// Name returns the strategy name
func (bs *BaseStrategy) Name() string {
	return bs.name
}

// Symbols returns the symbols this strategy trades
func (bs *BaseStrategy) Symbols() []string {
	return bs.symbols
}

// IsRunning returns whether the strategy is running
func (bs *BaseStrategy) IsRunning() bool {
	return bs.running
}

// EventBus returns the event bus
func (bs *BaseStrategy) EventBus() *events.EventBus {
	return bs.eventBus
}

// Logger returns the logger
func (bs *BaseStrategy) Logger() zerolog.Logger {
	return bs.logger
}

// Subscribe subscribes to events from the event bus
func (bs *BaseStrategy) Subscribe() {
	bs.marketDataCh = bs.eventBus.Subscribe(events.EventTypeMarketData)
	bs.orderFilledCh = bs.eventBus.Subscribe(events.EventTypeOrderFilled)

	bs.logger.Info().
		Int("market_data_subscribers", bs.eventBus.SubscriberCount(events.EventTypeMarketData)).
		Int("order_filled_subscribers", bs.eventBus.SubscriberCount(events.EventTypeOrderFilled)).
		Msg("Subscribed to events")
}

// SetRunning sets the running state
func (bs *BaseStrategy) SetRunning(running bool) {
	bs.running = running
}

// PublishSignal publishes a trading signal
func (bs *BaseStrategy) PublishSignal(ctx context.Context, signal *events.SignalEvent) {
	bs.eventBus.Publish(ctx, signal)

	bs.logger.Info().
		Str("symbol", signal.Symbol).
		Str("action", signal.Action).
		Float64("confidence", signal.Confidence).
		Str("reason", signal.Reason).
		Msg("Published trading signal")
}

// Stop stops the strategy
func (bs *BaseStrategy) Stop(ctx context.Context) error {
	bs.logger.Info().Msg("Stopping strategy")

	bs.running = false
	close(bs.stopCh)

	// Publish system status event
	statusEvent := events.NewSystemStatusEvent(
		bs.name,
		"STOPPED",
		"Strategy stopped",
	)
	bs.eventBus.Publish(ctx, statusEvent)

	return nil
}
