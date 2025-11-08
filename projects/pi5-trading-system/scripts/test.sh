#!/bin/bash
# Run tests

set -e

echo "🧪 Running tests..."
echo ""

# Run tests with race detector and coverage
go test -v -race -cover ./...

echo ""
echo "✅ All tests passed!"
