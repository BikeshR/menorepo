package circuitbreaker

import (
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// State represents the circuit breaker state
type State int

const (
	StateClosed State = iota
	StateOpen
	StateHalfOpen
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// Config holds circuit breaker configuration
type Config struct {
	// Name of the circuit breaker (for logging)
	Name string

	// MaxFailures is the number of consecutive failures before opening
	MaxFailures int

	// Timeout is how long to wait in open state before trying half-open
	Timeout time.Duration

	// MaxRequests is the max number of requests allowed in half-open state
	MaxRequests int

	// Logger for circuit breaker events
	Logger zerolog.Logger
}

// DefaultConfig returns sensible defaults for Pi5
func DefaultConfig(name string, logger zerolog.Logger) Config {
	return Config{
		Name:        name,
		MaxFailures: 5,              // Open after 5 consecutive failures
		Timeout:     30 * time.Second, // Try half-open after 30s
		MaxRequests: 3,              // Allow 3 requests in half-open
		Logger:      logger,
	}
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	config Config

	mu              sync.RWMutex
	state           State
	failures        int
	consecutiveSucc int
	lastStateChange time.Time
	halfOpenReqs    int
}

// New creates a new circuit breaker
func New(config Config) *CircuitBreaker {
	if config.MaxFailures <= 0 {
		config.MaxFailures = 5
	}
	if config.Timeout <= 0 {
		config.Timeout = 30 * time.Second
	}
	if config.MaxRequests <= 0 {
		config.MaxRequests = 3
	}

	return &CircuitBreaker{
		config:          config,
		state:           StateClosed,
		lastStateChange: time.Now(),
	}
}

// Execute wraps a function call with circuit breaker logic
func (cb *CircuitBreaker) Execute(fn func() error) error {
	if err := cb.beforeRequest(); err != nil {
		return err
	}

	err := fn()

	cb.afterRequest(err)

	return err
}

// beforeRequest checks if the request should be allowed
func (cb *CircuitBreaker) beforeRequest() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return nil

	case StateOpen:
		// Check if timeout has passed
		if time.Since(cb.lastStateChange) > cb.config.Timeout {
			cb.setState(StateHalfOpen)
			cb.halfOpenReqs = 0
			cb.config.Logger.Info().
				Str("breaker", cb.config.Name).
				Msg("Circuit breaker entering half-open state")
			return nil
		}
		return fmt.Errorf("circuit breaker '%s' is open", cb.config.Name)

	case StateHalfOpen:
		if cb.halfOpenReqs >= cb.config.MaxRequests {
			return fmt.Errorf("circuit breaker '%s' half-open limit reached", cb.config.Name)
		}
		cb.halfOpenReqs++
		return nil

	default:
		return fmt.Errorf("unknown circuit breaker state")
	}
}

// afterRequest updates the circuit breaker state based on the result
func (cb *CircuitBreaker) afterRequest(err error) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.onFailure()
	} else {
		cb.onSuccess()
	}
}

// onFailure handles a failed request
func (cb *CircuitBreaker) onFailure() {
	cb.failures++
	cb.consecutiveSucc = 0

	switch cb.state {
	case StateClosed:
		if cb.failures >= cb.config.MaxFailures {
			cb.setState(StateOpen)
			cb.config.Logger.Warn().
				Str("breaker", cb.config.Name).
				Int("failures", cb.failures).
				Msg("Circuit breaker opened due to failures")
		}

	case StateHalfOpen:
		cb.setState(StateOpen)
		cb.config.Logger.Warn().
			Str("breaker", cb.config.Name).
			Msg("Circuit breaker re-opened after half-open failure")
	}
}

// onSuccess handles a successful request
func (cb *CircuitBreaker) onSuccess() {
	cb.consecutiveSucc++

	switch cb.state {
	case StateClosed:
		cb.failures = 0

	case StateHalfOpen:
		if cb.consecutiveSucc >= cb.config.MaxRequests {
			cb.setState(StateClosed)
			cb.failures = 0
			cb.config.Logger.Info().
				Str("breaker", cb.config.Name).
				Msg("Circuit breaker closed after successful half-open requests")
		}
	}
}

// setState changes the circuit breaker state
func (cb *CircuitBreaker) setState(state State) {
	cb.state = state
	cb.lastStateChange = time.Now()
}

// GetState returns the current circuit breaker state (for monitoring)
func (cb *CircuitBreaker) GetState() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// GetMetrics returns circuit breaker metrics
func (cb *CircuitBreaker) GetMetrics() map[string]interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	return map[string]interface{}{
		"name":                cb.config.Name,
		"state":               cb.state.String(),
		"failures":            cb.failures,
		"consecutive_success": cb.consecutiveSucc,
		"last_state_change":   cb.lastStateChange.Format(time.RFC3339),
	}
}
