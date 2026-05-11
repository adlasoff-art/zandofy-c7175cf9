# Diagnostic CardPay (Keccel / MasterCard) — état actuel + plan d'action

## 1. Ce que je peux confirmer sans accès prod

### Côté DB (prod)
La table `keccel_cardpay_diagnostics` est bien en place sur la prod : ta capture d'écran montre les 27 colonnes attendues (incluant `amount_sent`). **Les deux migrations sont donc déjà appliquées.** Tu n'as plus rien à exécuter côté schéma.

### Côté Edge Function `keccel-cardpay`
Le fichier `frontend/supabase/functions/keccel-cardpay/index.ts` (poussé via GitHub Action `deploy-edge-functions.yml` vers la prod `vpt...yxf`) :
- valide l'auth, le rate-limit, fetch la commande
- calcule `amountSent = Math.ceil(amount)` et envoie `amount` en **string** (conforme doc Kelpay)
- génère une `reference` ≤ 25 chars (`KC` + 23 hex)
- essaie **4 variantes** d'appel à `https://api.keccel.net/cardpay` :
  1. `Bearer <token>` + clé `returnUrl`
  2. token brut + `returnUrl`
  3. `Bearer` + `returnurl` (lowercase)
  4. `Bearer` + les deux clés
- pour chaque tentative, persiste une ligne dans `keccel_cardpay_diagnostics` avec `http_status`, `raw_body`, `keccel_code`, `keccel_description`
- si aucune ne renvoie `code=="0"` → `success:false` + message "Keccel a refusé les 4 variantes (diag XXXX)…"

### Côté front (`CheckoutPage.tsx` lignes 1203-1240)
- Appel correct via `supabase.functions.invoke("keccel-cardpay", …)`
- Si `data.redirect_url` → `window.location.href = data.redirect_url` (pas de nouvel onglet, c'est la **même fenêtre**, comportement normal)
- Le toast "Erreur paiement" s'affiche uniquement quand `data.success === false` ou erreur SDK

### Conclusion intermédiaire
Le code edge + front est cohérent. **Le toast "diag 497a3b2b" que tu as vu signifie que Keccel a renvoyé un HTTP 400 sur les 4 variantes.** La cause n'est ni le schéma DB, ni le code de redirection (puisqu'on n'arrive jamais à `redirect_url`) — la cause est dans le **payload envoyé à Keccel** ou la **config secrets** côté prod.

---

## 2. Ce que tu dois exécuter sur la prod (SQL Editor Supabase `vpt...yxf`)

Une fois que tu as relancé un essai de paiement carte (pour générer une ligne fraîche) :

### Requête A — voir le dernier diagnostic en entier
```sql
select created_at, diagnostic_id, environment, site_base_url,
       merchant_code_masked, token_present, token_length,
       amount, amount_sent, currency,
       reference, length(reference) as ref_len,
       callback_url, return_url,
       sent_keys, payload_shape,
       http_status, keccel_code, keccel_description,
       left(raw_body, 1000) as raw_body_preview,
       error
from public.keccel_cardpay_diagnostics
order by created_at desc
limit 8;
```

Cela te (et me) donne **les 4 tentatives** de la dernière commande + les 4 précédentes. Colle le résultat ici demain.

### Requête B — vérifier qu'on tape bien la prod
```sql
select environment, site_base_url, count(*) 
from public.keccel_cardpay_diagnostics
where created_at > now() - interval '24 hours'
group by 1,2
order by 3 desc;
```
- `environment` doit être `https://vpt....supabase.co` (prod), pas `uog...`
- `site_base_url` doit être `https://zandofy.com` (sinon Keccel refuse le `returnUrl`)

### Requête C — voir si une transaction a quand même été créée
```sql
select id, created_at, status, reference, transaction_id, callback_payload->>'description' as keccel_desc
from public.payment_transactions
where provider = 'keccel'
order by created_at desc
limit 5;
```

---

## 3. Hypothèses prioritaires si Keccel renvoie HTTP 400

Sans la valeur de `keccel_description` je dois lister les causes possibles. La requête A va trancher en une lecture.

| # | Cause probable | Symptôme dans `keccel_cardpay_diagnostics` | Correctif |
|---|---|---|---|
| 1 | `SITE_BASE_URL` côté prod n'est pas `https://zandofy.com` (manque `https://` ou pointe vers staging/lovable) | `site_base_url` ≠ prod, ou `keccel_description` ~ "invalid returnUrl" | Mettre à jour le secret `SITE_BASE_URL` dans la prod Supabase |
| 2 | `KECCEL_CARD_MERCHANT_CODE` mauvais merchant ou non whitelisté pour `zandofy.com` | `keccel_description` ~ "merchant not found" / "domain not allowed" | Vérifier avec Keccel + corriger le secret |
| 3 | `KELPAY_TOKEN` expiré / token Mobile Money réutilisé pour CardPay | HTTP 401/403 ou "invalid token" | Demander un token CardPay dédié à Keccel |
| 4 | Devise USD non activée pour le marchand | "currency not supported" | Activer USD côté Keccel ou basculer sur CDF |
| 5 | `description` contient un caractère interdit (l'emoji/accent passe mais "—" non) | "invalid description" | Sanitiser la `description` |
| 6 | Référence trop longue ou format refusé (Visa = 25, Mastercard parfois 22) | "invalid reference" | Réduire à 22 chars |

---

## 4. Plan d'action pour demain (à approuver)

1. **Tu lances un essai carte en prod** → un toast "diag XXXX" apparaît.
2. **Tu colles le résultat de la requête A** ici.
3. Je lis `keccel_description` + `raw_body` + `site_base_url` et je te dis **exactement** quel secret/champ corriger (un seul aller-retour).
4. Je corrige le code de l'edge function si besoin (ex: sanitiser description, raccourcir ref, ajouter un header) → push GitHub → redéploiement auto via `deploy-edge-functions.yml` sur la prod.
5. Tu retestes ; si `success` → on supprime ensuite la table de diagnostic ou on la garde 30 jours pour audit.

## 5. Ce que je ne peux PAS faire seul
- Lire les secrets `SITE_BASE_URL` / `KECCEL_CARD_MERCHANT_CODE` / `KELPAY_TOKEN` de la prod (Lovable n'a pas accès au projet `vpt...yxf`).
- Lire les logs edge prod (idem).
- Donc la requête A est **l'unique pont** entre toi et moi pour diagnostiquer.

Bonne nuit. Au réveil : un essai carte + requête A collée = je te livre le fix exact dans la foulée.
