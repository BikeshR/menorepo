package marketdata

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

// AlpacaWebSocket handles real-time data streaming from Alpaca
type AlpacaWebSocket struct {
	config   *Config
	logger   zerolog.Logger
	eventBus *events.EventBus

	conn   *websocket.Conn
	mu     sync.RWMutex
	active bool

	// Reconnection handling
	reconnectAttempt int
	reconnectTimer   *time.Timer

	// Message handlers
	onBar   BarHandler
	onTrade TradeHandler
	onError ErrorHandler
}

// NewAlpacaWebSocket creates a new Alpaca WebSocket client
func NewAlpacaWebSocket(config *Config, eventBus *events.EventBus, logger zerolog.Logger) (*AlpacaWebSocket, error) {
	ws := &AlpacaWebSocket{
		config:   config,
		logger:   logger.With().Str("component", "alpaca_websocket").Logger(),
		eventBus: eventBus,
	}

	return ws, nil
}

// Connect establishes WebSocket connection
func (ws *AlpacaWebSocket) Connect(ctx context.Context) error {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	if ws.active {
		return fmt.Errorf("websocket already connected")
	}

	// Determine WebSocket URL based on feed type
	wsURL := fmt.Sprintf("%s/v2/%s", ws.config.StreamURL, ws.config.FeedType)

	ws.logger.Info().
		Str("url", wsURL).
		Msg("Connecting to Alpaca WebSocket")

	// Connect to WebSocket
	conn, _, err := websocket.DefaultDialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	ws.conn = conn
	ws.active = true

	// Authenticate
	if err := ws.authenticate(); err != nil {
		ws.conn.Close()
		ws.active = false
		return fmt.Errorf("authentication failed: %w", err)
	}

	ws.logger.Info().Msg("WebSocket connected and authenticated")

	// Start message reader in background
	go ws.readMessages(ctx)

	return nil
}

// authenticate sends authentication message
func (ws *AlpacaWebSocket) authenticate() error {
	authMsg := map[string]interface{}{
		"action": "auth",
		"key":    ws.config.APIKey,
		"secret": ws.config.APISecret,
	}

	if err := ws.conn.WriteJSON(authMsg); err != nil {
		return fmt.Errorf("failed to send auth message: %w", err)
	}

	// Wait for auth response
	_, message, err := ws.conn.ReadMessage()
	if err != nil {
		return fmt.Errorf("failed to read auth response: %w", err)
	}

	var authResp []AlpacaMessage
	if err := json.Unmarshal(message, &authResp); err != nil {
		return fmt.Errorf("failed to parse auth response: %w", err)
	}

	// Check if authentication succeeded
	for _, msg := range authResp {
		if msg.Type == "success" && msg.Message == "authenticated" {
			ws.logger.Info().Msg("Authentication successful")
			return nil
		}
		if msg.Type == "error" {
			return fmt.Errorf("auth error: %s (code: %d)", msg.Message, msg.Code)
		}
	}

	return fmt.Errorf("unexpected auth response: %s", string(message))
}

// Subscribe subscribes to bar data for symbols
func (ws *AlpacaWebSocket) Subscribe(symbols []string) error {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	if !ws.active {
		return fmt.Errorf("websocket not connected")
	}

	// Subscribe to minute bars for the symbols
	subMsg := map[string]interface{}{
		"action": "subscribe",
		"bars":   symbols, // Subscribe to 1-min bars
	}

	if err := ws.conn.WriteJSON(subMsg); err != nil {
		return fmt.Errorf("failed to send subscribe message: %w", err)
	}

	ws.logger.Info().
		Strs("symbols", symbols).
		Msg("Subscribed to bars")

	return nil
}

// Unsubscribe unsubscribes from symbols
func (ws *AlpacaWebSocket) Unsubscribe(symbols []string) error {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	if !ws.active {
		return fmt.Errorf("websocket not connected")
	}

	unsubMsg := map[string]interface{}{
		"action": "unsubscribe",
		"bars":   symbols,
	}

	if err := ws.conn.WriteJSON(unsubMsg); err != nil {
		return fmt.Errorf("failed to send unsubscribe message: %w", err)
	}

	ws.logger.Info().
		Strs("symbols", symbols).
		Msg("Unsubscribed from bars")

	return nil
}

// readMessages reads and processes incoming WebSocket messages
func (ws *AlpacaWebSocket) readMessages(ctx context.Context) {
	defer func() {
		ws.mu.Lock()
		ws.active = false
		ws.mu.Unlock()

		ws.logger.Info().Msg("WebSocket reader stopped")
	}()

	for {
		select {
		case <-ctx.Done():
			ws.logger.Info().Msg("Context canceled, stopping reader")
			return

		default:
			// Read message with timeout
			ws.conn.SetReadDeadline(time.Now().Add(60 * time.Second))

			_, message, err := ws.conn.ReadMessage()
			if err != nil {
				ws.logger.Error().Err(err).Msg("Error reading message")

				// Attempt reconnection
				go ws.attemptReconnect(ctx)
				return
			}

			// Process message
			if err := ws.handleMessage(ctx, message); err != nil {
				ws.logger.Error().
					Err(err).
					Str("message", string(message)).
					Msg("Error handling message")
			}
		}
	}
}

