#!/bin/bash
# Build the application

set -e

echo "🔨 Building Pi5 Trading System..."
echo ""

# Create bin directory
mkdir -p bin

# Build for current platform
echo "📦 Building for current platform..."
go build -ldflags="-s -w" -o bin/pi5-trading-api ./cmd/api

# Build for ARM64 (Raspberry Pi 5)
echo "📦 Building for ARM64 (Raspberry Pi 5)..."
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bin/pi5-trading-api-arm64 ./cmd/api

echo ""
echo "✅ Build complete!"
echo ""
echo "Binaries created:"
ls -lh bin/
echo ""
echo "Run locally:  ./bin/pi5-trading-api"
echo "Copy to Pi5:  scp bin/pi5-trading-api-arm64 pi@raspberrypi:/home/pi/"
