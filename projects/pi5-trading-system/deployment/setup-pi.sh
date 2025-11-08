#!/bin/bash
#
# Setup script for Raspberry Pi deployment
# Run this once on your Raspberry Pi to prepare for automated deployments
#

set -e

echo "🚀 Setting up Pi5 Trading System on Raspberry Pi"
echo ""

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ] || ! grep -q "Raspberry Pi" /proc/device-tree/model; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Variables
DEPLOY_DIR="$HOME/pi5-trading-system"
BACKUP_DIR="$HOME/pi5-trading-backups"
LOG_DIR="$DEPLOY_DIR/logs"

echo "📁 Creating directories..."
mkdir -p $DEPLOY_DIR
mkdir -p $BACKUP_DIR
mkdir -p $LOG_DIR
echo "✓ Directories created"

# Install Go if not present
if ! command -v go &> /dev/null; then
    echo ""
    echo "📦 Installing Go..."

    GO_VERSION="1.21.6"
    GO_ARCH="arm64"
    GO_TAR="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"

    cd /tmp
    wget -q https://go.dev/dl/$GO_TAR
    sudo rm -rf /usr/local/go
    sudo tar -C /usr/local -xzf $GO_TAR
    rm $GO_TAR

    # Add to PATH
    if ! grep -q "/usr/local/go/bin" ~/.bashrc; then
        echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
        export PATH=$PATH:/usr/local/go/bin
    fi

    echo "✓ Go installed: $(go version)"
else
    echo "✓ Go already installed: $(go version)"
fi

# Setup systemd user service
echo ""
echo "🔧 Setting up systemd service..."

# Copy service file
SERVICE_FILE="$HOME/.config/systemd/user/pi5-trading.service"
mkdir -p "$(dirname $SERVICE_FILE)"

cat > $SERVICE_FILE << 'EOF'
[Unit]
Description=Pi5 Trading System
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=%h/pi5-trading-system
ExecStart=%h/pi5-trading-system/api
Restart=always
RestartSec=10
StandardOutput=append:%h/pi5-trading-system/logs/trading.log
StandardError=append:%h/pi5-trading-system/logs/trading-error.log

# Environment
Environment="PATH=/usr/local/go/bin:/usr/bin:/bin"
EnvironmentFile=%h/pi5-trading-system/.env

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=default.target
EOF

# Enable lingering (keep user services running after logout)
loginctl enable-linger $USER

# Reload systemd
systemctl --user daemon-reload

echo "✓ Systemd service configured"

# Setup SSH for GitHub Actions (if needed)
echo ""
echo "🔑 SSH Key Setup"
echo "For automated deployment, GitHub Actions needs SSH access to this Pi."
echo ""

if [ ! -f ~/.ssh/authorized_keys ] || ! grep -q "github-actions" ~/.ssh/authorized_keys; then
    echo "📝 To enable automated deployment:"
    echo "1. Generate SSH key on your development machine:"
    echo "   ssh-keygen -t ed25519 -f ~/.ssh/pi5_deploy_key -C 'github-actions'"
    echo ""
    echo "2. Add the PUBLIC key to ~/.ssh/authorized_keys on this Pi:"
    echo "   cat ~/.ssh/pi5_deploy_key.pub >> ~/.ssh/authorized_keys"
    echo ""
    echo "3. Add these secrets to your GitHub repository (Settings > Secrets):"
    echo "   PI5_SSH_KEY: Contents of ~/.ssh/pi5_deploy_key (PRIVATE key)"
    echo "   PI5_HOST: IP address or hostname of this Pi"
    echo "   PI5_USER: $USER"
    echo ""
else
    echo "✓ SSH keys appear to be configured"
fi

# Create default .env if not exists
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo ""
    echo "📝 Creating default .env file..."

    cat > "$DEPLOY_DIR/.env" << 'EOF'
# Alpaca API Credentials
ALPACA_API_KEY=your_api_key_here
ALPACA_API_SECRET=your_api_secret_here

# Database (if using PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=pi5trader
DB_PASSWORD=change_me
DB_NAME=pi5_trading

# Server
SERVER_PORT=8080

# Environment
ENVIRONMENT=production
EOF

    echo "✓ Default .env created at $DEPLOY_DIR/.env"
    echo "⚠️  IMPORTANT: Edit $DEPLOY_DIR/.env with your actual credentials"
fi

# Setup log rotation
echo ""
echo "📄 Setting up log rotation..."

