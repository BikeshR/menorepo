# System Design - Pi5 Trading System

**Production Go Implementation for Raspberry Pi 5 (8GB)**

---

## Executive Summary

Event-driven algorithmic trading system built in Go, optimized for Raspberry Pi 5 (8GB). Uses Go channels for high-performance async processing, TimescaleDB for time-series storage, and containerized deployment with resource limits.

---

## 1. Deployment Architecture

### 1.1 Pi5 Deployment
```
┌──────────────────── Raspberry Pi 5 (8GB) ────────────────────┐
│                                                               │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │  Go API    │  │ TimescaleDB  │  │ VictoriaMetrics  │     │
│  │  (1.0GB)   │  │  (1.5GB)     │  │    (0.3GB)       │     │
│  │            │  │              │  │                  │     │
│  │ • REST API │  │ • Market Data│  │ • Prometheus     │     │
│  │ • WebSocket│  │ • Orders     │  │   Scraping       │     │
│  │ • Chi Router│ │ • Positions  │  │ • Metrics        │     │
│  └────────────┘  └──────────────┘  └──────────────────┘     │
│                                                               │
│  ┌────────────┐  ┌──────────────┐                           │
│  │  Redis     │  │   Gotify     │                           │
│  │  (0.3GB)   │  │   (0.1GB)    │                           │
│  └────────────┘  └──────────────┘                           │
│                                                               │
│  Total RAM: ~4.7GB (3.3GB buffer available)                  │
└───────────────────────────────────────────────────────────────┘
         │
         │ Network Access (Port 8080)
         ▼
   ┌─────────────────┐
   │  Web Interface  │
   │  (Any browser)  │
   └─────────────────┘
```

### 1.2 System Boundaries
- **Single Pi5** - All services run on one Raspberry Pi 5
- **Docker Compose** - Containerized with resource limits
- **Local Storage** - 256GB NVMe SSD (recommended) or microSD
- **Network Access** - Web interface accessible on local network

---

## 2. Go Architecture

### 2.1 Project Structure
```
pi5-trading-system/
├── cmd/api/
│   └── main.go                 # Application entry point
├── internal/
│   ├── api/                    # HTTP handlers (Chi router)
│   │   ├── handlers/
│   │   └── server.go
│   ├── auth/                   # JWT authentication
│   ├── audit/                  # Audit logging
│   ├── circuitbreaker/         # Circuit breaker pattern
│   ├── metrics/                # Prometheus metrics
│   ├── middleware/             # Rate limiting, etc.
│   ├── core/
│   │   ├── events/             # Event bus (Go channels)
│   │   ├── execution/          # Order execution engine
│   │   ├── risk/               # Risk management
│   │   └── strategy/           # Trading strategies
│   ├── data/                   # Repository layer
│   │   ├── timescale/          # TimescaleDB client
│   │   ├── orders_repository.go
│   │   ├── portfolio_repository.go
│   │   └── user_repository.go
│   └── config/                 # Configuration management
├── dashboard/                  # React 19 frontend
├── deployments/               # Docker Compose configs
└── scripts/                   # Backup & maintenance
```

### 2.2 Core Modules

**Event Bus (Go Channels)**
- In-memory event routing using Go channels
- Buffered channels for high throughput (10,000+ events/sec)
- Publisher-subscriber pattern with goroutines
- Event types: MarketData, Signal, Order, Fill, Portfolio

**Execution Engine**
- Order lifecycle management
- Market/limit/stop order types
- Risk validation before execution
- Circuit breakers for database ops
- Metrics instrumentation

**Risk Manager**
- Position sizing (fixed, volatility-based, Kelly)
- Portfolio limits (15% max position, 90% max exposure)
- Daily loss limits (3% default)
- Real-time risk monitoring

**Strategy Engine**
- Moving average crossover (implemented)
- Strategy lifecycle management
- Signal generation with confidence scores

**Portfolio Manager**
- Real-time position tracking
- P&L calculation (realized/unrealized)
- Performance metrics

---

## 3. Event-Driven Data Flow

```
Market Data (External)
        │
        ▼
┌───────────────┐
│  Event Bus    │ ◄──── Go Channels (buffered)
└───────────────┘
        │
        ├──▶ Strategy Engine
        │    └──▶ Generate Signals
        │
        ├──▶ Risk Manager
        │    └──▶ Validate & Size Positions
        │
        ├──▶ Execution Engine
        │    └──▶ Execute Orders
        │
        └──▶ Portfolio Manager
             └──▶ Update Positions & P&L
```

**Event Types:**
- `MarketDataEvent` - Price updates (OHLCV)
- `SignalEvent` - Strategy buy/sell signals
- `OrderEvent` - Order submissions
- `OrderFilledEvent` - Execution confirmations
- `PortfolioUpdateEvent` - Position changes

---

## 4. Database Design (TimescaleDB)

### 4.1 Hypertables (Time-Series Optimized)

**market_data**
```sql
CREATE TABLE market_data (
    time TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    close NUMERIC,
    volume BIGINT,
    PRIMARY KEY (time, symbol)
);
SELECT create_hypertable('market_data', 'time');
```

