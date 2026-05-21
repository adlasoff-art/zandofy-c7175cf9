-- Auto-generate a unique URL slug for products when missing.
-- Guarantees /product/<slug> URLs even when callers forget to set it.
-- Mirror of the migration applied on Lovable Cloud preview; this file is the
-- source of truth for the production Supabase project (vpttoqojmiqxgudknyxf).

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.products_ensure_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_name TEXT;
  base_slug TEXT;
  candidate TEXT;
  collision_count INT;
  attempt INT := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND length(btrim(NEW.slug)) > 0 THEN
    RETURN NEW;
  END IF;

  base_name := COALESCE(NULLIF(btrim(NEW.name_fr), ''), NULLIF(btrim(NEW.name), ''), 'produit');

  base_slug := lower(unaccent(base_name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-{2,}', '-', 'g');
  base_slug := btrim(base_slug, '-');
  IF base_slug = '' THEN base_slug := 'produit'; END IF;
  base_slug := left(base_slug, 80);

  candidate := base_slug;
  LOOP
    SELECT count(*) INTO collision_count
    FROM public.products
    WHERE slug = candidate
      AND (TG_OP = 'INSERT' OR id <> NEW.id);

    EXIT WHEN collision_count = 0 OR attempt >= 6;
    attempt := attempt + 1;
    candidate := base_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
  END LOOP;

  IF collision_count > 0 THEN
    candidate := base_slug || '-' || substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8);
  END IF;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_ensure_slug ON public.products;
CREATE TRIGGER trg_products_ensure_slug
BEFORE INSERT OR UPDATE OF name, name_fr, slug ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.products_ensure_slug();

-- Backfill existing rows missing a slug (the BEFORE UPDATE trigger fills it).
UPDATE public.products
SET slug = NULL
WHERE slug IS NULL OR length(btrim(slug)) = 0;
