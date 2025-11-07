package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// EventType represents the type of audit event
type EventType string

const (
	EventTypeOrderCreated   EventType = "order_created"
	EventTypeOrderFilled    EventType = "order_filled"
	EventTypeOrderCancelled EventType = "order_cancelled"
	EventTypeOrderRejected  EventType = "order_rejected"
	EventTypeTradeExecuted  EventType = "trade_executed"
	EventTypePositionOpened EventType = "position_opened"
	EventTypePositionClosed EventType = "position_closed"
	EventTypeUserLogin      EventType = "user_login"
	EventTypeUserLogout     EventType = "user_logout"
	EventTypeStrategyStart  EventType = "strategy_start"
	EventTypeStrategyStop   EventType = "strategy_stop"
	EventTypeRiskViolation  EventType = "risk_violation"
	EventTypeSystemStart    EventType = "system_start"
	EventTypeSystemStop     EventType = "system_stop"
	EventTypeConfigChange   EventType = "config_change"
)

// AuditEvent represents an audit log entry
type AuditEvent struct {
	ID          string                 `json:"id" db:"id"`
	EventType   EventType              `json:"event_type" db:"event_type"`
	Timestamp   time.Time              `json:"timestamp" db:"timestamp"`
	UserID      string                 `json:"user_id,omitempty" db:"user_id"`
	Username    string                 `json:"username,omitempty" db:"username"`
	IPAddress   string                 `json:"ip_address,omitempty" db:"ip_address"`
	Resource    string                 `json:"resource,omitempty" db:"resource"` // e.g., "order:123", "strategy:abc"
	Action      string                 `json:"action,omitempty" db:"action"`
	Status      string                 `json:"status" db:"status"` // "success", "failure"
	Details     map[string]interface{} `json:"details,omitempty" db:"details"`
	ErrorMsg    string                 `json:"error_msg,omitempty" db:"error_msg"`
	Duration    int64                  `json:"duration_ms,omitempty" db:"duration_ms"` // milliseconds
}

// AuditLogger handles audit logging to database
type AuditLogger struct {
	pool   *pgxpool.Pool
	logger zerolog.Logger
}

// NewAuditLogger creates a new audit logger
func NewAuditLogger(pool *pgxpool.Pool, logger zerolog.Logger) *AuditLogger {
	return &AuditLogger{
		pool:   pool,
		logger: logger,
	}
}

// InitSchema initializes the audit log table
func (a *AuditLogger) InitSchema(ctx context.Context) error {
	schema := `
		CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			event_type TEXT NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			user_id TEXT,
			username TEXT,
			ip_address TEXT,
			resource TEXT,
			action TEXT,
			status TEXT NOT NULL,
			details JSONB,
			error_msg TEXT,
			duration_ms BIGINT,
			INDEX idx_audit_timestamp (timestamp DESC),
			INDEX idx_audit_event_type (event_type),
			INDEX idx_audit_user_id (user_id),
			INDEX idx_audit_resource (resource),
			INDEX idx_audit_status (status)
		);

		-- Partition by month for better performance (TimescaleDB)
		SELECT create_hypertable('audit_logs', 'timestamp',
			if_not_exists => TRUE,
			chunk_time_interval => INTERVAL '1 month'
		);

		-- Retention policy: keep audit logs for 2 years
		SELECT add_retention_policy('audit_logs', INTERVAL '2 years', if_not_exists => TRUE);
	`

	if _, err := a.pool.Exec(ctx, schema); err != nil {
		return err
	}

	a.logger.Info().Msg("Audit log schema initialized")
	return nil
}

