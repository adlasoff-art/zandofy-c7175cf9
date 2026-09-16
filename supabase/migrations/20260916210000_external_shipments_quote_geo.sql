-- Purpose: Vague 1 TMS — geo structured fields + weight/quote snapshot on external_shipments.
-- Tables: public.external_shipments (ALTER ADD COLUMN only)
-- Functions: public.get_external_shipment_by_token (extend public-safe fields)
-- Rollback: DROP added columns if unused; restore prior RPC from 20260916181000
-- Risk (~4000+ users): Additive nullable columns; RPC additive keys only; no checkout/orders change.

-- ---------------------------------------------------------------------------
-- 1) Geo + billing columns (nullable / defaults — backward compatible)
-- ---------------------------------------------------------------------------
ALTER TABLE public.external_shipments
  ADD COLUMN IF NOT EXISTS origin_country_code text,
  ADD COLUMN IF NOT EXISTS origin_city text,
  ADD COLUMN IF NOT EXISTS destination_country_code text,
  ADD COLUMN IF NOT EXISTS destination_city text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS pricing_profile_id uuid,
  ADD COLUMN IF NOT EXISTS billing_basis text,
  ADD COLUMN IF NOT EXISTS quoted_amount numeric,
  ADD COLUMN IF NOT EXISTS quoted_currency text,
  ADD COLUMN IF NOT EXISTS quote_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS consignee_id uuid;

-- Soft FKs (IF NOT EXISTS via DO blocks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'external_shipments_pricing_profile_fk'
  ) THEN
    ALTER TABLE public.external_shipments
      ADD CONSTRAINT external_shipments_pricing_profile_fk
      FOREIGN KEY (pricing_profile_id)
      REFERENCES public.forwarder_pricing_profiles(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'external_shipments_category_fk'
  ) THEN
    ALTER TABLE public.external_shipments
      ADD CONSTRAINT external_shipments_category_fk
      FOREIGN KEY (category_id)
      REFERENCES public.categories(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'external_shipments_billing_basis_chk'
  ) THEN
    ALTER TABLE public.external_shipments
      ADD CONSTRAINT external_shipments_billing_basis_chk
      CHECK (
        billing_basis IS NULL
        OR billing_basis IN ('per_kg', 'flat', 'per_piece')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_external_shipments_dest_country
  ON public.external_shipments (forwarder_id, destination_country_code);

CREATE INDEX IF NOT EXISTS idx_external_shipments_status
  ON public.external_shipments (forwarder_id, status);

COMMENT ON COLUMN public.external_shipments.origin_country_code IS 'ISO country code (geo engine); origin text remains display label.';
COMMENT ON COLUMN public.external_shipments.quoted_amount IS 'Snapshot of forwarder quote at create time; not live-recomputed.';
COMMENT ON COLUMN public.external_shipments.photo_paths IS 'Storage paths for package photos (Vague 2); empty until used.';

-- ---------------------------------------------------------------------------
-- 2) Public RPC — additive public-safe fields (no notes, no quote_breakdown, no phone)
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
  v_photo_count int;
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

  v_photo_count := CASE
    WHEN jsonb_typeof(v_row.photo_paths) = 'array' THEN jsonb_array_length(v_row.photo_paths)
    ELSE 0
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
    'photo_count', v_photo_count,
    'eta', v_row.eta,
    'events', v_safe_events,
    'updated_at', v_row.updated_at,
    'forwarder_name', v_fw_name
  );
END;
$$;

COMMENT ON FUNCTION public.get_external_shipment_by_token(text)
  IS 'Public tracking for external_shipments; additive geo/weight/quote display; no consignee PII, notes, or quote_breakdown.';
