## Fix Keccel CardPay — "Missing parameter" (code 1)

### Diagnostic confirmé

Comparaison avec `kelpay-payment` (Mobile Money) qui fonctionne en prod :

| Champ | KelPay (OK) | CardPay actuel (KO) |
|---|---|---|
| `amount` | `String(cleanAmount)` | `amount` (number) ❌ |
| `callbackurl` | lowercase | lowercase ✅ |
| `returnUrl` | n/a | **camelCase** ❌ |

L'API Keccel attend tous les champs en lowercase et `amount` en string. `returnUrl` (camelCase) n'est probablement pas reconnu → considéré manquant. Sur certains endpoints, le champ s'appelle aussi `returnurl` ou `redirecturl`.

### Fix

**Fichier `frontend/supabase/functions/keccel-cardpay/index.ts` (+ mirror `supabase/functions/keccel-cardpay/index.ts`)** :

1. `amount: amount` → `amount: String(amount.toFixed(2))` (alignement KelPay).
2. Renommer `returnUrl` → `returnurl` (lowercase, cohérent avec `callbackurl`).
3. Garder le log payload + body brut pour valider le nouveau format au prochain test.

### Étapes ensuite

- Toi : merge sur `main`, GitHub Actions déploie, retest paiement carte.
- Si ça marche → on capture la doc Keccel exacte dans `mem://features/keccel-cardpay-constraints` (lowercase + amount string).
- Si "Missing parameter" persiste → le log de réponse brute nous dira lequel manque (Keccel renvoie souvent le nom dans `description`).

### Hors scope

Pas de migration, pas de touche Mobile Money, pas de changement UI.
