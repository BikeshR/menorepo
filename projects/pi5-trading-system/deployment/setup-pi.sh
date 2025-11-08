#!/bin/bash

set -e

echo "🚀 Pi5 Trading System - Unified Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null && ! grep -q "BCM" /proc/cpuinfo 2>/dev/null; then
    print_warning "This doesn't appear to be a Raspberry Pi, but continuing anyway..."
fi

# ============================================================================
# 1. INSTALL DOCKER
# ============================================================================

echo "📦 Step 1: Docker Installation"
echo "------------------------------"

if command -v docker &> /dev/null; then
    print_success "Docker is already installed ($(docker --version))"
else
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_success "Docker installed"

    print_warning "You need to LOG OUT and LOG BACK IN for Docker permissions"
    print_warning "After logging back in, run this script again"
    echo ""
    echo "Run: exit"
    echo "Then SSH back in and run: ./deployment/setup-pi.sh"
    exit 0
fi

# Check if user is in docker group
if ! groups | grep -q docker; then
    print_error "User not in docker group. Please log out and back in."
    exit 1
fi

# Install docker-compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo apt update
    sudo apt install -y docker-compose
    print_success "Docker Compose installed"
else
    print_success "Docker Compose is already installed ($(docker-compose --version))"
fi

echo ""

# ============================================================================
# 2. SETUP DIRECTORIES
# ============================================================================

echo "📁 Step 2: Directory Setup"
echo "--------------------------"

DEPLOY_DIR="$HOME/pi5-trading-system"
mkdir -p $DEPLOY_DIR/{logs,backups}
print_success "Created $DEPLOY_DIR"

echo ""

# ============================================================================
# 3. CREATE ENVIRONMENT FILE
# ============================================================================

echo "🔧 Step 3: Environment Configuration"
echo "------------------------------------"

if [ ! -f "$DEPLOY_DIR/.env" ]; then
    cat > "$DEPLOY_DIR/.env" <<'EOF'
# Alpaca API Configuration
# Get free paper trading credentials at https://alpaca.markets
ALPACA_API_KEY=your_api_key_here
ALPACA_SECRET_KEY=your_secret_key_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Database Password
DB_PASSWORD=SecurePassword123!

# Application Settings
TRADING_ENABLED=false
INITIAL_CAPITAL=100000.00
EOF
    print_success "Created .env file at $DEPLOY_DIR/.env"
    print_warning "IMPORTANT: Edit $DEPLOY_DIR/.env with your Alpaca credentials"

    echo ""
    echo "Get Alpaca API keys:"
    echo "1. Sign up at https://alpaca.markets"
    echo "2. Go to Paper Trading section"
    echo "3. Generate API keys"
    echo ""
    read -p "Press Enter to edit .env now, or Ctrl+C to edit later..."
    nano "$DEPLOY_DIR/.env"
else
    print_success ".env file already exists"
fi

echo ""

# ============================================================================
# 4. CREATE HELPER SCRIPTS
# ============================================================================

echo "📝 Step 4: Helper Scripts"
echo "-------------------------"

# Backup script
cat > "$DEPLOY_DIR/backup.sh" <<'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/pi5-trading-backups"
mkdir -p $BACKUP_DIR
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S).sql"

echo "Creating database backup..."
if docker ps | grep -q pi5-trading-postgres; then
    docker exec pi5-trading-postgres pg_dump -U pi5trader pi5_trading > "$BACKUP_DIR/$BACKUP_NAME"

    # Keep only last 7 backups
    cd $BACKUP_DIR
    ls -t *.sql 2>/dev/null | tail -n +8 | xargs -r rm

    echo "✓ Backup complete: $BACKUP_DIR/$BACKUP_NAME"
else
    echo "✗ PostgreSQL container not running"
    exit 1
fi
EOF

# Monitor script
cat > "$DEPLOY_DIR/monitor.sh" <<'EOF'
#!/bin/bash

echo "======================================"
echo "Pi5 Trading System - Status"
echo "======================================"
echo ""

cd ~/menorepo/projects/pi5-trading-system

echo "📦 Containers:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "💾 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "📊 Recent Logs (last 20 lines):"
docker logs pi5-trading-api --tail 20 2>/dev/null || echo "API container not running"

echo ""
echo "🔍 Health Check:"
curl -s http://localhost:8080/api/v1/system/health 2>/dev/null || echo "API not responding"

echo ""
EOF

# Update script
cat > "$DEPLOY_DIR/update.sh" <<'EOF'
#!/bin/bash
set -e

echo "🔄 Updating Pi5 Trading System..."

cd ~/menorepo/projects/pi5-trading-system

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Create backup
echo "💾 Creating backup..."
~/pi5-trading-system/backup.sh || true

# Rebuild and restart
echo "🔨 Rebuilding containers..."
docker-compose -f docker-compose.prod.yml build

echo "🚀 Restarting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services..."
sleep 10

# Verify
echo "🔍 Verifying deployment..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "✅ Update complete!"
EOF

chmod +x "$DEPLOY_DIR/backup.sh"
chmod +x "$DEPLOY_DIR/monitor.sh"
chmod +x "$DEPLOY_DIR/update.sh"

print_success "Created backup.sh, monitor.sh, update.sh"

echo ""

# ============================================================================
# 5. SETUP LOG ROTATION
# ============================================================================

