CREATE TABLE IF NOT EXISTS public.keccel_cardpay_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id TEXT NOT NULL,
  function_name TEXT NOT NULL,
  environment TEXT,
  origin TEXT,
  site_base_url TEXT,
  user_id UUID,
  order_id UUID,
  reference TEXT,
  amount NUMERIC,
  currency TEXT,
  callback_url TEXT,
  return_url TEXT,
  merchant_code_masked TEXT,
  token_present BOOLEAN,
  token_length INT,
  sent_keys TEXT[],
  payload_shape JSONB,
  pre_flight_missing TEXT[],
  http_status INT,
  keccel_code TEXT,
  keccel_description TEXT,
  keccel_response JSONB,
  raw_body TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keccel_diag_created_at ON public.keccel_cardpay_diagnostics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keccel_diag_diagnostic_id ON public.keccel_cardpay_diagnostics(diagnostic_id);

ALTER TABLE public.keccel_cardpay_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read keccel diagnostics"
ON public.keccel_cardpay_diagnostics
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));