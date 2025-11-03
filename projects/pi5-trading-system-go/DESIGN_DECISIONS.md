# Design Decisions - Go Implementation

## Framework & Library Choices

### Web Framework Decision Matrix

#### Option 1: Fiber (Express-like)
```go
app := fiber.New()
app.Get("/api/health", func(c *fiber.Ctx) error {
    return c.JSON(fiber.Map{"status": "healthy"})
})
```

**Pros:**
- Fastest framework (zero-allocation router)
- Express-like API (familiar if you know Node.js)
- Built-in WebSocket support
- Excellent middleware ecosystem
- Great documentation

**Cons:**
- Uses fasthttp (not net/http) - different from stdlib
- Smaller community than Gin
- Learning curve for context handling

**Best for:** Maximum performance, Express.js familiarity

---

#### Option 2: Gin (Most Popular)
```go
r := gin.Default()
r.GET("/api/health", func(c *gin.Context) {
    c.JSON(200, gin.H{"status": "healthy"})
})
```

**Pros:**
- Most popular Go web framework
- Huge community, tons of examples
- Built on net/http (standard library)
- Excellent middleware ecosystem
- Good performance
- Battle-tested in production

**Cons:**
- Not the fastest (but fast enough)
- Magic-y API (less idiomatic Go)

**Best for:** Learning from community examples, production use

---

#### Option 3: Chi (Idiomatic Go)
```go
r := chi.NewRouter()
r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
    json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
})
```

**Pros:**
- Most idiomatic Go code
- Pure net/http compatible
- Lightweight, minimal magic
- Great for learning "the Go way"
- Context-based design

**Cons:**
- More boilerplate than Fiber/Gin
- Smaller middleware ecosystem
- Manual JSON encoding

**Best for:** Learning idiomatic Go, lightweight projects

---

#### Option 4: Stdlib net/http (No Framework)
```go
http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
})
```

**Pros:**
- Zero dependencies
- Learn pure Go
- Maximum control
- Never breaks from framework changes

**Cons:**
- Most boilerplate
- Have to build everything (routing, middleware, etc.)
- More code to maintain

**Best for:** Learning Go deeply, minimal dependencies

---

### **❓ Question: Which web framework appeals to you?**
- Fiber for performance?
- Gin for community/examples?
- Chi for idiomatic Go?
- Stdlib for pure Go learning?

---

## Database Layer Decisions

### Option 1: pgx (Recommended)
```go
conn, err := pgx.Connect(ctx, "postgres://user:pass@localhost:5432/db")
rows, err := conn.Query(ctx, "SELECT * FROM market_data WHERE symbol = $1", "AAPL")
```

**Pros:**
- Native Go PostgreSQL driver
- Best performance for PostgreSQL
- Support for advanced PostgreSQL features (LISTEN/NOTIFY, COPY, etc.)
- Connection pooling built-in
- Type-safe scanning

**Cons:**
- Manual SQL writing
- More boilerplate than ORM
- No migration management built-in

**Best for:** Performance, learning SQL, PostgreSQL-specific features

---

### Option 2: GORM (ORM)
```go
type MarketData struct {
    Symbol    string
    Timestamp time.Time
    Close     float64
}
db.Where("symbol = ?", "AAPL").Find(&marketData)
```

**Pros:**
- Less boilerplate
- Auto-migrations
- Familiar ORM pattern (if you know Django/SQLAlchemy)
- Relationships handled automatically
- Lots of plugins

**Cons:**
- Performance overhead
- Magic queries (hard to debug)
- Learning curve for GORM-specific patterns
- Can generate inefficient SQL
- Hides what's really happening

**Best for:** Rapid development, complex relationships, familiar with ORMs

---

### Option 3: sqlc (SQL → Go Code Generator)
```sql
-- queries.sql
-- name: GetMarketData :many
SELECT * FROM market_data WHERE symbol = $1;
```

```go
// Generated code
marketData, err := queries.GetMarketData(ctx, "AAPL")
```

**Pros:**
- Type-safe SQL
- Write raw SQL, get Go code
- Zero runtime overhead
- Compile-time type checking
- No ORM magic

