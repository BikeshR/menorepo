package marketdata

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/pkg/types"
	"github.com/rs/zerolog"
)

// AlpacaClient implements the Provider interface for Alpaca Markets
type AlpacaClient struct {
	config    *Config
	logger    zerolog.Logger
	eventBus  *events.EventBus

	// HTTP client for REST API
	httpClient *http.Client

	// WebSocket connection
	ws *AlpacaWebSocket

	// Connection state
	mu        sync.RWMutex
	connected bool

	// Subscribed symbols
	symbols map[string]bool
}

// NewAlpacaClient creates a new Alpaca market data client
func NewAlpacaClient(config *Config, eventBus *events.EventBus, logger zerolog.Logger) (*AlpacaClient, error) {
	if config.APIKey == "" || config.APISecret == "" {
		return nil, fmt.Errorf("Alpaca API key and secret are required")
	}

	client := &AlpacaClient{
		config:   config,
		logger:   logger.With().Str("component", "alpaca_client").Logger(),
		eventBus: eventBus,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		symbols: make(map[string]bool),
	}

	return client, nil
}

// Connect establishes connection to Alpaca
func (c *AlpacaClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected {
		return fmt.Errorf("already connected")
	}

	c.logger.Info().
		Str("feed_type", c.config.FeedType).
		Bool("paper_trading", c.config.PaperTrading).
		Msg("Connecting to Alpaca market data")

	// Create WebSocket connection for real-time data
	ws, err := NewAlpacaWebSocket(c.config, c.eventBus, c.logger)
	if err != nil {
		return fmt.Errorf("failed to create websocket: %w", err)
	}

	if err := ws.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect websocket: %w", err)
	}

	c.ws = ws
	c.connected = true

	c.logger.Info().Msg("Successfully connected to Alpaca")
	return nil
}

// Disconnect closes the connection
func (c *AlpacaClient) Disconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected {
		return nil
	}

	c.logger.Info().Msg("Disconnecting from Alpaca")

	if c.ws != nil {
		if err := c.ws.Close(); err != nil {
			c.logger.Error().Err(err).Msg("Error closing websocket")
		}
	}

	c.connected = false
	c.logger.Info().Msg("Disconnected from Alpaca")
	return nil
}

// Subscribe subscribes to real-time data for symbols
func (c *AlpacaClient) Subscribe(symbols []string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected {
		return fmt.Errorf("not connected")
	}

	// Track subscribed symbols
	for _, symbol := range symbols {
		c.symbols[symbol] = true
	}

	// Subscribe via WebSocket
	if err := c.ws.Subscribe(symbols); err != nil {
		return fmt.Errorf("failed to subscribe: %w", err)
	}

	c.logger.Info().
		Strs("symbols", symbols).
		Msg("Subscribed to market data")

	return nil
}

// Unsubscribe unsubscribes from symbols
func (c *AlpacaClient) Unsubscribe(symbols []string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected {
		return fmt.Errorf("not connected")
	}

	// Remove from tracked symbols
	for _, symbol := range symbols {
		delete(c.symbols, symbol)
	}

	// Unsubscribe via WebSocket
	if err := c.ws.Unsubscribe(symbols); err != nil {
		return fmt.Errorf("failed to unsubscribe: %w", err)
	}

	c.logger.Info().
		Strs("symbols", symbols).
		Msg("Unsubscribed from market data")

	return nil
}

// GetHistoricalBars fetches historical bar data from Alpaca REST API
func (c *AlpacaClient) GetHistoricalBars(ctx context.Context, symbol string, timeframe string, start, end time.Time) ([]types.Bar, error) {
	c.logger.Debug().
		Str("symbol", symbol).
		Str("timeframe", timeframe).
		Time("start", start).
		Time("end", end).
		Msg("Fetching historical bars")

	// Build URL
	endpoint := fmt.Sprintf("%s/v2/stocks/%s/bars", c.config.DataURL, symbol)

	params := url.Values{}
	params.Add("timeframe", timeframe)
	params.Add("start", start.Format(time.RFC3339))
	params.Add("end", end.Format(time.RFC3339))
	params.Add("feed", c.config.FeedType)
	params.Add("limit", "10000") // Max bars per request

	reqURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())

	// Create request
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication headers
	req.Header.Set("APCA-API-KEY-ID", c.config.APIKey)
	req.Header.Set("APCA-API-SECRET-KEY", c.config.APISecret)

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var apiResp AlpacaBarsResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Convert to our Bar type
	bars := make([]types.Bar, 0, len(apiResp.Bars))
	for _, alpacaBar := range apiResp.Bars {
		bar := types.Bar{
			Symbol:     symbol,
			Timestamp:  alpacaBar.Timestamp,
			Open:       alpacaBar.Open,
			High:       alpacaBar.High,
			Low:        alpacaBar.Low,
			Close:      alpacaBar.Close,
			Volume:     alpacaBar.Volume,
			VWAP:       alpacaBar.VWAP,
			TradeCount: alpacaBar.TradeCount,
		}
		bars = append(bars, bar)
	}

	c.logger.Info().
		Str("symbol", symbol).
		Str("timeframe", timeframe).
		Int("bars_count", len(bars)).
		Msg("Fetched historical bars")

	return bars, nil
}

// IsConnected returns connection status
func (c *AlpacaClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// GetName returns provider name
func (c *AlpacaClient) GetName() string {
	return "alpaca"
}

// GetSubscribedSymbols returns list of subscribed symbols
func (c *AlpacaClient) GetSubscribedSymbols() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	symbols := make([]string, 0, len(c.symbols))
	for symbol := range c.symbols {
		symbols = append(symbols, symbol)
	}
	return symbols
}

// AlpacaBarsResponse represents Alpaca API response for bars
type AlpacaBarsResponse struct {
	Bars      []AlpacaBar `json:"bars"`
	Symbol    string      `json:"symbol"`
	NextPageToken string   `json:"next_page_token,omitempty"`
}

// AlpacaBar represents a bar from Alpaca API
type AlpacaBar struct {
	Timestamp  time.Time `json:"t"`
	Open       float64   `json:"o"`
	High       float64   `json:"h"`
	Low        float64   `json:"l"`
	Close      float64   `json:"c"`
	Volume     int64     `json:"v"`
	VWAP       float64   `json:"vw"`
	TradeCount int       `json:"n"`
}
