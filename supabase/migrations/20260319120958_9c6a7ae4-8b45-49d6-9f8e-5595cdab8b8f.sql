
-- Add slug column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs from name_fr for existing products
UPDATE public.products
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(name_fr, '[àáâãäå]', 'a', 'gi'),
          '[èéêë]', 'e', 'gi'
        ),
        '[ìíîï]', 'i', 'gi'
      ),
      '[òóôõöø]', 'o', 'gi'
    ),
    '[ùúûü]', 'u', 'gi'
  )
)
WHERE slug IS NULL;

-- Clean: replace non-alphanumeric with hyphens, collapse multiple hyphens, trim
UPDATE public.products
SET slug = TRIM(BOTH '-' FROM REGEXP_REPLACE(
  REGEXP_REPLACE(
    LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(name_fr, '[àáâãäå]', 'a', 'gi'),
              '[èéêë]', 'e', 'gi'
            ),
            '[ìíîï]', 'i', 'gi'
          ),
          '[òóôõöø]', 'o', 'gi'
        ),
        '[ùúûü]', 'u', 'gi'
      ),
      '[çñ]', CASE WHEN name_fr ~ '[ç]' THEN 'c' ELSE 'n' END, 'gi'
    )),
    '[^a-z0-9]+', '-', 'g'
  ),
  '-{2,}', '-', 'g'
));

-- Handle duplicates by appending part of the UUID
UPDATE public.products p1
SET slug = p1.slug || '-' || LEFT(p1.id::text, 8)
WHERE EXISTS (
  SELECT 1 FROM public.products p2
  WHERE p2.slug = p1.slug AND p2.id != p1.id AND p2.created_at < p1.created_at
);

-- Make slug NOT NULL with default and add unique index
ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN slug SET DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug) WHERE slug != '';

-- Add branding settings defaults
INSERT INTO public.platform_settings (key, value)
VALUES 
  ('branding', '{
    "header_logo_url": null,
    "footer_logo_url": null,
    "logo_mode": "text",
    "favicon_url": null,
    "pwa_icon_192_url": null,
    "pwa_icon_512_url": null
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