echo "📄 Step 5: Log Rotation"
echo "-----------------------"

cat > /tmp/pi5-trading-docker <<EOF
$HOME/pi5-trading-system/logs/*.log {
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
print_success "Configured log rotation"

echo ""

# ============================================================================
# 6. SETUP CRON JOBS
# ============================================================================

echo "⏰ Step 6: Cron Jobs"
echo "--------------------"

# Daily backup at 2 AM
CRON_BACKUP="0 2 * * * $DEPLOY_DIR/backup.sh >> $DEPLOY_DIR/logs/backup.log 2>&1"
# Weekly cleanup on Sunday at 3 AM
CRON_CLEANUP="0 3 * * 0 docker system prune -f >> $DEPLOY_DIR/logs/cleanup.log 2>&1"

(crontab -l 2>/dev/null | grep -v "$DEPLOY_DIR/backup.sh" | grep -v "docker system prune"; echo "$CRON_BACKUP"; echo "$CRON_CLEANUP") | crontab -

print_success "Configured daily backups (2 AM) and weekly cleanup (Sunday 3 AM)"

echo ""

# ============================================================================
# 7. SETUP GITHUB ACTIONS RUNNER
# ============================================================================

echo "🤖 Step 7: GitHub Actions Runner"
echo "---------------------------------"
echo ""

if systemctl --user list-units --type=service | grep -q "actions.runner"; then
    print_success "GitHub Actions runner is already installed"
    echo ""
    echo "To check runner status:"
    echo "  systemctl --user status actions.runner.*"
else
    echo "Setting up GitHub Actions self-hosted runner..."
    echo ""

    # Detect architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        RUNNER_ARCH="arm64"
    elif [ "$ARCH" = "x86_64" ]; then
        RUNNER_ARCH="x64"
    else
        print_error "Unsupported architecture: $ARCH"
        exit 1
    fi

    RUNNER_VERSION="2.311.0"
    RUNNER_DIR="$HOME/actions-runner"

    # Create runner directory
    mkdir -p $RUNNER_DIR
    cd $RUNNER_DIR

    # Download runner
    if [ ! -f "run.sh" ]; then
        echo "Downloading GitHub Actions runner..."
        curl -o actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz \
            -L https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz

        tar xzf actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz
        rm actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz
    fi

    echo ""
    echo "=========================================="
    echo "GitHub Runner Configuration"
    echo "=========================================="
    echo ""
    echo "You need a registration token from GitHub:"
    echo ""
    echo "1. Go to: https://github.com/YOUR_USERNAME/menorepo/settings/actions/runners/new"
    echo "2. Select: Linux, $RUNNER_ARCH"
    echo "3. Copy the token from the config command"
    echo ""
    read -p "Repository owner (e.g., BikeshR): " REPO_OWNER
    read -p "Repository name (e.g., menorepo): " REPO_NAME
    read -p "Registration token: " REGISTRATION_TOKEN

    # Configure runner
    ./config.sh \
        --url https://github.com/$REPO_OWNER/$REPO_NAME \
        --token $REGISTRATION_TOKEN \
        --name "pi5-trading-runner" \
        --labels pi5,arm64,raspberry-pi,docker \
        --work _work \
        --replace

    # Install as service
    sudo ./svc.sh install $USER
    sudo ./svc.sh start

    print_success "GitHub Actions runner installed and started"

    echo ""
    echo "Runner status:"
    sudo ./svc.sh status
fi

cd ~

echo ""

# ============================================================================
# 8. CONFIGURE GITHUB SECRETS
# ============================================================================

echo "🔐 Step 8: GitHub Secrets"
echo "-------------------------"
echo ""

DB_PASSWORD=$(grep "DB_PASSWORD=" "$DEPLOY_DIR/.env" | cut -d'=' -f2)

echo "Add this secret to your GitHub repository:"
echo ""
echo "Go to: https://github.com/YOUR_USERNAME/menorepo/settings/secrets/actions"
echo ""
echo "Secret Name:  DB_PASSWORD"
echo "Secret Value: $DB_PASSWORD"
echo ""

read -p "Press Enter when you've added the secret..."

echo ""

# ============================================================================
# SETUP COMPLETE
# ============================================================================

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""

print_success "Docker & Docker Compose installed"
print_success "Helper scripts created in $DEPLOY_DIR"
print_success "GitHub Actions runner configured"
print_success "Cron jobs configured (backups & cleanup)"

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Verify .env configuration:"
echo "   nano $DEPLOY_DIR/.env"
echo ""
echo "2. Deploy the system via git push:"
echo "   cd /path/to/menorepo"
echo "   git push origin main"
echo ""
echo "3. Monitor deployment:"
echo "   https://github.com/YOUR_USERNAME/menorepo/actions"
echo ""
echo "4. After deployment, access dashboard:"
echo "   http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "5. Use helper scripts:"
echo "   $DEPLOY_DIR/monitor.sh    # View system status"
echo "   $DEPLOY_DIR/backup.sh     # Create manual backup"
echo "   $DEPLOY_DIR/update.sh     # Manual update (or just git push)"
echo ""
echo "📚 Documentation:"
echo "   deployment/README.md      # Complete guide"
echo "   DEVELOPMENT.md            # Local development"
echo ""
echo "🎉 Happy Trading!"
