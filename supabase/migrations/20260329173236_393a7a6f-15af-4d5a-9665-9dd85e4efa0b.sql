-- Function to release pending wallet funds after retention period
CREATE OR REPLACE FUNCTION public.release_pending_wallet_funds(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
  v_releasable numeric := 0;
BEGIN
  -- Get wallet
  SELECT * INTO v_wallet FROM public.vendor_wallets WHERE store_id = p_store_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Sum credits from vendor_transactions that are older than retention_days and not yet released
  SELECT COALESCE(SUM(vt.amount), 0) INTO v_releasable
  FROM public.vendor_transactions vt
  WHERE vt.store_id = p_store_id
    AND vt.type = 'credit'
    AND vt.created_at < now() - (v_wallet.retention_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_transactions rt
      WHERE rt.store_id = p_store_id
        AND rt.type = 'release'
        AND rt.order_id = vt.order_id
    );

  IF v_releasable <= 0 THEN RETURN; END IF;

  -- Move funds from pending to available
  UPDATE public.vendor_wallets
  SET available_balance = available_balance + v_releasable,
      pending_balance = GREATEST(pending_balance - v_releasable, 0),
      updated_at = now()
  WHERE store_id = p_store_id;

  -- Log release transactions for each credit being released
  INSERT INTO public.vendor_transactions (store_id, type, amount, order_id, description)
  SELECT vt.store_id, 'release', vt.amount, vt.order_id,
         'Fonds libérés après ' || v_wallet.retention_days || ' jours de rétention'
  FROM public.vendor_transactions vt
  WHERE vt.store_id = p_store_id
    AND vt.type = 'credit'
    AND vt.created_at < now() - (v_wallet.retention_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_transactions rt
      WHERE rt.store_id = p_store_id
        AND rt.type = 'release'
        AND rt.order_id = vt.order_id
    );
END;
$$;