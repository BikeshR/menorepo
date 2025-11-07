package metrics

import (
	"net/http"
	"strconv"
	"time"
)

// HTTPMetricsMiddleware wraps an HTTP handler to record Prometheus metrics
func HTTPMetricsMiddleware(metrics *TradingMetrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrap response writer to capture status code
			wrapped := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			// Call next handler
			next.ServeHTTP(wrapped, r)

			// Record metrics
			duration := time.Since(start).Seconds()
			statusStr := strconv.Itoa(wrapped.statusCode)

			metrics.HTTPRequestsTotal.WithLabelValues(
				r.Method,
				r.URL.Path,
				statusStr,
			).Inc()

			metrics.HTTPRequestDuration.WithLabelValues(
				r.Method,
				r.URL.Path,
			).Observe(duration)
		})
	}
}

// responseWriter wraps http.ResponseWriter to capture the status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
