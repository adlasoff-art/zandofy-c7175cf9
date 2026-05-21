-- Idempotent products.slug column + backfill + trigger (preview parity with prod migration 20260420130000).

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.products
SET slug = lower(regexp_replace(
  regexp_replace(
    translate(coalesce(NULLIF(btrim(name_fr),''), NULLIF(btrim(name),''), 'produit'),
              'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
              'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'),
    '[^a-zA-Z0-9]+', '-', 'g'),
  '-{2,}', '-', 'g'))
WHERE slug IS NULL OR length(btrim(slug)) = 0;

UPDATE public.products SET slug = btrim(slug, '-') WHERE slug LIKE '-%' OR slug LIKE '%-';
UPDATE public.products SET slug = 'produit' WHERE slug IS NULL OR slug = '';

WITH dups AS (
  SELECT id, slug,
         row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.products WHERE slug <> ''
)
UPDATE public.products p
SET slug = p.slug || '-' || substr(md5(p.id::text), 1, 5)
FROM dups WHERE p.id = dups.id AND dups.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug) WHERE slug <> '';
ALTER TABLE public.products ALTER COLUMN slug SET DEFAULT '';
ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;

CREATE OR REPLACE FUNCTION public.products_ensure_slug()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base TEXT; cand TEXT; n INT; i INT := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND length(btrim(NEW.slug)) > 0 THEN RETURN NEW; END IF;
  base := coalesce(NULLIF(btrim(NEW.name_fr),''), NULLIF(btrim(NEW.name),''), 'produit');
  base := translate(base,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
    'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC');
  base := lower(regexp_replace(base, '[^a-zA-Z0-9]+', '-', 'g'));
  base := btrim(regexp_replace(base, '-{2,}', '-', 'g'), '-');
  IF base = '' THEN base := 'produit'; END IF;
  base := left(base, 80);
  cand := base;
  LOOP
    SELECT count(*) INTO n FROM public.products
     WHERE slug = cand AND (TG_OP='INSERT' OR id <> NEW.id);
    EXIT WHEN n = 0 OR i >= 6;
    i := i+1;
    cand := base || '-' || substr(md5(random()::text||clock_timestamp()::text), 1, 5);
  END LOOP;
  IF n > 0 THEN cand := base || '-' || substr(md5(NEW.id::text||clock_timestamp()::text), 1, 8); END IF;
  NEW.slug := cand;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_ensure_slug ON public.products;
CREATE TRIGGER trg_products_ensure_slug
BEFORE INSERT OR UPDATE OF name, name_fr, slug ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_ensure_slug();