CREATE OR REPLACE FUNCTION public.recompute_handoff_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total numeric(12,2);
  v_paid numeric(12,2);
BEGIN
  v_total := COALESCE(NEW.deposit_amount, 0) + COALESCE(NEW.balance_amount, 0);
  v_paid  := COALESCE(NEW.deposit_paid_amount, 0) + COALESCE(NEW.balance_paid_amount, 0);

  IF v_total <= 0 THEN
    NEW.payment_status := 'not_required';
  ELSIF v_paid >= v_total THEN
    NEW.payment_status := 'paid_in_full';
  ELSIF NEW.deposit_required AND COALESCE(NEW.deposit_paid_amount, 0) >= COALESCE(NEW.deposit_amount, 0)
        AND COALESCE(NEW.deposit_amount, 0) > 0 THEN
    NEW.payment_status := 'deposit_paid';
  ELSE
    NEW.payment_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;