// handleMessage processes incoming messages
func (ws *AlpacaWebSocket) handleMessage(ctx context.Context, data []byte) error {
	var messages []AlpacaMessage
	if err := json.Unmarshal(data, &messages); err != nil {
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	for _, msg := range messages {
		switch msg.Type {
		case "b": // Bar
			if err := ws.handleBar(ctx, msg); err != nil {
				ws.logger.Error().Err(err).Msg("Error handling bar")
			}

		case "t": // Trade
			ws.logger.Debug().
				Str("symbol", msg.Symbol).
				Msg("Received trade (not processing)")

		case "q": // Quote
			ws.logger.Debug().
				Str("symbol", msg.Symbol).
				Msg("Received quote (not processing)")

		case "subscription":
			ws.logger.Info().
				Interface("bars", msg.Bars).
				Interface("trades", msg.Trades).
				Interface("quotes", msg.Quotes).
				Msg("Subscription confirmed")

		case "error":
			ws.logger.Error().
				Int("code", msg.Code).
				Str("message", msg.Message).
				Msg("Received error from Alpaca")

		default:
			ws.logger.Debug().
				Str("type", msg.Type).
				Msg("Received unhandled message type")
		}
	}

	return nil
}

// handleBar processes bar messages and publishes to event bus
func (ws *AlpacaWebSocket) handleBar(ctx context.Context, msg AlpacaMessage) error {
	// Parse timestamp
	timestamp, err := time.Parse(time.RFC3339Nano, msg.Timestamp)
	if err != nil {
		return fmt.Errorf("failed to parse timestamp: %w", err)
	}

	// Create market data event
	event := events.NewMarketDataEvent(
		msg.Symbol,
		msg.Open,
		msg.High,
		msg.Low,
		msg.Close,
		msg.Volume,
		timestamp,
	)

	// Publish to event bus
	ws.eventBus.Publish(ctx, event)

	ws.logger.Debug().
		Str("symbol", msg.Symbol).
		Float64("close", msg.Close).
		Int64("volume", msg.Volume).
		Time("timestamp", timestamp).
		Msg("Published bar event")

	return nil
}

// attemptReconnect attempts to reconnect with exponential backoff
func (ws *AlpacaWebSocket) attemptReconnect(ctx context.Context) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	if ws.reconnectAttempt >= ws.config.MaxReconnectAttempts {
		ws.logger.Error().
			Int("max_attempts", ws.config.MaxReconnectAttempts).
			Msg("Max reconnection attempts reached, giving up")
		return
	}

	ws.reconnectAttempt++

	// Calculate exponential backoff delay
	delay := ws.config.ReconnectDelay * time.Duration(1<<uint(ws.reconnectAttempt-1))
	if delay > ws.config.MaxReconnectDelay {
		delay = ws.config.MaxReconnectDelay
	}

	ws.logger.Info().
		Int("attempt", ws.reconnectAttempt).
		Dur("delay", delay).
		Msg("Attempting reconnection")

	time.Sleep(delay)

	// Try to reconnect
	if err := ws.Connect(ctx); err != nil {
		ws.logger.Error().
			Err(err).
			Int("attempt", ws.reconnectAttempt).
			Msg("Reconnection failed")

		// Retry
		go ws.attemptReconnect(ctx)
	} else {
		ws.logger.Info().Msg("Reconnection successful")
		ws.reconnectAttempt = 0 // Reset counter on success
	}
}

// Close closes the WebSocket connection
func (ws *AlpacaWebSocket) Close() error {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	if !ws.active {
		return nil
	}

	ws.logger.Info().Msg("Closing WebSocket connection")

	// Send close message
	err := ws.conn.WriteMessage(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
	)

	// Close connection
	if closeErr := ws.conn.Close(); closeErr != nil {
		ws.logger.Error().Err(closeErr).Msg("Error closing connection")
	}

	ws.active = false

	return err
}

// AlpacaMessage represents a message from Alpaca WebSocket
type AlpacaMessage struct {
	// Common fields
	Type   string `json:"T"` // Message type
	Symbol string `json:"S"` // Symbol

	// Bar fields
	Timestamp  string  `json:"t,omitempty"` // RFC3339Nano timestamp
	Open       float64 `json:"o,omitempty"`
	High       float64 `json:"h,omitempty"`
	Low        float64 `json:"l,omitempty"`
	Close      float64 `json:"c,omitempty"`
	Volume     int64   `json:"v,omitempty"`
	VWAP       float64 `json:"vw,omitempty"`
	TradeCount int     `json:"n,omitempty"`

	// Trade fields
	Price      float64  `json:"p,omitempty"`
	Size       int64    `json:"s,omitempty"`
	Exchange   string   `json:"x,omitempty"`
	Conditions []string `json:"c,omitempty"`

	// Quote fields
	BidPrice    float64 `json:"bp,omitempty"`
	BidSize     int64   `json:"bs,omitempty"`
	AskPrice    float64 `json:"ap,omitempty"`
	AskSize     int64   `json:"as,omitempty"`
	BidExchange string  `json:"bx,omitempty"`
	AskExchange string  `json:"ax,omitempty"`

	// Subscription confirmation
	Trades []string `json:"trades,omitempty"`
	Quotes []string `json:"quotes,omitempty"`
	Bars   []string `json:"bars,omitempty"`

	// Error/success messages
	Message string `json:"msg,omitempty"`
	Code    int    `json:"code,omitempty"`
}
