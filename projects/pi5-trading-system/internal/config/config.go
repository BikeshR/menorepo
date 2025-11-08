package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

// Config holds all application configuration
type Config struct {
	Server     ServerConfig     `mapstructure:"server"`
	Auth       AuthConfig       `mapstructure:"auth"`
	Database   DatabaseConfig   `mapstructure:"database"`
	Redis      RedisConfig      `mapstructure:"redis"`
	Trading    TradingConfig    `mapstructure:"trading"`
	MarketData MarketDataConfig `mapstructure:"market_data"`
	Logging    LoggingConfig    `mapstructure:"logging"`
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Host              string        `mapstructure:"host"`
	Port              int           `mapstructure:"port"`
	ReadTimeout       time.Duration `mapstructure:"read_timeout"`
	WriteTimeout      time.Duration `mapstructure:"write_timeout"`
	IdleTimeout       time.Duration `mapstructure:"idle_timeout"`
	CORSAllowedOrigins string        `mapstructure:"cors_allowed_origins"` // Comma-separated list or "*"
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	JWTSecret       string        `mapstructure:"jwt_secret"`
	AccessTokenTTL  time.Duration `mapstructure:"access_token_ttl"`
	RefreshTokenTTL time.Duration `mapstructure:"refresh_token_ttl"`
}

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	Database     string `mapstructure:"database"`
	MaxConns     int    `mapstructure:"max_conns"`
	MinConns     int    `mapstructure:"min_conns"`
	MaxConnLife  time.Duration `mapstructure:"max_conn_life"`
}

// RedisConfig holds Redis connection settings
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

// TradingConfig holds trading system configuration
type TradingConfig struct {
	InitialCash    float64          `mapstructure:"initial_cash"`
	DemoMode       bool             `mapstructure:"demo_mode"`
	PaperTrading   bool             `mapstructure:"paper_trading"`
	EventBusBuffer int              `mapstructure:"event_bus_buffer"`
	Strategies     []StrategyConfig `mapstructure:"strategies"`
}

