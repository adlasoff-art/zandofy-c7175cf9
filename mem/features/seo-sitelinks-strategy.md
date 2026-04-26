---
name: SEO sitelinks strategy
description: Stratégie pour obtenir des sitelinks Google type Amazon — JSON-LD SiteNavigationElement, sitemap enrichi, métas par section.
type: feature
---

Pour augmenter les chances que Google affiche des sitelinks (les 6 sous-liens sous le résultat principal type Amazon) sous "zandofy" :

1. **JSON-LD `SiteNavigationElement`** dans `frontend/index.html` — liste les 8 sections phares avec position. C'est le signal n°1 pour Google sur la hiérarchie de navigation.
2. **Sitemap statique enrichi** (`frontend/public/sitemap.xml`) avec priorités calibrées : 1.0 home, 0.9 sections nav (stores/popular/trends), 0.8 blog/help/search, 0.7 about/faq/affiliate.
3. **Sitemap dynamique** (`/sitemap-dynamic.xml` via `generate-sitemap` Edge Function) pour produits + catégories + boutiques.
4. **`<title>` unique par page** (≤60 car) géré via `SEOHead` + `meta-injector` Vercel pour bots.
5. **Robots.txt** autorise `Googlebot` sur toutes les sections publiques, bloque admin/dashboard/auth/checkout.

Les sitelinks ne sont JAMAIS garantis : Google décide selon (a) autorité de domaine, (b) volume de recherche de la marque, (c) cohérence des labels nav vs JSON-LD vs `<title>`. Ces optimisations sont nécessaires mais non suffisantes — il faut aussi du temps + backlinks + trafic marque.

**Search Console todo après déploiement** : soumettre les 2 sitemaps, demander indexation des 8 sections nav, vérifier "Statut de la couverture".
