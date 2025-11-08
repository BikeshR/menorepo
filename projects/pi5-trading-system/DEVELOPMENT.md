# Pi5 Trading System - Development Guide

Complete guide for setting up and developing the Pi5 Trading System on your workstation.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Development Environment](#development-environment)
- [Database Migrations](#database-migrations)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Development Setup (Docker Compose)

```
┌─────────────────────────────────────┐
│ Docker Compose                      │
│  ├─ PostgreSQL:5432                 │
│  ├─ Redis:6379                      │
│  └─ Go API:8080 (with Air reload)   │
└─────────────────────────────────────┘
        ↑
        │ (API calls proxied)
        │
┌─────────────────────────────────────┐
│ Vite Dev Server :5173               │
│  └─ React Dashboard (HMR)           │
└─────────────────────────────────────┘
```

### Production Setup (Raspberry Pi)

```
┌─────────────────────────────────────┐
│ Native Services (systemd)           │
│  ├─ PostgreSQL:5432                 │
│  ├─ Redis:6379                      │
│  └─ Go API:8080                     │
│     └─ Serves dashboard/dist/       │
└─────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Docker & Docker Compose** (for development)
- **Go 1.21+** (optional, Docker handles this)
- **Node.js 18+** (for dashboard development)
- **Make** (optional, for shortcuts)

### One-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/BikeshR/menorepo.git
cd menorepo/projects/pi5-trading-system

# 2. Create environment file
cat > .env <<EOF
# Alpaca API Credentials (get from https://alpaca.markets)
ALPACA_API_KEY=your_api_key_here
ALPACA_SECRET_KEY=your_secret_key_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets
ALPACA_DATA_FEED=iex

# Database (handled by Docker)
DB_HOST=postgres
DB_PORT=5432
DB_USER=pi5trader
DB_PASSWORD=dev-password
DB_NAME=pi5_trading

# Redis (handled by Docker)
REDIS_HOST=redis
REDIS_PORT=6379

# Application
ENV=development
LOG_LEVEL=debug
TRADING_ENABLED=false
INITIAL_CAPITAL=100000.00
EOF

# 3. Start all backend services (PostgreSQL + Redis + Go API)
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be healthy (~30 seconds)
docker-compose -f docker-compose.dev.yml ps

# 4. In a new terminal: Start dashboard dev server
cd dashboard
npm install
npm run dev
```

**Access the application:**

- 🎨 **Dashboard**: http://localhost:5173 (with hot module replacement)
- 🔧 **API**: http://localhost:8080 (auto-reloads on Go code changes)
- 🗄️ **PostgreSQL**: localhost:5432
- 💾 **Redis**: localhost:6379

### Daily Development

```bash
# Terminal 1: Start backend (or run in background with -d)
docker-compose -f docker-compose.dev.yml up

# Terminal 2: Start dashboard
cd dashboard && npm run dev

# Make changes:
# - Go code → Air rebuilds automatically (~2-3 seconds)
# - React code → Vite HMR (instant)
```

---

## Development Environment

### Directory Structure

```
projects/pi5-trading-system/
├── cmd/                    # Entry points
│   ├── api/               # Main API server
│   ├── backtest/          # Backtesting CLI
│   └── optimize/          # Optimization CLI
├── internal/              # Private application code
│   ├── backtest/         # Backtesting engine
│   ├── database/         # Database helpers
│   ├── indicators/       # Technical indicators
│   ├── risk/             # Risk management
│   └── strategies/       # Trading strategies
├── pkg/                   # Public libraries
├── configs/              # Configuration files
├── migrations/           # Database migrations
├── dashboard/            # React frontend
│   ├── src/
│   ├── public/
│   └── dist/             # Production build output
├── docker-compose.dev.yml # Development environment
├── Dockerfile            # Multi-stage build
├── .air.toml             # Go hot reload config
└── DEVELOPMENT.md        # This file
```

### Environment Variables

Development uses `.env` file (git-ignored). See `.env.example` for all options.

**Key variables:**

```bash
# Alpaca API
ALPACA_API_KEY=         # Get from https://alpaca.markets
ALPACA_SECRET_KEY=      # Paper trading credentials
ALPACA_BASE_URL=        # Paper: https://paper-api.alpaca.markets

# Database
DB_HOST=postgres        # Docker service name
DB_PASSWORD=            # Database password

# Application
TRADING_ENABLED=false   # Set true to enable live trading
LOG_LEVEL=debug        # debug, info, warn, error
```

### Docker Services

The `docker-compose.dev.yml` defines three services:

#### 1. PostgreSQL + TimescaleDB

```yaml
postgres:
  image: timescale/timescaledb:latest-pg15
  ports: ["5432:5432"]
  # Credentials: pi5trader / dev-password
  # Database: pi5_trading
```

**Access:**

```bash
# Connect via psql
docker exec -it pi5-trading-postgres psql -U pi5trader -d pi5_trading

# View logs
docker logs pi5-trading-postgres
```

#### 2. Redis

```yaml
redis:
  image: redis:7-alpine
  ports: ["6379:6379"]
```

**Access:**

```bash
# Connect via redis-cli
docker exec -it pi5-trading-redis redis-cli

# View stats
docker exec -it pi5-trading-redis redis-cli INFO
```

#### 3. Go API (with Air hot reload)

```yaml
api:
  build:
    target: development  # Uses Air for hot reload
  ports: ["8080:8080"]
  volumes:
    - ./cmd:/app/cmd           # Mount source code
    - ./internal:/app/internal
    - go_modules:/go/pkg/mod   # Cache modules
```

**Air watches for changes** in `*.go`, `*.yaml` files and rebuilds automatically.

**View logs:**

```bash
# Follow API logs
docker logs -f pi5-trading-api

# View build errors
cat tmp/build-errors.log
```

### Dashboard Development

The React dashboard uses **Vite** for instant hot module replacement:

```bash
cd dashboard

# Install dependencies
npm install

# Start dev server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

**API Proxy:** Vite proxies `/api/*` and `/ws/*` requests to `http://localhost:8080` (Go API).

**Configuration:** See `dashboard/vite.config.ts`

---

## Database Migrations

### Overview

We use **golang-migrate** for database schema management:

- ✅ Version-controlled SQL migrations
- ✅ Up/down migrations for rollback
- ✅ Automatic execution on API startup
- ✅ TimescaleDB hypertables for time-series data

### Migration Files

Located in `migrations/` directory:

```
migrations/
├── 000001_initial_schema.up.sql
├── 000001_initial_schema.down.sql
├── 000002_add_feature.up.sql
└── 000002_add_feature.down.sql
```

### Creating New Migrations

#### Option 1: Using migrate CLI

```bash
# Install migrate tool
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Create new migration
migrate create -ext sql -dir migrations -seq add_new_feature

# This creates:
# migrations/000002_add_new_feature.up.sql
# migrations/000002_add_new_feature.down.sql
```

#### Option 2: Manual creation

```bash
# Create files manually
touch migrations/000002_add_new_feature.up.sql
touch migrations/000002_add_new_feature.down.sql
```

**Example migration:**

```sql
-- 000002_add_new_feature.up.sql
ALTER TABLE strategies ADD COLUMN max_positions INTEGER DEFAULT 5;
CREATE INDEX idx_strategies_max_positions ON strategies(max_positions);
```

```sql
-- 000002_add_new_feature.down.sql
DROP INDEX IF EXISTS idx_strategies_max_positions;
ALTER TABLE strategies DROP COLUMN IF EXISTS max_positions;
```

### Running Migrations

#### Automatic (Development)

Migrations run automatically when API starts:

```go
// internal/database/migrate.go
func RunMigrations(db *sql.DB, config MigrationConfig) error
```

#### Manual (CLI)

```bash
# Run all pending migrations
migrate -path migrations \
  -database "postgres://pi5trader:dev-password@localhost:5432/pi5_trading?sslmode=disable" \
  up

# Rollback last migration
migrate -path migrations \
  -database "postgres://..." \
  down 1

# Check current version
migrate -path migrations \
  -database "postgres://..." \
  version

# Force to specific version (use with caution!)
migrate -path migrations \
  -database "postgres://..." \
  force 1
```

### Schema Overview

**Core tables:**

- `users` - Authentication
- `strategies` - Strategy definitions
- `positions` - Open/closed positions
- `trades` - Trade history (TimescaleDB hypertable)
- `market_data` - Price data (TimescaleDB hypertable)
- `portfolio_snapshots` - Portfolio history (TimescaleDB hypertable)
- `risk_limits` - Risk management rules
- `backtest_results` - Backtest performance
- `signals` - Trading signals (TimescaleDB hypertable)

**TimescaleDB features:**

- Automatic data partitioning by time
- Compression for old data (7+ days)
- Optimized time-series queries
- Continuous aggregates (future)

---

## Testing

### Unit Tests

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/backtest/...

# Verbose output
go test -v ./...

# Short mode (skip slow tests)
go test -short ./...
```

### Integration Tests

```bash
# Requires Docker services running
docker-compose -f docker-compose.dev.yml up -d

# Run integration tests
go test -tags=integration ./...
```

### Dashboard Tests

```bash
cd dashboard

# Run tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Backtesting

```bash
# Build backtest tool
go build -o backtest cmd/backtest/main.go

# Run backtest
./backtest \
  -symbol SPY \
  -strategy rsi_mean_reversion \
  -start 2024-01-01 \
  -end 2024-03-01

# With optimization
go build -o optimize cmd/optimize/main.go
./optimize -mode grid -symbol SPY -strategy rsi_mean_reversion
```

---

## Deployment

### Production Build

```bash
# Build everything for production
docker build -t pi5-trading:latest .

# This builds:
# 1. React dashboard (optimized bundle)
# 2. Go binaries (statically linked)
# 3. Includes migrations

# Run production container
docker run -d \
  --name pi5-trading \
  -p 8080:8080 \
  --env-file .env.production \
  pi5-trading:latest
```

### Raspberry Pi Deployment

See [deployment/README.md](deployment/README.md) for complete Pi deployment guide.

**Quick summary:**

1. **One-time Pi setup:**

```bash
# On Raspberry Pi
./deployment/setup-pi.sh
./deployment/setup-github-runner.sh
```

2. **Automated deployment:**

```bash
# Push to main branch → GitHub Actions deploys automatically
git push origin main
```

3. **Manual deployment:**

```bash
# On Raspberry Pi
cd ~/menorepo/projects/pi5-trading-system
git pull
go build -o ~/pi5-trading-system/api cmd/api/main.go
systemctl --user restart pi5-trading.service
```

---

## Troubleshooting

### Common Issues

#### 1. Docker services won't start

```bash
# Check service status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs

# Restart services
docker-compose -f docker-compose.dev.yml restart

# Complete reset
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

#### 2. Database connection errors

```bash
# Check PostgreSQL is running
docker exec pi5-trading-postgres pg_isready

# Check credentials
docker exec -it pi5-trading-postgres psql -U pi5trader -d pi5_trading

# View database logs
docker logs pi5-trading-postgres
```

#### 3. Migrations fail

```bash
# Check current version
migrate -path migrations -database "postgres://..." version

# Check if database is dirty
# If dirty, you need to manually fix the issue and force version

# Force to specific version (careful!)
migrate -path migrations -database "postgres://..." force 1

# Then try again
migrate -path migrations -database "postgres://..." up
```

#### 4. Go API won't reload

```bash
# Check Air is running
docker exec pi5-trading-api ps aux | grep air

# View Air logs
docker logs pi5-trading-api

# Check build errors
docker exec pi5-trading-api cat tmp/build-errors.log

# Restart API service
docker-compose -f docker-compose.dev.yml restart api
```

#### 5. Dashboard API calls fail

```bash
# Check Vite proxy configuration
cat dashboard/vite.config.ts

# Verify API is running
curl http://localhost:8080/api/v1/system/health

# Check browser console for CORS errors
# Check Network tab in DevTools
```

#### 6. Port already in use

```bash
# Find process using port 8080
lsof -i :8080
# or
sudo netstat -tlnp | grep 8080

# Kill process
kill -9 <PID>

# Or use different port
# Edit docker-compose.dev.yml: "8081:8080"
```

### Performance Tips

**Go API:**

- Air rebuilds are fast (~2-3 sec) but you can disable it temporarily:
  ```bash
  # Edit docker-compose.dev.yml
  # Change: command: ["air"]
  # To: command: ["go", "run", "cmd/api/main.go"]
  ```

**Dashboard:**

- Vite HMR is instant, but large builds can be slow:
  ```bash
  # Clear Vite cache
  cd dashboard && rm -rf node_modules/.vite
  ```

**Docker:**

- Use volumes for Go modules cache (already configured)
- Prune unused images: `docker system prune`

### Getting Help

1. Check logs: `docker-compose -f docker-compose.dev.yml logs`
2. Check API health: `curl http://localhost:8080/api/v1/system/health`
3. Review [deployment/README.md](deployment/README.md)
4. Check [dashboard/README.md](dashboard/README.md)

---

## Additional Resources

- **Alpaca API Docs**: https://alpaca.markets/docs/
- **TimescaleDB Docs**: https://docs.timescale.com/
- **golang-migrate**: https://github.com/golang-migrate/migrate
- **Air (hot reload)**: https://github.com/cosmtrek/air
- **Vite**: https://vitejs.dev/

---

## Development Workflow Examples

### Adding a New Strategy

1. Create strategy file:

```bash
touch internal/strategies/my_strategy.go
```

2. Implement strategy interface:

```go
type MyStrategy struct {
    // fields
}

func (s *MyStrategy) OnBar(bar MarketData) Signal {
    // implementation
}
```

3. Test it:

```bash
go test internal/strategies/my_strategy_test.go
```

4. Backtest it:

```bash
./backtest -strategy my_strategy -symbol SPY -start 2024-01-01
```

### Adding a New API Endpoint

1. Add route in `cmd/api/main.go`:

```go
api.GET("/portfolio/stats", handlers.GetPortfolioStats)
```

2. Create handler:

```go
// internal/handlers/portfolio.go
func GetPortfolioStats(c *gin.Context) {
    // implementation
}
```

3. Update dashboard to call it:

```typescript
// dashboard/src/services/api.ts
async getPortfolioStats() {
  return this.client.get('/api/v1/portfolio/stats');
}
```

4. Test it:

```bash
curl http://localhost:8080/api/v1/portfolio/stats
```

### Database Schema Change

1. Create migration:

```bash
migrate create -ext sql -dir migrations -seq add_portfolio_stats
```

2. Write up migration:

```sql
-- migrations/000003_add_portfolio_stats.up.sql
CREATE TABLE portfolio_stats (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    sharpe_ratio NUMERIC(10,4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('portfolio_stats', 'timestamp');
```

3. Write down migration:

```sql
-- migrations/000003_add_portfolio_stats.down.sql
DROP TABLE IF EXISTS portfolio_stats;
```

4. Restart API (migrations run automatically):

```bash
docker-compose -f docker-compose.dev.yml restart api
```

---

Happy coding! 🚀
