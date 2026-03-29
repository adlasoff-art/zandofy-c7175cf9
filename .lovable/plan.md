

## Plan : Estimation de la date d'arrivée (délais préparation + transit)

### Concept

Ajouter une estimation de date d'arrivée visible au checkout et sur la page produit, calculée ainsi :

```text
Date arrivée = Aujourd'hui + Délai préparation (vendeur) + Délai transit (route/mode)
```

**Boutiques locales** : préparation fixe 0j, transit estimé 45min–2h (affiché en heures, pas en jours).
**Boutiques internationales (import)** : préparation configurable par produit + transit de la route.

### Migration SQL nécessaire

```sql
-- 1. Temps de préparation par produit (vendeur)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS prep_days_min integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS prep_days_max integer DEFAULT 5;

-- 2. Temps de transit par défaut au niveau boutique (fallback si pas de route)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS default_transit_days_min integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS default_transit_days_max integer DEFAULT 6;

-- 3. Config globale admin pour la préparation par défaut (platform_settings)
-- Clé: "delivery_time_defaults"
-- Valeur: { "local_hours_min": 0.75, "local_hours_max": 2, "intl_prep_min": 2, "intl_prep_max": 5, "intl_transit_min": 4, "intl_transit_max": 6 }
```

### Changements

**1. `VendorProductManager.tsx`** — Champs préparation par produit
- Ajouter `prep_days_min` et `prep_days_max` dans le formulaire produit (section "Logistique")
- Label : "Délai de préparation fournisseur (jours)" — min/max
- Sauvegardé sur le produit, utilisé au checkout

**2. Vendor Dashboard Settings** — Transit par défaut de la boutique
- Ajouter 2 champs `default_transit_days_min/max` dans les settings boutique
- Label : "Temps de transit warehouse → destination (jours)"
- Permet au vendeur de configurer le temps que son transitaire met

**3. Admin Shipping Page** — Paramètres globaux par défaut
- Section "Délais par défaut" dans `AdminShippingPage.tsx`
- Configuration des defaults locaux (en heures) et internationaux (en jours)
- Sauvegardé dans `platform_settings` clé `delivery_time_defaults`

**4. `CheckoutShippingCalculator.tsx`** — Affichage date d'arrivée estimée
- Lire `prep_days_min/max` des produits du panier (prendre le max du panier)
- Lire `transit_min/max` de la route ou fallback sur `store.default_transit_days_min/max` ou fallback global
- Calculer fourchette de dates : `today + max(prep) + transit`
- Afficher sous le coût : "📦 Arrivée estimée : 15 avr – 22 avr 2026"
- Pour boutiques locales : "🏪 Livraison estimée : 45min – 2h"

**5. Page produit (`PrecisionShippingEstimate.tsx`)** — Aperçu délai
- Afficher la fourchette de délai sous l'estimation de fret sur la fiche produit

### Détails techniques

- Les champs `prep_days_min/max` sur `products` sont `DEFAULT 2` et `DEFAULT 5` (valeurs sensées pour l'import Chine)
- La formule finale au checkout :
  - `date_min = today + max(prep_min des produits) + transit_min`
  - `date_max = today + max(prep_max des produits) + transit_max`
- Pour les boutiques locales (`shop_type = 'local'`), on ignore prep/transit jours et on affiche directement la fourchette heures depuis `platform_settings`
- Le transit vient en priorité de : route shipping → store defaults → platform defaults

