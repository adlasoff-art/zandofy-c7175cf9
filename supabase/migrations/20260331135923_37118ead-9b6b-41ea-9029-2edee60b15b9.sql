
-- ======================================================
-- 1. Fix saved_addresses: add missing columns, fix defaults, add triggers
-- ======================================================

-- Add is_first_address and province_id columns
ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS is_first_address boolean NOT NULL DEFAULT false;

ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS province_id text;

-- Fix default country from 'Sénégal' to 'CD'
ALTER TABLE public.saved_addresses
  ALTER COLUMN country SET DEFAULT 'CD';

-- Trigger: enforce first-address and default logic
CREATE OR REPLACE FUNCTION public.enforce_customer_address_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- On INSERT: if no existing address, mark as first and default
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.saved_addresses WHERE user_id = NEW.user_id
    ) THEN
      NEW.is_first_address := true;
      NEW.is_default := true;
    END IF;
  END IF;

  -- If setting as default, unset others
  IF NEW.is_default THEN
    UPDATE public.saved_addresses
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_address_rules ON public.saved_addresses;
CREATE TRIGGER trg_customer_address_rules
  BEFORE INSERT OR UPDATE ON public.saved_addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_address_rules();

-- Update DELETE policy to prevent deleting first address
DROP POLICY IF EXISTS "Users delete own addresses" ON public.saved_addresses;
CREATE POLICY "Users delete own addresses" ON public.saved_addresses
  FOR DELETE USING (auth.uid() = user_id AND NOT is_first_address);

-- Fix UPDATE policy to include WITH CHECK
DROP POLICY IF EXISTS "Users update own addresses" ON public.saved_addresses;
CREATE POLICY "Users update own addresses" ON public.saved_addresses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ======================================================
-- 2. Add delivery pricing to communes and quartiers
-- ======================================================

-- Commune: base delivery fee for home delivery
ALTER TABLE public.communes
  ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0;

ALTER TABLE public.communes
  ADD COLUMN IF NOT EXISTS is_deliverable boolean DEFAULT true;

-- Quartier: surcharge on top of commune fee
ALTER TABLE public.quartiers
  ADD COLUMN IF NOT EXISTS delivery_surcharge numeric DEFAULT 0;

-- is_restricted already exists and means "not eligible for home delivery"
-- So quartiers with is_restricted = true cannot get home delivery
