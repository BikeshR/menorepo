# Deployment Guide - Pi5 Trading System

Complete deployment guide for Raspberry Pi 5 (8GB) running Ubuntu 24.04 LTS or Raspberry Pi OS 64-bit.

---

## 📋 Prerequisites

### Hardware Requirements
- **Raspberry Pi 5** - 8GB RAM model
- **Storage** - 256GB NVMe SSD (highly recommended) or microSD Class 10 minimum
- **Cooling** - Active cooling fan (heatsink + fan recommended for 24/7 operation)
- **Power** - Official Raspberry Pi 5 27W USB-C power supply
- **Network** - Ethernet connection (WiFi works but Ethernet preferred for stability)

### Software Requirements
- **OS** - Ubuntu 24.04 LTS ARM64 or Raspberry Pi OS 64-bit (Bookworm)
- **Docker** - Version 24.0 or later
- **Docker Compose** - Version 2.20 or later
- **Git** - For cloning the repository

---

## 🚀 Deployment Options

Choose one of two deployment methods:

### Option A: Docker Compose (Recommended)
- Easiest to set up and manage
- Isolated containers with resource limits
- Automatic restarts on failure
- Best for: Most users, quick deployment, testing

### Option B: Docker Compose + Systemd
- Auto-start on Pi5 boot
- System-level service management
- Better for: Production 24/7 operation

---

## 📦 Option A: Docker Compose Deployment

### Step 1: Install Docker

**On Ubuntu 24.04:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Log out and back in for group changes to take effect
# Then verify installation
docker --version
docker compose version
```

**On Raspberry Pi OS:**
```bash
# Docker usually pre-installed, but update if needed
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose -y

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker compose version
```

### Step 2: Clone Repository

```bash
# Clone the repository
git clone <your-repo-url>
cd menorepo/projects/pi5-trading-system

# Verify you're in the correct directory
ls -la
# Should see: cmd/, internal/, dashboard/, deployments/, docs/, etc.
```

### Step 3: Configure Environment

```bash
# Navigate to deployments directory
cd deployments

# Create environment file from example
cp .env.example .env

# Edit configuration
nano .env
```

**Required .env variables:**
```bash
# Database
DB_PASSWORD=your_secure_password_here_change_this

# Trading System
INITIAL_CASH=100000.0
DEMO_MODE=true
PAPER_TRADING=true

# Market Data (optional for now)
YAHOO_FINANCE_ENABLED=true
ALPHA_VANTAGE_API_KEY=your_api_key_if_you_have_one

# Gotify (optional - for alerts)
GOTIFY_PASSWORD=your_gotify_password
```

**Security Note:** Change `DB_PASSWORD` to a strong, unique password!

### Step 4: Deploy with Docker Compose

```bash
# Make sure you're in deployments/ directory
cd /home/user/menorepo/projects/pi5-trading-system/deployments

# Deploy with Pi5-optimized configuration
docker-compose -f docker-compose.pi5-optimized.yml up -d

# Check container status
docker-compose -f docker-compose.pi5-optimized.yml ps

# View logs to verify startup
docker-compose -f docker-compose.pi5-optimized.yml logs -f
```

**Expected output:**
```
NAME                  IMAGE                              STATUS
pi5_trading_api       pi5-trading-system-go:latest       Up 30 seconds (healthy)
pi5_trading_db        timescale/timescaledb:latest-pg15  Up 45 seconds (healthy)
pi5_trading_redis     redis:7-alpine                     Up 45 seconds
victoriametrics       victoriametrics/victoria-metrics   Up 30 seconds
gotify                gotify/server:latest               Up 30 seconds
```

### Step 5: Access the Web Interface

```bash
# Find your Pi5 IP address
hostname -I

# Access Web Interface from your browser:
# http://YOUR_PI5_IP:8080
```

**Default credentials (CHANGE THESE!):**
- Username: `admin`
- Password: `admin123`

### Step 6: Post-Deployment Setup

**Create Admin User (recommended):**
```bash
# Access the database
docker exec -it pi5_trading_db psql -U pi5trader -d pi5_trading

# Create your admin user (example)
INSERT INTO users (id, username, email, password_hash, role, created_at)
VALUES (
    gen_random_uuid(),
    'yourusername',
    'your@email.com',
    -- Password: 'YourSecurePassword123!' (change this!)
    '$2a$10$...',  -- Use bcrypt hash generator
    'admin',
    NOW()
);

