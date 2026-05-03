# Plan — Tarification dégressive + override catégorie

## Réponse directe à ta question
**Oui, les deux solutions cohabitent sans conflit.** Solution 1 (dégressif par tranche) devient la logique **par défaut** appliquée partout. Solution 2 (override par catégorie) est livrée **inactive** : la table existe, l'UI admin existe, mais tant qu'aucune catégorie n'a d'override, c'est la Solution 1 qui s'applique. Tu actives au cas par cas plus tard, sans nouveau déploiement.

Ordre d'application du multiplicateur (premier trouvé gagne) :
1. Override vendeur (`vendor_pricing_overrides.multiplier`) — si défini
2. Override catégorie (`category_pricing_overrides.multiplier`) — si défini
3. **Tranche dégressive** selon `cost_calc` — par défaut

## Tranches Solution 1 (modifiables par l'admin)

| `cost_calc` | Multiplicateur |
|---|---|
| < $10 | ×3.0 |
| $10–$30 | ×2.5 |
| $30–$80 | ×2.0 |
| $80–$200 | ×1.5 |
| **> $200** | **×1.3** ← ajusté selon ta demande |

Stocké dans `platform_settings.pricing_defaults.tiers` (JSON), donc 100% éditable depuis l'admin sans redeploy.

## Solution 2 — neutre par défaut

- Nouvelle table `category_pricing_overrides` (category_id, margin_pct?, multiplier?, tiers?, description, active).
- **Vide à la livraison** → aucun changement de comportement.
- Page admin Catégories : un panneau "Tarification spécifique" par catégorie, avec champ description (ex : "Marge réduite 10% — produits high-tech compétitifs").
- Si une catégorie a un override → utilisé pour tous les produits de cette catégorie (et sous-catégories si on coche "hériter").

## Côté vendeur — transparence

Dans `PricingCalculator.tsx` (boutiques **plateforme uniquement**, `is_platform_owned=true`) :
- Le vendeur saisit toujours son `cost_calc` avec le ×3 mental habituel (champ inchangé).
- Sous le prix calculé, ajout d'un encart info :
  > "Tarification plateforme appliquée : marge 15% × multiplicateur dégressif (×3 si <$10 … ×1.3 si >$200). Le prix final affiché reflète cette logique."
- Pour boutiques **non plateforme** : encart masqué (leur ×3 reste figé comme aujourd'hui).

## Détails techniques

### Fichiers modifiés
- `frontend/src/lib/pricing-utils.ts`
  - `DEFAULT_PRICING.tiers = [{max:10,mult:3},{max:30,mult:2.5},{max:80,mult:2},{max:200,mult:1.5},{max:Infinity,mult:1.3}]`
  - Nouveau `resolveMultiplier(costCalc, overrides?, categoryOverride?, tiers?)`
  - `calculateSalePrice` accepte un paramètre `tiers` optionnel
- `frontend/src/components/vendor/PricingCalculator.tsx` : passe les tiers résolus + affiche l'encart d'info conditionnel
- `frontend/src/pages/admin/AdminVendorPricingPage.tsx` : éditeur de tranches (table avec add/remove/edit, validation `max` croissant)
- `frontend/src/pages/admin/AdminCategoriesPage.tsx` (ou équivalent) : panneau override par catégorie
- `frontend/src/hooks/use-vendor-analytics-pro.ts` : utilise la nouvelle résolution pour cohérence des marges affichées

### Migration SQL
```sql
-- 1. Étendre pricing_defaults (JSON, donc juste un UPDATE)
UPDATE platform_settings 
SET value = value || jsonb_build_object('tiers', '[
  {"max_cost":10,"multiplier":3.0},
  {"max_cost":30,"multiplier":2.5},
  {"max_cost":80,"multiplier":2.0},
  {"max_cost":200,"multiplier":1.5},
  {"max_cost":null,"multiplier":1.3}
]'::jsonb)
WHERE key = 'pricing_defaults';

-- 2. Override par catégorie (vide à la livraison)
CREATE TABLE category_pricing_overrides (
  id uuid PK default gen_random_uuid(),
  category_id uuid UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
  margin_pct numeric,        -- nullable: hérite si null
  multiplier numeric,        -- nullable
  tiers jsonb,               -- nullable: tranches custom
  description text,          -- ex: "Marge 10% high-tech"
  inherit_to_children bool DEFAULT true,
  active bool DEFAULT true,
  created_at, updated_at
);
-- RLS: SELECT public, ALL admin
```

### Non-impacts (confirmés)
- Frais transitaires : **inchangés**
- Last-mile / livraison domicile : **inchangés**
- Programme fidélité / parrainage (5% sur 5 premières commandes) : **toujours basé sur la marge 15%**, pas sur le multiplicateur
- Commission plateforme 10% : **inchangée**

## Plan de livraison

1. Migration SQL (UPDATE pricing_defaults + nouvelle table)
2. Refacto `pricing-utils.ts` + tests unitaires sur les tranches
3. UI admin : éditeur tranches global
4. UI admin : panneau override par catégorie (vide par défaut)
5. UI vendeur : encart info dans `PricingCalculator` (boutiques plateforme)
6. Vérif `use-vendor-analytics-pro` + `VendorAnalyticsProTab`
7. Commit develop → PR vers main → migration prod via GitHub Actions

Aucun produit existant n'est repricé automatiquement : les `sale_price` déjà saisis restent. La nouvelle logique s'applique uniquement aux **nouveaux calculs** (création produit ou recalcul manuel via le calculateur).
