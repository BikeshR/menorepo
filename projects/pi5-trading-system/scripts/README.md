# Database and Maintenance Scripts

This directory contains database management, backup, and maintenance scripts for the Pi5 Trading System.

## Quick Start

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Set up automated backups (run as pi user)
./scripts/setup_cron.sh

# 3. Enable database compression (after 1 day of running)
docker exec -i pi5_trading_db psql -U pi5trader -d pi5_trading < scripts/enable_compression.sql

# 4. Test manual backup
./scripts/backup.sh
```

---

## Backup Scripts

## TimescaleDB Compression

### enable_compression.sql

Enables TimescaleDB compression on time-series tables to save ~90% disk space.

**Usage:**

```bash
# Connect to your database and run the script
docker exec -i pi5_trading_db psql -U pi5trader -d pi5_trading < scripts/enable_compression.sql
```

**When to run:**
- After the trading system has been running for at least 1 day
- Run manually or add to a weekly cron job

**What it does:**
1. Enables compression on `market_data` table (compresses data older than 1 day)
2. Optionally enables compression on `orders`, `trades`, and `audit_events` (if they're hypertables)
3. Shows compression statistics

**Expected results:**
- **market_data**: ~90% compression ratio (e.g., 100MB → 10MB)
- **trades/orders**: ~80-85% compression ratio
- **audit_events**: ~85-90% compression ratio

### Compression Settings Explained

```sql
timescaledb.compress_segmentby = 'symbol'
```
- Groups data by symbol before compression
- Better compression and faster queries by symbol

```sql
timescaledb.compress_orderby = 'timestamp DESC'
```
- Orders data by timestamp (newest first) within each segment
- Optimizes for time-based queries

### Monitoring Compression

```bash
# Check compression status
docker exec -it pi5_trading_db psql -U pi5trader -d pi5_trading -c "
SELECT
    hypertable_name,
    number_compressed_chunks,
    before_compression_total_bytes / (1024*1024) AS before_mb,
    after_compression_total_bytes / (1024*1024) AS after_mb,
    ROUND(100 - (after_compression_total_bytes::float / before_compression_total_bytes::float * 100), 2) AS compression_percent
FROM
    timescaledb_information.compressed_hypertable_stats;
"
```

### Manual Compression (Advanced)

To compress data immediately without waiting for the policy:

```bash
docker exec -it pi5_trading_db psql -U pi5trader -d pi5_trading -c "
SELECT compress_chunk(i, if_not_compressed => true)
FROM show_chunks('market_data', older_than => INTERVAL '1 day') i;
"
```

## Troubleshooting

**Error: table is not a hypertable**
- Only hypertables support compression
- Check if your table is a hypertable: `SELECT * FROM timescaledb_information.hypertables;`

**Compression not showing results**
- Wait at least 1 day after running the script
- Compression policies run in the background (typically hourly)
- Run manual compression if you need immediate results

**Low compression ratio**
- Check if data has high cardinality (many unique values)
- Consider adjusting `compress_segmentby` fields
- Market data typically compresses very well (90%+)

## Pi5 Optimization Tips

1. **Enable compression ASAP**: Disk I/O is the bottleneck on Pi5
2. **Use NVMe SSD**: 10-20x faster than microSD
3. **Monitor disk usage**: `df -h` and `docker system df`
4. **Set retention policies**: Drop old compressed chunks you don't need
5. **Compression is automatic**: Once enabled, it runs in the background

## Disk Space Estimates (with compression)

| Data Type | Daily Growth (Raw) | Daily Growth (Compressed) | Annual Total |
|-----------|-------------------|---------------------------|--------------|
| Market data (1-min candles, 3 symbols) | 5MB | 500KB | 180MB |
| Orders & trades (100/day) | 1MB | 100KB | 36MB |
| Audit logs | 500KB | 50KB | 18MB |
| **Total** | **6.5MB/day** | **650KB/day** | **234MB/year** |

**A 256GB NVMe SSD can store 1000+ years of trading data with compression!**

---

## Backup and Restore

### backup.sh

Automated backup script for PostgreSQL database, audit logs, and application logs.

**Usage:**

```bash
# Run manual backup
./scripts/backup.sh

# Backup with external USB drive
./scripts/backup.sh --external-usb

# Keep last 14 days instead of default 7
./scripts/backup.sh --retention 14
```

**What it backs up:**
1. PostgreSQL database (compressed)
2. Audit logs (tar.gz)
3. Application logs (last 7 days)
4. Backup metadata

**Default settings:**
- Backup location: `/home/pi/trading_backups`
- Retention: 7 days (automatic rotation)
- External USB: `/media/pi/backup` (optional)

**Backup sizes (typical):**
- Database: 5-50MB (depending on history)
- Audit logs: 1-5MB
- Application logs: 1-10MB
- **Total per backup: 7-65MB**

With 7-day retention: **~50-450MB total backup storage**

### restore.sh

Restore database from a backup file.

**Usage:**

```bash
# List available backups
ls -lh /home/pi/trading_backups/db_*.sql.gz

