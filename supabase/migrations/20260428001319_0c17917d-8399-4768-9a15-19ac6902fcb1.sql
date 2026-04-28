-- Fonction cleanup
CREATE OR REPLACE FUNCTION public.cleanup_old_health_checks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.health_checks WHERE checked_at < now() - interval '30 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_health_checks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_health_checks() TO service_role;

-- Activation extensions cron + http si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;