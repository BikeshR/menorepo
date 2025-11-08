package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/audit"
)

// AuditHandler handles audit log HTTP requests
type AuditHandler struct {
	auditLogger *audit.AuditLogger
	logger      zerolog.Logger
}

// NewAuditHandler creates a new audit handler
func NewAuditHandler(auditLogger *audit.AuditLogger, logger zerolog.Logger) *AuditHandler {
	return &AuditHandler{
		auditLogger: auditLogger,
		logger:      logger,
	}
}

// GetAuditLogs returns audit logs with optional filters
// GET /api/v1/audit/logs
func (h *AuditHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	// Parse filters from query parameters
	filters := audit.AuditQueryFilters{
		EventType: audit.EventType(query.Get("event_type")),
		UserID:    query.Get("user_id"),
		Resource:  query.Get("resource"),
		Status:    query.Get("status"),
		Limit:     100, // default
	}

	// Parse start_time
	if startTimeStr := query.Get("start_time"); startTimeStr != "" {
		if startTime, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			filters.StartTime = startTime
		}
	}

	// Parse end_time
	if endTimeStr := query.Get("end_time"); endTimeStr != "" {
		if endTime, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			filters.EndTime = endTime
		}
	}

	// Parse limit
	if limitStr := query.Get("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil && limit > 0 {
			if limit > 1000 {
				limit = 1000 // max 1000 records
			}
			filters.Limit = limit
		}
	}

	// Query audit logs
	events, err := h.auditLogger.QueryAuditLogs(r.Context(), filters)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to query audit logs")
		http.Error(w, "Failed to retrieve audit logs", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
