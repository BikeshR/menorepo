package data

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// StrategiesRepository handles strategy data persistence
type StrategiesRepository struct {
	db     *pgxpool.Pool
	logger zerolog.Logger
}

// NewStrategiesRepository creates a new strategies repository
func NewStrategiesRepository(db *pgxpool.Pool, logger zerolog.Logger) *StrategiesRepository {
	return &StrategiesRepository{
		db:     db,
		logger: logger,
	}
}

// Strategy represents a strategy configuration in the database
type Strategy struct {
	ID         string                 `db:"id"`
	Name       string                 `db:"name"`
	Type       string                 `db:"type"`
	Status     string                 `db:"status"`
	Symbols    []string               `db:"symbols"`
	Parameters map[string]interface{} `db:"parameters"`
	CreatedAt  time.Time              `db:"created_at"`
	UpdatedAt  time.Time              `db:"updated_at"`
	StartedAt  *time.Time             `db:"started_at"`
	StoppedAt  *time.Time             `db:"stopped_at"`
}

// StrategyPerformance represents strategy performance metrics
type StrategyPerformance struct {
	StrategyID     string    `db:"strategy_id"`
	TotalReturn    float64   `db:"total_return"`
	TotalReturnPct float64   `db:"total_return_pct"`
	WinRate        float64   `db:"win_rate"`
	TotalTrades    int       `db:"total_trades"`
	WinningTrades  int       `db:"winning_trades"`
	LosingTrades   int       `db:"losing_trades"`
	ProfitFactor   float64   `db:"profit_factor"`
	SharpeRatio    float64   `db:"sharpe_ratio"`
	MaxDrawdown    float64   `db:"max_drawdown"`
	AvgWin         float64   `db:"avg_win"`
	AvgLoss        float64   `db:"avg_loss"`
	UpdatedAt      time.Time `db:"updated_at"`
}

// InitSchema initializes the strategies tables
func (r *StrategiesRepository) InitSchema(ctx context.Context) error {
	schema := `
		CREATE TABLE IF NOT EXISTS strategies (
			id VARCHAR(50) PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			type VARCHAR(50) NOT NULL,
			status VARCHAR(20) NOT NULL CHECK (status IN ('created', 'running', 'stopped', 'paused', 'error')),
			symbols JSONB NOT NULL,
			parameters JSONB NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			started_at TIMESTAMPTZ,
			stopped_at TIMESTAMPTZ
		);

		CREATE TABLE IF NOT EXISTS strategy_performance (
			strategy_id VARCHAR(50) PRIMARY KEY REFERENCES strategies(id) ON DELETE CASCADE,
			total_return DECIMAL(20, 8) NOT NULL DEFAULT 0,
			total_return_pct DECIMAL(10, 4) NOT NULL DEFAULT 0,
			win_rate DECIMAL(5, 4) NOT NULL DEFAULT 0,
			total_trades INT NOT NULL DEFAULT 0,
			winning_trades INT NOT NULL DEFAULT 0,
			losing_trades INT NOT NULL DEFAULT 0,
			profit_factor DECIMAL(10, 4) NOT NULL DEFAULT 0,
			sharpe_ratio DECIMAL(10, 4) NOT NULL DEFAULT 0,
			max_drawdown DECIMAL(20, 8) NOT NULL DEFAULT 0,
			avg_win DECIMAL(20, 8) NOT NULL DEFAULT 0,
			avg_loss DECIMAL(20, 8) NOT NULL DEFAULT 0,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
		CREATE INDEX IF NOT EXISTS idx_strategies_type ON strategies(type);
	`

	_, err := r.db.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("failed to initialize strategies schema: %w", err)
	}

	r.logger.Info().Msg("Strategies schema initialized")
	return nil
}

