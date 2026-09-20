-- =============================================================================
-- INCIDENT 503 / homepage skeleton — CORRECTIF IMMÉDIAT (PROD)
-- Projet : vpttoqojmiqxgudknyxf (production)
-- Date incident : 2026-09-02 ~10:29–10:31 UTC
--
-- Symptômes logs :
--   - GET /rest/v1/categories, cms_banners, products_public, platform_settings → 503
--   - POST /auth/v1/token?grant_type=refresh_token → 504
--   - Postgres 57014 : canceling statement due to statement timeout
--   - cron job N : job startup timeout
--   - checkpoint ~68s
--
-- USAGE : coller CHAQUE PHASE séparément dans Supabase SQL Editor → PROD.
-- Ne pas tout coller d'un coup. Lire le résultat avant la phase suivante.
--
-- Risque (~4000+ users) : kill de requêtes / pause crons = interruption courte
-- des jobs background (expiration commandes, automation). Le site vitrine
-- doit remonter. Aucun DROP / TRUNCATE / DELETE massif ici.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PHASE A — DIAGNOSTIC (read-only) — exécuter en premier
-- ---------------------------------------------------------------------------

-- A1. Connexions / saturation
SELECT
  count(*) AS total_backends,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
  count(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting
FROM pg_stat_activity
WHERE datname = current_database();

-- A2. Requêtes longues (> 5s) — candidats kill
SELECT
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  now() - query_start AS duration,
  left(query, 240) AS query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state <> 'idle'
  AND query_start < now() - interval '5 seconds'
ORDER BY query_start ASC
LIMIT 40;

-- A3. Crons enregistrés (noms + schedule + active)
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobid;

-- A4. Dernières exécutions cron en échec / timeout
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE start_time > now() - interval '2 hours'
ORDER BY start_time DESC
LIMIT 50;

-- A5. Verrous bloquants (si présents)
SELECT
  blocked.pid AS blocked_pid,
  left(blocked.query, 120) AS blocked_query,
  blocking.pid AS blocking_pid,
  left(blocking.query, 120) AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks kl ON kl.locktype = bl.locktype
  AND kl.database IS NOT DISTINCT FROM bl.database
  AND kl.relation IS NOT DISTINCT FROM bl.relation
  AND kl.page IS NOT DISTINCT FROM bl.page
  AND kl.tuple IS NOT DISTINCT FROM bl.tuple
  AND kl.virtualxid IS NOT DISTINCT FROM bl.virtualxid
  AND kl.transactionid IS NOT DISTINCT FROM bl.transactionid
  AND kl.classid IS NOT DISTINCT FROM bl.classid
  AND kl.objid IS NOT DISTINCT FROM bl.objid
  AND kl.objsubid IS NOT DISTINCT FROM bl.objsubid
  AND kl.granted
JOIN pg_stat_activity blocking ON blocking.pid = kl.pid
WHERE blocked.datname = current_database();

-- ---------------------------------------------------------------------------
-- PHASE B — SOULAGER (écrire) — uniquement si A montre des requêtes > 30s
-- ou idle in transaction > 60s
-- ---------------------------------------------------------------------------

-- B1. Lister les PID à tuer (contrôle humain) — copier les pid de A2
-- SELECT pg_terminate_backend(<pid>);

-- B2. Kill automatique des backends actifs > 60s (hors replication / autovacuum)
-- DÉCOMMENTER seulement si A2 confirme une avalanche de requêtes bloquées :
/*
SELECT pid, now() - query_start AS duration, left(query, 100)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'active'
  AND query_start < now() - interval '60 seconds'
  AND usename NOT IN ('supabase_admin', 'supabase_replication_admin')
  AND query NOT ILIKE '%autovacuum%';
*/

-- B3. Terminate réellement (décommenter après revue B2) :
/*
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'active'
  AND query_start < now() - interval '60 seconds'
  AND usename NOT IN ('supabase_admin', 'supabase_replication_admin')
  AND query NOT ILIKE '%autovacuum%';
*/

-- B4. Idle in transaction > 2 min (souvent bloquent les locks)
/*
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'idle in transaction'
  AND state_change < now() - interval '2 minutes';
*/

-- ---------------------------------------------------------------------------
-- PHASE C — PAUSE CRONS (écriture légère) — immédiat pour stopper le storm
-- Les logs montraient « cron job 1 job startup timeout » en boucle.
-- ---------------------------------------------------------------------------

-- C1. Snapshot avant pause (garder le résultat)
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

-- C2. Pause TOUS les jobs pg_cron (réversible)
UPDATE cron.job SET active = false;

-- C3. Vérifier
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

-- ---------------------------------------------------------------------------
-- PHASE D — VÉRIFICATION API (après 30–60 s)
-- ---------------------------------------------------------------------------

-- D1. Requêtes homepage critiques (doivent répondre vite < 2s)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, name_fr, icon, image_url, parent_id
FROM public.categories
WHERE parent_id IS NULL
ORDER BY sort_order, name_fr
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, subtitle, cta, image_url, link
FROM public.cms_banners
WHERE position = 'hero_slide' AND is_active = true
ORDER BY sort_order
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, slug, name_fr, price
FROM public.products_public
ORDER BY created_at DESC
LIMIT 24;

-- D2. Connexions après soulagement
SELECT
  count(*) AS total_backends,
  count(*) FILTER (WHERE state = 'active') AS active
FROM pg_stat_activity
WHERE datname = current_database();

-- ---------------------------------------------------------------------------
-- PHASE E — RÉACTIVER CRONS (sélectif) — seulement après homepage OK
-- Ne pas tout réactiver d'un coup si un job minute était le coupable.
-- ---------------------------------------------------------------------------

-- E1. Voir les schedules (repérer * * * * * = chaque minute)
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY schedule, jobid;

-- E2. Réactiver d’abord les crons QUOTIDIENS / HORAIRES (pas les * * * * *)
/*
UPDATE cron.job
SET active = true
WHERE schedule NOT LIKE '%*%'
   OR schedule IN (
     '0 * * * *',
     '5 * * * *',
     '30 3 * * *',
     '45 3 * * *',
     '0 4 * * *',
     '15 3 * * *'
   );
*/

-- E3. Jobs * * * * * (chaque minute) : laisser OFF jusqu’à audit,
--    ou passer à toutes les 5–15 minutes :
/*
-- Exemple : désactiver expire-pending trop agressif
UPDATE cron.job SET active = false
WHERE jobname ILIKE '%expire%pending%'
   OR schedule = '* * * * *';
*/

-- E4. Si un job pointe encore vers un mauvais projet (staging URL dans prod) :
SELECT jobid, jobname, left(command, 200)
FROM cron.job
WHERE command ILIKE '%wgidwyrdnboivfphwete%'
   OR command ILIKE '%uogkklwfvwoxkifpkzpu%';
-- Prod attendue : vpttoqojmiqxgudknyxf
-- Si URL staging/autre projet → corriger manuellement (ne pas laisser tourner).

-- ---------------------------------------------------------------------------
-- PHASE F — OPTIONNEL : réduire pression analytics (si table énorme)
-- Ne PAS faire un DELETE massif unique (timeout). Batch seulement si besoin.
-- ---------------------------------------------------------------------------

-- F1. Taille approx
SELECT
  relname,
  pg_size_pretty(pg_total_relation_size(oid)) AS total_size,
  n_live_tup,
  n_dead_tup
FROM pg_stat_user_tables
WHERE relname IN ('analytics_events', 'notifications', 'error_reports', 'products', 'orders')
ORDER BY pg_total_relation_size(oid) DESC;

-- F2. Batch cleanup analytics (90j+) — 10k lignes max, répéter si besoin
/*
WITH doomed AS (
  SELECT ctid FROM public.analytics_events
  WHERE created_at < now() - interval '90 days'
  LIMIT 10000
)
DELETE FROM public.analytics_events a
USING doomed d
WHERE a.ctid = d.ctid;
*/
