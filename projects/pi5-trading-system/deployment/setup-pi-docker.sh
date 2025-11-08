#!/bin/bash

set -e

echo "🚀 Setting up Pi5 Trading System (Docker) on Raspberry Pi"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✓ Docker installed"
    echo "⚠️  Please log out and back in for Docker permissions to take effect"
    echo "   Then run this script again."
    exit 0
else
    echo "✓ Docker is already installed"
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo apt update
    sudo apt install -y docker-compose
    echo "✓ Docker Compose installed"
else
    echo "✓ Docker Compose is already installed"
fi

# Create deployment directory
DEPLOY_DIR="$HOME/pi5-trading-system"
mkdir -p $DEPLOY_DIR/{logs,backups}
echo "✓ Created deployment directory: $DEPLOY_DIR"

# Create .env file if it doesn't exist
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    cat > "$DEPLOY_DIR/.env" <<'EOF'
# Alpaca API Configuration
ALPACA_API_KEY=your_api_key_here
ALPACA_SECRET_KEY=your_secret_key_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Database
DB_PASSWORD=SecurePassword123!

# Application
TRADING_ENABLED=false
INITIAL_CAPITAL=100000.00
EOF
    echo "✓ Created .env file at $DEPLOY_DIR/.env"
    echo "⚠️  IMPORTANT: Edit $DEPLOY_DIR/.env with your Alpaca credentials"
else
    echo "✓ .env file already exists"
fi

# Create backup script
cat > "$DEPLOY_DIR/backup.sh" <<'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/pi5-trading-backups"
mkdir -p $BACKUP_DIR
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"

echo "Creating backup: $BACKUP_NAME"
docker exec pi5-trading-postgres pg_dump -U pi5trader pi5_trading > "$BACKUP_DIR/${BACKUP_NAME}.sql"
docker exec pi5-trading-redis redis-cli BGSAVE

# Keep only last 7 backups
cd $BACKUP_DIR
ls -t *.sql | tail -n +8 | xargs -r rm

echo "Backup complete: $BACKUP_DIR/${BACKUP_NAME}.sql"
EOF
chmod +x "$DEPLOY_DIR/backup.sh"
echo "✓ Created backup script"

# Create monitoring script
cat > "$DEPLOY_DIR/monitor.sh" <<'EOF'
#!/bin/bash

echo "======================================"
echo "Pi5 Trading System - Docker Status"
echo "======================================"
echo ""

# Container status
echo "📦 Containers:"
docker-compose -f ~/menorepo/projects/pi5-trading-system/docker-compose.prod.yml ps

echo ""
echo "💾 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "📊 Recent Logs (last 20 lines):"
docker logs pi5-trading-api --tail 20

echo ""
echo "🔍 Health Status:"
curl -s http://localhost:8080/api/v1/system/health || echo "API not responding"
EOF
chmod +x "$DEPLOY_DIR/monitor.sh"
echo "✓ Created monitoring script"

# Create update script
cat > "$DEPLOY_DIR/update.sh" <<'EOF'
#!/bin/bash
set -e

echo "🔄 Updating Pi5 Trading System..."

cd ~/menorepo/projects/pi5-trading-system

# Pull latest code
git pull

# Create backup
echo "💾 Creating backup..."
~/pi5-trading-system/backup.sh

# Rebuild and restart
echo "🔨 Rebuilding containers..."
docker-compose -f docker-compose.prod.yml build

echo "🚀 Restarting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 10

# Verify
echo "🔍 Verifying deployment..."
docker-compose -f docker-compose.prod.yml ps

echo "✅ Update complete!"
EOF
chmod +x "$DEPLOY_DIR/update.sh"
echo "✓ Created update script"

# Setup log rotation
cat > /tmp/pi5-trading-docker <<'EOF'
/home/*/pi5-trading-system/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
sudo mv /tmp/pi5-trading-docker /etc/logrotate.d/pi5-trading-docker
sudo chmod 644 /etc/logrotate.d/pi5-trading-docker
echo "✓ Configured log rotation"

# Setup cron jobs
CRON_BACKUP="0 2 * * * $DEPLOY_DIR/backup.sh >> $DEPLOY_DIR/logs/backup.log 2>&1"
CRON_CLEANUP="0 3 * * 0 docker system prune -f >> $DEPLOY_DIR/logs/cleanup.log 2>&1"

(crontab -l 2>/dev/null | grep -v "$DEPLOY_DIR/backup.sh" | grep -v "docker system prune"; echo "$CRON_BACKUP"; echo "$CRON_CLEANUP") | crontab -
echo "✓ Configured cron jobs (daily backup at 2 AM, weekly cleanup)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit configuration:"
echo "   nano $DEPLOY_DIR/.env"
echo ""
echo "2. Clone/update repository:"
echo "   git clone https://github.com/BikeshR/menorepo.git ~/menorepo"
echo "   # OR"
echo "   cd ~/menorepo && git pull"
echo ""
echo "3. Start the system:"
echo "   cd ~/menorepo/projects/pi5-trading-system"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "4. Monitor the system:"
echo "   $DEPLOY_DIR/monitor.sh"
echo ""
echo "5. View logs:"
echo "   docker-compose -f ~/menorepo/projects/pi5-trading-system/docker-compose.prod.yml logs -f"
echo ""
echo "📚 See deployment/README.md for more information"
