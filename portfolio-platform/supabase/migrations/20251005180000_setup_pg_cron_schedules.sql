-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on pg_cron schema to authenticated users
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule daily portfolio sync (runs every day at 8:00 AM UTC)
-- This will trigger the daily-portfolio-sync Edge Function
SELECT cron.schedule(
  'daily-portfolio-sync',
  '0 8 * * *', -- Every day at 8:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-portfolio-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule metrics calculation (runs every day at 9:00 AM UTC, after portfolio sync)
SELECT cron.schedule(
  'calculate-metrics',
  '0 9 * * *', -- Every day at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/calculate-metrics',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule benchmark data update (runs every day at 6:00 PM UTC, after market close)
SELECT cron.schedule(
  'update-benchmark-data',
  '0 18 * * *', -- Every day at 6:00 PM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/update-benchmark-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule AI insights generation (runs every Sunday at 10:00 AM UTC)
SELECT cron.schedule(
  'ai-portfolio-insights',
  '0 10 * * 0', -- Every Sunday at 10:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-portfolio-insights',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Create a view to monitor scheduled jobs
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
  'ai-portfolio-insights'
);

-- Grant select on the view to authenticated users
GRANT SELECT ON public.cron_jobs TO authenticated;

COMMENT ON VIEW public.cron_jobs IS 'View of scheduled cron jobs for portfolio automation';
