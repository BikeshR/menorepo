# Pi 5 Algorithmic Trading System - System Design Document

**Version:** 1.0  
**Date:** 2025-01-09  
**Status:** Architecture Design Phase  

## Executive Summary

Event-driven, all-in-one algorithmic trading system designed for Raspberry Pi 5, structured around modular algorithmic trading steps. Each module can be independently improved while maintaining system coherence through well-defined interfaces.

## 1. High-Level System Architecture

### 1.1 Deployment Architecture
```
┌─────────────────────────────────────────────┐
│              Raspberry Pi 5                 │
│           Ubuntu 24.04 LTS                  │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐ │
│  │         Web Dashboard                   │ │
│  │      (FastAPI/React)                    │ │
│  │    http://0.0.0.0:8080                  │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │        Trading Engine                   │ │
│  │      (Event-Driven Core)                │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │        TimescaleDB                      │ │
│  │    (Time-Series Database)               │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         │
         │ Network Access
         ▼
┌─────────────────┐    ┌─────────────────┐
│     Laptop      │    │     Phone       │
│   Dashboard     │    │   Dashboard     │
│    Access       │    │    Access       │
└─────────────────┘    └─────────────────┘
```

### 1.2 System Boundaries
- **All components** run on single Raspberry Pi 5
- **Network access** to dashboard from any device on local network
- **External dependencies**: Market data APIs, broker APIs
- **Storage**: All data persisted locally on Pi's 256GB storage

## 2. Module Architecture (Algorithmic Trading Steps)

### 2.1 Core Modules
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Market Data    │───▶│  Strategy       │───▶│  Risk           │
│  Ingestion      │    │  Engine         │    │  Management     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Configuration  │    │  Portfolio      │    │  Order          │
│  Management     │    │  Management     │    │  Management     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Backtesting    │    │  Monitoring &   │    │  Event Bus      │
│  Engine         │    │  Reporting      │    │  (Central)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2.2 Event-Driven Data Flow
```
External APIs │
            ▼
    Market Data Ingestion
            │ MarketDataEvent
            ▼
        Event Bus ───┐
            │        │
            ▼        │ DataEvent
    Strategy Engine  │
            │        │
            │ Signal │
            ▼        │
    Risk Management ─┘
            │
            │ OrderRequest
            ▼
    Order Management
            │
            │ OrderFilled
            ▼
    Portfolio Management
            │
            │ PortfolioUpdate
            ▼
    Monitoring & Reporting
```

## 3. Module Design Specifications

### 3.1 Market Data Ingestion Module

**Purpose:** Real-time and historical data collection with provider failover

**Core Components:**
```python
# Data Provider Interface
class DataProvider(ABC):
    @abstractmethod
    async def get_real_time_data(symbols: List[str]) -> MarketDataEvent
    @abstractmethod  
    async def get_historical_data(symbol: str, start: datetime, end: datetime) -> pd.DataFrame

# Market Data Manager
class MarketDataManager:
    - Primary provider: YahooFinance
    - Backup providers: AlphaVantage, etc.
    - Caching strategy: Redis/in-memory
    - Data quality validation
    - Event publishing to EventBus
```

**Events Published:**
- `MarketDataEvent`: Real-time price updates
- `HistoricalDataEvent`: Backtesting data loaded
- `DataProviderFailureEvent`: Provider failover notifications

### 3.2 Strategy Engine Module

**Purpose:** Strategy execution and signal generation

**Architecture:**
```python
# Strategy Plugin System
/strategies/
  ├── __init__.py
  ├── moving_average_crossover.py
  ├── mean_reversion_rsi.py
  ├── momentum_trend.py
  └── strategy_loader.py

# Base Strategy Interface
class BaseStrategy(ABC):
    @abstractmethod
    def on_market_data(self, event: MarketDataEvent) -> List[Signal]
    @abstractmethod
    def get_parameters(self) -> Dict[str, Any]
    @abstractmethod
    def backtest_ready(self) -> bool
```

**Events Published:**
- `SignalEvent`: Buy/sell signals with confidence levels
- `StrategyStatusEvent`: Strategy health and performance

### 3.3 Risk Management Module

**Purpose:** Portfolio risk controls and position sizing

**Components:**
```python
class RiskManager:
    - Position sizing rules
    - Portfolio concentration limits  
    - Daily loss limits
    - Correlation monitoring
    - Drawdown controls
    
    def evaluate_signal(self, signal: SignalEvent) -> OrderRequest | RiskViolation
```

**Events Published:**
- `OrderRequest`: Approved trading orders
- `RiskViolationEvent`: Risk limit breaches
- `PositionSizeEvent`: Calculated position sizes

