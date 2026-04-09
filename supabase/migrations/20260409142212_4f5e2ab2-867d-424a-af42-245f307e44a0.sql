-- Step 1: Add slug column
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug ON public.stores (slug) WHERE slug IS NOT NULL;

-- Step 2: Create slug generation function
CREATE OR REPLACE FUNCTION public.generate_store_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND (TG_OP = 'UPDATE' AND OLD.name = NEW.name) THEN
    RETURN NEW;
  END IF;

  base_slug := lower(trim(NEW.name));
  base_slug := translate(base_slug,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
    'aaaaaaeeeeiiiioooooouuuuyycn');
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  IF length(base_slug) < 2 THEN
    base_slug := 'boutique';
  END IF;
  base_slug := left(base_slug, 60);

  final_slug := base_slug;
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.stores WHERE slug = final_slug AND id != NEW.id) THEN
      EXIT;
    END IF;
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_store_slug
  BEFORE INSERT OR UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_store_slug();

-- Step 3: Backfill existing stores (trigger fires on UPDATE)
UPDATE public.stores SET slug = NULL;

-- Step 4: Recreate stores_public view with slug
DROP VIEW IF EXISTS public.stores_public;

CREATE VIEW public.stores_public
WITH (security_invoker = on)
AS SELECT
  id, name, slug, description, logo_url, banner_url,
  is_verified, is_certified, verified_years,
  followers_count, products_count, sales_count, rating,
  is_online, last_seen_at, created_at,
  shop_type, presence_visible,
  repurchase_rate, response_rate, response_time, sales_trend,
  followers_override, sales_override, verified_years_override, review_count_override,
  owner_id, is_platform_owned, fulfillment_type,
  returns_enabled, default_transit_days_min, default_transit_days_max
FROM public.stores;