package execution

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/audit"
	"github.com/bikeshrana/pi5-trading-system-go/internal/circuitbreaker"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/risk"
	"github.com/bikeshrana/pi5-trading-system-go/internal/data"
)

// OrderType represents the type of order
type OrderType string

const (
	OrderTypeMarket OrderType = "market"
	OrderTypeLimit  OrderType = "limit"
	OrderTypeStop   OrderType = "stop"
)

// OrderStatus represents the status of an order
type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusSubmitted OrderStatus = "submitted"
	OrderStatusPartial   OrderStatus = "partial"
	OrderStatusFilled    OrderStatus = "filled"
	OrderStatusCancelled OrderStatus = "cancelled"
	OrderStatusRejected  OrderStatus = "rejected"
)

// ExecutionEngine handles order execution and fills
type ExecutionEngine struct {
	logger        zerolog.Logger
	eventBus      *events.EventBus
	ordersRepo    *data.OrdersRepository
	portfolioRepo *data.PortfolioRepository
	riskManager   *risk.RiskManager
	auditLogger   *audit.AuditLogger
	cbManager     *circuitbreaker.Manager
	demoMode      bool
	paperTrading  bool

	// Market data cache for execution
	marketDataMu sync.RWMutex
	marketData   map[string]*MarketPrice

	// Pending orders
	pendingOrdersMu sync.RWMutex
	pendingOrders   map[string]*PendingOrder

	// Execution metrics
	metricsLock     sync.RWMutex
	totalExecutions int64
	totalRejections int64
	totalVolume     float64
}

// MarketPrice represents the current market price for a symbol
type MarketPrice struct {
	Symbol    string
	Bid       float64
	Ask       float64
	Last      float64
	Timestamp time.Time
}

// PendingOrder represents an order waiting to be filled
type PendingOrder struct {
	OrderID      string
	Symbol       string
	Action       string // "BUY" or "SELL"
	Quantity     int
	OrderType    OrderType
	LimitPrice   float64
	StopPrice    float64
	FilledQty    int
	AvgFillPrice float64
	Status       OrderStatus
	SubmittedAt  time.Time
}

// NewExecutionEngine creates a new order execution engine
func NewExecutionEngine(
	eventBus *events.EventBus,
	ordersRepo *data.OrdersRepository,
	portfolioRepo *data.PortfolioRepository,
	riskManager *risk.RiskManager,
	auditLogger *audit.AuditLogger,
	cbManager *circuitbreaker.Manager,
	demoMode bool,
	paperTrading bool,
	logger zerolog.Logger,
) *ExecutionEngine {
	return &ExecutionEngine{
		logger:        logger,
		eventBus:      eventBus,
		ordersRepo:    ordersRepo,
		portfolioRepo: portfolioRepo,
		riskManager:   riskManager,
		auditLogger:   auditLogger,
		cbManager:     cbManager,
		demoMode:      demoMode,
		paperTrading:  paperTrading,
		marketData:    make(map[string]*MarketPrice),
		pendingOrders: make(map[string]*PendingOrder),
	}
}

// Start starts the execution engine
func (e *ExecutionEngine) Start(ctx context.Context) error {
	e.logger.Info().
		Bool("demo_mode", e.demoMode).
		Bool("paper_trading", e.paperTrading).
		Msg("Starting execution engine")

	// Subscribe to market data events
	marketDataCh := e.eventBus.Subscribe(events.EventTypeMarketData)

	// Subscribe to order events
	orderCh := e.eventBus.Subscribe(events.EventTypeOrder)

	// Start processing events
	go e.processEvents(ctx, marketDataCh, orderCh)

	// Start order matching engine
	go e.matchOrders(ctx)

	return nil
}

// Stop stops the execution engine
func (e *ExecutionEngine) Stop(ctx context.Context) error {
	e.logger.Info().Msg("Stopping execution engine")
	return nil
}

// processEvents processes incoming events
func (e *ExecutionEngine) processEvents(ctx context.Context, marketDataCh, orderCh <-chan events.Event) {
	for {
		select {
		case event := <-marketDataCh:
			if mdEvent, ok := event.(*events.MarketDataEvent); ok {
				e.updateMarketData(mdEvent)
			}

		case event := <-orderCh:
			if orderEvent, ok := event.(*events.OrderEvent); ok {
				e.handleOrderEvent(ctx, orderEvent)
			}

		case <-ctx.Done():
			e.logger.Info().Msg("Execution engine event processor stopped")
			return
		}
	}
}