**Cons:**
- Code generation step
- Learning curve for tooling
- Manual migration management

**Best for:** Type safety + performance, SQL lovers

---

### **❓ Question: How do you want to interact with the database?**
- pgx for raw SQL control?
- GORM for ORM convenience?
- sqlc for type-safe generated code?

---

## Configuration Management

### Option 1: Viper (Popular)
```go
viper.SetConfigName("config")
viper.SetConfigType("yaml")
viper.AddConfigPath("./config")
viper.ReadInConfig()

dbHost := viper.GetString("database.host")
```

**Pros:**
- Supports multiple formats (YAML, JSON, TOML, env)
- Live config reloading
- Environment variable override
- Remote config support (Consul, etcd)
- Can reuse Python's YAML files

**Cons:**
- Heavy dependency
- Type-unsafe (returns interface{})
- Runtime errors for missing keys

---

### Option 2: Env Variables Only (12-Factor)
```go
type Config struct {
    DBHost     string `env:"DB_HOST" envDefault:"localhost"`
    DBPort     int    `env:"DB_PORT" envDefault:"5432"`
    DBName     string `env:"DB_NAME,required"`
}

cfg := Config{}
env.Parse(&cfg)
```

**Pros:**
- Simple, minimal dependencies
- Type-safe with structs
- 12-factor app methodology
- Easy for Docker/Kubernetes
- Compile-time validation

**Cons:**
- No complex nested config
- Environment variable pollution for many settings
- No config file versioning

---

### Option 3: Custom YAML Parser
```go
type Config struct {
    Database struct {
        Host string `yaml:"host"`
        Port int    `yaml:"port"`
    } `yaml:"database"`
}

data, _ := os.ReadFile("config.yaml")
yaml.Unmarshal(data, &cfg)
```

**Pros:**
- Minimal dependencies
- Type-safe with structs
- Can reuse Python's config files
- Simple and explicit

**Cons:**
- Manual parsing
- No environment overrides
- No live reload

---

### **❓ Question: Configuration approach?**
- Viper for flexibility (can reuse Python YAML)?
- Env vars for simplicity (12-factor)?
- Custom YAML for minimal deps?

---

## Logging Strategy

### Option 1: zap (Uber's Logger)
```go
logger, _ := zap.NewProduction()
logger.Info("Market data received",
    zap.String("symbol", "AAPL"),
    zap.Float64("price", 150.25),
)
```

**Pros:**
- High performance (structured logging)
- Type-safe fields
- JSON output (great for log aggregation)
- Production-ready
- Sampling for high-volume logs

**Cons:**
- Verbose API
- Learning curve

**Performance:** ~800ns per log

---

### Option 2: zerolog (Fastest)
```go
log.Info().
    Str("symbol", "AAPL").
    Float64("price", 150.25).
    Msg("Market data received")
```

**Pros:**
- Fastest structured logger
- Zero-allocation JSON logs
- Fluent API (readable)
- Minimal dependencies

**Cons:**
- Smaller community than zap
- Less tooling/integrations

**Performance:** ~100ns per log (8x faster than zap)

---

### Option 3: logrus (Most Popular)
```go
log.WithFields(log.Fields{
    "symbol": "AAPL",
    "price":  150.25,
}).Info("Market data received")
```

**Pros:**
- Most popular
- Lots of examples
- Good for learning
- Easy to use

**Cons:**
- Slower than zap/zerolog
- Not actively developed
- Higher allocations

**Performance:** ~3000ns per log

---

### **❓ Question: Logging framework?**
- zap for features + performance?
- zerolog for maximum speed?
- logrus for community/simplicity?

---

## Event Bus Architecture

### Option 1: Pure Go Channels
```go
type EventBus struct {
    subscribers map[EventType][]chan Event
    mu          sync.RWMutex
}

func (eb *EventBus) Publish(event Event) {
    eb.mu.RLock()
    defer eb.mu.RUnlock()

    for _, ch := range eb.subscribers[event.Type()] {
        select {
        case ch <- event:
        default:
            // Handle backpressure
        }
    }
}
```

**Pros:**
- Pure Go, no external dependencies
- Type-safe
- Maximum performance
- Learn Go concurrency patterns
- In-process (no network overhead)

