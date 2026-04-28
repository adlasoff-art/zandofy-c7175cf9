-- ============================================================
-- Hotfix 2026-04-29 : éligibilité transitaire au checkout
--   • get_eligible_forwarders_v2 :
--       transitaire actif + approved/active
--     + mode supporté
--     + route coverage_routes origin->destination
--     + profil tarifaire actif (city_id exact > city_id NULL fallback)
--   • debug_forwarder_checkout_eligibility :
--       diagnostic admin par transitaire (route / mode / profil / paliers).
-- ============================================================

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
    -- Tous les transitaires éligibles (route + mode + statut)
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
            AND UPPER(r->>'destination_country') = (SELECT code FROM dc)
        )
    ),
    -- Profils candidats : ville exacte ou pays-large
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
    -- Pour chaque transitaire, garder le profil le plus spécifique
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
        AND UPPER(rr->>'destination_country') = (SELECT code FROM dc)
        AND COALESCE(rr->>'origin_city', '') <> ''
    ) AS covers_origin_city,
    ARRAY(
      SELECT DISTINCT rr->>'origin_city'
      FROM jsonb_array_elements(COALESCE(r.coverage_routes, '[]'::jsonb)) rr
      WHERE UPPER(rr->>'origin_country') = (SELECT code FROM oc)
        AND UPPER(rr->>'destination_country') = (SELECT code FROM dc)
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
  'Checkout : transitaires actifs/approved couvrant origine→destination + mode + profil tarifaire. Préfère city_id exact, sinon fallback profil pays (city_id NULL).';

-- ============================================================
-- Diagnostic admin : pour chaque transitaire actif, dit pourquoi il
-- est OUI/NON proposé pour (origine, destination, ville, mode).
-- ============================================================

DROP FUNCTION IF EXISTS public.debug_forwarder_checkout_eligibility(text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.debug_forwarder_checkout_eligibility(
  p_origin_country      text,
  p_destination_country text,
  p_destination_city_id uuid,
  p_mode                text
)
RETURNS TABLE (
  forwarder_id            uuid,
  forwarder_name          text,
  status                  text,
  is_active               boolean,
  supports_mode           boolean,
  has_route               boolean,
  has_exact_city_profile  boolean,
  has_country_profile     boolean,
  has_kg_tier             boolean,
  has_cbm_tier            boolean,
  has_piece_tier          boolean,
  picked_profile_id       uuid,
  would_be_eligible       boolean,
  reason                  text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc text := UPPER(p_origin_country);
  v_dc text := UPPER(p_destination_country);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      f.id                           AS f_id,
      f.name                         AS f_name,
      COALESCE(f.status, 'approved') AS f_status,
      f.is_active                    AS f_active,
      (f.supported_modes IS NULL OR p_mode = ANY (f.supported_modes)) AS f_supports_mode,
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(f.coverage_routes, '[]'::jsonb)) r
        WHERE UPPER(r->>'origin_country') = v_oc
          AND UPPER(r->>'destination_country') = v_dc
      ) AS f_has_route
    FROM public.forwarders f
  ),
  prof AS (
    SELECT
      b.f_id,
      EXISTS (
        SELECT 1 FROM public.forwarder_pricing_profiles p
        WHERE p.forwarder_id = b.f_id AND p.is_active = true
          AND p.country_code = v_dc AND p.mode = p_mode
          AND p.city_id = p_destination_city_id
      ) AS p_exact,
      EXISTS (
        SELECT 1 FROM public.forwarder_pricing_profiles p
        WHERE p.forwarder_id = b.f_id AND p.is_active = true
          AND p.country_code = v_dc AND p.mode = p_mode
          AND p.city_id IS NULL
      ) AS p_country,
      (
        SELECT p.id FROM public.forwarder_pricing_profiles p
        WHERE p.forwarder_id = b.f_id AND p.is_active = true
          AND p.country_code = v_dc AND p.mode = p_mode
          AND (p.city_id = p_destination_city_id OR p.city_id IS NULL)
        ORDER BY (CASE WHEN p.city_id = p_destination_city_id THEN 1 ELSE 2 END), p.id
        LIMIT 1
      ) AS picked
    FROM base b
  ),
  tiers AS (
    SELECT
      pr.f_id,
      pr.picked,
      EXISTS (SELECT 1 FROM public.forwarder_kg_tiers t WHERE t.profile_id = pr.picked)    AS t_kg,
      EXISTS (SELECT 1 FROM public.forwarder_cbm_tiers t WHERE t.profile_id = pr.picked)   AS t_cbm,
      EXISTS (SELECT 1 FROM public.forwarder_piece_tiers t WHERE t.profile_id = pr.picked) AS t_piece
    FROM prof pr
  )
  SELECT
    b.f_id,
    b.f_name,
    b.f_status,
    b.f_active,
    b.f_supports_mode,
    b.f_has_route,
    pr.p_exact,
    pr.p_country,
    t.t_kg,
    t.t_cbm,
    t.t_piece,
    t.picked,
    (
      b.f_active
      AND b.f_status IN ('approved','active')
      AND b.f_supports_mode
      AND b.f_has_route
      AND (pr.p_exact OR pr.p_country)
      AND (t.t_kg OR t.t_cbm OR t.t_piece)
    ) AS would_be_eligible,
    CASE
      WHEN NOT b.f_active                                THEN 'transitaire inactif'
      WHEN b.f_status NOT IN ('approved','active')       THEN 'statut = ' || b.f_status
      WHEN NOT b.f_supports_mode                          THEN 'mode ' || p_mode || ' non supporté'
      WHEN NOT b.f_has_route                              THEN 'route ' || v_oc || '→' || v_dc || ' manquante'
      WHEN NOT (pr.p_exact OR pr.p_country)               THEN 'aucun profil tarifaire actif (' || v_dc || '/' || p_mode || ')'
      WHEN NOT (t.t_kg OR t.t_cbm OR t.t_piece)           THEN 'profil sans palier tarifaire'
      WHEN pr.p_exact                                     THEN 'OK (profil ville exacte)'
      ELSE                                                     'OK (profil pays-large)'
    END AS reason
  FROM base b
  LEFT JOIN prof pr ON pr.f_id = b.f_id
  LEFT JOIN tiers t ON t.f_id = b.f_id
  ORDER BY would_be_eligible DESC, b.f_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_forwarder_checkout_eligibility(text, text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.debug_forwarder_checkout_eligibility IS
  'Diagnostic admin : explique pour chaque transitaire pourquoi il est (ou non) proposé au checkout pour un couple (origine, destination, ville, mode).';