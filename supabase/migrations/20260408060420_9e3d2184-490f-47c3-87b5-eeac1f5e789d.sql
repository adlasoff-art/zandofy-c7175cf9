
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_pricing_overrides' AND column_name = 'vendor_mode'
  ) THEN
    ALTER TABLE public.vendor_pricing_overrides ADD COLUMN vendor_mode TEXT NOT NULL DEFAULT 'international';
  END IF;
END $$;
