package data

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// PortfolioRepository handles portfolio data persistence
type PortfolioRepository struct {
	db     *pgxpool.Pool
	logger zerolog.Logger
}

// NewPortfolioRepository creates a new portfolio repository
func NewPortfolioRepository(db *pgxpool.Pool, logger zerolog.Logger) *PortfolioRepository {
	return &PortfolioRepository{
		db:     db,
		logger: logger,
	}
}

// Position represents a portfolio position in the database
type Position struct {
	ID               int64     `db:"id"`
	Symbol           string    `db:"symbol"`
	Quantity         float64   `db:"quantity"`
	AveragePrice     float64   `db:"average_price"`
	CurrentPrice     float64   `db:"current_price"`
	Side             string    `db:"side"`
	OpenedAt         time.Time `db:"opened_at"`
	LastUpdated      time.Time `db:"last_updated"`
}

// PortfolioSummary represents portfolio overview
type PortfolioSummary struct {
	TotalValue      float64   `db:"total_value"`
	Cash            float64   `db:"cash"`
	PositionsValue  float64   `db:"positions_value"`
	TotalPnL        float64   `db:"total_pnl"`
	TotalPnLPercent float64   `db:"total_pnl_percent"`
	DayPnL          float64   `db:"day_pnl"`
	DayPnLPercent   float64   `db:"day_pnl_percent"`
	LastUpdated     time.Time `db:"last_updated"`
}

// InitSchema initializes the portfolio tables
func (r *PortfolioRepository) InitSchema(ctx context.Context) error {
	schema := `
		CREATE TABLE IF NOT EXISTS positions (
			id SERIAL PRIMARY KEY,
			symbol VARCHAR(10) NOT NULL UNIQUE,
			quantity DECIMAL(20, 8) NOT NULL,
			average_price DECIMAL(20, 8) NOT NULL,
			current_price DECIMAL(20, 8) NOT NULL,
			side VARCHAR(10) NOT NULL CHECK (side IN ('long', 'short')),
			opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS portfolio_snapshots (
			id SERIAL PRIMARY KEY,
			total_value DECIMAL(20, 2) NOT NULL,
			cash DECIMAL(20, 2) NOT NULL,
			positions_value DECIMAL(20, 2) NOT NULL,
			total_pnl DECIMAL(20, 2) NOT NULL,
			total_pnl_percent DECIMAL(10, 4) NOT NULL,
			day_pnl DECIMAL(20, 2) NOT NULL,
			day_pnl_percent DECIMAL(10, 4) NOT NULL,
			snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_time ON portfolio_snapshots(snapshot_time DESC);

		-- Initialize portfolio with default cash if empty
		INSERT INTO portfolio_snapshots (total_value, cash, positions_value, total_pnl, total_pnl_percent, day_pnl, day_pnl_percent)
		SELECT 100000.0, 100000.0, 0.0, 0.0, 0.0, 0.0, 0.0
		WHERE NOT EXISTS (SELECT 1 FROM portfolio_snapshots LIMIT 1);
	`

	_, err := r.db.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("failed to initialize portfolio schema: %w", err)
	}

	r.logger.Info().Msg("Portfolio schema initialized")
	return nil
}

