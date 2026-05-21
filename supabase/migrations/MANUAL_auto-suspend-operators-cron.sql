-- Schedule daily auto-suspension of underperforming delivery operators (Lot 11B Phase 9)
-- IMPORTANT: Replace <ANON_KEY> and <PROJECT_REF> with the target environment's values before applying.
--   - PROD : project ref = vpttoqojmiqxgudknyxf  (https://vpttoqojmiqxgudknyxf.supabase.co)
--   - STAGING : project ref = wgidwyrdnboivfphwete (https://wgidwyrdnboivfphwete.supabase.co)
-- Run manually in the Supabase SQL Editor of the target project.
--
-- Effet : tous les jours à 03:15 UTC, l'edge function `auto-suspend-underperforming-operators`
-- est appelée. Elle :
--   1. Recalcule les scores de fiabilité de tous les opérateurs approuvés.
--   2. Suspend automatiquement (is_active=false, status=suspended) ceux qui dépassent
--      les seuils définis dans `delivery_operator_thresholds` (si auto_suspend_enabled = true).
--   3. Notifie admins/managers (in-app) + owner opérateur (in-app + email).

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous scheduling (idempotent)
DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'auto-suspend-operators-daily';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- Schedule: every day at 03:15 UTC (heure creuse)
SELECT cron.schedule(
  'auto-suspend-operators-daily',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/auto-suspend-underperforming-operators',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Vérifications utiles :
-- 1) Le job est bien planifié
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'auto-suspend-operators-daily';
--
-- 2) Historique des exécutions récentes
-- SELECT jobid, status, return_message, start_time, end_time
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-suspend-operators-daily')
-- ORDER BY start_time DESC LIMIT 10;
--
-- 3) Pour déclencher manuellement (test immédiat) :
-- SELECT net.http_post(
--   url := 'https://<PROJECT_REF>.supabase.co/functions/v1/auto-suspend-underperforming-operators',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
--   body := '{}'::jsonb
-- );
--
-- 4) Pour désactiver temporairement le job sans le supprimer :
-- UPDATE cron.job SET active = false WHERE jobname = 'auto-suspend-operators-daily';
-- UPDATE cron.job SET active = true  WHERE jobname = 'auto-suspend-operators-daily';