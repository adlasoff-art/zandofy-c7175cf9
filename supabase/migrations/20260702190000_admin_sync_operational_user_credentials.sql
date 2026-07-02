-- Post-sync after admin changes email on operational accounts (Auth + profiles + logistics contacts).
-- Called only from the admin-users edge function (service_role).

CREATE OR REPLACE FUNCTION public.admin_post_credentials_sync(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_revoke_oauth boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    UPDATE public.profiles
    SET email = lower(trim(p_email))
    WHERE id = p_user_id;

    UPDATE public.delivery_operators
    SET contact_email = lower(trim(p_email))
    WHERE owner_user_id = p_user_id;

    UPDATE public.forwarders
    SET contact_email = lower(trim(p_email))
    WHERE owner_user_id = p_user_id;

    UPDATE auth.identities
    SET
      identity_data = jsonb_set(identity_data, '{email}', to_jsonb(lower(trim(p_email)))),
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  IF p_revoke_oauth THEN
    DELETE FROM auth.identities
    WHERE user_id = p_user_id AND provider = 'google';

    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
      jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{provider}',
        '"email"'::jsonb
      ),
      '{providers}',
      '["email"]'::jsonb
    )
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_post_credentials_sync(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_post_credentials_sync(uuid, text, boolean) TO service_role;
