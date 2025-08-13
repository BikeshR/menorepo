# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Pi5 Trading System** - a professional algorithmic trading system designed for Raspberry Pi 5. It's a comprehensive, production-ready system featuring:

- **Event-driven architecture** with async processing (10,000+ events/sec capability)
- **Multi-strategy trading engine** with risk management
- **TimescaleDB integration** for time-series market data
- **Real-time portfolio management** with P&L tracking
- **FastAPI-based REST API** with WebSocket streams
- **React dashboard** for monitoring and control
- **Docker deployment** optimized for Pi5 hardware

## Key Development Commands

### Testing
```bash
# Run all tests
pytest

# Run specific test categories
pytest -m unit                    # Unit tests only
pytest -m integration            # Integration tests only
pytest -m e2e                     # End-to-end system tests
pytest -m "not slow"             # Skip slow tests
pytest tests/integration/        # Run integration tests directory

# Run tests with coverage (if pytest-cov installed)
poetry run pytest --cov=trading_api --cov-report=html
```

### Code Quality
```bash
# Format code
poetry run black --line-length 100 .
poetry run isort .

# Type checking
poetry run mypy trading_api/

# Linting
poetry run flake8 trading_api/
```

### Development Server
```bash
# Run development server directly
python trading_api/main.py

# Run with poetry
poetry run python trading_api/main.py

# Run specific CLI tools
poetry run pi5-trading          # Main trading system
poetry run pi5-backtest        # Backtesting CLI
poetry run pi5-config          # Configuration CLI
```

### Docker Deployment
```bash
# From deployment/ directory
./deploy.sh                     # Standard deployment
./deploy.sh --clean            # Clean build (rebuild everything)
./deploy.sh --update           # Update code and redeploy (optimized)
./deploy.sh --logs             # Deploy and show logs

# Manual Docker commands
docker compose up -d           # Start all services
docker compose down            # Stop all services
docker compose logs -f         # View real-time logs
docker compose ps              # Show container status
docker compose restart trading_api  # Restart just the API
```

### Dashboard Development (React)
```bash
cd dashboard/
npm ci                         # Install dependencies
npm start                      # Development server (port 3000)
npm run build                  # Production build
npm test                       # Run tests
```

## Architecture Overview

### Core Components
- **`trading_api/`** - Main Python application with FastAPI
- **`dashboard/`** - React frontend for monitoring
- **`config/`** - YAML configuration files
- **`deployment/`** - Docker and deployment scripts
- **`tests/`** - Comprehensive test suite
- **`docs/`** - Detailed system documentation

### Event-Driven System
The system uses an event bus pattern where:
1. **Market Data** → `MarketDataEvent` → **Event Bus**
2. **Strategy Manager** processes data → generates `SignalEvent`
3. **Risk Manager** validates signals → creates `OrderRequest`  
4. **Order Manager** executes trades → sends `OrderFilledEvent`
5. **Portfolio Manager** tracks positions → publishes `PortfolioUpdateEvent`

### Key Modules
- **`core/interfaces.py`** - Abstract base classes and interfaces
- **`events/event_bus.py`** - Central event routing system
- **`strategies/`** - Trading strategy implementations
- **`risk/manager.py`** - Position sizing and risk controls
- **`orders/manager.py`** - Order lifecycle management
- **`portfolio/manager.py`** - Position tracking and P&L
- **`web/app.py`** - FastAPI application factory

### Database Design
Uses TimescaleDB (PostgreSQL) with hypertables for:
- **`market_data`** - OHLCV time-series data
- **`orders`** - Order lifecycle tracking
- **`positions`** - Current portfolio positions
- **`strategy_performance`** - Strategy metrics over time

## Configuration

### Environment Variables (.env)
```bash
# Database
DB_PASSWORD=trading_secure_2025
ALPHA_VANTAGE_API_KEY=your_api_key_here

# Trading
INITIAL_CASH=100000.0
DEMO_MODE=true
PAPER_TRADING=true
```

### Trading Configuration (config/trading_config.yaml)
```yaml
strategies:
  moving_average_crossover:
    enabled: true
    symbols: ["AAPL", "MSFT", "GOOGL", "TSLA"]
    parameters:
      short_period: 20
      long_period: 50

risk_management:
  max_position_size: 0.15
  max_daily_loss: 0.03
  position_sizing_method: "volatility_adjusted"
```