### 3.4 Order Management Module

**Purpose:** Order lifecycle and execution management

**Components:**
```python
class OrderManager:
    - Order validation and routing
    - Execution algorithms (TWAP, VWAP future)
    - Fill reporting and tracking
    - Broker API integration
    
    def submit_order(self, order_request: OrderRequest) -> Order
    def handle_fill(self, fill: OrderFill) -> OrderFilledEvent
```

**Events Published:**
- `OrderSubmittedEvent`: Order sent to broker
- `OrderFilledEvent`: Order execution confirmation
- `OrderRejectedEvent`: Order rejection notifications

### 3.5 Portfolio Management Module

**Purpose:** Position tracking and P&L calculation

**Components:**
```python
class PortfolioManager:
    - Real-time position tracking
    - P&L calculation (realized/unrealized)
    - Performance attribution
    - Cash management
    
    def update_position(self, fill: OrderFilledEvent) -> PortfolioUpdate
    def calculate_performance(self) -> PerformanceMetrics
```

**Events Published:**
- `PortfolioUpdateEvent`: Position changes
- `PerformanceEvent`: P&L and metrics updates

### 3.6 Backtesting Engine Module

**Purpose:** Historical strategy validation and optimization

**Components:**
```python
class BacktestEngine:
    - Historical data replay
    - Strategy performance simulation
    - Parameter optimization (grid search, genetic algorithm)
    - Walk-forward analysis
    - Performance visualization
    
    async def run_backtest(self, strategy: BaseStrategy, params: BacktestParams) -> BacktestResults
```

**Events Published:**
- `BacktestCompleteEvent`: Backtest results ready
- `OptimizationProgressEvent`: Parameter optimization updates

### 3.7 Configuration Management Module

**Purpose:** System and strategy configuration

**Structure:**
```yaml
# config/trading_config.yaml
system:
  environment: paper_trading
  log_level: INFO
  
strategies:
  - name: "MovingAverageCrossover"
    enabled: true
    parameters:
      short_window: 10
      long_window: 20
      
risk_management:
  max_position_size: 0.1
  daily_loss_limit: 0.02
  
data_providers:
  primary: "yahoo_finance"
  backup: ["alpha_vantage"]
```

### 3.8 Monitoring & Reporting Module

**Purpose:** System monitoring and performance dashboard

**Components:**
- Real-time trading dashboard
- Performance analytics
- System health monitoring  
- Alert management
- Historical reporting

## 4. Database Design (TimescaleDB)

### 4.1 Core Tables

```sql
-- Market data (time-series optimized)
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

-- Orders and executions
CREATE TABLE orders (
    order_id UUID PRIMARY KEY,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL, -- 'buy' | 'sell'
    quantity NUMERIC NOT NULL,
    order_type TEXT NOT NULL, -- 'market' | 'limit' | 'stop'
    price NUMERIC,
    status TEXT NOT NULL, -- 'pending' | 'filled' | 'rejected' | 'cancelled'
    strategy TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    filled_at TIMESTAMPTZ,
    filled_price NUMERIC,
    filled_quantity NUMERIC
);

-- Portfolio positions
CREATE TABLE positions (
    symbol TEXT PRIMARY KEY,
    quantity NUMERIC NOT NULL,
    average_price NUMERIC NOT NULL,
    current_price NUMERIC,
    unrealized_pnl NUMERIC,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy performance
CREATE TABLE strategy_performance (
    time TIMESTAMPTZ NOT NULL,
    strategy_name TEXT NOT NULL,
    total_return NUMERIC,
    sharpe_ratio NUMERIC,
    max_drawdown NUMERIC,
    win_rate NUMERIC,
    PRIMARY KEY (time, strategy_name)
);
SELECT create_hypertable('strategy_performance', 'time');

-- System events and logs
CREATE TABLE system_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    event_type TEXT NOT NULL,
    module TEXT NOT NULL,
    level TEXT NOT NULL, -- 'INFO' | 'WARNING' | 'ERROR'
    message TEXT NOT NULL,
    metadata JSONB
);
```

### 4.2 Indexes and Performance
```sql
-- Market data indexes
CREATE INDEX idx_market_data_symbol_time ON market_data (symbol, time DESC);

-- Orders indexes  
CREATE INDEX idx_orders_symbol ON orders (symbol);
CREATE INDEX idx_orders_strategy ON orders (strategy);
CREATE INDEX idx_orders_created_at ON orders (created_at);

-- Performance indexes
CREATE INDEX idx_strategy_performance_name_time ON strategy_performance (strategy_name, time DESC);
```