# Exit
\q
```

**Enable TimescaleDB Compression (after 1 day of running):**
```bash
cd /home/user/menorepo/projects/pi5-trading-system
docker exec -i pi5_trading_db psql -U pi5trader -d pi5_trading < scripts/enable_compression.sql
```

**Setup Automated Backups:**
```bash
cd /home/user/menorepo/projects/pi5-trading-system
./scripts/setup_cron.sh
```

---

## 🔄 Option B: Docker Compose + Systemd (Auto-Start)

For production 24/7 operation with automatic startup on Pi5 boot.

### Step 1-6: Complete Option A First

Complete all steps from Option A above.

### Step 7: Create Systemd Service

```bash
# Create systemd service file
sudo nano /etc/systemd/system/pi5-trading-system.service
```

**Service file content:**
```ini
[Unit]
Description=Pi5 Trading System
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/YOUR_USERNAME/menorepo/projects/pi5-trading-system/deployments
ExecStart=/usr/bin/docker compose -f docker-compose.pi5-optimized.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.pi5-optimized.yml down
User=YOUR_USERNAME
Group=YOUR_USERNAME

[Install]
WantedBy=multi-user.target
```

**Important:** Replace `YOUR_USERNAME` with your actual username (e.g., `pi` or `ubuntu`)

### Step 8: Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (auto-start on boot)
sudo systemctl enable pi5-trading-system.service

# Start service
sudo systemctl start pi5-trading-system.service

# Check status
sudo systemctl status pi5-trading-system.service

# View logs
sudo journalctl -u pi5-trading-system.service -f
```

### Systemd Management Commands

```bash
# Start the system
sudo systemctl start pi5-trading-system

# Stop the system
sudo systemctl stop pi5-trading-system

# Restart the system
sudo systemctl restart pi5-trading-system

# Check status
sudo systemctl status pi5-trading-system

# Disable auto-start
sudo systemctl disable pi5-trading-system

# View logs
sudo journalctl -u pi5-trading-system -f
```

---

## ✅ Verification

### Check All Services Running

```bash
# View container status
docker ps

# Should see 5 containers running:
# - pi5_trading_api
# - pi5_trading_db
# - pi5_trading_redis
# - victoriametrics
# - gotify
```

### Test Web Interface

1. Open browser: `http://YOUR_PI5_IP:8080`
2. Login with credentials
3. Verify dashboard loads
4. Check portfolio page
5. Check strategies page
6. Check system health

### Test API Endpoints

```bash
# Health check
curl http://localhost:8080/health

# System status (requires authentication)
curl http://localhost:8080/api/v1/system/status

# Prometheus metrics
curl http://localhost:8080/metrics
```

### Check Database

```bash
# Access database
docker exec -it pi5_trading_db psql -U pi5trader -d pi5_trading

# List tables
\dt

# Check hypertables
SELECT * FROM timescaledb_information.hypertables;

# Exit
\q
```

---

## 🔧 Configuration

### Resource Limits (Already Optimized for Pi5)

The `docker-compose.pi5-optimized.yml` includes:
- **Go API:** 1.0GB max, 0.5GB reserved
- **TimescaleDB:** 1.5GB max, 256MB shared buffers
- **VictoriaMetrics:** 0.3GB max
- **Redis:** 0.3GB max, 256MB cache
- **Gotify:** 0.1GB max
- **Total:** ~4.7GB (leaves 3.3GB buffer on 8GB Pi5)

### Environment Variables

Edit `deployments/.env` to configure:
- Database password
- Initial cash amount
- Trading mode (demo/paper/live)
- Market data providers
- Alert settings

### Trading Configuration

Edit `configs/config.yaml` to configure:
- Enabled strategies
- Strategy parameters
- Risk limits
- Position sizing methods

---

## 📊 Monitoring

### Docker Stats

```bash
# Real-time resource usage
docker stats

# View specific container
docker stats pi5_trading_api
```

### VictoriaMetrics

Access Prometheus-compatible metrics:
```bash
# Query metrics
curl http://localhost:8428/api/v1/query?query=up

# View in browser
http://YOUR_PI5_IP:8428
```

### Application Logs

```bash
# View all logs
docker-compose -f deployments/docker-compose.pi5-optimized.yml logs -f

# View specific service
docker-compose -f deployments/docker-compose.pi5-optimized.yml logs -f trading_api

# View last 100 lines
docker-compose -f deployments/docker-compose.pi5-optimized.yml logs --tail=100 trading_api
```

### System Health

