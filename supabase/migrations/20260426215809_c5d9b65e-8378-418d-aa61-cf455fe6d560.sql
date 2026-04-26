-- Lot 11B Phase B8 — Checkout : ne montrer que les opérateurs avec couverture + tarif approuvé.
-- Durcit la vue v_active_operators_by_city pour exclure tout opérateur sans rate
-- (is_active=true AND status='approved') sur la ville donnée.

CREATE OR REPLACE VIEW public.v_active_operators_by_city
WITH (security_invoker = true)
AS
SELECT
  o.id AS operator_id,
  o.company_name,
  o.logo_url,
  o.rating_avg,
  o.total_deliveries,
  o.is_platform_owned,
  c.country_code,
  c.city,
  (
    SELECT MIN(r.base_price + COALESCE(r.surcharge, 0))
    FROM public.delivery_operator_rates r
    WHERE r.operator_id = o.id
      AND r.country_code = c.country_code
      AND r.city = c.city
      AND r.is_active = true
      AND r.status = 'approved'
  ) AS min_fee_preview,
  (
    SELECT MIN(r.estimated_minutes)
    FROM public.delivery_operator_rates r
    WHERE r.operator_id = o.id
      AND r.country_code = c.country_code
      AND r.city = c.city
      AND r.is_active = true
      AND r.status = 'approved'
  ) AS min_eta_minutes
FROM public.delivery_operators o
JOIN public.delivery_operator_cities c ON c.operator_id = o.id
WHERE o.is_active = true
  AND o.status = 'approved'
  AND c.is_active = true
  -- B8 : un opérateur n'apparaît que s'il a au moins un tarif approuvé actif sur cette ville
  AND EXISTS (
    SELECT 1
    FROM public.delivery_operator_rates r
    WHERE r.operator_id = o.id
      AND r.country_code = c.country_code
      AND r.city = c.city
      AND r.is_active = true
      AND r.status = 'approved'
  );