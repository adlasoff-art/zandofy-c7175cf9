-- ============================================================================
-- Backfill : products.origin_country depuis stores.country_code
-- Sécurité : ne touche QUE les produits sans origin_country, dont la boutique
--            a maintenant un country_code structuré (ISO-2).
-- Idempotent : peut être ré-exécuté sans effet de bord.
-- ============================================================================

BEGIN;

UPDATE public.products p
   SET origin_country = s.country_code
  FROM public.stores s
 WHERE p.store_id = s.id
   AND (p.origin_country IS NULL OR p.origin_country = '')
   AND s.country_code IS NOT NULL
   AND length(s.country_code) = 2;

-- Vérification
SELECT
  count(*) FILTER (WHERE origin_country IS NOT NULL AND origin_country <> '') AS with_origin,
  count(*) FILTER (WHERE origin_country IS NULL OR origin_country = '')       AS missing_origin,
  count(*)                                                                    AS total
FROM public.products;

COMMIT;
