
# Phase 10.3 — Standardisation Combobox Géographique partout

## Objectif

Éliminer toute saisie libre de **Pays / Province / Ville / Commune / Quartier** dans la plateforme. Chaque champ géographique doit être un **combobox** alimenté par la fonctionnalité **Zones Géographiques** admin (`countries`, `provinces`, `cities`, `communes`, `quartiers`). Les codes pays ISO ne doivent jamais être tapés à la main.

## Principe directeur

> **Un seul composant à utiliser partout** : `CascadingAddressFields` (existant) ou un nouveau wrapper léger `GeoFieldsRow` (1 ligne, niveaux configurables) selon le contexte (formulaire complet vs ligne tabulaire compacte).

Tout formulaire qui touche au géographique doit :
- Lister les pays via `CountryCombobox` (filtré par `activeCountryCodes`)
- Cascader province → ville → commune → quartier via `useGeoData`
- Bloquer la sélection si le pays/ville n'est pas configuré dans les zones géographiques admin
- Stocker à la fois le **nom** (pour affichage/legacy) et l'**UUID** (pour cascade et FK)

## Audit — Formulaires à corriger

Recherche exhaustive : 8 emplacements avec saisie libre identifiés.

### 1. **AdminOperatorRateCapsPage** (capture d'écran fournie)
Dialog "Nouveau plafond" → `country_code` et `city` sont des `<Input>` libres.
→ Remplacer par `CountryCombobox` + `GeoCombobox` ville (filtrée sur le pays).

### 2. **AdminShippingPage** — Dialog Zone d'expédition
`country_code` (Input ISO) + `city` (Input). 
→ Combobox pays + ville. Maintenir l'autocomplete `world-cities` en fallback uniquement pour villes hors zones admin.

### 3. **OperatorRatesPage** (Dashboard opérateur)
Form ajout tarif : `country_code`, `city`, `commune`, `quartier` tous en saisie libre.
→ Cascade complète. Le `zone_name` reste libre (label métier).

### 4. **OperatorCoveragePage**
`country` + `city` libres.
→ Cascade pays → ville (multi-sélection villes optionnelle).

### 5. **BecomeForwarderPage**
`headquarters_city` libre + lignes tarifaires `origin_country/city`, `destination_country/city` toutes libres.
→ Cascade complète sur HQ ; pour les routes import (CN/TR/AE → CD), combobox pays origine + ville origine + combobox ville destination.

### 6. **ForwarderPricingProfilesDialog** (Admin)
`country_code` Input manuel + filtre ville textuel.
→ Combobox pays + combobox ville filtrée.

### 7. **ForwarderCoverageDialog**
Déjà partiellement combobox (CommandInput) mais à harmoniser avec `CountryCombobox` standard.

### 8. **GeoBlockingSettings** + autres pages mineures
Vérifier et aligner si saisie libre détectée.

## Composants à créer / réutiliser

### Réutilisé (existants)
- `CountryCombobox` — pays avec drapeaux + filtre `activeCountryCodes`
- `GeoCombobox` — combobox générique pour province/ville/commune/quartier
- `useGeoData` — cascade hook (déjà utilisé par `CascadingAddressFields` et `LocationHierarchyFilter`)
- `LocationHierarchyFilter` — pour filtres en lecture (admin pages)

### Nouveau composant
**`GeoFieldsRow`** (`frontend/src/components/address/GeoFieldsRow.tsx`)

Wrapper compact (1-2 lignes) pour formulaires courts (plafonds, tarifs, zones d'expédition) :

```tsx
<GeoFieldsRow
  value={{ country, province_id, city, commune, quartier }}
  onChange={(patch) => setForm({ ...form, ...patch })}
  levels={["country", "city"]}        // configurable
  required={["country", "city"]}
  blockIfNotConfigured                 // empêche villes hors zones admin
/>
```

- Réutilise `useGeoData` en interne
- Niveaux à afficher passés en prop (`country`, `province`, `city`, `commune`, `quartier`)
- Renvoie systématiquement nom + UUID
- Affiche un message inline "Cette ville n'est pas configurée dans les zones géographiques admin" si bloqué

## Plan d'exécution

### Étape 1 — Composant `GeoFieldsRow`
Créer le wrapper réutilisable. 1 fichier ~120 lignes.

### Étape 2 — Refactor des 8 formulaires
Pour chaque page listée, remplacer les `<Input>` Pays/Ville par `<GeoFieldsRow>` ou `CascadingAddressFields` selon densité.

| Fichier | Composant cible | Niveaux |
|---|---|---|
| `AdminOperatorRateCapsPage.tsx` | `GeoFieldsRow` | country, city |
| `AdminShippingPage.tsx` (ZoneDialog) | `GeoFieldsRow` | country, city |
| `OperatorRatesPage.tsx` | `GeoFieldsRow` | country, city, commune, quartier |
| `OperatorCoveragePage.tsx` | `GeoFieldsRow` | country, city |
| `BecomeForwarderPage.tsx` (HQ) | `CascadingAddressFields` | full |
| `BecomeForwarderPage.tsx` (routes) | `GeoFieldsRow` ×2 | country, city |
| `ForwarderPricingProfilesDialog.tsx` | `GeoFieldsRow` | country, city |
| `ForwarderCoverageDialog.tsx` | harmonisation | country, city |

### Étape 3 — UX bloquante
Si une ville n'existe pas dans `cities` admin, afficher un message :
> "Cette ville n'est pas configurée. Demandez à un admin de l'ajouter via Zones Géographiques."

Et désactiver le bouton "Créer/Sauvegarder".

### Étape 4 — Vérification
Recherche `<Input` couplée à `country_code|city` dans `frontend/src` — s'assurer qu'il ne reste plus aucun champ libre.

## Détails techniques

- **Stockage** : on continue à stocker `country_code` (string ISO) et `city` (text name) en base pour rétro-compat avec toutes les tables existantes (`delivery_operator_rates`, `delivery_operator_city_caps`, `shipping_zones`, etc.). Le combobox renvoie le code ISO depuis sa sélection.
- **Pas de migration DB** : c'est un refactor purement UI. Aucune table ni RLS à toucher.
- **`useGeoData`** : déjà filtre `is_active = true` sur cities/communes/quartiers — pas de changement.
- **Pays actifs** : `useActiveGeo().activeCountryCodes` filtre déjà `CountryCombobox` côté `CascadingAddressFields` ; `GeoFieldsRow` doit faire pareil.
- **Performance** : les listes (provinces/cities) sont déjà cachées par requêtes Supabase ; si une page liste plusieurs `GeoFieldsRow` (ex: BecomeForwarder routes), partager un `useGeoData` parent ou laisser chaque ligne fetch (volumes OK : <500 villes par pays).
- **Tests** : valider manuellement les 8 formulaires post-refactor (création + édition + soumission).

## Livrables

- 1 nouveau composant : `GeoFieldsRow.tsx`
- 8 fichiers refactorés
- 0 migration SQL
- Documentation : note dans `mem://features/multi-operator-delivery-system.md` sur la règle "tous les champs géo = combobox lié aux zones admin"
