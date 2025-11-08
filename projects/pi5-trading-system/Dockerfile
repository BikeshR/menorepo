# Multi-stage Dockerfile for Pi5 Trading System (Go) with Frontend

# =============================================================================
# DEVELOPMENT STAGE - Hot reload with Air
# =============================================================================
FROM golang:1.21-alpine AS development

WORKDIR /app

# Install development tools
RUN apk add --no-cache git make curl

# Install air for hot reload
RUN go install github.com/cosmtrek/air@latest

# Install migration tool
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code (will be overridden by volume mount in docker-compose)
COPY . .

# Create tmp directory for air builds
RUN mkdir -p tmp

# Expose port
EXPOSE 8080

# Run with air (hot reload)
CMD ["air", "-c", ".air.toml"]

# =============================================================================
# PRODUCTION BUILD STAGES
# =============================================================================

# Stage 1: Build the React frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/dashboard

# Copy package files
COPY dashboard/package*.json ./

# Install dependencies
RUN npm ci

# Copy dashboard source
COPY dashboard/ ./

# Build the React app
RUN npm run build

# Stage 2: Build the Go binary
FROM golang:1.21-alpine AS backend-builder

# Install build dependencies
RUN apk add --no-cache git make

# Install migration tool
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

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
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -o /app/bin/pi5-trading-api \
    ./cmd/api

# Build additional tools
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -o /app/bin/backtest \
    ./cmd/backtest

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -o /app/bin/optimize \
    ./cmd/optimize

# Stage 3: Create minimal runtime image
FROM alpine:latest

# Install CA certificates for HTTPS requests
RUN apk --no-cache add ca-certificates tzdata postgresql-client

# Create non-root user
RUN addgroup -g 1000 trader && \
    adduser -D -u 1000 -G trader trader

# Set working directory
WORKDIR /app

# Copy binaries from backend builder
COPY --from=backend-builder --chown=trader:trader /app/bin/pi5-trading-api /app/pi5-trading-api
COPY --from=backend-builder --chown=trader:trader /app/bin/backtest /app/backtest
COPY --from=backend-builder --chown=trader:trader /app/bin/optimize /app/optimize

# Copy migration tool
COPY --from=backend-builder --chown=trader:trader /go/bin/migrate /usr/local/bin/migrate

# Copy configuration
COPY --chown=trader:trader configs/ /app/configs/

# Copy migrations
COPY --chown=trader:trader migrations/ /app/migrations/

# Copy built frontend from frontend builder
COPY --from=frontend-builder --chown=trader:trader /app/dashboard/dist /app/dashboard/dist

# Create directories for logs
RUN mkdir -p /app/logs && chown trader:trader /app/logs

# Switch to non-root user
USER trader

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["/app/pi5-trading-api"]