// StrategyConfig holds individual strategy configuration
type StrategyConfig struct {
	ID      string                 `mapstructure:"id"`
	Name    string                 `mapstructure:"name"`
	Enabled bool                   `mapstructure:"enabled"`
	Symbols []string               `mapstructure:"symbols"`
	Params  map[string]interface{} `mapstructure:"params"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level      string `mapstructure:"level"`
	Format     string `mapstructure:"format"` // "json" or "console"
	TimeFormat string `mapstructure:"time_format"`
}

// MarketDataConfig holds market data provider configuration
type MarketDataConfig struct {
	Provider     string                       `mapstructure:"provider"` // "alpaca" or "simulated"
	Alpaca       AlpacaConfig                 `mapstructure:"alpaca"`
	Reconnection ReconnectionConfig           `mapstructure:"reconnection"`
	Backfill     BackfillConfig               `mapstructure:"backfill"`
	Simulated    SimulatedMarketDataConfig    `mapstructure:"simulated"`
}

// AlpacaConfig holds Alpaca-specific configuration
type AlpacaConfig struct {
	APIKey       string `mapstructure:"api_key"`
	APISecret    string `mapstructure:"api_secret"`
	DataURL      string `mapstructure:"data_url"`
	StreamURL    string `mapstructure:"stream_url"`
	PaperTrading bool   `mapstructure:"paper_trading"`
	FeedType     string `mapstructure:"feed_type"` // "iex" or "sip"
}

// ReconnectionConfig holds reconnection settings
type ReconnectionConfig struct {
	MaxAttempts  int           `mapstructure:"max_attempts"`
	InitialDelay time.Duration `mapstructure:"initial_delay"`
	MaxDelay     time.Duration `mapstructure:"max_delay"`
}

// BackfillConfig holds historical data backfill settings
type BackfillConfig struct {
	Enabled       bool   `mapstructure:"enabled"`
	LookbackDays  int    `mapstructure:"lookback_days"`
	Timeframe     string `mapstructure:"timeframe"`
	PublishEvents bool   `mapstructure:"publish_events"`
}

// SimulatedMarketDataConfig holds simulated data settings
type SimulatedMarketDataConfig struct {
	Enabled      bool                        `mapstructure:"enabled"`
	TickInterval time.Duration               `mapstructure:"tick_interval"`
	Symbols      []SimulatedSymbolConfig     `mapstructure:"symbols"`
}

// SimulatedSymbolConfig holds configuration for a simulated symbol
type SimulatedSymbolConfig struct {
	Symbol    string  `mapstructure:"symbol"`
	BasePrice float64 `mapstructure:"base_price"`
}

// Load reads configuration from file and environment variables
func Load(configPath string) (*Config, error) {
	v := viper.New()

	// Set defaults
	setDefaults(v)

	// Read from config file
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Allow environment variables to override
	// Example: PI5_SERVER_PORT=8081
	v.SetEnvPrefix("PI5")
	v.AutomaticEnv()

	// Unmarshal into config struct
	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Override from environment variables if present
	// Server
	if v.IsSet("CORS_ALLOWED_ORIGINS") {
		config.Server.CORSAllowedOrigins = v.GetString("CORS_ALLOWED_ORIGINS")
	}

	// Authentication
	if v.IsSet("JWT_SECRET") {
		config.Auth.JWTSecret = v.GetString("JWT_SECRET")
	}

	// Database
	if v.IsSet("DB_HOST") {
		config.Database.Host = v.GetString("DB_HOST")
	}
	if v.IsSet("DB_PORT") {
		config.Database.Port = v.GetInt("DB_PORT")
	}
	if v.IsSet("DB_USER") {
		config.Database.User = v.GetString("DB_USER")
	}
	if v.IsSet("DB_PASSWORD") {
		config.Database.Password = v.GetString("DB_PASSWORD")
	}
	if v.IsSet("DB_NAME") {
		config.Database.Database = v.GetString("DB_NAME")
	}

	// Redis
	if v.IsSet("REDIS_HOST") {
		config.Redis.Host = v.GetString("REDIS_HOST")
	}
	if v.IsSet("REDIS_PORT") {
		config.Redis.Port = v.GetInt("REDIS_PORT")
	}

	// Market Data - Alpaca
	if v.IsSet("ALPACA_API_KEY") {
		config.MarketData.Alpaca.APIKey = v.GetString("ALPACA_API_KEY")
	}
	if v.IsSet("ALPACA_API_SECRET") {
		config.MarketData.Alpaca.APISecret = v.GetString("ALPACA_API_SECRET")
	}

	return &config, nil
}

// setDefaults sets default configuration values
func setDefaults(v *viper.Viper) {
	// Server defaults
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080) // Fixed: was 8081, correct port is 8080
	v.SetDefault("server.read_timeout", 30*time.Second)
	v.SetDefault("server.write_timeout", 30*time.Second)
	v.SetDefault("server.idle_timeout", 120*time.Second)
	v.SetDefault("server.cors_allowed_origins", "*") // Allow all for development

	// Database defaults
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "pi5trader")
	v.SetDefault("database.password", "trading_secure_2025")
	v.SetDefault("database.database", "pi5_trading")
	v.SetDefault("database.max_conns", 25)
	v.SetDefault("database.min_conns", 5)
	v.SetDefault("database.max_conn_life", 5*time.Minute)

	// Redis defaults
	v.SetDefault("redis.host", "localhost")
	v.SetDefault("redis.port", 6379)
	v.SetDefault("redis.password", "")
	v.SetDefault("redis.db", 0)

	// Trading defaults
	v.SetDefault("trading.initial_cash", 100000.0)
	v.SetDefault("trading.demo_mode", true)
	v.SetDefault("trading.paper_trading", true)
	v.SetDefault("trading.event_bus_buffer", 1000)

	// Logging defaults
	v.SetDefault("logging.level", "info")
	v.SetDefault("logging.format", "json")
	v.SetDefault("logging.time_format", time.RFC3339)
}

// ConnectionString returns a PostgreSQL connection string
func (c *DatabaseConfig) ConnectionString() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=disable",
		c.User,
		c.Password,
		c.Host,
		c.Port,
		c.Database,
	)
}

// RedisAddr returns Redis address in host:port format
func (c *RedisConfig) RedisAddr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
