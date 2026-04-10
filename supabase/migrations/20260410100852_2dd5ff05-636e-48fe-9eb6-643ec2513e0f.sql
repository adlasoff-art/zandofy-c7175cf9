
-- =============================================================
-- LOT 1 — HARDENING FINAL : Failles 1, 3, 4, 5, 6
-- =============================================================

-- ─── FAILLE 1 : Retirer TOUTES les tables restantes du Realtime ───
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shipments'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.shipments;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_status_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.order_status_history;
  END IF;
END $$;

-- ─── FAILLE 3 : Restreindre INSERT sur order_status_history ───
-- Le trigger log_order_status_change() est SECURITY DEFINER → contourne RLS
-- Cette politique empêche uniquement les insertions manuelles arbitraires

DROP POLICY IF EXISTS "Restricted insert order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Authenticated insert order history" ON public.order_status_history;

CREATE POLICY "Restricted insert order history"
  ON public.order_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins / Managers
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    -- Store team (owner or collaborator)
    OR order_id IN (
      SELECT id FROM public.orders
      WHERE public.can_access_store_orders(auth.uid(), store_id)
    )
    -- Order owner (customer)
    OR order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- ─── FAILLE 5 : Vue saved_cards_safe (sans card_token) ───

CREATE OR REPLACE VIEW public.saved_cards_safe
WITH (security_invoker = on)
AS
SELECT
  id, user_id, provider, last_four, card_brand,
  expiry_month, expiry_year, is_default, label,
  created_at, updated_at
FROM public.saved_cards;

-- ─── FAILLE 6 : Retirer l'accès KYC aux managers ───

DROP POLICY IF EXISTS "Managers read all KYC" ON public.kyc_verifications;
DROP POLICY IF EXISTS "Managers update KYC" ON public.kyc_verifications;

-- Retirer l'accès storage KYC aux managers
DROP POLICY IF EXISTS "Managers read all KYC docs" ON storage.objects;
