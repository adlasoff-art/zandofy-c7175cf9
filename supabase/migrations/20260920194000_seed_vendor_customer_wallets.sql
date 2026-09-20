-- Purpose: Seed vendor_wallets on store create and customer_wallets on profile create; backfill.
-- Tables: vendor_wallets, customer_wallets, stores, profiles
-- Risk: Additive triggers + idempotent backfill only. No balance changes for existing wallets.
-- Rollback: DROP TRIGGER trg_seed_vendor_wallet_on_store; DROP FUNCTION seed_vendor_wallet_on_store;
--           DROP TRIGGER trg_seed_customer_wallet_on_profile; DROP FUNCTION seed_customer_wallet_on_profile;
-- Staging → production: run after smoke (new store shows wallet 0; new user has customer_wallets row).

CREATE OR REPLACE FUNCTION public.seed_vendor_wallet_on_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vendor_wallets (store_id)
  SELECT NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.vendor_wallets w WHERE w.store_id = NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_vendor_wallet_on_store ON public.stores;
CREATE TRIGGER trg_seed_vendor_wallet_on_store
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_vendor_wallet_on_store();

CREATE OR REPLACE FUNCTION public.seed_customer_wallet_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_wallets (user_id, balance, currency)
  VALUES (NEW.id, 0, 'USD')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_customer_wallet_on_profile ON public.profiles;
CREATE TRIGGER trg_seed_customer_wallet_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_customer_wallet_on_profile();

-- Backfill missing wallets
INSERT INTO public.vendor_wallets (store_id)
SELECT s.id FROM public.stores s
WHERE NOT EXISTS (SELECT 1 FROM public.vendor_wallets w WHERE w.store_id = s.id);

INSERT INTO public.customer_wallets (user_id, balance, currency)
SELECT p.id, 0, 'USD' FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.customer_wallets w WHERE w.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;
