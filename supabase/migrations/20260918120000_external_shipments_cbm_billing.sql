-- Purpose: TMS CBM snapshot + billing_basis cbm; allow forwarder owners to manage restrictions.
-- Tables: external_shipments, forwarder_restrictions
-- Rollback: DROP COLUMN total_cbm (manual); restore prior CHECK; DROP owner restriction policies.
-- Risk: additive only; existing rows keep NULL total_cbm and prior billing_basis values.

-- 1) Persist CBM on external shipments
ALTER TABLE public.external_shipments
  ADD COLUMN IF NOT EXISTS total_cbm numeric;

COMMENT ON COLUMN public.external_shipments.total_cbm IS
  'Volume CBM used for quote snapshot at create (nullable; sea/CBM profiles).';

-- 2) Extend billing_basis CHECK to include cbm
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'external_shipments_billing_basis_chk'
  ) THEN
    ALTER TABLE public.external_shipments DROP CONSTRAINT external_shipments_billing_basis_chk;
  END IF;
  ALTER TABLE public.external_shipments
    ADD CONSTRAINT external_shipments_billing_basis_chk
    CHECK (
      billing_basis IS NULL
      OR billing_basis IN ('per_kg', 'flat', 'per_piece', 'cbm')
    );
END $$;

-- 3) Forwarder owner write on restrictions (UI already exposes RestrictionsEditor)
DROP POLICY IF EXISTS "Forwarder owners manage own restrictions" ON public.forwarder_restrictions;
CREATE POLICY "Forwarder owners manage own restrictions"
  ON public.forwarder_restrictions
  FOR ALL
  TO authenticated
  USING (public.user_owns_forwarder_profile(profile_id, auth.uid()))
  WITH CHECK (public.user_owns_forwarder_profile(profile_id, auth.uid()));