// updateMarketData updates the market data cache
func (e *ExecutionEngine) updateMarketData(event *events.MarketDataEvent) {
	e.marketDataMu.Lock()
	defer e.marketDataMu.Unlock()

	// Calculate bid/ask spread (simplified)
	spread := event.Close * 0.001 // 0.1% spread
	bid := event.Close - spread/2
	ask := event.Close + spread/2

	e.marketData[event.Symbol] = &MarketPrice{
		Symbol:    event.Symbol,
		Bid:       bid,
		Ask:       ask,
		Last:      event.Close,
		Timestamp: event.DataTimestamp,
	}

	e.logger.Debug().
		Str("symbol", event.Symbol).
		Float64("bid", bid).
		Float64("ask", ask).
		Float64("last", event.Close).
		Msg("Updated market data")
}

// handleOrderEvent handles incoming order events
func (e *ExecutionEngine) handleOrderEvent(ctx context.Context, event *events.OrderEvent) {
	e.logger.Info().
		Str("order_id", event.OrderID).
		Str("symbol", event.Symbol).
		Str("action", event.Action).
		Int("quantity", event.Quantity).
		Str("status", event.Status).
		Msg("Received order event")

	// Parse order type
	orderType := OrderTypeMarket
	if event.OrderType != "" {
		orderType = OrderType(event.OrderType)
	}

	// Get current market price for risk validation
	var currentPrice float64
	if event.Price > 0 {
		currentPrice = event.Price
	} else if event.LimitPrice > 0 {
		currentPrice = event.LimitPrice
	} else {
		// Try to get from market data
		e.marketDataMu.RLock()
		if marketPrice, exists := e.marketData[event.Symbol]; exists {
			if event.Action == "BUY" {
				currentPrice = marketPrice.Ask
			} else {
				currentPrice = marketPrice.Bid
			}
		}
		e.marketDataMu.RUnlock()
	}

	// Validate order through risk manager
	if e.riskManager != nil {
		orderRequest := &risk.OrderRequest{
			Symbol:    event.Symbol,
			Action:    event.Action,
			Quantity:  event.Quantity,
			Price:     currentPrice,
			OrderType: event.OrderType,
		}

		riskResult, err := e.riskManager.ValidateOrder(ctx, orderRequest)
		if err != nil {
			e.logger.Error().
				Err(err).
				Str("order_id", event.OrderID).
				Msg("Risk validation error")
			e.rejectOrder(ctx, event.OrderID, "Risk validation error")
			return
		}

		if !riskResult.Approved {
			e.logger.Warn().
				Str("order_id", event.OrderID).
				Strs("rejections", riskResult.Rejections).
				Msg("Order rejected by risk manager")
			e.rejectOrder(ctx, event.OrderID, fmt.Sprintf("Risk check failed: %v", riskResult.Rejections))
			return
		}

		// Record order for daily tracking
		e.riskManager.RecordOrder(orderRequest)

		// Log warnings if any
		if len(riskResult.Warnings) > 0 {
			e.logger.Info().
				Str("order_id", event.OrderID).
				Strs("warnings", riskResult.Warnings).
				Float64("risk_score", riskResult.RiskScore).
				Msg("Order approved with warnings")
		}
	}

	// Create pending order
	pendingOrder := &PendingOrder{
		OrderID:     event.OrderID,
		Symbol:      event.Symbol,
		Action:      event.Action,
		Quantity:    event.Quantity,
		OrderType:   orderType,
		LimitPrice:  event.LimitPrice,
		StopPrice:   0, // TODO: Add stop price to OrderEvent
		FilledQty:   0,
		Status:      OrderStatusSubmitted,
		SubmittedAt: time.Now(),
	}

	// Store pending order
	e.pendingOrdersMu.Lock()
	e.pendingOrders[event.OrderID] = pendingOrder
	e.pendingOrdersMu.Unlock()

	// For market orders, try immediate execution
	if orderType == OrderTypeMarket {
		e.tryExecuteMarketOrder(ctx, pendingOrder)
	}
}

// rejectOrder rejects an order and updates the database
func (e *ExecutionEngine) rejectOrder(ctx context.Context, orderID, reason string) {
	// Update metrics
	e.metricsLock.Lock()
	e.totalRejections++
	e.metricsLock.Unlock()

	// Update order status in database with circuit breaker
	dbBreaker := e.cbManager.GetOrCreate("db_orders", circuitbreaker.DefaultDatabaseConfig())
	err := dbBreaker.Execute(func() error {
		return e.ordersRepo.UpdateOrderStatus(ctx, orderID, "REJECTED")
	})
	if err != nil {
		e.logger.Error().
			Err(err).
			Str("order_id", orderID).
			Msg("Failed to update rejected order status")
	}

	// Audit log order rejection (non-critical, no circuit breaker)
	if e.auditLogger != nil {
		e.auditLogger.LogOrderRejected(ctx, orderID, "", "", reason, map[string]interface{}{
			"rejection_reason": reason,
		})
	}

	// Publish rejection event
	// TODO: Create OrderRejectedEvent type
	e.logger.Info().
		Str("order_id", orderID).
		Str("reason", reason).
		Msg("Order rejected")
}