**Cons:**
- Manual implementation
- Single process only
- No persistence (events lost on restart)
- Backpressure handling is manual

**Best for:** Learning Go, single-process systems, performance

---

### Option 2: Redis Pub/Sub
```go
pubsub := redisClient.Subscribe(ctx, "market-data")
ch := pubsub.Channel()

for msg := range ch {
    // Handle event
}
```

**Pros:**
- Distributed (multi-process)
- Already have Redis
- Simple API
- Events can be shared with Python version

**Cons:**
- Network latency
- No guaranteed delivery
- Redis is single point of failure
- Slower than channels

**Best for:** Multi-process, sharing with Python

---

### Option 3: NATS (Message Queue)
```go
nc, _ := nats.Connect(nats.DefaultURL)
nc.Subscribe("market-data", func(m *nats.Msg) {
    // Handle event
})
```

**Pros:**
- Built for events/messaging
- High performance
- Guaranteed delivery options
- Clustering support
- JetStream for persistence

**Cons:**
- Additional infrastructure
- Learning curve
- Overhead for single-process

**Best for:** Production systems, microservices

---

### **❓ Question: Event bus implementation?**
- Go channels (learn concurrency)?
- Redis Pub/Sub (share with Python)?
- NATS (production-ready messaging)?

---

## Concurrency Patterns

### Worker Pool Pattern
```go
// Option 1: Fixed worker pool
jobs := make(chan Event, 100)
for w := 0; w < numWorkers; w++ {
    go worker(jobs)
}

// Option 2: Goroutine per event
for event := range events {
    go handleEvent(event)
}

// Option 3: Semaphore-limited
sem := make(chan struct{}, maxConcurrent)
for event := range events {
    sem <- struct{}{}
    go func(e Event) {
        defer func() { <-sem }()
        handleEvent(e)
    }(event)
}
```

**❓ Question:** How to manage concurrency?
- Fixed worker pool (predictable resource usage)?
- Goroutine per event (maximum concurrency)?
- Semaphore-limited (bounded concurrency)?

---

## Project Structure

### Option A: Standard Go Layout
```
pi5-trading-system-go/
├── cmd/
│   ├── api/
│   │   └── main.go           # API server
│   └── cli/
│       └── main.go           # CLI tools
├── internal/                  # Private code (can't be imported)
│   ├── api/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   └── routes/
│   ├── core/
│   │   ├── events/
│   │   ├── strategy/
│   │   └── portfolio/
│   ├── data/
│   │   ├── timescale/
│   │   └── redis/
│   └── config/
├── pkg/                       # Public libraries (can be imported)
│   └── types/
├── configs/
│   └── config.yaml
├── deployments/
│   ├── Dockerfile
│   └── docker-compose.yml
├── scripts/
├── tests/
├── go.mod
└── go.sum
```

**Pros:**
- Standard Go community pattern
- Clear public vs private separation
- Well-understood structure
- Good for libraries + applications

---

### Option B: Domain-Driven Design (DDD)
```
pi5-trading-system-go/
├── cmd/
│   └── api/
│       └── main.go
├── domain/                    # Business logic (no dependencies)
│   ├── trading/
│   │   ├── strategy.go       # Strategy entity
│   │   ├── order.go          # Order entity
│   │   └── repository.go     # Interfaces only
│   ├── portfolio/
│   └── market/
├── application/               # Use cases
│   ├── execute_trade.go
│   └── calculate_risk.go
├── infrastructure/            # External implementations
│   ├── database/
│   │   └── timescale/
│   ├── brokers/
│   │   └── alpaca/
│   └── cache/
│       └── redis/
├── interfaces/                # API/CLI adapters
│   ├── http/
│   └── cli/
└── configs/
```

**Pros:**
- Clean architecture
- Business logic isolated
- Highly testable
- Easier to change infrastructure

**Cons:**
- More complex
- More directories
- Overkill for small projects?

---

### Option C: Simple Flat Structure
```
pi5-trading-system-go/
├── main.go
├── api.go
├── events.go
├── strategy.go
├── portfolio.go
├── database.go
├── config.go
└── config.yaml
```

