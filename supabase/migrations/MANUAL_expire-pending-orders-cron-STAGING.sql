-- Schedule per-minute expiration of stuck "awaiting_payment" orders (STAGING)
-- IMPORTANT: Replace <STAGING_ANON_KEY> with the staging project's actual anon key before applying.
-- Run manually in the Supabase STAGING SQL Editor (project: wgidwyrdnboivfphwete).

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous scheduling (idempotent)
DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'expire-pending-orders-every-min-staging';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- Schedule: every minute
SELECT cron.schedule(
  'expire-pending-orders-every-min-staging',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wgidwyrdnboivfphwete.supabase.co/functions/v1/expire-pending-orders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <STAGING_ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verify:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'expire-pending-orders-every-min-staging';
