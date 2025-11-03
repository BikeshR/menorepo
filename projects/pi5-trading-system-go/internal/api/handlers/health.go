package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/bikeshrana/pi5-trading-system-go/internal/data/timescale"
	"github.com/rs/zerolog"
)

// HealthHandler handles health check requests
type HealthHandler struct {
	db     *timescale.Client
	logger zerolog.Logger
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *timescale.Client, logger zerolog.Logger) *HealthHandler {
	return &HealthHandler{
		db:     db,
		logger: logger,
	}
}

// HealthResponse is the health check response
type HealthResponse struct {
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Version   string                 `json:"version"`
	Checks    map[string]HealthCheck `json:"checks"`
}

// HealthCheck represents a single health check
type HealthCheck struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

// Handle responds to health check requests
func (h *HealthHandler) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	response := HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now(),
		Version:   "1.0.0",
		Checks:    make(map[string]HealthCheck),
	}

	// Check database
	if err := h.db.Health(ctx); err != nil {
		response.Status = "unhealthy"
		response.Checks["database"] = HealthCheck{
			Status:  "unhealthy",
			Message: err.Error(),
		}
	} else {
		response.Checks["database"] = HealthCheck{
			Status: "healthy",
		}
	}

	// Set status code
	statusCode := http.StatusOK
	if response.Status == "unhealthy" {
		statusCode = http.StatusServiceUnavailable
	}

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error().Err(err).Msg("Failed to encode health response")
	}
}
