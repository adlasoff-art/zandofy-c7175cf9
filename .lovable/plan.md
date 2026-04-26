# Lot 11 — Cohérence Fret & Ouverture Last-Mile Multi-Opérateurs

Deux sujets distincts mais liés à la logistique. Je propose de les traiter en **deux sous-lots indépendants** : 11A urgent (bug d'affichage), 11B structurant (nouvelle architecture last-mile).

---

## 🔴 Lot 11A — Bug : `USD 0.00` dans le panneau Transport International

### Diagnostic confirmé (lecture du code)

Sur la commande `ZND-MOFRHBGT` :
- **Sous-total bas** affiche `Expédition $15.50` → vient de `orders.shipping_cost` (champ rempli au checkout via `orderShippingCost = preciseRound(shippingCost * ratio, 2)` dans `CheckoutPage.tsx:720`)
- **Bandeau haut** "Congo Queen Sarl · USD 0.00" → vient de `freight_quotes.quoted_price` (lu par `FreightDetailsPanel.tsx:222`)
- **Écart de calcul** `$20.48 vs $4.98` → le total commande ($4.98) ne contient pas l'expédition, mais l'admin recalcule `subtotal + shipping + last_mile = 20.48`

### Cause racine

Dans `frontend/src/services/freightQuoteCheckout.ts:241-298` (`lockFreightQuote`) :
```ts
const lockedTotal = useConsolidated
  ? co!.consolidated_total
  : (offer.split_total ?? offer.quote.total);
```
Quand `offer.split_total` est `undefined/null` ET que `offer.quote.total` vaut 0 (cas du profil "platform-unavailable" injecté en haut de liste, ou quand le devis dynamique tombe à 0 pour un motif d'éligibilité), on persiste un devis **verrouillé à 0 USD** dans `freight_quotes` — alors que le checkout calcule en parallèle un `shippingCost` correct (15.50) qui finit dans `orders.shipping_cost`.

→ Deux sources de vérité non synchronisées pour le même montant.

### Plan de correction (Lot 11A)

1. **Garde-fou côté `lockFreightQuote`** :
   - Refuser de verrouiller un devis si `lockedTotal <= 0` (retour `null` + log warning).
   - Empêcher la sélection côté UI d'une offre dont `quote.total === 0` ET `is_platform_owned === false` (aujourd'hui ces offres sont grisées seulement pour le cas `platform-unavailable`).

2. **Source unique de vérité au checkout** :
   - Quand `lockedFreightQuoteId` existe, **dériver `orders.shipping_cost` du devis verrouillé** (re-fetch après `lockFreightQuote`) au lieu de la variable locale `shippingCost`.
   - Sinon (commande locale sans devis fret), garder `shippingCost` comme aujourd'hui.

3. **Réconciliation visuelle dans `FreightDetailsPanel`** :
   - Si `quote.quoted_price === 0` mais `orders.shipping_cost > 0` → afficher le `shipping_cost` de la commande avec un badge `⚠ devis désynchronisé` (plutôt que `0.00` muet).
   - Bouton admin "Resynchroniser depuis la commande" qui met à jour `freight_quotes.quoted_price` pour les commandes existantes touchées.

4. **Migration data (one-shot)** : script SQL d'audit listant toutes les commandes où `freight_quote_id IS NOT NULL` et `freight_quotes.quoted_price = 0` et `orders.shipping_cost > 0`, à corriger en bulk.

5. **Documentation** : `mem/features/freight-quote-vs-shipping-cost-sync.md`.

---

## 🟢 Lot 11B — Ouverture du Last-Mile à des Opérateurs Tiers Autonomes

### Vision exprimée

Aujourd'hui :
- `local_shipping_rates` (par ville/zone) = défini par l'admin Zandofy uniquement.
- Self-delivery vendeur = chaque vendeur peut livrer ses propres commandes via `vendor_delivery_zones`.
- Kinshasa = seule ville couverte par la plateforme en livraison à domicile.

Souhaité :
- **Permettre à des entreprises tierces** (sociétés de livraison locales, indépendantes de Zandofy et indépendantes des vendeurs) de **gérer leur propre dernier kilomètre par ville**.
- Chaque opérateur dispose d'un **dashboard autonome** (comme self-delivery vendeur), avec :
  - sa flotte (livreurs),
  - ses tarifs par commune/quartier,
  - ses zones de couverture,
  - ses statistiques.
- L'admin Zandofy garde la main globale (création de profil, modération, override tarifaire), mais l'opérateur configure lui-même ses prix.
- Au checkout : si ville ≠ Kinshasa, le client choisit parmi les opérateurs tiers actifs dans sa ville (au lieu de "livraison indisponible").

### Plan de correction (Lot 11B)

#### Phase B1 — Modèle de données (migration SQL)

Nouvelles tables :
- `delivery_operators` : `id, name, logo_url, owner_user_id, contact_email, contact_phone, is_active, is_platform_owned (bool), created_at`
  - `is_platform_owned = true` pour Zandofy Kinshasa (migration des données actuelles).
- `delivery_operator_cities` : `operator_id, city, country, is_active` (zones de couverture).
- `delivery_operator_rates` : variante par opérateur de `local_shipping_rates` (mêmes colonnes : `zone_name, base_price, price_per_km, commune, quartier`).
- `delivery_operator_riders` : `operator_id, user_id, name, phone, vehicle_type, is_active`.

Adaptation `orders` :
- Ajout `delivery_operator_id` (nullable) pour identifier qui livre.
- `assigned_driver_id` reste, mais référencé via `delivery_operator_riders` au lieu d'une table globale.

RLS :
- Owner d'un `delivery_operators` voit/modifie uniquement ses lignes (rates, riders, orders qui lui sont assignées).
- Admin Zandofy voit tout.
- Client final voit uniquement les opérateurs actifs dans sa ville (via vue `v_active_operators_by_city`).

#### Phase B2 — Dashboard opérateur (UI)

Nouvelle route `/operator/...` (mirroir de `/vendor/`) :
- `OperatorDashboardPage.tsx` (KPIs : livraisons jour/semaine, revenus, taux succès)
- `OperatorRatesPage.tsx` (CRUD des `delivery_operator_rates`)
- `OperatorFleetPage.tsx` (gestion riders)
- `OperatorOrdersPage.tsx` (commandes assignées + assignation rider)
- `OperatorCoveragePage.tsx` (villes couvertes)

Réutiliser un maximum les composants existants (`DeliveryZonesManager`, `RiderAssignmentDialog`, etc.).

#### Phase B3 — Checkout & sélection client

Dans `CheckoutPage.tsx` (étape last-mile, ville sélectionnée) :
- Query `delivery_operators` actifs pour `shipping.city`.
- Affichage façon "ForwarderSelector" mais pour le last-mile : carte par opérateur avec logo, prix calculé selon ses rates, délai estimé.
- Si Kinshasa → opérateur Zandofy par défaut + opérateurs tiers (si présents).
- Si autre ville → uniquement opérateurs tiers actifs ; sinon fallback "Retrait au hub" comme aujourd'hui.

#### Phase B4 — Admin (modération)

Page `/admin/delivery-operators` :
- Création de profils opérateurs (avec assignation owner_user_id).
- Suspension/activation.
- Override tarifaire d'urgence.
- Vue consolidée des commandes par opérateur.

#### Phase B5 — Documentation

- `mem/features/delivery-operators-multi-tenant.md`
- Mise à jour `mem/features/last-mile-pricing-logic.md` pour refléter le multi-opérateur.

### Estimation

- **11A** : 1 session (correction + migration data + tests).
- **11B** : 3-4 sessions (gros chantier ; possible de découper B1+B2 en première itération, B3+B4 ensuite).

---

## ❓ À valider avant exécution

1. **Lot 11A seul d'abord** (urgent, débloque l'affichage en prod), puis on planifie 11B après ta présentation équipe ?  
   Ou **bien tout enchaîner** (11A + démarrage B1+B2 dans la même session) ?

2. Pour 11B, OK pour le nom **"Delivery Operators"** comme entité distincte des vendeurs et des transitaires internationaux (forwarders) ?

3. Pour la migration data 11A, tu veux que je liste d'abord les commandes affectées en lecture (rapport CSV) avant tout `UPDATE`, ou OK pour patcher en aveugle (`shipping_cost > 0` ET `quoted_price = 0`) ?

