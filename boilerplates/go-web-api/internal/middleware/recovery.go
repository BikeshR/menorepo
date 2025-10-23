package middleware

import (
	"fmt"
	"net/http"

	"github.com/yourusername/go-web-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// Recovery returns a gin middleware for recovering from panics
func Recovery(logger *zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				logger.Error().
					Interface("error", err).
					Str("path", c.Request.URL.Path).
					Str("method", c.Request.Method).
					Msg("Panic recovered")

				response.Error(c, http.StatusInternalServerError, "Internal server error", fmt.Errorf("%v", err))
				c.Abort()
			}
		}()
		c.Next()
	}
}
