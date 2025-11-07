# Raspberry Pi 5 Optimization Guide

## 🍓 Hardware Constraints

```
CPU:    Quad-core ARM Cortex-A76 @ 2.4GHz
RAM:    4GB or 8GB LPDDR4X
Arch:   ARM64 (aarch64)
Power:  25W maximum
```

## 🎯 Design Principles for Pi5

1. **Single-Process Over Microservices** - Avoid service overhead
2. **In-Memory Over Network** - Event bus instead of message queues
3. **Efficient Storage** - TimescaleDB + SQLite, not Elasticsearch
4. **ARM64-Optimized** - All images must support ARM architecture
5. **Resource Limits** - Always set Docker memory/CPU limits
6. **Lightweight Monitoring** - VictoriaMetrics, not Prometheus+Grafana

---

## ✅ Current Architecture (Already Optimized!)

Your system is well-designed for Pi5:

- ✅ **Single Go Binary**: Efficient, low memory (~500MB)
- ✅ **Statically Compiled**: No runtime dependencies
- ✅ **Event-Driven**: In-memory event bus (no Kafka)
- ✅ **Alpine Linux**: Minimal Docker images
- ✅ **TimescaleDB**: Efficient time-series storage
- ✅ **Built React**: Static files, no Node runtime

**Expected Resource Usage:**
```
Go API:        500MB - 1GB RAM
TimescaleDB:   1GB - 1.5GB RAM
Overhead:      500MB RAM
────────────────────────────
Total:         2GB - 3GB RAM
Available:     1-2GB buffer (on 4GB Pi)
              5-6GB buffer (on 8GB Pi)
```

---

## 🚀 Deployment Best Practices

### 1. Use NVMe SSD (Not microSD)

```bash
# microSD: 50-100 MB/s read/write
# NVMe:    1000+ MB/s read/write
# 10-20x faster database operations!

# Check if using NVMe:
lsblk
# Look for nvme0n1
```

**Impact:** 10x faster database writes, 5x faster Docker builds

### 2. Enable Swap on NVMe (Emergency Memory)

```bash
# Create 2GB swap on NVMe (not SD card!)
sudo fallocate -l 2G /nvme/swapfile
sudo chmod 600 /nvme/swapfile
sudo mkswap /nvme/swapfile
sudo swapon /nvme/swapfile

# Make permanent
echo '/nvme/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Reduce swappiness (only use when needed)
sudo sysctl vm.swappiness=10
```

### 3. Optimize Docker for ARM64

```bash
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Multi-platform build cache
docker buildx create --use --name pi5builder

# Build with explicit ARM64 target
docker buildx build \
  --platform linux/arm64 \
  --cache-from type=local,src=/tmp/docker-cache \
  --cache-to type=local,dest=/tmp/docker-cache \
  -t pi5-trading:latest .
```

### 4. Set CPU Governor to Performance

```bash
# Default: powersave
# Change to: performance (for trading!)

sudo apt-get install cpufrequtils
echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils
sudo systemctl restart cpufrequtils

# Verify
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
# Should output: performance
```

---

## 📊 Monitoring Resource Usage

### Real-Time Monitoring

```bash
# Install htop
sudo apt-get install htop

# Run htop
htop

# Watch Docker stats
docker stats

# Watch specific container
docker stats pi5_trading_go pi5_trading_db
```

### Check Temperature

```bash
# Critical: Pi5 throttles at 80°C
vcgencmd measure_temp

# Continuous monitoring
watch -n 1 vcgencmd measure_temp

# Add active cooling if temp > 70°C consistently
```

### Memory Pressure

```bash
# Check memory usage
free -h

# Check for OOM kills
dmesg | grep -i "out of memory"

# If seeing OOM, reduce Docker limits or add swap
```

---

## 🔧 Performance Tuning

### Go Application Tuning

```yaml
# In docker-compose.yml
environment:
  GOMAXPROCS: "3"  # Use 3 of 4 cores (leave 1 for system)
  GOGC: "200"      # Reduce GC frequency (less CPU, more memory)
  GOMEMLIMIT: "900MiB"  # Soft memory limit for Go runtime
```

### TimescaleDB Tuning for Pi5

```sql
-- Connect to database
psql -U pi5trader -d pi5_trading

-- Check current settings
SHOW shared_buffers;
SHOW effective_cache_size;
SHOW work_mem;

-- Optimize chunk intervals for limited memory
SELECT set_chunk_time_interval('market_data', INTERVAL '1 day');
SELECT set_chunk_time_interval('trades', INTERVAL '1 week');

-- Enable compression (saves 90% space!)
ALTER TABLE market_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol'
);

SELECT add_compression_policy('market_data', INTERVAL '7 days');

-- Check compression savings
SELECT * FROM timescaledb_information.compressed_chunk_stats;
```

### Reduce Log Verbosity

```yaml
# In config.yaml
logging:
  level: "info"  # Not "debug" in production
  format: "json"
  max_size: 10    # MB per log file
  max_backups: 3  # Keep only 3 old logs
  max_age: 7      # Days to keep logs
```

---

## 🛡️ Reliability & Safety

### 1. Watchdog Timer

```bash
# Enable hardware watchdog
sudo modprobe bcm2835_wdt
echo "bcm2835_wdt" | sudo tee -a /etc/modules

# Install watchdog daemon
sudo apt-get install watchdog
sudo systemctl enable watchdog
sudo systemctl start watchdog
```