## API Structure

### REST Endpoints
- **`/api/strategies/`** - Strategy management (start/stop/performance)
- **`/api/portfolio/`** - Portfolio positions and performance
- **`/api/backtest/`** - Backtesting operations
- **`/api/system/`** - System status and configuration

### WebSocket Streams
- **`/ws/market-data`** - Real-time price updates
- **`/ws/portfolio-updates`** - Position changes
- **`/ws/system-events`** - System status events

Access at: `http://localhost:8080/` (API) and `http://localhost:3000/` (Dashboard in dev)

## Development Guidelines

### Development Workflow for Every Task

**🔄 MANDATORY 4-STEP PROCESS for ALL development tasks:**

#### Step 1: Implementation
- Implement the feature/fix in the codebase
- Follow existing code patterns and architecture
- Add appropriate logging and error handling
- Update configuration files if needed

#### Step 2: Local Docker Build Verification
```bash
# Build and deploy locally
cd deployment/
./deploy.sh --clean

# Verify all services are healthy
docker compose ps

# Check logs for any errors
docker compose logs -f
```

#### Step 3: Fix Docker Build/Runtime Issues
```bash
# Check individual service logs
docker compose logs trading_api
docker compose logs timescaledb
docker compose logs redis

# Debug container issues
docker compose exec trading_api bash
docker compose exec timescaledb psql -U pi5trader -d pi5_trading

# Fix any issues found:
# - Missing dependencies
# - Configuration errors
# - Database connection issues
# - Port conflicts
# - Volume mount problems
```

#### Step 4: Frontend Verification with Playwright
```bash
# Use Playwright MCP to verify web interface works in Docker
# Test key user workflows:
# 1. Login functionality
# 2. Dashboard loads correctly
# 3. Real-time data updates
# 4. Strategy controls work
# 5. API endpoints respond
# 6. WebSocket connections work

# Example verification checklist:
# - Navigate to http://localhost:8080
# - Login with demo credentials (admin/admin123)
# - Verify dashboard components load
# - Check portfolio data displays
# - Test strategy start/stop controls
# - Verify real-time updates work
# - Check API docs at /docs
```

**⚠️ CRITICAL: Do not consider any task complete until all 4 steps pass successfully.**

### Adding New Strategies
1. **Implementation**: Inherit from `BaseStrategy` in `core/interfaces.py`
2. **Implementation**: Implement required methods: `initialize()`, `on_market_data()`, `on_order_filled()`
3. **Implementation**: Add strategy configuration to `trading_config.yaml`
4. **Implementation**: Register in `strategies/manager.py`
5. **Docker Verification**: Deploy with `./deploy.sh --clean` and verify strategy loads
6. **Fix Issues**: Check logs and fix any initialization or runtime errors
7. **Playwright Testing**: Verify strategy appears in web dashboard and controls work

### Event System Usage
- All components communicate via events through the event bus
- Events inherit from `BaseEvent` and include metadata
- Use `await event_bus.publish(event)` to send events
- Subscribe with `event_bus.subscribe(event_type, handler)`
- **Docker Testing**: Verify events flow properly in containerized environment
- **Playwright Testing**: Confirm real-time events update the web interface

### Testing Strategy
- **Unit tests**: Test individual components in isolation
- **Integration tests**: Test component interactions
- **System tests**: End-to-end workflow validation
- **Docker tests**: Full system testing in containerized environment
- **Frontend tests**: Playwright automation to verify web interface
- Mock external APIs (Yahoo Finance, Alpaca) in tests

### Error Handling
- Use structured logging with `structlog`
- Implement circuit breakers for external API failures
- Graceful degradation when services are unavailable
- Comprehensive exception handling with recovery procedures
- **Docker Monitoring**: Monitor container health and restart policies
- **Web Interface**: Ensure errors are displayed appropriately in dashboard

### Performance Considerations
- System designed for Pi5 hardware constraints (4 cores, 8GB RAM)
- Async processing throughout for maximum throughput
- Database optimized with proper indexes and hypertables
- Memory-efficient data processing with pandas
- **Docker Optimization**: Container resource limits and health checks
- **Web Performance**: Frontend optimization for real-time updates

