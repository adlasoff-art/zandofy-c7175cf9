

# Plan de correction complète du parcours d'achat — International vs Local

## Contexte

L'analyse du code révèle 16 problèmes (6 critiques, 6 moyens, 4 mineurs) dans le tunnel d'achat. Ce plan corrige l'ensemble en une implémentation cohérente et professionnelle.

---

## Migration SQL requise

Une migration unique couvrant :
- Ajout de colonnes manquantes sur `orders` : `delivered_at`, `delivery_date_requested`, `delivery_time_requested`, `delivery_address_confirmed`, `review_reminder_count`, `review_reminder_last`
- Table `restricted_zones` (zones/quartiers bannis pour livraison)
- Mise à jour du trigger `credit_vendor_wallet_on_delivery` pour vérifier `rider_cash_collected` avant crédit (COD)

---

## Corrections par priorité

### 1. `order_ref` unique par sous-commande (Critique #1)

**Fichier** : `CheckoutPage.tsx` (ligne 481)

Actuellement : `ZND-{timestamp}` identique pour toutes les sous-commandes.
Correction : générer un suffixe incrémental par store → `ZND-{ts}-A`, `ZND-{ts}-B`, etc.

```text
ZND-M1ABCDE-A  (boutique 1)
ZND-M1ABCDE-B  (boutique 2)
```

### 2. `delivery_choice` : harmoniser les valeurs (Critique #5)

**Problème** : le checkout sauvegarde `"home"` / `"hub"` (ligne 529) mais le VendorOrderManager compare à `"home_delivery"` / `"hub_pickup"` (lignes 380, 436, 452, 553).

**Solution** : standardiser sur `"home_delivery"` et `"hub_pickup"` partout. Modifier une seule ligne dans `CheckoutPage.tsx` :
```typescript
delivery_choice: deliveryOption !== "none" ? deliveryOption : null,
// deliveryOption est déjà "home_delivery" | "hub_pickup" | "none"
```
Les valeurs `DeliveryOption` dans le checkout sont déjà `"home_delivery"` et `"hub_pickup"` (lignes 63, 905-906). C'est uniquement lors de l'insertion en base (ligne 529) que la conversion incorrecte `"home"/"hub"` est faite. Suppression de cette conversion.

### 3. Frais d'expédition proportionnels par sous-commande (Critique #3)

**Fichier** : `CheckoutPage.tsx` (ligne 501)

Actuellement : `orderShippingCost = shippingCost` (total global).
Correction : répartition proportionnelle au prorata du sous-total de chaque sous-commande.

```typescript
const orderShippingCost = subtotal > 0 
  ? preciseRound(shippingCost * (orderSubtotal / subtotal), 2) 
  : 0;
```

### 4. Discount réparti proportionnellement (Critique #4)

Même logique de prorata pour `discountAmount` et `pointsDiscount` :
```typescript
const orderDiscount = subtotal > 0 
  ? preciseRound(discountAmount * (orderSubtotal / subtotal), 2) 
  : 0;
```

### 5. Stripe masqué quand désactivé (Critique #2)

Le filtre actuel (ligne 998) garde Stripe visible si `stripe_notice_enabled`. Correction : retirer la condition `stripe_notice_enabled` pour que Stripe soit complètement caché quand le toggle admin est `false`.

### 6. Shipping calculator local vs international (Critique #6)

**Fichier** : `CheckoutShippingCalculator.tsx`

Quand `isLocalStore === true` :
- Masquer les modes Maritime (Sea) — le local n'expédie pas par mer
- Garder Aérien (pour inter-villes, ex: Kinshasa → Lubumbashi), Routier, Ferroviaire
- Utiliser les tarifs `local_shipping_rates` (par zone/quartier) au lieu du calcul de fret international
- Afficher "Aérien local" au lieu de "Aérien" pour distinguer

Quand `isLocalStore === false` (international) :
- Garder Aérien + Maritime (avec seuil minimum)
- Masquer Routier/Ferroviaire (sauf pays voisins, logique déjà en place)

### 7. Last-mile fee : calcul par zone au lieu de 15% statique (Moyen #8)

**Problème** : `lastMileFee = max(shippingCost * 0.15, $2)` est arbitraire.

**Solution** : Le choix de livraison à domicile et son coût ne se fait plus au checkout initial. Il se fait quand la commande arrive au hub (statut `shipped`) :
1. Le vendeur upload la preuve photo du colis arrivé au hub
2. Le client reçoit une notification lui demandant de choisir : **Retrait Hub** ou **Livraison à domicile**
3. S'il choisit livraison à domicile → le système calcule le tarif basé sur la zone de livraison (`local_shipping_rates` par commune/quartier)
4. Le vendeur saisit manuellement le montant (ou le système le calcule par zone)
5. Le client confirme son adresse, choisit date/heure souhaitée, et paye

**Impact checkout** : Supprimer le calcul `lastMileFee` au checkout. Le checkout ne propose que : "Payer expédition maintenant" ou "Payer à l'arrivée". Le choix home vs hub se fait à l'arrivée au hub.

