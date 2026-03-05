
-- ============================================
-- VENDOR WALLET SYSTEM
-- ============================================

-- 1. Vendor Wallets
CREATE TABLE public.vendor_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  retention_days integer NOT NULL DEFAULT 30,
  min_withdrawal numeric NOT NULL DEFAULT 10,
  withdrawal_frequency text NOT NULL DEFAULT 'monthly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_wallets ENABLE ROW LEVEL SECURITY;

-- Vendor reads own wallet
CREATE POLICY "Vendors read own wallet"
  ON public.vendor_wallets FOR SELECT
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Staff read all wallets
CREATE POLICY "Staff read all wallets"
  ON public.vendor_wallets FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Staff manage wallets (update retention, min withdrawal, etc.)
CREATE POLICY "Staff manage wallets"
  ON public.vendor_wallets FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- System insert (via triggers)
CREATE POLICY "Staff insert wallets"
  ON public.vendor_wallets FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
    OR store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- 2. Vendor Transactions (credit per delivered order, debit per withdrawal)
CREATE TABLE public.vendor_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'credit', -- credit, debit, release
  amount numeric NOT NULL DEFAULT 0,
  order_id uuid REFERENCES public.orders(id),
  withdrawal_request_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors read own transactions"
  ON public.vendor_transactions FOR SELECT
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Staff read all transactions"
  ON public.vendor_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "System insert transactions"
  ON public.vendor_transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
    OR store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- 3. Withdrawal Requests
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'mobile_money',
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors read own requests"
  ON public.withdrawal_requests FOR SELECT
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Vendors create requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Staff read all requests"
  ON public.withdrawal_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff update requests"
  ON public.withdrawal_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Add FK from vendor_transactions to withdrawal_requests
ALTER TABLE public.vendor_transactions
  ADD CONSTRAINT vendor_transactions_withdrawal_request_id_fkey
  FOREIGN KEY (withdrawal_request_id) REFERENCES public.withdrawal_requests(id);

-- Updated_at triggers
CREATE TRIGGER update_vendor_wallets_updated_at
  BEFORE UPDATE ON public.vendor_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for withdrawal_requests (admin monitoring)
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
