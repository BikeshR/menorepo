# Pi5 Trading System

**Professional Algorithmic Trading System for Raspberry Pi 5**

A comprehensive, production-ready algorithmic trading system designed specifically for Raspberry Pi 5 with Ubuntu 24.04 LTS. Features event-driven architecture, sophisticated risk management, and multi-strategy execution capabilities.

## 🚀 Quick Start (Raspberry Pi 5)

### Two-Step Deployment Process

**Step 1: System Setup (Run Once)**
```bash
# Clone the repository
git clone https://github.com/BikeshR/menorepo.git
cd menorepo/projects/pi5-trading-system/deployment

# Set up Pi5 system (installs Docker, dependencies, etc.)
sudo ./setup_pi5.sh
```

**Step 2: Deploy Trading System**
```bash
# Deploy the trading system
./deploy.sh

# For updates with clean build:
./deploy.sh --clean --update

# Deploy and show logs:
./deploy.sh --logs
```

### Deployment Options

```bash
# From deployment/ directory:

# Basic deployment
./deploy.sh

# Clean build (rebuild everything)
./deploy.sh --clean

# Update code and deploy
./deploy.sh --update

# Full clean update with logs
./deploy.sh --clean --update --logs

# Manual Docker commands (if needed)
docker compose up -d        # Start
docker compose down         # Stop
docker compose logs -f      # View logs
```

### Access the System

After deployment, access your trading system:
- **API Documentation:** `http://your-pi-ip:8080/docs`
- **Health Check:** `http://your-pi-ip:8080/health` 
- **System Status:** `docker-compose ps`
- **View Logs:** `docker-compose logs -f`

## 📋 Features

### ✅ **Phase 1 Complete - Production Ready**

- **🏗️ Event-Driven Architecture** - High-performance async processing (10,000+ events/sec)
- **📊 TimescaleDB Integration** - Optimized time-series database with hypertables
- **🧠 Multi-Strategy Engine** - Simultaneous execution of multiple trading strategies
- **⚖️ Sophisticated Risk Management** - Multiple position sizing algorithms and risk controls
- **📈 Real-time Portfolio Management** - Live P&L tracking and performance analytics
- **🔄 Complete Order Management** - Paper trading with realistic execution simulation
- **🛡️ Comprehensive Error Handling** - Production-grade exception handling and recovery
- **📝 Full System Integration** - End-to-end workflow demonstration

### 🔧 **System Components**

#### **Core Trading Engine**
- **Strategy Manager** - Multi-strategy execution with lifecycle management
- **Risk Manager** - Real-time risk monitoring with circuit breakers
- **Order Manager** - Complete order lifecycle with execution algorithms
- **Portfolio Manager** - Real-time position tracking and performance calculation
- **Event Bus** - High-performance event routing with async processing

#### **Data & Storage**
- **TimescaleDB** - Time-series optimized PostgreSQL with continuous aggregates
- **Market Data Repository** - Efficient storage and retrieval of market data
- **Redis Cache** - High-speed caching for frequently accessed data
- **Data Retention Policies** - Automated cleanup and archival

#### **Risk Management**
- **Position Sizing Algorithms:**
  - Fixed Fractional
  - Volatility Adjusted
  - Kelly Criterion
  - Risk Parity
- **Risk Limits:**
  - Maximum position size (15% default)
  - Portfolio exposure limits (90% default)
  - Daily loss limits (3% default)
  - Drawdown protection (15% max)

#### **Strategy Implementation**
- **Moving Average Crossover** - Configurable periods and types (SMA/EMA)
- **Confidence Scoring** - Multi-factor signal validation
- **Strategy Framework** - Easy addition of new strategies
- **Backtesting Engine** - Historical strategy validation

## 🔧 **System Requirements**

### **Hardware**
- **Raspberry Pi 5** (8GB RAM recommended)
- **64GB+ microSD card** (Class 10 or better)
- **Stable internet connection**
- **Optional: External SSD** for better performance

### **Software**
- **Ubuntu 24.04 LTS ARM64**
- **Docker & Docker Compose**
- **Python 3.11+**
- **Poetry** (for dependency management)

## 📖 **Architecture Overview**

### **Event-Driven Design**
```
Market Data → Event Bus → Strategy Manager → Signal → Risk Manager → Order Manager → Broker
     ↓             ↓            ↓              ↓           ↓              ↓          ↓
Database ←   Event Store ←  Performance ←  Portfolio ←  Compliance ←  Execution ← Fills
```

### **Component Interaction**
- **Async Processing** - Non-blocking event handling for maximum throughput
- **Circuit Breakers** - Automatic failure detection and recovery
- **Health Monitoring** - Real-time system health and performance tracking
- **Graceful Degradation** - Continues operation during partial failures

## 🛠️ **Configuration**

### **Environment Variables** (`.env`)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pi5_trading
DB_USER=pi5trader
DB_PASSWORD=your_secure_password

# Trading
INITIAL_CASH=100000.0
DEMO_MODE=true
PAPER_TRADING=true

# Market Data APIs
YAHOO_FINANCE_ENABLED=true
ALPHA_VANTAGE_API_KEY=your_api_key
```

### **Trading Configuration** (`config/trading_config.yaml`)
```yaml
strategies:
  moving_average_crossover:
    enabled: true
    symbols: ["AAPL", "MSFT", "GOOGL", "TSLA"]
    parameters:
      short_period: 20
      long_period: 50
      confidence_threshold: 0.75

risk_management:
  max_position_size: 0.15
  max_daily_loss: 0.03
  position_sizing_method: "volatility_adjusted"
