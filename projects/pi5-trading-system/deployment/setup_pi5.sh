#!/bin/bash

# Pi5 System Setup Script
# Purpose: Prepare a fresh Raspberry Pi 5 (Ubuntu 24.04) for Docker-based development
# Usage: sudo ./scripts/setup_pi5.sh
# Run this ONCE per Pi5 to set up the base environment

set -e

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

# Check if running as root
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check hardware compatibility
check_hardware() {
    log "Checking hardware compatibility..."
    
    if ! grep -q "Raspberry Pi 5" /proc/device-tree/model 2>/dev/null; then
        warning "This script is optimized for Raspberry Pi 5, but will continue anyway"
    else
        success "Running on Raspberry Pi 5 - perfect!"
    fi
    
    # Check architecture
    if [ "$(uname -m)" != "aarch64" ]; then
        error "This script requires ARM64 architecture"
        exit 1
    fi
    
    success "Hardware compatibility verified"
}

# Update system packages
update_system() {
    header "Updating system packages..."
    
    log "Refreshing package lists..."
    apt-get update -qq
    
    log "Installing essential system packages..."
    apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        python3 \
        python3-pip \
        python3-venv \
        postgresql-client \
        redis-tools \
        htop \
        iotop \
        nethogs \
        sysstat \
        lm-sensors \
        stress-ng \
        vim \
        nano \
        unzip \
        tree
    
    success "System packages updated"
}

