-- Purpose: Per-store permission for store team to upload payment proofs when the
--          client did not. Effective default follows is_platform_owned.
-- Tables: vendor_pricing_overrides (additive column)
-- Functions: store_may_upload_payment_proof(uuid)
-- Effective rule:
--   COALESCE(override.vendor_may_upload_payment_proof,
--            COALESCE(stores.is_platform_owned, false), false)
--   - platform-owned + unset → true (default ON; admin can set false)
--   - independent + unset → false (default OFF; admin can set true)
--   - is_platform_owned NULL → false (fail closed)
--   - explicit true/false always wins
-- Risk: low — additive nullable column; no change to order dual-validation flow.
-- Rollback: DROP FUNCTION public.store_may_upload_payment_proof(uuid);
--           ALTER TABLE public.vendor_pricing_overrides
--             DROP COLUMN IF EXISTS vendor_may_upload_payment_proof;
-- Staging → production: apply SQL after commit; no Edge Function deploy required.
-- Existing users (~4000+): no data rewrite; NULL means “use store default”.

ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS vendor_may_upload_payment_proof boolean;

COMMENT ON COLUMN public.vendor_pricing_overrides.vendor_may_upload_payment_proof IS
  'NULL = default from stores.is_platform_owned (platform ON, independent OFF). '
  'true/false = admin explicit override for store-team payment-proof upload.';

-- SECURITY DEFINER: required so storage.objects RLS (iter 2) can resolve the
-- flag without depending on caller SELECT rights on stores / overrides.
-- search_path pinned (public, pg_temp) to block schema-hijack via temp objects.
CREATE OR REPLACE FUNCTION public.store_may_upload_payment_proof(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_platform boolean := false;
  v_flag boolean := NULL;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN false;
  END IF;

  -- Missing store → false. is_platform_owned NULL → false (fail closed).
  SELECT COALESCE(s.is_platform_owned, false)
  INTO v_is_platform
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Missing override row: SELECT INTO sets v_flag NULL (and we pre-init NULL).
  SELECT o.vendor_may_upload_payment_proof
  INTO v_flag
  FROM public.vendor_pricing_overrides o
  WHERE o.store_id = p_store_id;

  -- COALESCE(explicit_flag, platform_default, false):
  --   platform + no row/NULL flag → true
  --   independent + no row/NULL flag → false
  --   explicit true/false always wins
  RETURN COALESCE(v_flag, v_is_platform, false);
END;
$$;

COMMENT ON FUNCTION public.store_may_upload_payment_proof(uuid) IS
  'Effective store-team payment-proof upload permission. '
  'COALESCE(override.vendor_may_upload_payment_proof, COALESCE(is_platform_owned,false), false). '
  'Does not grant admin upload (admins use has_role separately). '
  'Does not change dual validation (platform: vendor verify then admin release).';

REVOKE ALL ON FUNCTION public.store_may_upload_payment_proof(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_may_upload_payment_proof(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.store_may_upload_payment_proof(uuid)
  TO authenticated, service_role;
