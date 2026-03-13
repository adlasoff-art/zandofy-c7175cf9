

# Impact des changements sur la production (GitHub / Vercel / Supabase)

## Ce qui a ete modifie

1. **Migration SQL** — Nouvelles colonnes sur `categories` et `cms_banners`
2. **Nouveaux composants CMS** — HeroBannerEditor, PositionableBannersEditor, ColorPaletteEditor, tabs CMS
3. **Page AdminCategoriesPage** modifiee

## Actions manuelles requises

### 1. Code frontend → Vercel (automatique si GitHub sync actif)

Lovable pousse automatiquement vers GitHub (`adlasoff-art/Zandofy-project`). Si votre Vercel est branche sur ce repo :
- **Rien a faire** — le deploy se declenche automatiquement au push.
- **Verifiez** dans le dashboard Vercel que le dernier deploy a bien ete declenche et est passe au vert.

### 2. Migration base de donnees → Supabase production (MANUEL)

La migration SQL a ete appliquee sur l'environnement Lovable Cloud (test) mais **PAS** sur votre Supabase de production (`wgidwyrdnboivfphwete`).

**Vous devez executer manuellement** ce SQL sur votre Supabase de production via le SQL Editor du dashboard :

```sql
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'icon';
ALTER TABLE public.cms_banners ADD COLUMN IF NOT EXISTS target_page text NOT NULL DEFAULT 'home';
ALTER TABLE public.cms_banners ADD COLUMN IF NOT EXISTS bg_color text;
ALTER TABLE public.cms_banners ADD COLUMN IF NOT EXISTS text_color text;
```

Sans cette etape, le CMS en production affichera des erreurs car les colonnes n'existeront pas.

### 3. Edge Functions — Pas impactees

Aucune Edge Function n'a ete modifiee dans ces changements. Pas de redeploiement necessaire.

## Resume

| Element | Action | Ou |
|---------|--------|----|
| Code frontend | Automatique (GitHub → Vercel) | Verifier le deploy Vercel |
| Migration SQL | **Manuel** | Supabase Dashboard → SQL Editor |
| Edge Functions | Rien a faire | — |
| Variables d'env | Rien a faire | — |

## Marche a suivre

1. Allez sur votre **Supabase Dashboard** de production
2. Ouvrez **SQL Editor**
3. Collez et executez le bloc SQL ci-dessus
4. Verifiez dans **Vercel** que le dernier commit a ete deploye avec succes
5. Testez le CMS admin sur `https://studio.zandofy.com/admin/cms`

