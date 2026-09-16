-- Purpose: Forwarder TMS MVP — external shipments (off-marketplace) + public token tracking + SaaS seed.
-- Tables: public.external_shipments
-- Functions: public.get_external_shipment_by_token
-- Settings: platform_settings.forwarder_saas
-- Rollback: DROP FUNCTION get_external_shipment_by_token; DROP TABLE external_shipments (only if unused)
-- Risk (~4000+ users): Additive only; no change to orders/wallet/vendor monetization.

-- ---------------------------------------------------------------------------
-- 1) Monetization seed (admin-editable later)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'forwarder_saas',
  jsonb_build_object(
    'annual_price_usd', 299,
    'zandofy_freight_discount_pct', 10,
    'public_tracking_enabled', true,
    'notes', 'SaaS annuel vs remise fret sur commandes Zandofy (partenariat)'
  ),
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.platform_settings.value, '{}'::jsonb) || EXCLUDED.value,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) external_shipments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id uuid NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  public_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  awb_bl text,
  mode text NOT NULL DEFAULT 'air'
    CHECK (mode IN ('air', 'sea', 'road', 'rail', 'multimodal')),
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created', 'booked', 'in_transit', 'customs', 'arrived', 'out_for_delivery', 'delivered', 'cancelled'
    )),
  origin text,
  destination text,
  consignee_name text,
  consignee_phone text,
  consignee_email text,
  eta date,
  notes text,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_shipments_forwarder
  ON public.external_shipments (forwarder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_shipments_token
  ON public.external_shipments (public_token);

COMMENT ON TABLE public.external_shipments IS
  'Off-marketplace shipments managed by forwarders; public tracking via public_token.';

ALTER TABLE public.external_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "external_shipments_select_owner" ON public.external_shipments;
CREATE POLICY "external_shipments_select_owner"
  ON public.external_shipments FOR SELECT TO authenticated
  USING (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "external_shipments_insert_owner" ON public.external_shipments;
CREATE POLICY "external_shipments_insert_owner"
  ON public.external_shipments FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "external_shipments_update_owner" ON public.external_shipments;
CREATE POLICY "external_shipments_update_owner"
  ON public.external_shipments FOR UPDATE TO authenticated
  USING (public.user_owns_forwarder(forwarder_id, auth.uid()))
  WITH CHECK (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "external_shipments_delete_owner" ON public.external_shipments;
CREATE POLICY "external_shipments_delete_owner"
  ON public.external_shipments FOR DELETE TO authenticated
  USING (public.user_owns_forwarder(forwarder_id, auth.uid()));

-- Admin bypass (staff)
DROP POLICY IF EXISTS "external_shipments_admin_all" ON public.external_shipments;
CREATE POLICY "external_shipments_admin_all"
  ON public.external_shipments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  );

-- updated_at touch
CREATE OR REPLACE FUNCTION public.touch_external_shipments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_external_shipments_updated_at ON public.external_shipments;
CREATE TRIGGER trg_external_shipments_updated_at
  BEFORE UPDATE ON public.external_shipments
  FOR EACH ROW EXECUTE FUNCTION public.touch_external_shipments_updated_at();

-- ---------------------------------------------------------------------------
-- 3) Public read-by-token (no auth) — returns safe fields only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_external_shipment_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.external_shipments%ROWTYPE;
  v_fw_name text;
  v_enabled boolean;
  v_safe_events jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN NULL;
  END IF;

  -- Kill switch from platform_settings.forwarder_saas.public_tracking_enabled
  SELECT COALESCE((ps.value->>'public_tracking_enabled')::boolean, true)
    INTO v_enabled
    FROM public.platform_settings ps
   WHERE ps.key = 'forwarder_saas';

  IF v_enabled IS FALSE THEN
    RETURN jsonb_build_object('disabled', true);
  END IF;

  SELECT * INTO v_row
  FROM public.external_shipments
  WHERE public_token = trim(p_token);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT f.name INTO v_fw_name
  FROM public.forwarders f
  WHERE f.id = v_row.forwarder_id;

  -- Sanitize events: only at / status / label (no free-form notes that could hold PII)
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'at', e->>'at',
               'status', e->>'status',
               'label', e->>'label'
             )
             ORDER BY COALESCE(e->>'at', '')
           ),
           '[]'::jsonb
         )
    INTO v_safe_events
    FROM jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(v_row.events) = 'array' THEN v_row.events
             ELSE '[]'::jsonb
           END
         ) AS e;

  RETURN jsonb_build_object(
    'awb_bl', v_row.awb_bl,
    'mode', v_row.mode,
    'status', v_row.status,
    'origin', v_row.origin,
    'destination', v_row.destination,
    'eta', v_row.eta,
    'events', v_safe_events,
    'updated_at', v_row.updated_at,
    'forwarder_name', v_fw_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_external_shipment_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_external_shipment_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_external_shipment_by_token(text)
  IS 'Public tracking for external_shipments by opaque token; respects forwarder_saas.public_tracking_enabled; no consignee PII.';
