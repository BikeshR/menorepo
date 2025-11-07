package circuitbreaker

import (
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// Manager manages multiple circuit breakers
type Manager struct {
	mu       sync.RWMutex
	breakers map[string]*CircuitBreaker
	logger   zerolog.Logger
}

// NewManager creates a new circuit breaker manager
func NewManager(logger zerolog.Logger) *Manager {
	return &Manager{
		breakers: make(map[string]*CircuitBreaker),
		logger:   logger,
	}
}

// GetOrCreate gets an existing circuit breaker or creates a new one
func (m *Manager) GetOrCreate(name string, config Config) *CircuitBreaker {
	m.mu.RLock()
	if breaker, exists := m.breakers[name]; exists {
		m.mu.RUnlock()
		return breaker
	}
	m.mu.RUnlock()

	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock
	if breaker, exists := m.breakers[name]; exists {
		return breaker
	}

	config.Name = name
	config.Logger = m.logger
	breaker := New(config)
	m.breakers[name] = breaker

	m.logger.Info().
		Str("breaker", name).
		Int("max_failures", config.MaxFailures).
		Dur("timeout", config.Timeout).
		Msg("Created circuit breaker")

	return breaker
}

// Get returns an existing circuit breaker
func (m *Manager) Get(name string) (*CircuitBreaker, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	breaker, exists := m.breakers[name]
	return breaker, exists
}

// GetAllMetrics returns metrics for all circuit breakers
func (m *Manager) GetAllMetrics() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	metrics := make(map[string]interface{})
	for name, breaker := range m.breakers {
		metrics[name] = breaker.GetMetrics()
	}

	return metrics
}

// DefaultDatabaseConfig returns Pi5-optimized config for database operations
func DefaultDatabaseConfig() Config {
	return Config{
		MaxFailures: 3,               // Database should fail fast
		Timeout:     10 * time.Second, // Retry after 10s
		MaxRequests: 2,               // Conservative for database
	}
}

// DefaultExternalAPIConfig returns Pi5-optimized config for external APIs
func DefaultExternalAPIConfig() Config {
	return Config{
		MaxFailures: 5,              // APIs can be flaky
		Timeout:     30 * time.Second, // Give APIs more time to recover
		MaxRequests: 3,
	}
}
