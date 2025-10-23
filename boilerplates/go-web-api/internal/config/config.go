package config

import (
	"os"
	"strconv"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Config holds all application configuration
type Config struct {
	AppName  string
	AppEnv   string
	AppPort  string
	AppDebug bool

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	JWTSecret string
	JWTExpiry string

	CORSAllowedOrigins []string
	CORSAllowedMethods []string
	CORSAllowedHeaders []string

	LogLevel string
}

// Load reads configuration from environment variables
func Load() *Config {
	return &Config{
		AppName:  getEnv("APP_NAME", "go-web-api"),
		AppEnv:   getEnv("APP_ENV", "development"),
		AppPort:  getEnv("APP_PORT", "8080"),
		AppDebug: getEnvBool("APP_DEBUG", true),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "go_web_api"),
		DBSSLMode:  getEnv("DB_SSL_MODE", "disable"),

		JWTSecret: getEnv("JWT_SECRET", "your-secret-key"),
		JWTExpiry: getEnv("JWT_EXPIRY", "24h"),

		CORSAllowedOrigins: getEnvSlice("CORS_ALLOWED_ORIGINS", []string{"*"}),
		CORSAllowedMethods: getEnvSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		CORSAllowedHeaders: getEnvSlice("CORS_ALLOWED_HEADERS", []string{"Origin", "Content-Type", "Authorization"}),

		LogLevel: getEnv("LOG_LEVEL", "debug"),
	}
}

// InitLogger initializes the zerolog logger
func InitLogger(cfg *Config) *zerolog.Logger {
	// Set log level
	level := zerolog.InfoLevel
	switch cfg.LogLevel {
	case "debug":
		level = zerolog.DebugLevel
	case "info":
		level = zerolog.InfoLevel
	case "warn":
		level = zerolog.WarnLevel
	case "error":
		level = zerolog.ErrorLevel
	}
	zerolog.SetGlobalLevel(level)

	// Pretty logging for development
	if cfg.AppEnv == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	logger := log.With().
		Str("app", cfg.AppName).
		Str("env", cfg.AppEnv).
		Logger()

	return &logger
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		boolValue, err := strconv.ParseBool(value)
		if err != nil {
			return defaultValue
		}
		return boolValue
	}
	return defaultValue
}

func getEnvSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		var result []string
		for i := 0; i < len(value); {
			start := i
			for i < len(value) && value[i] != ',' {
				i++
			}
			if i > start {
				result = append(result, value[start:i])
			}
			i++
		}
		return result
	}
	return defaultValue
}
