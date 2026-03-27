
-- 1. Add payment_type column to payment_transactions
ALTER TABLE public.payment_transactions 
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'order';

-- 2. Add gateway_fees setting
INSERT INTO public.platform_settings (key, value)
VALUES ('gateway_fees', '{"mobile_money_fee_pct": 2.5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Add review_bonus setting
INSERT INTO public.platform_settings (key, value)
VALUES ('review_bonus', '{"bonus_pct": 0.10}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Update credit_review_bonus_points trigger to read dynamic bonus_pct
CREATE OR REPLACE FUNCTION public.credit_review_bonus_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_subtotal numeric;
  v_bonus numeric;
  v_has_images boolean;
  v_order_id uuid;
  v_bonus_pct numeric;
BEGIN
  IF NOT (NEW.is_approved = true AND OLD.is_approved = false) THEN
    RETURN NEW;
  END IF;

  IF NEW.reward_granted = true THEN
    RETURN NEW;
  END IF;

  v_has_images := (NEW.images IS NOT NULL AND array_length(NEW.images, 1) > 0);
  IF NOT v_has_images THEN
    RETURN NEW;
  END IF;

  -- Read dynamic bonus_pct from platform_settings (fallback 0.10 = 0.001 multiplier)
  SELECT COALESCE((value->>'bonus_pct')::numeric, 0.10) / 100.0
  INTO v_bonus_pct
  FROM public.platform_settings
  WHERE key = 'review_bonus';

  IF v_bonus_pct IS NULL THEN
    v_bonus_pct := 0.001;
  END IF;

  SELECT o.id, o.subtotal INTO v_order_id, v_order_subtotal
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.user_id = NEW.user_id
    AND oi.product_id = NEW.product_id
    AND o.status = 'delivered'
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF v_order_id IS NULL OR v_order_subtotal IS NULL OR v_order_subtotal <= 0 THEN
    RETURN NEW;
  END IF;

  v_bonus := ROUND(v_order_subtotal * v_bonus_pct, 2);

  IF v_bonus <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.zando_points (user_id, balance, total_earned)
  VALUES (NEW.user_id, v_bonus, v_bonus)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = zando_points.balance + v_bonus,
      total_earned = zando_points.total_earned + v_bonus,
      updated_at = now();

  INSERT INTO public.point_transactions (user_id, type, amount, order_id, description)
  VALUES (
    NEW.user_id,
    'earned',
    v_bonus,
    v_order_id,
    'Bonus avis vérifié avec photos (' || (v_bonus_pct * 100)::text || '% de $' || v_order_subtotal::text || ')'
  );

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    NEW.user_id,
    'points',
    'Points bonus avis !',
    v_bonus || ' ZandoPoints crédités pour votre avis vérifié avec photos.',
    '/dashboard'
  );

  NEW.reward_granted := true;
  RETURN NEW;
END;
$function$;
