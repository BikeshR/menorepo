# Quick Start - The Go Way

This guide uses **standard Go commands** - no Make, no external tools.

## Prerequisites

- Go 1.21+ installed ([Download](https://go.dev/dl/))
- Docker (for database)

Check your Go installation:
```bash
go version  # Should show go1.21 or higher
```

## 🚀 Start in 3 Steps

### Step 1: Get Dependencies

```bash
cd projects/pi5-trading-system-go

# Download all dependencies
go mod download
```

### Step 2: Start Database (Docker)

```bash
# Start TimescaleDB and Redis
cd deployments
docker compose up timescaledb redis -d

# Verify they're running
docker compose ps
```

### Step 3: Run the Application

```bash
# Go back to project root
cd ..

# Run the application
go run ./cmd/api
```

That's it! Your Go trading system is running on `http://localhost:8081`

## 🧪 Test It

```bash
# In another terminal
curl http://localhost:8081/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T...",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy"
    }
  }
}
```

## 📝 Common Commands

### Development

```bash
# Run the application (with hot reload on save)
go run ./cmd/api

# Run with specific config file
go run ./cmd/api -config configs/config.yaml

# Run tests
go test ./...

# Run tests with verbose output
go test -v ./...

# Run tests with race detector
go test -race ./...

# Run tests with coverage
go test -cover ./...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out  # View in browser
```

### Building

```bash
# Build binary (outputs to current directory)
go build ./cmd/api

# Build with custom output name
go build -o bin/pi5-trading-api ./cmd/api

# Build for Raspberry Pi 5 (ARM64)
GOOS=linux GOARCH=arm64 go build -o bin/pi5-trading-api-arm64 ./cmd/api

# Build optimized binary (smaller size)
go build -ldflags="-s -w" -o bin/pi5-trading-api ./cmd/api

# Run the built binary
./bin/pi5-trading-api
```

### Dependencies

```bash
# Download dependencies
go mod download

# Add missing dependencies and remove unused ones
go mod tidy

# Verify dependencies
go mod verify

# View dependency graph
go mod graph

# Upgrade dependencies
go get -u ./...
go mod tidy
```

### Code Quality

```bash
# Format code (Go's built-in formatter)
go fmt ./...

# Vet code (catch common mistakes)
go vet ./...

# Run both
go fmt ./... && go vet ./...
```

### Docker (Standard Docker Commands)

```bash
# Build Docker image
docker build -t pi5-trading-go .

# Build for ARM64 (Raspberry Pi 5)
docker buildx build --platform linux/arm64 -t pi5-trading-go .

# Run Docker container
docker run -p 8081:8081 \
  -e DB_HOST=timescaledb \
  -e DB_PASSWORD=trading_secure_2025 \
  pi5-trading-go

# Full stack with docker compose
cd deployments
docker compose up -d

# View logs
docker compose logs -f

# Stop everything
docker compose down
```

## 📁 Project Navigation

```bash
# View project structure
ls -la

# Key directories:
cmd/api/          # Application entry point
internal/         # Private application code
pkg/              # Public libraries
configs/          # Configuration files
deployments/      # Docker files
```

## 🔧 Configuration

### Option 1: Edit config.yaml

```bash
# Edit configuration
nano configs/config.yaml

# Or with vim
vim configs/config.yaml
```

### Option 2: Use Environment Variables

```bash
# Set environment variables (override config.yaml)
export DB_HOST=localhost
export DB_PORT=5432
export DB_PASSWORD=your_password
export PI5_LOGGING_LEVEL=debug

# Run with env vars
go run ./cmd/api
```

### Option 3: Create .env file

```bash
# Copy example
cp .env.example .env

# Edit .env
nano .env

# Variables in .env will be picked up by Docker Compose
```

## 🐛 Troubleshooting

### "Cannot connect to database"

Make sure TimescaleDB is running:
```bash
cd deployments
docker compose ps timescaledb

# If not running, start it:
docker compose up timescaledb -d

# Check logs:
docker compose logs timescaledb
```

### "Port 8081 already in use"

Find what's using the port:
```bash
# On Mac/Linux:
lsof -i :8081

# Kill the process or change port in config.yaml
```

### "Module not found"

Download dependencies:
```bash
go mod download
go mod tidy
```

### Running Locally Without Docker

If you want to run everything locally (no Docker), you need:

1. **Install PostgreSQL with TimescaleDB extension**
2. **Install Redis**
3. **Update config.yaml:**

```yaml
database:
  host: "localhost"  # Changed from "timescaledb"
  port: 5432

redis:
  host: "localhost"  # Changed from "redis"
  port: 6379
```

Then:
```bash
go run ./cmd/api
```

## 🎯 Development Workflow

Typical development session:

```bash
# 1. Start database
cd deployments
docker compose up timescaledb redis -d
cd ..

# 2. Run application
go run ./cmd/api

# 3. In another terminal, make code changes
# The app will need to be restarted manually

# 4. Run tests
go test ./...

# 5. Format code before committing
go fmt ./...

# 6. Stop database when done
cd deployments
docker compose down
```

## 🚀 Deploying to Raspberry Pi 5

### Method 1: Binary

```bash
# On your Mac/PC: Build ARM64 binary
GOOS=linux GOARCH=arm64 go build -o bin/pi5-trading-api-arm64 ./cmd/api

# Copy to Raspberry Pi
scp bin/pi5-trading-api-arm64 pi@raspberrypi:/home/pi/
scp configs/config.yaml pi@raspberrypi:/home/pi/configs/

# SSH to Pi and run
ssh pi@raspberrypi
chmod +x pi5-trading-api-arm64
./pi5-trading-api-arm64
```

### Method 2: Docker (Recommended)

```bash
# On your Mac/PC: Build ARM64 Docker image
docker buildx build --platform linux/arm64 -t pi5-trading-go .

# Save image to file
docker save pi5-trading-go | gzip > pi5-trading-go.tar.gz

# Copy to Pi
scp pi5-trading-go.tar.gz pi@raspberrypi:/home/pi/

# On Pi: Load and run
ssh pi@raspberrypi
docker load < pi5-trading-go.tar.gz
docker run -p 8081:8081 pi5-trading-go
```

### Method 3: docker-compose (Easiest)

```bash
# Copy project to Pi
scp -r deployments configs pi@raspberrypi:/home/pi/pi5-trading-go/

# SSH to Pi
ssh pi@raspberrypi
cd /home/pi/pi5-trading-go/deployments

# Start everything
docker compose up -d

# Check logs
docker compose logs -f
```

## 📚 Next Steps

1. **Understand the code**: Start with `cmd/api/main.go`
2. **Study concurrency**: Read `internal/core/events/bus.go`
3. **Modify strategy**: Edit `internal/core/strategy/moving_average.go`
4. **Add features**: Create your own strategy
5. **Run tests**: `go test ./...`

## 🎓 Learning Resources

- Run `go help` - see all Go commands
- Run `go help build` - detailed help on any command
- [Effective Go](https://go.dev/doc/effective_go)
- [Go by Example](https://gobyexample.com)

## 💡 Pro Tips

```bash
# Watch mode (rerun on file changes) - install air first
go install github.com/cosmtrek/air@latest
air

# Install useful tools
go install golang.org/x/tools/cmd/goimports@latest  # Better imports
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest  # Linter

# Use goimports (better than go fmt)
goimports -w .

# Run linter
golangci-lint run
```

## 🔄 Comparing with Python Version

```bash
# Run both at the same time:

# Terminal 1: Python version (port 8080)
cd ../pi5-trading-system
# ... start Python version

# Terminal 2: Go version (port 8081)
cd ../pi5-trading-system-go
go run ./cmd/api

# Terminal 3: Compare
curl http://localhost:8080/health  # Python
curl http://localhost:8081/health  # Go
```

---

**That's it!** No Make, no complex tools. Just Go. 🚀

Need help? Check the main README.md for more details.
