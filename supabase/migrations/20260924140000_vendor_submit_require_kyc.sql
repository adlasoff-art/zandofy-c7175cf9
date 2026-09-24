-- Purpose: Server-side gate — vendor_applications cannot move to 'submitted'
--          without an approved KYC verification for the applicant.
-- Tables: vendor_applications (trigger), uses kyc_verifications
-- Rollback: DROP TRIGGER trg_vendor_app_require_kyc ON vendor_applications;
--           DROP FUNCTION public.enforce_vendor_application_kyc();
-- Risk: low — blocks only new submissions without KYC; drafts unchanged; ~4000 users OK

CREATE OR REPLACE FUNCTION public.enforce_vendor_application_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_app_require_kyc ON public.vendor_applications;
CREATE TRIGGER trg_vendor_app_require_kyc
  BEFORE INSERT OR UPDATE OF status ON public.vendor_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vendor_application_kyc();

COMMENT ON FUNCTION public.enforce_vendor_application_kyc() IS
  'Reject vendor_applications status=submitted unless user has approved KYC.';