// LogEvent logs an audit event to the database
func (a *AuditLogger) LogEvent(ctx context.Context, event *AuditEvent) error {
	// Generate ID if not provided
	if event.ID == "" {
		event.ID = generateEventID()
	}

	// Set timestamp if not provided
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Default status if not set
	if event.Status == "" {
		event.Status = "success"
	}

	// Convert details to JSON
	var detailsJSON []byte
	var err error
	if event.Details != nil {
		detailsJSON, err = json.Marshal(event.Details)
		if err != nil {
			a.logger.Warn().Err(err).Msg("Failed to marshal audit event details")
			detailsJSON = []byte("{}")
		}
	}

	query := `
		INSERT INTO audit_logs (
			id, event_type, timestamp, user_id, username, ip_address,
			resource, action, status, details, error_msg, duration_ms
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err = a.pool.Exec(ctx, query,
		event.ID,
		event.EventType,
		event.Timestamp,
		nullString(event.UserID),
		nullString(event.Username),
		nullString(event.IPAddress),
		nullString(event.Resource),
		nullString(event.Action),
		event.Status,
		detailsJSON,
		nullString(event.ErrorMsg),
		nullInt64(event.Duration),
	)

	if err != nil {
		a.logger.Error().
			Err(err).
			Str("event_type", string(event.EventType)).
			Msg("Failed to log audit event")
		return err
	}

	a.logger.Debug().
		Str("event_id", event.ID).
		Str("event_type", string(event.EventType)).
		Str("resource", event.Resource).
		Str("status", event.Status).
		Msg("Audit event logged")

	return nil
}

// LogOrderCreated logs an order creation event
func (a *AuditLogger) LogOrderCreated(ctx context.Context, orderID, userID, username, symbol, action string, quantity int, price float64) {
	event := &AuditEvent{
		EventType: EventTypeOrderCreated,
		UserID:    userID,
		Username:  username,
		Resource:  "order:" + orderID,
		Action:    "create",
		Status:    "success",
		Details: map[string]interface{}{
			"order_id": orderID,
			"symbol":   symbol,
			"action":   action,
			"quantity": quantity,
			"price":    price,
		},
	}
	a.LogEvent(ctx, event)
}

// LogOrderFilled logs an order fill event
func (a *AuditLogger) LogOrderFilled(ctx context.Context, orderID, symbol, action string, quantity int, price float64) {
	event := &AuditEvent{
		EventType: EventTypeOrderFilled,
		Resource:  "order:" + orderID,
		Action:    "fill",
		Status:    "success",
		Details: map[string]interface{}{
			"order_id": orderID,
			"symbol":   symbol,
			"action":   action,
			"quantity": quantity,
			"price":    price,
			"value":    float64(quantity) * price,
		},
	}
	a.LogEvent(ctx, event)
}

// LogOrderRejected logs an order rejection event
func (a *AuditLogger) LogOrderRejected(ctx context.Context, orderID, userID, username, reason string, details map[string]interface{}) {
	event := &AuditEvent{
		EventType: EventTypeOrderRejected,
		UserID:    userID,
		Username:  username,
		Resource:  "order:" + orderID,
		Action:    "reject",
		Status:    "failure",
		ErrorMsg:  reason,
		Details:   details,
	}
	a.LogEvent(ctx, event)
}

// LogTradeExecuted logs a trade execution event
func (a *AuditLogger) LogTradeExecuted(ctx context.Context, tradeID, orderID, symbol, side string, quantity float64, price, pnl float64) {
	event := &AuditEvent{
		EventType: EventTypeTradeExecuted,
		Resource:  "trade:" + tradeID,
		Action:    "execute",
		Status:    "success",
		Details: map[string]interface{}{
			"trade_id":  tradeID,
			"order_id":  orderID,
			"symbol":    symbol,
			"side":      side,
			"quantity":  quantity,
			"price":     price,
			"value":     quantity * price,
			"pnl":       pnl,
		},
	}
	a.LogEvent(ctx, event)
}

// LogRiskViolation logs a risk management violation
func (a *AuditLogger) LogRiskViolation(ctx context.Context, orderID, userID, username, violationType string, details map[string]interface{}) {
	event := &AuditEvent{
		EventType: EventTypeRiskViolation,
		UserID:    userID,
		Username:  username,
		Resource:  "order:" + orderID,
		Action:    "risk_check",
		Status:    "violation",
		ErrorMsg:  violationType,
		Details:   details,
	}
	a.LogEvent(ctx, event)
}

// LogUserLogin logs a user login event
func (a *AuditLogger) LogUserLogin(ctx context.Context, userID, username, ipAddress string, success bool) {
	status := "success"
	if !success {
		status = "failure"
	}

	event := &AuditEvent{
		EventType: EventTypeUserLogin,
		UserID:    userID,
		Username:  username,
		IPAddress: ipAddress,
		Resource:  "user:" + userID,
		Action:    "login",
		Status:    status,
	}
	a.LogEvent(ctx, event)
}

// LogUserLogout logs a user logout event
func (a *AuditLogger) LogUserLogout(ctx context.Context, userID, username, ipAddress string) {
	event := &AuditEvent{
		EventType: EventTypeUserLogout,
		UserID:    userID,
		Username:  username,
		IPAddress: ipAddress,
		Resource:  "user:" + userID,
		Action:    "logout",
		Status:    "success",
	}
	a.LogEvent(ctx, event)
}

// LogStrategyAction logs a strategy start/stop event
func (a *AuditLogger) LogStrategyAction(ctx context.Context, strategyID, action, userID, username string) {
	eventType := EventTypeStrategyStart
	if action == "stop" {
		eventType = EventTypeStrategyStop
	}

	event := &AuditEvent{
		EventType: eventType,
		UserID:    userID,
		Username:  username,
		Resource:  "strategy:" + strategyID,
		Action:    action,
		Status:    "success",
	}
	a.LogEvent(ctx, event)
}

// QueryAuditLogs queries audit logs with filters
func (a *AuditLogger) QueryAuditLogs(ctx context.Context, filters AuditQueryFilters) ([]*AuditEvent, error) {
	query := `
		SELECT id, event_type, timestamp, user_id, username, ip_address,
		       resource, action, status, details, error_msg, duration_ms
		FROM audit_logs
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	// Add filters
	if filters.EventType != "" {
		query += ` AND event_type = $` + string(rune(argCount))
		args = append(args, filters.EventType)
		argCount++
	}

	if filters.UserID != "" {
		query += ` AND user_id = $` + string(rune(argCount))
		args = append(args, filters.UserID)
		argCount++
	}

	if filters.Resource != "" {
		query += ` AND resource = $` + string(rune(argCount))
		args = append(args, filters.Resource)
		argCount++
	}

	if filters.Status != "" {
		query += ` AND status = $` + string(rune(argCount))
		args = append(args, filters.Status)
		argCount++
	}

	if !filters.StartTime.IsZero() {
		query += ` AND timestamp >= $` + string(rune(argCount))
		args = append(args, filters.StartTime)
		argCount++
	}

	if !filters.EndTime.IsZero() {
		query += ` AND timestamp <= $` + string(rune(argCount))
		args = append(args, filters.EndTime)
		argCount++
	}

	// Order and limit
	query += ` ORDER BY timestamp DESC`
	if filters.Limit > 0 {
		query += ` LIMIT $` + string(rune(argCount))
		args = append(args, filters.Limit)
	} else {
		query += ` LIMIT 100`
	}

	rows, err := a.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]*AuditEvent, 0)
	for rows.Next() {
		event := &AuditEvent{}
		var detailsJSON []byte

		err := rows.Scan(
			&event.ID,
			&event.EventType,
			&event.Timestamp,
			&event.UserID,
			&event.Username,
			&event.IPAddress,
			&event.Resource,
			&event.Action,
			&event.Status,
			&detailsJSON,
			&event.ErrorMsg,
			&event.Duration,
		)
		if err != nil {
			a.logger.Warn().Err(err).Msg("Failed to scan audit event")
			continue
		}

		// Unmarshal details
		if len(detailsJSON) > 0 {
			if err := json.Unmarshal(detailsJSON, &event.Details); err != nil {
				a.logger.Warn().Err(err).Msg("Failed to unmarshal audit event details")
			}
		}

		events = append(events, event)
	}

	return events, nil
}

// AuditQueryFilters defines filters for querying audit logs
type AuditQueryFilters struct {
	EventType EventType
	UserID    string
	Resource  string
	Status    string
	StartTime time.Time
	EndTime   time.Time
	Limit     int
}

// Helper functions
func generateEventID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullInt64(i int64) interface{} {
	if i == 0 {
		return nil
	}
	return i
}
