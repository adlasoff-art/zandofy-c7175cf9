-- Lot Performance v1 — Index manquants pour réduire le Disk IO
-- Cible: tables avec gros volumes de seq_scan détectés via pg_stat_user_tables.
-- Tous les index utilisent IF NOT EXISTS pour être idempotents et CONCURRENTLY-friendly
-- (Supabase migrations ne supportent pas CONCURRENTLY dans une transaction, on garde simple).

-- === Notifications (n°1 source de Disk IO: 7,5M tuples lus) ===
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON public.notifications(user_id, is_read, created_at DESC);

-- === Produits: images / sizes / colors (lus à chaque ouverture de fiche) ===
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sizes_product_id  ON public.product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_colors_product_id ON public.product_colors(product_id);

-- === Orders (dashboards client + vendor + admin) ===
CREATE INDEX IF NOT EXISTS idx_orders_user_created    ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status    ON public.orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created  ON public.orders(status, created_at DESC);

-- === Messages / cart ===
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

-- === Logistique (préparation montée en charge) ===
CREATE INDEX IF NOT EXISTS idx_forwarder_handoffs_order_id
  ON public.forwarder_handoffs(order_id);
CREATE INDEX IF NOT EXISTS idx_forwarder_handoffs_forwarder_status
  ON public.forwarder_handoffs(forwarder_id, status);
CREATE INDEX IF NOT EXISTS idx_forwarder_handoff_events_handoff_created
  ON public.forwarder_handoff_events(handoff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_order_status
  ON public.freight_quotes(order_id, status);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_user_created
  ON public.freight_quotes(user_id, created_at DESC);

-- === Analytics & error_reports (housekeeping) ===
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON public.analytics_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_reports_status_created
  ON public.error_reports(status, created_at DESC);

-- === Fonctions de housekeeping (purge des données anciennes) ===
-- Purge analytics_events > 90 jours
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.analytics_events
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Purge notifications lues > 60 jours
CREATE OR REPLACE FUNCTION public.cleanup_old_read_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.notifications
  WHERE is_read = true
    AND created_at < now() - interval '60 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Purge error_reports résolus > 30 jours
CREATE OR REPLACE FUNCTION public.cleanup_resolved_error_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.error_reports
  WHERE status = 'resolved'
    AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- === Cron jobs de housekeeping (idempotent) ===
DO $$
DECLARE
  job_id BIGINT;
BEGIN
  -- analytics: tous les jours à 03:30
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'cleanup-analytics-events-daily';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
  PERFORM cron.schedule(
    'cleanup-analytics-events-daily',
    '30 3 * * *',
    $sql$ SELECT public.cleanup_old_analytics_events(); $sql$
  );

  -- notifications: tous les jours à 03:45
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'cleanup-old-notifications-daily';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
  PERFORM cron.schedule(
    'cleanup-old-notifications-daily',
    '45 3 * * *',
    $sql$ SELECT public.cleanup_old_read_notifications(); $sql$
  );

  -- error_reports: tous les jours à 04:00
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'cleanup-resolved-error-reports-daily';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
  PERFORM cron.schedule(
    'cleanup-resolved-error-reports-daily',
    '0 4 * * *',
    $sql$ SELECT public.cleanup_resolved_error_reports(); $sql$
  );
END $$;

-- === ANALYZE pour rafraîchir le planner avec les nouveaux index ===
ANALYZE public.notifications;
ANALYZE public.product_images;
ANALYZE public.product_sizes;
ANALYZE public.product_colors;
ANALYZE public.orders;
ANALYZE public.messages;
ANALYZE public.cart_items;
ANALYZE public.forwarder_handoffs;
ANALYZE public.forwarder_handoff_events;
ANALYZE public.freight_quotes;
ANALYZE public.analytics_events;
ANALYZE public.error_reports;