

# Plan : Finaliser le flux de paiement par carte bancaire

## Diagnostic

Le paiement par carte fonctionne (prélèvement confirmé par Keccel), mais deux problèmes empêchent la finalisation :

1. **Le webhook Keccel ne met pas à jour la transaction** — soit le callback n'arrive jamais, soit le format des champs diffère pour les paiements par carte. Résultat : `payment_transactions.status` reste `"pending"` et la commande reste bloquée à `"awaiting_payment"`.

2. **La page `/payment/return` ne fait pas de polling actif** — elle attend passivement un événement Realtime qui ne viendra jamais si le webhook ne se déclenche pas. Il n'y a aucun appel à `kelpay-check` pour vérifier le statut côté Keccel.

3. **Les commandes échouées (tests) restent visibles** pour les vendeurs et admins car le code du paiement carte (lignes 747-750 de CheckoutPage) ne met pas à jour le statut des commandes créées en cas d'erreur.

## Corrections (3 fichiers)

### 1. `frontend/src/pages/PaymentReturnPage.tsx` — Ajouter un polling avec `kelpay-check`

Quand le statut est `"pending"`, la page doit appeler `kelpay-check` toutes les 5 secondes (max 60 tentatives = 5 min) avec la `reference` de la transaction. Si `kelpay-check` retourne `success` ou `failed`, la page se met à jour immédiatement. Le Realtime reste en place comme canal secondaire.

```text
Page chargée → fetch transaction (status = pending)
   ↓
Démarrer polling kelpay-check toutes les 5s
   ↓
kelpay-check retourne "success" → mise à jour page ✅
   ou
kelpay-check retourne "failed" → afficher échec ❌
   ou
5 min écoulées → afficher message "Vérifiez vos commandes"
```

### 2. `frontend/supabase/functions/kelpay-check/index.ts` — Support CardPay

Le `kelpay-check` utilise actuellement l'URL Mobile Money (`checktransaction.asp`) et le `KELPAY_MERCHANT_CODE`. Pour les paiements par carte, il faut :
- Détecter la méthode de paiement via le champ `method` de la transaction (`card` vs `mobile_money`)
- Utiliser l'API CardPay de Keccel pour vérifier les transactions carte (ou utiliser la même API si elle est universelle)
- Utiliser `KECCEL_CARD_MERCHANT_CODE` pour les transactions carte

### 3. `frontend/src/pages/CheckoutPage.tsx` — Nettoyage des commandes carte échouées

Ajouter dans le `catch` du bloc carte (ligne 747) la mise à jour du statut des commandes créées vers `"payment_failed"`, comme c'est déjà fait pour le Mobile Money (ligne 707-708).

### 4. Filtrage des commandes `awaiting_payment` et `payment_failed` côté vendeur

Vérifier que le dashboard vendeur exclut bien les commandes `awaiting_payment` de la liste des commandes à traiter (déjà couvert par `NON_REVENUE_ORDER_STATUSES` pour les KPIs, mais vérifier le listing).

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `frontend/src/pages/PaymentReturnPage.tsx` | Ajouter polling `kelpay-check` toutes les 5s |
| `frontend/supabase/functions/kelpay-check/index.ts` | Supporter les transactions carte (merchant code + API) |
| `frontend/src/pages/CheckoutPage.tsx` | Nettoyer les commandes en cas d'erreur carte |

## Résultat attendu

Après ces corrections, quand un client revient sur `/payment/return` après un paiement carte réussi :
1. La page interroge `kelpay-check` toutes les 5 secondes
2. `kelpay-check` appelle l'API Keccel avec la bonne référence
3. Keccel confirme le paiement → la transaction et la commande sont mises à jour
4. La page affiche "Paiement confirmé !" avec le numéro de commande et le montant

