package handlers

import (
	"net/http"

	"github.com/yourusername/go-web-api/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// HealthHandler handles health check requests
type HealthHandler struct {
	db *gorm.DB
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
}

// Check godoc
// @Summary Health check
// @Description Check the health of the API and its dependencies
// @Tags health
// @Produce json
// @Success 200 {object} response.Response{data=HealthResponse}
// @Failure 503 {object} response.Response
// @Router /health [get]
func (h *HealthHandler) Check(c *gin.Context) {
	dbStatus := "connected"

	// Check database connection
	sqlDB, err := h.db.DB()
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "disconnected"
		response.Success(c, http.StatusServiceUnavailable, "Service unhealthy", HealthResponse{
			Status:   "unhealthy",
			Database: dbStatus,
		})
		return
	}

	response.Success(c, http.StatusOK, "Service healthy", HealthResponse{
		Status:   "healthy",
		Database: dbStatus,
	})
}
