
-- 1. Allow admins (and managers) to update any store
CREATE POLICY "Admins update any store"
  ON public.stores FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- 2. Create platform_ownership_claims table
CREATE TABLE public.platform_ownership_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days')
);

ALTER TABLE public.platform_ownership_claims ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own claims
CREATE POLICY "Vendors read own claims"
  ON public.platform_ownership_claims FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

-- Vendors can insert their own claims (to contest)
CREATE POLICY "Vendors insert own claims"
  ON public.platform_ownership_claims FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id = auth.uid());

-- Vendors can update own pending claims (to accept/contest)
CREATE POLICY "Vendors update own claims"
  ON public.platform_ownership_claims FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid() AND status = 'pending');

-- Admins can read all claims
CREATE POLICY "Admins read all claims"
  ON public.platform_ownership_claims FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- Admins can update any claim (accept/dismiss)
CREATE POLICY "Admins update any claim"
  ON public.platform_ownership_claims FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- Admins can delete claims
CREATE POLICY "Admins delete claims"
  ON public.platform_ownership_claims FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Trigger: when is_platform_owned changes to true, notify vendor + create claim
CREATE OR REPLACE FUNCTION public.notify_platform_ownership_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_store_name text;
BEGIN
  -- Only fire when is_platform_owned changes from false/null to true
  IF NEW.is_platform_owned = true AND (OLD.is_platform_owned IS DISTINCT FROM true) THEN
    v_owner_id := NEW.owner_id;
    v_store_name := NEW.name;

    IF v_owner_id IS NOT NULL THEN
      -- Create a pending claim for the vendor to contest within 72h
      INSERT INTO public.platform_ownership_claims (store_id, vendor_id, status)
      VALUES (NEW.id, v_owner_id, 'pending');

      -- In-app notification
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_owner_id,
        'system',
        'Changement de statut boutique',
        'Votre boutique "' || v_store_name || '" a été marquée comme appartenant à la plateforme. Si c''est une erreur, vous avez 72h pour contester depuis votre espace vendeur.',
        '/vendor'
      );
    END IF;
  END IF;

  -- When is_platform_owned changes back to false, notify vendor
  IF NEW.is_platform_owned = false AND OLD.is_platform_owned = true THEN
    v_owner_id := NEW.owner_id;
    v_store_name := NEW.name;

    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_owner_id,
        'system',
        'Boutique redevenue indépendante',
        'Votre boutique "' || v_store_name || '" est à nouveau considérée comme indépendante.',
        '/vendor'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_platform_ownership_change
  AFTER UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_platform_ownership_change();
