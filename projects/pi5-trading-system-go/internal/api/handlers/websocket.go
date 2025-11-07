package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
)

// WebSocketHandler handles WebSocket connections for real-time updates
type WebSocketHandler struct {
	logger    zerolog.Logger
	upgrader  websocket.Upgrader
	clients   map[*WebSocketClient]bool
	clientsMu sync.RWMutex
	eventBus  *events.EventBus
}

// WebSocketClient represents a connected WebSocket client
type WebSocketClient struct {
	conn     *websocket.Conn
	send     chan []byte
	handler  *WebSocketHandler
	clientID string
}

// WebSocketMessage represents a message sent over WebSocket
type WebSocketMessage struct {
	Type      string      `json:"type"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(logger zerolog.Logger, eventBus *events.EventBus) *WebSocketHandler {
	return &WebSocketHandler{
		logger: logger,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				// Allow all origins for development
				// In production, check against allowed origins
				return true
			},
		},
		clients:  make(map[*WebSocketClient]bool),
		eventBus: eventBus,
	}
}

// HandleConnection upgrades HTTP connection to WebSocket
func (h *WebSocketHandler) HandleConnection(w http.ResponseWriter, r *http.Request) {
	clientID := r.URL.Query().Get("client_id")
	if clientID == "" {
		clientID = "client_" + time.Now().Format("20060102150405")
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to upgrade WebSocket connection")
		return
	}

	client := &WebSocketClient{
		conn:     conn,
		send:     make(chan []byte, 256),
		handler:  h,
		clientID: clientID,
	}

	h.registerClient(client)

	h.logger.Info().Str("client_id", clientID).Msg("WebSocket client connected")

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()

	// Send welcome message
	client.sendMessage("connected", map[string]string{
		"client_id": clientID,
		"message":   "Connected to Pi5 Trading System",
	})
}

// registerClient adds a client to the active clients list
func (h *WebSocketHandler) registerClient(client *WebSocketClient) {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()
	h.clients[client] = true
}

// unregisterClient removes a client from the active clients list
func (h *WebSocketHandler) unregisterClient(client *WebSocketClient) {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.send)
		h.logger.Info().Str("client_id", client.clientID).Msg("WebSocket client disconnected")
	}
}

// Broadcast sends a message to all connected clients
func (h *WebSocketHandler) Broadcast(messageType string, data interface{}) {
	message := WebSocketMessage{
		Type:      messageType,
		Timestamp: time.Now(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to marshal WebSocket message")
		return
	}

	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()

	for client := range h.clients {
		select {
		case client.send <- msgBytes:
		default:
			// Client's send channel is full, close it
			h.unregisterClient(client)
		}
	}
}

// StartEventListener starts listening to event bus and broadcasts to clients
func (h *WebSocketHandler) StartEventListener(ctx context.Context) {
	// Subscribe to all event types
	marketDataCh := h.eventBus.Subscribe(events.EventTypeMarketData)
	signalCh := h.eventBus.Subscribe(events.EventTypeSignal)
	orderCh := h.eventBus.Subscribe(events.EventTypeOrder)
	orderFilledCh := h.eventBus.Subscribe(events.EventTypeOrderFilled)
	portfolioCh := h.eventBus.Subscribe(events.EventTypePortfolioUpdate)

	h.logger.Info().Msg("WebSocket event listener started")

	for {
		select {
		case event := <-marketDataCh:
			if mdEvent, ok := event.(*events.MarketDataEvent); ok {
				h.Broadcast("market_data", map[string]interface{}{
					"symbol":    mdEvent.Symbol,
					"close":     mdEvent.Close,
					"volume":    mdEvent.Volume,
					"timestamp": mdEvent.DataTimestamp,
				})
			}

		case event := <-signalCh:
			if signalEvent, ok := event.(*events.SignalEvent); ok {
				h.Broadcast("trading_signal", map[string]interface{}{
					"strategy_id": signalEvent.StrategyID,
					"symbol":      signalEvent.Symbol,
					"action":      signalEvent.Action,
					"confidence":  signalEvent.Confidence,
					"price":       signalEvent.Price,
					"reason":      signalEvent.Reason,
				})
			}

		case event := <-orderCh:
			if orderEvent, ok := event.(*events.OrderEvent); ok {
				h.Broadcast("order_update", map[string]interface{}{
					"order_id": orderEvent.OrderID,
					"symbol":   orderEvent.Symbol,
					"action":   orderEvent.Action,
					"quantity": orderEvent.Quantity,
					"status":   orderEvent.Status,
				})
			}

		case event := <-orderFilledCh:
			if fillEvent, ok := event.(*events.OrderFilledEvent); ok {
				h.Broadcast("order_filled", map[string]interface{}{
					"order_id":        fillEvent.OrderID,
					"symbol":          fillEvent.Symbol,
					"filled_quantity": fillEvent.FilledQuantity,
					"price":           fillEvent.Price,
				})
			}

		case event := <-portfolioCh:
			if portfolioEvent, ok := event.(*events.PortfolioUpdateEvent); ok {
				h.Broadcast("portfolio_update", map[string]interface{}{
					"total_value":   portfolioEvent.TotalValue,
					"total_pnl":     portfolioEvent.TotalPnL,
					"cash":          portfolioEvent.Cash,
					"buying_power":  portfolioEvent.BuyingPower,
				})
			}

		case <-ctx.Done():
			h.logger.Info().Msg("WebSocket event listener stopped")
			return
		}
	}
}

// GetClientCount returns the number of connected clients
func (h *WebSocketHandler) GetClientCount() int {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()
	return len(h.clients)
}

// writePump sends messages from the send channel to the WebSocket connection
func (c *WebSocketClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Channel closed
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				c.handler.logger.Error().Err(err).Msg("Failed to write WebSocket message")
				return
			}

		case <-ticker.C:
			// Send ping to keep connection alive
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads messages from the WebSocket connection
func (c *WebSocketClient) readPump() {
	defer func() {
		c.handler.unregisterClient(c)
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.handler.logger.Error().Err(err).Msg("WebSocket read error")
			}
			break
		}

		// Handle incoming messages (subscription requests, etc.)
		c.handleIncomingMessage(message)
	}
}

// handleIncomingMessage processes messages received from the client
func (c *WebSocketClient) handleIncomingMessage(message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		c.handler.logger.Error().Err(err).Msg("Failed to unmarshal client message")
		return
	}

	// Handle different message types
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "subscribe":
		// Client wants to subscribe to specific events
		// Implementation depends on requirements
		c.handler.logger.Info().Str("client_id", c.clientID).Msg("Client subscription request")

	case "ping":
		// Client ping, respond with pong
		c.sendMessage("pong", map[string]string{"status": "ok"})

	default:
		c.handler.logger.Warn().Str("type", msgType).Msg("Unknown message type from client")
	}
}

// sendMessage sends a message to this specific client
func (c *WebSocketClient) sendMessage(messageType string, data interface{}) {
	message := WebSocketMessage{
		Type:      messageType,
		Timestamp: time.Now(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		c.handler.logger.Error().Err(err).Msg("Failed to marshal message")
		return
	}

	select {
	case c.send <- msgBytes:
	default:
		c.handler.logger.Warn().Str("client_id", c.clientID).Msg("Client send channel full")
	}
}