# Restore from specific backup
./scripts/restore.sh /home/pi/trading_backups/db_20250107_020000.sql.gz
```

**What it does:**
1. Creates a pre-restore backup (safety)
2. Drops and recreates the database
3. Restores data from the backup file
4. Saves pre-restore backup to /tmp (in case you need to roll back)

**Warning:** This will REPLACE all current data. Confirm before proceeding.

### setup_cron.sh

Installs cron jobs for automated backups and maintenance.

**Usage:**

```bash
# Run as pi user (not root)
./scripts/setup_cron.sh

# Or with sudo
sudo -u pi ./scripts/setup_cron.sh
```

**What it installs:**
1. **Daily backup** at 2:00 AM
2. **Weekly compression** at 3:00 AM (Sundays)
3. **Monthly log cleanup** at 4:00 AM (1st of month)
4. **External USB backup** at 5:00 AM (Sundays, disabled by default)

**Managing cron jobs:**

```bash
# View installed cron jobs
crontab -l

# Edit cron jobs manually
crontab -e

# Remove all cron jobs (careful!)
crontab -r

# View backup logs
tail -f /home/pi/trading_backups/cron.log

# View compression logs
tail -f /home/pi/trading_backups/compression.log
```

## External USB Backup (Recommended)

For extra safety, configure external USB backups:

1. **Plug in USB drive** to your Pi5
2. **Find mount point:**
   ```bash
   lsblk
   # Usually: /media/pi/<drive-name>
   ```
3. **Edit cron job:**
   ```bash
   crontab -e
   # Uncomment the USB backup line
   # Change /media/pi/backup to your actual mount point
   ```
4. **Test it:**
   ```bash
   ./scripts/backup.sh --external-usb
   ```

**USB Backup Tips:**
- Use a reliable USB 3.0 drive (NOT cheap USB sticks)
- Format as ext4 for best Pi5 compatibility
- Label the drive clearly: "Pi5 Trading Backups"
- Test restoring from USB periodically

## Disaster Recovery

### Scenario 1: SD card corruption

1. **Flash new SD card** with Raspberry Pi OS
2. **Install Docker** and clone your repo
3. **Copy latest backup** from external USB to Pi5
4. **Restore database:**
   ```bash
   ./scripts/restore.sh /path/to/backup/db_YYYYMMDD_HHMMSS.sql.gz
   ```
5. **Start services:**
   ```bash
   cd deployments
   docker-compose -f docker-compose.pi5-optimized.yml up -d
   ```

### Scenario 2: Accidental data deletion

1. **Stop the trading system** immediately
2. **Find latest backup:**
   ```bash
   ls -lht /home/pi/trading_backups/db_*.sql.gz | head -1
   ```
3. **Restore:**
   ```bash
   ./scripts/restore.sh <backup_file>
   ```

### Scenario 3: Hardware failure

1. **Get a new Pi5**
2. **Attach your NVMe SSD** (data is on NVMe, not SD card!)
3. **Boot from SD card** and mount NVMe
4. **Access backups** on NVMe or external USB
5. **Follow Scenario 1 steps**

**Key principle:** Your data lives in 3 places:
- NVMe SSD (primary)
- Local backups on Pi5 (/home/pi/trading_backups)
- External USB (off-site backup)

## Testing Your Backups

**Test your backups regularly!** A backup you haven't tested is not a backup.

```bash
# 1. Create a test backup
./scripts/backup.sh

# 2. Check backup file
gunzip -c /home/pi/trading_backups/db_LATEST.sql.gz | head -50

# 3. Verify backup size is reasonable
du -h /home/pi/trading_backups/db_*.sql.gz | tail -1

# 4. Full restore test (on test system, not production!)
# ./scripts/restore.sh /path/to/backup.sql.gz
```

## Troubleshooting Backups

**Backup failed with "container not running"**
- Check if Docker is running: `docker ps`
- Start containers: `docker-compose up -d`

**Backup file is 0 bytes or empty**
- Check database password in .env file
- Check Docker container logs: `docker logs pi5_trading_db`

**No space left on device**
- Check disk space: `df -h`
- Run backup with shorter retention: `./scripts/backup.sh --retention 3`
- Move old backups to external USB
- Enable compression (see above)

**Cron job not running**
- Check cron is enabled: `sudo systemctl status cron`
- Check logs: `tail /home/pi/trading_backups/cron.log`
- Verify crontab: `crontab -l`
- Test script manually: `./scripts/backup.sh`

**Restore failed**
- Check backup file is not corrupted: `gunzip -t backup.sql.gz`
- Ensure database container is running
- Check Docker logs: `docker logs pi5_trading_db`

## Best Practices

1. ✅ **Test backups monthly** - Do a full restore on a test system
2. ✅ **Monitor backup logs** - Check for errors weekly
3. ✅ **Use external USB** - Off-site backup is critical
4. ✅ **Document your setup** - Write down mount points, passwords
5. ✅ **Verify backup size** - Should be consistent day-to-day
6. ✅ **Enable compression** - Saves 90% disk space
7. ✅ **Keep multiple copies** - 3-2-1 rule (3 copies, 2 media types, 1 off-site)
