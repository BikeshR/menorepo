# Automated Deployment to Raspberry Pi

Complete guide to setting up automated deployment from GitHub to your Raspberry Pi.

## Overview

This deployment system automatically builds and deploys your trading system to a Raspberry Pi whenever you push to the `main` branch.

**Workflow**:
1. Push code to `main` branch
2. GitHub Actions builds ARM64 binaries
3. GitHub Actions SSHs into your Pi
4. System is deployed and service is restarted
5. Verification checks run automatically

## Prerequisites

- Raspberry Pi 4 or 5 (running Raspberry Pi OS 64-bit)
- SSH access to your Raspberry Pi
- GitHub repository with Actions enabled

## One-Time Setup

### Step 1: Prepare Your Raspberry Pi

SSH into your Raspberry Pi and run the setup script:

```bash
# On your Raspberry Pi
cd ~
wget https://raw.githubusercontent.com/yourusername/menorepo/main/projects/pi5-trading-system/deployment/setup-pi.sh
chmod +x setup-pi.sh
./setup-pi.sh
```

This script will:
- ✅ Install Go 1.21+
- ✅ Create deployment directories
- ✅ Setup systemd service
- ✅ Configure log rotation
- ✅ Create monitoring scripts
- ✅ Setup cron jobs

### Step 2: Generate SSH Deploy Key

On your **development machine** (not the Pi):

```bash
# Generate dedicated SSH key for deployment
ssh-keygen -t ed25519 -f ~/.ssh/pi5_deploy_key -C "github-actions-deploy"

# Display the PUBLIC key
cat ~/.ssh/pi5_deploy_key.pub
```

Copy the public key output.

### Step 3: Add Public Key to Raspberry Pi

SSH into your Pi and add the public key:

```bash
# On your Raspberry Pi
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key (paste what you copied from step 2)
nano ~/.ssh/authorized_keys
# Paste the public key, save and exit (Ctrl+X, Y, Enter)

chmod 600 ~/.ssh/authorized_keys
```

### Step 4: Test SSH Connection

From your development machine:

```bash
# Test connection (replace with your Pi's IP)
ssh -i ~/.ssh/pi5_deploy_key pi@192.168.1.100

# If successful, you should be logged into your Pi
# Exit and continue
exit
```

### Step 5: Configure GitHub Secrets

Add the following secrets to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

#### PI5_SSH_KEY
The **private** SSH key content:
```bash
cat ~/.ssh/pi5_deploy_key
```
Copy the entire output (including `-----BEGIN` and `-----END` lines)

#### PI5_HOST
Your Raspberry Pi's IP address or hostname:
```
192.168.1.100
```
Or use hostname: `raspberrypi.local`

#### PI5_USER
Your username on the Pi (usually `pi`):
```
pi
```

### Step 6: Configure .env on Raspberry Pi

Edit the environment file with your credentials:

```bash
# On your Raspberry Pi
nano ~/pi5-trading-system/.env
```

Set your Alpaca API credentials and other settings:
```bash
# Alpaca API Credentials (required)
ALPACA_API_KEY=PK...
ALPACA_API_SECRET=...

# Database (optional)
DB_HOST=localhost
DB_PORT=5432

# Server
SERVER_PORT=8080

# Environment
ENVIRONMENT=production
```

Save and exit (Ctrl+X, Y, Enter).

## How to Deploy

### Automatic Deployment

Simply push to the `main` branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

GitHub Actions will automatically:
1. Build ARM64 binaries (2-3 minutes)
2. Deploy to your Pi (30 seconds)
3. Restart the service
4. Run verification checks

### Manual Deployment

Trigger deployment manually from GitHub:

1. Go to **Actions** tab in your repository
2. Select **Deploy to Raspberry Pi** workflow
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

### Monitor Deployment

Watch deployment progress:
1. Go to **Actions** tab
2. Click on the running workflow
3. Expand **Deploy to Raspberry Pi** to see live logs

## Managing the Service

### On Raspberry Pi

#### Start the service
```bash
systemctl --user start pi5-trading.service
```

#### Stop the service
```bash
systemctl --user stop pi5-trading.service
```

#### Restart the service
```bash
systemctl --user restart pi5-trading.service
```

#### Check status
```bash
systemctl --user status pi5-trading.service
```

#### Enable auto-start on boot
```bash
systemctl --user enable pi5-trading.service
```

#### View logs (real-time)
```bash
tail -f ~/pi5-trading-system/logs/trading.log
```

#### View error logs
```bash
tail -f ~/pi5-trading-system/logs/trading-error.log
```

### Quick Status Check