```bash
# Pi5 temperature
vcgencmd measure_temp

# CPU frequency
vcgencmd measure_clock arm

# Memory usage
free -h

# Disk usage
df -h
```

---

## 🛠️ Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f deployments/docker-compose.pi5-optimized.yml logs trading_api

# Common issues:
# 1. Port 8080 already in use
sudo lsof -i :8080

# 2. Database not ready
docker-compose -f deployments/docker-compose.pi5-optimized.yml restart trading_db
sleep 10
docker-compose -f deployments/docker-compose.pi5-optimized.yml restart trading_api

# 3. Permission issues
sudo chown -R $USER:$USER /home/user/menorepo/projects/pi5-trading-system
```

### Database Connection Fails

```bash
# Check database is running
docker exec pi5_trading_db pg_isready -U pi5trader

# Test connection
docker exec pi5_trading_db psql -U pi5trader -d pi5_trading -c "SELECT 1;"

# Check password in .env matches
cat deployments/.env | grep DB_PASSWORD
```

### High Memory Usage

```bash
# Check actual usage
docker stats

# Restart services if needed
docker-compose -f deployments/docker-compose.pi5-optimized.yml restart

# Check for memory leaks in logs
docker-compose logs trading_api | grep -i "memory\|oom"
```

### Web Interface Not Loading

```bash
# Check if port 8080 is accessible
curl http://localhost:8080/health

# Check firewall (if enabled)
sudo ufw status
sudo ufw allow 8080/tcp

# Check container health
docker inspect pi5_trading_api | grep -i health
```

### Circuit Breakers Open

```bash
# View circuit breaker status
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/v1/system/circuit-breakers

# Check database health
docker exec pi5_trading_db pg_isready

# Restart to reset circuit breakers
docker-compose -f deployments/docker-compose.pi5-optimized.yml restart trading_api
```

---

## 🔄 Updates and Maintenance

### Update the System

```bash
# Pull latest code
cd /home/user/menorepo/projects/pi5-trading-system
git pull origin main

# Rebuild and redeploy
cd deployments
docker-compose -f docker-compose.pi5-optimized.yml down
docker-compose -f docker-compose.pi5-optimized.yml build --no-cache
docker-compose -f docker-compose.pi5-optimized.yml up -d
```

### Backup Before Updates

```bash
# Run manual backup
./scripts/backup.sh

# Verify backup exists
ls -lh /home/pi/trading_backups/
```

### Database Maintenance

```bash
# Run VACUUM (weekly recommended)
docker exec pi5_trading_db psql -U pi5trader -d pi5_trading -c "VACUUM ANALYZE;"

# Check compression status
docker exec pi5_trading_db psql -U pi5trader -d pi5_trading -c "
SELECT hypertable_name,
       number_compressed_chunks,
       before_compression_total_bytes / (1024*1024) AS before_mb,
       after_compression_total_bytes / (1024*1024) AS after_mb
FROM timescaledb_information.compressed_hypertable_stats;
"
```

---

## 🔒 Security Hardening

### Change Default Passwords

```bash
# 1. Change database password
docker exec -it pi5_trading_db psql -U pi5trader -d pi5_trading
ALTER USER pi5trader WITH PASSWORD 'new_secure_password';
\q

# Update .env file with new password
nano deployments/.env

# Restart containers
docker-compose -f deployments/docker-compose.pi5-optimized.yml restart
```

### Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow Web Interface (only from local network)
sudo ufw allow from 192.168.1.0/24 to any port 8080

# Check status
sudo ufw status
```

### HTTPS (Optional - Production)

For HTTPS access, use a reverse proxy like Nginx or Caddy on the Pi5.

---

## 📈 Performance Tuning

See [docs/PI5-OPTIMIZATION.md](PI5-OPTIMIZATION.md) for detailed Pi5 optimization guide including:
- NVMe SSD setup
- CPU governor configuration
- Swap configuration
- Network tuning
- Performance monitoring

---

## 🆘 Getting Help

1. **Check logs first:**
   ```bash
   docker-compose -f deployments/docker-compose.pi5-optimized.yml logs -f
   ```

2. **Review documentation:**
   - [QUICKSTART.md](QUICKSTART.md) - Quick deployment
   - [PI5-OPTIMIZATION.md](PI5-OPTIMIZATION.md) - Performance tuning
   - [../scripts/README.md](../scripts/README.md) - Backup and maintenance

3. **Report issues:**
   - GitHub Issues with logs and configuration details

---

**Deployment complete! Access your trading system at `http://YOUR_PI5_IP:8080`** 🚀
