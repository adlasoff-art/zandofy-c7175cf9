# SEO content pillars — RDC / Afrique (commerce)

Canonical host: `https://zandofy.com`  
Slugs must match [`frontend/src/lib/seo-import-guides.ts`](../frontend/src/lib/seo-import-guides.ts).

Publish path: Admin CMS → Blog (or migration `20261003120000_seo_recovery_pillars_and_overrides.sql` when an admin author exists).

---

## Target keyword clusters

### FR — RDC / sous-région (priority)

| Cluster | Examples |
|---------|----------|
| Achat Chine | achat en chine, acheter en chine kinshasa, prix usine chine rdc |
| Import-export | import export congo, import chine rdc, ecommerce rdc |
| Confiance | fournisseur fiable, sourcing chine afrique |
| Turquie | achat turquie, import turquie afrique |
| Marque / catégorie | marketplace sino-africaine, mode prix usine kinshasa |

### EN — evergreen (secondary)

china to drc shopping, import from china to congo, sino african marketplace, reliable china supplier africa, turkey wholesale africa

Do **not** keyword-stuff titles. One primary intent per URL.

---

## Pillar 1 — `achat-en-chine-livre-rdc-kinshasa`

- **H1:** Acheter en Chine livré en RDC (Kinshasa)
- **Primary:** achat en chine + kinshasa/rdc
- **Internal links:** `/stores`, `/category/fashion`, `/discover`, `/become-vendor`
- **EN mirror (later):** `china-to-drc-shopping`
- **Outline:** pourquoi Chine → RDC; ce que fait Zandofy; étapes commande; délais/fret; FAQ; CTA

## Pillar 2 — `import-export-congo-marketplace`

- **H1:** Import-export Congo : marketplace vs agent
- **Primary:** import export congo / marketplace
- **Links:** `/stores`, pillar 1
- **EN:** `congo-import-export-marketplace`

## Pillar 3 — `fournisseur-fiable-chine-afrique`

- **H1:** Fournisseur fiable Chine → Afrique
- **Primary:** fournisseur fiable
- **Links:** `/popular`, `/help-center`
- **EN:** `reliable-china-supplier-africa`

## Pillar 4 — `achat-turquie-livraison-afrique`

- **H1:** Achat Turquie livré en Afrique
- **Primary:** achat turquie + afrique
- **Links:** `/category/fashion`, `/discover`
- **EN:** `buy-from-turkey-to-africa`

## Pillar 5 — `marketplace-sino-africaine-zandofy`

- **H1:** Marketplace sino-africaine : Zandofy
- **Primary:** marketplace sino-africaine / zandofy brand story
- **Links:** `/about`, pillar 1, `/become-vendor`
- **EN:** `sino-african-marketplace-zandofy`

---

## Long-tail batch (Phase 3c — after pillars indexed)

1. Mode / vêtements prix usine Kinshasa  
2. Électronique import Chine RDC  
3. Beauté / cosmétiques sourcing Afrique  
4. Agent fret vs marketplace (comparatif approfondi)  
5. Mobile Money + import (confiance paiement)  
6–10. EN mirrors of pillars 1–5  

---

## Category hubs (Phase 4)

For each top root category in Admin SEO → Catégories:

- meta_title ≤60 with category + « Zandofy » / « Kinshasa » sparingly  
- meta_description ≤160 with intent  
- seo_body ≥150 words (how to buy, delivery, quality tips)  
- seo_faq 3–5 Q/A → JSON-LD on CategoryPage  

Priority order: Fashion/Mode → Electronics → Beauty → Home → Accessories → rest.

---

## Quality bar

- Unique H1, no duplicate titles across pillars  
- FAQ section on every pillar  
- No claims that violate trust (fake “#1 Google” etc.)  
- After publish: GSC URL Inspection → Request indexing (max a few hubs/day)