**Pros:**
- Simple to navigate
- Quick to start
- No decision fatigue

**Cons:**
- Doesn't scale well
- Hard to organize as code grows

---

### **❓ Question: Project structure preference?**
- Standard Go layout (community standard)?
- DDD (clean architecture)?
- Simple flat (start small, refactor later)?

---

## Testing Strategy

### Unit Testing Approach
```go
// Option 1: Table-driven tests (idiomatic Go)
func TestCalculateRisk(t *testing.T) {
    tests := []struct {
        name     string
        position float64
        want     float64
    }{
        {"small position", 100, 0.01},
        {"large position", 10000, 0.1},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := CalculateRisk(tt.position)
            if got != tt.want {
                t.Errorf("got %v, want %v", got, tt.want)
            }
        })
    }
}

// Option 2: testify assertions
func TestCalculateRisk(t *testing.T) {
    assert.Equal(t, 0.01, CalculateRisk(100))
}
```

**❓ Question:** Testing style?
- Standard library (idiomatic Go)?
- testify (more assertions)?

---

### Mocking Strategy
```go
// Option 1: Interfaces + manual mocks
type Database interface {
    GetMarketData(symbol string) (*MarketData, error)
}

type MockDB struct {
    data *MarketData
}

// Option 2: gomock (generated mocks)
mockCtrl := gomock.NewController(t)
mockDB := NewMockDatabase(mockCtrl)

// Option 3: No mocks (test against real DB in Docker)
```

**❓ Question:** How to handle mocking?

---

## Build & Tooling

### Build Tool
```bash
# Option 1: Just go commands
go build -o bin/api ./cmd/api

# Option 2: Makefile
make build
make test
make docker

# Option 3: Taskfile (modern alternative)
task build
task test
task docker
```

**❓ Question:** Build tool preference?

---

### Hot Reload for Development
```bash
# Option 1: Air
air

# Option 2: Reflex
reflex -r '\.go$' -s go run ./cmd/api

# Option 3: No hot reload (Go compiles fast anyway)
go run ./cmd/api
```

**❓ Question:** Need hot reload or manual restart?

---

## API Documentation

### Option 1: Swagger/OpenAPI
```go
// @Summary Health check
// @Description Get system health status
// @Success 200 {object} HealthResponse
// @Router /health [get]
func Health(c *gin.Context) { }
```

Generate docs: `swag init`

---

### Option 2: Manual docs (README)
Simple markdown documentation

---

**❓ Question:** Generate Swagger docs or keep it simple?

---

## Summary: Decisions to Make

### Must Decide Before Coding:
1. **Web Framework**: Fiber, Gin, Chi, or stdlib?
2. **Database Layer**: pgx, GORM, or sqlc?
3. **Project Structure**: Standard layout, DDD, or flat?
4. **Event Bus**: Channels, Redis, or NATS?

### Can Decide While Building:
5. **Configuration**: Viper, env vars, or custom YAML?
6. **Logging**: zap, zerolog, or logrus?
7. **Concurrency**: Worker pool, goroutine-per-event, or semaphore?
8. **Testing Style**: Stdlib or testify?

### Can Add Later:
9. **Hot Reload**: Air, Reflex, or manual?
10. **API Docs**: Swagger or markdown?
11. **Build Tool**: Make, Task, or go commands?

---

## My Recommendations for Learning Go

**Opinionated Stack for Maximum Learning:**

```
✅ Chi web framework        → Learn idiomatic Go HTTP
✅ pgx database driver      → Learn SQL and PostgreSQL properly
✅ Standard Go layout       → Community standard structure
✅ Go channels event bus    → Learn Go concurrency (channels, goroutines)
✅ Environment variables    → Simple config (add Viper later if needed)
✅ zerolog logging          → Fast + learn structured logging
✅ Worker pool pattern      → Learn controlled concurrency
✅ Standard library testing → Learn Go testing idioms
✅ Makefile                 → Simple, standard build tool
```

**Why this stack:**
- Minimal magic, maximum learning
- Idiomatic Go patterns
- Performance-oriented
- Production-ready
- Easy to understand what's happening
- Teaches Go concurrency properly

**Start simple, add complexity as needed!**
