-- Réapplication du trigger logistics manquant sur orders
DROP TRIGGER IF EXISTS trg_sync_logistics_payment_on_order_failure ON public.orders;
CREATE TRIGGER trg_sync_logistics_payment_on_order_failure
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_logistics_payment_on_order_failure();

-- Nettoyage rétroactif au cas où des commandes incohérentes subsistent
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