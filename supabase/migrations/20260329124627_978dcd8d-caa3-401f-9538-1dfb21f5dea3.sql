
-- Add is_certified column to profiles (for clients and riders)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_certified boolean NOT NULL DEFAULT false;

-- Add is_certified column to stores (for vendors)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_certified boolean NOT NULL DEFAULT false;

-- RLS: Users can update their own is_certified (only if KYC approved)
CREATE OR REPLACE FUNCTION public.can_activate_certification(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kyc_verifications
    WHERE user_id = p_user_id AND status = 'approved'
  )
$$;

-- Policy: Users can update their own certification status
CREATE POLICY "Users update own certification" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Trigger: Prevent enabling certification without approved KYC
CREATE OR REPLACE FUNCTION public.validate_certification_toggle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If enabling certification, verify KYC is approved
  IF NEW.is_certified = true AND OLD.is_certified = false THEN
    IF NOT public.can_activate_certification(NEW.id) THEN
      RAISE EXCEPTION 'KYC verification required to enable certification';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_profile_certification
  BEFORE UPDATE OF is_certified ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_certification_toggle();

-- Trigger for stores: validate KYB (vendor application approved or KYC of owner)
CREATE OR REPLACE FUNCTION public.validate_store_certification_toggle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_certified = true AND OLD.is_certified = false THEN
    -- Check owner has approved KYC
    IF NOT public.can_activate_certification(NEW.owner_id) THEN
      RAISE EXCEPTION 'Owner KYC verification required to enable store certification';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_store_certification
  BEFORE UPDATE OF is_certified ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_store_certification_toggle();
