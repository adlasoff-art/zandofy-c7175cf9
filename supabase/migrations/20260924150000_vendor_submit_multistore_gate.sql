-- Purpose: Server-side multi-store eligibility when submitting a vendor application.
--          Blocks status=submitted if user already owns a non-platform store and
--          does not meet 3 months + 10 sales (same rules as BecomeVendor UI).
-- Tables: vendor_applications (trigger extends enforce_vendor_application_kyc)
-- Rollback: revert to previous enforce_vendor_application_kyc() body (KYC-only).
-- Risk: low — blocks ineligible second-store submissions only; first store OK; ~4000 users.

CREATE OR REPLACE FUNCTION public.enforce_vendor_application_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_store_count int;
  v_has_platform boolean;
  v_months int;
  v_sales int;
  v_oldest timestamptz;
BEGIN
  IF NEW.status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  -- KYC approved required
  SELECT EXISTS (
    SELECT 1
    FROM public.kyc_verifications k
    WHERE k.user_id = NEW.user_id
      AND k.status = 'approved'
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'KYC identité approuvé requis avant soumission vendeur'
      USING ERRCODE = 'P0001';
  END IF;

  -- Multi-store eligibility (align with BecomeVendorPage UI)
  SELECT
    COUNT(*)::int,
    COALESCE(BOOL_OR(COALESCE(s.is_platform_owned, false)), false),
    MIN(s.created_at),
    COALESCE(SUM(COALESCE(s.sales_count, 0)), 0)::int
  INTO v_store_count, v_has_platform, v_oldest, v_sales
  FROM public.stores s
  WHERE s.owner_id = NEW.user_id;

  IF v_store_count > 0 AND NOT v_has_platform THEN
    v_months := FLOOR(EXTRACT(EPOCH FROM (now() - v_oldest)) / (60 * 60 * 24 * 30))::int;
    IF v_months < 3 OR v_sales < 10 THEN
      RAISE EXCEPTION 'Multi-boutique non éligible: 3 mois et 10 ventes requis (actuel: % mois, % ventes)',
        v_months, v_sales
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_vendor_application_kyc() IS
  'Reject vendor_applications status=submitted unless approved KYC and multi-store rules pass.';
