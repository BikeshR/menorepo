# Pi5 Trading System - Docker Deployment Guide

Complete guide for deploying the Pi5 Trading System using Docker on Raspberry Pi.

## Why Docker?

✅ **One-command setup** - `docker-compose up -d` and everything works
✅ **Consistent versions** - Same environment in dev and prod
✅ **Easy upgrades** - `git pull && docker-compose up -d --build`
✅ **Automatic restarts** - Services auto-restart on failure
✅ **Simple rollback** - Keep previous images for instant rollback
✅ **Isolated** - No port conflicts, clean system

**Resource usage on Pi 5 (8GB):** ~500-600 MB (6-7% of total RAM)

---

## Prerequisites

- **Raspberry Pi 4 or 5** with 4GB+ RAM (8GB recommended)
- **Ubuntu 24.04** or Raspberry Pi OS
- **Internet connection**
- **Alpaca account** (free paper trading at https://alpaca.markets)

---

## Quick Start (5 Minutes)

### 1. Initial Setup on Pi

```bash
# Clone repository
cd ~
git clone https://github.com/BikeshR/menorepo.git
cd menorepo/projects/pi5-trading-system

# Run setup script
chmod +x deployment/setup-pi-docker.sh
./deployment/setup-pi-docker.sh

# If Docker was just installed, log out and back in, then run setup again
```

### 2. Configure Credentials

```bash
# Edit .env file
nano ~/pi5-trading-system/.env
```

Update these values:
```bash
ALPACA_API_KEY=your_actual_api_key_here
ALPACA_SECRET_KEY=your_actual_secret_key_here
DB_PASSWORD=ChangeThisToSecurePassword123!
```

Save with `Ctrl+X`, `Y`, `Enter`.

### 3. Start the System

```bash
cd ~/menorepo/projects/pi5-trading-system

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### 4. Access Dashboard

Open browser: `http://YOUR_PI_IP:8080`

**Find your Pi IP:**
```bash
hostname -I | awk '{print $1}'
```

---

## What Gets Deployed

### Docker Containers

```
┌─────────────────────────────────────┐
│ pi5-trading-postgres                │
│  - PostgreSQL 16                    │
│  - Port: 5432                       │
│  - Volume: postgres_data            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ pi5-trading-redis                   │
│  - Redis 7                          │
│  - Port: 6379                       │
│  - Volume: redis_data               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ pi5-trading-api                     │
│  - Go API + React Dashboard         │
│  - Port: 8080                       │
│  - Includes: api, backtest, optimize│
└─────────────────────────────────────┘
```

### File Structure

```
~/pi5-trading-system/
├── .env                    # Configuration
├── logs/                   # Application logs
├── backups/               # Database backups
├── backup.sh              # Backup script
├── monitor.sh             # Monitoring script
└── update.sh              # Update script

~/menorepo/projects/pi5-trading-system/
├── docker-compose.prod.yml  # Production config
├── Dockerfile              # Multi-stage build
├── migrations/             # Database schemas
├── configs/               # App configurations
└── dashboard/dist/        # Built dashboard
```

---

## Common Operations

### Start/Stop Services

```bash
cd ~/menorepo/projects/pi5-trading-system

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart only API
docker-compose -f docker-compose.prod.yml restart api
```

### View Logs

```bash
# All services (follow mode)
docker-compose -f docker-compose.prod.yml logs -f

# API only
docker logs pi5-trading-api -f

# Last 100 lines
docker logs pi5-trading-api --tail 100

# PostgreSQL logs
docker logs pi5-trading-postgres -f
```

### Monitor System

```bash
# Use monitoring script
~/pi5-trading-system/monitor.sh

# Or manually
docker-compose -f ~/menorepo/projects/pi5-trading-system/docker-compose.prod.yml ps
docker stats

# Check API health
curl http://localhost:8080/api/v1/system/health
```

### Database Backup

```bash
# Manual backup
~/pi5-trading-system/backup.sh

# Automatic backups run daily at 2 AM (configured by setup script)

# Restore from backup
docker exec -i pi5-trading-postgres psql -U pi5trader pi5_trading < ~/pi5-trading-backups/backup_20250108_140000.sql
```

### Update System

```bash
# Option 1: Use update script
~/pi5-trading-system/update.sh

# Option 2: Manual update
cd ~/menorepo
git pull
cd projects/pi5-trading-system
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

---

## GitHub Actions Automated Deployment

### Setup Self-Hosted Runner

```bash
# Download and run setup script
cd ~
wget https://raw.githubusercontent.com/BikeshR/menorepo/main/projects/pi5-trading-system/deployment/setup-github-runner.sh
chmod +x setup-github-runner.sh
./setup-github-runner.sh
```

Follow prompts to:
1. Get registration token from GitHub repo settings
2. Configure runner with your repo

### Configure GitHub Secrets

Go to your GitHub repo → Settings → Secrets → Actions → New repository secret:

- **DB_PASSWORD**: Your database password (e.g., `SecurePassword123!`)

### Automated Workflow

Every push to `main` branch automatically:
1. ✅ Creates database backup
2. ✅ Builds Docker images
3. ✅ Runs database migrations
4. ✅ Deploys updated services
5. ✅ Verifies deployment
6. ✅ Cleans up old images

**Monitor deployments:** GitHub repo → Actions tab

---

## Troubleshooting

### Containers Won't Start

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs for errors
docker-compose -f docker-compose.prod.yml logs

# Check specific service
docker logs pi5-trading-api
docker logs pi5-trading-postgres

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Port Already in Use

```bash
# Check what's using port 8080
sudo netstat -tlnp | grep 8080

# Stop conflicting service
docker stop <container_name>

# Or use different port
# Edit docker-compose.prod.yml: "8081:8080"
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker exec pi5-trading-postgres pg_isready -U pi5trader

# Check database exists
docker exec -it pi5-trading-postgres psql -U pi5trader -l

# Check credentials in .env
cat ~/pi5-trading-system/.env | grep DB_PASSWORD

# Restart postgres
docker-compose -f docker-compose.prod.yml restart postgres
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Remove old Docker images
docker image prune -a

# Remove old backups
rm ~/pi5-trading-backups/backup_20240101_*.sql

# Remove old logs
sudo journalctl --vacuum-time=7d
```

### Migration Errors

```bash
# Check migration status
docker exec pi5-trading-api migrate -path /app/migrations \
  -database "postgres://pi5trader:PASSWORD@postgres:5432/pi5_trading?sslmode=disable" \
  version

# Force to specific version (CAREFUL!)
docker exec pi5-trading-api migrate -path /app/migrations \
  -database "postgres://..." \
  force 1
```

### Container Crashes/Restarts

```bash
# Check logs for crash reason
docker logs pi5-trading-api --tail 100

# Check resource usage
docker stats

# Increase memory limit in docker-compose.prod.yml
# Under 'api' service add:
#   deploy:
#     resources:
#       limits:
#         memory: 1G
```

### Reset Everything

```bash
# DANGER: This deletes all data!

cd ~/menorepo/projects/pi5-trading-system

# Stop and remove containers
docker-compose -f docker-compose.prod.yml down

# Remove volumes (deletes database!)
docker-compose -f docker-compose.prod.yml down -v

# Remove images
docker rmi $(docker images -q pi5-trading-system*)

# Start fresh
docker-compose -f docker-compose.prod.yml up -d
```

---

## Resource Management

### View Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats pi5-trading-api

# Monitor script (includes resource usage)
~/pi5-trading-system/monitor.sh
```

### Optimize Resource Usage

**Limit container memory:**

Edit `docker-compose.prod.yml`:
```yaml
api:
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '1.0'
      reservations:
        memory: 256M
```

**Reduce log size:**

```yaml
api:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

**Clean up regularly:**

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

---

## Backup & Restore

### Backup Database

```bash
# Manual backup
docker exec pi5-trading-postgres pg_dump -U pi5trader pi5_trading > backup.sql

# Automated (runs daily at 2 AM)
# Configured by setup-pi-docker.sh
```

### Restore Database

```bash
# Stop API to prevent writes
docker-compose -f docker-compose.prod.yml stop api

# Restore
cat backup.sql | docker exec -i pi5-trading-postgres psql -U pi5trader pi5_trading

# Restart API
docker-compose -f docker-compose.prod.yml start api
```

### Backup Docker Volumes

```bash
# Backup postgres data
docker run --rm \
  -v pi5-trading-system_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data

# Backup redis data
docker run --rm \
  -v pi5-trading-system_redis_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/redis-backup.tar.gz /data
```

### Restore Docker Volumes

```bash
# Restore postgres data
docker run --rm \
  -v pi5-trading-system_postgres_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd / && tar xzf /backup/postgres-backup.tar.gz"
```

---

## Performance Tuning

### Database Performance

Edit `docker-compose.prod.yml` under postgres service:

```yaml
postgres:
  command:
    - postgres
    - -c
    - shared_buffers=256MB
    - -c
    - effective_cache_size=1GB
    - -c
    - max_connections=100
```

### Redis Performance

```yaml
redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### API Performance

```yaml
api:
  environment:
    - GOMAXPROCS=2  # Limit Go CPU cores
```

---

## Security Best Practices

### 1. Change Default Passwords

```bash
# Generate secure password
openssl rand -base64 32

# Update .env
nano ~/pi5-trading-system/.env
# DB_PASSWORD=<generated_password>
```

### 2. Firewall Setup

```bash
# Allow only SSH and HTTP
sudo ufw allow 22/tcp
sudo ufw allow 8080/tcp
sudo ufw enable
```

### 3. Restrict API Access

Edit `docker-compose.prod.yml`:
```yaml
api:
  ports:
    - "127.0.0.1:8080:8080"  # Only localhost access
```

Then use nginx as reverse proxy with SSL.

### 4. Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

---

## Useful Commands Reference

```bash
# Container management
docker-compose -f docker-compose.prod.yml up -d          # Start
docker-compose -f docker-compose.prod.yml down           # Stop
docker-compose -f docker-compose.prod.yml restart        # Restart
docker-compose -f docker-compose.prod.yml ps             # Status

# Logs
docker-compose -f docker-compose.prod.yml logs -f        # Follow logs
docker logs pi5-trading-api --tail 100                   # Last 100 lines
docker logs pi5-trading-postgres -f                      # Follow postgres logs

# Exec into containers
docker exec -it pi5-trading-api sh                       # API shell
docker exec -it pi5-trading-postgres psql -U pi5trader   # Database shell
docker exec -it pi5-trading-redis redis-cli              # Redis shell

# Resource monitoring
docker stats                                             # All containers
docker stats pi5-trading-api                             # Specific container

# Cleanup
docker system prune                                      # Remove unused resources
docker image prune -a                                    # Remove unused images
docker volume prune                                      # Remove unused volumes

# Updates
git pull                                                 # Update code
docker-compose -f docker-compose.prod.yml build          # Rebuild images
docker-compose -f docker-compose.prod.yml up -d          # Deploy updates
```

---

## Next Steps

After successful deployment:

1. ✅ **Access dashboard:** http://YOUR_PI_IP:8080
2. ✅ **Run a backtest:** See [docs/BACKTESTING.md](../docs/BACKTESTING.md)
3. ✅ **Configure strategies:** See [docs/STRATEGIES.md](../docs/STRATEGIES.md)
4. ✅ **Monitor system:** Run `~/pi5-trading-system/monitor.sh`
5. ✅ **Set up alerts:** Configure notifications for important events

---

## Support

- **Documentation:** [deployment/README.md](README.md)
- **Development:** [DEVELOPMENT.md](../DEVELOPMENT.md)
- **Strategies:** [docs/STRATEGIES.md](../docs/STRATEGIES.md)
- **Risk Management:** [docs/RISK_MANAGEMENT_GUIDE.md](../docs/RISK_MANAGEMENT_GUIDE.md)

---

Happy trading! 🚀📈
