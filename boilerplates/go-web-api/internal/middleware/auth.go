package middleware

import (
	"net/http"
	"strings"

	"github.com/yourusername/go-web-api/internal/config"
	"github.com/yourusername/go-web-api/internal/utils"
	"github.com/yourusername/go-web-api/pkg/response"

	"github.com/gin-gonic/gin"
)

// Auth returns a gin middleware for JWT authentication
func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Error(c, http.StatusUnauthorized, "Authorization header required", nil)
			c.Abort()
			return
		}

		// Check Bearer token format
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Error(c, http.StatusUnauthorized, "Invalid authorization header format", nil)
			c.Abort()
			return
		}

		token := parts[1]

		// Validate token
		claims, err := utils.ValidateToken(token, cfg.JWTSecret)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "Invalid or expired token", err)
			c.Abort()
			return
		}

		// Set user ID in context
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)

		c.Next()
	}
}
