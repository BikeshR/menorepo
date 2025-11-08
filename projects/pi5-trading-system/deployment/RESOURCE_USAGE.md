# Resource Usage Analysis - Pi5 Trading System

## Raspberry Pi 5 Specifications

- **CPU**: 4 cores @ 2.4 GHz (ARM Cortex-A76)
- **RAM**: 4 GB or 8 GB LPDDR4X
- **Storage**: microSD or NVMe SSD
- **Power**: 5V 5A (25W max, typically 7-12W)

---

## Resource Usage Breakdown

### Trading System (24/7)

**Normal Operation**:
```
CPU: 5-15% (event processing, WebSocket, indicators)
Memory: 100-300 MB (depending on data retention)
Disk I/O: Low (logging, occasional DB writes)
Network: 5-10 KB/s (real-time data streaming)
```

**Peak Load** (market open, high volatility):
```
CPU: 20-40% (processing 100+ events/sec)
Memory: 300-500 MB
Disk I/O: Moderate (strategy logs, trade records)
Network: 20-50 KB/s
```

---

### GitHub Actions Runner

**Idle State** (waiting for workflows):
```
CPU: < 1%
Memory: 50-100 MB
Disk: 300 MB (installation)
Network: < 1 KB/s (heartbeat)
```

**Active Build** (during deployment):
```
CPU: 100-200% (1-2 cores for 2-4 minutes)
Memory: 500 MB - 1 GB
Disk I/O: High (compiling, linking)
Duration: 2-4 minutes per deployment
```

**Build Frequency**:
- Triggered only on `git push` to main branch
- Typical usage: 1-5 builds per day
- Total active time: 5-20 minutes/day

---

## Combined Resource Usage

### Scenario 1: Trading System Running, No Build

```
CPU: 5-15% (trading only)
Memory: 150-400 MB
Available: 85-95% CPU, 3.6-7.6 GB RAM
Status: ✅ Plenty of headroom
```

### Scenario 2: Trading System + Active Build

```
CPU: 105-215% (trading 5-15% + build 100-200%)
Memory: 650 MB - 1.5 GB
Available: 50-60% CPU, 2.5-7 GB RAM
Status: ✅ Still plenty of resources
```

### Scenario 3: Market Peak + Active Build (Worst Case)

```
CPU: 120-240% (trading 20-40% + build 100-200%)
Memory: 800 MB - 1.5 GB
Available: 40% CPU, 2.5-6.5 GB RAM
Status: ⚠️ Builds may slow down slightly, but trading unaffected
```

---

## Resource Isolation & Priorities

### Systemd Service Limits (Trading System)

Current configuration in `pi5-trading.service`:

```ini
[Service]
# Ensure trading system gets resources
CPUQuota=200%      # Can use up to 2 full cores
MemoryMax=1G       # Max 1GB RAM
Nice=-5            # Higher priority than default (0)
```

### GitHub Runner (Lower Priority)

The runner runs as a regular user process:
- Default priority (Nice=0)
- No resource guarantees
- Will yield to higher-priority trading process

**Result**: Trading system gets priority during resource contention.

---

## Performance Impact Analysis

### Impact on Trading System

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **Runner idle** | None (< 100 MB RAM) | ✅ No action needed |
| **Build during off-hours** | None | ✅ Schedule deployments after market close |
| **Build during trading** | Minimal (shared CPU) | ✅ Trading has higher priority |
| **Build during peak** | Slight build slowdown | ⚠️ Build takes 3-5 min instead of 2-3 min |

### Impact on Build Times

| Pi Model | Idle Build | Under Load | % Increase |
|----------|-----------|------------|------------|
| **Pi 5 (4GB)** | 2-3 min | 3-4 min | +30% |
| **Pi 5 (8GB)** | 2-3 min | 2.5-3.5 min | +20% |
| **Pi 4 (4GB)** | 4-6 min | 5-8 min | +40% |

---

## Optimization Strategies

### 1. Schedule Deployments (Recommended)

Avoid builds during market hours (9:30 AM - 4:00 PM ET):

```yaml
# .github/workflows/deploy-pi5-self-hosted.yml
on:
  push:
    branches: [main]
  schedule:
    # Deploy at 6 PM ET daily (after market close)
    - cron: '0 22 * * 1-5'  # 10 PM UTC = 6 PM ET
```

### 2. Reduce Build Concurrency

Limit parallel builds:

```bash
# In setup-github-runner.sh, configure runner:
./config.sh \
    --url https://github.com/$REPO_OWNER/$REPO_NAME \
    --token $REGISTRATION_TOKEN \
    --name pi5-trading-runner \
    --labels pi5,arm64,raspberry-pi \
    --disableupdate \
    --runnergroup default \
    --work _work \
    --replace
```

