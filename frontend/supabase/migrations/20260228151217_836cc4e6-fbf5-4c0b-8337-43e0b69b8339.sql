
-- Table to track all KelPay payment transactions
CREATE TABLE public.payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  user_id uuid NOT NULL,
  method text NOT NULL DEFAULT 'mobile_money',
  provider text, -- ORANGE, MPESA, AIRTEL, AFRIMONEY, VISA, MASTERCARD
  phone_number text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  reference text NOT NULL UNIQUE,
  transaction_id text, -- KelPay transaction ID
  status text NOT NULL DEFAULT 'pending', -- pending, success, failed, expired
  callback_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own payment transactions
CREATE POLICY "Users read own payment transactions"
ON public.payment_transactions FOR SELECT
USING (user_id = auth.uid());

-- Staff can read all payment transactions
CREATE POLICY "Staff read all payment transactions"
ON public.payment_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Service role inserts (from edge functions) - allow insert for authenticated users
CREATE POLICY "Users insert own payment transactions"
ON public.payment_transactions FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Allow update from edge functions (callback) - staff can update
CREATE POLICY "Staff update payment transactions"
ON public.payment_transactions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Enable realtime for payment status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;

-- Auto-update updated_at
CREATE TRIGGER update_payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