> **Explication "Vendeur limité à index 0-4"** : Cela signifie que le vendeur peut faire avancer la commande uniquement jusqu'à l'étape 4 du flow (= `shipped` pour l'international, = `out_for_delivery` pour le local). Les étapes suivantes sont réservées à l'administration (assignation de livreurs, etc.). C'est une mesure de sécurité pour empêcher un vendeur de marquer une commande "livrée" sans intervention admin/livreur.

### 8. Supplier info modal → sélection depuis fournisseurs liés (Moyen)

**Fichier** : `OrderTransitionModals.tsx` — `SupplierInfoModal`

Actuellement : saisie manuelle (plateforme, numéro, lien).
Correction : 
- Charger les fournisseurs déjà liés au produit (via `product.supplier_id` → table `suppliers`)
- Pré-sélectionner le fournisseur existant
- Option "Confirmer ce fournisseur" (1 clic) ou "Changer" (dropdown avec les fournisseurs du vendeur)
- Le numéro de commande fournisseur et le lien restent à saisir (spécifiques à chaque commande)

### 9. Zones restreintes / bannies pour la livraison

Nouvelle table `restricted_zones` :
```sql
CREATE TABLE public.restricted_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  zone_name text NOT NULL,  -- commune/quartier
  country_code text DEFAULT 'CD',
  reason text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```
Au checkout et au moment du choix de livraison à domicile, vérifier que l'adresse/commune n'est pas dans une zone restreinte.

### 10. Flux post-livraison : signature, preuve, rappel avis

- **Signature livreur** : à l'étape `delivered`, le livreur capture une photo + signature digitale (canvas)
- **Rappel avis client** : après `delivered`, notification quotidienne (max 5 rappels) tant que le client n'a pas soumis d'avis, avec mention des points à gagner
- **Avis vendeur → client** : nouvelle table `vendor_customer_reviews` permettant au vendeur de noter le client (1-5 étoiles + commentaire)

### 11. Off-platform : blocage commande sans preuve (déjà en place, ajustements)

Le code actuel bloque bien le vendeur tant qu'aucune preuve n'est uploadée (ligne 474-528). Ajustements :
- Notification au vendeur quand le client uploade la preuve
- Notification au client quand le vendeur valide/refuse
- Empêcher tout changement de statut (pas seulement via le bouton "Avancer") tant que `status = awaiting_payment`

### 12. COD : mécanisme de confirmation cash (Moyen #15)

- Le livreur doit marquer `rider_cash_collected = true` avant que la commande puisse passer à `delivered`
- Le trigger `credit_vendor_wallet_on_delivery` vérifie ce flag pour les commandes COD

### 13. Points ZandoPoints : déduction effective (Mineur #13)

Après création de commande avec `pointsDiscount > 0` :
```typescript
await supabase.rpc("deduct_points", { p_user_id: user.id, p_amount: pointsToUse });
```
Créer la RPC `deduct_points` qui met à jour `zando_points.balance` et insère un `point_transactions`.

### 14. Coupon `current_uses` incrémenté (Mineur #14)

Après création de commande réussie avec coupon :
```typescript
if (appliedCoupon) {
  const table = appliedCoupon.source === "store" ? "store_coupons" : "coupons";
  await supabase.rpc("increment_coupon_uses", { p_code: appliedCoupon.code, p_table: table });
}
```

### 15. Copie au presse-papier pour réf/tracking/code

Ajouter un composant `CopyableField` réutilisable (icône copier à côté du texte) utilisé pour :
- `order_ref` dans le dashboard client
- `tracking_number` dans le suivi
- `confirmation_code` dans les détails commande

### 16. Email/PDF confirmation à la validation de commande

Dès qu'une commande passe de `awaiting_payment` → `pending` (off-platform validé, MoMo confirmé) ou est créée en `pending` (COD) :
- Envoi d'un email de confirmation avec récapitulatif
- PDF de confirmation disponible en téléchargement dans le dashboard

---

## Fichiers impactés

| Fichier | Modifications |
|---------|--------------|
| `CheckoutPage.tsx` | #1 order_ref, #2 delivery_choice, #3 shipping prorata, #4 discount prorata, #5 stripe masqué, #7 supprimer lastMileFee checkout, #13 points, #14 coupon |
| `CheckoutShippingCalculator.tsx` | #6 modes transport local vs intl |
| `VendorOrderManager.tsx` | #8 supplier modal, #10 rappel avis, #11 off-platform notifs, #12 COD cash check |
| `OrderTransitionModals.tsx` | #8 SupplierInfoModal refonte sélection fournisseur |
| `DashboardPage.tsx` | #7 choix home/hub au statut shipped, #15 CopyableField |
| `TrackingPage.tsx` | #15 CopyableField |
| Nouveau : `CopyableField.tsx` | #15 composant réutilisable |
| Nouveau : `restricted_zones` (migration) | #9 zones bannies |
| Migration SQL | #9, #10, #12, #13, #14 |
| Edge Function `generate-invoice` | #16 email confirmation |

---

## Ordre d'implémentation

1. Migration SQL (tables, fonctions, triggers)
2. Corrections critiques checkout (#1, #2, #3, #4, #5)
3. Séparation shipping local/intl (#6)
4. Refonte last-mile au hub (#7)
5. Supplier modal refonte (#8)
6. Zones restreintes (#9)
7. Post-livraison : signature, avis, rappels (#10)
8. Off-platform + COD ajustements (#11, #12)
9. Points + coupon fixes (#13, #14)
10. CopyableField + PDF confirmation (#15, #16)

