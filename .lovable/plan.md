Constat prioritaire production

- Le test affiché avec `diag 9ab216af` échoue côté client après 4 variantes CardPay.
- Si la requête SQL en production retourne `Success. No rows returned`, ce diagnostic n’est pas dans la base production interrogée.
- Donc, à ce stade, le problème prioritaire n’est pas encore “Keccel uniquement” : il faut d’abord prouver quelle Edge Function et quelle base sont réellement utilisées par `zandofy.com`.

Ce que le code montre déjà

- Le code CardPay actuel appelle toujours `https://api.keccel.net/cardpay`, pas le terminal Keccel.
- Les deux copies `supabase/functions/keccel-cardpay` et `frontend/supabase/functions/keccel-cardpay` sont identiques côté logique.
- Le workflow GitHub Actions déploie les fonctions depuis `frontend/` avec `supabase functions deploy`, donc la source réellement déployée en prod est surtout `frontend/supabase/functions/**`.
- Les migrations diagnostics `keccel_cardpay_diagnostics` existent uniquement dans `supabase/migrations`, pas dans `frontend/supabase/migrations`, alors que la règle projet dit que `frontend/supabase/migrations/` est la source de vérité Supabase. Cela peut expliquer pourquoi la prod ne retourne aucune ligne ou pourquoi l’insert diagnostic échoue selon l’état réel de la DB prod.

Plan d’action proposé

1. Remettre la source prod au carré
   - Garder `frontend/supabase/functions/keccel-cardpay/index.ts` comme source principale pour GitHub Actions/prod.
   - Garder `supabase/functions/keccel-cardpay/index.ts` synchronisé seulement pour Lovable/preview, sans le présenter comme preuve prod.

2. Corriger la traçabilité prod
   - Copier les migrations `keccel_cardpay_diagnostics` dans `frontend/supabase/migrations/` avec les mêmes colonnes, dont `amount_sent`.
   - Ajouter une migration idempotente si nécessaire, pour éviter les erreurs si la table existe déjà.
   - Objectif : après un test sur `zandofy.com`, le diag doit être visible dans la base production.

3. Renforcer le diagnostic sans changer le parcours client
   - Ne pas rediriger vers `terminal.keccel.com/payment.php`.
   - Conserver l’appel serveur-à-serveur vers `api.keccel.net/cardpay`.
   - Avant chaque insert diagnostic, logger explicitement une erreur si l’insert échoue, avec le nom de table/champ concerné.
   - Retourner au client un message différencié si Keccel refuse l’appel mais que le diagnostic n’a pas pu être persisté.

4. Vérifier les variables prod attendues
   - Documenter clairement que la prod doit avoir : `SITE_BASE_URL=https://zandofy.com`, `KELPAY_TOKEN`, `KECCEL_CARD_MERCHANT_CODE`.
   - Sans afficher les secrets, comparer dans les diagnostics : `site_base_url`, `merchant_code_masked`, `token_present`, `token_length`, `callback_url`.

5. Après merge/deploy prod
   - Tester uniquement depuis `https://zandofy.com`.
   - Interroger la base production avec :

```sql
select diagnostic_id, created_at, environment, origin, site_base_url,
       http_status, keccel_code, keccel_description,
       amount, amount_sent, merchant_code_masked,
       keccel_response->>'attempt_index' as attempt,
       keccel_response->>'auth_format' as auth,
       keccel_response->>'return_key_mode' as return_key,
       raw_body
from public.keccel_cardpay_diagnostics
where diagnostic_id = '<diag>'
order by created_at asc;
```

Résultat attendu

- Si les lignes apparaissent en prod : on saura exactement ce que Keccel reçoit/refuse.
- Si aucune ligne n’apparaît encore : le front prod ne pointe pas vers la base/fonction prod attendue, ou la fonction prod n’est pas celle déployée par GitHub Actions.
- Tant que ce point n’est pas clarifié, Lovable Cloud ne doit pas être utilisé comme preuve de résolution production.