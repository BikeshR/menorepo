package data

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// OrdersRepository handles order data persistence
type OrdersRepository struct {
	db     *pgxpool.Pool
	logger zerolog.Logger
}

// NewOrdersRepository creates a new orders repository
func NewOrdersRepository(db *pgxpool.Pool, logger zerolog.Logger) *OrdersRepository {
	return &OrdersRepository{
		db:     db,
		logger: logger,
	}
}

// Order represents an order in the database
type Order struct {
	ID              string     `db:"id"`
	StrategyID      *string    `db:"strategy_id"`
	Symbol          string     `db:"symbol"`
	Side            string     `db:"side"`
	Type            string     `db:"type"`
	Quantity        float64    `db:"quantity"`
	LimitPrice      *float64   `db:"limit_price"`
	StopPrice       *float64   `db:"stop_price"`
	FilledQuantity  float64    `db:"filled_quantity"`
	AveragePrice    float64    `db:"average_price"`
	Status          string     `db:"status"`
	TimeInForce     string     `db:"time_in_force"`
	CreatedAt       time.Time  `db:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at"`
	FilledAt        *time.Time `db:"filled_at"`
	CancelledAt     *time.Time `db:"cancelled_at"`
	RejectionReason string     `db:"rejection_reason"`
}

// Trade represents a trade execution
type Trade struct {
	ID         string    `db:"id"`
	OrderID    string    `db:"order_id"`
	StrategyID *string   `db:"strategy_id"`
	Symbol     string    `db:"symbol"`
	Side       string    `db:"side"`
	Quantity   float64   `db:"quantity"`
	Price      float64   `db:"price"`
	Commission float64   `db:"commission"`
	PnL        float64   `db:"pnl"`
	ExecutedAt time.Time `db:"executed_at"`
}

// InitSchema initializes the orders and trades tables
func (r *OrdersRepository) InitSchema(ctx context.Context) error {
	schema := `
		CREATE TABLE IF NOT EXISTS orders (
			id VARCHAR(50) PRIMARY KEY,
			strategy_id VARCHAR(50),
			symbol VARCHAR(10) NOT NULL,
			side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
			type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
			quantity DECIMAL(20, 8) NOT NULL,
			limit_price DECIMAL(20, 8),
			stop_price DECIMAL(20, 8),
			filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
			average_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
			status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'open', 'filled', 'cancelled', 'rejected', 'partial')),
			time_in_force VARCHAR(10) NOT NULL CHECK (time_in_force IN ('day', 'gtc', 'ioc', 'fok')),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			filled_at TIMESTAMPTZ,
			cancelled_at TIMESTAMPTZ,
			rejection_reason TEXT
		);

		CREATE TABLE IF NOT EXISTS trades (
			id VARCHAR(50) PRIMARY KEY,
			order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
			strategy_id VARCHAR(50),
			symbol VARCHAR(10) NOT NULL,
			side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
			quantity DECIMAL(20, 8) NOT NULL,
			price DECIMAL(20, 8) NOT NULL,
			commission DECIMAL(20, 8) NOT NULL DEFAULT 0,
			pnl DECIMAL(20, 8) DEFAULT 0,
			executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
		CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
		CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_trades_order_id ON trades(order_id);
		CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at DESC);
	`

	_, err := r.db.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("failed to initialize orders schema: %w", err)
	}

	r.logger.Info().Msg("Orders schema initialized")
	return nil
}

