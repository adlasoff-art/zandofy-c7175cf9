-- Lot 11B Phase 6 — Notify admins on new pending operator rates

CREATE OR REPLACE FUNCTION public.notify_admins_new_operator_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op RECORD;
  v_admin RECORD;
BEGIN
  -- Only notify for pending rates from non-platform operators
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT id, company_name, is_platform_owned
    INTO v_op
    FROM public.delivery_operators
   WHERE id = NEW.operator_id;

  IF v_op.is_platform_owned THEN
    RETURN NEW;
  END IF;

  -- Insert in-app notification for each admin/manager
  FOR v_admin IN
    SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
     WHERE ur.role IN ('admin', 'manager')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      v_admin.user_id,
      'operator_rate_pending',
      'Nouveau tarif opérateur à valider',
      v_op.company_name || ' a soumis un tarif pour ' || NEW.city || ' / ' || NEW.zone_name
        || ' (' || NEW.base_price || ' ' || NEW.currency || ')',
      '/admin/operator-rates-pending',
      jsonb_build_object(
        'rate_id', NEW.id,
        'operator_id', NEW.operator_id,
        'operator_name', v_op.company_name,
        'city', NEW.city,
        'zone_name', NEW.zone_name,
        'base_price', NEW.base_price,
        'currency', NEW.currency
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_operator_rate ON public.delivery_operator_rates;
CREATE TRIGGER trg_notify_admins_new_operator_rate
AFTER INSERT ON public.delivery_operator_rates
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_new_operator_rate();