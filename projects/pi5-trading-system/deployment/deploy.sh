#!/bin/bash

# Pi5 Trading System Deployment Script
# Purpose: Deploy or redeploy the Pi5 Trading System using Docker
# Usage: ./scripts/deploy.sh [--update|--clean|--logs]
# Run this every time you want to deploy/redeploy the trading system

set -e

# Configuration
PROJECT_NAME="pi5-trading-system"
SERVICE_NAME="pi5-trading-system"
COMPOSE_FILE="docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
success() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"; }
warning() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"; }
header() { echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] 🚀 $1${NC}"; }

# Docker compose wrapper to use correct file path
dc() {
    docker compose -f "$COMPOSE_FILE" "$@"
}

# Parse command line arguments
CLEAN_BUILD=false
UPDATE_CODE=false
SHOW_LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --update)
            UPDATE_CODE=true
            shift
            ;;
        --logs)
            SHOW_LOGS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --clean     Clean build (remove old images and rebuild all services)"
            echo "  --update    Update code from git and deploy (optimized - only restarts API)"
            echo "  --logs      Show logs after deployment"
            echo "  --help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Standard deployment"
            echo "  $0 --update          # Fast update (only rebuilds/restarts API, preserves DB/Redis)"
            echo "  $0 --clean --update  # Full clean deployment with code update (restarts everything)"
            echo "  $0 --logs            # Deploy and show logs"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check requirements
check_requirements() {
    log "Checking deployment requirements..."
    
    # Check if we're in the right directory
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "docker-compose.yml not found. Make sure you're in the project root directory."
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &>/dev/null; then
        error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if docker compose is available (new syntax) or legacy docker-compose
    if ! docker compose version &>/dev/null && ! command -v docker-compose &>/dev/null; then
        error "Docker Compose not found. Please install Docker Compose."
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            log "Creating .env file from .env.example..."
            cp .env.example .env
            warning "⚠️  Please review and configure .env file with your settings"
        else
            error ".env file not found and no .env.example available"
            exit 1
        fi
    fi
    
    success "Requirements check passed"
}

# Update code from git
update_code() {
    if [ "$UPDATE_CODE" = true ]; then
        header "Updating code from git..."
        
        # Check if we're in a git repository
        if ! git rev-parse --git-dir &>/dev/null; then
            warning "Not in a git repository, skipping code update"
            return
        fi
        
        # Stash any local changes
        if ! git diff-index --quiet HEAD --; then
            log "Stashing local changes..."
            git stash push -m "Auto-stash before deployment $(date)"
        fi
        
        # Pull latest changes
        log "Pulling latest changes..."
        git pull origin main
        
        success "Code updated successfully"
    fi
}

# Stop existing services
stop_services() {
    header "Stopping existing services..."
    
    # Stop systemd service if it exists
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        log "Stopping systemd service: $SERVICE_NAME"
        sudo systemctl stop "$SERVICE_NAME"
    fi
    
    # For update mode, only stop the API container to preserve database state
    if [ "$UPDATE_CODE" = true ] && [ "$CLEAN_BUILD" = false ]; then
        log "Update mode: Only stopping trading API container..."
        dc stop trading_api
        dc rm -f trading_api
        success "Trading API container stopped"
    else
        # Stop all docker containers for clean builds
        if dc ps | grep -q "Up"; then
            log "Stopping all Docker containers..."
            dc down
            success "All containers stopped"
        else
            log "No running containers found"
        fi
    fi
}

# Clean up old images and volumes
clean_build() {
    if [ "$CLEAN_BUILD" = true ]; then
        header "Cleaning up old Docker resources..."
        
        # Remove containers
        log "Removing old containers..."
        dc down --remove-orphans
        
        # Remove images
        log "Removing old images..."
        dc down --rmi local 2>/dev/null || true
        
        # Remove unused volumes (but keep named volumes)
        log "Removing unused volumes..."
        docker volume prune -f
        
        # Remove unused networks
        log "Removing unused networks..."
        docker network prune -f
        
        success "Cleanup completed"
    fi
}

