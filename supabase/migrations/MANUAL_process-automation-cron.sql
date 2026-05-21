-- Schedule hourly automation workflow processor
-- IMPORTANT: Replace <ANON_KEY> with the project's actual anon key before applying.
-- This migration is meant to be run manually in the Supabase SQL Editor (prod)
-- because the anon key differs per environment.

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous scheduling (idempotent)
DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'process-automation-workflows-hourly';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- Schedule: every hour at minute 0
SELECT cron.schedule(
  'process-automation-workflows-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vpttoqojmiqxgudknyxf.supabase.co/functions/v1/process-automation-workflows',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