sudo tee /etc/logrotate.d/pi5-trading > /dev/null << EOF
$LOG_DIR/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 $USER $USER
    sharedscripts
    postrotate
        systemctl --user reload-or-restart pi5-trading.service > /dev/null 2>&1 || true
    endscript
}
EOF

echo "✓ Log rotation configured"

# Setup monitoring script
echo ""
echo "📊 Creating monitoring script..."

cat > "$DEPLOY_DIR/monitor.sh" << 'EOFMON'
#!/bin/bash
# Quick status check for trading system

echo "Pi5 Trading System Status"
echo "=========================="
echo ""

# System info
echo "System:"
uptime
echo ""

# Service status
echo "Service Status:"
if systemctl --user is-active --quiet pi5-trading.service; then
    echo "✓ Trading service is RUNNING"
    systemctl --user status pi5-trading.service --no-pager | head -10
else
    echo "✗ Trading service is STOPPED"
fi
echo ""

# Recent logs
echo "Recent Logs (last 20 lines):"
tail -20 ~/pi5-trading-system/logs/trading.log 2>/dev/null || echo "No logs yet"
echo ""

# Disk space
echo "Disk Space:"
df -h ~ | tail -1
echo ""

# Memory usage
echo "Memory Usage:"
free -h | grep Mem
EOFMON

chmod +x "$DEPLOY_DIR/monitor.sh"

echo "✓ Monitoring script created"

# Create maintenance scripts
echo ""
echo "🛠️  Creating maintenance scripts..."

# Backup script
cat > "$DEPLOY_DIR/backup.sh" << 'EOFBACK'
#!/bin/bash
# Backup trading system configuration and logs

BACKUP_DIR="$HOME/pi5-trading-backups/manual"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="manual_backup_$TIMESTAMP"

mkdir -p $BACKUP_DIR
cd $HOME

echo "Creating backup: $BACKUP_NAME"
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" \
    pi5-trading-system/.env \
    pi5-trading-system/logs \
    pi5-trading-system/backtest_results \
    pi5-trading-system/optimization_results \
    2>/dev/null

echo "Backup created: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
ls -lh "$BACKUP_DIR/$BACKUP_NAME.tar.gz"
EOFBACK

chmod +x "$DEPLOY_DIR/backup.sh"

# Cleanup script
cat > "$DEPLOY_DIR/cleanup.sh" << 'EOFCLEAN'
#!/bin/bash
# Cleanup old logs and backups

echo "Cleaning up old files..."

# Remove logs older than 30 days
find ~/pi5-trading-system/logs -name "*.log.*" -mtime +30 -delete
echo "✓ Removed logs older than 30 days"

# Remove backtest results older than 60 days
find ~/pi5-trading-system/backtest_results -type f -mtime +60 -delete
echo "✓ Removed backtest results older than 60 days"

# Keep only last 10 backups
cd ~/pi5-trading-backups
ls -t | tail -n +11 | xargs -r rm -rf
echo "✓ Kept only last 10 backups"

echo "Cleanup complete!"
EOFCLEAN

chmod +x "$DEPLOY_DIR/cleanup.sh"

echo "✓ Maintenance scripts created"

# Setup cron jobs
echo ""
echo "⏰ Setting up cron jobs..."

# Add cron job for cleanup (weekly)
(crontab -l 2>/dev/null; echo "0 3 * * 0 $DEPLOY_DIR/cleanup.sh") | crontab -

echo "✓ Cron jobs configured (cleanup runs weekly)"

# Final summary
echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Configure your .env file:"
echo "   nano $DEPLOY_DIR/.env"
echo ""
echo "2. Set up GitHub secrets for automated deployment:"
echo "   - PI5_SSH_KEY"
echo "   - PI5_HOST ($(hostname -I | awk '{print $1}'))"
echo "   - PI5_USER ($USER)"
echo ""
echo "3. Test the service manually:"
echo "   systemctl --user start pi5-trading.service"
echo "   systemctl --user status pi5-trading.service"
echo ""
echo "4. View logs:"
echo "   tail -f $LOG_DIR/trading.log"
echo ""
echo "5. Monitor the system:"
echo "   $DEPLOY_DIR/monitor.sh"
echo ""
echo "6. Enable service to start on boot:"
echo "   systemctl --user enable pi5-trading.service"
echo ""
echo "📚 See deployment/README.md for more information"
