
-- Add approval and reward tracking to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reward_granted boolean NOT NULL DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Function to credit review bonus points when admin approves a review with images
CREATE OR REPLACE FUNCTION public.credit_review_bonus_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_subtotal numeric;
  v_bonus numeric;
  v_has_images boolean;
  v_order_id uuid;
BEGIN
  -- Only fire when is_approved changes from false to true
  IF NOT (NEW.is_approved = true AND OLD.is_approved = false) THEN
    RETURN NEW;
  END IF;

  -- Skip if already rewarded
  IF NEW.reward_granted = true THEN
    RETURN NEW;
  END IF;

  -- Check if review has images
  v_has_images := (NEW.images IS NOT NULL AND array_length(NEW.images, 1) > 0);
  IF NOT v_has_images THEN
    RETURN NEW;
  END IF;

  -- Find the most recent delivered order for this user containing this product
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

  -- Calculate 0.10% bonus
  v_bonus := ROUND(v_order_subtotal * 0.001, 2);

  IF v_bonus <= 0 THEN
    RETURN NEW;
  END IF;

  -- Credit the user's zando_points
  INSERT INTO public.zando_points (user_id, balance, total_earned)
  VALUES (NEW.user_id, v_bonus, v_bonus)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = zando_points.balance + v_bonus,
      total_earned = zando_points.total_earned + v_bonus,
      updated_at = now();

  -- Log the transaction
  INSERT INTO public.point_transactions (user_id, type, amount, order_id, description)
  VALUES (
    NEW.user_id,
    'earned',
    v_bonus,
    v_order_id,
    'Bonus avis vérifié avec photos (0.10% de $' || v_order_subtotal::text || ')'
  );

  -- Notify the user
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    NEW.user_id,
    'points',
    'Points bonus avis !',
    v_bonus || ' ZandoPoints crédités pour votre avis vérifié avec photos.',
    '/dashboard'
  );

  -- Mark as rewarded
  NEW.reward_granted := true;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_credit_review_bonus ON public.reviews;
CREATE TRIGGER trg_credit_review_bonus
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_review_bonus_points();
