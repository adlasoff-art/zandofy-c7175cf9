-- =====================================================================
-- Performance : indexes ciblés pour réduire le Disk IO sur les tables hot
-- =====================================================================
-- Contexte : alerte Supabase "Disk IO budget" sur staging (vpt…yxf).
-- Objectif : couvrir les requêtes les plus fréquentes côté frontend
--   (polling messages, notifications, orders, tracking) afin d'éviter
--   les seq scans répétés.
--
-- Procédure :
--   1. Appliquer manuellement via le SQL Editor sur STAGING d'abord.
--   2. Observer 24 h le Disk IO budget + le script d'audit.
--   3. Rejouer EXACTEMENT le même fichier sur PRODUCTION (vpt…yxf).
--   Voir mem://architecture/rls-staging-prod-divergence : on rejoue
--   systématiquement les migrations sur staging ET prod.
--
-- Notes :
--   - Pas de CREATE INDEX CONCURRENTLY (interdit dans une migration
--     transactionnelle Supabase).
--   - IF NOT EXISTS : le script est idempotent et sans effet si les
--     indexes existent déjà (ex. créés par le Lot 17).
-- =====================================================================

-- Messages : poll incrémental "WHERE conversation_id = ? AND created_at > ?"
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at DESC);

-- Notifications : poll par user "WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Notifications : "WHERE user_id = ? AND is_read = false" (badge non-lu)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id)
  WHERE is_read = false;

-- Orders : "WHERE created_at > cursor ORDER BY created_at" (alerte admin/manager)
CREATE INDEX IF NOT EXISTS idx_orders_created
  ON public.orders (created_at DESC);

-- Orders : "WHERE store_id IN (...) AND created_at > cursor" (alerte vendeur)
CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON public.orders (store_id, created_at DESC);

-- Orders : lookup par référence pour CustomerOrderTracker
CREATE INDEX IF NOT EXISTS idx_orders_order_ref
  ON public.orders (order_ref);

-- Delivery chats : poll par order_id ordonné par created_at
CREATE INDEX IF NOT EXISTS idx_delivery_chats_order_created
  ON public.delivery_chats (order_id, created_at);

-- =====================================================================
-- Vérification post-migration (à lancer 24 h après) :
--
-- SELECT relname, idx_scan, seq_scan, n_live_tup
-- FROM pg_stat_user_tables
-- WHERE relname IN ('messages','notifications','orders','delivery_chats')
-- ORDER BY relname;
--
-- SELECT indexrelname, idx_scan
-- FROM pg_stat_user_indexes
-- WHERE indexrelname LIKE 'idx_%'
--   AND schemaname = 'public'
-- ORDER BY idx_scan DESC;
-- =====================================================================