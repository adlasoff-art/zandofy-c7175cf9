## 🎯 Lot 11B (révisé) — Modèle unifié "Delivery Operators" (suppression du self-delivery vendeur)

### Décision d'architecture

**Un seul modèle de last-mile : les Delivery Operators.**

- ❌ **Suppression** de `vendor_delivery_zones` + toggle `can_self_deliver` côté vendeur.
- ✅ Un vendeur qui veut livrer ses propres commandes **s'enregistre comme Delivery Operator** (parcours identique aux entreprises tierces).
- ✅ Zandofy Kinshasa = Delivery Operator "platform-owned" (seed initial).
- ✅ Les vendeurs existants avec `can_self_deliver = true` sont **migrés automatiquement** en opérateur (1 opérateur par vendeur, couverture = ville actuelle de la boutique).

**Bénéfices :**
- 1 seul tableau de bord à maintenir (`/operator`).
- 1 seul flow checkout (sélection opérateur par ville).
- 1 seul système RLS, KYB, commission, KPI.
- Cohérence UX : le client voit toujours "livré par X" indépendamment de qui livre.

---

### Phase B1 — Schéma SQL + RLS + Seed (1 fichier migration téléchargeable)

**Nouvelles tables :**

| Table | Rôle |
|-------|------|
| `delivery_operators` | Profil entreprise (nom, KYB, owner_user_id, is_platform_owned, is_active, platform_commission_pct=25, max_riders=1, status: pending/approved/suspended) |
| `delivery_operator_cities` | Couverture multi-ville (operator_id, country, city, is_active) |
| `delivery_operator_rates` | Tarifs par opérateur (zone_name, commune, quartier, base_price, price_per_km) |
| `delivery_operator_riders` | Flotte (operator_id, user_id, vehicle_type, kyc_status, is_active) |
| `operator_quota_requests` | Demandes augmentation max_riders (1 → 5 → 10 → 30) avec validation admin |
| `operator_commission_ledger` | Traçabilité commission plateforme par livraison |

**Modifs `orders` :** Ajout `delivery_operator_id` (nullable, FK).
**Modifs `app_role` enum :** ajout de `'operator'`.

**RLS (security definer functions) :**
- `is_operator_owner(operator_id)` — owner d'un opérateur voit/édite ses lignes.
- `is_operator_rider(operator_id)` — rider voit ses commandes assignées uniquement.
- Admin/manager = lecture/écriture totale.
- Client = lecture seule des opérateurs `is_active=true` actifs dans sa ville (via vue `v_active_operators_by_city`).

**Triggers :**
- `trg_operator_commission_on_delivered` : à chaque `orders.status = 'delivered'` avec `delivery_operator_id`, insère ligne dans `operator_commission_ledger`.
- `trg_validate_max_riders` : refuse insertion `delivery_operator_riders` si `count >= max_riders`.

**Seed :**
- 1 opérateur "Zandofy Kinshasa" (`is_platform_owned=true`, ville = Kinshasa, max_riders=30).
- Migration data : pour chaque store avec `can_self_deliver=true` → création auto d'un opérateur "Auto-livraison <store_name>" + copie des `local_shipping_rates`.

**Dépréciation :**
- `vendor_delivery_zones` : conservée 30 jours read-only, supprimée plus tard.
- `stores.can_self_deliver` : conservée mais marquée DEPRECATED.

---

### Phase B2 — Onboarding & Dashboard Opérateur

**Parcours `/become-operator` :** Connexion → KYC client → Formulaire KYB entreprise → Déclaration flotte → Sélection villes → Soumission `pending` → modération admin.

**Dashboard `/operator/*` :**
- `OperatorDashboardPage` — KPIs (livraisons, revenus nets, commission retenue, taux succès)
- `OperatorRatesPage` — CRUD tarifs (ville → commune → quartier)
- `OperatorCoveragePage` — Activation par ville (multi-pays)
- `OperatorFleetPage` — Liste riders + invitation (KYC obligatoire)
- `OperatorOrdersPage` — Commandes assignées + assignation rider
- `OperatorBillingPage` — Ledger commissions, payouts
- `OperatorSettingsPage` — Profil + demande augmentation quota

---

### Phase B3 — Admin (modération & supervision)

**`/admin/delivery-operators` :** Liste opérateurs (pending/approved/suspended), validation KYB, override commission, validation quota requests, vue consolidée par opérateur/ville, suspension avec motif.

---

### Phase B4 — Intégration Checkout & Hub

**Au checkout (`CheckoutPage.tsx`) :**
- Étape last-mile : query `v_active_operators_by_city` pour `shipping.city`.
- Si opérateurs disponibles → carte sélection (logo, prix calculé, délai).
- Si aucun → fallback "Retrait au hub".
- Si paiement différé → choix opérateur **différé jusqu'à arrivée hub**.

**À l'arrivée au hub :**
- Si `delivery_operator_id IS NULL` → modal "Choisir mode de livraison".
- Sinon → assignation directe au rider de l'opérateur.

---

### Phase B5 — Documentation

- `mem/features/delivery-operators-multi-tenant.md`
- `mem/features/operator-onboarding-kyb-flow.md`
- Mise à jour `mem/features/last-mile-pricing-logic.md` (déprécie self-delivery vendeur)
- Mise à jour `mem/features/delivery-and-hub-logistics-workflow.md`

---

### 📦 Livrables par phase

| Phase | Livrable | Fichier téléchargeable ? |
|-------|----------|--------------------------|
| B1 | Migration SQL schema + RLS + triggers + seed + migration data | ✅ `lot11b_phase1_operators_schema.sql` |
| B2 | Pages `/operator/*` + parcours `/become-operator` | — (code) |
| B3 | Page `/admin/delivery-operators` + Edge Functions modération | — (code) |
| B4 | Refonte étape last-mile checkout + modal hub | — (code) |
| B5 | 4 fichiers `mem/` | — (code) |

---

### 🔒 Sécurité (non négociable)

- **PII client masquée** : opérateurs voient téléphone + adresse uniquement pour commandes actives assignées, masqué après livraison.
- **Riders** voient uniquement leurs commandes assignées.
- **Owner opérateur** ne voit jamais les commandes d'un autre opérateur.
- **KYC obligatoire** pour tout rider avant activation.
- **KYB obligatoire** pour création opérateur (validation admin manuelle).
- **Edge Functions** : `verify_jwt=true`, validation Zod, rate-limiting sur invitations rider.

---

### ❓ Questions avant exécution

1. **Vendeurs avec `can_self_deliver=true` actifs** : combien en prod ? Migration auto en opérateurs OK, ou tu préfères qu'ils refassent un onboarding KYB manuel (plus propre, mais perte capacité entre-temps) ?

2. **Commission Zandofy Kinshasa** : 25% par défaut. Je l'applique aussi à Zandofy Kinshasa (comptabilité unifiée) ou 0% pour les opérateurs `is_platform_owned=true` ?

3. **Quota riders initial** : 1 par défaut, ou 2 pour éviter frictions au lancement ?

4. **Périmètre B1 immédiat** : je livre **uniquement** la migration SQL téléchargeable + seed + migration data vendeurs. Les pages `/operator/*` (B2) attendent ta validation après revue. OK ?