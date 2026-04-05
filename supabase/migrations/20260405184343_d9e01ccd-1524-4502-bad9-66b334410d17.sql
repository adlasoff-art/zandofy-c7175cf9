
-- ============================================
-- service_packages: composable service bundles
-- ============================================
CREATE TABLE IF NOT EXISTS public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  target text NOT NULL DEFAULT 'vendor',
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  included_services text[] NOT NULL DEFAULT '{}',
  max_deliveries_per_day int NOT NULL DEFAULT 5,
  max_riders int NOT NULL DEFAULT 1,
  hub_storage_free_kg numeric NOT NULL DEFAULT 0,
  withdrawal_delay_days int NOT NULL DEFAULT 30,
  trust_threshold_months int DEFAULT 0,
  trust_threshold_sales numeric DEFAULT 0,
  visibility_level text NOT NULL DEFAULT 'standard',
  rank int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  features jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active packages" ON public.service_packages;
CREATE POLICY "Public can read active packages"
  ON public.service_packages FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin can manage packages" ON public.service_packages;
CREATE POLICY "Admin can manage packages"
  ON public.service_packages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- store_package_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS public.store_package_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  paid_until timestamptz,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  trust_unlocked boolean NOT NULL DEFAULT false,
  trust_unlocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_package_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors read own subscriptions" ON public.store_package_subscriptions;
CREATE POLICY "Vendors read own subscriptions"
  ON public.store_package_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admin manage all subscriptions" ON public.store_package_subscriptions;
CREATE POLICY "Admin manage all subscriptions"
  ON public.store_package_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Trigger: sync retention_days on subscription activation
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_package_retention_days()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_delay int;
BEGIN
  IF NEW.is_active = true THEN
    SELECT withdrawal_delay_days INTO v_delay
    FROM public.service_packages WHERE id = NEW.package_id;
    IF v_delay IS NOT NULL THEN
      UPDATE public.vendor_wallets
      SET retention_days = v_delay, updated_at = now()
      WHERE store_id = NEW.store_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_package_retention ON public.store_package_subscriptions;
CREATE TRIGGER trg_sync_package_retention
  AFTER INSERT OR UPDATE OF is_active, package_id ON public.store_package_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_package_retention_days();
