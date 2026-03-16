CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral_code text;
  v_full_name text;
  v_first_name text;
  v_last_name text;
BEGIN
  v_full_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  v_first_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'first_name', '')), '');
  v_last_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')), '');

  IF v_first_name IS NULL AND v_full_name IS NOT NULL THEN
    v_first_name := split_part(v_full_name, ' ', 1);
  END IF;

  IF v_last_name IS NULL AND v_full_name IS NOT NULL AND position(' ' in v_full_name) > 0 THEN
    v_last_name := substring(v_full_name from position(' ' in v_full_name) + 1);
  END IF;

  v_referral_code := 'ZANDO-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8));

  BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, referral_code)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, NEW.raw_user_meta_data ->> 'email'),
      v_first_name,
      v_last_name,
      v_referral_code
    )
    ON CONFLICT (id) DO UPDATE
      SET email = COALESCE(EXCLUDED.email, public.profiles.email),
          first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
          last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
          updated_at = now();
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.profiles (id, email, first_name, last_name, referral_code)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, NEW.raw_user_meta_data ->> 'email'),
      v_first_name,
      v_last_name,
      NULL
    )
    ON CONFLICT (id) DO UPDATE
      SET email = COALESCE(EXCLUDED.email, public.profiles.email),
          first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
          last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
          updated_at = now();
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;