// tryExecuteMarketOrder attempts to execute a market order immediately
func (e *ExecutionEngine) tryExecuteMarketOrder(ctx context.Context, order *PendingOrder) {
	e.marketDataMu.RLock()
	marketPrice, exists := e.marketData[order.Symbol]
	e.marketDataMu.RUnlock()

	if !exists {
		e.logger.Warn().
			Str("order_id", order.OrderID).
			Str("symbol", order.Symbol).
			Msg("No market data available for symbol, order pending")
		return
	}

	// Determine execution price
	var executionPrice float64
	if order.Action == "BUY" {
		executionPrice = marketPrice.Ask
	} else {
		executionPrice = marketPrice.Bid
	}

	// Add slippage in demo mode (0.05%)
	if e.demoMode {
		slippage := executionPrice * 0.0005
		if order.Action == "BUY" {
			executionPrice += slippage
		} else {
			executionPrice -= slippage
		}
	}

	// Execute the order
	e.executeOrder(ctx, order, executionPrice, order.Quantity)
}

// matchOrders continuously matches pending limit orders
func (e *ExecutionEngine) matchOrders(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			e.checkLimitOrders(ctx)

		case <-ctx.Done():
			e.logger.Info().Msg("Order matching engine stopped")
			return
		}
	}
}

// checkLimitOrders checks if any limit orders can be filled
func (e *ExecutionEngine) checkLimitOrders(ctx context.Context) {
	e.pendingOrdersMu.RLock()
	orders := make([]*PendingOrder, 0, len(e.pendingOrders))
	for _, order := range e.pendingOrders {
		if order.OrderType == OrderTypeLimit && order.Status == OrderStatusSubmitted {
			orders = append(orders, order)
		}
	}
	e.pendingOrdersMu.RUnlock()

	for _, order := range orders {
		e.tryExecuteLimitOrder(ctx, order)
	}
}

// tryExecuteLimitOrder attempts to execute a limit order
func (e *ExecutionEngine) tryExecuteLimitOrder(ctx context.Context, order *PendingOrder) {
	e.marketDataMu.RLock()
	marketPrice, exists := e.marketData[order.Symbol]
	e.marketDataMu.RUnlock()

	if !exists {
		return
	}

	// Check if limit price is met
	canExecute := false
	var executionPrice float64

	if order.Action == "BUY" {
		// Buy limit: execute if ask <= limit price
		if marketPrice.Ask <= order.LimitPrice {
			canExecute = true
			executionPrice = order.LimitPrice // Get filled at limit price or better
		}
	} else {
		// Sell limit: execute if bid >= limit price
		if marketPrice.Bid >= order.LimitPrice {
			canExecute = true
			executionPrice = order.LimitPrice
		}
	}

	if canExecute {
		e.executeOrder(ctx, order, executionPrice, order.Quantity-order.FilledQty)
	}
}

