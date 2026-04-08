
-- Table for webhook API requests (approval workflow)
CREATE TABLE IF NOT EXISTS public.webhook_api_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requested_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_api_requests ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own requests
CREATE POLICY "Vendors view own webhook requests"
  ON public.webhook_api_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Vendors can create requests for their own store
CREATE POLICY "Vendors create webhook requests"
  ON public.webhook_api_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id
      AND (s.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.store_collaborators sc
        WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
      ))
    )
  );

-- Only admins/managers can update (approve/reject)
CREATE POLICY "Admins manage webhook requests"
  ON public.webhook_api_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Add webhook_approved flag to vendor_pricing_overrides
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS webhook_approved boolean NOT NULL DEFAULT false;

-- Trigger: auto-set independent defaults when store leaves platform ownership
CREATE OR REPLACE FUNCTION public.auto_set_independent_defaults()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Only fire when is_platform_owned changes from true to false
  IF OLD.is_platform_owned = true AND NEW.is_platform_owned = false THEN
    INSERT INTO public.vendor_pricing_overrides (
      store_id,
      vendor_mobile_money_enabled,
      vendor_card_enabled,
      vendor_cod_enabled,
      vendor_off_platform_enabled,
      vendor_custom_payment_numbers_enabled,
      vendor_mode,
      webhook_approved,
      updated_at
    ) VALUES (
      NEW.id,
      false,  -- Mobile Money OFF
      false,  -- Card OFF
      false,  -- COD OFF
      true,   -- Off-platform ON
      true,   -- Custom numbers ON
      'local_only',
      false,
      now()
    )
    ON CONFLICT (store_id) DO UPDATE SET
      vendor_mobile_money_enabled = false,
      vendor_card_enabled = false,
      vendor_cod_enabled = false,
      vendor_off_platform_enabled = true,
      vendor_custom_payment_numbers_enabled = true,
      vendor_mode = 'local_only',
      webhook_approved = false,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_set_independent_defaults
  AFTER UPDATE OF is_platform_owned ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_independent_defaults();