## 5. Event Bus Architecture

### 5.1 Event System Design

**Technology Choice:** Python asyncio with custom event bus (lightweight for Pi)

```python
class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._event_queue: asyncio.Queue = asyncio.Queue()
        
    async def publish(self, event: BaseEvent) -> None
    async def subscribe(self, event_type: str, handler: Callable) -> None
    async def process_events(self) -> None  # Main event loop
```

### 5.2 Event Types Hierarchy
```python
class BaseEvent:
    timestamp: datetime
    event_id: str
    source_module: str

class MarketDataEvent(BaseEvent):
    symbol: str
    price_data: Dict[str, float]

class SignalEvent(BaseEvent):  
    symbol: str
    signal_type: str  # 'buy' | 'sell' | 'hold'
    confidence: float
    strategy: str

class OrderEvent(BaseEvent):
    order_id: str
    symbol: str  
    # ... order details
```

## 6. Technology Stack

### 6.1 Core Technologies
- **Runtime:** Python 3.11+ (Ubuntu 24.04 default)
- **Database:** TimescaleDB (PostgreSQL extension)
- **Web Framework:** FastAPI (async, high performance)
- **Frontend:** React + TypeScript (for dashboard)
- **Event Processing:** Python asyncio
- **Data Processing:** Pandas, NumPy
- **Testing:** pytest, pytest-asyncio

### 6.2 External Dependencies
- **Market Data:** yfinance, alpha_vantage
- **Broker Integration:** alpaca-trade-api (paper/live trading)
- **Visualization:** Plotly, Chart.js
- **Deployment:** Docker, docker-compose

## 7. API Design

### 7.1 REST API Endpoints
```python
# Strategy Management
GET    /api/strategies              # List all strategies
POST   /api/strategies/{name}/start # Start strategy
POST   /api/strategies/{name}/stop  # Stop strategy  
GET    /api/strategies/{name}/performance # Get performance metrics

# Portfolio Management  
GET    /api/portfolio/positions     # Current positions
GET    /api/portfolio/performance   # Portfolio metrics
GET    /api/portfolio/orders        # Recent orders

# Backtesting
POST   /api/backtest/run            # Run backtest
GET    /api/backtest/results/{id}   # Get backtest results
GET    /api/backtest/history        # List past backtests

# System Management
GET    /api/system/status           # System health
GET    /api/system/config           # Current configuration
POST   /api/system/config           # Update configuration
```

### 7.2 WebSocket Streams
```python
# Real-time updates
/ws/market-data                     # Live price feeds
/ws/portfolio-updates               # Position changes
/ws/system-events                   # System status updates
```

## 8. Security Considerations

### 8.1 API Security
- **Authentication:** JWT tokens for dashboard access
- **Network:** Restrict dashboard to local network by default
- **API Keys:** Encrypted storage of broker/data provider credentials
- **Rate Limiting:** Prevent API abuse

### 8.2 Data Security  
- **Database:** Local encryption at rest
- **Logging:** Sanitized logs (no sensitive data)
- **Backup:** Encrypted backup procedures

## 9. Performance Characteristics

### 9.1 Expected Performance (Pi 5)
- **Market Data Processing:** 100+ symbols real-time updates
- **Strategy Execution:** Sub-100ms signal generation
- **Database Writes:** 1000+ ticks/second sustainable  
- **Dashboard Updates:** Real-time via WebSocket
- **Memory Usage:** <2GB total system memory

### 9.2 Scalability Limits
- **Storage:** 256GB local constraint (6+ months of minute data for 100 symbols)
- **CPU:** 4 cores, strategy complexity limited by CPU
- **Network:** Internet bandwidth dependent on data frequency

## 10. Deployment Strategy

### 10.1 Development Workflow
```bash
# Local Development
git clone <repo>
docker-compose up -d  # TimescaleDB + Redis
python -m venv venv
pip install -e .
python src/main.py

# Pi Deployment  
git pull origin main
docker-compose -f docker-compose.pi.yml up -d
systemctl restart trading-system
```

### 10.2 Configuration Management
- **Environment-specific configs:** `config/dev.yaml`, `config/prod.yaml`
- **Secret management:** Environment variables for API keys
- **Feature flags:** Runtime strategy enabling/disabling

---

## Next Phase: Technical Architecture Design

The next phase will detail:
1. Detailed class diagrams and interfaces
2. Database schema with sample data
3. Event flow diagrams
4. Error handling and recovery procedures
5. Performance optimization strategies
6. Testing strategy and framework selection