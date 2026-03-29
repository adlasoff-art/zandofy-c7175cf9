
-- ============================================================
-- Migration: Purchase flow corrections
-- ============================================================

-- 1. New columns on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_date_requested date;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_time_requested text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address_confirmed text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS review_reminder_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS review_reminder_last timestamptz;

-- 2. restricted_zones table
CREATE TABLE IF NOT EXISTS public.restricted_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  zone_name text NOT NULL,
  country_code text NOT NULL DEFAULT 'CD',
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restricted_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage restricted zones" ON public.restricted_zones;
CREATE POLICY "Admins manage restricted zones" ON public.restricted_zones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can read restricted zones" ON public.restricted_zones;
CREATE POLICY "Anyone can read restricted zones" ON public.restricted_zones
  FOR SELECT TO authenticated USING (true);

-- 3. vendor_customer_reviews table
CREATE TABLE IF NOT EXISTS public.vendor_customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, order_id)
);

ALTER TABLE public.vendor_customer_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners manage their reviews" ON public.vendor_customer_reviews;
CREATE POLICY "Store owners manage their reviews" ON public.vendor_customer_reviews
  FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage vendor reviews" ON public.vendor_customer_reviews;
CREATE POLICY "Admins manage vendor reviews" ON public.vendor_customer_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. RPC: deduct_points (secure server-side points deduction)
CREATE OR REPLACE FUNCTION public.deduct_points(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  
  UPDATE public.zando_points
  SET balance = GREATEST(balance - p_amount, 0),
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.point_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'redeemed', -p_amount, 'Points utilisés pour une commande');
END;
$$;

-- 5. RPC: increment_coupon_uses
CREATE OR REPLACE FUNCTION public.increment_coupon_uses(p_coupon_id uuid, p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_table = 'store_coupons' THEN
    UPDATE public.store_coupons SET current_uses = current_uses + 1 WHERE id = p_coupon_id;
  ELSE
    UPDATE public.coupons SET current_uses = current_uses + 1 WHERE id = p_coupon_id;
  END IF;
END;
$$;

-- 6. Update credit_vendor_wallet_on_delivery to check rider_cash_collected for COD
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
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status != 'delivered' OR OLD.status = 'delivered' THEN RETURN NEW; END IF;

  -- COD: block wallet credit if cash not collected
  IF NEW.payment_method = 'cod' AND COALESCE(NEW.rider_cash_collected, false) = false THEN
    RETURN NEW;
  END IF;

  v_store_id := NEW.store_id;
  IF v_store_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(s.is_platform_owned, false) INTO v_is_platform_owned
  FROM public.stores s WHERE s.id = v_store_id;

  IF v_is_platform_owned THEN RETURN NEW; END IF;

  SELECT COALESCE(vpo.commission_rate,
    COALESCE((SELECT (value->>'platform_commission_default')::numeric FROM public.platform_settings WHERE key = 'pricing_defaults'), 10.00)
  ) INTO v_commission_rate
  FROM public.vendor_pricing_overrides vpo WHERE vpo.store_id = v_store_id;

  IF v_commission_rate IS NULL THEN
    v_commission_rate := COALESCE(
      (SELECT (value->>'platform_commission_default')::numeric FROM public.platform_settings WHERE key = 'pricing_defaults'), 10.00
    );
  END IF;

  v_subtotal := NEW.subtotal;
  v_credit := ROUND(v_subtotal * (1 - v_commission_rate / 100), 2);
  IF v_credit <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.vendor_wallets (store_id, pending_balance, total_earned)
  VALUES (v_store_id, v_credit, v_credit)
  ON CONFLICT (store_id) DO UPDATE
  SET pending_balance = vendor_wallets.pending_balance + v_credit,
      total_earned = vendor_wallets.total_earned + v_credit,
      updated_at = now();

  INSERT INTO public.vendor_transactions (store_id, type, amount, order_id, description)
  VALUES (v_store_id, 'credit', v_credit, NEW.id,
    'Commission commande ' || NEW.order_ref || ' livrée (' || (100 - v_commission_rate)::int || '%)');

  RETURN NEW;
END;
$$;

-- 7. Trigger: set delivered_at timestamp
CREATE OR REPLACE FUNCTION public.set_delivered_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_delivered_at ON public.orders;
CREATE TRIGGER trg_set_delivered_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivered_at();
