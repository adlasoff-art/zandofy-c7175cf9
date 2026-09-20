-- Purpose: Local vendors can mark home-delivery offer on products (vs air/sea for intl).
-- Tables: public.products
-- Risk: Additive nullable-default column only.
-- Rollback: ALTER TABLE products DROP COLUMN offers_home_delivery;
-- Staging → production: run after smoke vendor local catalogue form.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS offers_home_delivery boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.offers_home_delivery IS
  'Local shops: vendor offers home delivery for this product. Ignored for international air/sea modes.';
