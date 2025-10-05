-- Add additional cron schedules for new Edge Functions

-- Schedule price alerts check (runs every hour during trading hours: 9 AM - 5 PM UTC)
SELECT cron.schedule(
  'check-price-alerts',
  '0 9-17 * * *', -- Every hour from 9 AM to 5 PM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/check-price-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule milestone check (runs daily at 10:00 AM UTC, after metrics calculation)
SELECT cron.schedule(
  'check-milestones',
  '0 10 * * *', -- Every day at 10:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/check-milestones',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule anomaly detection (runs every 4 hours during trading hours)
SELECT cron.schedule(
  'detect-anomalies',
  '0 */4 * * *', -- Every 4 hours
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/detect-anomalies',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Update the cron_jobs view to include new jobs
CREATE OR REPLACE VIEW public.cron_jobs AS
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname IN (
  'daily-portfolio-sync',
  'calculate-metrics',
  'update-benchmark-data',
  'ai-portfolio-insights',
  'check-price-alerts',
  'check-milestones',
  'detect-anomalies'
);

COMMENT ON VIEW public.cron_jobs IS 'View of all scheduled cron jobs for portfolio automation and monitoring';