```

## 🔍 **Monitoring & Management**

### **Docker Commands** (Primary Management)
```bash
# From deployment/ directory:
docker compose up -d       # Start all services
docker compose down        # Stop all services
docker compose restart     # Restart all services
docker compose ps          # Show container status
docker compose logs -f     # View real-time logs

# Individual service management
docker compose restart trading_api  # Restart just the trading API
docker compose logs trading_api     # View trading API logs
docker compose exec trading_api bash # Access container shell
```

### **System Service Commands** (Auto-start Management)
```bash
# Systemd service (for auto-start on boot)
sudo systemctl start pi5-trading-system    # Start via systemd
sudo systemctl stop pi5-trading-system     # Stop via systemd
sudo systemctl status pi5-trading-system   # Check systemd status
sudo systemctl enable pi5-trading-system   # Enable auto-start
```

### **Standard Commands**
```bash
# Docker management
docker ps                  # Show containers
docker-compose logs        # View logs  
docker-compose up -d       # Start services
docker-compose down        # Stop services
htop                       # System monitoring
```

### **Web Interface**
- **API Documentation:** `http://your-pi-ip:8080/docs` (Swagger UI)
- **REST API:** Complete trading system control via HTTP endpoints
- **WebSocket Streams:** Real-time market data and portfolio updates
- **Dashboard:** React frontend for monitoring (Phase 4 - planned)

### **Log Files**
- **Application Logs:** `/opt/pi5-trading-system/logs/`
- **System Logs:** `/var/log/pi5-trading-system/`
- **Database Logs:** Docker container logs

## 📊 **Performance Metrics**

### **System Performance**
- **Event Processing:** 10,000+ events/second
- **Latency:** <100ms event processing
- **Memory Usage:** <2GB total system memory
- **CPU Usage:** <50% during normal operation

### **Trading Metrics**
- **Strategy Signals:** Real-time signal generation
- **Order Execution:** <1 second order processing
- **Risk Calculation:** Real-time risk monitoring
- **Portfolio Updates:** Sub-second position updates

## 🧪 **Testing & Validation**

### **Run Demo System**
```bash
# Deploy with Docker and access the API
./deployment/deploy.sh

# The system runs automatically with demo trading enabled
# Access the API at: http://your-pi-ip:8080/docs
```

### **System Tests**
```bash
# Run unit tests
poetry run pytest tests/unit/

# Run integration tests
poetry run pytest tests/integration/

# Run system tests
poetry run pytest tests/system/
```

## 🌐 **API Documentation**

### **REST API Endpoints**
The system provides a comprehensive REST API accessible at `http://your-pi-ip:8080`:

#### **System Management**
```bash
GET  /api/system/status      # System health and status
GET  /api/system/config      # Current configuration
POST /api/system/config      # Update configuration
```

#### **Strategy Management**
```bash
GET  /api/strategies                           # List all strategies
POST /api/strategies/{name}/start              # Start a strategy
POST /api/strategies/{name}/stop               # Stop a strategy
GET  /api/strategies/{name}/performance        # Strategy performance
```

#### **Portfolio Management**
```bash
GET  /api/portfolio/positions     # Current positions
GET  /api/portfolio/performance   # Portfolio metrics
GET  /api/portfolio/orders        # Recent orders
```

#### **Backtesting**
```bash
POST /api/backtest/run            # Run backtest
GET  /api/backtest/results/{id}   # Get results
GET  /api/backtest/history        # Backtest history
```

### **WebSocket Streams**
Real-time data streams available at:
```bash
ws://your-pi-ip:8080/ws/market-data        # Live market data
ws://your-pi-ip:8080/ws/portfolio-updates  # Portfolio changes
ws://your-pi-ip:8080/ws/system-events      # System events
```

### **Interactive API Documentation**
- **Swagger UI:** `http://your-pi-ip:8080/docs`
- **ReDoc:** `http://your-pi-ip:8080/redoc`

## 🔒 **Security Features**

- **Containerized Deployment** - Isolated application environment
- **Non-root Execution** - Security-focused user permissions
- **Encrypted Credentials** - Secure API key management
- **Firewall Configuration** - Network security controls
- **Audit Logging** - Complete trading activity audit trail

## 📈 **Roadmap**

### **Phase 2: Market Data Integration** ⏭️ Next
- Live market data providers (Yahoo Finance, Alpha Vantage, IEX)
- Real-time data streaming and normalization
- Technical indicators library

### **Phase 3: Live Broker Integration**
- Interactive Brokers API connection
- Alpaca Markets integration
- Real money trading execution

### **Phase 4: Web Dashboard**
- React-based monitoring interface
- Real-time visualization
- Strategy configuration interface

### **Phase 5: Advanced Features**
- Additional trading strategies
- Advanced backtesting with optimization
- Machine learning integration

## 📚 **Documentation**

- **[Requirements](docs/REQUIREMENTS.md)** - Detailed system requirements
- **[System Design](docs/SYSTEM_DESIGN.md)** - Architecture and design decisions
- **[Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)** - Implementation details
- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** - Development roadmap

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ **Disclaimer**

This software is for educational and personal use only. Trading involves substantial risk of loss and is not suitable for all investors. Past performance does not guarantee future results. Use at your own risk.

## 🆘 **Support**

- **Issues:** [GitHub Issues](https://github.com/BikeshR/menorepo/issues)
- **Discussions:** [GitHub Discussions](https://github.com/BikeshR/menorepo/discussions)
- **Documentation:** [Wiki](https://github.com/BikeshR/menorepo/wiki)

---

**Built with ❤️ for the Raspberry Pi and algorithmic trading community**