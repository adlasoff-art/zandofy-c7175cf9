-- Purpose: Additive home location on profiles + sync from discovery_prefs.
-- Tables: profiles; function set_own_discovery_prefs
-- Rollback: DROP COLUMN home_country_code, home_city_id (not recommended with live data)
-- Risk: low — nullable columns; backfill best-effort; ~4000+ users

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_country_code text,
  ADD COLUMN IF NOT EXISTS home_city_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_home_city_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_home_city_id_fkey
      FOREIGN KEY (home_city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_home_country_code
  ON public.profiles (home_country_code)
  WHERE home_country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_home_city_id
  ON public.profiles (home_city_id)
  WHERE home_city_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.home_country_code IS
  'Account ecosystem country (ISO-3166-1 alpha-2). Distinct from checkout shipping destination.';
COMMENT ON COLUMN public.profiles.home_city_id IS
  'Account ecosystem city (cities.id). Used for discovery ranking defaults.';

-- Backfill from discovery_prefs JSON when home_* empty
UPDATE public.profiles p
SET
  home_country_code = upper(nullif(trim(both FROM coalesce(p.discovery_prefs->>'country_code', '')), '')),
  home_city_id = CASE
    WHEN (p.discovery_prefs->>'city_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN (p.discovery_prefs->>'city_id')::uuid
    ELSE NULL
  END,
  updated_at = now()
WHERE p.discovery_prefs IS NOT NULL
  AND (
    (p.home_country_code IS NULL AND nullif(trim(both FROM coalesce(p.discovery_prefs->>'country_code', '')), '') IS NOT NULL)
    OR (p.home_city_id IS NULL AND (p.discovery_prefs->>'city_id') IS NOT NULL)
  );

-- Clear invalid city FKs (city not in cities)
UPDATE public.profiles p
SET home_city_id = NULL
WHERE p.home_city_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = p.home_city_id);

-- Sync home_* on discovery prefs write (when completing / updating country/city)
CREATE OR REPLACE FUNCTION public.set_own_discovery_prefs(p_prefs jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_audience text;
  v_scope text;
  v_receipt text;
  v_country text;
  v_city_id uuid;
  v_interests jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_clean jsonb;
  v_id text;
  v_pay text;
  v_completed text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_prefs IS NULL OR jsonb_typeof(p_prefs) <> 'object' THEN
    RAISE EXCEPTION 'Invalid discovery_prefs';
  END IF;

  IF octet_length(p_prefs::text) > 8000 THEN
    RAISE EXCEPTION 'discovery_prefs too large';
  END IF;

  v_audience := lower(nullif(trim(both FROM coalesce(p_prefs->>'audience', '')), ''));
  IF v_audience IS NOT NULL AND v_audience NOT IN ('male', 'female', 'both', 'any') THEN
    v_audience := NULL;
  END IF;

  v_scope := lower(nullif(trim(both FROM coalesce(p_prefs->>'purchase_scope', '')), ''));
  IF v_scope IS NOT NULL AND v_scope NOT IN ('city', 'country', 'any_country') THEN
    v_scope := NULL;
  END IF;

  v_receipt := lower(nullif(trim(both FROM coalesce(p_prefs->>'receipt_mode', '')), ''));
  IF v_receipt IS NOT NULL AND v_receipt NOT IN ('home_delivery', 'pickup') THEN
    v_receipt := NULL;
  END IF;

  v_country := upper(nullif(trim(both FROM coalesce(p_prefs->>'country_code', '')), ''));
  IF v_country IS NULL OR v_country !~ '^[A-Z]{2}$' THEN
    v_country := NULL;
  END IF;

  BEGIN
    v_city_id := NULLIF(trim(both FROM coalesce(p_prefs->>'city_id', '')), '')::uuid;
  EXCEPTION WHEN others THEN
    v_city_id := NULL;
  END;

  IF v_city_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v_city_id) THEN
    v_city_id := NULL;
  END IF;

  v_completed := CASE
    WHEN (p_prefs->>'completed_at') ~ '^\d{4}-\d{2}-\d{2}T'
    THEN p_prefs->>'completed_at'
    ELSE NULL
  END;
  IF v_completed IS NOT NULL AND v_scope = 'city' AND v_city_id IS NULL THEN
    RAISE EXCEPTION 'city_id required when purchase_scope is city';
  END IF;

  IF jsonb_typeof(p_prefs->'interest_category_ids') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(p_prefs->'interest_category_ids')
    LOOP
      IF v_id IS NOT NULL
         AND char_length(v_id) > 0
         AND char_length(v_id) <= 64
         AND jsonb_array_length(v_interests) < 5
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(v_interests) AS e(x)
           WHERE e.x = v_id
         )
      THEN
        v_interests := v_interests || to_jsonb(v_id);
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(p_prefs->'payment_prefs') = 'array' THEN
    FOR v_pay IN SELECT jsonb_array_elements_text(p_prefs->'payment_prefs')
    LOOP
      IF v_pay IN ('mobile_money', 'card', 'off_platform', 'later')
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(v_payments) AS e(x)
           WHERE e.x = v_pay
         )
      THEN
        v_payments := v_payments || to_jsonb(v_pay);
      END IF;
    END LOOP;
  END IF;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'version', 1,
    'audience', v_audience,
    'interest_category_ids', v_interests,
    'purchase_scope', v_scope,
    'receipt_mode', v_receipt,
    'payment_prefs', v_payments,
    'country_code', v_country,
    'city_id', v_city_id,
    'completed_at', v_completed,
    'skipped_at', CASE
      WHEN (p_prefs->>'skipped_at') ~ '^\d{4}-\d{2}-\d{2}T'
      THEN p_prefs->>'skipped_at'
      ELSE NULL
    END,
    'updated_at', coalesce(
      CASE
        WHEN (p_prefs->>'updated_at') ~ '^\d{4}-\d{2}-\d{2}T'
        THEN p_prefs->>'updated_at'
        ELSE NULL
      END,
      to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  ));

  UPDATE public.profiles
  SET
    discovery_prefs = v_clean,
    home_country_code = COALESCE(v_country, home_country_code),
    home_city_id = COALESCE(v_city_id, home_city_id),
    updated_at = now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_audience IN ('male', 'female') THEN
    UPDATE public.profiles
    SET gender = v_audience, updated_at = now()
    WHERE id = v_uid
      AND (gender IS NULL OR btrim(gender) = '');
  END IF;

  RETURN v_clean;
END;
$$;

COMMENT ON FUNCTION public.set_own_discovery_prefs(jsonb) IS
  'Sanitized discovery_prefs write; syncs home_country_code/home_city_id when provided.';
