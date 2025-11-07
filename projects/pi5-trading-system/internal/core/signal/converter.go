package signal

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/audit"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/risk"
)

// SignalToOrderConverter converts trading signals to orders
// This component enables autonomous trading by listening to strategy signals
// and automatically creating orders when signals are generated
type SignalToOrderConverter struct {
	logger      zerolog.Logger
	eventBus    *events.EventBus
	riskManager *risk.RiskManager
	auditLogger *audit.AuditLogger
	enabled     bool
	minConfidence float64 // Minimum confidence threshold to place orders
}

// Config holds configuration for the signal converter
type Config struct {
	Enabled       bool    // Enable/disable automatic order placement
	MinConfidence float64 // Only place orders for signals with confidence >= this value
}

// NewSignalToOrderConverter creates a new signal-to-order converter
func NewSignalToOrderConverter(
	eventBus *events.EventBus,
	riskManager *risk.RiskManager,
	auditLogger *audit.AuditLogger,
	cfg Config,
	logger zerolog.Logger,
) *SignalToOrderConverter {
	return &SignalToOrderConverter{
		logger:        logger,
		eventBus:      eventBus,
		riskManager:   riskManager,
		auditLogger:   auditLogger,
		enabled:       cfg.Enabled,
		minConfidence: cfg.MinConfidence,
	}
}

// Start begins processing signals and converting them to orders
func (s *SignalToOrderConverter) Start(ctx context.Context) error {
	if !s.enabled {
		s.logger.Info().Msg("Signal-to-order converter is disabled (manual trading mode)")
		return nil
	}

	s.logger.Info().
		Float64("min_confidence", s.minConfidence).
		Msg("Starting signal-to-order converter (autonomous trading enabled)")

	// Subscribe to signal events
	signalCh := s.eventBus.Subscribe(events.EventTypeSignal)

	// Start processing signals
	go s.processSignals(ctx, signalCh)

	return nil
}

// Stop stops the converter
func (s *SignalToOrderConverter) Stop(ctx context.Context) error {
	s.logger.Info().Msg("Stopping signal-to-order converter")
	return nil
}

// processSignals processes incoming trading signals
func (s *SignalToOrderConverter) processSignals(ctx context.Context, signalCh <-chan events.Event) {
	for {
		select {
		case <-ctx.Done():
			return

		case event := <-signalCh:
			signalEvent, ok := event.(*events.SignalEvent)
			if !ok {
				s.logger.Error().Msg("Invalid signal event type")
				continue
			}

			// Process the signal
			if err := s.handleSignal(ctx, signalEvent); err != nil {
				s.logger.Error().
					Err(err).
					Str("strategy_id", signalEvent.StrategyID).
					Str("symbol", signalEvent.Symbol).
					Str("action", signalEvent.Action).
					Msg("Failed to process signal")
			}
		}
	}
}

