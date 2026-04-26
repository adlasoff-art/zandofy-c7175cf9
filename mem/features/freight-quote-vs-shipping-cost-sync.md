---
name: Freight Quote vs Shipping Cost Sync
description: Source unique de vérité pour le coût de transport international, garde-fous lockFreightQuote, fallback affichage et procédure de resync admin.
type: feature
---

# Cohérence freight_quotes.quoted_price ↔ orders.shipping_cost

## Problème historique (avant Lot 11A)

Deux sources de vérité non synchronisées pour le coût de transport :
- `freight_quotes.quoted_price` (devis verrouillé) — affiché dans `FreightDetailsPanel`.
- `orders.shipping_cost` (montant facturé) — affiché dans le sous-total commande.

Cas observé sur `ZND-MOFRHBGT` : panneau "Transport international USD 0.00" alors que le sous-total facturait `Expédition $15.50`.

## Cause racine

Dans `frontend/src/services/freightQuoteCheckout.ts → lockFreightQuote()` :
- `lockedTotal = offer.split_total ?? offer.quote.total`
- Si `split_total` était numérique mais `0` (cas mono-colis ou sous-colis non générés), le `??` ne basculait PAS sur `quote.total` (qui pouvait être correct).
- Résultat : devis verrouillé à 0 USD persisté en base, alors que l'UI checkout affichait le bon prix et le persistait dans `orders.shipping_cost`.

## Correctif (Lot 11A)

### 1. Garde-fou côté `lockFreightQuote`
- Choisit le premier candidat `> 0` parmi `[consolidated_total, split_total, quote.total]` (au lieu de `??`).
- Refuse de persister un devis si tous candidats sont ≤ 0 (retour `null` + warning).

### 2. Source unique au checkout (`CheckoutPage.tsx`)
- Après `lockFreightQuote`, re-fetch `freight_quotes.quoted_price` persisté.
- `orders.shipping_cost` est dérivé de ce montant persisté (au lieu de `shippingCost` local).
- Garantit qu'il n'y a plus jamais d'écart entre les deux tables pour les nouvelles commandes.

### 3. Affichage robuste (`FreightDetailsPanel.tsx`)
- Si `quoted_price = 0` mais `orders.shipping_cost > 0` → affiche `shipping_cost` (vérité financière) avec badge ambré "Devis désynchronisé".
- Bouton admin "Resynchroniser le devis" qui met à jour `freight_quotes.quoted_price = orders.shipping_cost`.

## Procédure de resync data (commandes existantes en prod)

```sql
-- 1. Audit
SELECT o.order_ref, o.shipping_cost, fq.quoted_price, fq.id
FROM orders o
JOIN freight_quotes fq ON fq.id = o.freight_quote_id
WHERE COALESCE(fq.quoted_price,0) <= 0 AND COALESCE(o.shipping_cost,0) > 0;

-- 2. Patch bulk (Supabase prod uniquement, après revue)
UPDATE freight_quotes fq
SET quoted_price = o.shipping_cost
FROM orders o
WHERE o.freight_quote_id = fq.id
  AND COALESCE(fq.quoted_price,0) <= 0
  AND COALESCE(o.shipping_cost,0) > 0;
```

Sinon : utiliser le bouton "Resynchroniser" de chaque fiche commande (admin).

## Fichiers touchés
- `frontend/src/services/freightQuoteCheckout.ts`
- `frontend/src/pages/CheckoutPage.tsx`
- `frontend/src/components/orders/FreightDetailsPanel.tsx`
