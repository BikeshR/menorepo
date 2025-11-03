# Deployment Questions - Go Implementation

## Critical Deployment Decisions

### Option 1: Standalone Go Service (Recommended for Learning)
```yaml
services:
  timescaledb:      # Reuse existing
  redis:            # Reuse existing
  trading_api_go:   # New Go service
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8081:8081"  # Different port from Python
```

**Pros:**
- Independent deployment alongside Python version
- Can compare both implementations side-by-side
- Shares same database and Redis
- Minimal infrastructure changes

**Cons:**
- Port management (8080 for Python, 8081 for Go)
- Need to ensure both can connect to same DB/Redis
- Potential for conflicts

---

### Option 2: Replace Python Service
```yaml
services:
  timescaledb:      # Keep
  redis:            # Keep
  trading_api_go:   # Replace trading_api
    ports:
      - "8080:8080"
```

**Pros:**
- Direct replacement, same ports
- Clear comparison (one at a time)
- Simpler deployment

**Cons:**
- Can't run both simultaneously
- Have to choose one

---

### Option 3: Multi-Service Architecture
```yaml
services:
  timescaledb:
  redis:
  trading_engine_go:    # Go for core trading (no HTTP)
  trading_api_python:   # Python for API only
```

**Pros:**
- Use Go for performance-critical parts
- Keep Python for API convenience
- Microservices learning

**Cons:**
- More complex
- Inter-service communication needed
- Might defeat learning purpose

---

## Dockerfile Strategy

### Option A: Multi-Stage Build (Recommended)
```dockerfile
# Stage 1: Build
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o trading-api ./cmd/api

# Stage 2: Runtime
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/trading-api .
EXPOSE 8081
CMD ["./trading-api"]
```

**Pros:**
- Tiny final image (~10MB vs 1GB+ for Python)
- Single static binary
- Fast startup
- Minimal attack surface