// executeOrder executes an order (full or partial fill)
func (e *ExecutionEngine) executeOrder(ctx context.Context, order *PendingOrder, price float64, quantity int) {
	e.logger.Info().
		Str("order_id", order.OrderID).
		Str("symbol", order.Symbol).
		Str("action", order.Action).
		Int("quantity", quantity).
		Float64("price", price).
		Msg("Executing order")

	// Update order fill info
	order.FilledQty += quantity
	totalFillValue := order.AvgFillPrice*float64(order.FilledQty-quantity) + price*float64(quantity)
	order.AvgFillPrice = totalFillValue / float64(order.FilledQty)

	// Determine new status
	if order.FilledQty >= order.Quantity {
		order.Status = OrderStatusFilled
	} else {
		order.Status = OrderStatusPartial
	}

	// Update database with circuit breaker
	dbBreaker := e.cbManager.GetOrCreate("db_orders", circuitbreaker.DefaultDatabaseConfig())
	if err := dbBreaker.Execute(func() error {
		return e.ordersRepo.FillOrder(ctx, order.OrderID, float64(quantity), price)
	}); err != nil {
		e.logger.Error().
			Err(err).
			Str("order_id", order.OrderID).
			Msg("Failed to update order in database")
	}

	// Create trade record with circuit breaker
	trade := &data.Trade{
		ID:         uuid.New().String(),
		OrderID:    order.OrderID,
		StrategyID: nil, // Will be set from order if needed
		Symbol:     order.Symbol,
		Side:       order.Action,
		Quantity:   float64(quantity),
		Price:      price,
		Commission: 0, // Can be calculated based on quantity and price
		PnL:        0, // Will be calculated when position is closed
		ExecutedAt: time.Now(),
	}
	if err := dbBreaker.Execute(func() error {
		return e.ordersRepo.CreateTrade(ctx, trade)
	}); err != nil {
		e.logger.Error().
			Err(err).
			Str("order_id", order.OrderID).
			Msg("Failed to create trade record")
	}

	// Audit log trade execution
	if e.auditLogger != nil {
		e.auditLogger.LogTradeExecuted(ctx, trade.ID, order.OrderID, order.Symbol, order.Action, float64(quantity), price, 0)
	}

	// Audit log order fill
	if e.auditLogger != nil {
		e.auditLogger.LogOrderFilled(ctx, order.OrderID, order.Symbol, order.Action, quantity, price)
	}

	// Update portfolio position
	if err := e.updatePortfolioPosition(ctx, order.Symbol, order.Action, quantity, price); err != nil {
		e.logger.Error().
			Err(err).
			Str("order_id", order.OrderID).
			Msg("Failed to update portfolio position")
	}

	// Publish order filled event
	fillEvent := events.NewOrderFilledEvent(
		order.OrderID,
		"", // Strategy ID if available
		order.Symbol,
		order.Action,
		order.Quantity,
		float64(quantity),
		price,
		0, // Commission
		time.Now(),
	)
	e.eventBus.Publish(ctx, fillEvent)

	// Update metrics
	e.metricsLock.Lock()
	e.totalExecutions++
	e.totalVolume += price * float64(quantity)
	e.metricsLock.Unlock()

	// If fully filled, remove from pending orders
	if order.Status == OrderStatusFilled {
		e.pendingOrdersMu.Lock()
		delete(e.pendingOrders, order.OrderID)
		e.pendingOrdersMu.Unlock()

		e.logger.Info().
			Str("order_id", order.OrderID).
			Float64("avg_price", order.AvgFillPrice).
			Msg("Order fully filled")
	}
}

// updatePortfolioPosition updates the portfolio position after an order fill
func (e *ExecutionEngine) updatePortfolioPosition(ctx context.Context, symbol, action string, quantity int, price float64) error {
	portfolioBreaker := e.cbManager.GetOrCreate("db_portfolio", circuitbreaker.DefaultDatabaseConfig())

	var position *data.Position
	var getErr error

	// Get current position with circuit breaker
	err := portfolioBreaker.Execute(func() error {
		position, getErr = e.portfolioRepo.GetPosition(ctx, symbol)
		return getErr
	})

	if err != nil || getErr != nil {
		// Position doesn't exist, create new one
		position = &data.Position{
			Symbol:       symbol,
			Quantity:     0,
			AveragePrice: 0,
			CurrentPrice: price,
			Side:         "LONG",
			OpenedAt:     time.Now(),
			LastUpdated:  time.Now(),
		}
	}

	// Calculate new position
	if action == "BUY" {
		// Buying increases position
		newQty := position.Quantity + float64(quantity)
		newAvgPrice := (position.AveragePrice*position.Quantity + price*float64(quantity)) / newQty
		position.Quantity = newQty
		position.AveragePrice = newAvgPrice
		position.Side = "LONG"
	} else {
		// Selling decreases position
		position.Quantity -= float64(quantity)
		if position.Quantity < 0 {
			e.logger.Warn().
				Str("symbol", symbol).
				Float64("quantity", position.Quantity).
				Msg("Position went negative (short position)")
			position.Side = "SHORT"
		}
	}

	// Update market value
	position.CurrentPrice = price
	position.LastUpdated = time.Now()

	// Upsert position with circuit breaker
	if err := portfolioBreaker.Execute(func() error {
		return e.portfolioRepo.UpsertPosition(ctx, position)
	}); err != nil {
		return fmt.Errorf("failed to upsert position: %w", err)
	}

	return nil
}

// GetMetrics returns execution metrics
func (e *ExecutionEngine) GetMetrics() map[string]interface{} {
	e.metricsLock.RLock()
	defer e.metricsLock.RUnlock()

	e.pendingOrdersMu.RLock()
	pendingCount := len(e.pendingOrders)
	e.pendingOrdersMu.RUnlock()

	return map[string]interface{}{
		"total_executions": e.totalExecutions,
		"total_rejections": e.totalRejections,
		"total_volume":     e.totalVolume,
		"pending_orders":   pendingCount,
	}
}
