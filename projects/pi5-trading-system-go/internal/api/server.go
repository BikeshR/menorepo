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

	"github.com/bikeshrana/pi5-trading-system-go/internal/api/handlers"
	"github.com/bikeshrana/pi5-trading-system-go/internal/config"
	"github.com/bikeshrana/pi5-trading-system-go/internal/data/timescale"
)

// Server wraps the HTTP server
type Server struct {
	router *chi.Mux
	server *http.Server
	logger zerolog.Logger
}

// NewServer creates a new HTTP server
func NewServer(cfg *config.ServerConfig, db *timescale.Client, logger zerolog.Logger) *Server {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(LoggingMiddleware(logger))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS middleware for development
	r.Use(middleware.SetHeader("Access-Control-Allow-Origin", "*"))
	r.Use(middleware.SetHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"))
	r.Use(middleware.SetHeader("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Authorization"))

	// Handlers
	healthHandler := handlers.NewHealthHandler(db, logger)
	authHandler := handlers.NewAuthHandler(logger)
	strategiesHandler := handlers.NewStrategiesHandler(logger)
	portfolioHandler := handlers.NewPortfolioHandler(logger)
	ordersHandler := handlers.NewOrdersHandler(logger)
	systemHandler := handlers.NewSystemHandler(logger)

	// Routes
	r.Get("/health", healthHandler.Handle)

	// Authentication routes (no auth required)
	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", authHandler.Login)
		r.Post("/logout", authHandler.Logout)
		r.Post("/refresh", authHandler.RefreshToken)
		r.Get("/me", authHandler.GetCurrentUser)
	})

	// API routes (with auth - TODO: add auth middleware)
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"message": "Pi5 Trading System - Go API", "version": "1.0.0"}`))
		})

		// Strategies routes
		r.Route("/strategies", func(r chi.Router) {
			r.Get("/", strategiesHandler.GetAvailableStrategies)
			r.Get("/active", strategiesHandler.GetActiveStrategies)
			r.Post("/", strategiesHandler.CreateStrategy)
			r.Get("/{strategyId}", strategiesHandler.GetStrategy)
			r.Put("/{strategyId}", strategiesHandler.UpdateStrategy)
			r.Delete("/{strategyId}", strategiesHandler.DeleteStrategy)
			r.Post("/{strategyId}/action", strategiesHandler.ControlStrategy)
			r.Get("/{strategyId}/performance", strategiesHandler.GetStrategyPerformance)
		})

		// Portfolio routes
		r.Route("/portfolio", func(r chi.Router) {
			r.Get("/summary", portfolioHandler.GetPortfolioSummary)
			r.Get("/positions", portfolioHandler.GetPositions)
			r.Get("/positions/{symbol}", portfolioHandler.GetPosition)
			r.Get("/performance", portfolioHandler.GetPortfolioPerformance)
			r.Get("/history", portfolioHandler.GetPortfolioHistory)
			r.Get("/allocation", portfolioHandler.GetPortfolioAllocation)
		})

		// Orders routes
		r.Route("/orders", func(r chi.Router) {
			r.Get("/", ordersHandler.GetOrders)
			r.Post("/", ordersHandler.CreateOrder)
			r.Get("/{orderId}", ordersHandler.GetOrder)
			r.Delete("/{orderId}", ordersHandler.CancelOrder)
			r.Get("/trades/history", ordersHandler.GetTrades)
		})

		// System routes
		r.Route("/system", func(r chi.Router) {
			r.Get("/health", systemHandler.GetSystemHealth)
			r.Get("/metrics", systemHandler.GetSystemMetrics)
			r.Get("/status", systemHandler.GetSystemStatus)
			r.Post("/restart", systemHandler.RestartSystem)
		})
	})

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

	return &Server{
		router: r,
		server: httpServer,
		logger: logger,
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