**Cons:**
- Need to ensure ARM64 cross-compilation works
- CGO disabled (can't use C libraries)

---

### Option B: Single-Stage Build
```dockerfile
FROM golang:1.21-alpine
WORKDIR /app
COPY . .
RUN go build -o trading-api ./cmd/api
EXPOSE 8081
CMD ["./trading-api"]
```

**Pros:**
- Simpler
- Can debug with Go tools in container

**Cons:**
- Large image (~300MB)
- Includes build tools in production

---

## ARM64 Compilation Questions

### Local Development (Mac M1/M2/M3)
✅ Native ARM64 - no cross-compilation needed

### Local Development (Intel Mac/x86 Linux)
❓ Need to cross-compile:
```bash
GOOS=linux GOARCH=arm64 go build
```

### Raspberry Pi 5 Deployment
Two options:

**Option A: Build on Pi5**
```bash
# On Pi5 directly
git pull
go build
docker build
```
**Pros:** Native build, no cross-compilation
**Cons:** Slower builds on Pi5 (3-5 min)

**Option B: Build on Dev Machine, Push Image**
```bash
# On Mac/PC
docker buildx build --platform linux/arm64 -t trading-api-go:latest .
docker save trading-api-go:latest | gzip > image.tar.gz
# Copy to Pi5
docker load < image.tar.gz
```
**Pros:** Faster builds on powerful machine
**Cons:** Need to transfer image or use registry

**Question:** Which build approach do you prefer?

---

## Integration with Existing Infrastructure

### Database Schema Sharing
**Question:** Should Go use:
1. **Same schema** as Python version (can read Python's data)
2. **Separate schema** (clean slate, no conflicts)
3. **Different database** entirely

### Redis Key Naming
**Question:** Should Go use:
1. **Same Redis keys** (can share state with Python)
2. **Prefixed keys** (e.g., `go:*` vs `py:*`)
3. **Separate Redis instance**

### Configuration Files
**Question:**
1. **Reuse Python's YAML config** (same format, shared config)
2. **New Go config** (might use different format)
3. **Environment variables only** (12-factor app style)

---

## Deployment Workflow

### Development Workflow
```bash
# Option A: Local Go, Remote Docker
make run-local          # Run Go locally (no Docker)
make docker-build       # Build Docker image
make docker-run         # Run in Docker locally
./deployment/deploy.sh  # Deploy to Pi5

# Option B: Always Docker
docker compose up -d    # Everything in Docker
```

**Question:** Develop locally with `go run` or always use Docker?

---

## Port Assignment Strategy

| Service | Python Port | Go Port | Purpose |
|---------|-------------|---------|---------|
| API HTTP | 8080 | 8081 (?) | REST API |
| Dashboard | 3000 | N/A (?) | React dev server |
| TimescaleDB | 5432 | 5432 | Shared |
| Redis | 6379 | 6379 | Shared |

**Questions:**
1. Use port 8081 for Go API? (allows running both)
2. Build separate dashboard for Go, or reuse Python's?
3. If separate dashboard, use port 3001?

---

## CI/CD Considerations

### GitHub Actions (Future)
```yaml
name: Build and Deploy Go Trading System
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
      - run: go test ./...
      - run: docker buildx build --platform linux/arm64
```

**Question:** Set up CI/CD from the start or later?

---

## Monitoring & Observability

### Metrics Collection
**Options:**
1. **Prometheus** (industry standard, built-in Go client)
2. **Expvar** (Go stdlib, simple)
3. **Custom metrics endpoint** (JSON at /metrics)

**Question:** Which metrics approach?

### Health Checks
```go
// Should we implement:
/health           // Simple alive check
/health/ready     // Ready to serve traffic
/health/live      // Liveness probe
/metrics          // Prometheus metrics
```

---

## Hot Reload During Development

### Options:
1. **Air** - Live reload for Go apps
2. **Reflex** - Flexible file watcher
3. **Manual restart** - `go run` after each change
4. **No hot reload** - Fast compile times make it unnecessary

**Question:** Use hot reload tool or manual restarts?

---

## Testing Strategy on Pi5

### Integration Testing
**How to test on Pi5:**
1. **Local tests** → Deploy to Pi5 → Manual verification
2. **Remote tests** - SSH into Pi5, run tests there
3. **Docker-based tests** - Test container locally before deploy

---

## Resource Limits

### Docker Resource Constraints
```yaml
trading_api_go:
  deploy:
    resources:
      limits:
        cpus: '2.0'      # Half of Pi5's 4 cores
        memory: 2G       # 1/4 of Pi5's 8GB
      reservations:
        memory: 512M
```

**Question:** Set resource limits from start or optimize later?

---

## Rollback Strategy

**If Go version has issues on Pi5:**
```bash
# Quick rollback to Python version
docker compose -f docker-compose.python.yml up -d

# Or keep both running (Python on 8080, Go on 8081)
docker compose -f docker-compose.both.yml up -d
```

**Question:** How to handle rollback during learning phase?

---

## Dashboard Integration

### Options:
1. **No dashboard** - Go API only, use curl/Postman
2. **Reuse Python's React dashboard** - Point to port 8081
3. **Build separate Go dashboard** - Serve static files from Go
4. **Use existing but with proxy** - Nginx routes to both APIs

**Question:** Dashboard strategy for Go version?

---

## Summary: Key Decisions Needed

### Must Decide Now:
- [ ] Deployment mode (standalone on 8081, replace Python, or hybrid?)
- [ ] Dockerfile strategy (multi-stage vs single-stage)
- [ ] Database schema sharing (same vs separate)
- [ ] Configuration approach (YAML vs env vars)
- [ ] Port assignments

### Can Decide Later:
- [ ] CI/CD setup
- [ ] Metrics/monitoring approach
- [ ] Dashboard integration
- [ ] Resource limits

---

## My Recommendations for Learning:

**Best Setup for Learning Go:**
1. ✅ **Standalone service on port 8081** (run alongside Python)
2. ✅ **Multi-stage Dockerfile** (learn Docker best practices)
3. ✅ **Shared database/Redis** (less infrastructure)
4. ✅ **Separate YAML config** (don't interfere with Python)
5. ✅ **Start simple, add features incrementally**
6. ✅ **Use `go run` locally, Docker for Pi5 deployment**
7. ✅ **No dashboard initially** (focus on backend)
8. ✅ **Add Prometheus metrics early** (learn observability)

This approach lets you:
- Compare Go vs Python side-by-side
- Learn Docker multi-stage builds
- Understand Go's deployment simplicity (single binary!)
- Not break your working Python system
- Gradually migrate features one at a time
