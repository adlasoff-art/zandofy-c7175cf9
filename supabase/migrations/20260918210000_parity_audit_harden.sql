-- Purpose: Harden TMS parity after audit — coverage_routes canonical keys,
-- align user_owns_forwarder_profile with members, expose total_cbm on public tracking.
-- Tables: forwarders.coverage_routes (JSONB rewrite), functions.
-- Depends on: 20260918120000_external_shipments_cbm_billing.sql (total_cbm column preferred).
-- Rollback: re-run reverse key rename if needed; restore prior function bodies from git.
-- Risk: additive/safe rewrite; ~4000+ users — only rewrites dest_* aliases on coverage_routes.
-- Staging → production: apply AFTER 20260918120000_external_shipments_cbm_billing.sql

-- Ensure total_cbm exists even if prior migration skipped (idempotent)
ALTER TABLE public.external_shipments
  ADD COLUMN IF NOT EXISTS total_cbm numeric;

-- ─────────────────────────────────────────────────────────────
-- 1) Canonical coverage_routes keys for checkout
--    Checkout RPC/JS expect destination_country / destination_city.
--    CoverageRoutesEditor previously wrote dest_country / dest_city.
-- ─────────────────────────────────────────────────────────────
UPDATE public.forwarders f
SET coverage_routes = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(elem) = 'object' THEN
          elem
          || jsonb_strip_nulls(jsonb_build_object(
               'destination_country',
               COALESCE(elem->>'destination_country', elem->>'dest_country'),
               'destination_city',
               COALESCE(elem->>'destination_city', elem->>'dest_city')
             ))
        ELSE elem
      END
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(f.coverage_routes, '[]'::jsonb))
    WITH ORDINALITY AS t(elem, ord)
)
WHERE f.coverage_routes IS NOT NULL
  AND jsonb_typeof(f.coverage_routes) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(f.coverage_routes) e
    WHERE e ? 'dest_country' OR e ? 'dest_city'
  );

COMMENT ON COLUMN public.forwarders.coverage_routes IS
  'JSON array of routes. Canonical keys: origin_country, origin_city, destination_country, destination_city, mode, origin, destination. Legacy dest_country/dest_city accepted as aliases.';

-- ─────────────────────────────────────────────────────────────
-- 2) Align user_owns_forwarder_profile with user_owns_forwarder
--    so active members can edit tiers/restrictions like profiles.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_owns_forwarder_profile(_profile_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forwarder_pricing_profiles p
    WHERE p.id = _profile_id
      AND public.user_owns_forwarder(p.forwarder_id, _user_id)
  );
$$;

COMMENT ON FUNCTION public.user_owns_forwarder_profile(uuid, uuid) IS
  'True if user controls the forwarder owning the pricing profile (owner, linked transporter, or active member via user_owns_forwarder).';

-- ─────────────────────────────────────────────────────────────
-- 3) Public tracking: expose total_cbm (billing_basis kept internal)
-- ─────────────────────────────────────────────────────────────
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
    'total_cbm', v_row.total_cbm,
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
  IS 'Public tracking; photo_paths under public_token folder; exposes weight_kg, total_cbm, quoted snapshot (no notes/PII).';

-- ─────────────────────────────────────────────────────────────
-- 4) get_eligible_forwarders_v2: accept legacy dest_country alias
--    (preserves city exact > country-wide fallback from 20260428224154)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_eligible_forwarders_v2(text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.get_eligible_forwarders_v2(
  p_origin_country      text,
  p_destination_country text,
  p_destination_city_id uuid,
  p_mode                text
)
RETURNS TABLE (
  forwarder_id        uuid,
  forwarder_name      text,
  forwarder_slug      text,
  logo_url            text,
  is_platform_owned   boolean,
  supported_modes     text[],
  covers_origin_city  boolean,
  origin_cities       text[],
  profile_id          uuid,
  service_class       text,
  transit_min_days    int,
  transit_max_days    int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
    oc AS (SELECT UPPER(p_origin_country) AS code),
    dc AS (SELECT UPPER(p_destination_country) AS code),
    elig_fwd AS (
      SELECT f.*
      FROM public.forwarders f
      WHERE f.is_active = true
        AND COALESCE(f.status, 'approved') IN ('approved', 'active')
        AND (f.supported_modes IS NULL OR p_mode = ANY (f.supported_modes))
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(f.coverage_routes, '[]'::jsonb)) r
          WHERE UPPER(r->>'origin_country') = (SELECT code FROM oc)
            AND UPPER(COALESCE(r->>'destination_country', r->>'dest_country')) = (SELECT code FROM dc)
        )
    ),
    cand AS (
      SELECT
        f.id   AS f_id,
        f.name, f.slug, f.logo_url, f.is_platform_owned, f.supported_modes,
        f.coverage_routes,
        fpp.id AS profile_id,
        fpp.service_class,
        fpp.transit_min_days,
        fpp.transit_max_days,
        fpp.city_id,
        CASE WHEN fpp.city_id = p_destination_city_id THEN 1 ELSE 2 END AS specificity
      FROM elig_fwd f
      JOIN public.forwarder_pricing_profiles fpp
        ON fpp.forwarder_id = f.id
       AND fpp.is_active = true
       AND fpp.country_code = (SELECT code FROM dc)
       AND fpp.mode = p_mode
       AND (
              (p_destination_city_id IS NOT NULL AND fpp.city_id = p_destination_city_id)
           OR fpp.city_id IS NULL
           )
    ),
    ranked AS (
      SELECT c.*,
             ROW_NUMBER() OVER (PARTITION BY c.f_id ORDER BY c.specificity, c.profile_id) AS rn
      FROM cand c
    )
  SELECT
    r.f_id,
    r.name,
    r.slug,
    r.logo_url,
    r.is_platform_owned,
    r.supported_modes,
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(r.coverage_routes, '[]'::jsonb)) rr
      WHERE UPPER(rr->>'origin_country') = (SELECT code FROM oc)
        AND UPPER(COALESCE(rr->>'destination_country', rr->>'dest_country')) = (SELECT code FROM dc)
        AND COALESCE(rr->>'origin_city', '') <> ''
    ) AS covers_origin_city,
    ARRAY(
      SELECT DISTINCT rr->>'origin_city'
      FROM jsonb_array_elements(COALESCE(r.coverage_routes, '[]'::jsonb)) rr
      WHERE UPPER(rr->>'origin_country') = (SELECT code FROM oc)
        AND UPPER(COALESCE(rr->>'destination_country', rr->>'dest_country')) = (SELECT code FROM dc)
        AND COALESCE(rr->>'origin_city', '') <> ''
    ) AS origin_cities,
    r.profile_id,
    r.service_class,
    r.transit_min_days,
    r.transit_max_days
  FROM ranked r
  WHERE r.rn = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_eligible_forwarders_v2(text, text, uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_eligible_forwarders_v2 IS
  'Checkout: route origin→destination (destination_country or legacy dest_country) + mode + profile (city exact preferred, else country-wide).';
