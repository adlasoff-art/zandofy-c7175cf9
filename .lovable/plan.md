# Plan — Fix combobox plafonds + livraison à domicile inopérante

## Problème 1 — Combobox Pays/Ville s'ouvre "à côté" du Dialog

**Cause** : `GeoCombobox` rend sa liste avec `position: fixed` calculée à partir de `getBoundingClientRect()`. Dans une `Dialog` Radix (qui utilise un overlay et un transform), ce positionnement absolu sort du modal et apparaît décalé en bas à droite (visible sur la capture 1).

**Correctif** : repasser à un dropdown ancré **dans le flux du parent** (`position: absolute` relatif au bouton), avec un z-index élevé et un overflow correct. Le menu doit s'afficher **juste sous le champ Ville**, à l'intérieur du Dialog, avec recherche intégrée — comme attendu.

Détails techniques :
- `frontend/src/components/address/GeoCombobox.tsx` : remplacer le bloc desktop `position: fixed + getBoundingClientRect` par `absolute top-full left-0 right-0 z-[60]` avec `mt-1`.
- Garder le mode plein écran mobile (déjà OK).
- Ajouter `pointer-events-auto` et tester dans le Dialog admin (Plafonds + Zones d'expédition).

## Problème 2 — "Livraison à domicile" désactivée même avec opérateurs créés

**Cause racine** (vérifiée dans `v_active_operators_by_city` v2 + `useOperatorQuotes`):

Le checkout n'affiche un opérateur QUE si :
1. `delivery_operators` : `is_active=true` ET `status='approved'`  ✅ (admin-create-operator le fait)
2. `delivery_operator_cities` : `is_active=true` avec `country_code` + `city` correspondant à l'adresse client  ✅ (créé)
3. **`delivery_operator_rates`** : au moins une ligne `is_active=true` ET `status='approved'` sur `(country_code, city)`  ❌ **JAMAIS CRÉÉE**

Aucune entrée n'est insérée dans `delivery_operator_rates` ni par `admin-create-operator` ni par `become-operator-submit`. Résultat : la vue retourne 0 ligne → `useOperatorQuotes` renvoie `[]` → `hasOperatorCoverage=false` → bouton désactivé avec "Aucun livreur ne dessert encore votre quartier".

**Logique métier à appliquer** (selon la règle énoncée par l'utilisateur) :

| Source de création | Statut opérateur | Statut tarif initial |
|---|---|---|
| Admin (`admin-create-operator`) | `approved` immédiat | `approved` + `is_active=true` immédiat → **livraison opérationnelle dès création** |
| Public (`become-operator-submit`) | `pending` (KYB à valider) | `pending` (validés en même temps que l'opérateur) |

### Correctifs

**A. Dialog admin "Créer un opérateur"** (`CreateOperatorDialog.tsx`)
Ajouter une étape "Tarifs initiaux" obligatoire : pour chaque ville cochée, saisir au minimum `base_price` + `estimated_minutes` (surcharge optionnelle). Sans tarif, on bloque la création — sinon l'opérateur reste invisible côté client.

**B. Edge function `admin-create-operator`**
Après l'INSERT dans `delivery_operator_cities`, INSERT dans `delivery_operator_rates` :
```
status = 'approved', is_active = true, approved_at = now(), approved_by = callerId
```
Une ligne par ville (zone par défaut "Standard"). Plafonds vérifiés par les triggers DB existants (Phase B8).

**C. Edge function `become-operator-submit`**
Si la demande publique inclut des tarifs proposés, INSERT dans `delivery_operator_rates` avec `status='pending'`. Validation par l'admin via la page "Tarifs en attente" (déjà existante).

**D. UI page admin opérateurs**
Sur la fiche opérateur approuvée, afficher un avertissement visuel **"⚠️ Aucun tarif actif — invisible côté client"** si l'opérateur n'a pas de rate `approved+active`, avec lien direct vers l'éditeur de tarifs.

**E. Backfill (optionnel mais recommandé)**
Pour les 2 opérateurs déjà créés (visibles sur capture 2), proposer un script de seed minimal : insérer un tarif de base pour Kinshasa (CD) avec `status='approved'`, `base_price` à définir par l'admin via le dialog, sinon laisser l'admin saisir manuellement via la page Tarifs.

## Fichiers modifiés

- `frontend/src/components/address/GeoCombobox.tsx` — repositionnement dropdown
- `frontend/src/components/admin/operators/CreateOperatorDialog.tsx` — étape Tarifs initiaux
- `frontend/supabase/functions/admin-create-operator/index.ts` — INSERT rates `approved`
- `frontend/supabase/functions/become-operator-submit/index.ts` — INSERT rates `pending`
- `frontend/src/pages/admin/AdminOperatorsPage.tsx` — badge "Aucun tarif actif"
- `mem/features/multi-operator-delivery-system.md` — documenter la règle "création admin = tarif auto-approved"

Aucune migration DB nécessaire (schémas et triggers existent déjà).

## Validation post-implémentation

1. Combobox Pays/Ville s'ouvre **dans** le Dialog Plafonds, juste sous le champ.
2. Créer un opérateur via admin avec couverture Kinshasa + tarif 5$/60min → la livraison à domicile devient cliquable au checkout pour une adresse Kinshasa.
3. Demande publique `/become-operator` reste en attente de validation.
