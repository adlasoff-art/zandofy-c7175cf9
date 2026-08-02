# Playbook SEO Marketplace Zandofy

Checklist ops après déploiement des lots techniques SEO (crawl, meta-injector, CMS).

## 1. Environnement

- [ ] Vercel prod : `VITE_SITE_URL=https://zandofy.com` (apex — www redirige déjà vers apex)
- [ ] Optionnel Vercel : `SITE_URL=https://zandofy.com` (meta-injector)
- [ ] Redirection **www → apex** (déjà en place) — ne pas inverser sans plan
- [ ] Migration SQL `20260802104611_categories_seo.sql` exécutée **staging puis prod**
- [ ] Migration SQL `20260802105000_seo_page_overrides_hubs.sql` exécutée staging puis prod
- [ ] Redeploy Edge Function `generate-sitemap` (staging puis prod)
- [ ] Guide détaillé : [`docs/guides/SEO_GSC_OPS_GUIDE.md`](guides/SEO_GSC_OPS_GUIDE.md)

## 2. Admin CMS (`/admin/seo`)

- [ ] Activer le SEO global si prêt
- [ ] Onglet **Global** : titre ≤60, description ≤160 (positionnement Chine → Afrique)
- [ ] Onglet **Pages** : renseigner `/`, `/about`, `/stores`, `/faq`, `/help-center`, `/become-vendor`, `/affiliate-program`
- [ ] Onglet **Templates** : vérifier `{name} | Zandofy` etc.
- [ ] Onglet **Catégories** : au minimum Mode / Fashion + top catégories
- [ ] Onglet **Sitelinks** : aligner sur le header (URLs `/help-center` correctes)
- [ ] Onglet **Couverture** : suivre le % de metas renseignées

## 3. Google Search Console

- [ ] Propriété domaine `zandofy.com` (couvre www + apex)
- [ ] Soumettre sitemap : `https://www.zandofy.com/sitemap.xml`
- [ ] Inspection URL → demander indexation :
  - `https://www.zandofy.com/`
  - `https://www.zandofy.com/stores`
  - `https://www.zandofy.com/about`
  - `https://www.zandofy.com/category/fashion` (après fix templates)
  - Top hubs (become-vendor, help-center, affiliate)
- [ ] Suivre couverture : pages indexées vs exclues
- [ ] Corriger pages soft-404 / canonicals signalés

## 4. Google Business Profile (fiche entreprise)

- [ ] Créer / revendiquer la fiche Google Business Profile
- [ ] Nom, adresse, téléphone (NAP) cohérents avec le site + `sameAs` admin SEO
- [ ] Catégorie principale type marketplace / e-commerce / logistique
- [ ] Lien site = `https://www.zandofy.com`
- [ ] Photos logo + couverture alignées branding

## 5. Contrôles techniques post-deploy

```bash
# Accueil bot
curl -A "Googlebot" -sL "https://www.zandofy.com/" | grep -E "<title>|meta name=\"description\""

# Catégorie (plus de « Acheter en ligne » / « Mode élégante »)
curl -A "Googlebot" -sL "https://www.zandofy.com/category/fashion" | grep -E "<title>|description"

# Redirect help
curl -sI "https://www.zandofy.com/help" | grep -i location
```

- [ ] Titre accueil = copy admin
- [ ] Catégorie Mode = template ou meta CMS
- [ ] `/help` → 301 `/help-center`

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

## 8. Non-objectifs v1

- Score focus keyword Rank Math
- Gestionnaire de redirections admin
- Moniteur 404 SEO
- SSR React complet
