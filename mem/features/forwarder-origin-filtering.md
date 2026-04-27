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
## ✅ Phase 2 (livrée) — Multi-origines = split
- `groupCartByOriginAndStore()` (`freightQuoteCheckout.ts`) : retourne `CartOriginGroup[]` avec poids/CBM agrégés et intersection `supported_modes` (air/sea).
- `MultiOriginFreightSelector.tsx` : rend N `FreightSelector` (un par groupe), agrège le total et expose un mapping `groupKey → { offer, choice }` au parent.
- `CheckoutShippingCalculator` : détecte `originGroups.length > 1` et bascule sur le multi-selector ; en mono-groupe le flux legacy est inchangé (zéro régression).
- `CheckoutPage.createOrderForPayment` :
  * Si multi-groupes → split par `${store_id}|${origin_country}`, lock 1 `freight_quote` par groupe, `orders.shipping_cost` = devis du groupe (pas de ratio), 1 sous-order par groupe avec `freight_quote_id` dédié.
  * Si mono → comportement antérieur (1 devis verrouillé, ratio par store).
- Gating `handleShippingSubmit` : refuse de continuer si un groupe n'a pas de transitaire choisi.
- Conflit air/sea géré : si `supported_modes` du groupe n'inclut pas le mode actif, encart amber bloquant (le client doit changer de mode ou retirer un article).

## ✅ Phase 3 (livrée) — Empty state "Demander couverture transitaire"
- Table `public.forwarder_coverage_requests` (origin/destination/mode/status + RLS user-own + admin-all).
- Edge Function `request-forwarder-coverage` (Zod, anti-spam 24h par route×mode×user, notif admins in-app `forwarder_coverage_request_new` → `/admin/coverage-requests`).
- `MultiOriginFreightSelector` : quand `availability[group.key] === 0`, affiche encart amber + bouton "Demander couverture" (loader + état "Envoyé").
- `AdminCoverageRequestsPage` : second onglet **Transitaires** listant les demandes (route, mode, statut) avec action "Marquer traitée".

## Reste à faire (non bloquant MVP)
- Brancher `get_eligible_forwarders_v2` côté UI (RPC) au lieu du filtre client en JS — gain perf si beaucoup de transitaires.
- Tests unitaires `groupCartByOriginAndStore` (mocks Supabase nécessaires).
- Empty state mono-flow (`FreightSelector` direct, hors multi-origines) — actuellement le selector affiche déjà un message "Aucun transitaire", mais sans bouton de demande.

## Règles métier
- Origine produit (`products.origin_country`) > origine boutique (`stores.country`).
- Si aucun transitaire ne couvre la route → liste vide → futur encart "Demander couverture transitaire" (équivalent `request-delivery-coverage`).
- `is_platform_owned = true` toujours visible (admin gère sa couverture globale).
