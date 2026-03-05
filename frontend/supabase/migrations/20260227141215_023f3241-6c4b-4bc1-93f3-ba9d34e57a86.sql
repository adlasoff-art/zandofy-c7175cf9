
-- Update create_pending_referral_points to notify the referrer
CREATE OR REPLACE FUNCTION public.create_pending_referral_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral RECORD;
  v_commission numeric;
BEGIN
  SELECT r.* INTO v_referral
  FROM public.referrals r
  WHERE r.referee_id = NEW.user_id
    AND r.status = 'active'
    AND r.rewarded_orders_count < r.max_rewarded_orders
  LIMIT 1;

  IF v_referral IS NOT NULL THEN
    v_commission := ROUND((NEW.subtotal * v_referral.commission_pct / 100), 2);

    IF v_commission > 0 THEN
      UPDATE public.zando_points
      SET pending_balance = pending_balance + v_commission,
          updated_at = now()
      WHERE user_id = v_referral.referrer_id;

      IF NOT FOUND THEN
        INSERT INTO public.zando_points (user_id, pending_balance)
        VALUES (v_referral.referrer_id, v_commission);
      END IF;

      INSERT INTO public.point_transactions (user_id, type, amount, order_id, referral_id, description)
      VALUES (
        v_referral.referrer_id,
        'pending',
        v_commission,
        NEW.id,
        v_referral.id,
        'Commission en attente - commande ' || NEW.order_ref || ' par filleul'
      );

      -- Notify referrer about pending points
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_referral.referrer_id,
        'points',
        'Points en attente',
        'Vous avez reçu ' || v_commission || ' ZandoPoints en attente suite à la commande ' || NEW.order_ref || ' de votre filleul.',
        '/dashboard'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update finalize_referral_points to notify the referrer
CREATE OR REPLACE FUNCTION public.finalize_referral_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral RECORD;
  v_commission numeric;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- CASE 1: Order delivered → finalize pending points
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    SELECT r.* INTO v_referral
    FROM public.referrals r
    WHERE r.referee_id = NEW.user_id
      AND r.status = 'active'
    LIMIT 1;

    IF v_referral IS NOT NULL AND v_referral.rewarded_orders_count < v_referral.max_rewarded_orders THEN
      v_commission := ROUND((NEW.subtotal * v_referral.commission_pct / 100), 2);

      IF v_commission > 0 THEN
        UPDATE public.zando_points
        SET balance = balance + v_commission,
            pending_balance = GREATEST(pending_balance - v_commission, 0),
            total_earned = total_earned + v_commission,
            updated_at = now()
        WHERE user_id = v_referral.referrer_id;

        INSERT INTO public.point_transactions (user_id, type, amount, order_id, referral_id, description)
        VALUES (
          v_referral.referrer_id,
          'earned',
          v_commission,
          NEW.id,
          v_referral.id,
          'Commission finalisée - commande ' || NEW.order_ref || ' livrée'
        );

        UPDATE public.referrals
        SET rewarded_orders_count = rewarded_orders_count + 1
        WHERE id = v_referral.id;

        IF v_referral.rewarded_orders_count + 1 >= v_referral.max_rewarded_orders THEN
          UPDATE public.referrals SET status = 'completed' WHERE id = v_referral.id;
        END IF;

        -- Notify referrer about finalized points
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          v_referral.referrer_id,
          'points',
          'Points crédités !',
          v_commission || ' ZandoPoints ont été ajoutés à votre solde suite à la livraison de la commande ' || NEW.order_ref || '.',
          '/dashboard'
        );
      END IF;
    END IF;
  END IF;

  -- CASE 2: Order cancelled or returned → void pending points
  IF NEW.status IN ('cancelled', 'returned') AND OLD.status NOT IN ('cancelled', 'returned') THEN
    SELECT r.* INTO v_referral
    FROM public.referrals r
    WHERE r.referee_id = NEW.user_id
      AND r.status = 'active'
    LIMIT 1;

    IF v_referral IS NOT NULL THEN
      v_commission := ROUND((NEW.subtotal * v_referral.commission_pct / 100), 2);

      IF v_commission > 0 THEN
        UPDATE public.zando_points
        SET pending_balance = GREATEST(pending_balance - v_commission, 0),
            updated_at = now()
        WHERE user_id = v_referral.referrer_id;

        INSERT INTO public.point_transactions (user_id, type, amount, order_id, referral_id, description)
        VALUES (
          v_referral.referrer_id,
          'voided',
          -v_commission,
          NEW.id,
          v_referral.id,
          'Points annulés - commande ' || NEW.order_ref || ' ' || NEW.status
        );

        -- Notify referrer about voided points
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          v_referral.referrer_id,
          'points',
          'Points annulés',
          v_commission || ' ZandoPoints en attente ont été annulés suite à l''annulation de la commande ' || NEW.order_ref || '.',
          '/dashboard'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
