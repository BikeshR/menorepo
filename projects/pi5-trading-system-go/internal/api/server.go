package api

import (
	"context"
	"fmt"
	"net/http"
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
	r.Use(middleware.SetHeader("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length"))

	// Handlers
	healthHandler := handlers.NewHealthHandler(db, logger)

	// Routes
	r.Get("/health", healthHandler.Handle)

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"message": "Pi5 Trading System - Go API", "version": "1.0.0"}`))
		})

		// TODO: Add more routes
		// r.Get("/strategies", strategiesHandler.List)
		// r.Post("/strategies/{id}/start", strategiesHandler.Start)
		// r.Post("/strategies/{id}/stop", strategiesHandler.Stop)
		// r.Get("/portfolio", portfolioHandler.Get)
		// r.Get("/orders", ordersHandler.List)
	})

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
