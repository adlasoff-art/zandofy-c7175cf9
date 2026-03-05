
-- Trigger function: when order status changes to 'delivered', 
-- create wallet if needed and credit pending funds
CREATE OR REPLACE FUNCTION public.credit_vendor_wallet_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_id uuid;
  v_subtotal numeric;
  v_platform_commission numeric := 0.10; -- 10% platform fee
  v_credit numeric;
BEGIN
  -- Only fire when status changes to 'delivered'
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status != 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  v_store_id := NEW.store_id;
  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate credit (subtotal minus platform commission)
  v_subtotal := NEW.subtotal;
  v_credit := ROUND(v_subtotal * (1 - v_platform_commission), 2);

  IF v_credit <= 0 THEN
    RETURN NEW;
  END IF;

  -- Ensure wallet exists (upsert)
  INSERT INTO public.vendor_wallets (store_id, pending_balance, total_earned)
  VALUES (v_store_id, v_credit, v_credit)
  ON CONFLICT (store_id) DO UPDATE
  SET pending_balance = vendor_wallets.pending_balance + v_credit,
      total_earned = vendor_wallets.total_earned + v_credit,
      updated_at = now();

  -- Log the transaction
  INSERT INTO public.vendor_transactions (store_id, type, amount, order_id, description)
  VALUES (
    v_store_id,
    'credit',
    v_credit,
    NEW.id,
    'Commission commande ' || NEW.order_ref || ' livrée (' || (100 - v_platform_commission * 100)::int || '%)'
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS trg_credit_vendor_wallet_on_delivery ON public.orders;
CREATE TRIGGER trg_credit_vendor_wallet_on_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.credit_vendor_wallet_on_delivery();

-- Also add a trigger/function to move pending → available after retention period
-- This would normally be a cron job, but we create the function for admin manual release
CREATE OR REPLACE FUNCTION public.release_vendor_pending_funds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT vt.id, vt.store_id, vt.amount, vt.created_at,
           COALESCE(vw.retention_days, 30) as retention_days
    FROM public.vendor_transactions vt
    JOIN public.vendor_wallets vw ON vw.store_id = vt.store_id
    WHERE vt.type = 'credit'
      AND vt.created_at <= now() - (COALESCE(vw.retention_days, 30) || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_transactions vt2
        WHERE vt2.store_id = vt.store_id
          AND vt2.type = 'release'
          AND vt2.description LIKE '%' || vt.id::text || '%'
      )
  LOOP
    -- Move from pending to available
    UPDATE public.vendor_wallets
    SET available_balance = available_balance + rec.amount,
        pending_balance = GREATEST(pending_balance - rec.amount, 0),
        updated_at = now()
    WHERE store_id = rec.store_id;

    INSERT INTO public.vendor_transactions (store_id, type, amount, description)
    VALUES (rec.store_id, 'release', rec.amount, 'Fonds libérés (réf: ' || rec.id::text || ')');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
