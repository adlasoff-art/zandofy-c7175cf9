

# SEO Zandofy — Recommandations et améliorations admin

## 1. Recommandations SEO pour Zandofy

### Titre du site (max 60 caractères)
```
Zandofy — Achetez en Chine, livré en Afrique | Prix usine
```
(57 caractères — inclut le nom de marque, la proposition de valeur, et un mot-clé fort)

### Meta description (max 160 caractères)
```
Achetez directement aux usines chinoises, turques et internationales. Zandofy gère fournisseurs, logistique et livraison en Afrique. Prix imbattables, support en français.
```
(157 caractères — couvre les intentions de recherche clés : acheter en Chine, livraison Afrique, prix usine, français)

### Mots-clés recommandés
```
acheter en chine depuis l'afrique, importer de chine afrique, fournisseur chine afrique, 
transitaire chine afrique, marketplace sino-africaine, achat chine livraison afrique, 
prix usine chine, grossiste chine, import turquie afrique, import dubai afrique, 
acheter alibaba afrique, alternative alibaba afrique, zandofy, e-commerce afrique, 
fournisseur vérifié chine, logistique chine afrique, acheter pas cher chine
```

---

## 2. Nouveaux champs admin SEO (à ajouter)

La page admin actuelle ne gère que titre, description et mots-clés. Pour un SEO compétitif, il faut ajouter :

| Champ | Utilité |
|---|---|
| **OG Image par défaut** | Image affichée lors des partages sociaux (URL) |
| **Langue principale** | Balise `lang` et hreflang (actuellement hardcodé "fr") |
| **Nom de marque alternatif** | Pour le JSON-LD Organization (ex: "Zandofy Marketplace") |
| **Slogan / tagline** | Utilisé dans le JSON-LD et le footer structuré |
| **URL des réseaux sociaux** | Facebook, Instagram, Twitter — injectés dans le JSON-LD Organization |
| **Google Site Verification** | Code de vérification Google Search Console |
| **Script de tracking** | Google Analytics / Tag Manager ID |

---

## 3. Plan technique

### A. Enrichir le `seo_config` dans `platform_settings`

Ajouter les champs suivants à l'objet JSON stocké :
- `default_og_image` (string URL)
- `site_language` (string, défaut "fr")  
- `brand_name` (string, défaut "Zandofy")
- `tagline` (string)
- `social_urls` (objet : facebook, instagram, twitter)
- `google_site_verification` (string)
- `google_analytics_id` (string)

Pas de migration SQL nécessaire — ces champs vivent dans le JSONB existant de `platform_settings`.

### B. Refondre `AdminSEOPage.tsx`

Organiser en sections :
1. **Toggle global** (existant)
2. **Métadonnées principales** — titre, description, mots-clés (existant, valeurs mises à jour)
3. **Image & Branding** — OG image URL, nom de marque, tagline
4. **Réseaux sociaux** — URLs Facebook/Instagram/Twitter
5. **Vérification & Analytics** — Google Site Verification, GA/GTM ID
6. **Aperçu SERP** — simulation visuelle de l'apparence Google (titre bleu, URL verte, description grise)
7. **Boutiques & Produits** (existant)

### C. Mettre à jour `SEOHead.tsx`

- Injecter `google-site-verification` meta tag si configuré
- Injecter le script Google Analytics/GTM si configuré
- Utiliser `default_og_image` comme fallback OG image
- Ajouter un JSON-LD `Organization` sur la page d'accueil avec les réseaux sociaux

### D. Mettre à jour `Index.tsx`

- Enrichir le JSON-LD WebSite avec le JSON-LD Organization :
```json
{
  "@type": "Organization",
  "name": "Zandofy",
  "url": "https://zandofy.com",
  "logo": "...",
  "description": "Première plateforme e-commerce sino-africaine...",
  "sameAs": ["https://facebook.com/...", "https://instagram.com/..."]
}
```

### E. Activer le sitemap dans `robots.txt`

Décommenter la ligne Sitemap pour qu'elle soit active.

### Fichiers modifiés
- `frontend/src/pages/admin/AdminSEOPage.tsx` — refonte complète
- `frontend/src/components/SEOHead.tsx` — nouveaux tags
- `frontend/src/hooks/use-seo-config.ts` — nouveaux champs
- `frontend/src/pages/Index.tsx` — JSON-LD Organization
- `frontend/public/robots.txt` — activer sitemap

