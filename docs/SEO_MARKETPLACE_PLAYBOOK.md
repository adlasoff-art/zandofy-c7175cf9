# Playbook SEO Marketplace Zandofy

Checklist ops après déploiement des lots techniques SEO (crawl, meta-injector, CMS).

## 1. Environnement

- [ ] Vercel prod : `VITE_SITE_URL=https://zandofy.com` (apex — www redirige déjà vers apex)
- [ ] Optionnel Vercel : `SITE_URL=https://zandofy.com` (meta-injector)
- [ ] Redirection **www → apex** (déjà en place) — ne pas inverser sans plan
- [ ] Migration SQL `20260802104611_categories_seo.sql` exécutée **staging puis prod**
- [ ] Migration SQL `20260802105000_seo_page_overrides_hubs.sql` exécutée staging puis prod
- [ ] Migration SQL `20261003120000_seo_recovery_pillars_and_overrides.sql` (overrides + 5 piliers blog)
- [ ] Redeploy Edge Function `generate-sitemap` (staging puis prod) — sortie **sitemapindex** ; skip thin products (empty name)
- [ ] Redeploy Vercel so root `vercel.json` + `api/meta-injector` include AI crawler UAs
- [ ] Build Vercel : `fetch-sitemap.mjs` écrit `sitemap.xml` + enfants dans `public/`
- [ ] Cron quotidien (optionnel) : appeler l’edge + déclencher rebuild Vercel (Deploy Hooks) pour rafraîchir les XML statiques
- [ ] Baseline : [`docs/guides/SEO_BASELINE_SNAPSHOT.md`](guides/SEO_BASELINE_SNAPSHOT.md)
- [ ] Piliers : [`docs/SEO_CONTENT_PILLARS_RDC.md`](SEO_CONTENT_PILLARS_RDC.md)
- [ ] Guide détaillé : [`docs/guides/SEO_GSC_OPS_GUIDE.md`](guides/SEO_GSC_OPS_GUIDE.md)

## 2. Admin CMS (`/admin/seo`)

- [ ] Activer le SEO global si prêt
- [ ] Onglet **Global** : titre ≤60, description ≤160 (positionnement Chine → Afrique)
- [ ] Onglet **Pages** : renseigner `/`, `/about`, `/stores`, `/faq`, `/help-center`, `/become-vendor`, `/affiliate-program`
- [ ] Onglet **Templates** : vérifier `{name} | Zandofy` etc.
- [ ] Onglet **Catégories** : au minimum Mode / Fashion + top catégories
- [ ] Onglet **Sitelinks** : aligner sur le header (URLs `/help-center` correctes)
- [ ] Onglet **Couverture** : suivre le % de metas renseignées

## 3. Google Search Console — recovery 404 / index

- [ ] Propriété domaine `zandofy.com` (couvre www + apex)
- [ ] Soumettre sitemap index : `https://zandofy.com/sitemap.xml` (retirer anciens `sitemap-dynamic.xml` si listés)
- [ ] Exporter rapport **Pages** : les 11 motifs + CSV des **Introuvable (404)**
- [ ] Pour chaque 404 à volume : 301 vers slug actuel **ou** laisser 410 (produit mort) — ne pas ressusciter en 200 soft
- [ ] Ne pas demander l’indexation en masse de milliers de SKU
- [ ] Inspection URL → demander indexation (hubs seulement) :
  - `https://zandofy.com/`
  - `https://zandofy.com/stores`
  - `https://zandofy.com/about`
  - `https://zandofy.com/discover`
  - `https://zandofy.com/category/fashion`
  - `https://zandofy.com/blog`
  - `https://zandofy.com/blog/achat-en-chine-livre-rdc-kinshasa` (+ 4 autres piliers)
  - Top hubs (become-vendor, help-center, affiliate)
- [ ] Suivre : indexées vs exclues ; impressions **non-marque** (Chine, import, RDC…)
- [ ] Corriger soft-404 / canonicals signalés

## 4. Google Business Profile (fiche entreprise) + NAP

- [ ] Créer / revendiquer la fiche Google Business Profile
- [ ] Nom, adresse, téléphone (NAP) cohérents avec le site + `sameAs` admin SEO
- [ ] Catégorie principale type marketplace / e-commerce / logistique
- [ ] Lien site = `https://zandofy.com` (apex)
- [ ] Photos logo + couverture alignées branding
- [ ] Pas de pages ville `/kinshasa` tant que NAP non validé

## 5. Contrôles techniques post-deploy

```bash
# Accueil bot
curl -A "Googlebot" -sL "https://zandofy.com/" | grep -E "<title>|meta name=\"description\"|BEGIN injected"

# AI crawler parity
curl -A "GPTBot" -sL "https://zandofy.com/" | grep -E "BEGIN injected|<h1"

# Catégorie
curl -A "Googlebot" -sL "https://zandofy.com/category/fashion" | grep -E "<title>|description"

# Redirect help
curl -sI "https://zandofy.com/help" | grep -i location
```

- [ ] Titre accueil = copy admin / override
- [ ] Catégorie Mode = template ou meta CMS
- [ ] `/help` → 301 `/help-center`
- [ ] GPTBot reçoit HTML injecté (pas seulement le shell SPA)

## 6. Attentes réalistes (4–8 semaines)

| Objectif | Contrôlable ? |
|----------|----------------|
| Titre / description SERP | Oui (CMS + réindexation) |
| Accueil comme résultat #1 marque | En grande partie (signaux + GSC) |
| Sitelinks type Workspace | **Non garanti** — Google décide |
| Knowledge Panel | GBP + autorité + cohérence |
| Battre Facebook sur « zandofy » | Trafic marque + backlinks + fiche |

## 7. Backlinks (hors produit)

- Partenaires logistique / transitaires AF
- Presse / annonces lancement
- Annuaires B2B Afrique / Chine
- Pages partenaires avec lien dofollow quand pertinent

## 8. Cadence autorité & IA (mensuel)

| Action | Fréquence |
|--------|-----------|
| Revue GSC (index, 404, requêtes non-marque) | Mensuel |
| Publier ≥1 pilier / article longue traîne | Mensuel |
| Mettre à jour [`llms.txt`](../frontend/public/llms.txt) si nouveaux guides | À chaque pilier |
| Enrichir top catégories `seo_body` | Continu (top 10 d’abord) |
| GBP posts / photos | Mensuel |
| Redeploy `generate-sitemap` + rebuild Vercel | Hebdo ou après gros catalogue |

Attentes : 4–8 semaines pour titres SERP ; 3–9 mois pour intentions locales RDC ; head terms mondiaux = long terme.

## 9. Non-objectifs v1

- Score focus keyword Rank Math
- Gestionnaire de redirections admin
- Moniteur 404 SEO
- SSR React complet / Next.js
- Indexation de `/search`
- Déblocage CCBot / Bytespider
