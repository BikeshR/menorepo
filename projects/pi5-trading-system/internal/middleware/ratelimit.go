package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

// RateLimiter defines rate limiting configuration
type RateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	logger   zerolog.Logger

	// Global limits
	globalRate     rate.Limit
	globalBurst    int

	// Endpoint-specific limits
	endpointLimits map[string]*EndpointLimit

	// Cleanup interval
	cleanupInterval time.Duration
}

// EndpointLimit defines rate limit for specific endpoints
type EndpointLimit struct {
	Rate  rate.Limit
	Burst int
}

// visitor represents a rate limiter for a specific visitor
type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimitConfig defines rate limiter configuration
type RateLimitConfig struct {
	RequestsPerSecond float64
	Burst             int
	CleanupInterval   time.Duration

	// Endpoint-specific limits (requests per second)
	OrderEndpointRPS    float64
	TradeEndpointRPS    float64
	StrategyEndpointRPS float64
	DataEndpointRPS     float64
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(config RateLimitConfig, logger zerolog.Logger) *RateLimiter {
	rl := &RateLimiter{
		visitors:        make(map[string]*visitor),
		logger:          logger,
		globalRate:      rate.Limit(config.RequestsPerSecond),
		globalBurst:     config.Burst,
		endpointLimits:  make(map[string]*EndpointLimit),
		cleanupInterval: config.CleanupInterval,
	}

	// Set endpoint-specific limits
	if config.OrderEndpointRPS > 0 {
		rl.endpointLimits["/api/v1/orders"] = &EndpointLimit{
			Rate:  rate.Limit(config.OrderEndpointRPS),
			Burst: max(int(config.OrderEndpointRPS), 1),
		}
	}

	if config.TradeEndpointRPS > 0 {
		rl.endpointLimits["/api/v1/orders/trades"] = &EndpointLimit{
			Rate:  rate.Limit(config.TradeEndpointRPS),
			Burst: max(int(config.TradeEndpointRPS), 1),
		}
	}

	if config.StrategyEndpointRPS > 0 {
		rl.endpointLimits["/api/v1/strategies"] = &EndpointLimit{
			Rate:  rate.Limit(config.StrategyEndpointRPS),
			Burst: max(int(config.StrategyEndpointRPS), 1),
		}
	}

	if config.DataEndpointRPS > 0 {
		rl.endpointLimits["/api/v1/portfolio"] = &EndpointLimit{
			Rate:  rate.Limit(config.DataEndpointRPS),
			Burst: max(int(config.DataEndpointRPS), 1),
		}
	}

	// Start cleanup goroutine
	go rl.cleanupVisitors()

	logger.Info().
		Float64("global_rps", config.RequestsPerSecond).
		Int("global_burst", config.Burst).
		Msg("Rate limiter initialized")

	return rl
}

// Limit returns a middleware that limits requests
func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get client identifier (IP or user ID if authenticated)
		clientID := rl.getClientIdentifier(r)

		// Check if request is allowed
		if !rl.allow(clientID, r.URL.Path) {
			rl.logger.Warn().
				Str("client_id", clientID).
				Str("path", r.URL.Path).
				Str("method", r.Method).
				Msg("Rate limit exceeded")

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error": "rate limit exceeded", "message": "Too many requests. Please try again later."}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// allow checks if a request is allowed for a client
func (rl *RateLimiter) allow(clientID, path string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Get or create visitor
	v, exists := rl.visitors[clientID]
	if !exists {
		// Determine rate limit based on endpoint
		limit := rl.getEndpointLimit(path)
		v = &visitor{
			limiter:  rate.NewLimiter(limit.Rate, limit.Burst),
			lastSeen: time.Now(),
		}
		rl.visitors[clientID] = v
	}

	// Update last seen
	v.lastSeen = time.Now()

	// Check if request is allowed
	return v.limiter.Allow()
}

// getEndpointLimit returns the rate limit for a specific endpoint
func (rl *RateLimiter) getEndpointLimit(path string) EndpointLimit {
	// Check for exact match
	if limit, exists := rl.endpointLimits[path]; exists {
		return *limit
	}

	// Check for prefix match (e.g., /api/v1/orders/123 matches /api/v1/orders)
	for endpoint, limit := range rl.endpointLimits {
		if len(path) >= len(endpoint) && path[:len(endpoint)] == endpoint {
			return *limit
		}
	}

	// Return global limit
	return EndpointLimit{
		Rate:  rl.globalRate,
		Burst: rl.globalBurst,
	}
}

// getClientIdentifier returns a unique identifier for the client
func (rl *RateLimiter) getClientIdentifier(r *http.Request) string {
	// Try to get user ID from context (if authenticated)
	if userID := r.Context().Value("user_id"); userID != nil {
		if uid, ok := userID.(string); ok && uid != "" {
			return "user:" + uid
		}
	}

	// Fallback to IP address
	// Try X-Forwarded-For first (for proxied requests)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return "ip:" + xff
	}

	// Use X-Real-IP if available
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return "ip:" + xri
	}

	// Fallback to RemoteAddr
	return "ip:" + r.RemoteAddr
}

