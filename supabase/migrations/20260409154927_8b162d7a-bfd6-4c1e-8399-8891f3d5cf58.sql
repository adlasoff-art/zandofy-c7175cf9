
CREATE OR REPLACE FUNCTION public.notify_admins_on_error_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin RECORD;
BEGIN
  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_admin.user_id,
      'system',
      'Nouvelle erreur signalée',
      LEFT('Erreur sur ' || COALESCE(NEW.page_path, 'page inconnue') || ' : ' || NEW.error_message, 120),
      '/admin/error-reports'
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_error ON public.error_reports;
CREATE TRIGGER trg_notify_admins_on_error
  AFTER INSERT ON public.error_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_error_report();