// CreateOrder creates a new order
func (r *OrdersRepository) CreateOrder(ctx context.Context, order *Order) error {
	query := `
		INSERT INTO orders (id, strategy_id, symbol, side, type, quantity, limit_price, stop_price,
			filled_quantity, average_price, status, time_in_force, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err := r.db.Exec(ctx, query,
		order.ID, order.StrategyID, order.Symbol, order.Side, order.Type,
		order.Quantity, order.LimitPrice, order.StopPrice,
		order.FilledQuantity, order.AveragePrice, order.Status, order.TimeInForce,
		order.CreatedAt, order.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create order: %w", err)
	}

	r.logger.Info().Str("order_id", order.ID).Str("symbol", order.Symbol).Msg("Order created")
	return nil
}

// GetOrder retrieves an order by ID
func (r *OrdersRepository) GetOrder(ctx context.Context, orderID string) (*Order, error) {
	query := `
		SELECT id, strategy_id, symbol, side, type, quantity, limit_price, stop_price,
			filled_quantity, average_price, status, time_in_force, created_at, updated_at,
			filled_at, cancelled_at, rejection_reason
		FROM orders
		WHERE id = $1
	`

	var order Order
	err := r.db.QueryRow(ctx, query, orderID).Scan(
		&order.ID, &order.StrategyID, &order.Symbol, &order.Side, &order.Type,
		&order.Quantity, &order.LimitPrice, &order.StopPrice,
		&order.FilledQuantity, &order.AveragePrice, &order.Status, &order.TimeInForce,
		&order.CreatedAt, &order.UpdatedAt, &order.FilledAt, &order.CancelledAt, &order.RejectionReason,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	return &order, nil
}

// GetOrders retrieves orders with optional filters
func (r *OrdersRepository) GetOrders(ctx context.Context, symbol, status string, limit int) ([]Order, error) {
	query := `
		SELECT id, strategy_id, symbol, side, type, quantity, limit_price, stop_price,
			filled_quantity, average_price, status, time_in_force, created_at, updated_at,
			filled_at, cancelled_at, rejection_reason
		FROM orders
		WHERE ($1 = '' OR symbol = $1)
		  AND ($2 = '' OR status = $2)
		ORDER BY created_at DESC
		LIMIT $3
	`

	if limit == 0 {
		limit = 100
	}

	rows, err := r.db.Query(ctx, query, symbol, status, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query orders: %w", err)
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var order Order
		err := rows.Scan(
			&order.ID, &order.StrategyID, &order.Symbol, &order.Side, &order.Type,
			&order.Quantity, &order.LimitPrice, &order.StopPrice,
			&order.FilledQuantity, &order.AveragePrice, &order.Status, &order.TimeInForce,
			&order.CreatedAt, &order.UpdatedAt, &order.FilledAt, &order.CancelledAt, &order.RejectionReason,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan order: %w", err)
		}
		orders = append(orders, order)
	}

	return orders, rows.Err()
}

// UpdateOrderStatus updates the status of an order
func (r *OrdersRepository) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	query := `
		UPDATE orders
		SET status = $1, updated_at = $2
		WHERE id = $3
	`

	_, err := r.db.Exec(ctx, query, status, time.Now(), orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}

	return nil
}

// FillOrder marks an order as filled
func (r *OrdersRepository) FillOrder(ctx context.Context, orderID string, quantity, price float64) error {
	query := `
		UPDATE orders
		SET filled_quantity = filled_quantity + $1,
			average_price = CASE
				WHEN filled_quantity = 0 THEN $2
				ELSE (average_price * filled_quantity + $2 * $1) / (filled_quantity + $1)
			END,
			status = CASE
				WHEN filled_quantity + $1 >= quantity THEN 'filled'
				ELSE 'partial'
			END,
			filled_at = CASE
				WHEN filled_quantity + $1 >= quantity THEN $3
				ELSE filled_at
			END,
			updated_at = $3
		WHERE id = $4
	`

	_, err := r.db.Exec(ctx, query, quantity, price, time.Now(), orderID)
	if err != nil {
		return fmt.Errorf("failed to fill order: %w", err)
	}

	return nil
}

// CancelOrder marks an order as cancelled
func (r *OrdersRepository) CancelOrder(ctx context.Context, orderID, reason string) error {
	query := `
		UPDATE orders
		SET status = 'cancelled',
			cancelled_at = $1,
			rejection_reason = $2,
			updated_at = $1
		WHERE id = $3 AND status IN ('pending', 'open', 'partial')
	`

	result, err := r.db.Exec(ctx, query, time.Now(), reason, orderID)
	if err != nil {
		return fmt.Errorf("failed to cancel order: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("order not found or cannot be cancelled")
	}

	r.logger.Info().Str("order_id", orderID).Msg("Order cancelled")
	return nil
}

// CreateTrade creates a new trade record
func (r *OrdersRepository) CreateTrade(ctx context.Context, trade *Trade) error {
	query := `
		INSERT INTO trades (id, order_id, strategy_id, symbol, side, quantity, price, commission, pnl, executed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := r.db.Exec(ctx, query,
		trade.ID, trade.OrderID, trade.StrategyID, trade.Symbol, trade.Side,
		trade.Quantity, trade.Price, trade.Commission, trade.PnL, trade.ExecutedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create trade: %w", err)
	}

	r.logger.Info().Str("trade_id", trade.ID).Str("order_id", trade.OrderID).Msg("Trade created")
	return nil
}

// GetTrades retrieves trades with optional filters
func (r *OrdersRepository) GetTrades(ctx context.Context, symbol string, limit int) ([]Trade, error) {
	query := `
		SELECT id, order_id, strategy_id, symbol, side, quantity, price, commission, pnl, executed_at
		FROM trades
		WHERE ($1 = '' OR symbol = $1)
		ORDER BY executed_at DESC
		LIMIT $2
	`

	if limit == 0 {
		limit = 100
	}

	rows, err := r.db.Query(ctx, query, symbol, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query trades: %w", err)
	}
	defer rows.Close()

	var trades []Trade
	for rows.Next() {
		var trade Trade
		err := rows.Scan(
			&trade.ID, &trade.OrderID, &trade.StrategyID, &trade.Symbol, &trade.Side,
			&trade.Quantity, &trade.Price, &trade.Commission, &trade.PnL, &trade.ExecutedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan trade: %w", err)
		}
		trades = append(trades, trade)
	}

	return trades, rows.Err()
}

// GetTradesByOrder retrieves all trades for a specific order
func (r *OrdersRepository) GetTradesByOrder(ctx context.Context, orderID string) ([]Trade, error) {
	query := `
		SELECT id, order_id, strategy_id, symbol, side, quantity, price, commission, pnl, executed_at
		FROM trades
		WHERE order_id = $1
		ORDER BY executed_at ASC
	`

	rows, err := r.db.Query(ctx, query, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to query trades by order: %w", err)
	}
	defer rows.Close()

	var trades []Trade
	for rows.Next() {
		var trade Trade
		err := rows.Scan(
			&trade.ID, &trade.OrderID, &trade.StrategyID, &trade.Symbol, &trade.Side,
			&trade.Quantity, &trade.Price, &trade.Commission, &trade.PnL, &trade.ExecutedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan trade: %w", err)
		}
		trades = append(trades, trade)
	}

	return trades, rows.Err()
}
