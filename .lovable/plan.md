

# Plan : Toggles de paiement par boutique (Lot 1)

## Contexte

La plateforme dispose de 4 moyens de paiement actifs :
- **Mobile Money** (KelPay) — identifié comme `mobile_money`
- **Carte bancaire** (KelPay/Keccel → redirection MasterCard) — identifié comme `card` dans le code, contrôlé par le toggle global `stripe` dans `use-payment-methods.ts`
- **Paiement à la livraison (COD)** — déjà configurable par boutique
- **Paiement hors plateforme** — déjà configurable par boutique
- **PayPal** — toggle global existant

Actuellement, seuls COD et Off-platform ont des toggles par boutique (dans `vendor_pricing_overrides`). Mobile Money et Carte sont uniquement contrôlés globalement.

Le checkout filtre déjà COD/Off-platform via la logique "toutes les boutiques du panier doivent autoriser" (lignes 275-284 de CheckoutPage.tsx).

## Ce qui va changer

### 1. Migration SQL
Ajouter 2 colonnes à `vendor_pricing_overrides` :
- `vendor_mobile_money_enabled BOOLEAN DEFAULT true`
- `vendor_card_enabled BOOLEAN DEFAULT true`

Par défaut `true` : aucun impact sur les boutiques existantes — tout reste activé comme avant.

### 2. Admin UI (AdminVendorPricingPage.tsx)
Ajouter 2 toggles dans la fiche de chaque boutique, à côté des toggles COD/Off-platform existants :
- "Mobile Money" → contrôle `vendor_mobile_money_enabled`
- "Carte bancaire" → contrôle `vendor_card_enabled`

### 3. Checkout (CheckoutPage.tsx)
Étendre la requête existante (ligne 277) pour lire aussi `vendor_mobile_money_enabled` et `vendor_card_enabled`. Appliquer la même logique d'intersection : un moyen de paiement n'apparaît que si **toutes** les boutiques du panier l'autorisent.

### 4. Renommage interne (optionnel mais recommandé)
Renommer la clé `stripe` en `card` dans `use-payment-methods.ts` pour refléter la réalité (KelPay, pas Stripe). Cela reste un changement cosmétique interne sans impact fonctionnel.

## Garde-fous

| Risque | Mitigation |
|--------|-----------|
| Boutique sans aucun paiement actif | Validation : au moins 1 méthode doit rester active (off_platform en dernier recours) |
| Panier multi-boutique | Même logique d'intersection que COD — déjà prouvée |
| Migration destructive | Colonnes ajoutées avec `DEFAULT true` — zéro régression |

## Fichiers impactés

- `supabase/migrations/` — nouvelle migration (2 colonnes)
- `frontend/src/pages/admin/AdminVendorPricingPage.tsx` — 2 toggles
- `frontend/src/pages/CheckoutPage.tsx` — filtrage étendu
- `frontend/src/hooks/use-payment-methods.ts` — renommage `stripe` → `card`

## Estimation
1 session de travail.

---

**Lots suivants (non inclus dans cette implémentation) :**
- **Lot 2** : Mode "Vendeur Local" (restrictions logistiques, pas de maritime)
- **Lot 3** : Package "Vendeur Autonome" (abonnement dédié, paiements plateforme désactivés par défaut mais réactivables par le vendeur, webhooks API)

