#!/bin/bash
#
# Pi5 Trading System - Automated Backup Script
#
# This script backs up the PostgreSQL database and audit logs
# Designed for Raspberry Pi 5 with automatic rotation
#
# Usage:
#   ./scripts/backup.sh                    # Run backup with default settings
#   ./scripts/backup.sh --external-usb     # Also copy to external USB drive
#   ./scripts/backup.sh --retention 14     # Keep last 14 days instead of 7
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/home/pi/trading_backups}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7
EXTERNAL_USB=""
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/deployments/docker-compose.pi5-optimized.yml"

# Database configuration (matches docker-compose)
DB_CONTAINER="pi5_trading_db"
DB_USER="pi5trader"
DB_NAME="pi5_trading"
DB_PASSWORD="${DB_PASSWORD:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --external-usb)
            EXTERNAL_USB="/media/pi/backup"
            shift
            ;;
        --retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --external-usb       Copy backups to external USB drive"
            echo "  --retention DAYS     Keep backups for N days (default: 7)"
            echo "  --help               Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

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

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

log_info "Starting backup at $(date)"
log_info "Backup directory: ${BACKUP_DIR}"
log_info "Retention period: ${RETENTION_DAYS} days"

# Check if Docker container is running
if ! docker ps | grep -q "${DB_CONTAINER}"; then
    log_error "Database container '${DB_CONTAINER}' is not running"
    exit 1
fi

# 1. Backup PostgreSQL database
log_info "Backing up PostgreSQL database..."
DB_BACKUP_FILE="${BACKUP_DIR}/db_${DATE}.sql.gz"

docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${DB_BACKUP_FILE}"

if [ -f "${DB_BACKUP_FILE}" ]; then
    DB_SIZE=$(du -h "${DB_BACKUP_FILE}" | cut -f1)
    log_info "Database backup completed: ${DB_BACKUP_FILE} (${DB_SIZE})"
else
    log_error "Database backup failed"
    exit 1
fi

# 2. Backup audit logs (if they exist)
AUDIT_LOG_DIR="${PROJECT_ROOT}/deployments/data"
if [ -d "${AUDIT_LOG_DIR}" ]; then
    log_info "Backing up audit logs..."
    AUDIT_BACKUP_FILE="${BACKUP_DIR}/audit_${DATE}.tar.gz"

    tar -czf "${AUDIT_BACKUP_FILE}" -C "${AUDIT_LOG_DIR}" . 2>/dev/null || true

    if [ -f "${AUDIT_BACKUP_FILE}" ]; then
        AUDIT_SIZE=$(du -h "${AUDIT_BACKUP_FILE}" | cut -f1)
        log_info "Audit logs backup completed: ${AUDIT_BACKUP_FILE} (${AUDIT_SIZE})"
    fi
else
    log_warn "Audit log directory not found: ${AUDIT_LOG_DIR}"
fi

# 3. Backup application logs (last 7 days)
APP_LOG_DIR="${PROJECT_ROOT}/deployments/logs"
if [ -d "${APP_LOG_DIR}" ]; then
    log_info "Backing up application logs..."
    LOGS_BACKUP_FILE="${BACKUP_DIR}/logs_${DATE}.tar.gz"

    # Only backup logs from last 7 days to save space
    find "${APP_LOG_DIR}" -type f -name "*.log" -mtime -7 -print0 | \
        tar -czf "${LOGS_BACKUP_FILE}" --null -T - 2>/dev/null || true

    if [ -f "${LOGS_BACKUP_FILE}" ]; then
        LOGS_SIZE=$(du -h "${LOGS_BACKUP_FILE}" | cut -f1)
        log_info "Application logs backup completed: ${LOGS_BACKUP_FILE} (${LOGS_SIZE})"
    fi
fi

# 4. Create backup metadata
METADATA_FILE="${BACKUP_DIR}/backup_${DATE}.meta"
cat > "${METADATA_FILE}" << EOF
Backup Date: $(date)
Database: ${DB_NAME}
Database Backup: db_${DATE}.sql.gz
Audit Backup: audit_${DATE}.tar.gz
Logs Backup: logs_${DATE}.tar.gz
Hostname: $(hostname)
System: $(uname -a)
EOF

log_info "Backup metadata created: ${METADATA_FILE}"

# 5. Copy to external USB (if specified)
if [ -n "${EXTERNAL_USB}" ]; then
    if [ -d "${EXTERNAL_USB}" ]; then
        log_info "Copying backups to external USB: ${EXTERNAL_USB}"
        mkdir -p "${EXTERNAL_USB}/pi5_trading_backups"

        cp "${DB_BACKUP_FILE}" "${EXTERNAL_USB}/pi5_trading_backups/" || log_warn "Failed to copy database backup to USB"
        [ -f "${AUDIT_BACKUP_FILE}" ] && cp "${AUDIT_BACKUP_FILE}" "${EXTERNAL_USB}/pi5_trading_backups/" || true
        [ -f "${LOGS_BACKUP_FILE}" ] && cp "${LOGS_BACKUP_FILE}" "${EXTERNAL_USB}/pi5_trading_backups/" || true

        log_info "External USB backup completed"
    else
        log_warn "External USB mount point not found: ${EXTERNAL_USB}"
    fi
fi

# 6. Rotate old backups (keep only last N days)
log_info "Rotating old backups (keeping last ${RETENTION_DAYS} days)..."

DELETED_COUNT=0
while IFS= read -r file; do
    rm -f "$file"
    ((DELETED_COUNT++))
done < <(find "${BACKUP_DIR}" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS})

while IFS= read -r file; do
    rm -f "$file"
    ((DELETED_COUNT++))
done < <(find "${BACKUP_DIR}" -name "audit_*.tar.gz" -mtime +${RETENTION_DAYS})

while IFS= read -r file; do
    rm -f "$file"
    ((DELETED_COUNT++))
done < <(find "${BACKUP_DIR}" -name "logs_*.tar.gz" -mtime +${RETENTION_DAYS})

while IFS= read -r file; do
    rm -f "$file"
done < <(find "${BACKUP_DIR}" -name "backup_*.meta" -mtime +${RETENTION_DAYS})

if [ ${DELETED_COUNT} -gt 0 ]; then
    log_info "Deleted ${DELETED_COUNT} old backup files"
fi

# 7. Show backup summary
log_info "Backup summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
du -h "${BACKUP_DIR}" | tail -n1
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh "${BACKUP_DIR}"/*.gz 2>/dev/null | tail -n 5 || echo "No backups found"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log_info "Backup completed successfully at $(date)"
