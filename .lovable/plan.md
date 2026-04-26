# Lot 11B — Phase B8 : Couverture stricte + Tarifs encadrés

## 🎯 Objectifs

1. **Couverture stricte** : "Livraison à domicile" désactivée si **aucun opérateur** ne couvre la commune/quartier du client.
2. **Plafonds admin par ville** : l'admin définit `max_base_price` et `max_surcharge` par ville. Tout tarif opérateur au-dessus est rejeté.
3. **Validation admin systématique** : chaque création/modification de tarif passe en `pending` → l'admin approuve ou refuse depuis `/admin/operators`.
4. **Very Speed Delivery = référence** : tarifs admin (déjà géré), pas de validation pour l'opérateur plateforme.

---

## 🗄️ Phase 1 — Schéma DB (migration)

### Nouvelle table `delivery_operator_city_caps`
Plafonds tarifaires par ville, gérés par l'admin.
```
- id uuid PK
- country_code text NOT NULL
- city text NOT NULL
- max_base_price numeric NOT NULL  -- USD
- max_surcharge numeric NOT NULL DEFAULT 0
- max_estimated_minutes int DEFAULT 180
- notes text
- created_at, updated_at timestamptz
- UNIQUE (country_code, city)
```
RLS : SELECT public, INSERT/UPDATE/DELETE admin only.

### Modifs `delivery_operator_rates`
Ajouter colonnes de validation :
```
- status text NOT NULL DEFAULT 'pending'    -- pending | approved | rejected
- submitted_at timestamptz DEFAULT now()
- reviewed_at timestamptz
- reviewed_by uuid
- rejection_reason text
```
Backfill : tous les tarifs existants → `status='approved'` pour ne pas casser le checkout.

### Trigger `enforce_operator_rate_caps()` (BEFORE INSERT/UPDATE)
- Si l'opérateur est `is_platform_owned=true` → bypass (Very Speed exempté).
- Sinon : vérifie `base_price <= max_base_price` et `surcharge <= max_surcharge` selon la ville. Sinon : `RAISE EXCEPTION`.

### Trigger `force_pending_on_rate_change()` (BEFORE INSERT/UPDATE)
- Si `is_platform_owned=false` et changement de prix → force `status='pending'`, reset `reviewed_*`.

### Vue `v_active_operators_by_city` — mise à jour
Ne compter que les rates `is_active=true AND status='approved'`. Sinon un opérateur en attente de validation apparaîtrait à tort.

### Hook checkout — vue dédiée
Nouvelle fonction `get_operator_coverage(country, city, commune, quartier)` qui retourne `boolean has_coverage` → utilisée par le front pour activer/désactiver "Livraison à domicile".

---

## 🎨 Phase 2 — Front Checkout (couverture stricte)

### `frontend/src/hooks/useOperatorQuotes.ts`
Filtrer côté query : ne renvoyer que les rates `status='approved'`.

### `frontend/src/pages/CheckoutPage.tsx` (lignes 1430-1466)
- Calculer `hasOperatorCoverage = (quotes?.length ?? 0) > 0` (depuis `useOperatorQuotes`).
- Bouton "🚚 Livraison à domicile" : `disabled = !lastMileResult?.deliverable || !hasOperatorCoverage`.
- Si `!hasOperatorCoverage && lastMileResult?.deliverable` → message *"Aucun livreur partenaire ne dessert encore votre quartier. Choisissez le retrait au Hub."*
- Auto-fallback : si l'utilisateur avait coché home_delivery et que la commune/quartier change vers une zone sans couverture → `setDeliveryOption("none")` + toast.
- Validation `handlePlaceOrder` : bloquer si `deliveryOption==="home_delivery" && !selectedOperator`.

### `frontend/src/components/checkout/OperatorSelector.tsx`
Supprimer le message "flotte interne" (plus pertinent — Very Speed est lui-même un opérateur listé). Si `quotes.length === 0` → ne rien afficher (le bouton parent est déjà désactivé).

---

## 🛠️ Phase 3 — Admin : plafonds par ville

### Nouvelle page `/admin/operator-rate-caps`
- Onglet ajouté dans `/admin/operators` ou page dédiée.
- Table : pays / ville / max base / max surcharge / ETA max.
- CRUD complet (form modal create + edit + delete).
- Composant : `frontend/src/components/admin/operators/OperatorRateCapsTable.tsx`.

---

## ✅ Phase 4 — Admin : validation des tarifs

### Nouvelle page `/admin/operator-rates-pending`
- Liste tous les `delivery_operator_rates` en `status='pending'`.
- Colonnes : opérateur, ville, zone/commune/quartier, base, surcharge, ETA, soumis le, plafond ville (rappel).
- Actions : ✅ Approuver / ❌ Refuser (avec raison).
- Edge functions : `admin-approve-operator-rate`, `admin-reject-operator-rate` (verify_jwt + has_role admin + RLS).
- Badge compteur "X tarifs en attente" dans la sidebar admin.

---

## 👷 Phase 5 — Dashboard opérateur (`/operator/rates`)

- Afficher status badge sur chaque tarif (pending / approved / rejected).
- Si rejected → afficher `rejection_reason`.
- Lors de la création/modification : toast *"Tarif soumis à validation admin — apparaîtra au checkout après approbation"*.
- Afficher le plafond de la ville dans le formulaire (lecture seule, info contextuelle).
- Bloquer le submit côté UI si `base_price > max_base_price` (UX, double check du trigger DB).

---

## 📧 Phase 6 — Notifications

- Nouvelle approbation/refus tarif → in-app + email à l'owner opérateur.
- Nouveau tarif soumis → in-app aux admins.
- Edge function : étendre `notify-operator-new-order` ou créer `notify-rate-decision`.

---

## 🧪 Phase 7 — Tests & déploiement

### Staging (Lovable preview + Supabase Lovable)
1. Migration appliquée → vérifier backfill `status='approved'`.
2. Créer un nouveau tarif comme opérateur tiers → doit passer pending.
3. Tester checkout dans une commune sans couverture → bouton home_delivery grisé.
4. Approuver le tarif depuis admin → vérifier qu'il apparaît au checkout.
5. Tester un dépassement de plafond → trigger refuse l'INSERT.

### Production (GitHub → Vercel + Supabase prod vpt...yxf)
- Migration via GitHub Actions (`deploy-edge-functions.yml` + push sur main).
- Smoke test : checkout réel sur Gombe + checkout sur une commune non couverte.

---

## 📝 Mémoire à mettre à jour

`mem://features/multi-operator-delivery-system.md` → ajouter Phase B8 :
- Couverture stricte (no-coverage = home_delivery disabled)
- Caps admin par ville (`delivery_operator_city_caps`)
- Workflow validation tarifs (`status` + triggers + admin pages)
- Very Speed (platform-owned) exempté des caps et de la validation

---

## 🚫 Hors scope (à confirmer pour plus tard)

- Suggestion automatique de communes voisines couvertes (option C de la Q1, pas retenue).
- Toggle "Prépaiement obligatoire" par transitaire (sujet précédent — à traiter dans une phase distincte B9).
- Workflow d'expiration auto si admin tarde à valider (à voir si besoin).
