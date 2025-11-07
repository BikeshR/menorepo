# Quick Start Guide - Pi5 Trading System

Deploy the Pi5 Trading System on your Raspberry Pi 5 (8GB) in 5 minutes.

---

## Prerequisites

- **Raspberry Pi 5** (8GB) with Ubuntu 24.04 LTS or Pi OS 64-bit
- **Docker & Docker Compose** installed
- **256GB NVMe SSD** recommended (or microSD Class 10 minimum)
- **Internet connection**

---

## 🚀 Deploy in 3 Steps

### Step 1: Clone & Configure

```bash
# Clone repository
git clone <your-repo-url>
cd menorepo/projects/pi5-trading-system/deployments

# Create environment file
cp .env.example .env
nano .env  # Set DB_PASSWORD and other variables
```

**Minimum required in `.env`:**
```bash
DB_PASSWORD=your_secure_password_change_this
INITIAL_CASH=100000.0
DEMO_MODE=true
PAPER_TRADING=true
```

### Step 2: Deploy

```bash
# Deploy with Pi5-optimized configuration
docker-compose -f docker-compose.pi5-optimized.yml up -d

# Wait ~30 seconds for services to start
```

### Step 3: Access Web Interface

```bash
# Find your Pi5 IP address
hostname -I

# Open browser to: http://YOUR_PI5_IP:8080
```

**Default login:**
- Username: `admin`
- Password: `admin123`

**⚠️ Change default password immediately after first login!**

---

## ✅ Verify Deployment

### Check Containers Running

```bash
docker ps

# Should see 5 containers:
# - pi5_trading_api
# - pi5_trading_db
# - pi5_trading_redis
# - victoriametrics
# - gotify
```

### Test Web Interface

1. Login at `http://YOUR_PI5_IP:8080`
2. View Portfolio page
3. View Strategies page
4. Check System Health page

### Test API

```bash
# Health check
curl http://localhost:8080/health

# Prometheus metrics
curl http://localhost:8080/metrics
```

---

## 🔧 Quick Management

### View Logs

```bash
cd deployments

# View all logs
docker-compose -f docker-compose.pi5-optimized.yml logs -f

# View specific service
docker-compose -f docker-compose.pi5-optimized.yml logs -f trading_api
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.pi5-optimized.yml restart

# Restart specific service
docker-compose -f docker-compose.pi5-optimized.yml restart trading_api
```

### Stop/Start System

```bash
# Stop all services
docker-compose -f docker-compose.pi5-optimized.yml down

# Start all services
docker-compose -f docker-compose.pi5-optimized.yml up -d
```

---

## 📚 Next Steps

### Post-Deployment Setup

1. **Create your admin user**
   - See [DEPLOYMENT.md](DEPLOYMENT.md#step-6-post-deployment-setup)

2. **Enable TimescaleDB compression** (after 1 day)
   ```bash
   cd /home/user/menorepo/projects/pi5-trading-system
   docker exec -i pi5_trading_db psql -U pi5trader -d pi5_trading < scripts/enable_compression.sql
   ```

3. **Setup automated backups**
   ```bash
   ./scripts/setup_cron.sh
   ```

4. **Optimize Pi5 performance**
   - See [PI5-OPTIMIZATION.md](PI5-OPTIMIZATION.md)

### Configure Trading Strategies

Edit `configs/config.yaml` to:
- Enable/disable strategies
- Adjust strategy parameters
- Set risk limits
- Configure position sizing

Then restart:
```bash
docker-compose -f deployments/docker-compose.pi5-optimized.yml restart trading_api
```

---

## 🛠️ Troubleshooting

### Containers Won't Start

```bash
# Check logs
docker-compose -f deployments/docker-compose.pi5-optimized.yml logs

# Common fixes:
docker-compose -f deployments/docker-compose.pi5-optimized.yml down
docker-compose -f deployments/docker-compose.pi5-optimized.yml up -d
```

### Web Interface Not Loading

```bash
# Check if API is running
curl http://localhost:8080/health

# Check firewall
sudo ufw allow 8080/tcp
```

### Database Connection Error

```bash
# Check database is running
docker exec pi5_trading_db pg_isready -U pi5trader

# Verify password in .env
cat .env | grep DB_PASSWORD
```

---

## 📖 Full Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide (Docker + systemd)
- **[SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)** - Architecture overview
- **[PI5-OPTIMIZATION.md](PI5-OPTIMIZATION.md)** - Performance tuning
- **[../scripts/README.md](../scripts/README.md)** - Backup & maintenance

---

## 🆘 Need Help?

1. Check logs: `docker-compose logs -f`
2. Review [DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting)
3. Check [PI5-OPTIMIZATION.md](PI5-OPTIMIZATION.md) for performance issues
4. Report issues on GitHub

---

**🎉 System deployed! Start trading at `http://YOUR_PI5_IP:8080`**