# Build React Dashboard
build_dashboard() {
    header "Building React Dashboard for production..."
    
    local dashboard_dir="dashboard"
    
    # Check if dashboard directory exists
    if [ ! -d "$dashboard_dir" ]; then
        warning "Dashboard directory not found, skipping dashboard build"
        return 0
    fi
    
    log "Installing dashboard dependencies..."
    cd "$dashboard_dir"
    npm ci
    
    log "Building dashboard for production..."
    npm run build
    
    # Verify build exists
    if [ -d "build" ]; then
        success "Dashboard build completed successfully"
        log "Build files: $(find build -type f | wc -l) files created"
    else
        error "Dashboard build failed - build directory not found"
        exit 1
    fi
    
    # Return to project root
    cd ..
    success "Dashboard ready for deployment"
}

# Build and start services
deploy_services() {
    header "Deploying trading system..."
    
    # Build dashboard first (only if dashboard directory exists)
    if [ -d "dashboard" ]; then
        build_dashboard
    else
        warning "No dashboard directory found, skipping dashboard build"
    fi
    
    # Build images
    if [ "$UPDATE_CODE" = true ] && [ "$CLEAN_BUILD" = false ]; then
        log "Update mode: Building only trading API image..."
        dc build trading_api
        success "Trading API image built successfully"
        
        # Start only the trading API service (DB and Redis should still be running)
        log "Starting trading API service..."
        dc up -d trading_api
        success "Trading API service started"
        
        # Quick health check for API only
        log "Waiting for trading API to be healthy..."
        local max_attempts=15
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if dc ps trading_api | grep -q "Up (healthy)"; then
                success "Trading API is healthy and ready"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                warning "Trading API may not be fully healthy yet. Check status with: dc ps"
                break
            fi
            
            sleep 3
            ((attempt++))
        done
    else
        # Full deployment for clean builds
        log "Building Docker images..."
        if [ "$CLEAN_BUILD" = true ]; then
            dc build --no-cache
        else
            dc build
        fi
        success "Images built successfully"
        
        # Start all services
        log "Starting all services..."
        dc up -d
        success "Services started"
        
        # Wait for all services to be ready
        log "Waiting for all services to be healthy..."
        local max_attempts=30
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if dc ps | grep -q "Up (healthy)"; then
                success "All services are healthy and ready"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                warning "Services may not be fully healthy yet. Check status with: dc ps"
                break
            fi
            
            sleep 5
            ((attempt++))
        done
    fi
}

# Create and enable systemd service
setup_systemd_service() {
    header "Setting up systemd service..."
    
    local service_file="/etc/systemd/system/${SERVICE_NAME}.service"
    local current_dir=$(pwd)
    
    log "Creating systemd service file..."
    sudo tee "$service_file" > /dev/null <<EOF
[Unit]
Description=Pi5 Trading System
Documentation=https://github.com/BikeshR/menorepo/tree/main/projects/pi5-trading-system
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${current_dir}
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
ExecReload=/usr/bin/docker-compose restart
TimeoutStartSec=300
TimeoutStopSec=60
User=${USER}
Group=${USER}

# Restart policy
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    
    success "Systemd service configured and enabled"
}

# Verify deployment
verify_deployment() {
    header "Verifying deployment..."
    
    local errors=0
    
    # Check container status
    log "Checking container status..."
    if dc ps | grep -q "Up"; then
        success "Containers are running"
        
        # Show container details
        echo ""
        echo "📦 Container Status:"
        dc ps
    else
        error "Containers are not running properly"
        ((errors++))
    fi
    
    # Check database connectivity
    log "Testing database connectivity..."
    if dc exec -T timescaledb pg_isready -U pi5trader -d pi5_trading &>/dev/null; then
        success "Database is accessible"
    else
        error "Database connection failed"
        ((errors++))
    fi
    
    # Check Redis connectivity
    log "Testing Redis connectivity..."
    if dc exec -T redis redis-cli ping | grep -q "PONG"; then
        success "Redis is accessible"
    else
        error "Redis connection failed"
        ((errors++))
    fi
    
    # Check API endpoint
    log "Testing API endpoint..."
    local max_attempts=10
    local attempt=1
    local api_available=false
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf http://localhost:8080/health &>/dev/null; then
            success "API endpoint is responding"
            api_available=true
            break
        fi
        sleep 2
        ((attempt++))
    done
    
    if [ "$api_available" = false ]; then
        warning "API endpoint not responding (may still be starting up)"
    fi
    
    if [ $errors -eq 0 ]; then
        success "Deployment verification completed successfully"
    else
        error "$errors verification checks failed"
        return 1
    fi
}

