# Multi-stage Dockerfile for Pi5 Trading System (Go)
# Stage 1: Build the Go binary
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
# CGO_ENABLED=0 creates a statically linked binary (no external dependencies)
# This makes the binary portable and allows us to use a minimal base image
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -o /app/bin/pi5-trading-api \
    ./cmd/api

# Stage 2: Create minimal runtime image
FROM alpine:latest

# Install CA certificates for HTTPS requests
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 trader && \
    adduser -D -u 1000 -G trader trader

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder --chown=trader:trader /app/bin/pi5-trading-api /app/pi5-trading-api

# Copy configuration
COPY --chown=trader:trader configs/config.yaml /app/configs/config.yaml

# Create directories for logs
RUN mkdir -p /app/logs && chown trader:trader /app/logs

# Switch to non-root user
USER trader

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

# Run the application
CMD ["/app/pi5-trading-api"]
