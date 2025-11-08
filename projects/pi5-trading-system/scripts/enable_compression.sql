-- TimescaleDB Compression Policies for Pi5 Trading System
-- This script enables compression on time-series tables to save ~90% disk space
-- Run this after the trading system has been running for at least 1 day

-- Enable compression on market_data table (compress data older than 1 day)
ALTER TABLE market_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('market_data', INTERVAL '1 day');

-- Enable compression on orders table (compress data older than 7 days)
-- Note: Only if orders table is a hypertable
-- Uncomment if orders is converted to hypertable:
-- ALTER TABLE orders SET (
--     timescaledb.compress,
--     timescaledb.compress_segmentby = 'status',
--     timescaledb.compress_orderby = 'created_at DESC'
-- );
-- SELECT add_compression_policy('orders', INTERVAL '7 days');

-- Enable compression on trades table (compress data older than 7 days)
-- Note: Only if trades table is a hypertable
-- Uncomment if trades is converted to hypertable:
-- ALTER TABLE trades SET (
--     timescaledb.compress,
--     timescaledb.compress_segmentby = 'symbol',
--     timescaledb.compress_orderby = 'executed_at DESC'
-- );
-- SELECT add_compression_policy('trades', INTERVAL '7 days');

-- Enable compression on audit_events table (compress data older than 14 days)
-- Note: Only if audit_events table is a hypertable
-- Uncomment if audit_events is converted to hypertable:
-- ALTER TABLE audit_events SET (
--     timescaledb.compress,
--     timescaledb.compress_segmentby = 'event_type,user_id',
--     timescaledb.compress_orderby = 'timestamp DESC'
-- );
-- SELECT add_compression_policy('audit_events', INTERVAL '14 days');

-- View compression status
SELECT
    hypertable_name,
    total_chunks,
    number_compressed_chunks,
    before_compression_total_bytes / (1024*1024) AS before_mb,
    after_compression_total_bytes / (1024*1024) AS after_mb,
    ROUND(100 - (after_compression_total_bytes::float / before_compression_total_bytes::float * 100), 2) AS compression_ratio_percent
FROM
    timescaledb_information.compressed_hypertable_stats
ORDER BY
    hypertable_name;

-- View compression policy details
SELECT
    hypertable_name,
    older_than,
    interval_length
FROM
    timescaledb_information.compression_settings
ORDER BY
    hypertable_name;

-- Manual compression (if you want to compress immediately without waiting)
-- SELECT compress_chunk(i, if_not_compressed => true)
-- FROM show_chunks('market_data', older_than => INTERVAL '1 day') i;