# Install Docker Engine
install_docker() {
    header "Installing Docker Engine..."
    
    if command -v docker &> /dev/null; then
        success "Docker already installed: $(docker --version)"
        return
    fi
    
    log "Adding Docker repository..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    echo "deb [arch=arm64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    log "Installing Docker packages..."
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Configure Docker service
    systemctl enable docker
    systemctl start docker
    
    success "Docker installed: $(docker --version)"
}

# Install Docker Compose (standalone)
install_docker_compose() {
    header "Installing Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        success "Docker Compose already installed: $(docker-compose --version)"
        return
    fi
    
    log "Downloading Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    success "Docker Compose installed: $(docker-compose --version)"
}

# Install Poetry for Python dependency management
install_poetry() {
    header "Installing Poetry..."
    
    if command -v poetry &> /dev/null; then
        success "Poetry already installed: $(poetry --version)"
        return
    fi
    
    log "Installing Poetry using official installer..."
    
    # Ensure we have curl and python3-venv
    apt-get update -qq
    apt-get install -y curl python3-venv python3-pip
    
    # Use official Poetry installer (works with externally-managed environments)
    if curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python3 -; then
        ln -sf /opt/poetry/bin/poetry /usr/local/bin/poetry
        
        # Verify installation
        if command -v poetry &> /dev/null; then
            success "Poetry installed: $(poetry --version)"
        else
            error "Poetry installation failed - command not found"
            exit 1
        fi
    else
        error "Failed to download or install Poetry"
        exit 1
    fi
}

# Configure current user for development
configure_current_user() {
    header "Configuring current user for development..."
    
    # Get the user who called sudo (the actual user, not root)
    local CURRENT_USER="${SUDO_USER:-$(logname 2>/dev/null || echo $USER)}"
    
    if [ "$CURRENT_USER" = "root" ]; then
        warning "Running as root user - this is not recommended for development"
        warning "Please run this script with sudo from a regular user account"
        return 1
    fi
    
    log "Configuring user: $CURRENT_USER"
    
    # Ensure user is in docker group
    usermod -aG docker "$CURRENT_USER"
    success "User $CURRENT_USER added to docker group"
    
    # Ensure user is in sudo group (if not already)
    if ! groups "$CURRENT_USER" | grep -q sudo; then
        usermod -aG sudo "$CURRENT_USER"
        log "User $CURRENT_USER added to sudo group"
    fi
    
    success "User $CURRENT_USER configured for development"
}

# Configure system optimizations
configure_system_optimizations() {
    header "Applying system optimizations..."
    
    log "Configuring kernel parameters for performance..."
    
    # Network optimizations for low latency
    cat >> /etc/sysctl.conf << 'EOF'

# Pi5 Development Environment Optimizations
# Network optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr

# Memory optimizations
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# File system optimizations
fs.file-max = 100000
EOF

    # Apply sysctl changes
    sysctl -p > /dev/null
    
    # Enable sysstat for system monitoring
    systemctl enable sysstat
    systemctl start sysstat
    
    success "System optimizations applied"
}

# Configure firewall
setup_firewall() {
    header "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        log "Configuring UFW firewall..."
        
        # Reset to defaults
        ufw --force reset
        
        # Set default policies
        ufw default deny incoming
        ufw default allow outgoing
        
        # Allow SSH
        ufw allow ssh
        
        # Allow Docker networks
        ufw allow from 172.16.0.0/12
        ufw allow from 192.168.0.0/16
        
        # Allow Pi5 Trading System API
        ufw allow 8080/tcp comment "Pi5 Trading System API"
        
        # Enable UFW
        ufw --force enable
        
        success "Firewall configured"
    else
        warning "UFW not installed, skipping firewall setup"
    fi
}

# Install development tools
install_dev_tools() {
    header "Installing development tools..."
    
    log "Installing additional development utilities..."
    
    # Install node.js (for potential frontend development)
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y nodejs
    
    # Install useful CLI tools (using system packages for Ubuntu 24.04 compatibility)
    apt-get install -y \
        httpie \
        jq \
        python3-pip \
        python3-full
    
    success "Development tools installed"
}


# Verify installation
verify_installation() {
    header "Verifying installation..."
    
    local errors=0
    
    # Check Docker
    if docker --version &>/dev/null; then
        success "Docker: $(docker --version | cut -d' ' -f3 | sed 's/,//')"
    else
        error "Docker installation failed"
        ((errors++))
    fi
    
    # Check Docker Compose
    if docker-compose --version &>/dev/null; then
        success "Docker Compose: $(docker-compose --version | cut -d' ' -f3 | sed 's/,//')"
    else
        error "Docker Compose installation failed"
        ((errors++))
    fi
    
    # Check Poetry
    if poetry --version &>/dev/null; then
        success "Poetry: $(poetry --version | cut -d' ' -f3)"
    else
        error "Poetry installation failed"
        ((errors++))
    fi
    
    # Check Node.js
    if node --version &>/dev/null; then
        success "Node.js: $(node --version)"
    else
        warning "Node.js installation failed (optional)"
    fi
    
    # Check current user docker permissions
    local CURRENT_USER="${SUDO_USER:-$(logname 2>/dev/null || echo $USER)}"
    if groups "$CURRENT_USER" | grep -q docker; then
        success "User permissions: $CURRENT_USER configured for Docker"
    else
        warning "User $CURRENT_USER may need to logout/login for Docker permissions"
    fi
    
    if [ $errors -eq 0 ]; then
        success "All core components verified successfully!"
    else
        error "$errors critical components failed verification"
        exit 1
    fi
}

# Display completion summary
show_completion_summary() {
    echo ""
    echo "🎉 Pi5 System Setup Complete!"
    echo "=============================="
    echo ""
    echo "✅ Installed Components:"
    echo "   - Docker Engine & Compose"
    echo "   - Poetry (Python dependency manager)"
    echo "   - Node.js (LTS)"
    echo "   - Development tools & utilities"
    echo "   - System monitoring tools"
    echo ""
    echo "✅ System Optimizations:"
    echo "   - Network performance tuning"
    echo "   - Memory management optimization"
    echo "   - Firewall configuration"
    echo ""
    echo "✅ Users & Permissions:"
    echo "   - Current user configured for development"
    echo "   - Docker group permissions configured"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Logout and log back in (to apply group changes)"
    echo "   2. Run: ./deployment/deploy.sh"
    echo ""
    echo "🔧 Useful Commands:"
    echo "   - docker ps       # Docker containers"
    echo "   - docker-compose logs  # Docker compose logs"
    echo "   - htop            # System monitoring"
    echo ""
    warning "⚠️  Logout and login again to apply group changes!"
    echo ""
}

# Main function
main() {
    echo ""
    echo "🚀 Pi5 System Setup Script"
    echo "=========================="
    echo ""
    echo "This script will prepare your Raspberry Pi 5 for Docker-based development."
    echo "It will install Docker, Poetry, development tools, and optimize the system."
    echo ""
    
    read -p "Continue with setup? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
    
    echo ""
    log "Starting Pi5 system setup..."
    
    check_permissions
    check_hardware
    update_system
    install_docker
    install_docker_compose
    install_poetry
    configure_current_user
    configure_system_optimizations
    setup_firewall
    install_dev_tools
    verify_installation
    show_completion_summary
    
    success "🎉 Setup completed successfully!"
}

# Run main function
main "$@"