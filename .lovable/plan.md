
# Phase 10.2 — Création opérateur "production-grade"

Objectif : remplacer les saisies libres du `CreateOperatorDialog` par la **vraie cascade géographique de la plateforme** + sécuriser la recherche propriétaire (anti-PII) + ajouter les plaques d'immatriculation, avec réutilisation cohérente sur `BecomeOperatorPage`.

---

## 1. Migration DB (`frontend/supabase/migrations/`)

**`delivery_operator_cities`** : passage en granularité fine
- Ajouter `province_id uuid NULL REFERENCES provinces(id) ON DELETE SET NULL`
- Ajouter `commune_ids uuid[] NOT NULL DEFAULT '{}'`
- Ajouter `quartier_ids uuid[] NOT NULL DEFAULT '{}'`
- Index GIN sur `commune_ids` et `quartier_ids` (lookup tarification)
- Conserver `city` (texte) pour rétro-compat lecture

**`delivery_operators`** : flotte détaillée
- Ajouter `fleet_vehicles jsonb NOT NULL DEFAULT '[]'`
  - Schéma : `[{ type, plate_number, brand?, model? }]`
- Trigger `validate_fleet_vehicles()` : rejette les plaques en doublon (sur la même ligne) et impose `plate_number` non vide
- Index unique partiel : `CREATE UNIQUE INDEX ... ON delivery_operators ((fleet_vehicles->>'plate_number'))` ❌ trop complexe → on fait la **dédup applicative + trigger jsonb**

**Vue helper** : `v_geo_coverage_status(country_code text)` retourne `{has_provinces, has_cities, has_communes}` → utilisée pour bloquer le wizard si la plateforme n'a pas saisi les zones.

---

## 2. Edge function `admin-create-operator` (mise à jour)

- Schéma Zod enrichi :
  - `cities[]` accepte désormais `{ country_code, city, province_id?, commune_ids: string[], quartier_ids: string[] }`
  - `fleet_vehicles[]` requis : min 3 entrées, chacune avec `type` (enum) + `plate_number` (regex assoupli ≥4 chars)
  - `declared_riders_count` min **3** (au lieu de 1)
  - `owner_user_id` toujours optionnel (orphelin OK)
- Insertion : on persiste `fleet_vehicles` + on dérive `vehicle_types` agrégé pour rétro-compat (groupBy type → count)
- `delivery_operator_cities` insert avec les arrays commune/quartier
- Vérif anti-doublon plaque côté serveur (cross-check avec autres opérateurs actifs → warning, pas blocage)

---

## 3. Composants partagés (nouveaux)

