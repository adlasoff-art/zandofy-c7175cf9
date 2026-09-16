-- Purpose: Self-serve Mobile Money numbers upsell ($9.99/mo) — Mois du CA W2.
-- Tables: service_packages, vendor_pricing_overrides (via trigger).
-- Risk: Additive; autonomous package deactivated (not dropped); existing admin overrides preserved (never auto-disabled).
-- Staging → production: run after 20260916140000.

-- ---------------------------------------------------------------------------
-- 1) Seed / upsert MM numbers plan
-- ---------------------------------------------------------------------------
INSERT INTO public.service_packages (
  name, slug, target, description, rank, is_active,
  price_monthly, price_yearly,
  max_deliveries_per_day, max_riders, hub_storage_free_kg,
  withdrawal_delay_days, visibility_level,
  included_services, max_collaborators,
  trust_threshold_months, trust_threshold_sales,
  features
) VALUES (
  'Numéros Mobile Money',
  'vendor_mm_numbers',
  'vendor',
  'Affichez vos propres numéros Mobile Money au checkout boutique. Vendre reste gratuit — commission plateforme sur ventes livrées.',
  1,
  true,
  9.99,
  99.00,
  0,
  0,
  0,
  0,
  'standard',
  ARRAY['custom_payment_numbers'],
  0,
  NULL,
  NULL,
  '{"mm_numbers": true, "upsell": true}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  included_services = EXCLUDED.included_services,
  features = EXCLUDED.features,
  rank = EXCLUDED.rank,
  updated_at = now();

-- Recentré : package autonomous 29.99 n'est plus l'upsell principal
UPDATE public.service_packages
SET is_active = false,
    description = CASE
      WHEN description ILIKE '%vendor_mm_numbers%' THEN description
      ELSE COALESCE(description, '') || ' (remplacé par forfait Numéros Mobile Money)'
    END,
    updated_at = now()
WHERE slug = 'autonomous'
  AND is_active = true;

-- ---------------------------------------------------------------------------
-- 2) Enable custom MM numbers when vendor_mm_numbers package is active
--    Never auto-disable (admin grandfather / manual overrides stay on).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_mm_numbers_from_package()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_active boolean;
BEGIN
  SELECT sp.slug INTO v_slug
  FROM public.service_packages sp
  WHERE sp.id = NEW.package_id;

  IF v_slug IS DISTINCT FROM 'vendor_mm_numbers' THEN
    RETURN NEW;
  END IF;

  v_active := COALESCE(NEW.is_active, false)
    AND (NEW.paid_until IS NULL OR NEW.paid_until > now());

  IF NOT v_active THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.vendor_pricing_overrides (
    store_id,
    vendor_custom_payment_numbers_enabled,
    updated_at
  ) VALUES (
    NEW.store_id,
    true,
    now()
  )
  ON CONFLICT (store_id) DO UPDATE SET
    vendor_custom_payment_numbers_enabled = true,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mm_numbers_from_package ON public.store_package_subscriptions;
CREATE TRIGGER trg_sync_mm_numbers_from_package
  AFTER INSERT OR UPDATE OF is_active, package_id, paid_until
  ON public.store_package_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_mm_numbers_from_package();

COMMENT ON FUNCTION public.sync_mm_numbers_from_package() IS
  'Enables vendor_custom_payment_numbers_enabled when vendor_mm_numbers package is active; never auto-disables.';
