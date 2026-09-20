-- Purpose: Séparer preuve paiement PRODUIT (hors plateforme) de preuve EXPÉDITION différée.
-- Tables: public.orders
-- Risk (~4000+ users): Additive ADD COLUMN + backfill ciblé off_platform ; clear shipping proof
--   only when product proof was copied and shipping_payment_status = deferred (overload undo).
-- Rollback: DROP COLUMN product_payment_proof_url (après gel des uploads nouveaux).
-- Staging → production: run same file in SQL Editor after smoke.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_payment_proof_url text;

COMMENT ON COLUMN public.orders.product_payment_proof_url IS
  'Preuve de paiement PRODUIT (hors plateforme). Distinct de shipping_payment_proof_url (expédition différée).';

-- Backfill: preuve actuelle dans shipping_* pour commandes hors plateforme → produit
UPDATE public.orders
SET product_payment_proof_url = shipping_payment_proof_url
WHERE payment_method = 'off_platform'
  AND shipping_payment_proof_url IS NOT NULL
  AND COALESCE(shipping_payment_proof_url, '') <> ''
  AND product_payment_proof_url IS NULL;

-- Libérer le champ expédition quand il ne servait que de preuve produit (deferred)
UPDATE public.orders
SET shipping_payment_proof_url = NULL
WHERE payment_method = 'off_platform'
  AND shipping_payment_status = 'deferred'
  AND product_payment_proof_url IS NOT NULL
  AND shipping_payment_proof_url IS NOT NULL
  AND shipping_payment_proof_url = product_payment_proof_url;

CREATE INDEX IF NOT EXISTS idx_orders_off_platform_product_proof
  ON public.orders (created_at DESC)
  WHERE payment_method = 'off_platform'
    AND product_payment_proof_url IS NOT NULL;
