

## Diagnostic

**Erreur vendeur** : `Could not find the 'slug' column of 'products' in the schema cache`

**Cause racine** : la colonne `slug` n'existe **pas** dans la base de **production** (`vpt...yxf`).

- Sur le **preview Lovable Cloud** (`uog...zpu`), `slug` existe bien (NOT NULL) — ajoutée par la migration `supabase/migrations/20260319120958_*.sql`.
- Mais cette migration vit dans `supabase/migrations/` (dossier Lovable Cloud), **pas** dans `frontend/supabase/migrations/` qui est la source de vérité GitHub → Vercel → Supabase prod.
- Conséquence : la prod n'a jamais reçu `ADD COLUMN slug`. Mon trigger `20260420100000_products_ensure_slug.sql` suppose que la colonne existe et **échoue silencieusement** (ou ne se déploie pas) en prod.
- Le code frontend (`VendorProductManager.tsx`) tente d'écrire `slug: "..."` lors du `INSERT`, PostgREST inspecte sa schema cache, ne trouve pas la colonne, renvoie l'erreur affichée.

C'est exactement la fracture documentée dans la memory `production-priority-rule` : **les migrations Lovable Cloud ne sont pas répliquées en prod automatiquement**.

## Plan de correction (1 lot, urgent)

### 1. Nouvelle migration prod-safe : `frontend/supabase/migrations/20260420130000_products_add_slug_column.sql`

Cette migration est **idempotente** et fait le boulot complet, prod ou preview :

```sql
-- 1. Ajout colonne si absente
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Backfill depuis name_fr / name pour lignes vides
--    (replicate la logique de 20260319120958_*.sql sans dépendre de unaccent côté prod)
UPDATE public.products
SET slug = lower(regexp_replace(
  regexp_replace(
    translate(coalesce(NULLIF(btrim(name_fr),''), name, 'produit'),
              'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
              'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'),
    '[^a-zA-Z0-9]+', '-', 'g'),
  '-{2,}', '-', 'g'))
WHERE slug IS NULL OR length(btrim(slug)) = 0;

-- 3. Dédoublonnage des slugs résiduels (suffixe court basé sur id)
WITH dups AS (
  SELECT id, slug,
         row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.products
  WHERE slug <> ''
)
UPDATE public.products p
SET slug = p.slug || '-' || substr(md5(p.id::text), 1, 5)
FROM dups
WHERE p.id = dups.id AND dups.rn > 1;

-- 4. Index unique + NOT NULL + default ''
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug) WHERE slug <> '';
ALTER TABLE public.products ALTER COLUMN slug SET DEFAULT '';
ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;

-- 5. Trigger d'auto-génération (réécrit ici, prod-safe, sans unaccent)
CREATE OR REPLACE FUNCTION public.products_ensure_slug()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
```

**Différences clés vs migration précédente** :
- `ADD COLUMN IF NOT EXISTS slug` ← **manquait, c'est LA cause**
- Pas de dépendance à `unaccent` (memory `postgresql-migration-constraints-supabase` rappelle que `unaccent` n'est pas garanti en prod) → on utilise `translate()` natif
- Backfill + dédoublonnage avant `NOT NULL` → migration safe sur DB avec produits existants
- Trigger identique à celui du preview pour comportement uniforme

### 2. Appliquer aussi en preview Lovable Cloud (`uog...zpu`)

Pour garder cohérence, je joue la même migration via le tool de migration → idempotent, ne casse rien (colonne et trigger déjà présents).

### 3. Filet de sécurité côté frontend (`VendorProductManager.tsx`)

Audit léger : si l'admin édite un produit avant que la migration soit en prod, le `.update({ slug })` échouera. Solution : envelopper l'écriture du `slug` dans un try/catch côté hook → si PostgREST retourne `PGRST204` (column not found), retry sans `slug`. **Ceci n'est nécessaire que si l'on craint un délai entre merge et déploiement prod**. À discuter — par défaut je ne l'ajoute pas (la migration fix le vrai problème).

### 4. Vérification post-déploiement

1. Vendeur : créer un produit "Téléphone Élégant Édition Spéciale" → URL = `/product/telephone-elegant-edition-speciale`
2. `curl -A "Googlebot/2.1" https://zandofy.com/product/<slug>` → titre dynamique injecté
3. Anciennes URL UUID continuent de fonctionner (fallback ID dans le resolver existant)
4. `SELECT count(*) FROM products WHERE slug IS NULL OR slug = '';` → doit retourner 0

## Hors scope (déjà OK)

- `frontend/src/utils/productSlug.ts` — déjà créé
- `VendorProductManager.tsx` — patch déjà appliqué pour générer `slug` à la création
- Resolver `/product/:slugOrId` — déjà bilingue (slug ou UUID)

## Fichiers touchés

| Fichier | Action |
|---|---|
| `frontend/supabase/migrations/20260420130000_products_add_slug_column.sql` | **Créer** (migration prod, idempotente) |
| Migration tool sur preview (`uog...zpu`) | Rejouer la même migration pour cohérence |

## Pourquoi c'est urgent et faible risque

- **Bloque tout vendeur** essayant de créer/modifier un produit en prod actuellement.
- Migration **idempotente** : `IF NOT EXISTS`, `OR REPLACE`, `DROP TRIGGER IF EXISTS`. Aucun risque sur la DB existante.
- Aligne enfin la stack prod sur la stack preview, conforme à la memory `production-priority-rule`.

