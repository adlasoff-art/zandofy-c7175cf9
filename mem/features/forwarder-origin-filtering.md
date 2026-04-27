---
name: Forwarder Origin Filtering (Lot 11C)
description: Filtrage des transitaires au checkout par pays d'origine produit + segmentation orders.origin_country pour ouverture multi-pays (Turquie/Dubaï/Chine)
type: feature
---

# Filtrage transitaires par origine produit (Lot 11C — Phase 1)

## Problème
Avant : `fetchEligibleFreightOffers` ne filtrait que sur destination + mode → un client commandant un produit turc voyait des transitaires Chine→RDC. Critique à l'ouverture aux boutiques Turquie/Dubaï.

## Solution Phase 1 (livrée)

### Backend
- Index GIN sur `forwarders.coverage_routes` (jsonb).
- Vue `v_product_effective_origin` (security_invoker) : `COALESCE(products.origin_country, stores.country)`.
- RPC `get_eligible_forwarders_v2(p_origin_country, p_destination_country, p_destination_city_id, p_mode)` : filtre par couple origine→destination via `coverage_routes`, retourne `covers_origin_city` et `origin_cities[]`.
- Colonne `orders.origin_country` (ISO2, NULL si multi-origines) + index partiel.

### Frontend
- `freightQuoteCheckout.ts` : `QuoteCheckoutInput.originCountry` ; `fetchEligibleFreightOffers` filtre `coverage_routes` côté client (le RPC v2 reste disponible mais non encore branché). Le service plateforme (`is_platform_owned`) est exempté du filtre.
- `FreightSelector` accepte `originCountry?` et le propage.
- `CheckoutShippingCalculator` calcule l'origine effective : mono-origine → filtre actif ; multi-origines → bandeau ambré informatif, pas de filtre (pour ne pas vider la liste).
- `CheckoutPage.createOrderForPayment` persiste `orders.origin_country` (ISO2 si unique pour la sous-commande, NULL sinon).

## À faire — Phase 2 (multi-origines = split)
Aujourd'hui le panier se split par `store_id` uniquement. Phase 2 doit ajouter la dimension origine :
- 1 sous-commande par couple (store_id, origin_country).
- 1 `FreightSelector` par groupe avec son propre lock `freight_quotes`.
- Total `shipping_cost` = somme des devis.
- Branchement `get_eligible_forwarders_v2` côté UI (au lieu du filtre client).
- Empêcher conflits air/sea entre articles d'un même groupe.

## Règles métier
- Origine produit (`products.origin_country`) > origine boutique (`stores.country`).
- Si aucun transitaire ne couvre la route → liste vide → futur encart "Demander couverture transitaire" (équivalent `request-delivery-coverage`).
- `is_platform_owned = true` toujours visible (admin gère sa couverture globale).
