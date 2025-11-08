#!/bin/bash
#
# Setup GitHub Actions self-hosted runner on Raspberry Pi
# This allows GitHub Actions to run directly on your Pi (no internet exposure needed!)
#

set -e

echo "🚀 Setting up GitHub Actions Self-Hosted Runner on Raspberry Pi"
echo ""

# Check if running on ARM64
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ]; then
    echo "⚠️  Warning: Expected ARM64 (aarch64) architecture, found: $ARCH"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Variables
RUNNER_NAME="pi5-trading-runner"
RUNNER_DIR="$HOME/actions-runner"
RUNNER_VERSION="2.311.0"  # Latest version as of Dec 2024

# Get repository info
echo "📋 GitHub Repository Information"
echo "You'll need the following from your GitHub repository:"
echo "  Settings → Actions → Runners → New self-hosted runner"
echo ""
read -p "Repository owner (e.g., yourusername): " REPO_OWNER
read -p "Repository name (e.g., menorepo): " REPO_NAME
echo ""

# Get registration token
echo "🔑 You need a registration token from GitHub:"
echo ""
echo "1. Go to: https://github.com/$REPO_OWNER/$REPO_NAME/settings/actions/runners/new"
echo "2. Copy the token from the 'Configure' section"
echo "   (It looks like: ABCDEFGHIJKLMNOPQRSTUVWXYZ...)"
echo ""
read -p "Paste the registration token here: " REGISTRATION_TOKEN
echo ""

if [ -z "$REGISTRATION_TOKEN" ]; then
    echo "❌ Registration token is required!"
    exit 1
fi

# Create runner directory
echo "📁 Creating runner directory..."
mkdir -p $RUNNER_DIR
cd $RUNNER_DIR

# Download GitHub Actions runner for ARM64
echo "⬇️  Downloading GitHub Actions runner..."
RUNNER_FILE="actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_FILE}"

if [ ! -f "$RUNNER_FILE" ]; then
    wget -q --show-progress $DOWNLOAD_URL
else
    echo "✓ Runner already downloaded"
fi

# Extract
echo "📦 Extracting runner..."
tar xzf $RUNNER_FILE
rm $RUNNER_FILE

# Configure runner
echo ""
echo "⚙️  Configuring runner..."
./config.sh \
    --url https://github.com/$REPO_OWNER/$REPO_NAME \
    --token $REGISTRATION_TOKEN \
    --name $RUNNER_NAME \
    --labels pi5,arm64,raspberry-pi \
    --work _work \
    --unattended

echo "✓ Runner configured"

# Install as systemd service
echo ""
echo "🔧 Installing as systemd service..."
sudo ./svc.sh install $USER

echo "✓ Service installed"

# Start the service
echo ""
echo "🚀 Starting runner service..."
sudo ./svc.sh start

echo "✓ Service started"

# Check status
echo ""
echo "📊 Runner Status:"
sudo ./svc.sh status

echo ""
echo "✅ GitHub Actions Runner Setup Complete!"
echo ""
echo "Your runner is now online and will appear in:"
echo "  https://github.com/$REPO_OWNER/$REPO_NAME/settings/actions/runners"
echo ""
echo "🎯 The runner is configured with labels:"
echo "  • pi5"
echo "  • arm64"
echo "  • raspberry-pi"
echo ""
echo "📝 To use it in your workflow, set:"
echo "  runs-on: self-hosted"
echo ""
echo "🛠️  Runner Management Commands:"
echo "  Status:  sudo $RUNNER_DIR/svc.sh status"
echo "  Stop:    sudo $RUNNER_DIR/svc.sh stop"
echo "  Start:   sudo $RUNNER_DIR/svc.sh start"
echo "  Restart: sudo $RUNNER_DIR/svc.sh restart"
echo "  Logs:    journalctl -u actions.runner.* -f"
echo ""
echo "⚠️  Important Notes:"
echo "  • Runner stays running even after logout"
echo "  • Starts automatically on reboot"
echo "  • Runs in isolated workspace (_work directory)"
echo "  • Has access to local network resources"
echo ""
echo "🔒 Security:"
echo "  ✓ No internet exposure required"
echo "  ✓ No port forwarding needed"
echo "  ✓ Runs on your private network"
echo "  ✓ Full control over execution environment"
