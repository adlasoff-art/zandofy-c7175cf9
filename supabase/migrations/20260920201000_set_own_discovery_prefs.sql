-- Purpose: Allow authenticated users to persist discovery_prefs (and soft-fill gender)
--          without a broad profiles UPDATE policy (dropped in favour of RPCs).
-- Tables: profiles (via SECURITY DEFINER RPC only)
-- Rollback: DROP FUNCTION IF EXISTS public.set_own_discovery_prefs(jsonb);
-- Risk: low — users can only write their own row; jsonb size capped; no mass data change.

CREATE OR REPLACE FUNCTION public.set_own_discovery_prefs(p_prefs jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_audience text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_prefs IS NULL OR jsonb_typeof(p_prefs) <> 'object' THEN
    RAISE EXCEPTION 'Invalid discovery_prefs';
  END IF;

  -- Soft size guard (abuse / accidental huge payloads)
  IF octet_length(p_prefs::text) > 8000 THEN
    RAISE EXCEPTION 'discovery_prefs too large';
  END IF;

  UPDATE public.profiles
  SET
    discovery_prefs = p_prefs,
    updated_at = now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Soft-fill gender once from audience (never overwrite existing gender)
  v_audience := p_prefs->>'audience';
  IF v_audience IN ('male', 'female') THEN
    UPDATE public.profiles
    SET gender = v_audience, updated_at = now()
    WHERE id = v_uid
      AND (gender IS NULL OR btrim(gender) = '');
  END IF;

  RETURN p_prefs;
END;
$$;

REVOKE ALL ON FUNCTION public.set_own_discovery_prefs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_own_discovery_prefs(jsonb) TO authenticated;

COMMENT ON FUNCTION public.set_own_discovery_prefs(jsonb) IS
  'Authenticated user writes own profiles.discovery_prefs; optionally soft-fills empty gender from audience.';
