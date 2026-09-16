-- Purpose: Vague 2 TMS — consignees carnet, photo storage, WA templates on forwarders.
-- Tables: public.forwarder_consignees (new); forwarders.wa_templates; storage bucket
-- Alters: external_shipments.consignee_id FK; get_external_shipment_by_token photo URLs public-safe
-- Risk: Additive RLS tables + storage; no orders/checkout change.

-- ---------------------------------------------------------------------------
-- 1) Consignees carnet
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forwarder_consignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id uuid NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address_line text,
  country_code text,
  city text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forwarder_consignees_fw_name
  ON public.forwarder_consignees (forwarder_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_forwarder_consignees_phone
  ON public.forwarder_consignees (forwarder_id, phone);

ALTER TABLE public.forwarder_consignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forwarder_consignees_select_owner" ON public.forwarder_consignees;
CREATE POLICY "forwarder_consignees_select_owner"
  ON public.forwarder_consignees FOR SELECT TO authenticated
  USING (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "forwarder_consignees_insert_owner" ON public.forwarder_consignees;
CREATE POLICY "forwarder_consignees_insert_owner"
  ON public.forwarder_consignees FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "forwarder_consignees_update_owner" ON public.forwarder_consignees;
CREATE POLICY "forwarder_consignees_update_owner"
  ON public.forwarder_consignees FOR UPDATE TO authenticated
  USING (public.user_owns_forwarder(forwarder_id, auth.uid()))
  WITH CHECK (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "forwarder_consignees_delete_owner" ON public.forwarder_consignees;
CREATE POLICY "forwarder_consignees_delete_owner"
  ON public.forwarder_consignees FOR DELETE TO authenticated
  USING (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "forwarder_consignees_admin_all" ON public.forwarder_consignees;
CREATE POLICY "forwarder_consignees_admin_all"
  ON public.forwarder_consignees FOR ALL TO authenticated
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

CREATE OR REPLACE FUNCTION public.touch_forwarder_consignees_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forwarder_consignees_updated_at ON public.forwarder_consignees;
CREATE TRIGGER trg_forwarder_consignees_updated_at
  BEFORE UPDATE ON public.forwarder_consignees
  FOR EACH ROW EXECUTE FUNCTION public.touch_forwarder_consignees_updated_at();

-- Link shipment → consignee (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'external_shipments_consignee_fk'
  ) THEN
    ALTER TABLE public.external_shipments
      ADD CONSTRAINT external_shipments_consignee_fk
      FOREIGN KEY (consignee_id)
      REFERENCES public.forwarder_consignees(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) WhatsApp templates on forwarders (jsonb)
-- ---------------------------------------------------------------------------
ALTER TABLE public.forwarders
  ADD COLUMN IF NOT EXISTS wa_templates jsonb NOT NULL DEFAULT jsonb_build_object(
    'arrived', 'Bonjour, votre colis {{awb}} est arrivé chez {{company}}. Suivi: {{tracking_url}}',
    'reminder', 'Rappel {{company}}: votre colis {{awb}} ({{status}}) vous attend. {{tracking_url}}',
    'urgent', 'URGENT {{company}}: merci de récupérer le colis {{awb}} dès que possible. {{tracking_url}}'
  );

COMMENT ON COLUMN public.forwarders.wa_templates IS
  'WhatsApp message templates (wa.me). Keys: arrived, reminder, urgent. Variables: company, awb, status, tracking_url, weight, amount.';

-- ---------------------------------------------------------------------------
-- 3) Storage bucket for package photos
-- Path: {public_token}/{filename} — SELECT allowed if token exists (same secrecy as /t/:token)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'external-shipment-photos',
  'external-shipment-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "ext_ship_photos_select_by_token" ON storage.objects;
CREATE POLICY "ext_ship_photos_select_by_token"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'external-shipment-photos'
    AND EXISTS (
      SELECT 1 FROM public.external_shipments es
      WHERE es.public_token = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "ext_ship_photos_insert_owner" ON storage.objects;
CREATE POLICY "ext_ship_photos_insert_owner"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'external-shipment-photos'
    AND EXISTS (
      SELECT 1 FROM public.external_shipments es
      WHERE es.public_token = (storage.foldername(name))[1]
        AND public.user_owns_forwarder(es.forwarder_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "ext_ship_photos_update_owner" ON storage.objects;
CREATE POLICY "ext_ship_photos_update_owner"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'external-shipment-photos'
    AND EXISTS (
      SELECT 1 FROM public.external_shipments es
      WHERE es.public_token = (storage.foldername(name))[1]
        AND public.user_owns_forwarder(es.forwarder_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "ext_ship_photos_delete_owner" ON storage.objects;
CREATE POLICY "ext_ship_photos_delete_owner"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'external-shipment-photos'
    AND EXISTS (
      SELECT 1 FROM public.external_shipments es
      WHERE es.public_token = (storage.foldername(name))[1]
        AND public.user_owns_forwarder(es.forwarder_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "ext_ship_photos_admin" ON storage.objects;
CREATE POLICY "ext_ship_photos_admin"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'external-shipment-photos'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'external-shipment-photos'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Public RPC — expose photo_paths (token-gated storage SELECT)
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
  v_photos jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN NULL;
  END IF;

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

  v_photos := CASE
    WHEN jsonb_typeof(v_row.photo_paths) = 'array' THEN v_row.photo_paths
    ELSE '[]'::jsonb
  END;

  RETURN jsonb_build_object(
    'awb_bl', v_row.awb_bl,
    'mode', v_row.mode,
    'status', v_row.status,
    'origin', v_row.origin,
    'destination', v_row.destination,
    'origin_country_code', v_row.origin_country_code,
    'origin_city', v_row.origin_city,
    'destination_country_code', v_row.destination_country_code,
    'destination_city', v_row.destination_city,
    'weight_kg', v_row.weight_kg,
    'quoted_amount', v_row.quoted_amount,
    'quoted_currency', v_row.quoted_currency,
    'photo_paths', v_photos,
    'photo_count', jsonb_array_length(v_photos),
    'eta', v_row.eta,
    'events', v_safe_events,
    'updated_at', v_row.updated_at,
    'forwarder_name', v_fw_name
  );
END;
$$;

COMMENT ON FUNCTION public.get_external_shipment_by_token(text)
  IS 'Public tracking; photo_paths are storage object names under public_token folder (RLS token-gated).';
