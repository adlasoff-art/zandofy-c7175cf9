
-- 1. Add is_platform_owned to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_platform_owned BOOLEAN NOT NULL DEFAULT false;

-- 2. Add commission_rate to vendor_pricing_overrides
ALTER TABLE public.vendor_pricing_overrides ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 10.00;

-- 3. Recreate the trigger function to handle platform vs independent stores
CREATE OR REPLACE FUNCTION public.credit_vendor_wallet_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_id uuid;
  v_subtotal numeric;
  v_is_platform_owned boolean;
  v_commission_rate numeric;
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

  -- Check if store is platform-owned
  SELECT COALESCE(s.is_platform_owned, false)
  INTO v_is_platform_owned
  FROM public.stores s
  WHERE s.id = v_store_id;

  -- Platform-owned stores: no wallet credit (revenue stays with platform)
  IF v_is_platform_owned THEN
    RETURN NEW;
  END IF;

  -- Independent stores: get commission rate from overrides or use global default
  SELECT COALESCE(vpo.commission_rate, 
    COALESCE(
      (SELECT (value->>'platform_commission_default')::numeric FROM public.platform_settings WHERE key = 'pricing_defaults'),
      10.00
    )
  )
  INTO v_commission_rate
  FROM public.vendor_pricing_overrides vpo
  WHERE vpo.store_id = v_store_id;

  -- If no override row exists, use global default
  IF v_commission_rate IS NULL THEN
    v_commission_rate := COALESCE(
      (SELECT (value->>'platform_commission_default')::numeric FROM public.platform_settings WHERE key = 'pricing_defaults'),
      10.00
    );
  END IF;

  -- Calculate credit (subtotal minus platform commission)
  v_subtotal := NEW.subtotal;
  v_credit := ROUND(v_subtotal * (1 - v_commission_rate / 100), 2);

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
    'Commission commande ' || NEW.order_ref || ' livrée (' || (100 - v_commission_rate)::int || '%)'
  );

  RETURN NEW;
END;
$$;