**orders**
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    strategy_id UUID,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    order_type TEXT NOT NULL,
    limit_price NUMERIC,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    filled_at TIMESTAMPTZ,
    filled_quantity INTEGER,
    filled_price NUMERIC
);
```

**positions**
```sql
CREATE TABLE positions (
    symbol TEXT PRIMARY KEY,
    quantity NUMERIC NOT NULL,
    average_price NUMERIC NOT NULL,
    current_price NUMERIC,
    side TEXT NOT NULL,
    opened_at TIMESTAMPTZ,
    last_updated TIMESTAMPTZ
);
```

**trades**
```sql
CREATE TABLE trades (
    id UUID PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    strategy_id UUID,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    commission NUMERIC,
    pnl NUMERIC,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Compression Policies

Enable 90% space savings with TimescaleDB compression:
```sql
ALTER TABLE market_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('market_data', INTERVAL '1 day');
```

---

## 5. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Language** | Go 1.24 | High performance, compiled for ARM64 |
| **HTTP** | Chi | Lightweight, idiomatic Go router |
| **Database** | TimescaleDB | PostgreSQL with time-series extensions |
| **DB Driver** | pgx/v5 | High-performance PostgreSQL driver |
| **Frontend** | React 19 | Modern TypeScript web interface |
| **Monitoring** | VictoriaMetrics | Prometheus metrics (lightweight) |
| **Caching** | Redis 7 | Session cache and pub/sub |
| **Alerts** | Gotify | Self-hosted notifications |
| **Deployment** | Docker Compose | Containerized with resource limits |

---

## 6. API Design

### 6.1 REST Endpoints (Chi Router)

**Authentication**
```
POST   /auth/login
POST   /auth/refresh
GET    /auth/me
```

**Strategies**
```
GET    /api/v1/strategies
POST   /api/v1/strategies/{id}/start
POST   /api/v1/strategies/{id}/stop
GET    /api/v1/strategies/{id}/performance
```

**Portfolio**
```
GET    /api/v1/portfolio/summary
GET    /api/v1/portfolio/positions
GET    /api/v1/portfolio/performance
```

**Orders**
```
GET    /api/v1/orders
POST   /api/v1/orders
DELETE /api/v1/orders/{id}
GET    /api/v1/orders/trades/history
```

**System (Admin)**
```
GET    /api/v1/system/health
GET    /api/v1/system/metrics
GET    /api/v1/system/status
GET    /api/v1/system/circuit-breakers
```

**Monitoring**
```
GET    /health                 # Health check
GET    /metrics                # Prometheus format
```

### 6.2 WebSocket

```
/ws                            # Real-time updates
```

Messages:
- Market data updates
- Portfolio position changes
- Order status updates
- System events

---

## 7. Production Features

### 7.1 Circuit Breakers
- Wrap database operations
- Prevent cascade failures
- Auto-recovery (5 failures → open, 30s timeout)
- Metrics tracking

### 7.2 Prometheus Metrics
- HTTP request metrics
- Order execution metrics
- Database query performance
- Circuit breaker state
- Custom business metrics

### 7.3 Automated Backups
- Daily PostgreSQL backups (2:00 AM)
- 7-day retention
- External USB support
- Automated via cron

### 7.4 TimescaleDB Compression
- 90% disk space savings
- Automatic compression policies
- market_data compressed after 1 day

---

## 8. Performance Characteristics

### 8.1 Pi5 Optimization
- **Memory:** 4.7GB total usage (3.3GB buffer)
- **CPU:** <50% during normal operation
- **Event Processing:** 10,000+ events/second
- **Order Latency:** <100ms
- **Database Writes:** 1,000+ inserts/second

### 8.2 Resource Limits (Docker)
```yaml
Go API:           1.0GB max, 0.5GB reserved, 2 CPUs
TimescaleDB:      1.5GB max, 256MB shared_buffers
VictoriaMetrics:  0.3GB max, 60% memory allowed
Redis:            0.3GB max, 256MB cache, no persistence
Gotify:           0.1GB max
```

### 8.3 Go Optimizations
```go
GOMAXPROCS=3           # Leave 1 core for system
GOGC=200               # Reduce GC frequency
GOMEMLIMIT=900MiB      # Memory limit
```

---

## 9. Security

- **Authentication:** JWT tokens with bcrypt password hashing
- **Rate Limiting:** 100 requests/minute per IP
- **Audit Logging:** Complete trade and event audit trail
- **Docker Isolation:** Containerized services
- **Admin Routes:** Circuit breakers, system config (admin-only)

---

## 10. Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide with:
- Docker Compose setup
- Systemd service configuration
- Post-deployment tasks
- Troubleshooting

---

**For implementation details, see:**
- [QUICKSTART.md](QUICKSTART.md) - 5-minute deployment
- [PI5-OPTIMIZATION.md](PI5-OPTIMIZATION.md) - Performance tuning
- [REQUIREMENTS.md](REQUIREMENTS.md) - System requirements
