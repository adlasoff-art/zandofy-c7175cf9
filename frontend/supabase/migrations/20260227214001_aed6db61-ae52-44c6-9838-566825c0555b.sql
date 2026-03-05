
-- Gift cards table for ZandoPoints conversion
CREATE TABLE public.gift_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  original_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  points_used numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone,
  expires_at timestamp with time zone
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own gift cards" ON public.gift_cards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own gift cards" ON public.gift_cards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own gift cards" ON public.gift_cards FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Staff read all gift cards" ON public.gift_cards FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);

-- Add last_activity_at to zando_points for expiration tracking
ALTER TABLE public.zando_points ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone NOT NULL DEFAULT now();

-- Trigger to update last_activity_at on any point transaction
CREATE OR REPLACE FUNCTION public.update_points_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.zando_points
  SET last_activity_at = now(), updated_at = now()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_points_activity
AFTER INSERT ON public.point_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_points_activity();

-- Function to expire inactive points (called via cron or admin action)
CREATE OR REPLACE FUNCTION public.expire_inactive_points(months_limit int DEFAULT 12)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_count int := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT user_id, balance
    FROM public.zando_points
    WHERE balance > 0
      AND last_activity_at < now() - (months_limit || ' months')::interval
  LOOP
    -- Void the balance
    UPDATE public.zando_points
    SET balance = 0, updated_at = now()
    WHERE user_id = rec.user_id;

    -- Log the expiration
    INSERT INTO public.point_transactions (user_id, type, amount, description)
    VALUES (rec.user_id, 'expired', -rec.balance, 'Points expirés après ' || months_limit || ' mois d''inactivité');

    -- Notify user
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (rec.user_id, 'points', 'Points expirés', rec.balance || ' ZandoPoints ont expiré suite à ' || months_limit || ' mois d''inactivité.', '/dashboard');

    expired_count := expired_count + 1;
  END LOOP;

  RETURN expired_count;
END;
$$;
