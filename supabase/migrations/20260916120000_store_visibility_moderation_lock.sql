-- Purpose: Harden store visibility if 20260914120000 already ran without §7 / REVOKEs.
-- Idempotent: safe to re-run; skips views that do not exist yet.
-- Prerequisite: prefer running 20260914120000_store_public_visibility.sql FIRST
--   (creates stores_seo + filtered stores_public / products_public).
-- Risk: low — locks moderation columns for non-admin; SELECT-only on public views.

-- SELECT-only grants (only if the view already exists)
DO $$
BEGIN
  IF to_regclass('public.stores_public') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.stores_public FROM PUBLIC;
    REVOKE ALL ON TABLE public.stores_public FROM anon;
    REVOKE ALL ON TABLE public.stores_public FROM authenticated;
    GRANT SELECT ON TABLE public.stores_public TO anon, authenticated;
    GRANT SELECT ON TABLE public.stores_public TO service_role;
  END IF;

  IF to_regclass('public.stores_seo') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.stores_seo FROM PUBLIC;
    REVOKE ALL ON TABLE public.stores_seo FROM anon;
    REVOKE ALL ON TABLE public.stores_seo FROM authenticated;
    GRANT SELECT ON TABLE public.stores_seo TO anon, authenticated;
    GRANT SELECT ON TABLE public.stores_seo TO service_role;
  END IF;

  IF to_regclass('public.products_public') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.products_public FROM PUBLIC;
    REVOKE ALL ON TABLE public.products_public FROM anon;
    REVOKE ALL ON TABLE public.products_public FROM authenticated;
    GRANT SELECT ON TABLE public.products_public TO anon, authenticated;
    GRANT SELECT ON TABLE public.products_public TO service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.protect_store_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  v_is_staff :=
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role);

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_activities IS DISTINCT FROM OLD.suspended_activities
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
     OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
     OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
     OR NEW.delete_reason IS DISTINCT FROM OLD.delete_reason
  THEN
    RAISE EXCEPTION 'store_moderation_columns_locked'
      USING ERRCODE = '42501',
            HINT = 'Only admin/manager may change ban, suspend, or soft-archive fields.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_store_moderation_columns ON public.stores;
CREATE TRIGGER trg_protect_store_moderation_columns
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_store_moderation_columns();