// handleSignal converts a signal to an order and publishes it
func (s *SignalToOrderConverter) handleSignal(ctx context.Context, signal *events.SignalEvent) error {
	// Skip HOLD signals
	if signal.Action == "HOLD" {
		s.logger.Debug().
			Str("strategy_id", signal.StrategyID).
			Str("symbol", signal.Symbol).
			Msg("Skipping HOLD signal")
		return nil
	}

	// Check confidence threshold
	if signal.Confidence < s.minConfidence {
		s.logger.Debug().
			Str("strategy_id", signal.StrategyID).
			Str("symbol", signal.Symbol).
			Float64("confidence", signal.Confidence).
			Float64("min_confidence", s.minConfidence).
			Msg("Signal confidence below threshold, skipping")
		return nil
	}

	// Validate signal action
	if signal.Action != "BUY" && signal.Action != "SELL" {
		s.logger.Warn().
			Str("action", signal.Action).
			Msg("Invalid signal action, must be BUY or SELL")
		return fmt.Errorf("invalid signal action: %s", signal.Action)
	}

	// Validate signal quantity
	if signal.Quantity <= 0 {
		s.logger.Warn().
			Int("quantity", signal.Quantity).
			Msg("Invalid signal quantity, must be > 0")
		return fmt.Errorf("invalid signal quantity: %d", signal.Quantity)
	}

	// Create order ID
	orderID := uuid.New().String()

	// Determine order type based on price
	orderType := "MARKET"
	limitPrice := 0.0

	if signal.Price > 0 {
		// Signal specified a price, use limit order
		orderType = "LIMIT"
		limitPrice = signal.Price
	}

	// Check risk limits before creating order
	if s.riskManager != nil {
		orderReq := &risk.OrderRequest{
			Symbol:    signal.Symbol,
			Action:    signal.Action,
			Quantity:  signal.Quantity,
			Price:     signal.Price,
			OrderType: orderType,
		}

		riskResult, err := s.riskManager.ValidateOrder(ctx, orderReq)
		if err != nil || !riskResult.Approved {
			s.logger.Warn().
				Err(err).
				Str("strategy_id", signal.StrategyID).
				Str("symbol", signal.Symbol).
				Str("action", signal.Action).
				Int("quantity", signal.Quantity).
				Msg("Order rejected by risk manager")

			// Audit the rejection
			if s.auditLogger != nil {
				auditEvent := &audit.AuditEvent{
					EventType: audit.EventTypeOrderCreated,
					Resource:  fmt.Sprintf("signal:%s", signal.StrategyID),
					Action:    "order_rejected",
					Status:    "failure",
					Details: map[string]interface{}{
						"strategy_id": signal.StrategyID,
						"symbol":      signal.Symbol,
						"action":      signal.Action,
						"quantity":    signal.Quantity,
						"reason":      riskResult.Reason,
					},
				}
				_ = s.auditLogger.LogEvent(ctx, auditEvent)
			}

			return fmt.Errorf("risk check failed: %s", riskResult.Reason)
		}
	}

	// Create order event
	orderEvent := events.NewOrderEvent(
		orderID,
		signal.StrategyID,
		signal.Symbol,
		signal.Action,
		signal.Quantity,
		limitPrice,
		orderType,
		"PENDING",
	)

	// Publish order event to event bus
	s.eventBus.Publish(ctx, orderEvent)

	// Log and audit the conversion
	s.logger.Info().
		Str("order_id", orderID).
		Str("strategy_id", signal.StrategyID).
		Str("symbol", signal.Symbol).
		Str("action", signal.Action).
		Int("quantity", signal.Quantity).
		Str("order_type", orderType).
		Float64("confidence", signal.Confidence).
		Str("reason", signal.Reason).
		Msg("Converted signal to order")

	if s.auditLogger != nil {
		auditEvent := &audit.AuditEvent{
			EventType: audit.EventTypeOrderCreated,
			Resource:  fmt.Sprintf("order:%s", orderID),
			Action:    "order_created",
			Status:    "success",
			Details: map[string]interface{}{
				"order_id":    orderID,
				"strategy_id": signal.StrategyID,
				"symbol":      signal.Symbol,
				"action":      signal.Action,
				"quantity":    signal.Quantity,
				"order_type":  orderType,
				"limit_price": limitPrice,
				"confidence":  signal.Confidence,
				"reason":      signal.Reason,
			},
		}
		_ = s.auditLogger.LogEvent(ctx, auditEvent)
	}

	return nil
}

// SetEnabled enables or disables the converter at runtime
func (s *SignalToOrderConverter) SetEnabled(enabled bool) {
	s.enabled = enabled
	s.logger.Info().Bool("enabled", enabled).Msg("Signal-to-order converter enabled status changed")
}

// SetMinConfidence updates the minimum confidence threshold
func (s *SignalToOrderConverter) SetMinConfidence(minConfidence float64) {
	s.minConfidence = minConfidence
	s.logger.Info().Float64("min_confidence", minConfidence).Msg("Signal-to-order converter confidence threshold updated")
}

// GetConfig returns the current configuration
func (s *SignalToOrderConverter) GetConfig() Config {
	return Config{
		Enabled:       s.enabled,
		MinConfidence: s.minConfidence,
	}
}
