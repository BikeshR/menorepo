#!/bin/bash
# Simple script to run the application

set -e

echo "🚀 Starting Pi5 Trading System (Go)..."
echo ""

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+ from https://go.dev/dl/"
    exit 1
fi

# Check Go version
GO_VERSION=$(go version | awk '{print $3}')
echo "✓ Using $GO_VERSION"
echo ""

# Check if database is running
echo "🔍 Checking database connection..."
if ! docker compose -f deployments/docker-compose.yml ps timescaledb | grep -q "Up"; then
    echo "⚠️  Database not running. Starting database..."
    docker compose -f deployments/docker-compose.yml up timescaledb redis -d
    echo "⏳ Waiting for database to be ready..."
    sleep 5
fi

echo "✓ Database is running"
echo ""

# Download dependencies if needed
if [ ! -d "vendor" ] && [ ! -f "go.sum" ]; then
    echo "📦 Downloading dependencies..."
    go mod download
    echo "✓ Dependencies ready"
    echo ""
fi

# Run the application
echo "🎯 Running application on http://localhost:8081"
echo "📊 Health check: http://localhost:8081/health"
echo ""
echo "Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

go run ./cmd/api
