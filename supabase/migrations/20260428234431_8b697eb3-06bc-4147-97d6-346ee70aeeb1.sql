-- Auto-approve forwarders created by an admin and unlock existing pending platform forwarders.

-- 1) Trigger function : if creator is admin, force status='approved' + is_active=true.
CREATE OR REPLACE FUNCTION public.auto_approve_admin_forwarder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'approved';
    NEW.is_active := true;
    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;
    IF NEW.approved_by IS NULL THEN
      NEW.approved_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_admin_forwarder ON public.forwarders;
CREATE TRIGGER trg_auto_approve_admin_forwarder
BEFORE INSERT ON public.forwarders
FOR EACH ROW EXECUTE FUNCTION public.auto_approve_admin_forwarder();

-- 2) One-shot: unblock platform-owned forwarders currently pending.
UPDATE public.forwarders
SET status = 'approved',
    is_active = true,
    approved_at = COALESCE(approved_at, now())
WHERE status = 'pending' AND is_platform_owned = true;