### 2. Automatic Restart on Failure

```yaml
# In docker-compose.yml
services:
  trading_api_go:
    restart: unless-stopped
    deploy:
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

### 3. Health Checks

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

### 4. Database Backups

```bash
# Daily backup script
cat > /home/pi/backup_db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec pi5_trading_db pg_dump -U pi5trader pi5_trading | \
  gzip > /nvme/backups/trading_${DATE}.sql.gz

# Keep only last 7 days
find /nvme/backups -name "trading_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /home/pi/backup_db.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /home/pi/backup_db.sh
```

---

## ⚡ What NOT to Run on Pi5

### ❌ Avoid These (Too Heavy):

1. **Kafka/Confluent** - 1-2GB RAM minimum
2. **Elasticsearch** - 2GB+ RAM minimum
3. **Full ELK Stack** - 4GB+ RAM total
4. **Prometheus + Grafana** - 1GB+ RAM combined
5. **Jenkins** - Heavy CI/CD server
6. **Multiple Database Instances** - Use one optimized DB
7. **Machine Learning Training** - Use for inference only
8. **Video Processing** - Wrong hardware
9. **Redis Cluster** - Single instance sufficient

### ✅ Lightweight Alternatives:

| Instead of | Use |
|-----------|-----|
| Kafka | In-memory event bus or append-only file |
| Elasticsearch | SQLite full-text search |
| Prometheus+Grafana | VictoriaMetrics (built-in UI) |
| Jenkins | GitHub Actions (remote) |
| Redis Cluster | Single Redis instance |
| MongoDB | PostgreSQL/TimescaleDB |

---

## 📈 Scaling Strategy

### Vertical Scaling (Same Pi)

1. **Upgrade to 8GB Pi5** - Recommended for production
2. **Use NVMe SSD** - Essential for database performance
3. **Add Active Cooling** - Maintain consistent performance
4. **Overclock** (if adventurous):
   ```bash
   # In /boot/firmware/config.txt
   arm_freq=2600  # Up from 2400MHz
   over_voltage=2
   ```

### Horizontal Scaling (Multiple Pi5s)

```
Pi5 #1: Trading API + TimescaleDB (Primary)
Pi5 #2: Read-Only Replica + Monitoring
Pi5 #3: Backtesting + Analytics
```

**Note:** Only needed if trading >1000 orders/day

---

## 🔍 Troubleshooting

### Container OOM Killed

```bash
# Check OOM events
dmesg | grep -i "killed process"

# Increase memory limits
# In docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 1.5G  # Increase from 1G
```

### High CPU Usage

```bash
# Identify culprit
docker stats

# If Go API is high:
# - Reduce GOMAXPROCS
# - Check for infinite loops
# - Profile with pprof:
curl http://localhost:8080/debug/pprof/profile?seconds=30 > cpu.prof
```

### Database Too Slow

```bash
# Check for missing indexes
docker exec -it pi5_trading_db psql -U pi5trader -d pi5_trading

# Run query analysis
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'PENDING';

# Add indexes if needed
CREATE INDEX idx_orders_status ON orders(status);
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes

# Clean old logs
find /var/log -type f -name "*.gz" -delete
find /var/log -type f -name "*.log.*" -delete

# Compress TimescaleDB chunks (if not already)
SELECT compress_chunk(i) FROM show_chunks('market_data') i;
```

---

## 📋 Quick Start Commands

```bash
# Deploy with Pi5 optimizations
cd deployments
docker-compose -f docker-compose.pi5-optimized.yml up -d

# Monitor resources
docker stats

# Check logs
docker-compose logs -f trading_api_go

# Restart services
docker-compose restart

# Full rebuild (after code changes)
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Database shell
docker exec -it pi5_trading_db psql -U pi5trader -d pi5_trading

# Backup database
docker exec pi5_trading_db pg_dump -U pi5trader pi5_trading > backup.sql
```

---

## 🎯 Performance Benchmarks (Expected)

On Raspberry Pi 5 with 8GB RAM + NVMe SSD:

```
API Latency:         50-100ms (P95)
Order Processing:    10-50 orders/second
Database Writes:     1000+ inserts/second
WebSocket Updates:   100+ clients
Dashboard Load:      < 2 seconds
Memory Usage:        2-4GB total
CPU Usage:           20-40% average
Storage (per year):  5-10GB with compression
```

---

## 💡 Pro Tips

1. **Always use NVMe over microSD** - 10x performance difference
2. **Set resource limits** - Prevent one service from killing others
3. **Enable database compression** - Save 90% storage space
4. **Use performance CPU governor** - Critical for low latency
5. **Monitor temperature** - Thermal throttling kills performance
6. **Regular backups** - SD cards and SSDs can fail
7. **Test under load** - Use `wrk` or `ab` to benchmark
8. **Update regularly** - `sudo apt update && sudo apt upgrade`

---

## 📚 Additional Resources

- [Pi5 Official Docs](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html)
- [Docker ARM64 Best Practices](https://www.docker.com/blog/multi-arch-images/)
- [TimescaleDB Performance Tuning](https://docs.timescale.com/self-hosted/latest/configuration/)
- [Go ARM64 Optimization](https://go.dev/wiki/GoArm)

---

**Remember:** The Pi5 is powerful for its size, but it's not a server. Design with constraints in mind, and you'll have a reliable, efficient trading system!
