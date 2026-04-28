## Problème confirmé

Sur **`frontend/src/pages/VendorDashboardPage.tsx`** (section "Localisation de la boutique", lignes 1088-1125), les trois champs **Adresse / Ville / Pays** sont des `<input>` libres. Cela viole la règle plateforme [Geo fields combobox standard](mem://preference/geo-fields-combobox-standard) qui impose des comboboxes connectés aux Zones Géographiques admin pour tous les champs Pays/Province/Ville/Commune/Quartier.

**Impact direct sur le bug transitaires** : la table `public.stores` en prod ne contient aujourd'hui que `address text`, `city text`, `country text`. Aucune colonne `country_code` (ISO), `city_id` (UUID `cities`), `province_id`. Donc :

- Une boutique chinoise saisit "China" / "Chine" / "CN" en texte libre → impossible de matcher l'origine `CN` dans `coverage_routes` des transitaires.
- Une boutique RDC saisit "Kinshasa" en texte libre → impossible de matcher `forwarder_pricing_profiles.city_id` (UUID exact requis depuis le durcissement RPC).
- Résultat : checkout bloqué « Aucun transitaire ne dessert Kinshasa », même quand un transitaire est correctement configuré.

C'est **le nœud structurel** : sans `country_code` ISO et `city_id` UUID sur `stores`, l'éligibilité stricte des transitaires ne peut jamais matcher.

## Solution

### 1. Migration SQL (prod `vpt...yxf` via fichier téléchargeable)

Ajouter sur `public.stores` :

- `country_code text` — ISO-2 (ex: `CN`, `CD`, `AE`)
- `province_id uuid references public.provinces(id)`
- `city_id uuid references public.cities(id)`
- `commune_id uuid` (optionnel, nullable)
- Index sur `(country_code)` et `(city_id)` pour le matching transitaires.
- Backfill best-effort à partir des colonnes texte existantes : pour chaque store, tenter de résoudre `country` → `country_code` via `countries.name ILIKE country OR code = country`, puis `city` → `city_id` via `cities.name ILIKE city AND country_code = ...`. Les non-résolus restent `NULL` (le vendeur devra re-sélectionner via le combobox).

Le fichier sera fourni dans `/mnt/documents/` et copié dans `frontend/supabase/migrations/` pour le déploiement GitHub Actions.

### 2. Refactor du formulaire boutique

`VendorDashboardPage.tsx` (section Localisation) :

- Remplacer les 2 `<input>` Ville/Pays par un seul `<GeoFieldsRow levels={["country","province","city","commune"]} />` (déjà existant et conforme à la norme plateforme).
- Garder le champ **Adresse** en `<input>` libre (numéro + rue) — conforme à la règle (l'adresse manuelle reste libre).
- State : remplacer `storeCity`/`storeCountry` par un objet `geo: GeoFieldsValue` ; conserver `storeAddress`.
- Chargement : `select` étendu à `country_code, province_id, city, commune` + résolution du nom de ville depuis `cities` pour pré-remplir le combobox.
- Sauvegarde : update de `address`, `country_code`, `province_id`, `city_id`, `commune_id`. On continue d'écrire les colonnes texte legacy `country` / `city` (nom lisible) pour rétrocompat (étiquettes d'expédition, affichage page boutique, anciens scripts).

### 3. Vérification du checkout après correction

Une fois qu'une boutique a `country_code='CN'` et `city_id` renseignés, et qu'un transitaire a :
- `coverage_routes` contenant `{origin_country:"CN", destination_country:"CD"}`
- `forwarder_pricing_profiles` actif avec le `city_id` de Kinshasa et `mode='air'`

…alors le RPC `get_eligible_forwarders_v2` retournera bien le transitaire et le checkout débloquera. On testera avec la boutique « Suzhou Golden Future » de la capture.

### 4. Hors scope (à traiter séparément si besoin)

- Audit des autres formulaires plateforme : déjà conformes selon le memo (AuthPage, CheckoutPage, BecomeForwarderPage, etc.). Aucun autre `<input>` ville/pays détecté côté vendeur dans ce balayage.
- L'admin store creation dialog n'a pas de champs adresse aujourd'hui.

## Détails techniques

- Composant cible : `GeoFieldsRow` (`@/components/address/GeoFieldsRow`) — déjà utilisé partout ailleurs, supporte `country`, `province`, `city`, `commune`, `quartier`, gère les UUIDs.
- Storage : `address text`, `country text` (legacy nom), `country_code text` (ISO), `province_id uuid`, `city text` (legacy nom), `city_id uuid`, `commune_id uuid`.
- Le RPC `get_eligible_forwarders_v2` lit déjà `stores.city_id` (durcissement précédent) — aucune autre modif RPC nécessaire.

## Livrables

1. Fichier SQL téléchargeable dans `/mnt/documents/` : `stores_geo_columns.sql` (ALTER TABLE + index + backfill).
2. Même fichier copié dans `frontend/supabase/migrations/` pour le pipeline GitHub Actions.
3. Refactor `frontend/src/pages/VendorDashboardPage.tsx` avec `GeoFieldsRow`.
4. Mise à jour du memo `mem://preference/geo-fields-combobox-standard` pour ajouter `VendorDashboardPage` à la liste des formulaires alignés.
