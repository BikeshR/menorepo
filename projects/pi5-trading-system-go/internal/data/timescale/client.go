package timescale

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/config"
	"github.com/bikeshrana/pi5-trading-system-go/pkg/types"
)

// Client wraps a PostgreSQL/TimescaleDB connection pool
type Client struct {
	pool   *pgxpool.Pool
	logger zerolog.Logger
}

// NewClient creates a new TimescaleDB client with connection pooling
func NewClient(ctx context.Context, cfg *config.DatabaseConfig, logger zerolog.Logger) (*Client, error) {
	// Create connection pool configuration
	poolConfig, err := pgxpool.ParseConfig(cfg.ConnectionString())
	if err != nil {
		return nil, fmt.Errorf("failed to parse connection string: %w", err)
	}

	// Configure pool settings
	poolConfig.MaxConns = int32(cfg.MaxConns)
	poolConfig.MinConns = int32(cfg.MinConns)
	poolConfig.MaxConnLifetime = cfg.MaxConnLife

	logger.Info().
		Str("host", cfg.Host).
		Int("port", cfg.Port).
		Str("database", cfg.Database).
		Int("max_conns", cfg.MaxConns).
		Msg("Connecting to TimescaleDB")

	// Create the connection pool
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	logger.Info().Msg("Successfully connected to TimescaleDB")

	return &Client{
		pool:   pool,
		logger: logger,
	}, nil
}

// Close closes the database connection pool
func (c *Client) Close() {
	c.logger.Info().Msg("Closing database connection pool")
	c.pool.Close()
}

// Health checks if the database connection is healthy
func (c *Client) Health(ctx context.Context) error {
	return c.pool.Ping(ctx)
}

// InsertMarketData inserts market data into the database
// Uses UPSERT to handle duplicates (TimescaleDB hypertable)
func (c *Client) InsertMarketData(ctx context.Context, data *types.MarketData) error {
	query := `
		INSERT INTO market_data (symbol, timestamp, open, high, low, close, volume)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (symbol, timestamp) DO UPDATE
		SET open = EXCLUDED.open,
			high = EXCLUDED.high,
			low = EXCLUDED.low,
			close = EXCLUDED.close,
			volume = EXCLUDED.volume
	`

	_, err := c.pool.Exec(ctx, query,
		data.Symbol,
		data.Timestamp,
		data.Open,
		data.High,
		data.Low,
		data.Close,
		data.Volume,
	)

	if err != nil {
		return fmt.Errorf("failed to insert market data: %w", err)
	}

	c.logger.Debug().
		Str("symbol", data.Symbol).
		Time("timestamp", data.Timestamp).
		Msg("Inserted market data")

	return nil
}

// GetMarketData retrieves market data for a symbol within a time range
func (c *Client) GetMarketData(ctx context.Context, symbol string, start, end time.Time, limit int) ([]*types.MarketData, error) {
	query := `
		SELECT symbol, timestamp, open, high, low, close, volume
		FROM market_data
		WHERE symbol = $1
		  AND timestamp >= $2
		  AND timestamp <= $3
		ORDER BY timestamp DESC
		LIMIT $4
	`

	rows, err := c.pool.Query(ctx, query, symbol, start, end, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query market data: %w", err)
	}
	defer rows.Close()

	var results []*types.MarketData

	for rows.Next() {
		var md types.MarketData
		err := rows.Scan(
			&md.Symbol,
			&md.Timestamp,
			&md.Open,
			&md.High,
			&md.Low,
			&md.Close,
			&md.Volume,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan market data: %w", err)
		}

		results = append(results, &md)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating market data: %w", err)
	}

	c.logger.Debug().
		Str("symbol", symbol).
		Int("count", len(results)).
		Msg("Retrieved market data")

	return results, nil
}

// GetLatestPrice gets the most recent close price for a symbol
func (c *Client) GetLatestPrice(ctx context.Context, symbol string) (float64, error) {
	query := `
		SELECT close
		FROM market_data
		WHERE symbol = $1
		ORDER BY timestamp DESC
		LIMIT 1
	`

	var price float64
	err := c.pool.QueryRow(ctx, query, symbol).Scan(&price)
	if err != nil {
		return 0, fmt.Errorf("failed to get latest price: %w", err)
	}

	return price, nil
}

// InsertOrder inserts an order into the database
func (c *Client) InsertOrder(ctx context.Context, order *types.Order) error {
	query := `
		INSERT INTO orders (
			id, strategy_id, symbol, side, type, quantity, price,
			status, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := c.pool.Exec(ctx, query,
		order.ID,
		order.StrategyID,
		order.Symbol,
		order.Side,
		order.Type,
		order.Quantity,
		order.Price,
		order.Status,
		order.CreatedAt,
		order.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to insert order: %w", err)
	}

	c.logger.Info().
		Str("order_id", order.ID).
		Str("symbol", order.Symbol).
		Str("side", string(order.Side)).
		Msg("Inserted order")

	return nil
}

// UpdateOrderStatus updates an order's status
func (c *Client) UpdateOrderStatus(ctx context.Context, orderID string, status types.OrderStatus) error {
	query := `
		UPDATE orders
		SET status = $1,
			updated_at = $2
		WHERE id = $3
	`

	_, err := c.pool.Exec(ctx, query, status, time.Now(), orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}

	c.logger.Info().
		Str("order_id", orderID).
		Str("status", string(status)).
		Msg("Updated order status")

	return nil
}

// GetOrders retrieves orders for a strategy
func (c *Client) GetOrders(ctx context.Context, strategyID string, limit int) ([]*types.Order, error) {
	query := `
		SELECT id, strategy_id, symbol, side, type, quantity, price,
			   status, created_at, updated_at, filled_at, filled_price, commission
		FROM orders
		WHERE strategy_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := c.pool.Query(ctx, query, strategyID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query orders: %w", err)
	}
	defer rows.Close()

	var orders []*types.Order

	for rows.Next() {
		var order types.Order
		err := rows.Scan(
			&order.ID,
			&order.StrategyID,
			&order.Symbol,
			&order.Side,
			&order.Type,
			&order.Quantity,
			&order.Price,
			&order.Status,
			&order.CreatedAt,
			&order.UpdatedAt,
			&order.FilledAt,
			&order.FilledPrice,
			&order.Commission,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan order: %w", err)
		}

		orders = append(orders, &order)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating orders: %w", err)
	}

	return orders, nil
}

// Stats returns database statistics
func (c *Client) Stats() *pgxpool.Stat {
	return c.pool.Stat()
}