Add to systemd service:
```ini
[Service]
# Limit runner CPU usage
CPUQuota=100%  # Use max 1 core
Nice=10        # Lower priority
```

### 3. Use Incremental Builds

Go's build cache speeds up subsequent builds:

```bash
# First build: 2-3 minutes
# Incremental builds: 30-60 seconds (only changed files)
```

### 4. External Build (Hybrid Approach)

Build on GitHub servers, deploy binaries via VPN:

**Pros**:
- Pi only runs deployment (10 seconds)
- No build CPU usage on Pi

**Cons**:
- Requires VPN (Tailscale/Cloudflare Tunnel)
- More complex setup

---

## Monitoring Resource Usage

### Real-Time Monitoring

```bash
# CPU and memory
htop

# Per-process breakdown
top -u $USER

# Trading service specific
systemctl --user status pi5-trading.service

# Runner service specific
sudo systemctl status actions.runner.*
```

### Automated Alerts

Add to monitoring script:

```bash
#!/bin/bash
# ~/pi5-trading-system/monitor.sh

# Alert if trading system using > 80% memory limit
MEMORY_PCT=$(systemctl --user show pi5-trading.service -p MemoryCurrent --value)
MEMORY_MAX=$(systemctl --user show pi5-trading.service -p MemoryMax --value)

if [ $MEMORY_PCT -gt $((MEMORY_MAX * 80 / 100)) ]; then
    echo "⚠️  WARNING: Trading system using 80% of memory limit"
fi

# Alert if CPU load average > 3.0 on 4-core Pi
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
if (( $(echo "$LOAD > 3.0" | bc -l) )); then
    echo "⚠️  WARNING: High CPU load: $LOAD"
fi
```

---

## Recommendations

### For Pi 5 (4GB or 8GB) - Recommended Setup ✅

**Action**: Use self-hosted runner with default settings

**Reasoning**:
- 4 cores + 4-8 GB RAM is plenty
- Trading uses 5-15% CPU normally
- Builds use 1-2 cores for 2-4 minutes
- Plenty of headroom (50%+ CPU, 2.5+ GB RAM available)

**Best practices**:
1. ✅ Deploy after market close (6 PM ET) when possible
2. ✅ Monitor with `htop` occasionally
3. ✅ Keep Pi connected to power (no battery constraints)

### For Pi 4 (4GB) - Works but Slower

**Action**: Use self-hosted runner OR build remotely

**Reasoning**:
- Slower CPU means builds take 4-6 minutes
- Still works fine, just slower
- Consider building on GitHub servers if build time matters

### For Pi 4 (2GB) - Not Recommended

**Action**: Use remote build approach

**Reasoning**:
- Limited RAM may cause build failures
- Trading + build could exceed 2 GB
- Build on GitHub servers, deploy binaries only

---

## Power Consumption

### Idle (Trading System Only)

```
Raspberry Pi 5: ~7W
Annual cost: ~$7-10 (at $0.12/kWh)
```

### During Builds

```
Raspberry Pi 5: ~12W (brief spikes to 15W)
Extra cost: Negligible (builds are 2-4 minutes)
Annual build cost: < $1
```

**Total annual power cost**: ~$8-11

---

## Summary

### ✅ Safe to Run Self-Hosted Runner on Pi 5

| Aspect | Impact | Recommendation |
|--------|--------|----------------|
| **Idle resource usage** | < 100 MB RAM, < 1% CPU | ✅ Negligible |
| **Build impact on trading** | Minimal (separate cores) | ✅ Deploy anytime |
| **Build time** | 2-4 minutes | ✅ Acceptable |
| **Memory pressure** | None (plenty of RAM) | ✅ No concern |
| **Power consumption** | +$1/year | ✅ Negligible |
| **Complexity** | Low (one script setup) | ✅ Simple |

### When to Worry

Only if you have:
- ❌ Raspberry Pi with 2 GB RAM or less
- ❌ Trading system already using 70%+ CPU constantly
- ❌ Multiple other services running on same Pi

For a dedicated Pi 5 running just the trading system, the self-hosted runner adds **essentially zero overhead** when idle and **minimal impact** during the brief 2-4 minute build windows.

---

## Alternative: Stop Runner During Market Hours

If you're paranoid about resource contention:

```bash
# Stop runner before market open (9:30 AM ET)
crontab -e

# Add:
30 9 * * 1-5 sudo systemctl stop actions.runner.*
0 16 * * 1-5 sudo systemctl start actions.runner.*
```

This ensures builds only happen after 4 PM ET (market close).

**My recommendation**: Unnecessary for Pi 5. The default setup is fine.
