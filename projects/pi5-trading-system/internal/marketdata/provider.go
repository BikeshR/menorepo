package marketdata

import (
	"context"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/pkg/types"
)

// Provider defines the interface for market data providers
// Supports both real-time streaming and historical data fetching
type Provider interface {
	// Connect establishes connection to the market data provider
	Connect(ctx context.Context) error

	// Disconnect closes the connection
	Disconnect() error

	// Subscribe subscribes to real-time market data for given symbols
	Subscribe(symbols []string) error

	// Unsubscribe unsubscribes from market data for given symbols
	Unsubscribe(symbols []string) error

	// GetHistoricalBars fetches historical bar data
	// timeframe: "1Min", "5Min", "15Min", "1H", "1D"
	GetHistoricalBars(ctx context.Context, symbol string, timeframe string, start, end time.Time) ([]types.Bar, error)

	// IsConnected returns true if the provider is connected
	IsConnected() bool

	// GetName returns the provider name
	GetName() string
}

// Config holds configuration for market data providers
type Config struct {
	// Provider type: "alpaca", "iex", "yahoo"
	Provider string `yaml:"provider"`

	// API credentials
	APIKey    string `yaml:"api_key"`
	APISecret string `yaml:"api_secret"`

	// Base URLs
	DataURL      string `yaml:"data_url"`
	StreamURL    string `yaml:"stream_url"`

	// Paper trading mode
	PaperTrading bool `yaml:"paper_trading"`

	// Feed type: "iex" (free) or "sip" (paid)
	FeedType string `yaml:"feed_type"`

	// Reconnection settings
	MaxReconnectAttempts int           `yaml:"max_reconnect_attempts"`
	ReconnectDelay       time.Duration `yaml:"reconnect_delay"`
	MaxReconnectDelay    time.Duration `yaml:"max_reconnect_delay"`
}

// DefaultConfig returns default configuration for Alpaca free tier
func DefaultConfig() *Config {
	return &Config{
		Provider:             "alpaca",
		DataURL:              "https://data.alpaca.markets",
		StreamURL:            "wss://stream.data.alpaca.markets",
		PaperTrading:         true,
		FeedType:             "iex", // Free IEX feed
		MaxReconnectAttempts: 10,
		ReconnectDelay:       2 * time.Second,
		MaxReconnectDelay:    30 * time.Second,
	}
}

// BarHandler is called when a new bar is received
type BarHandler func(bar *types.Bar) error

// TradeHandler is called when a new trade is received (for tick data)
type TradeHandler func(trade *types.Trade) error

// QuoteHandler is called when a new quote is received (for level 1 data)
type QuoteHandler func(quote *types.Quote) error

// ErrorHandler is called when an error occurs
type ErrorHandler func(err error)
