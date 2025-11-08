# Pi5 Trading System - Quick Reference

## Setup (One-Time)

```bash
# On Raspberry Pi
curl -sSL https://raw.githubusercontent.com/yourusername/menorepo/main/projects/pi5-trading-system/deployment/setup-pi.sh | bash
```

## GitHub Secrets Required

| Secret | Value | Example |
|--------|-------|---------|
| PI5_SSH_KEY | Private deploy key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| PI5_HOST | Pi IP or hostname | `192.168.1.100` or `raspberrypi.local` |
| PI5_USER | Username on Pi | `pi` |

## Deployment

| Action | Command |
|--------|---------|
| Auto deploy | `git push origin main` |
| Manual deploy | GitHub Actions → Run workflow |
| Check status | See Actions tab |

## Service Management

```bash
# Start
systemctl --user start pi5-trading.service

# Stop
systemctl --user stop pi5-trading.service

# Restart
systemctl --user restart pi5-trading.service

# Status
systemctl --user status pi5-trading.service

# Enable auto-start
systemctl --user enable pi5-trading.service

# View logs
tail -f ~/pi5-trading-system/logs/trading.log
```

## Quick Commands

```bash
# Monitor system
~/pi5-trading-system/monitor.sh

# Backup
~/pi5-trading-system/backup.sh

# Cleanup old files
~/pi5-trading-system/cleanup.sh

# Edit environment
nano ~/pi5-trading-system/.env

# View backups
ls -lh ~/pi5-trading-backups/
```

## Troubleshooting

```bash
# Check if service is running
systemctl --user is-active pi5-trading.service

# View service logs
journalctl --user -u pi5-trading.service -n 50

# Check disk space
df -h

# Check memory
free -h

# Check processes
ps aux | grep api

# Test connectivity
ping 8.8.8.8
```

## Rollback

```bash
# List backups
ls -t ~/pi5-trading-backups/

# Restore backup
systemctl --user stop pi5-trading.service
cd ~
tar -xzf ~/pi5-trading-backups/backup_YYYYMMDD_HHMMSS.tar.gz -C pi5-trading-system/
systemctl --user start pi5-trading.service
```

## File Locations

| Item | Path |
|------|------|
| Deployment | `~/pi5-trading-system/` |
| Logs | `~/pi5-trading-system/logs/` |
| Backups | `~/pi5-trading-backups/` |
| Config | `~/pi5-trading-system/.env` |
| Service | `~/.config/systemd/user/pi5-trading.service` |

## Health Checks

```bash
# Service running?
systemctl --user is-active pi5-trading.service

# Recent errors?
grep -i error ~/pi5-trading-system/logs/trading.log | tail -10

# Disk space OK?
df -h | grep -E '^/dev/root'

# Memory OK?
free -h | grep Mem

# CPU OK?
uptime
```

## Emergency Stop

```bash
# Stop trading immediately
systemctl --user stop pi5-trading.service

# Verify stopped
systemctl --user is-active pi5-trading.service
```

## Update Configuration

```bash
# Edit .env
nano ~/pi5-trading-system/.env

# Apply changes (restart service)
systemctl --user restart pi5-trading.service

# Verify changes took effect
journalctl --user -u pi5-trading.service -n 20
```

## Performance Monitoring

```bash
# CPU and memory
htop

# Disk I/O
sudo iotop

# Network
sudo nethogs

# Service resource usage
systemctl --user status pi5-trading.service | grep -A5 Memory
```

## Useful One-Liners

```bash
# Count trades today
grep "Trade executed" ~/pi5-trading-system/logs/trading.log | grep "$(date +%Y-%m-%d)" | wc -l

# Current P&L
grep "Daily P&L" ~/pi5-trading-system/logs/trading.log | tail -1

# Last error
grep -i error ~/pi5-trading-system/logs/trading.log | tail -1

# Service uptime
systemctl --user status pi5-trading.service | grep Active

# Restart if not running
systemctl --user is-active --quiet pi5-trading.service || systemctl --user restart pi5-trading.service
```

## Automation

```bash
# Auto-restart if crashed (add to crontab)
*/5 * * * * systemctl --user is-active --quiet pi5-trading.service || systemctl --user restart pi5-trading.service

# Daily backup at 2 AM
0 2 * * * ~/pi5-trading-system/backup.sh

# Weekly cleanup on Sunday 3 AM
0 3 * * 0 ~/pi5-trading-system/cleanup.sh
```

## URLs & Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| Trading API | `http://localhost:8080` | Main API |
| Health Check | `http://localhost:8080/health` | Status endpoint |
| Metrics | `http://localhost:8080/metrics` | Prometheus metrics |

## Security Checklist

- [ ] Changed default `pi` password
- [ ] SSH key authentication only (no passwords)
- [ ] Firewall enabled (`sudo ufw enable`)
- [ ] .env file secured (`chmod 600`)
- [ ] Unique API keys (not shared)
- [ ] System updated (`sudo apt update && sudo apt upgrade`)

## Support

### Get Logs for Support

```bash
# Collect all relevant info
{
  echo "=== System Info ==="
  uname -a
  free -h
  df -h
  uptime
  echo ""
  echo "=== Service Status ==="
  systemctl --user status pi5-trading.service
  echo ""
  echo "=== Recent Logs ==="
  tail -50 ~/pi5-trading-system/logs/trading.log
  echo ""
  echo "=== Recent Errors ==="
  tail -50 ~/pi5-trading-system/logs/trading-error.log
} > ~/support-logs-$(date +%Y%m%d).txt

# View collected info
cat ~/support-logs-$(date +%Y%m%d).txt
```