// GetAllPositions returns all open positions
func (r *PortfolioRepository) GetAllPositions(ctx context.Context) ([]Position, error) {
	query := `
		SELECT id, symbol, quantity, average_price, current_price, side, opened_at, last_updated
		FROM positions
		WHERE quantity != 0
		ORDER BY symbol
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query positions: %w", err)
	}
	defer rows.Close()

	var positions []Position
	for rows.Next() {
		var pos Position
		err := rows.Scan(&pos.ID, &pos.Symbol, &pos.Quantity, &pos.AveragePrice,
			&pos.CurrentPrice, &pos.Side, &pos.OpenedAt, &pos.LastUpdated)
		if err != nil {
			return nil, fmt.Errorf("failed to scan position: %w", err)
		}
		positions = append(positions, pos)
	}

	return positions, rows.Err()
}

// GetPosition returns a specific position by symbol
func (r *PortfolioRepository) GetPosition(ctx context.Context, symbol string) (*Position, error) {
	query := `
		SELECT id, symbol, quantity, average_price, current_price, side, opened_at, last_updated
		FROM positions
		WHERE symbol = $1
	`

	var pos Position
	err := r.db.QueryRow(ctx, query, symbol).Scan(
		&pos.ID, &pos.Symbol, &pos.Quantity, &pos.AveragePrice,
		&pos.CurrentPrice, &pos.Side, &pos.OpenedAt, &pos.LastUpdated,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	return &pos, nil
}

// UpsertPosition creates or updates a position
func (r *PortfolioRepository) UpsertPosition(ctx context.Context, pos *Position) error {
	query := `
		INSERT INTO positions (symbol, quantity, average_price, current_price, side, opened_at, last_updated)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (symbol) DO UPDATE SET
			quantity = EXCLUDED.quantity,
			average_price = EXCLUDED.average_price,
			current_price = EXCLUDED.current_price,
			side = EXCLUDED.side,
			last_updated = EXCLUDED.last_updated
		RETURNING id
	`

	err := r.db.QueryRow(ctx, query, pos.Symbol, pos.Quantity, pos.AveragePrice,
		pos.CurrentPrice, pos.Side, pos.OpenedAt, pos.LastUpdated).Scan(&pos.ID)
	if err != nil {
		return fmt.Errorf("failed to upsert position: %w", err)
	}

	return nil
}

// UpdatePositionPrice updates the current price of a position
func (r *PortfolioRepository) UpdatePositionPrice(ctx context.Context, symbol string, price float64) error {
	query := `
		UPDATE positions
		SET current_price = $1, last_updated = $2
		WHERE symbol = $3
	`

	_, err := r.db.Exec(ctx, query, price, time.Now(), symbol)
	if err != nil {
		return fmt.Errorf("failed to update position price: %w", err)
	}

	return nil
}

// GetSummary returns the latest portfolio summary
func (r *PortfolioRepository) GetSummary(ctx context.Context) (*PortfolioSummary, error) {
	query := `
		SELECT total_value, cash, positions_value, total_pnl, total_pnl_percent,
			   day_pnl, day_pnl_percent, snapshot_time as last_updated
		FROM portfolio_snapshots
		ORDER BY snapshot_time DESC
		LIMIT 1
	`

	var summary PortfolioSummary
	err := r.db.QueryRow(ctx, query).Scan(
		&summary.TotalValue, &summary.Cash, &summary.PositionsValue,
		&summary.TotalPnL, &summary.TotalPnLPercent,
		&summary.DayPnL, &summary.DayPnLPercent, &summary.LastUpdated,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio summary: %w", err)
	}

	return &summary, nil
}

// SaveSnapshot saves a portfolio snapshot
func (r *PortfolioRepository) SaveSnapshot(ctx context.Context, summary *PortfolioSummary) error {
	query := `
		INSERT INTO portfolio_snapshots (total_value, cash, positions_value, total_pnl,
			total_pnl_percent, day_pnl, day_pnl_percent, snapshot_time)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Exec(ctx, query,
		summary.TotalValue, summary.Cash, summary.PositionsValue,
		summary.TotalPnL, summary.TotalPnLPercent,
		summary.DayPnL, summary.DayPnLPercent, summary.LastUpdated,
	)
	if err != nil {
		return fmt.Errorf("failed to save portfolio snapshot: %w", err)
	}

	return nil
}

// GetHistoricalSnapshots returns portfolio snapshots for a time range
func (r *PortfolioRepository) GetHistoricalSnapshots(ctx context.Context, startDate, endDate time.Time) ([]PortfolioSummary, error) {
	query := `
		SELECT total_value, cash, positions_value, total_pnl, total_pnl_percent,
			   day_pnl, day_pnl_percent, snapshot_time as last_updated
		FROM portfolio_snapshots
		WHERE snapshot_time BETWEEN $1 AND $2
		ORDER BY snapshot_time ASC
	`

	rows, err := r.db.Query(ctx, query, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query historical snapshots: %w", err)
	}
	defer rows.Close()

	var snapshots []PortfolioSummary
	for rows.Next() {
		var snap PortfolioSummary
		err := rows.Scan(&snap.TotalValue, &snap.Cash, &snap.PositionsValue,
			&snap.TotalPnL, &snap.TotalPnLPercent,
			&snap.DayPnL, &snap.DayPnLPercent, &snap.LastUpdated)
		if err != nil {
			return nil, fmt.Errorf("failed to scan snapshot: %w", err)
		}
		snapshots = append(snapshots, snap)
	}

	return snapshots, rows.Err()
}

// DeletePosition removes a position (when fully closed)
func (r *PortfolioRepository) DeletePosition(ctx context.Context, symbol string) error {
	query := `DELETE FROM positions WHERE symbol = $1`

	_, err := r.db.Exec(ctx, query, symbol)
	if err != nil {
		return fmt.Errorf("failed to delete position: %w", err)
	}

	return nil
}
