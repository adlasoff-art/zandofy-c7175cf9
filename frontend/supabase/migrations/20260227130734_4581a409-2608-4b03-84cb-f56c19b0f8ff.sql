
-- Trigger function: when order status changes to 'delivered', finalize pending points
-- When status changes to 'cancelled' or 'returned', void pending points
CREATE OR REPLACE FUNCTION public.finalize_referral_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral RECORD;
  v_commission numeric;
  v_settings jsonb;
  v_max_orders int;
BEGIN
  -- Only act on status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- CASE 1: Order delivered → finalize pending points for referrer
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Find active referral where this order's user is the referee
    SELECT r.* INTO v_referral
    FROM public.referrals r
    WHERE r.referee_id = NEW.user_id
      AND r.status = 'active'
    LIMIT 1;

    IF v_referral IS NOT NULL AND v_referral.rewarded_orders_count < v_referral.max_rewarded_orders THEN
      -- Calculate commission
      v_commission := ROUND((NEW.subtotal * v_referral.commission_pct / 100), 2);

      IF v_commission > 0 THEN
        -- Credit referrer's wallet: move from pending to balance
        UPDATE public.zando_points
        SET balance = balance + v_commission,
            pending_balance = GREATEST(pending_balance - v_commission, 0),
            total_earned = total_earned + v_commission,
            updated_at = now()
        WHERE user_id = v_referral.referrer_id;

        -- Log the finalized transaction
        INSERT INTO public.point_transactions (user_id, type, amount, order_id, referral_id, description)
        VALUES (
          v_referral.referrer_id,
          'earned',
          v_commission,
          NEW.id,
          v_referral.id,
          'Commission finalisée - commande ' || NEW.order_ref || ' livrée'
        );

        -- Increment rewarded orders counter
        UPDATE public.referrals
        SET rewarded_orders_count = rewarded_orders_count + 1
        WHERE id = v_referral.id;

        -- If max reached, complete the referral
        IF v_referral.rewarded_orders_count + 1 >= v_referral.max_rewarded_orders THEN
          UPDATE public.referrals SET status = 'completed' WHERE id = v_referral.id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- CASE 2: Order cancelled or returned → void any pending points
  IF NEW.status IN ('cancelled', 'returned') AND OLD.status NOT IN ('cancelled', 'returned') THEN
    SELECT r.* INTO v_referral
    FROM public.referrals r
    WHERE r.referee_id = NEW.user_id
      AND r.status = 'active'
    LIMIT 1;

    IF v_referral IS NOT NULL THEN
      v_commission := ROUND((NEW.subtotal * v_referral.commission_pct / 100), 2);

      IF v_commission > 0 THEN
        -- Remove from pending balance
        UPDATE public.zando_points
        SET pending_balance = GREATEST(pending_balance - v_commission, 0),
            updated_at = now()
        WHERE user_id = v_referral.referrer_id;

        -- Log the voided transaction
        INSERT INTO public.point_transactions (user_id, type, amount, order_id, referral_id, description)
        VALUES (
          v_referral.referrer_id,
          'voided',
          -v_commission,
          NEW.id,
          v_referral.id,
          'Points annulés - commande ' || NEW.order_ref || ' ' || NEW.status
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to orders table
CREATE TRIGGER trg_finalize_referral_points
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.finalize_referral_points();
