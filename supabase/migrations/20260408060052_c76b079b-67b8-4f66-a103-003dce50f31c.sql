
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_pricing_overrides' AND column_name = 'vendor_mobile_money_enabled'
  ) THEN
    ALTER TABLE public.vendor_pricing_overrides ADD COLUMN vendor_mobile_money_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_pricing_overrides' AND column_name = 'vendor_card_enabled'
  ) THEN
    ALTER TABLE public.vendor_pricing_overrides ADD COLUMN vendor_card_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;
