## Voie B — Test direct avec `jam`

### Étape 1 — Mettre à jour le secret en prod

Tu vas dans **Connectors → Lovable Cloud → Secrets** (ou directement Supabase Vault sur le projet prod `vpttoqojmiqxgudknyxf`) et tu mets :

- **Nom** : `KECCEL_CARD_MERCHANT_CODE`
- **Valeur** : `jam` (3 caractères, **minuscules**, **aucun espace** avant/après)

⚠️ Important : c'est le secret côté **prod** (`zandofy.com`), pas Lovable Cloud preview. Si tu utilises GitHub Actions / Vercel pour propager, vérifie que le secret est bien à jour là où l'Edge Function `keccel-cardpay` lit ses env (Supabase Edge Functions secrets du projet prod).

### Étape 2 — Attendre 30 sec puis lancer UN seul test carte

Sur `https://zandofy.com` :
1. Ajoute un produit au panier
2. Va au checkout
3. Choisis paiement par carte
4. Clique « Payer »
5. Note l'heure exacte du clic et le `diag XXXXXX` affiché en cas d'erreur

### Étape 3 — Exécute ce SQL dans le SQL Editor prod

```sql
-- 1) Vérifier que le NOUVEAU merchant code est bien arrivé en Edge Function
SELECT
  created_at AT TIME ZONE 'Africa/Kinshasa' AS heure_kin,
  diagnostic_id,
  merchant_code_masked,           -- doit montrer 'ja***am' ou 'j***m' (3 chars)
  token_length,
  attempt_idx,
  attempt_label,
  http_status,
  keccel_code,
  keccel_description,
  LEFT(raw_body, 200) AS body_extrait
FROM keccel_cardpay_diagnostics
WHERE created_at > NOW() - INTERVAL '15 minutes'
ORDER BY created_at DESC, attempt_idx ASC
LIMIT 30;
```

```sql
-- 2) Résumé : un seul résultat par diag, statut global
SELECT
  diagnostic_id,
  MIN(created_at) AT TIME ZONE 'Africa/Kinshasa' AS heure,
  MAX(merchant_code_masked) AS merchant_used,
  COUNT(*) AS attempts,
  COUNT(*) FILTER (WHERE keccel_code = '0') AS success_count,
  STRING_AGG(DISTINCT keccel_description, ' | ') AS descriptions_keccel
FROM keccel_cardpay_diagnostics
WHERE created_at > NOW() - INTERVAL '15 minutes'
GROUP BY diagnostic_id
ORDER BY heure DESC;
```

### Étape 4 — Lecture des résultats

| Cas | Diagnostic | Action |
|---|---|---|
| `merchant_code_masked` toujours `JA***IO` | Le secret n'a **pas été propagé** à l'Edge Function prod | Vérifier que tu as mis à jour le bon environnement (Supabase Edge Functions du projet prod, pas Lovable Cloud) |
| `merchant_code_masked` = `j***m` ou similaire **et** `success_count > 0` | **GAGNÉ** 🎉 | Je nettoie le code (1 seule tentative au lieu de 10) et on passe en prod propre |
| `merchant_code_masked` changé **mais** `keccel_description` différente (genre `Invalid merchant`, `Account suspended`...) | Nouvelle piste | Tu me partages le texte exact, on adapte |
| `merchant_code_masked` changé **mais** toujours `Missing parameter` identique | Le merchant code n'était pas le souci | On lance les variantes 5-10 (form-urlencoded, header `apikey:`, etc.) |

## Ce que je ferai après ton retour

- **Si succès** : patch minimal sur `keccel-cardpay/index.ts` pour retirer les 9 variantes inutiles, garder le diagnostic, mettre à jour `mem://features/keccel-cardpay-constraints` avec la règle : « merchant code carte ≠ merchant code Mobile Money, valeur officielle = `jam` ».
- **Si échec** : nouvelle vague de variantes ciblée selon l'erreur reçue.

Quand tu as fait l'étape 1+2, dis-moi simplement « secret mis à jour, test fait » et colle les résultats SQL — je te donne le verdict immédiatement.
