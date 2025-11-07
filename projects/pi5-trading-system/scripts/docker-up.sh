#!/bin/bash
# Start all services with Docker Compose

set -e

echo "🐳 Starting Pi5 Trading System with Docker..."
echo ""

cd deployments

echo "📦 Starting services..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

echo ""
echo "📊 Service status:"
docker compose ps

echo ""
echo "✅ Services started!"
echo ""
echo "🌐 API:          http://localhost:8081"
echo "💚 Health check: http://localhost:8081/health"
echo ""
echo "📝 View logs:    docker compose logs -f"
echo "🛑 Stop:         docker compose down"
