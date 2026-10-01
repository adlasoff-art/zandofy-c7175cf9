-- Purpose: Harden orders UPDATE so buyers cannot self-confirm deferred payments
--          and store teams cannot forge admin off-platform release columns.
-- Tables: orders (trigger enforce_orders_sensitive_column_guards)
-- Risk: medium — changes client UPDATE semantics; UI already uses intended columns.
-- Rollback: DROP TRIGGER trg_orders_sensitive_column_guards; DROP FUNCTION enforce_orders_sensitive_column_guards.
-- Staging → production: apply after frontend deploy that still uses direct updates
--          (trigger allows legitimate vendor verify + admin release paths).

CREATE OR REPLACE FUNCTION public.enforce_orders_sensitive_column_guards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_store_team boolean;
  v_is_buyer boolean;
  v_deferred boolean;
BEGIN
  -- service_role / no JWT (Edge, triggers) — allow
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_admin :=
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'manager'::app_role);
  v_is_buyer := (NEW.user_id = v_uid);
  v_is_store_team := public.can_access_store_orders(v_uid, NEW.store_id);
  v_deferred := COALESCE(NEW.payment_method, OLD.payment_method) IN ('off_platform', 'whatsapp');

  -- Admin-only: off_platform_admin_released_*
  IF (
    NEW.off_platform_admin_released_at IS DISTINCT FROM OLD.off_platform_admin_released_at
    OR NEW.off_platform_admin_released_by IS DISTINCT FROM OLD.off_platform_admin_released_by
  ) AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Seul un admin peut libérer une commande hors plateforme'
      USING ERRCODE = 'P0001';
  END IF;

  -- Buyer must not set vendor-verify or admin-release columns
  IF v_is_buyer AND NOT v_is_admin AND NOT v_is_store_team THEN
    IF (
      NEW.off_platform_vendor_verified_at IS DISTINCT FROM OLD.off_platform_vendor_verified_at
      OR NEW.off_platform_vendor_verified_by IS DISTINCT FROM OLD.off_platform_vendor_verified_by
      OR NEW.off_platform_admin_released_at IS DISTINCT FROM OLD.off_platform_admin_released_at
      OR NEW.off_platform_admin_released_by IS DISTINCT FROM OLD.off_platform_admin_released_by
    ) THEN
      RAISE EXCEPTION 'Action non autorisée sur les colonnes de validation paiement'
        USING ERRCODE = 'P0001';
    END IF;

    -- Buyer cannot advance deferred awaiting_payment → pending/confirmed (self-confirm)
    IF v_deferred
       AND OLD.status = 'awaiting_payment'
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered')
    THEN
      RAISE EXCEPTION 'Le client ne peut pas confirmer lui-même un paiement différé'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Store team cannot forge admin release
  IF v_is_store_team AND NOT v_is_admin THEN
    IF (
      NEW.off_platform_admin_released_at IS DISTINCT FROM OLD.off_platform_admin_released_at
      OR NEW.off_platform_admin_released_by IS DISTINCT FROM OLD.off_platform_admin_released_by
    ) THEN
      RAISE EXCEPTION 'La libération admin hors plateforme est réservée au staff'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_sensitive_column_guards ON public.orders;
CREATE TRIGGER trg_orders_sensitive_column_guards
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_orders_sensitive_column_guards();

COMMENT ON FUNCTION public.enforce_orders_sensitive_column_guards() IS
  'Blocks buyer self-confirm of deferred payments and non-admin forging of off_platform_admin_released_*.';

-- Soft-delete defense: non-admins cannot read soft-deleted profiles via PostgREST
-- (auth ban already prevents login; this covers lingering JWTs / direct API).
-- IMPORTANT: do NOT DROP "Users read own profile" — restrictive policies do not grant access.
-- Prefer additive restrictive policy only.

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Hide soft-deleted profiles from non-admins" ON public.profiles;
    CREATE POLICY "Hide soft-deleted profiles from non-admins"
      ON public.profiles
      AS RESTRICTIVE
      FOR SELECT
      TO authenticated
      USING (
        deleted_at IS NULL
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR id = auth.uid() -- allow self-read so restore UX / banner can detect state
      );
  EXCEPTION
    WHEN undefined_column THEN
      RAISE NOTICE 'profiles.deleted_at missing — skip soft-delete SELECT guard';
    WHEN OTHERS THEN
      RAISE NOTICE 'soft-delete profile policy skipped: %', SQLERRM;
  END;
END $$;
