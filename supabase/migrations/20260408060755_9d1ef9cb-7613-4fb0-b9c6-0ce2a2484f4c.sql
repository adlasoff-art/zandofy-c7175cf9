-- Add webhook URL column to vendor_pricing_overrides
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendor_pricing_overrides'
      AND column_name = 'vendor_webhook_url'
  ) THEN
    ALTER TABLE public.vendor_pricing_overrides
      ADD COLUMN vendor_webhook_url TEXT DEFAULT NULL;
  END IF;
END $$;

-- Insert the autonomous vendor service package (idempotent)
INSERT INTO public.service_packages (
  name, slug, target, description, rank, is_active,
  price_monthly, price_yearly,
  max_deliveries_per_day, max_riders, hub_storage_free_kg,
  withdrawal_delay_days, visibility_level,
  included_services, max_collaborators,
  trust_threshold_months, trust_threshold_sales,
  features
) VALUES (
  'Vendeur Autonome',
  'autonomous',
  'vendor',
  'Package dédié aux vendeurs locaux gérant leur propre logistique et paiements. Inclut webhook API et numéros de paiement personnalisés.',
  6,
  true,
  29.99,
  299.00,
  0,
  0,
  0,
  0,
  'enhanced',
  ARRAY['custom_payment_numbers', 'webhook_api'],
  5,
  NULL,
  NULL,
  '{"autonomous_mode": true, "platform_payments_default": false, "custom_logistics": true}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;