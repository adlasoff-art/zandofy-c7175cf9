## Lot 10 — Représentation pro (Google sitelinks + partage produit + filigrane)

Trois sujets indépendants, livrables séparément.

---

### 🎯 Volet A — SEO : Sitelinks Google type Amazon

**Constat actuel** : `index.html` contient déjà JSON-LD `Organization` + `WebSite` avec `SearchAction` (sitelinks searchbox). Le sitemap statique ne liste que 6 URLs racines. Aucune route interne nommée (Catalogue, Compte, Panier, Boutiques) n'est explicitement déclarée comme "section forte" pour Google.

**Pourquoi Amazon a 6 sitelinks** : (1) marque très recherchée, (2) sitemap riche et hiérarchisé, (3) navigation principale stable et nommée clairement, (4) ancienneté + autorité de domaine, (5) JSON-LD `SiteNavigationElement` parfois utilisé.

**Ce qui dépend de nous (code)** :
1. **Enrichir le JSON-LD** dans `frontend/index.html` :
   - Ajouter `SiteNavigationElement` listant les 6-8 sections phares (Catalogue, Boutiques, Mode, Beauté, Compte, Panier public, Aide, Blog).
   - Vérifier la cohérence des `name` avec les libellés réels du header.
2. **Sitemap statique enrichi** (`frontend/public/sitemap.xml`) : ajouter Boutiques, Catégories racines, Blog, Aide, Affiliation, Programme parrainage avec `<priority>` adaptés (0.9 pour sections clés).
3. **Sitemap dynamique** (`generate-sitemap` Edge Function) : confirmer qu'il inclut bien les top catégories et top boutiques avec ancres propres.
4. **Métas par section** : vérifier que `/category/*`, `/store/*`, `/blog`, `/help`, `/about` ont chacun un `<title>` unique, court (≤60 car) et descriptif via `SEOHead`.
5. **Search Console** : ajouter (côté admin SEO) un rappel pour soumettre les 2 sitemaps et demander l'indexation des sections principales.

**Ce qui ne dépend PAS de nous** :
- Autorité de domaine (temps + backlinks).
- Volume de recherche "zandofy" (campagnes marketing).
- Décision finale de Google d'afficher les sitelinks.

**Livrable** : audit + corrections HTML/sitemap + checklist Search Console dans le panneau admin SEO.

---

### 🔗 Volet B — Bouton Partage produit (UI + image OG WhatsApp)

**B.1 — Padding bouton partage** (`frontend/src/pages/ProductPage.tsx` ligne 444-447)

Le bloc `Title + Share` est immédiatement suivi de `space-y-4` mais il est lui-même collé au header sticky/au panneau vendeur sur desktop. Correctif : ajouter `pt-2` ou `mt-3` au conteneur droit, et un `mb-2` sous la rangée titre+bouton pour aérer visuellement (~12-16px).

**B.2 — Image WhatsApp = image produit (sécurité analysée)**

Comportement actuel : `wa.me/?text=...&URL` → WhatsApp scrape directement `/product/:slug`, mais notre app étant SPA, il tombe sur le `og:image` par défaut du `index.html` (logo Zandofy).

**Solution** : router le partage à travers `share-proxy` (déjà existant et opérationnel) :
```
https://zandofy.com/api/share?product=<id>
```
La fonction détecte le crawler WhatsApp/Facebook et sert un HTML avec `og:image` = première image du produit + `og:title` + `og:description` propres. Pour l'humain, redirection 302 vers `/product/:slug`.

**Risques sécurité — analyse complète** :
| Risque | Niveau | Justification |
|---|---|---|
| Fuite données privées | **Nul** | Les images produit sont déjà publiques sur la fiche. Aucune donnée sensible exposée. |
| Hotlinking de bande passante | **Faible** | Supabase Storage gère déjà des limites. Possible CDN/cache plus tard si besoin. |
| Phishing via URL `share?product=X` | **Faible** | URL toujours redirigée vers notre domaine. Le proxy ne sert que des données validées en DB. |
| Scraping facilité | **Nul** | Les fiches sont déjà indexées par Google. |

**Conclusion sécurité : RAS, on peut activer.** Modifs nécessaires :
- Mettre à jour les liens WhatsApp/Facebook dans `ProductPage.tsx` pour utiliser `https://zandofy.com/share?product=${product.id}` au lieu de l'URL directe.
- Vérifier que `share-proxy` est bien routé sur `zandofy.com/share` via Vercel rewrites (sinon utiliser l'URL Supabase directe `https://vpttoqojmiqxgudknyxf.functions.supabase.co/share-proxy?product=...`).
- Tester avec [WhatsApp Link Preview Tester](https://developers.facebook.com/tools/debug/) après déploiement.

---

### 💧 Volet C — Filigrane logo incrusté à l'upload (option choisie : 1 seule version)

**Objectif** : à chaque upload d'image produit par un vendeur, incruster le logo Zandofy dans le pixel et stocker UNIQUEMENT cette version filigranée. Pas de doublon.

**Architecture proposée** :
1. **Nouvelle Edge Function** `watermark-on-upload` :
   - Trigger : appelée depuis le frontend après chaque upload réussi sur le bucket `product-media`.
   - Reçoit `{ bucket, path }`, télécharge l'image, applique le filigrane via `npm:sharp` ou `npm:@jimp/core`, ré-uploade avec `upsert: true` pour écraser l'original.
   - Logo : SVG/PNG transparent stocké dans un bucket admin `branding-assets`, position bas-droite, opacité 50%, taille ≈ 12% largeur image.
2. **Section admin Branding** (`SeoBrandingSection` ou nouvel onglet "Filigrane") :
   - Upload du logo filigrane.
   - Toggle ON/OFF par bucket (`product-media`, `cms`, `blog`).
   - Choix position (4 coins ou centre) + opacité.
3. **Migration** :
   - Bucket `branding-assets` (privé, lu uniquement par Edge Function via service role).
   - Table `platform_settings` clé `watermark_config` `{ enabled, logo_path, position, opacity, size_ratio }`.
4. **Application aux images existantes** : optionnel — script one-shot dans un Lot ultérieur pour traiter le backlog (~plusieurs milliers d'images, à exécuter par batch nuit).

**Impacts mesurés** :
| Aspect | Impact |
|---|---|
| Stockage | **0%** — on remplace l'original (choix utilisateur validé). |
| CPU | +1-2 sec par upload (Edge Function `sharp` reste rapide). |
| Coût | Edge Function : ~2M invocations gratuites/mois Supabase, largement suffisant. |
| Sécurité | **Améliore** la traçabilité de la marque sur les vols d'images sociales. |
| Réversibilité | **Faible** : pour retirer le filigrane d'une image plus tard il faudra que le vendeur ré-uploade. ⚠️ Recommandation : conserver une copie originale 30 jours dans un bucket privé `product-media-originals` à des fins de récupération admin (coût stockage +temporaire, purgé par cron). |

**Livrable** : Edge Function + admin UI + migration storage + politique de purge.

---

### 📋 Ordre d'exécution proposé

1. **B.1 + B.2** (rapide, gros impact UX immédiat) — 1 message
2. **A** (SEO sitelinks) — 1 message
3. **C** (filigrane upload) — 1 message dédié (plus complexe, à valider step by step)

Approuves-tu l'ensemble ? Si tu veux qu'on commence par un sous-ensemble seulement (par ex. B uniquement, ou B+A sans C), dis-le.