# Show deployment status and information
show_deployment_info() {
    header "Deployment Information"
    
    local pi_ip=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo "🎯 Pi5 Trading System Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "📊 System Status:"
    dc ps
    echo ""
    echo "🌐 Access Points:"
    echo "   🎯 Trading Dashboard:  http://${pi_ip}:8080/"
    echo "   📱 API Documentation:  http://${pi_ip}:8080/docs"
    echo "   🔍 Alternative Docs:   http://${pi_ip}:8080/redoc"
    echo "   💹 Health Check:      http://${pi_ip}:8080/health"
    echo "   🔌 WebSocket Streams:"
    echo "      - Market Data:      ws://${pi_ip}:8080/ws/market-data"
    echo "      - Portfolio:        ws://${pi_ip}:8080/ws/portfolio-updates"
    echo "      - System Events:    ws://${pi_ip}:8080/ws/system-events"
    echo ""
    echo "💾 Database Access:"
    echo "   🐘 PostgreSQL:        localhost:5432"
    echo "   📊 Database:          pi5_trading"
    echo "   👤 User:              pi5trader"
    echo "   🗄️  Redis:             localhost:6379"
    echo ""
    echo "📂 Important Directories:"
    echo "   📁 Project:           $(pwd)"
    echo "   📝 Logs:              $(pwd)/logs/"
    echo "   ⚙️  Config:            $(pwd)/config/"
    echo "   💾 Data:              Docker volumes"
    echo ""
    echo "🔧 Management Commands:"
    echo "   🚀 Start:             docker-compose up -d"
    echo "   🛑 Stop:              docker-compose down"
    echo "   🔄 Restart:           docker-compose restart"
    echo "   📊 Status:            docker-compose ps"
    echo "   📝 Logs:              docker-compose logs -f"
    echo "   🔍 Shell Access:      docker-compose exec trading_api bash"
    echo ""
    echo "⚙️  System Service:"
    echo "   🚀 Start:             sudo systemctl start $SERVICE_NAME"
    echo "   🛑 Stop:              sudo systemctl stop $SERVICE_NAME"
    echo "   📊 Status:            sudo systemctl status $SERVICE_NAME"
    echo ""
    echo "📈 System Resources:"
    echo "   💾 Memory:            $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
    echo "   💽 Disk:              $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
    if command -v vcgencmd &>/dev/null; then
        echo "   🌡️  Temperature:      $(vcgencmd measure_temp)"
    fi
    echo ""
    
    if [ "$SHOW_LOGS" = true ]; then
        warning "📝 Showing logs (Ctrl+C to exit)..."
        echo ""
        docker-compose logs -f
    else
        echo "💡 Tip: Use --logs flag to view logs after deployment"
        echo "   Example: $0 --logs"
    fi
}

# Handle errors and cleanup
cleanup_on_error() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Deployment failed with exit code $exit_code"
        echo ""
        echo "🔍 Troubleshooting:"
        echo "   📝 Check logs:       docker-compose logs"
        echo "   📊 Check status:     docker-compose ps"
        echo "   🔧 Manual cleanup:   docker-compose down"
        echo "   🧹 Full cleanup:     $0 --clean"
        echo ""
    fi
}

# Set up error handling
trap cleanup_on_error ERR

# Main deployment function
main() {
    echo ""
    echo "🚀 Pi5 Trading System Deployment"
    echo "================================="
    echo ""
    
    if [ "$UPDATE_CODE" = true ]; then
        echo "📥 Mode: Update and Deploy"
    elif [ "$CLEAN_BUILD" = true ]; then
        echo "🧹 Mode: Clean Build and Deploy"
    else
        echo "🔄 Mode: Standard Deployment"
    fi
    echo ""
    
    log "Starting deployment process..."
    
    check_requirements
    update_code
    stop_services
    clean_build
    deploy_services
    setup_systemd_service
    
    # Give services a moment to fully start
    log "Allowing services time to fully initialize..."
    sleep 10
    
    if verify_deployment; then
        show_deployment_info
        echo ""
        success "🎉 Deployment completed successfully!"
        echo ""
    else
        error "Deployment verification failed"
        echo ""
        echo "🔍 Check the logs for more information:"
        echo "   docker-compose logs"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"