// CreateStrategy creates a new strategy
func (r *StrategiesRepository) CreateStrategy(ctx context.Context, strategy *Strategy) error {
	symbolsJSON, err := json.Marshal(strategy.Symbols)
	if err != nil {
		return fmt.Errorf("failed to marshal symbols: %w", err)
	}

	paramsJSON, err := json.Marshal(strategy.Parameters)
	if err != nil {
		return fmt.Errorf("failed to marshal parameters: %w", err)
	}

	query := `
		INSERT INTO strategies (id, name, type, status, symbols, parameters, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err = r.db.Exec(ctx, query,
		strategy.ID, strategy.Name, strategy.Type, strategy.Status,
		symbolsJSON, paramsJSON, strategy.CreatedAt, strategy.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create strategy: %w", err)
	}

	// Initialize performance metrics
	perfQuery := `
		INSERT INTO strategy_performance (strategy_id)
		VALUES ($1)
	`
	_, err = r.db.Exec(ctx, perfQuery, strategy.ID)
	if err != nil {
		return fmt.Errorf("failed to initialize strategy performance: %w", err)
	}

	r.logger.Info().Str("strategy_id", strategy.ID).Msg("Strategy created")
	return nil
}

// GetStrategy retrieves a strategy by ID
func (r *StrategiesRepository) GetStrategy(ctx context.Context, strategyID string) (*Strategy, error) {
	query := `
		SELECT id, name, type, status, symbols, parameters, created_at, updated_at, started_at, stopped_at
		FROM strategies
		WHERE id = $1
	`

	var strategy Strategy
	var symbolsJSON, paramsJSON []byte

	err := r.db.QueryRow(ctx, query, strategyID).Scan(
		&strategy.ID, &strategy.Name, &strategy.Type, &strategy.Status,
		&symbolsJSON, &paramsJSON, &strategy.CreatedAt, &strategy.UpdatedAt,
		&strategy.StartedAt, &strategy.StoppedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get strategy: %w", err)
	}

	if err := json.Unmarshal(symbolsJSON, &strategy.Symbols); err != nil {
		return nil, fmt.Errorf("failed to unmarshal symbols: %w", err)
	}

	if err := json.Unmarshal(paramsJSON, &strategy.Parameters); err != nil {
		return nil, fmt.Errorf("failed to unmarshal parameters: %w", err)
	}

	return &strategy, nil
}

// GetAllStrategies retrieves all strategies
func (r *StrategiesRepository) GetAllStrategies(ctx context.Context) ([]Strategy, error) {
	query := `
		SELECT id, name, type, status, symbols, parameters, created_at, updated_at, started_at, stopped_at
		FROM strategies
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query strategies: %w", err)
	}
	defer rows.Close()

	var strategies []Strategy
	for rows.Next() {
		var strategy Strategy
		var symbolsJSON, paramsJSON []byte

		err := rows.Scan(
			&strategy.ID, &strategy.Name, &strategy.Type, &strategy.Status,
			&symbolsJSON, &paramsJSON, &strategy.CreatedAt, &strategy.UpdatedAt,
			&strategy.StartedAt, &strategy.StoppedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan strategy: %w", err)
		}

		if err := json.Unmarshal(symbolsJSON, &strategy.Symbols); err != nil {
			return nil, fmt.Errorf("failed to unmarshal symbols: %w", err)
		}

		if err := json.Unmarshal(paramsJSON, &strategy.Parameters); err != nil {
			return nil, fmt.Errorf("failed to unmarshal parameters: %w", err)
		}

		strategies = append(strategies, strategy)
	}

	return strategies, rows.Err()
}

