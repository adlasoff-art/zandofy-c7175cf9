
-- Fix: referral_code default '' causes UNIQUE violation on 2nd signup
-- Change default to NULL and update existing empty strings to NULL
UPDATE public.profiles SET referral_code = NULL WHERE referral_code = '';

ALTER TABLE public.profiles ALTER COLUMN referral_code SET DEFAULT NULL;

-- Also update handle_new_user to generate a unique referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'email', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'full_name'),
    NEW.raw_user_meta_data ->> 'last_name',
    UPPER(SUBSTRING(md5(gen_random_uuid()::text) FROM 1 FOR 8))
  );
  RETURN NEW;
END;
$$;
