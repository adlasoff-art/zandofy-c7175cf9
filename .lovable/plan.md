## Fix Keccel CardPay — Missing returnUrl

### Diagnostic

Keccel renvoie : `Missing returnUrl parameter` — donc le champ attendu est bien **`returnUrl`** (camelCase), pas `returnurl`. Mon hypothèse précédente (tout lowercase) était fausse pour ce champ.

### Fix

`frontend/supabase/functions/keccel-cardpay/index.ts` (+ mirror `supabase/functions/keccel-cardpay/index.ts`) :

- Remettre `returnurl` → **`returnUrl`** (camelCase).
- Garder `amount: String(amount.toFixed(2))` (peut-être inoffensif, à vérifier au prochain test).
- Garder logs payload + body brut.

### Validation

Toi : merge → GitHub Actions déploie → retest paiement carte. Si ça passe, on met à jour la mémoire `keccel-cardpay-constraints` avec le format exact (`merchantcode`, `callbackurl` lowercase ; `returnUrl` camelCase ; `amount` string).
