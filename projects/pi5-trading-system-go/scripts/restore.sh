#!/bin/bash
#
# Pi5 Trading System - Restore Script
#
# This script restores the PostgreSQL database from a backup
#
# Usage:
#   ./scripts/restore.sh <backup_file.sql.gz>
#   ./scripts/restore.sh /home/pi/trading_backups/db_20250107_020000.sql.gz
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
DB_CONTAINER="pi5_trading_db"
DB_USER="pi5trader"
DB_NAME="pi5_trading"

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

# Check arguments
if [ $# -eq 0 ]; then
    log_error "No backup file specified"
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh /home/pi/trading_backups/db_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    log_error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Check if Docker container is running
if ! docker ps | grep -q "${DB_CONTAINER}"; then
    log_error "Database container '${DB_CONTAINER}' is not running"
    exit 1
fi

# Confirm restore
log_warn "This will restore the database from: ${BACKUP_FILE}"
log_warn "All current data will be REPLACED!"
read -p "Are you sure you want to continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Restore cancelled"
    exit 0
fi

# Create a pre-restore backup (just in case)
PRE_RESTORE_BACKUP="/tmp/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
log_info "Creating pre-restore backup: ${PRE_RESTORE_BACKUP}"
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${PRE_RESTORE_BACKUP}"
log_info "Pre-restore backup saved: ${PRE_RESTORE_BACKUP}"

# Drop and recreate database
log_info "Dropping and recreating database..."
docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"

# Restore from backup
log_info "Restoring database from backup..."
gunzip -c "${BACKUP_FILE}" | docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"

log_info "Database restore completed successfully!"
log_info ""
log_info "Pre-restore backup saved at: ${PRE_RESTORE_BACKUP}"
log_info "You can delete it if everything looks good"
