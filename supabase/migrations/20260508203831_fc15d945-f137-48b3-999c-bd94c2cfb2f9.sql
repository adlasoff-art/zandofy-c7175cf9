-- Lot C: index ciblé pour la requête homepage anon
-- WHERE publish_status = 'published' ORDER BY rating DESC LIMIT N
-- Index partiel : très petit, zéro impact sur les writes.
CREATE INDEX IF NOT EXISTS idx_products_published_rating
  ON public.products (rating DESC NULLS LAST, created_at DESC)
  WHERE publish_status = 'published';