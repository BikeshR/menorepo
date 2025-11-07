#!/bin/bash
#
# Pi5 Trading System - Cron Setup Script
#
# This script installs cron jobs for automated backups and maintenance
#
# Usage:
#   sudo ./scripts/setup_cron.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as pi user (not root)
if [ "$(id -u)" -eq 0 ]; then
    log_error "This script should be run as the pi user, not root"
    log_error "Run: sudo -u pi ./scripts/setup_cron.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log_info "Setting up cron jobs for Pi5 Trading System"
log_info "Project root: ${PROJECT_ROOT}"

# Make scripts executable
chmod +x "${SCRIPT_DIR}/backup.sh"
chmod +x "${SCRIPT_DIR}/restore.sh"
log_info "Made scripts executable"

# Create backup directory
BACKUP_DIR="/home/pi/trading_backups"
mkdir -p "${BACKUP_DIR}"
log_info "Created backup directory: ${BACKUP_DIR}"

# Create cron job entries
CRON_FILE="/tmp/trading_cron_$$"

# Get existing cron jobs (excluding trading system jobs)
crontab -l 2>/dev/null | grep -v "pi5-trading-system-go" > "${CRON_FILE}" || true

# Add new cron jobs
cat >> "${CRON_FILE}" << EOF

# Pi5 Trading System - Automated Backups and Maintenance
# Added by setup_cron.sh on $(date)

# Daily backup at 2:00 AM
0 2 * * * ${SCRIPT_DIR}/backup.sh >> /home/pi/trading_backups/cron.log 2>&1

# Weekly compression check (Sundays at 3:00 AM)
0 3 * * 0 docker exec pi5_trading_db psql -U pi5trader -d pi5_trading -c "SELECT compress_chunk(i, if_not_compressed => true) FROM show_chunks('market_data', older_than => INTERVAL '1 day') i;" >> /home/pi/trading_backups/compression.log 2>&1

# Monthly cleanup of old logs (first day of month at 4:00 AM)
0 4 1 * * find ${PROJECT_ROOT}/deployments/logs -name "*.log" -mtime +30 -delete >> /home/pi/trading_backups/cleanup.log 2>&1

# Weekly external USB backup (Sundays at 5:00 AM, if USB is mounted)
# Uncomment the line below if you have an external USB drive
# 0 5 * * 0 [ -d /media/pi/backup ] && ${SCRIPT_DIR}/backup.sh --external-usb >> /home/pi/trading_backups/usb_backup.log 2>&1

EOF

# Install new crontab
crontab "${CRON_FILE}"
rm "${CRON_FILE}"

log_info "Cron jobs installed successfully!"
log_info ""
log_info "Scheduled tasks:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Daily Backup:           2:00 AM every day"
echo "  Weekly Compression:     3:00 AM every Sunday"
echo "  Monthly Log Cleanup:    4:00 AM on 1st of each month"
echo "  External USB Backup:    5:00 AM every Sunday (disabled by default)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info ""
log_info "View cron jobs: crontab -l"
log_info "Remove cron jobs: crontab -r"
log_info "Edit cron jobs: crontab -e"
log_info ""
log_info "Test backup manually: ${SCRIPT_DIR}/backup.sh"
log_info "Check backup logs: tail -f ${BACKUP_DIR}/cron.log"
