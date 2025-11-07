package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/data"
)

// OrdersHandler handles order-related requests
type OrdersHandler struct {
	repo     *data.OrdersRepository
	eventBus *events.EventBus
	logger   zerolog.Logger
}

// NewOrdersHandler creates a new orders handler
func NewOrdersHandler(repo *data.OrdersRepository, eventBus *events.EventBus, logger zerolog.Logger) *OrdersHandler {
	return &OrdersHandler{
		repo:     repo,
		eventBus: eventBus,
		logger:   logger,
	}
}

// Order represents a trading order
type Order struct {
	ID              string    `json:"id"`
	StrategyID      string    `json:"strategy_id,omitempty"`
	Symbol          string    `json:"symbol"`
	Side            string    `json:"side"` // buy/sell
	Type            string    `json:"type"` // market/limit/stop/stop_limit
	Quantity        float64   `json:"quantity"`
	LimitPrice      *float64  `json:"limit_price,omitempty"`
	StopPrice       *float64  `json:"stop_price,omitempty"`
	FilledQuantity  float64   `json:"filled_quantity"`
	AveragePrice    float64   `json:"average_price"`
	Status          string    `json:"status"` // pending/open/filled/cancelled/rejected
	TimeInForce     string    `json:"time_in_force"` // day/gtc/ioc/fok
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	FilledAt        *time.Time `json:"filled_at,omitempty"`
	CancelledAt     *time.Time `json:"cancelled_at,omitempty"`
	RejectionReason string    `json:"rejection_reason,omitempty"`
}

// Trade represents a trade execution
type Trade struct {
	ID         string    `json:"id"`
	OrderID    string    `json:"order_id"`
	StrategyID string    `json:"strategy_id,omitempty"`
	Symbol     string    `json:"symbol"`
	Side       string    `json:"side"`
	Quantity   float64   `json:"quantity"`
	Price      float64   `json:"price"`
	Commission float64   `json:"commission"`
	PnL        float64   `json:"pnl,omitempty"`
	ExecutedAt time.Time `json:"executed_at"`
}

// GetOrders returns list of orders with optional filters
func (h *OrdersHandler) GetOrders(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	statusFilter := r.URL.Query().Get("status_filter")
	symbol := r.URL.Query().Get("symbol")

	h.logger.Info().
		Str("status_filter", statusFilter).
		Str("symbol", symbol).
		Msg("Getting orders")

	// TODO: Get from database with filters
	now := time.Now()
	filledTime := now.Add(-1 * time.Hour)

	orders := []Order{
		{
			ID:             "order-1",
			StrategyID:     "strategy-1",
			Symbol:         "AAPL",
			Side:           "buy",
			Type:           "market",
			Quantity:       100,
			FilledQuantity: 100,
			AveragePrice:   175.50,
			Status:         "filled",
			TimeInForce:    "day",
			CreatedAt:      now.Add(-2 * time.Hour),
			UpdatedAt:      now.Add(-1 * time.Hour),
			FilledAt:       &filledTime,
		},
		{
			ID:             "order-2",
			StrategyID:     "strategy-1",
			Symbol:         "MSFT",
			Side:           "buy",
			Type:           "limit",
			Quantity:       50,
			LimitPrice:     floatPtr(350.00),
			FilledQuantity: 0,
			Status:         "open",
			TimeInForce:    "gtc",
			CreatedAt:      now.Add(-30 * time.Minute),
			UpdatedAt:      now.Add(-30 * time.Minute),
		},
	}

	writeJSON(w, http.StatusOK, orders)
}

// GetOrder returns a specific order by ID
func (h *OrdersHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderId")
	if orderID == "" {
		writeError(w, http.StatusBadRequest, "Order ID required")
		return
	}

	// TODO: Get from database
	now := time.Now()
	filledTime := now.Add(-1 * time.Hour)

	order := Order{
		ID:             orderID,
		StrategyID:     "strategy-1",
		Symbol:         "AAPL",
		Side:           "buy",
		Type:           "market",
		Quantity:       100,
		FilledQuantity: 100,
		AveragePrice:   175.50,
		Status:         "filled",
		TimeInForce:    "day",
		CreatedAt:      now.Add(-2 * time.Hour),
		UpdatedAt:      now.Add(-1 * time.Hour),
		FilledAt:       &filledTime,
	}

	writeJSON(w, http.StatusOK, order)
}

// CreateOrder creates a new order
func (h *OrdersHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req Order
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate order
	if req.Symbol == "" {
		writeError(w, http.StatusBadRequest, "Symbol required")
		return
	}
	if req.Side == "" {
		writeError(w, http.StatusBadRequest, "Side required")
		return
	}
	if req.Quantity <= 0 {
		writeError(w, http.StatusBadRequest, "Quantity must be positive")
		return
	}

	// TODO: Submit order to execution engine
	now := time.Now()
	order := Order{
		ID:             "order-" + now.Format("20060102150405"),
		StrategyID:     req.StrategyID,
		Symbol:         req.Symbol,
		Side:           req.Side,
		Type:           req.Type,
		Quantity:       req.Quantity,
		LimitPrice:     req.LimitPrice,
		StopPrice:      req.StopPrice,
		FilledQuantity: 0,
		Status:         "pending",
		TimeInForce:    req.TimeInForce,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	h.logger.Info().
		Str("order_id", order.ID).
		Str("symbol", order.Symbol).
		Str("side", order.Side).
		Float64("quantity", order.Quantity).
		Msg("Order created")

	writeJSON(w, http.StatusCreated, order)
}

// CancelOrder cancels an order
func (h *OrdersHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderId")
	if orderID == "" {
		writeError(w, http.StatusBadRequest, "Order ID required")
		return
	}

	// TODO: Cancel order in execution engine
	h.logger.Info().
		Str("order_id", orderID).
		Msg("Order cancelled")

	writeJSON(w, http.StatusOK, map[string]string{"message": "Order cancelled successfully"})
}

// GetTrades returns list of trades
func (h *OrdersHandler) GetTrades(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	symbol := r.URL.Query().Get("symbol")

	h.logger.Info().
		Str("symbol", symbol).
		Msg("Getting trades")

	// TODO: Get from database with filters
	trades := []Trade{
		{
			ID:         "trade-1",
			OrderID:    "order-1",
			StrategyID: "strategy-1",
			Symbol:     "AAPL",
			Side:       "buy",
			Quantity:   100,
			Price:      175.50,
			Commission: 1.00,
			ExecutedAt: time.Now().Add(-1 * time.Hour),
		},
		{
			ID:         "trade-2",
			OrderID:    "order-3",
			StrategyID: "strategy-1",
			Symbol:     "AAPL",
			Side:       "sell",
			Quantity:   100,
			Price:      180.00,
			Commission: 1.00,
			PnL:        449.00, // (180.00 - 175.50) * 100 - 2.00 commission
			ExecutedAt: time.Now().Add(-30 * time.Minute),
		},
	}

	writeJSON(w, http.StatusOK, trades)
}

// Helper function to create float pointer
func floatPtr(f float64) *float64 {
	return &f
}
