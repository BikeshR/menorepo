package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/bikeshrana/pi5-trading-system-go/internal/api/handlers"
	"github.com/bikeshrana/pi5-trading-system-go/internal/audit"
	"github.com/bikeshrana/pi5-trading-system-go/internal/auth"
	"github.com/bikeshrana/pi5-trading-system-go/internal/circuitbreaker"
	"github.com/bikeshrana/pi5-trading-system-go/internal/config"
	"github.com/bikeshrana/pi5-trading-system-go/internal/core/events"
	"github.com/bikeshrana/pi5-trading-system-go/internal/data"
	"github.com/bikeshrana/pi5-trading-system-go/internal/data/timescale"
	"github.com/bikeshrana/pi5-trading-system-go/internal/metrics"
	custommiddleware "github.com/bikeshrana/pi5-trading-system-go/internal/middleware"
)

// Server wraps the HTTP server
type Server struct {
	router    *chi.Mux
	server    *http.Server
	logger    zerolog.Logger
	wsHandler *handlers.WebSocketHandler
}

// NewServer creates a new HTTP server with repositories, event bus, and circuit breaker manager
func NewServer(cfg *config.ServerConfig, authCfg *config.AuthConfig, db *timescale.Client, eventBus *events.EventBus, auditLogger *audit.AuditLogger, cbManager *circuitbreaker.Manager, logger zerolog.Logger) *Server {
	r := chi.NewRouter()

	// Initialize Prometheus metrics
	tradingMetrics := metrics.NewTradingMetrics("pi5_trading")

	// Initialize repositories
	portfolioRepo := data.NewPortfolioRepository(db.GetPool(), logger)
	ordersRepo := data.NewOrdersRepository(db.GetPool(), logger)
	strategiesRepo := data.NewStrategiesRepository(db.GetPool(), logger)
	userRepo := data.NewUserRepository(db.GetPool(), logger)

	// Initialize schemas
	ctx := context.Background()
	if err := portfolioRepo.InitSchema(ctx); err != nil {
		logger.Error().Err(err).Msg("Failed to initialize portfolio schema")
	}
	if err := ordersRepo.InitSchema(ctx); err != nil {
		logger.Error().Err(err).Msg("Failed to initialize orders schema")
	}
	if err := strategiesRepo.InitSchema(ctx); err != nil {
		logger.Error().Err(err).Msg("Failed to initialize strategies schema")
	}
	if err := userRepo.InitSchema(ctx); err != nil {
		logger.Error().Err(err).Msg("Failed to initialize user schema")
	}

	// Initialize JWT service
	jwtService := auth.NewJWTService(authCfg.JWTSecret, logger)

	// Initialize auth middleware
	authMiddleware := auth.NewAuthMiddleware(jwtService, logger)

	// Initialize rate limiter
	rateLimiterConfig := custommiddleware.GetDefaultConfig()
	rateLimiter := custommiddleware.NewRateLimiter(rateLimiterConfig, logger)

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(LoggingMiddleware(logger))
	r.Use(middleware.Recoverer)
	r.Use(rateLimiter.Limit)  // Add rate limiting
	r.Use(metrics.HTTPMetricsMiddleware(tradingMetrics))  // Add Prometheus metrics
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS middleware for development
	r.Use(middleware.SetHeader("Access-Control-Allow-Origin", "*"))
	r.Use(middleware.SetHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"))
	r.Use(middleware.SetHeader("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Authorization"))

	// Handlers
	healthHandler := handlers.NewHealthHandler(db, logger)
	authHandler := handlers.NewAuthHandler(userRepo, jwtService, logger)
	strategiesHandler := handlers.NewStrategiesHandler(strategiesRepo, eventBus, logger)
	portfolioHandler := handlers.NewPortfolioHandler(portfolioRepo, logger)
	ordersHandler := handlers.NewOrdersHandler(ordersRepo, eventBus, logger)
	systemHandler := handlers.NewSystemHandler(cbManager, logger)
	auditHandler := handlers.NewAuditHandler(auditLogger, logger)
	wsHandler := handlers.NewWebSocketHandler(logger, eventBus)

	// Routes
	r.Get("/health", healthHandler.Handle)

	// Prometheus metrics endpoint (no auth required for VictoriaMetrics scraping)
	r.Get("/metrics", promhttp.Handler().ServeHTTP)

	// Authentication routes (no auth required)
	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", authHandler.Login)
		r.Post("/logout", authHandler.Logout)
		r.Post("/refresh", authHandler.RefreshToken)
		r.Get("/me", authHandler.GetCurrentUser)
	})

	// API routes (with JWT authentication)
	r.Route("/api/v1", func(r chi.Router) {
		// Apply auth middleware to all API routes
		r.Use(authMiddleware.Authenticate)

		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"message": "Pi5 Trading System - Go API", "version": "1.0.0"}`))
		})

		// Strategies routes (require trader or admin role)
		r.Route("/strategies", func(r chi.Router) {
			r.Get("/", strategiesHandler.GetAvailableStrategies)
			r.Get("/active", strategiesHandler.GetActiveStrategies)
			r.With(authMiddleware.RequireRole("admin", "trader")).Post("/", strategiesHandler.CreateStrategy)
			r.Get("/{strategyId}", strategiesHandler.GetStrategy)
			r.With(authMiddleware.RequireRole("admin", "trader")).Put("/{strategyId}", strategiesHandler.UpdateStrategy)
			r.With(authMiddleware.RequireRole("admin")).Delete("/{strategyId}", strategiesHandler.DeleteStrategy)
			r.With(authMiddleware.RequireRole("admin", "trader")).Post("/{strategyId}/action", strategiesHandler.ControlStrategy)
			r.Get("/{strategyId}/performance", strategiesHandler.GetStrategyPerformance)
		})

		// Portfolio routes (all authenticated users can view)
		r.Route("/portfolio", func(r chi.Router) {
			r.Get("/summary", portfolioHandler.GetPortfolioSummary)
			r.Get("/positions", portfolioHandler.GetPositions)
			r.Get("/positions/{symbol}", portfolioHandler.GetPosition)
			r.Get("/performance", portfolioHandler.GetPortfolioPerformance)
			r.Get("/history", portfolioHandler.GetPortfolioHistory)
			r.Get("/allocation", portfolioHandler.GetPortfolioAllocation)
		})

		// Orders routes (require trader or admin role for creation/cancellation)
		r.Route("/orders", func(r chi.Router) {
			r.Get("/", ordersHandler.GetOrders)
			r.With(authMiddleware.RequireRole("admin", "trader")).Post("/", ordersHandler.CreateOrder)
			r.Get("/{orderId}", ordersHandler.GetOrder)
			r.With(authMiddleware.RequireRole("admin", "trader")).Delete("/{orderId}", ordersHandler.CancelOrder)
			r.Get("/trades/history", ordersHandler.GetTrades)
		})

		// System routes (admin only)
		r.Route("/system", func(r chi.Router) {
			r.Use(authMiddleware.RequireRole("admin"))
			r.Get("/health", systemHandler.GetSystemHealth)
			r.Get("/metrics", systemHandler.GetSystemMetrics)
			r.Get("/status", systemHandler.GetSystemStatus)
			r.Get("/circuit-breakers", systemHandler.GetCircuitBreakers)
			r.Post("/restart", systemHandler.RestartSystem)
		})

		// Audit routes (admin only)
		r.Route("/audit", func(r chi.Router) {
			r.Use(authMiddleware.RequireRole("admin"))
			r.Get("/logs", auditHandler.GetAuditLogs)
		})
	})

	// WebSocket endpoint
	r.Get("/ws", wsHandler.HandleConnection)

	// Serve static files from dashboard/dist (built React app)
	workDir, _ := os.Getwd()
	staticPath := filepath.Join(workDir, "dashboard", "dist")

	// Check if dist directory exists
	if _, err := os.Stat(staticPath); err == nil {
		// Serve static files
		fileServer := http.FileServer(http.Dir(staticPath))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Try to serve the file
			filePath := filepath.Join(staticPath, r.URL.Path)
			if _, err := os.Stat(filePath); os.IsNotExist(err) || strings.HasSuffix(r.URL.Path, "/") {
				// If file doesn't exist or is a directory, serve index.html (SPA)
				http.ServeFile(w, r, filepath.Join(staticPath, "index.html"))
				return
			}
			fileServer.ServeHTTP(w, r)
		})
		logger.Info().Str("path", staticPath).Msg("Serving static files from dashboard/dist")
	} else {
		logger.Warn().Str("path", staticPath).Msg("Dashboard dist directory not found - run 'cd dashboard && npm run build'")
	}

	// Create HTTP server
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	// Start WebSocket event listener
	go wsHandler.StartEventListener(context.Background())

	return &Server{
		router:    r,
		server:    httpServer,
		logger:    logger,
		wsHandler: wsHandler,
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	s.logger.Info().
		Str("addr", s.server.Addr).
		Msg("Starting HTTP server")

	if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("failed to start server: %w", err)
	}

	return nil
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info().Msg("Shutting down HTTP server")

	if err := s.server.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to shutdown server: %w", err)
	}

	s.logger.Info().Msg("HTTP server stopped")
	return nil
}

// LoggingMiddleware logs HTTP requests using zerolog
func LoggingMiddleware(logger zerolog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrap response writer to capture status code
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			// Process request
			next.ServeHTTP(ww, r)

			// Log request
			logger.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("remote_addr", r.RemoteAddr).
				Int("status", ww.Status()).
				Int("bytes", ww.BytesWritten()).
				Dur("duration", time.Since(start)).
				Msg("HTTP request")
		})
	}
}