// cleanupVisitors removes old visitors periodically
func (rl *RateLimiter) cleanupVisitors() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()

		// Remove visitors not seen in the last 3 minutes
		threshold := time.Now().Add(-3 * time.Minute)
		for id, v := range rl.visitors {
			if v.lastSeen.Before(threshold) {
				delete(rl.visitors, id)
			}
		}

		rl.logger.Debug().
			Int("active_visitors", len(rl.visitors)).
			Msg("Cleaned up rate limiter visitors")

		rl.mu.Unlock()
	}
}

// GetStats returns current rate limiter statistics
func (rl *RateLimiter) GetStats() map[string]interface{} {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	return map[string]interface{}{
		"active_visitors":     len(rl.visitors),
		"global_rate":         float64(rl.globalRate),
		"global_burst":        rl.globalBurst,
		"endpoint_limits":     len(rl.endpointLimits),
	}
}

// GetDefaultConfig returns sensible default rate limit configuration
func GetDefaultConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerSecond:   10.0,  // 10 requests per second globally
		Burst:               20,    // Allow burst of 20 requests
		CleanupInterval:     1 * time.Minute,

		// Endpoint-specific limits
		OrderEndpointRPS:    5.0,   // 5 orders per second
		TradeEndpointRPS:    10.0,  // 10 trade queries per second
		StrategyEndpointRPS: 2.0,   // 2 strategy changes per second
		DataEndpointRPS:     15.0,  // 15 data queries per second
	}
}

// GetLiberalConfig returns more permissive rate limits for development
func GetLiberalConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerSecond:   100.0,
		Burst:               200,
		CleanupInterval:     5 * time.Minute,

		OrderEndpointRPS:    50.0,
		TradeEndpointRPS:    100.0,
		StrategyEndpointRPS: 20.0,
		DataEndpointRPS:     150.0,
	}
}

// GetStrictConfig returns strict rate limits for production
func GetStrictConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerSecond:   5.0,
		Burst:               10,
		CleanupInterval:     1 * time.Minute,

		OrderEndpointRPS:    2.0,
		TradeEndpointRPS:    5.0,
		StrategyEndpointRPS: 1.0,
		DataEndpointRPS:     10.0,
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// IPRateLimiter is a simpler IP-based rate limiter
type IPRateLimiter struct {
	ips    map[string]*rate.Limiter
	mu     sync.RWMutex
	r      rate.Limit
	b      int
	logger zerolog.Logger
}

// NewIPRateLimiter creates a new IP-based rate limiter
func NewIPRateLimiter(r rate.Limit, b int, logger zerolog.Logger) *IPRateLimiter {
	return &IPRateLimiter{
		ips:    make(map[string]*rate.Limiter),
		r:      r,
		b:      b,
		logger: logger,
	}
}

// AddIP creates a new rate limiter for an IP address
func (i *IPRateLimiter) AddIP(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	limiter := rate.NewLimiter(i.r, i.b)
	i.ips[ip] = limiter

	return limiter
}

// GetLimiter returns the rate limiter for an IP
func (i *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	limiter, exists := i.ips[ip]

	if !exists {
		limiter = rate.NewLimiter(i.r, i.b)
		i.ips[ip] = limiter
	}

	i.mu.Unlock()

	return limiter
}

// Limit returns a middleware for IP-based rate limiting
func (i *IPRateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limiter := i.GetLimiter(r.RemoteAddr)
		if !limiter.Allow() {
			i.logger.Warn().
				Str("ip", r.RemoteAddr).
				Str("path", r.URL.Path).
				Msg("IP rate limit exceeded")

			http.Error(w, fmt.Sprintf("Rate limit exceeded for IP %s", r.RemoteAddr), http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}
