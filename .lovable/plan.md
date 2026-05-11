## Diagnostic

La doc Keccel (PDF officiel) confirme :
- Endpoint `POST https://api.keccel.net/cardpay` ✅ (notre code)
- Header `Authorization: Bearer <token>` ✅
- 7 paramètres body tous obligatoires ✅
- **Mais l'exemple page 2 envoie `"amount": "100"` en STRING**, pas en number

Notre diagnostic prod montre `payload_shape.amount.type = "number"`. C'est ça l'erreur. Keccel renvoie `code:1 "Missing parameter"` car son parser strict ne reconnaît pas `amount` quand ce n'est pas une string.

L'`amount_sent: 19` (entier, post `Math.ceil`) reste correct sur le fond — il faut juste l'envoyer en string `"19"`.

## Changements

### 1. `supabase/functions/keccel-cardpay/index.ts` (prod via GitHub Actions)

Une seule ligne change dans `keccelPayload` :

```ts
// AVANT
amount: amountSent,

// APRÈS
amount: String(amountSent),  // Keccel exige une string (cf. doc Kelpay_API_Card)
```

Le diagnostic enregistré dans `keccel_cardpay_diagnostics.amount_sent` (numeric) reste l'entier — pas de changement DB.

### 2. `frontend/supabase/functions/keccel-cardpay/index.ts`

Même changement (la prod tire de ce dossier via GitHub Actions).

### 3. Pas de migration SQL nécessaire

La colonne `amount_sent numeric` est déjà en place et reste valide (on logge l'entier).

## Procédure post-implémentation

1. Tu pousses `main` → GitHub Actions déploie en ~2 min
2. Tu refais un test paiement carte sur prod
3. Tu me partages le diag XXXXXXXX
4. Verdict attendu : `keccel_code = "0"` + `redirect_url` rempli → tu es redirigé sur `ap-gateway.mastercard.com`

## Si ça ne suffit pas (très peu probable)

Cascade de hypothèses restantes, à tester dans l'ordre :
- B. Caster aussi `amount` ET garder le format strict de la doc (clé `returnUrl` avec U majuscule — déjà OK chez nous)
- C. Vérifier que `KECCEL_CARD_MERCHANT_CODE` correspond bien à `JAM…` (les 3 premiers chars du terminal `m=jam`)
- D. Demander à Keccel d'activer/whitelister notre `callbackurl` Supabase

Mais à 95% le cast en string règle l'affaire.
