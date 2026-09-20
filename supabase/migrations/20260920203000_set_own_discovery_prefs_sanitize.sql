-- Purpose: Sanitize discovery_prefs payload in set_own_discovery_prefs (schema allow-list).
-- Tables: profiles (via SECURITY DEFINER RPC only)
-- Rollback: restore previous function body from 20260920201000_set_own_discovery_prefs.sql
-- Risk: low — rejects malformed payloads; existing valid rows unchanged; ~4000 users unaffected

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
  v_interests jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_clean jsonb;
  v_id text;
  v_pay text;
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
    'completed_at', CASE
      WHEN (p_prefs->>'completed_at') ~ '^\d{4}-\d{2}-\d{2}T'
      THEN p_prefs->>'completed_at'
      ELSE NULL
    END,
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
    updated_at = now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Soft-fill gender once from audience (never overwrite existing gender)
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
  'Authenticated user writes own sanitized profiles.discovery_prefs; optionally soft-fills empty gender from audience.';
