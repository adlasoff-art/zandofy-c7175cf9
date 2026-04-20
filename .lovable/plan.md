

## Constat

Le HTML statique `frontend/index.html` contient un `<title>` et meta `description`/`og:*` codés en dur ("Zandofy — Mode Élégante & Accessible"). C'est ce que voient :
- Googlebot via `meta-injector` sur la **homepage** (qui ne fait que pass-through pour `/`)
- Tous les utilisateurs avant hydratation React
- Les partages sociaux de la homepage

Côté admin, il existe **déjà** un onglet SEO complet : `frontend/src/components/admin/seo/SeoMetadataSection.tsx` (titre 60c, description 160c, keywords) + `SeoBrandingSection.tsx` (brand, tagline, OG image), stockés dans `platform_settings.seo_config`. Mais ces valeurs **ne sont jamais injectées dans le HTML servi aux bots** ni dans les pages publiques (home, /faq, /stores, /blog list, /category list, etc.) — uniquement les pages détail produit/store/category/blog passent par `meta-injector`.

→ Donc l'admin remplit le formulaire mais ça ne change rien à ce que Google et les utilisateurs voient.

## Solution

Étendre le `meta-injector` pour qu'il devienne **la source de vérité SEO de toute page publique**, en lisant `platform_settings.seo_config` (déjà géré par l'admin) :

### 1. Étendre `frontend/api/meta-injector.ts`
- Charger `platform_settings.seo_config` au démarrage (cache 60s en mémoire Edge)
- Ajouter le routage pour pages "globales" (titre + description issus de `seo_config`) :
  - `/` (homepage)
  - `/faq`, `/stores`, `/blog`, `/about`, `/contact`, `/careers`, `/help`
- Pour ces routes : injecter `seo_config.site_title`, `seo_config.site_description`, `seo_config.default_og_image`, `seo_config.brand_name`, `seo_config.tagline`, `seo_config.keywords`
- Garder le comportement actuel pour produit/boutique/catégorie/blog (priorité au contenu spécifique de l'item)
- Étendre le `vercel.json` rewrite list pour inclure les routes ci-dessus pour les bots

### 2. Mettre à jour `frontend/index.html`
- Remplacer les valeurs hardcodées par des **placeholders neutres** (fallback générique uniquement utilisé si l'edge function échoue) — ex: titre = `{{SITE_TITLE}}` n'est pas possible côté static, donc on garde un fallback minimal "Zandofy" + on compte sur l'injecteur pour servir le bon contenu aux bots et sur `SEOHead.tsx` (React) pour les humains

### 3. Améliorer `SEOHead.tsx` (côté client React)
- Sur les pages "globales" listées ci-dessus, lire `seo_config` via le hook existant (`usePlatformBootstrap` qui charge déjà `seo_config`) et appliquer dynamiquement le `<title>` et meta tags dès le premier render React (humains voient aussi les valeurs admin)
- Vérifier le hook qui charge déjà ces données via `platform-bootstrap` edge function

### 4. Cache invalidation
- Quand l'admin sauve dans `AdminSEOPage`, après save → ping fire-and-forget de `meta-injector` avec un header `x-purge-cache` pour réinitialiser le cache mémoire (ou simplement TTL court 60s)

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `frontend/api/meta-injector.ts` | Ajout résolveur `global` lisant `seo_config`, étendre matcher de path |
| `frontend/vercel.json` | Ajouter routes `/`, `/faq`, `/stores`, `/blog`, `/about`, `/contact`, `/careers`, `/help` au bloc `has user-agent bot` |
| `frontend/index.html` | Fallback générique sans claim marketing ("Zandofy" simple) |
| `frontend/src/components/SEOHead.tsx` | Lire `seo_config` du context et l'appliquer pour pages globales sans override |
| `frontend/src/pages/HomePage.tsx` (et autres pages globales) | S'assurer qu'elles n'imposent PAS un titre hardcodé (laisser le fallback `seo_config`) |

## Vérification finale

1. Admin modifie "Titre du site" dans `/admin/seo` → save
2. `curl -A "Googlebot/2.1" https://zandofy.com/` → nouveau titre dans `<title>`
3. Recharge la home dans un navigateur → nouveau titre dans l'onglet
4. Test partage Facebook/WhatsApp via debugger → nouveau OG title

## Hors scope

- Pas de migration SQL (`platform_settings.seo_config` existe déjà)
- Pas de refonte de l'admin SEO (formulaire déjà en place)
- Pas de toucher au cache du `platform-bootstrap` edge function (déjà 5min CDN)

