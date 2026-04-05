
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  payment_method text NOT NULL DEFAULT 'card',
  provider text DEFAULT 'keccel',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  reference text NOT NULL,
  transaction_id text,
  status text NOT NULL DEFAULT 'pending',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  subscription_type text NOT NULL DEFAULT 'package',
  package_id uuid,
  service_key text,
  phone_number text,
  callback_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription payments"
ON public.subscription_payments FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can view all subscription payments"
ON public.subscription_payments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can insert own subscription payments"
ON public.subscription_payments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