## Troubleshooting

### Development Workflow Issues

#### Step 2: Docker Build/Deployment Issues
```bash
# Common Docker problems and solutions:

# 1. Container fails to start
docker compose ps                    # Check service status
docker compose logs trading_api     # Check specific service logs
docker compose logs --tail=50 -f    # Monitor live logs

# 2. Port conflicts
sudo netstat -tulpn | grep :8080    # Check if port is in use
docker compose down                  # Stop all services
docker compose up -d                 # Restart services

# 3. Database connection issues
docker compose exec timescaledb pg_isready -U pi5trader -d pi5_trading
docker compose exec trading_api ping timescaledb
```

#### Step 3: Container Runtime Issues
```bash
# Debug container internals
docker compose exec trading_api bash
docker compose exec trading_api ps aux
docker compose exec trading_api df -h

# Check environment variables
docker compose exec trading_api env | grep DB_

# Test database connectivity from API container
docker compose exec trading_api python -c "
import asyncpg
import asyncio
async def test():
    conn = await asyncpg.connect('postgresql://pi5trader:trading_secure_2025@timescaledb:5432/pi5_trading')
    print('DB connected successfully')
    await conn.close()
asyncio.run(test())
"

# Test API endpoints directly
docker compose exec trading_api curl http://localhost:8080/health
docker compose exec trading_api curl http://localhost:8080/api/v1/system/status
```

#### Step 4: Frontend/Playwright Issues
```bash
# Verify web service is accessible
curl -I http://localhost:8080                    # Check if server responds
curl http://localhost:8080/health                # Check health endpoint
curl http://localhost:8080/api/v1/system/status  # Check API

# Common Playwright debugging:
# 1. Service not ready - wait for container health
# 2. Login issues - verify demo credentials work
# 3. WebSocket failures - check network connectivity
# 4. Component not loading - check React build
```

### Common Issues
- **Database connection**: Ensure TimescaleDB container is healthy with `docker compose ps`
- **API not responding**: Check container status and logs with `docker compose logs trading_api`
- **Strategy not starting**: Verify configuration in `trading_config.yaml` and check logs
- **Market data issues**: Check API keys in environment variables and provider logs
- **Frontend not loading**: Verify React build completed and files are served correctly
- **WebSocket connections failing**: Check CORS settings and network connectivity
- **Container startup order**: Ensure database is healthy before API starts (depends_on: condition)

### Logs and Monitoring
- Application logs: `deployment/logs/`
- Docker logs: `docker compose logs -f`
- Individual service logs: `docker compose logs [service_name]`
- System health: `http://localhost:8080/health`
- API docs: `http://localhost:8080/docs`
- Container resource usage: `docker stats`
- Container inspection: `docker compose exec [service] bash`

### Deployment Issues
- Use `./deploy.sh --clean` for complete rebuild
- Check system resources with `htop` on Pi5
- Verify network connectivity for market data APIs
- Monitor temperature with `vcgencmd measure_temp` (Pi5 specific)
- Check Docker daemon status: `sudo systemctl status docker`
- Verify Docker Compose version: `docker compose version`

### Performance Debugging
```bash
# Monitor container performance
docker stats                         # Real-time container resource usage
docker compose top                   # Process information for all services

# Database performance
docker compose exec timescaledb psql -U pi5trader -d pi5_trading -c "
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
FROM pg_stat_user_tables 
WHERE schemaname = 'public';
"

# API performance
docker compose exec trading_api python -c "
import aiohttp
import asyncio
import time

async def test_endpoints():
    async with aiohttp.ClientSession() as session:
        endpoints = ['/health', '/api/v1/system/status', '/api/v1/strategies']
        for endpoint in endpoints:
            start = time.time()
            async with session.get(f'http://localhost:8080{endpoint}') as resp:
                elapsed = time.time() - start
                print(f'{endpoint}: {resp.status} ({elapsed:.3f}s)')

asyncio.run(test_endpoints())
"
```

## Playwright MCP Frontend Verification

### Required Playwright MCP Workflow

**For Step 4 of every development task, use Playwright MCP to verify frontend functionality:**

