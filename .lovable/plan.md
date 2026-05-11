## Correction de cap

Tu as raison : **on ne doit pas renvoyer le client vers le terminal Keccel**. Ce serait redondant, moins contrôlé, et risqué si le client peut ressaisir/modifier le montant. On garde donc le flux voulu :

```text
Zandofy checkout carte
→ Edge Function keccel-cardpay
→ API CardPay Keccel
→ checkoutUrl Mastercard
→ ap-gateway.mastercard.com
```

## Ce que je sais maintenant

**Do I know what the issue is?** Pas encore à 100%, mais je sais où il est : **avant la base et avant le webhook**, au moment où `keccel-cardpay` appelle `https://api.keccel.net/cardpay`.

Ce n’est probablement pas :
- la création de commande ;
- le webhook `kelpay-webhook` ;
- la redirection frontend ;
- la table `payment_transactions`, car la transaction est créée seulement après succès Keccel ;
- RLS, car le diagnostic est bien écrit par service role.

Le blocage est dans **la requête d’initialisation CardPay** : Keccel rejette le payload avec `code: 1 Missing parameter`.

## Vérifications DB à faire avant changement de code

Sur le dernier diagnostic `e2c8bd82`, il faut confirmer si la prod a bien reçu la dernière version où `amount` est une string.

```sql
select diagnostic_id,
       created_at,
       amount,
       amount_sent,
       http_status,
       keccel_code,
       keccel_description,
       merchant_code_masked,
       token_present,
       token_length,
       sent_keys,
       payload_shape->'amount' as amount_shape,
       payload_shape->'merchantcode' as merchant_shape,
       payload_shape->'returnUrl' as return_url_shape,
       payload_shape->'callbackurl' as callback_shape,
       raw_body,
       error
from public.keccel_cardpay_diagnostics
where diagnostic_id = 'e2c8bd82'
order by created_at desc
limit 1;
```

Résultat attendu après le dernier correctif :

```text
amount_shape.type = string
amount_sent = 19
sent_keys contient merchantcode, reference, amount, currency, description, callbackurl, returnUrl
```

Si `amount_shape.type = number`, alors ce n’est pas le bon code qui tourne encore en production.

## Plan d’implémentation proposé

### 1. Garder l’API CardPay, supprimer toute piste terminal

Ne pas construire d’URL `terminal.keccel.com/payment.php`.
Ne pas laisser le client saisir de montant ailleurs.
Ne pas ajouter un deuxième choix Visa/Mobile Money.

### 2. Ajouter un diagnostic contrôlé côté Edge Function

Dans :
- `supabase/functions/keccel-cardpay/index.ts`
- `frontend/supabase/functions/keccel-cardpay/index.ts`

Garder le même payload métier, mais si Keccel répond `code: 1`, essayer automatiquement des variantes **serveur-à-serveur uniquement**, sans interaction client et sans terminal.

Ordre proposé :

```text
Tentative 1 : Authorization: Bearer <token normalisé> + returnUrl
Tentative 2 : Authorization: <token brut> + returnUrl
Tentative 3 : Authorization: Bearer <token normalisé> + returnurl
Tentative 4 : Authorization: Bearer <token normalisé> + returnUrl + returnurl
```

Pourquoi ces variantes :
- le code actuel ajoute `Bearer`, mais les docs internes du projet se contredisent sur le format exact du secret ;
- `returnUrl` est probablement correct, mais l’erreur générique Keccel peut venir d’une casse attendue différente ;
- le lien terminal prouve que Keccel sait ouvrir Mastercard, donc on teste l’exactitude API sans sortir du checkout Zandofy.

### 3. Sécuriser le token sans l’exposer

Normaliser le token avant envoi :

```text
si le secret contient déjà "Bearer ", on enlève ce préfixe avant de reconstruire l’header
```

Cela évite le cas dangereux :

```text
Authorization: Bearer Bearer xxxxx
```

Aucune valeur secrète ne sera loggée.

### 4. Logger chaque tentative dans les diagnostics existants

Pas besoin de migration SQL obligatoire : on peut stocker dans `keccel_response` / `payload_shape` :

```json
{
  "attempt_index": 1,
  "auth_format": "bearer_normalized",
  "return_key_mode": "returnUrl",
  "response": { "code": "1", "description": "Missing parameter" }
}
```

Même `diagnostic_id`, plusieurs lignes possibles, une par tentative.

### 5. S’arrêter dès que Keccel renvoie `code: 0`

Dès qu’une tentative réussit :
- créer `payment_transactions` ;
- mettre la commande en `awaiting_payment` ;
- retourner `redirect_url = keccelResponse.checkoutUrl` ;
- rediriger le client directement vers Mastercard.

### 6. Si les 4 tentatives échouent

Alors on aura une preuve propre que le blocage n’est plus le code Zandofy basique, mais probablement :
- `merchantcode` non habilité CardPay API ;
- token Mobile Money utilisé pour CardPay ;
- callback URL non whitelistée ;
- devise USD non activée pour ce merchant.

À ce moment-là, on prépare un message technique très court à Keccel avec :
- endpoint utilisé ;
- clés envoyées ;
- types des champs ;
- référence ;
- masked merchant ;
- réponses exactes ;
- sans token ni données sensibles.

## Questions utiles à vérifier côté Keccel / secrets

1. Le `merchantcode` CardPay API officiel est-il bien le même que celui du terminal `m=jam`, ou un code séparé de 6 caractères ?
2. Le token CardPay est-il le même que Mobile Money/KelPay, ou Keccel fournit-il un token dédié CardPay ?
3. La callback URL `https://vpttoqojmiqxgudknyxf.supabase.co/functions/v1/kelpay-webhook` est-elle whitelistée côté Keccel pour CardPay ?
4. Le merchant est-il habilité en `USD` pour CardPay Mastercard ?

## Résultat attendu après implémentation

Le prochain test ne proposera pas de terminal. Il donnera soit :

```text
code 0 → redirect_url Mastercard obtenu
```

soit un diagnostic précis :

```text
attempt 1 bearer_normalized → Missing parameter
attempt 2 raw_token → Missing parameter
attempt 3 returnurl → Missing parameter
attempt 4 both_return_keys → Missing parameter
```

Là, on saura si le problème est un format d’appel API ou une habilitation Keccel.