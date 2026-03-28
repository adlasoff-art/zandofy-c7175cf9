
-- Table for store-specific payment numbers (up to 4 operators per store)
CREATE TABLE IF NOT EXISTS public.store_payment_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  operator TEXT NOT NULL, -- e.g. 'orange_money', 'mpesa', 'airtel_money', 'afrimoney'
  operator_label TEXT NOT NULL, -- e.g. 'Orange Money', 'M-Pesa', etc.
  phone_number TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '', -- name visible during USSD/app transaction
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, operator)
);

ALTER TABLE public.store_payment_numbers ENABLE ROW LEVEL SECURITY;

-- Vendors can manage their own store payment numbers
CREATE POLICY "Store owners manage payment numbers"
ON public.store_payment_numbers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_payment_numbers.store_id
    AND (s.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
    ))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_payment_numbers.store_id
    AND (s.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
    ))
  )
);

-- Public can read active payment numbers (needed at checkout)
CREATE POLICY "Public read active payment numbers"
ON public.store_payment_numbers
FOR SELECT
USING (true);

-- Admins full access
CREATE POLICY "Admins manage all payment numbers"
ON public.store_payment_numbers
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Add toggle for custom payment numbers per store
ALTER TABLE public.vendor_pricing_overrides
ADD COLUMN IF NOT EXISTS vendor_custom_payment_numbers_enabled BOOLEAN NOT NULL DEFAULT false;

-- Seed default admin payment numbers in platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES ('default_payment_numbers', '{
  "numbers": [
    {"operator": "orange_money", "operator_label": "Orange Money", "phone_number": "", "display_name": "", "sort_order": 0},
    {"operator": "mpesa", "operator_label": "M-Pesa", "phone_number": "", "display_name": "", "sort_order": 1},
    {"operator": "airtel_money", "operator_label": "Airtel Money", "phone_number": "", "display_name": "", "sort_order": 2},
    {"operator": "afrimoney", "operator_label": "AfriMoney", "phone_number": "", "display_name": "", "sort_order": 3}
  ]
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
