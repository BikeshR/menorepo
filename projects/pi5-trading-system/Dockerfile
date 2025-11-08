# Multi-stage Dockerfile for Pi5 Trading System (Go) with Frontend
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

# Stage 3: Create minimal runtime image
FROM alpine:latest

# Install CA certificates for HTTPS requests
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 trader && \
    adduser -D -u 1000 -G trader trader

# Set working directory
WORKDIR /app

# Copy binary from backend builder
COPY --from=backend-builder --chown=trader:trader /app/bin/pi5-trading-api /app/pi5-trading-api

# Copy configuration
COPY --chown=trader:trader configs/config.yaml /app/configs/config.yaml

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