// GetActiveStrategies retrieves all running strategies
func (r *StrategiesRepository) GetActiveStrategies(ctx context.Context) ([]Strategy, error) {
	query := `
		SELECT id, name, type, status, symbols, parameters, created_at, updated_at, started_at, stopped_at
		FROM strategies
		WHERE status = 'running'
		ORDER BY started_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active strategies: %w", err)
	}
	defer rows.Close()

	var strategies []Strategy
	for rows.Next() {
		var strategy Strategy
		var symbolsJSON, paramsJSON []byte

		err := rows.Scan(
			&strategy.ID, &strategy.Name, &strategy.Type, &strategy.Status,
			&symbolsJSON, &paramsJSON, &strategy.CreatedAt, &strategy.UpdatedAt,
			&strategy.StartedAt, &strategy.StoppedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan strategy: %w", err)
		}

		if err := json.Unmarshal(symbolsJSON, &strategy.Symbols); err != nil {
			return nil, fmt.Errorf("failed to unmarshal symbols: %w", err)
		}

		if err := json.Unmarshal(paramsJSON, &strategy.Parameters); err != nil {
			return nil, fmt.Errorf("failed to unmarshal parameters: %w", err)
		}

		strategies = append(strategies, strategy)
	}

	return strategies, rows.Err()
}

// UpdateStrategy updates a strategy
func (r *StrategiesRepository) UpdateStrategy(ctx context.Context, strategy *Strategy) error {
	symbolsJSON, err := json.Marshal(strategy.Symbols)
	if err != nil {
		return fmt.Errorf("failed to marshal symbols: %w", err)
	}

	paramsJSON, err := json.Marshal(strategy.Parameters)
	if err != nil {
		return fmt.Errorf("failed to marshal parameters: %w", err)
	}

	query := `
		UPDATE strategies
		SET name = $1, type = $2, status = $3, symbols = $4, parameters = $5,
			updated_at = $6, started_at = $7, stopped_at = $8
		WHERE id = $9
	`

	_, err = r.db.Exec(ctx, query,
		strategy.Name, strategy.Type, strategy.Status, symbolsJSON, paramsJSON,
		strategy.UpdatedAt, strategy.StartedAt, strategy.StoppedAt, strategy.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update strategy: %w", err)
	}

	return nil
}

// UpdateStrategyStatus updates only the status of a strategy
func (r *StrategiesRepository) UpdateStrategyStatus(ctx context.Context, strategyID, status string) error {
	now := time.Now()

	query := `
		UPDATE strategies
		SET status = $1,
			updated_at = $2,
			started_at = CASE WHEN $1 = 'running' THEN $2 ELSE started_at END,
			stopped_at = CASE WHEN $1 IN ('stopped', 'paused') THEN $2 ELSE stopped_at END
		WHERE id = $3
	`

	_, err := r.db.Exec(ctx, query, status, now, strategyID)
	if err != nil {
		return fmt.Errorf("failed to update strategy status: %w", err)
	}

	r.logger.Info().Str("strategy_id", strategyID).Str("status", status).Msg("Strategy status updated")
	return nil
}

// DeleteStrategy deletes a strategy
func (r *StrategiesRepository) DeleteStrategy(ctx context.Context, strategyID string) error {
	query := `DELETE FROM strategies WHERE id = $1`

	result, err := r.db.Exec(ctx, query, strategyID)
	if err != nil {
		return fmt.Errorf("failed to delete strategy: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("strategy not found")
	}

	r.logger.Info().Str("strategy_id", strategyID).Msg("Strategy deleted")
	return nil
}

// GetStrategyPerformance retrieves performance metrics for a strategy
func (r *StrategiesRepository) GetStrategyPerformance(ctx context.Context, strategyID string) (*StrategyPerformance, error) {
	query := `
		SELECT strategy_id, total_return, total_return_pct, win_rate, total_trades,
			   winning_trades, losing_trades, profit_factor, sharpe_ratio, max_drawdown,
			   avg_win, avg_loss, updated_at
		FROM strategy_performance
		WHERE strategy_id = $1
	`

	var perf StrategyPerformance
	err := r.db.QueryRow(ctx, query, strategyID).Scan(
		&perf.StrategyID, &perf.TotalReturn, &perf.TotalReturnPct, &perf.WinRate,
		&perf.TotalTrades, &perf.WinningTrades, &perf.LosingTrades,
		&perf.ProfitFactor, &perf.SharpeRatio, &perf.MaxDrawdown,
		&perf.AvgWin, &perf.AvgLoss, &perf.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get strategy performance: %w", err)
	}

	return &perf, nil
}

// UpdateStrategyPerformance updates performance metrics
func (r *StrategiesRepository) UpdateStrategyPerformance(ctx context.Context, perf *StrategyPerformance) error {
	query := `
		UPDATE strategy_performance
		SET total_return = $1, total_return_pct = $2, win_rate = $3, total_trades = $4,
			winning_trades = $5, losing_trades = $6, profit_factor = $7, sharpe_ratio = $8,
			max_drawdown = $9, avg_win = $10, avg_loss = $11, updated_at = $12
		WHERE strategy_id = $13
	`

	_, err := r.db.Exec(ctx, query,
		perf.TotalReturn, perf.TotalReturnPct, perf.WinRate, perf.TotalTrades,
		perf.WinningTrades, perf.LosingTrades, perf.ProfitFactor, perf.SharpeRatio,
		perf.MaxDrawdown, perf.AvgWin, perf.AvgLoss, perf.UpdatedAt, perf.StrategyID,
	)
	if err != nil {
		return fmt.Errorf("failed to update strategy performance: %w", err)
	}

	return nil
}
