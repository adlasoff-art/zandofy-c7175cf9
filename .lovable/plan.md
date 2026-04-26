## 🎯 Objectif
Garantir que **chaque partage WhatsApp/Facebook** affiche l'image principale du produit (et son titre/prix), pas le logo générique Zandofy.

---

## 🔍 Diagnostic

L'infrastructure est déjà en place et **techniquement correcte** :

1. **`vercel.json`** route les crawlers WhatsApp/Facebook (`facebookexternalhit`, `whatsapp`) vers `/api/meta-injector` quand ils visitent `/product/:slug`. ✅
2. **`frontend/api/meta-injector.ts`** (ligne 155-206) interroge Supabase prod (`vpttoqojmiqxgudknyxf`) et retourne déjà la bonne `og:image` (première image triée par `position` depuis `product_images`). ✅
3. La capture WhatsApp partagée montre **encore le logo Zandofy** → le problème est **le cache**, pas le code.

### Trois couches de cache bloquent l'image produit :

| Couche | TTL | Effet |
|---|---|---|
| **Vercel Edge** (`s-maxage=600 + stale-while-revalidate=86400`) | 10 min frais + 24 h stale | Sert l'ancien HTML aux nouveaux crawlers |
| **WhatsApp / Meta scraper** | ~7 jours | Réutilise l'aperçu déjà scrapé |
| **Cache navigateur / partage** | variable | Aperçus locaux WhatsApp Desktop/Web |

De plus, le `share-proxy` Edge Function existe (`supabase/functions/share-proxy/index.ts`) mais **n'est utilisé nulle part** dans le frontend. Le bouton actuel partage directement `zandofy.com/product/:slug`, pas une URL share-proxy.

---

## 🛠️ Plan de correction (3 actions complémentaires)

### Action 1 — Réduire le cache du meta-injector pour les produits
Dans `frontend/api/meta-injector.ts`, baisser `Cache-Control` de **10 min → 60 s** pour `/product/*` afin que les changements (image, prix, titre) se propagent rapidement aux scrapers. Garder le cache long pour les pages globales (FAQ, About) qui changent rarement.

```ts
// Au lieu de: "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400"
// Pour /product/* :
"Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
```

### Action 2 — Ajouter un fallback `og:image` dans `index.html` statique
Garantir que **même si le meta-injector échoue ou si un humain partage une URL**, le HTML servi contienne au minimum un `<meta property="og:image">` pointant vers une image par défaut **bien dimensionnée 1200×630** (pas l'icône carrée 512×512 actuelle qui s'affiche mal sur WhatsApp). Vérifier que `/og-default.jpg` existe au bon format.

### Action 3 — Tracking & debug : endpoint de "force re-scrape"
Ajouter un petit bouton dans `AdminSEOPage` qui :
1. Purge le cache Vercel edge pour une URL donnée (header `x-purge-cache: 1` déjà supporté ligne 395).
2. Affiche un lien direct vers le **Facebook Sharing Debugger** pour cette URL → permet à l'admin de forcer Meta à re-scraper en un clic.

### Action 4 (optionnelle, pour plus tard) — Image dédiée au partage
Pour des aperçus WhatsApp **encore plus pro** (style Amazon avec prix overlay), générer côté serveur une image `og:product` composée (image produit + prix + logo Zandofy en bas) via une Edge Function `generate-og-image`. Pas urgent — à faire après stabilisation.

---

## ⚡ Action immédiate à faire par l'utilisateur (sans code)

**Pour vérifier que le code est déjà correct** avant tout déploiement, je te recommande de tester le **Facebook Sharing Debugger** :
1. Aller sur https://developers.facebook.com/tools/debug/
2. Coller l'URL d'un produit (ex : `https://zandofy.com/product/sac-a-dos-chic-motif-matelasse`)
3. Cliquer **"Scrape Again"** (Récupérer à nouveau)
4. Regarder l'`og:image` retournée

**Deux scénarios** :
- ✅ **Si l'image produit s'affiche** → le code est OK, c'est juste WhatsApp qui cache l'ancien aperçu. Solution : forcer le re-scrape via le Debugger pour chaque produit testé. Une fois fait, WhatsApp affichera la bonne image pour tous les nouveaux partages.
- ❌ **Si le logo Zandofy s'affiche encore** → problème de déploiement Vercel (rewrite pas appliqué, ou meta-injector pas déployé). On investiguera les logs Vercel.

---

## 📋 Tâches d'implémentation (après ton retour sur le test FB Debugger)

1. **Patch cache TTL** dans `frontend/api/meta-injector.ts` (10 min → 60 s pour produits).
2. **Ajouter fallback OG image 1200×630** dans `frontend/index.html` (vérifier `/og-default.jpg`).
3. **Bouton "Re-scrape réseaux sociaux"** dans `AdminSEOPage` : purge cache + lien Debugger FB + lien LinkedIn Post Inspector + lien Twitter Card Validator.
4. **Documentation mémoire** : sauvegarder le diagnostic + procédure de re-scrape dans `mem://features/whatsapp-og-sharing.md`.

---

## ⚠️ Ce que je ne ferai PAS (et pourquoi)

- ❌ **Pas de migration SQL** — le bug n'est pas en base de données.
- ❌ **Pas de modification du `share-proxy` Supabase** — il fait double emploi avec `meta-injector.ts` Vercel et n'est pas branché. À supprimer dans un lot ultérieur de cleanup, mais pas urgent.
- ❌ **Pas de changement du bouton WhatsApp** dans `ProductPage.tsx` — le partage de l'URL produit directement est le bon comportement (WhatsApp scrape lui-même l'URL via `meta-injector`).

---

**Tu confirmes le test FB Debugger d'abord, ou je lance directement les actions 1-3 ?**