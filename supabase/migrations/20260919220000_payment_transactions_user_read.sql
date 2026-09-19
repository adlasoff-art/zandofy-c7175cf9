-- Purpose: Allow authenticated buyers to SELECT their own payment_transactions
--          so MoMo checkout hybrid poll (DB every 4s) works under RLS.
--          Staff policies unchanged. Realtime publication stays off (security).
-- Tables: payment_transactions (RLS policy only)
-- Rollback: DROP POLICY "Users read own payment transactions"
-- Risk: low — own rows only (user_id = auth.uid()); no writes opened

DROP POLICY IF EXISTS "Users read own payment transactions" ON public.payment_transactions;

CREATE POLICY "Users read own payment transactions"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

COMMENT ON POLICY "Users read own payment transactions" ON public.payment_transactions IS
  'Checkout MoMo poll + ShippingPaymentModal: buyer reads own tx status without staff role';
