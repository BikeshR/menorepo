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

### Adding New Strategies
1. Inherit from `BaseStrategy` in `core/interfaces.py`
2. Implement required methods: `initialize()`, `on_market_data()`, `on_order_filled()`
3. Add strategy configuration to `trading_config.yaml`
4. Register in `strategies/manager.py`

### Event System Usage
- All components communicate via events through the event bus
- Events inherit from `BaseEvent` and include metadata
- Use `await event_bus.publish(event)` to send events
- Subscribe with `event_bus.subscribe(event_type, handler)`

### Testing Strategy
- **Unit tests**: Test individual components in isolation
- **Integration tests**: Test component interactions
- **System tests**: End-to-end workflow validation
- Mock external APIs (Yahoo Finance, Alpaca) in tests

### Error Handling
- Use structured logging with `structlog`
- Implement circuit breakers for external API failures
- Graceful degradation when services are unavailable
- Comprehensive exception handling with recovery procedures

### Performance Considerations
- System designed for Pi5 hardware constraints (4 cores, 8GB RAM)
- Async processing throughout for maximum throughput
- Database optimized with proper indexes and hypertables
- Memory-efficient data processing with pandas

## Troubleshooting

### Common Issues
- **Database connection**: Ensure TimescaleDB container is healthy
- **API not responding**: Check Docker container status with `docker compose ps`
- **Strategy not starting**: Verify configuration in `trading_config.yaml`
- **Market data issues**: Check API keys in environment variables

### Logs and Monitoring
- Application logs: `deployment/logs/`
- Docker logs: `docker compose logs -f`
- System health: `http://localhost:8080/health`
- API docs: `http://localhost:8080/docs`

### Deployment Issues
- Use `./deploy.sh --clean` for complete rebuild
- Check system resources with `htop` on Pi5
- Verify network connectivity for market data APIs
- Monitor temperature with `vcgencmd measure_temp` (Pi5 specific)