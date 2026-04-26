-- Lot A : Cohérence statuts paiement / logistique
CREATE OR REPLACE FUNCTION public.sync_logistics_payment_on_order_failure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('payment_failed', 'cancelled', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.shipping_payment_status = 'paid'
       AND COALESCE(NEW.shipping_payment_proof_url, '') = '' THEN
      NEW.shipping_payment_status := 'unpaid';
    END IF;
    IF NEW.last_mile_payment_status IN ('paid', 'paid_online')
       AND COALESCE(NEW.last_mile_payment_proof_url, '') = '' THEN
      NEW.last_mile_payment_status := 'unpaid';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_logistics_payment_on_order_failure ON public.orders;
CREATE TRIGGER trg_sync_logistics_payment_on_order_failure
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_logistics_payment_on_order_failure();

UPDATE public.orders
SET shipping_payment_status = 'unpaid'
WHERE status IN ('payment_failed', 'cancelled', 'returned')
  AND shipping_payment_status = 'paid'
  AND COALESCE(shipping_payment_proof_url, '') = '';

UPDATE public.orders
SET last_mile_payment_status = 'unpaid'
WHERE status IN ('payment_failed', 'cancelled', 'returned')
  AND last_mile_payment_status IN ('paid', 'paid_online')
  AND COALESCE(last_mile_payment_proof_url, '') = '';

-- Lot B : Modération des avis (reviews)
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS reward_granted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON public.reviews(is_approved);

DROP POLICY IF EXISTS "Staff manage reviews" ON public.reviews;
CREATE POLICY "Staff manage reviews"
ON public.reviews
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Public read reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public read approved reviews" ON public.reviews;
CREATE POLICY "Public read approved reviews"
ON public.reviews
FOR SELECT
USING (
  is_approved = true
  OR auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);