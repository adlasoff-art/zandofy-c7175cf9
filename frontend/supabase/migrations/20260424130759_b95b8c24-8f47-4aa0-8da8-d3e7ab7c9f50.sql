-- Lot 4O: deposit / balance tracking on forwarder handoffs
ALTER TABLE public.forwarder_handoffs
  ADD COLUMN IF NOT EXISTS deposit_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_currency text NOT NULL DEFAULT 'USD';

-- Backfill from linked freight_quotes
UPDATE public.forwarder_handoffs h
   SET deposit_required = COALESCE(q.requires_deposit, false),
       deposit_amount   = COALESCE(q.deposit_amount, 0),
       balance_amount   = GREATEST(COALESCE(q.quoted_price, 0) - COALESCE(q.deposit_amount, 0), 0),
       payment_currency = COALESCE(q.currency, 'USD')
  FROM public.freight_quotes q
 WHERE h.freight_quote_id = q.id
   AND h.deposit_amount = 0
   AND h.balance_amount = 0;

-- Auto-derive payment_status on insert/update
CREATE OR REPLACE FUNCTION public.recompute_handoff_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_recompute_handoff_payment_status ON public.forwarder_handoffs;
CREATE TRIGGER trg_recompute_handoff_payment_status
BEFORE INSERT OR UPDATE OF deposit_amount, deposit_paid_amount, balance_amount, balance_paid_amount, deposit_required
ON public.forwarder_handoffs
FOR EACH ROW
EXECUTE FUNCTION public.recompute_handoff_payment_status();