

## Diagnostic : Pourquoi le paiement KelPay aboutit sans callback

### Probleme identifié (BUG CRITIQUE)

En analysant les données en base, je vois clairement le problème. Voici un exemple de `callback_payload` stocké :

```text
code: 1
transactionstatus: "Sent"
callbackurl: https://uogkklwfvwoxkifpkzpu.supabase.co/functions/v1/kelpay-callback
```

**Le bug est dans `kelpay-payment/index.ts` (ligne ~112)** : le code traite `code !== "0"` comme un échec immédiat. Or, KelPay retourne `code: 1` avec `transactionstatus: "Sent"` quand la requête est **acceptée et envoyée au mobile** — c'est un état **pending**, pas un échec.

Conséquence en chaîne :
1. KelPay retourne `code: 1` + `transactionstatus: Sent` → la transaction est enregistrée comme **"failed"** au lieu de **"pending"**
2. Quand le callback arrive plus tard, `kelpay-callback` vérifie le statut et voit "failed" → **il ignore le callback** (ligne 41-44 : "Don't process if already finalized")
3. La commande reste bloquée à "pending" et n'est jamais confirmée

### Aussi : bug dans `kelpay-check`

La fonction `kelpay-check` utilise `getClaims()` qui n'existe pas dans le SDK Supabase JS v2. Il faut utiliser `getUser()` comme dans `kelpay-payment`.

### Plan de corrections

**1. Corriger `kelpay-payment/index.ts`** — Traiter `code: 1` + `transactionstatus: Sent` comme "pending" au lieu de "failed"

```text
Logique actuelle (BUGGUÉE) :
  code === "0" → pending (insert)
  TOUT LE RESTE → failed (insert)

Logique corrigée :
  code === "0" → pending (paiement instantané accepté)
  code === "1" ET transactionstatus === "Sent" → pending (envoyé au mobile, en attente PIN)
  TOUT LE RESTE → failed
```

**2. Corriger `kelpay-callback/index.ts`** — Permettre la mise à jour même si le statut est "failed" (pour rattraper les anciens cas)

Changer la condition de blocage : ne bloquer que si `status === "success"` (pas "failed"), car un callback peut corriger un faux échec.

**3. Corriger `kelpay-check/index.ts`** — Remplacer `getClaims()` par `getUser()` et permettre aussi la mise à jour des transactions "failed" (même logique que le callback).

**4. Migration SQL pour Vercel** — Corriger les anciennes transactions bloquées :

```sql
-- Remettre en "pending" les transactions qui ont transactionstatus: "Sent"
UPDATE payment_transactions 
SET status = 'pending' 
WHERE status = 'failed' 
  AND callback_payload->>'transactionstatus' = 'Sent'
  AND transaction_id IS NOT NULL;
```

### Résumé des fichiers à modifier

| Fichier | Correction |
|---------|-----------|
| `frontend/supabase/functions/kelpay-payment/index.ts` | `code: 1` + `Sent` = pending |
| `frontend/supabase/functions/kelpay-callback/index.ts` | Ne pas ignorer les transactions "failed" |
| `frontend/supabase/functions/kelpay-check/index.ts` | Fix `getClaims` → `getUser` + même correction statut |
| Migration SQL | Corriger les anciennes transactions |

