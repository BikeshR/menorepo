# How to Run - All Methods

This document shows **all the ways** you can run the Pi5 Trading System in Go.

## Method 1: Standard Go Commands ⭐ RECOMMENDED

This is the **idiomatic Go way** - what most Go developers do:

```bash
# Start database
cd deployments
docker compose up timescaledb redis -d
cd ..

# Run application
go run ./cmd/api

# Run tests
go test ./...

# Build binary
go build -o bin/app ./cmd/api
./bin/app
```

**Pros:**
- ✅ Standard Go tooling (works everywhere)
- ✅ No external dependencies
- ✅ Learn the real commands
- ✅ Exactly what you'd do at work

**When to use:** Always! This is the Go way.

## Method 2: Shell Scripts (Simple Alternative)

We provide helper scripts that wrap Go commands:

```bash
# Run application (checks database, downloads deps)
./scripts/run.sh

# Build binaries (local + ARM64)
./scripts/build.sh

# Run tests
./scripts/test.sh

# Start everything with Docker
./scripts/docker-up.sh
```

**Pros:**
- ✅ Simple and clear
- ✅ Adds helpful checks and messages
- ✅ Still uses Go commands underneath

**When to use:** If you want helpful output and automatic checks.

## Method 3: Makefile (Optional)

If you're familiar with Make from other projects:

```bash
# Run application
make run

# Run tests
make test

# Build binaries
make build

# Docker operations
make docker-compose-up
make docker-compose-down
```

**Pros:**
- ✅ Familiar to C/C++ developers
- ✅ Tab completion
- ✅ Parallel execution

**Cons:**
- ❌ Not Go-native
- ❌ Requires Make to be installed
- ❌ Hides what's actually happening

**When to use:** If you're already comfortable with Make and prefer it.

## Method 4: Full Docker (Production-Like)

Run everything in Docker containers:

```bash
# Build image
docker build -t pi5-trading-go .

# Start all services
cd deployments
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

**Pros:**
- ✅ Exactly like production
- ✅ Isolated environment
- ✅ No Go installation needed

**Cons:**
- ⏱️ Slower iteration (rebuild image on changes)

**When to use:** Testing deployment, preparing for production, or sharing with others.

## Comparison Table

| Method | Setup Time | Speed | Learning Value | Production-Ready |
|--------|------------|-------|----------------|------------------|
| **Go Commands** | None | Fast | ⭐⭐⭐⭐⭐ | ✅ |
| **Shell Scripts** | None | Fast | ⭐⭐⭐⭐ | ✅ |
| **Makefile** | Install Make | Fast | ⭐⭐⭐ | ✅ |
| **Docker** | Install Docker | Slow | ⭐⭐ | ✅✅✅ |

## Which Should You Use?

### For Learning Go:
👉 **Use Go commands directly** (`go run`, `go test`, `go build`)

You'll learn what's actually happening and build muscle memory for Go tooling.

### For Daily Development:
👉 **Use shell scripts** or **Go commands**

Pick whichever feels more natural. Both are fine!

### For Team Projects:
👉 **Document both Go commands AND provide Makefile/scripts**

Different team members prefer different tools.

### For Deployment:
👉 **Use Docker**

Consistent across all environments.

## My Recommendation for You

Since you're **learning Go**, here's what I suggest:

### Week 1-2: Pure Go Commands
```bash
go run ./cmd/api
go test ./...
go build ./cmd/api
```

Get comfortable with Go's built-in tooling. Understand what each command does.

### Week 3+: Use What Feels Natural
```bash
# If you like convenience:
./scripts/run.sh

# If you like Make:
make run

# If you like Go commands:
go run ./cmd/api
```

Pick whatever doesn't get in your way.

## Common Tasks - All Methods

### Task: Run the Application

```bash
# Go way:
go run ./cmd/api

# Script way:
./scripts/run.sh

# Make way:
make run

# Docker way:
docker compose up
```

### Task: Run Tests

```bash
# Go way:
go test ./...

# Script way:
./scripts/test.sh

# Make way:
make test

# Docker way:
docker compose run --rm trading_api_go go test ./...
```

### Task: Build for Raspberry Pi

```bash
# Go way:
GOOS=linux GOARCH=arm64 go build -o bin/pi5-api-arm64 ./cmd/api

# Script way:
./scripts/build.sh  # Builds both local and ARM64

# Make way:
make build-arm64

# Docker way:
docker buildx build --platform linux/arm64 -t pi5-trading-go .
```

### Task: Check Database

```bash
# Direct:
docker compose ps timescaledb

# With script:
./scripts/run.sh  # Auto-checks and starts if needed

# With Make:
make docker-compose-up
```

## Final Answer: What's "Standard"?

In the Go community:
- ✅ `go run`, `go build`, `go test` are **standard**
- ✅ Shell scripts are **common** for convenience
- ⚠️ Makefiles are **borrowed** from C/C++ (not Go-native)
- ✅ Docker is **standard** for deployment

**Bottom line:** Use Go commands to learn. Use whatever works for daily development!

## Quick Reference

### Essential Go Commands
```bash
go run ./cmd/api              # Run app
go build ./cmd/api            # Build binary
go test ./...                 # Run all tests
go test -v ./...              # Verbose tests
go test -race ./...           # Race detection
go mod download               # Get dependencies
go mod tidy                   # Clean dependencies
go fmt ./...                  # Format code
go vet ./...                  # Check for issues
```

### Essential Docker Commands
```bash
docker compose up -d          # Start services
docker compose down           # Stop services
docker compose ps             # List services
docker compose logs -f        # View logs
docker build -t name .        # Build image
```

### Our Helper Scripts
```bash
./scripts/run.sh              # Run with checks
./scripts/build.sh            # Build binaries
./scripts/test.sh             # Run tests
./scripts/docker-up.sh        # Docker start
```

---

**Choose your adventure!** All paths lead to the same place. 🚀
