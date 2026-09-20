-- I9 marketplace additions used by Flutter hide-if-empty sections.
-- Does not drop or replace existing tables, RPCs, or RLS.
-- Rollback:
--   DROP TABLE IF EXISTS public.featured_placement_events;
--   DROP TABLE IF EXISTS public.sample_requests;
--   DROP TABLE IF EXISTS public.sample_offers;
--   DROP TABLE IF EXISTS public.product_rfq_requests;
--   DROP FUNCTION IF EXISTS public.get_customer_order_shortcut_counts(uuid);
--   DELETE FROM public.platform_settings WHERE key IN
--     ('samples_enabled','rfq_enabled','buyer_protection');
--   DELETE FROM public.cms_pages WHERE slug = 'buyer_protection';

CREATE TABLE IF NOT EXISTS public.sample_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  price numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sample_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offer_id uuid REFERENCES public.sample_offers(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_rfq_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.featured_placement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.featured_placements(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('impression', 'click')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sample_offers_active
  ON public.sample_offers (is_active, product_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_user
  ON public.sample_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_user
  ON public.product_rfq_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_product
  ON public.product_rfq_requests (product_id);
CREATE INDEX IF NOT EXISTS idx_placement_events_placement
  ON public.featured_placement_events (placement_id, created_at DESC);

ALTER TABLE public.sample_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_rfq_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_placement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sample_offers_public_read ON public.sample_offers;
CREATE POLICY sample_offers_public_read ON public.sample_offers
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS sample_offers_admin_write ON public.sample_offers;
CREATE POLICY sample_offers_admin_write ON public.sample_offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS sample_requests_own ON public.sample_requests;
CREATE POLICY sample_requests_own ON public.sample_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS sample_requests_insert_own ON public.sample_requests;
CREATE POLICY sample_requests_insert_own ON public.sample_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rfq_own_select ON public.product_rfq_requests;
CREATE POLICY rfq_own_select ON public.product_rfq_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS rfq_own_insert ON public.product_rfq_requests;
CREATE POLICY rfq_own_insert ON public.product_rfq_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS placement_events_insert ON public.featured_placement_events;
CREATE POLICY placement_events_insert ON public.featured_placement_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS placement_events_admin_read ON public.featured_placement_events;
CREATE POLICY placement_events_admin_read ON public.featured_placement_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.platform_settings (key, value)
VALUES
  ('samples_enabled', '{"enabled": false}'::jsonb),
  ('rfq_enabled', '{"enabled": false}'::jsonb),
  (
    'buyer_protection',
    '{"enabled": true, "key": "buyer_protection"}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.cms_pages (slug, title, content, is_published)
SELECT
  'buyer_protection',
  'Protection acheteur',
  'Paiements sécurisés, livraison suivie, retours et litiges gérés par Zandofy.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.cms_pages WHERE slug = 'buyer_protection'
);

CREATE OR REPLACE FUNCTION public.get_customer_order_shortcut_counts(uid uuid)
RETURNS TABLE (
  awaiting_payment integer,
  preparing integer,
  delivered integer,
  returns integer,
  reviews integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE o.status IN ('awaiting_payment', 'payment_failed', 'pending')
    )::integer AS awaiting_payment,
    COUNT(*) FILTER (
      WHERE o.status IN (
        'confirmed', 'processing', 'preparing', 'shipped',
        'ready_for_pickup', 'out_for_delivery', 'arrived_at_hub',
        'at_hub', 'assigning_rider', 'rider_assigned'
      )
    )::integer AS preparing,
    COUNT(*) FILTER (WHERE o.status = 'delivered')::integer AS delivered,
    COUNT(*) FILTER (
      WHERE o.status IN ('returned', 'refunded')
    )::integer AS returns,
    0::integer AS reviews
  FROM public.orders o
  WHERE o.user_id = uid
    AND uid = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_order_shortcut_counts(uuid)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_customer_order_shortcut_counts(uuid)
  FROM anon;