Use the monitoring script:

```bash
~/pi5-trading-system/monitor.sh
```

Output:
```
Pi5 Trading System Status
==========================

System:
 09:30:15 up 5 days, 12:45,  1 user,  load average: 0.15, 0.20, 0.18

Service Status:
✓ Trading service is RUNNING
● pi5-trading.service - Pi5 Trading System
   Loaded: loaded
   Active: active (running) since Mon 2024-03-15 09:00:00 GMT
   ...

Recent Logs (last 20 lines):
[INFO] Market opened
[INFO] RSI strategy: Signal generated
...
```

## Maintenance

### Backups

Manual backup:
```bash
~/pi5-trading-system/backup.sh
```

Backups are stored in: `~/pi5-trading-backups/`

Automatic backups are created before each deployment.

### Cleanup

Remove old logs and results:
```bash
~/pi5-trading-system/cleanup.sh
```

This runs automatically every Sunday at 3 AM via cron.

### View Backups

```bash
ls -lh ~/pi5-trading-backups/
```

Backups are kept:
- Automatic (before deployments): Last 5
- Manual: All backups

### Restore from Backup

```bash
# Stop the service
systemctl --user stop pi5-trading.service

# Restore from backup
cd ~
tar -xzf ~/pi5-trading-backups/backup_20240315_120000.tar.gz

# Start the service
systemctl --user start pi5-trading.service
```

## Troubleshooting

### Deployment fails with SSH error

**Problem**: Cannot connect to Pi

**Solution**:
1. Verify Pi is online: `ping 192.168.1.100`
2. Test SSH manually: `ssh -i ~/.ssh/pi5_deploy_key pi@192.168.1.100`
3. Check GitHub secret `PI5_HOST` is correct
4. Check GitHub secret `PI5_SSH_KEY` contains the full private key

### Service won't start

**Problem**: `systemctl --user start pi5-trading.service` fails

**Solution**:
```bash
# Check service logs
journalctl --user -u pi5-trading.service -n 50

# Common issues:
# 1. Missing .env file
ls -la ~/pi5-trading-system/.env

# 2. Permission issues
chmod +x ~/pi5-trading-system/api

# 3. Port already in use
sudo lsof -i :8080
```

### Binary not found or wrong architecture

**Problem**: `exec format error` or `cannot execute binary file`

**Solution**:
1. Verify Pi is 64-bit: `uname -m` (should show `aarch64`)
2. Check binary architecture: `file ~/pi5-trading-system/api` (should show `ARM aarch64`)
3. Re-run deployment workflow

### Out of memory

**Problem**: Service crashes with OOM

**Solution**:
```bash
# Check available memory
free -h

# Adjust service memory limit
nano ~/.config/systemd/user/pi5-trading.service
# Change MemoryMax=1G to MemoryMax=2G

# Reload and restart
systemctl --user daemon-reload
systemctl --user restart pi5-trading.service
```

### Logs filling disk

**Problem**: Running out of disk space

**Solution**:
```bash
# Check disk space
df -h

# Clean old logs
~/pi5-trading-system/cleanup.sh

# Verify log rotation is working
cat /etc/logrotate.d/pi5-trading
```

## Security Best Practices

### SSH Key Security

✅ **Do**:
- Use dedicated SSH key for deployment (not your personal key)
- Store private key only in GitHub Secrets
- Use ED25519 keys (more secure than RSA)

❌ **Don't**:
- Commit private keys to repository
- Share deployment keys
- Use password authentication for automated deployment

### Raspberry Pi Security

```bash
# Change default password
passwd

# Update system regularly
sudo apt update && sudo apt upgrade -y

# Enable firewall (allow SSH on port 22)
sudo ufw allow 22
sudo ufw enable

# Disable password authentication (use keys only)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

### Environment Variables

- Never commit `.env` file
- Keep API keys secret
- Use different keys for production vs staging

## Advanced Configuration

### Deploy to Multiple Environments

Create separate secrets for staging:
- `PI5_STAGING_SSH_KEY`
- `PI5_STAGING_HOST`
- `PI5_STAGING_USER`

Modify workflow to deploy based on branch:
```yaml
on:
  push:
    branches:
      - main        # Production
      - develop     # Staging
```

### Custom Deployment Scripts

Edit deployment logic in `.github/workflows/deploy-pi5.yml`:

```yaml
- name: Deploy on Raspberry Pi
  run: |
    ssh $SSH_USER@$SSH_HOST << 'ENDSSH'
      # Your custom deployment steps here
    ENDSSH
