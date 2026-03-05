
-- Trigger: when a new order is created by a referee, add pending points to referrer's wallet
CREATE OR REPLACE FUNCTION public.create_pending_referral_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral RECORD;
  v_commission numeric;
BEGIN
  -- Find active referral where this order's user is the referee
  SELECT r.* INTO v_referral
  FROM public.referrals r
  WHERE r.referee_id = NEW.user_id
    AND r.status = 'active'
    AND r.rewarded_orders_count < r.max_rewarded_orders
  LIMIT 1;

  IF v_referral IS NOT NULL THEN
    -- Calculate commission
    v_commission := ROUND((NEW.subtotal * v_referral.commission_pct / 100), 2);

    IF v_commission > 0 THEN
      -- Add to referrer's pending balance
      UPDATE public.zando_points
      SET pending_balance = pending_balance + v_commission,
          updated_at = now()
      WHERE user_id = v_referral.referrer_id;

      -- If no wallet exists, create one
      IF NOT FOUND THEN
        INSERT INTO public.zando_points (user_id, pending_balance)
        VALUES (v_referral.referrer_id, v_commission);
      END IF;

      -- Log pending transaction
      INSERT INTO public.point_transactions (user_id, type, amount, order_id, referral_id, description)
      VALUES (
        v_referral.referrer_id,
        'pending',
        v_commission,
        NEW.id,
        v_referral.id,
        'Commission en attente - commande ' || NEW.order_ref || ' par filleul'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to orders table on INSERT
CREATE TRIGGER trg_create_pending_referral_points
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_pending_referral_points();