### `OperatorOwnerSearch.tsx` (sécurisé PII)
- Input "Prénom ou nom" (placeholder explicite, **pas d'email**)
- Debounce 300ms, min 2 caractères
- Query : `profiles.select(id,user_id,first_name,last_name,city,is_kyc_verified,created_at).or(first_name.ilike.%X%,last_name.ilike.%X%)` — **email NON sélectionné**
- Affichage résultat : `Prénom Nom · ville · "membre depuis MMM YYYY" · badge KYC ✓`
- Email **jamais affiché**, jamais retourné côté client
- Toggle explicite "Aucun propriétaire (opérateur géré par Zandofy)" qui désactive le champ

### `OperatorCoveragePicker.tsx` (cascade réelle)
- Pour chaque "zone de couverture" :
  - **Pays** : `<CountryCombobox>` (filtré `activeCountryCodes`)
  - **Province** : `<GeoCombobox>` cascadant (optionnel, label "si applicable")
  - **Ville** : `<GeoCombobox>` (cities filtrées par province ou par pays)
  - **Communes desservies** : multi-select avec `Checkbox` listant les communes de la ville (au moins 1)
  - **Quartiers desservis** : multi-select cascading par commune cochée (vide = "tous les quartiers de la commune")
- Si la ville n'a pas de communes en DB → message + lien `/admin/zones-geographiques?city=...` (bloque le bouton "Suivant")
- Bouton "+ Ajouter une zone de couverture" (max 50)

### `OperatorFleetEditor.tsx`
- Pour chaque véhicule :
  - Type (select : moto, voiture, tricycle, camionnette, vélo)
  - **Plaque d'immatriculation** (Input, **obligatoire**, min 4 chars, uppercase auto)
  - Marque (optionnel), Modèle (optionnel)
- Bouton "+ Ajouter véhicule"
- Validation : min **3 véhicules**, plaques uniques dans la liste, sinon toast erreur
- Compteur live : "Total flotte : 5 véhicules · 3 motos, 2 voitures"

---

## 4. Refonte `CreateOperatorDialog.tsx`

Découpage en sections claires (toujours dans le même Dialog scrollable) :
1. **Propriétaire** → `<OperatorOwnerSearch>` + checkbox orphelin
2. **Identité** : nom commercial, raison sociale, RCCM, NIF, email contact, téléphone
3. **Siège social** → `<CascadingAddressFields>` (réutilise l'existant, juste sans `postal_code`)
4. **Couverture** → `<OperatorCoveragePicker>` (1+ zones)
5. **Flotte** → `<OperatorFleetEditor>` (≥3 véhicules)
6. **Paramètres** : livreurs déclarés (min 3), quota max, commission %, switch "Opérateur plateforme"

Validations bloquantes affichées en bas avant le bouton "Créer & activer".

---

## 5. Mise à jour `BecomeOperatorPage.tsx` (cohérence UX publique)

- Étape 2 (couverture) : **remplacer** les Inputs libres par `<OperatorCoveragePicker>` (même composant)
- Étape 1 (siège) : passer en `<CascadingAddressFields>`
- Étape 3 (flotte) : `<OperatorFleetEditor>` (min 3 véhicules + plaques)
- Min livreurs : **3** au lieu de 1
- Garde-fou "pays non couvert" : check `v_geo_coverage_status` → si pays sans villes en DB, désactive le wizard avec lien contact

→ Garantit qu'un opérateur créé manuellement (admin) et un opérateur auto-inscrit (KYB) ont la **même structure de données** en DB.

---

## 6. Edge function `become-operator-submit` (alignement)

- Mettre à jour le schéma Zod pour accepter le nouveau format `cities[]` et `fleet_vehicles[]`
- Min 3 véhicules avec plaque, min 3 livreurs

---

## 7. Hooks à compléter

- `useGeoData` : ajouter une variante `useCommunesForCity(cityName, countryCode)` retournant **toutes** les communes (incluant id) pour le multi-select
- Nouveau hook `useQuartiersForCommunes(communeIds[])` qui fetch en batch les quartiers de plusieurs communes (pour le multi-select cascading)

---

## 8. Garde-fous & sécurité

- RLS sur `profiles` : vérifier que la query "search by name" est bien limitée aux admins (policy existante `profiles_admin_select` doit couvrir, sinon ajout)
- L'edge function `admin-create-operator` reste protégée par `has_role('admin')`
- Aucune donnée PII (email/téléphone) du `profiles` cible ne transite vers le client lors de la recherche

---

## 9. Tests post-implémentation

- Créer un opérateur orphelin (sans owner) → OK
- Créer un opérateur en cherchant "Christian" → résultats sans email visible
- Tenter avec 2 véhicules → bloqué ("min 3")
- Tenter avec 2 plaques identiques → bloqué
- Couverture : choisir Kinshasa sans cocher de commune → bloqué
- Wizard public : choisir un pays sans villes en DB → bloqué avec lien admin

---

## 📦 Livrables

**Migration** : 1 fichier `frontend/supabase/migrations/202604280000XX_operator_coverage_fleet_v2.sql`

**Nouveaux composants** :
- `frontend/src/components/admin/operators/OperatorOwnerSearch.tsx`
- `frontend/src/components/operators/OperatorCoveragePicker.tsx`
- `frontend/src/components/operators/OperatorFleetEditor.tsx`

**Refactor** :
- `frontend/src/components/admin/operators/CreateOperatorDialog.tsx`
- `frontend/src/pages/BecomeOperatorPage.tsx`
- `frontend/src/hooks/useGeoData.ts` (ajout helpers)

**Edge functions** :
- `frontend/supabase/functions/admin-create-operator/index.ts`
- `frontend/supabase/functions/become-operator-submit/index.ts`

**Mémoire** : update `mem://features/multi-operator-delivery-system` avec la nouvelle structure couverture + plaques.
