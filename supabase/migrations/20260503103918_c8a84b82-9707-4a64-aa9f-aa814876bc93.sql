-- 1. Add default tiers to global pricing_defaults (idempotent)
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('tiers', '[
  {"max_cost":10,"multiplier":3.0},
  {"max_cost":30,"multiplier":2.5},
  {"max_cost":80,"multiplier":2.0},
  {"max_cost":200,"multiplier":1.5},
  {"max_cost":null,"multiplier":1.3}
]'::jsonb),
updated_at = now()
WHERE key = 'pricing_defaults'
  AND NOT (value ? 'tiers');

-- Insert default row if missing
INSERT INTO platform_settings (key, value)
SELECT 'pricing_defaults', '{
  "margin_pct": 15,
  "multiplier": 3,
  "max_extra_margin_under_50": 0.50,
  "max_extra_margin_over_100": 1.00,
  "transaction_fee_pct": 5,
  "tiers": [
    {"max_cost":10,"multiplier":3.0},
    {"max_cost":30,"multiplier":2.5},
    {"max_cost":80,"multiplier":2.0},
    {"max_cost":200,"multiplier":1.5},
    {"max_cost":null,"multiplier":1.3}
  ]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'pricing_defaults');

-- 2. Category pricing overrides table
CREATE TABLE IF NOT EXISTS public.category_pricing_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL UNIQUE REFERENCES public.categories(id) ON DELETE CASCADE,
  margin_pct numeric,
  multiplier numeric,
  tiers jsonb,
  description text,
  inherit_to_children boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.category_pricing_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read category pricing overrides" ON public.category_pricing_overrides;
CREATE POLICY "Public read category pricing overrides"
  ON public.category_pricing_overrides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage category pricing overrides" ON public.category_pricing_overrides;
CREATE POLICY "Admins manage category pricing overrides"
  ON public.category_pricing_overrides FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_category_pricing_overrides_updated_at ON public.category_pricing_overrides;
CREATE TRIGGER update_category_pricing_overrides_updated_at
  BEFORE UPDATE ON public.category_pricing_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_category_pricing_overrides_category ON public.category_pricing_overrides(category_id) WHERE active;