#### 1. Basic Navigation and Login
```javascript
// Navigate to application
await page.goto('http://localhost:8080');

// Verify login page loads
await expect(page.locator('input[name="username"]')).toBeVisible();
await expect(page.locator('input[name="password"]')).toBeVisible();

// Test login functionality
await page.fill('input[name="username"]', 'admin');
await page.fill('input[name="password"]', 'admin123');
await page.click('button[type="submit"]');

// Verify successful login and dashboard loads
await expect(page.locator('h1')).toContainText('Trading Dashboard');
```

#### 2. Dashboard Component Verification
```javascript
// Check main dashboard components are present
await expect(page.locator('[data-testid="portfolio-summary"]')).toBeVisible();
await expect(page.locator('[data-testid="strategy-controls"]')).toBeVisible();
await expect(page.locator('[data-testid="market-data-display"]')).toBeVisible();

// Verify data is loading (not showing loading spinners indefinitely)
await page.waitForSelector('[data-testid="portfolio-value"]', { timeout: 10000 });
await expect(page.locator('[data-testid="portfolio-value"]')).not.toHaveText('Loading...');
```

#### 3. Strategy Control Testing
```javascript
// Test strategy start/stop functionality
const strategyToggle = page.locator('[data-testid="strategy-moving-average-toggle"]');
await expect(strategyToggle).toBeVisible();

// Start strategy
await strategyToggle.click();
await expect(page.locator('[data-testid="strategy-status"]')).toContainText('Running');

// Stop strategy
await strategyToggle.click();
await expect(page.locator('[data-testid="strategy-status"]')).toContainText('Stopped');
```

#### 4. Real-time Data Updates
```javascript
// Verify WebSocket connections and real-time updates
const portfolioValue = await page.locator('[data-testid="portfolio-value"]').textContent();

// Wait for real-time update (market data should update values)
await page.waitForFunction((initialValue) => {
    const currentValue = document.querySelector('[data-testid="portfolio-value"]')?.textContent;
    return currentValue !== initialValue;
}, portfolioValue, { timeout: 30000 });

// Verify timestamps are recent (within last minute)
const timestamp = await page.locator('[data-testid="last-update-time"]').textContent();
const updateTime = new Date(timestamp);
const now = new Date();
expect(now - updateTime).toBeLessThan(60000); // Within 1 minute
```

#### 5. API Integration Testing
```javascript
// Test API documentation access
await page.goto('http://localhost:8080/docs');
await expect(page.locator('h2')).toContainText('FastAPI');

// Test health endpoint through UI
await page.goto('http://localhost:8080/health');
const healthResponse = await page.textContent('pre');
expect(JSON.parse(healthResponse)).toHaveProperty('status', 'healthy');
```

#### 6. Error Handling Verification
```javascript
// Test error display when services are down
// (This should be done with containers intentionally stopped)
await page.goto('http://localhost:8080');

// Should show error message, not crash
await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
await expect(page.locator('[data-testid="error-message"]')).toContainText('Connection error');
```

### Playwright MCP Integration Commands

**Use these MCP tools for automated frontend testing:**

1. **mcp__playwright__browser_navigate** - Navigate to application URL
2. **mcp__playwright__browser_snapshot** - Capture current page state  
3. **mcp__playwright__browser_click** - Test user interactions
4. **mcp__playwright__browser_type** - Input form data
5. **mcp__playwright__browser_wait_for** - Wait for elements/conditions
6. **mcp__playwright__browser_evaluate** - Run JavaScript for data validation

### Frontend Verification Checklist

**✅ MUST PASS for task completion:**

- [ ] **Navigation**: Application loads at http://localhost:8080
- [ ] **Authentication**: Login with demo credentials works
- [ ] **Dashboard**: Main components render without errors
- [ ] **Data Display**: Portfolio and market data display correctly
- [ ] **Controls**: Strategy start/stop buttons function
- [ ] **Real-time Updates**: WebSocket data updates in UI
- [ ] **API Access**: /docs and /health endpoints accessible
- [ ] **Error Handling**: Graceful error display when services unavailable
- [ ] **Responsiveness**: UI works on different screen sizes
- [ ] **Performance**: Page loads within 3 seconds

**⚠️ CRITICAL: If any checklist item fails, the task is NOT complete. Fix issues and re-test.**