```

### Health Checks

Add health check endpoint to your API and monitor after deployment:

```yaml
- name: Health check
  run: |
    sleep 10
    curl -f http://$SSH_HOST:8080/health || exit 1
```

### Rollback on Failure

Automatic rollback is built-in via backups. To manually rollback:

```bash
# On Raspberry Pi
cd ~/pi5-trading-backups
ls -t | head -1  # Show latest backup

# Restore it
tar -xzf backup_20240315_120000.tar.gz -C ~/pi5-trading-system
systemctl --user restart pi5-trading.service
```

## Monitoring & Alerting

### System Monitoring

Install monitoring tools:

```bash
# On Raspberry Pi
sudo apt install htop iotop

# Monitor CPU and memory
htop

# Monitor disk I/O
sudo iotop
```

### Log Monitoring

Watch logs for errors:

```bash
# Follow main log
tail -f ~/pi5-trading-system/logs/trading.log

# Follow error log
tail -f ~/pi5-trading-system/logs/trading-error.log

# Search for errors
grep -i error ~/pi5-trading-system/logs/trading.log
```

### Email Alerts (Optional)

Setup email alerts for service failures:

```bash
# Install mail utils
sudo apt install msmtp msmtp-mta mailutils

# Configure SMTP
nano ~/.msmtprc
# Add your email configuration

# Add alert to service
nano ~/.config/systemd/user/pi5-trading.service
# Add: OnFailure=send-email@%n.service
```

## Performance Tuning

### Raspberry Pi Optimization

```bash
# Increase swap for memory-intensive operations
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=2048 (2GB)
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Set CPU governor to performance
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### Go Application Optimization

Build with optimizations:

```yaml
# In .github/workflows/deploy-pi5.yml
- name: Build for ARM64
  run: |
    GOOS=linux GOARCH=arm64 \
    go build -ldflags="-s -w" \
    -o api cmd/api/main.go
```

Flags:
- `-s`: Strip symbol table
- `-w`: Strip DWARF debug info
- Result: Smaller binary, faster startup

## Cost Considerations

### Raspberry Pi Power Usage

- Pi 4: ~5W idle, ~7W under load
- Pi 5: ~7W idle, ~12W under load
- Monthly cost: ~$1-2 (24/7 operation)

### Network Data

- Alpaca WebSocket: ~5-10 MB/day
- API calls: ~1-5 MB/day
- Total: ~300 MB/month

## Checklist

### Initial Setup
- [ ] Raspberry Pi OS 64-bit installed
- [ ] SSH enabled on Pi
- [ ] Pi has static IP or hostname
- [ ] Go 1.21+ installed
- [ ] setup-pi.sh executed successfully
- [ ] SSH deploy key generated
- [ ] Public key added to Pi
- [ ] GitHub secrets configured (PI5_SSH_KEY, PI5_HOST, PI5_USER)
- [ ] .env file configured on Pi
- [ ] Alpaca API credentials added
- [ ] Service enabled to start on boot

### Deployment
- [ ] Push to main triggers deployment
- [ ] Deployment completes successfully
- [ ] Service starts without errors
- [ ] Logs show expected output
- [ ] Health check passes (if configured)

### Monitoring
- [ ] Log rotation configured
- [ ] Backup script tested
- [ ] Cleanup script scheduled
- [ ] Monitoring script accessible
- [ ] Know how to view logs
- [ ] Know how to check service status

## Support

### Get Help

If you encounter issues:

1. Check service logs: `journalctl --user -u pi5-trading.service`
2. Review GitHub Actions logs in the Actions tab
3. Verify SSH connectivity manually
4. Check system resources: `~/pi5-trading-system/monitor.sh`
5. Review troubleshooting section above

### Useful Commands Reference

```bash
# Service management
systemctl --user start|stop|restart|status pi5-trading.service
systemctl --user enable|disable pi5-trading.service

# Logs
tail -f ~/pi5-trading-system/logs/trading.log
journalctl --user -u pi5-trading.service -f

# Monitoring
~/pi5-trading-system/monitor.sh
htop
df -h

# Maintenance
~/pi5-trading-system/backup.sh
~/pi5-trading-system/cleanup.sh

# Backups
ls ~/pi5-trading-backups/

# Deployment directory
cd ~/pi5-trading-system
ls -lh
```

---

## Summary

You now have:
- ✅ Automated deployment from GitHub
- ✅ Systemd service management
- ✅ Automatic backups before deployment
- ✅ Log rotation and cleanup
- ✅ Monitoring tools
- ✅ Rollback capability

Every push to `main` will automatically deploy to your Raspberry Pi within 3-5 minutes!
