package middleware

import (
	"strings"

	"github.com/yourusername/go-web-api/internal/config"

	"github.com/gin-gonic/gin"
)

// CORS returns a gin middleware for handling CORS
func CORS(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		allowedOrigins := cfg.CORSAllowedOrigins
		isAllowed := false
		for _, allowed := range allowedOrigins {
			if allowed == "*" || allowed == origin {
				isAllowed = true
				break
			}
		}

		if isAllowed {
			if origin != "" {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			} else if len(allowedOrigins) > 0 && allowedOrigins[0] == "*" {
				c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
			}

			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Methods", strings.Join(cfg.CORSAllowedMethods, ","))
			c.Writer.Header().Set("Access-Control-Allow-Headers", strings.Join(cfg.CORSAllowedHeaders, ","))
			c.Writer.Header().Set("Access-Control-Max-Age", "86400")
		}

		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
