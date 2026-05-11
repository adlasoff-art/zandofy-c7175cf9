## Lot 1.5 — Tunnel d'achat (Cart + Checkout + Freight)

Volume: ~5 000 LOC sur 7 fichiers, 19+ prix dans CheckoutPage seul. Risque le plus élevé de la Phase 1 (paiement, calcul fret, totaux). Découpé en **deux sous-PR** pour limiter le blast radius et permettre un rollback granulaire.

### Sous-PR 1.5a — CartDrawer + CheckoutPage

Fichiers:
- `frontend/src/components/CartDrawer.tsx` (149 LOC, ~2 prix `$X.toFixed(2)`)
- `frontend/src/pages/CheckoutPage.tsx` (2 252 LOC, 19 prix + ~30 littéraux FR estimés)
- `frontend/src/contexts/I18nContext.tsx` (ajout clés `checkout.*`, `cart.*` manquantes, FR + EN)

Actions:
1. Scan exhaustif des littéraux FR (titres, labels, boutons, toasts, aria-label, placeholders, dialogs) dans Checkout/CartDrawer.
2. Remplacement systématique par `t("key") || "fallback FR"` (pattern déjà validé en 1.1→1.4).
3. Tous les prix affichés (subtotal, total, ligne produit, fees gateway, last-mile, freight, total commande) → `formatPrice(amount)` via `useI18n()`.
4. **Ne PAS toucher** :
   - calculs `pricing-utils.ts`, `last-mile-fee.ts`, markup 45%, commission 10% (logique métier)
   - branchements Keccel/KelPay/COD (SAFETY)
   - signatures de mutations cart/order
   - logique de split cart par store_id / origin_country
5. Vérification `bunx tsc --noEmit`.

### Sous-PR 1.5b — Calculateurs de fret

Fichiers:
- `frontend/src/components/checkout/FreightSelector.tsx` (761 LOC, 12 prix)
- `frontend/src/components/checkout/FreightSummary.tsx` (124 LOC, 4 prix)
- `frontend/src/components/DynamicShippingCalculator.tsx` (437 LOC, 6 prix)
- `frontend/src/components/PrecisionShippingEstimate.tsx` (498 LOC, 4 prix)
- `frontend/src/components/CheckoutShippingCalculator.tsx` (754 LOC, 4 prix)
- `I18nContext.tsx` (ajout clés `freight.*`, `shipping.*`)

Actions:
1. Pattern identique : littéraux FR → `t()`, prix `$X` → `formatPrice(X)`.
2. **Ne PAS toucher** au moteur de quote (`freightQuote.ts`, `shipping.ts`, `dynamic-shipping.ts`, `forwarder-pricing.ts`, Haversine, seuil maritime $49, choix Air/Sea/Road/Rail).
3. Préserver les unités non-monétaires (kg, m³, km, jours) — ne PAS les passer dans `formatPrice()`.
4. Vérif TS.

### Garde-fous transverses

- Zéro changement de business logic, query Supabase, RLS, edge function.
- Zéro changement de signature de fonction exportée.
- Préservation stricte des `.toFixed(2)` dans calculs internes (markup, commission, fees) — ne migrer **que** les valeurs **affichées** à l'utilisateur.
- Fallback FR systématique sur chaque `t()` pour garantir zéro régression d'affichage si une clé manque.
- Bundle delta attendu < +2 KB gzip par sous-PR.

### Validation

- `bunx tsc --noEmit` après chaque sous-PR.
- Smoke manuel : ouvrir panier → checkout → sélection transitaire → vérifier devise active (USD/CDF/EUR…) sur tous les montants.
- Aucune migration SQL, aucune edge function, aucun secret.

### Livraison

Je livre **1.5a** d'abord, demande validation rapide ("ok pour 1.5b ?"), puis enchaîne **1.5b**. Cela limite le diff par PR et permet un rollback ciblé si un prix régressait sur le checkout.
