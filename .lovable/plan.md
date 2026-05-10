## Décision retenue

Envoyer à Keccel un **`amount` entier arrondi à l'entier supérieur** (`Math.ceil`), pas en centimes.

| Prix Zandofy | `amount` envoyé à Keccel |
|---|---|
| 18.99 | **19** |
| 19.99 | **20** |
| 49.99 | **50** |
| 100.00 | **100** |

Justification : tous nos prix se terminent en `.99` (logique de prix stratégique), donc l'arrondi vers le haut ne fait perdre qu'**1 centime maximum** au client — risque négligeable, et conforme à l'attente de Keccel (entier).

## Modifications

### 1. `supabase/functions/keccel-cardpay/index.ts`

- Calculer `amountInteger = Math.ceil(amount)` juste après la validation `amount > 0`.
- Envoyer `amount: amountInteger` dans `keccelPayload` (au lieu de `amount`).
- **Garder `amount` décimal** pour :
  - la table `payment_transactions` (montant réel facturé côté plateforme)
  - le diagnostic `keccel_cardpay_diagnostics.amount`
- Ajouter `amount_sent` (entier) dans le diagnostic pour traçabilité.

### 2. Migration SQL

Ajouter une colonne `amount_sent numeric` à `keccel_cardpay_diagnostics`.

```sql
ALTER TABLE public.keccel_cardpay_diagnostics
  ADD COLUMN IF NOT EXISTS amount_sent numeric;
```

Livrée en fichier téléchargeable `/mnt/documents/keccel_diag_amount_sent_migration.sql`, à exécuter manuellement par toi dans le SQL Editor prod (`vpt...yxf`).

### 3. Aucun changement de schéma fonctionnel

- `payment_transactions.amount` reste le montant **réel** (ex. 18.99).
- Le webhook `kelpay-webhook` n'a rien à changer (il s'appuie sur la `reference`, pas le montant).

## Fichiers impactés

| Fichier | Action |
|---|---|
| `supabase/functions/keccel-cardpay/index.ts` | Modifier — `Math.ceil(amount)` envoyé à Keccel + log `amount_sent` |
| `supabase/migrations/<timestamp>_keccel_diag_amount_sent.sql` | Nouveau — colonne `amount_sent` |
| `/mnt/documents/keccel_diag_amount_sent_migration.sql` | Nouveau — copie téléchargeable |

## Procédure après mon implémentation

1. Je te livre le fichier SQL téléchargeable.
2. Tu l'exécutes dans le SQL Editor prod (`vpt...yxf`).
3. Tu attends que GitHub Actions déploie l'edge function corrigée sur prod.
4. Tu refais un paiement test carte → tu notes le `diag XXXXXXXX`.
5. Tu colles ici le résultat de :
   ```sql
   select diagnostic_id, amount, amount_sent, http_status, keccel_code, keccel_description
   from public.keccel_cardpay_diagnostics
   where diagnostic_id = '<diag>'
   order by created_at desc limit 1;
   ```

Si `keccel_code = "0"` → bingo, c'était bien le format `amount`. Si on reçoit encore "Missing parameter", on saura que ce n'est pas le montant et on passe à l'hypothèse credentials/habilitation merchant CardPay.
