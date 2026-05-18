## Diagnostic

La capture montre maintenant une erreur “Keccel n’a pas renvoyé d’URL de paiement exploitable”. Cette erreur protège contre l’ancien bug grave : afficher “Commande confirmée” sans redirection ni paiement.

Mais elle révèle le vrai problème restant : notre fonction `keccel-cardpay` reçoit une réponse acceptée par Keccel, mais ne récupère pas l’URL finale de paiement carte.

Le flux attendu doit être :

```text
Client choisit Carte bancaire
  -> Confirmer la commande
  -> appel Keccel CardPay avec montant + référence + returnurl + callbackurl
  -> Keccel crée une session
  -> Zandofy redirige vers l’URL Mastercard ap-gateway / checkout
  -> webhook/retour confirme ensuite le paiement
```

Il ne faut pas rediriger manuellement vers `https://terminal.keccel.com/payment.php?m=jam` comme solution principale, parce que ce terminal oblige potentiellement le client à refaire un choix de mode de paiement. Cette URL peut seulement servir de secours si Keccel la renvoie explicitement, pas comme remplacement de la session Mastercard.

## Ce qui est probablement cassé

D’après les URLs que tu donnes, l’URL utile est du type :

```text
https://ap-gateway.mastercard.com/checkout/pay/SESSION...
```

Le code actuel extrait seulement quelques clés de premier niveau (`checkoutUrl`, `paymentUrl`, `redirectUrl`, `url`). Si Keccel renvoie la session Mastercard sous une autre clé, dans une clé avec autre casse, ou imbriquée dans un objet, notre fonction conclut à tort : “pas d’URL exploitable”.

## Solution à appliquer

### 1. Garder la sécurité actuelle

Ne jamais rétablir l’ancien fallback :

```text
pas d’URL -> Commande confirmée
```

Pour carte bancaire, ce comportement reste interdit.

### 2. Corriger l’extraction d’URL dans `keccel-cardpay`

Dans les deux copies :

- `supabase/functions/keccel-cardpay/index.ts`
- `frontend/supabase/functions/keccel-cardpay/index.ts`

remplacer l’extraction actuelle par une extraction robuste qui :

- scanne récursivement toute la réponse JSON Keccel ;
- accepte les clés probables : `checkoutUrl`, `checkout_url`, `paymentUrl`, `payment_url`, `redirectUrl`, `redirect_url`, `url`, `paymentLink`, `payment_link`, `checkout`, `link`, `href` ;
- accepte surtout toute valeur string qui contient une URL `https://ap-gateway.mastercard.com/checkout/pay/SESSION...` ;
- priorise l’URL Mastercard `ap-gateway.mastercard.com/checkout/pay/SESSION...` si plusieurs URLs existent ;
- ne prend pas une URL callback/return Zandofy comme URL de paiement ;
- ne génère jamais un numéro de session Mastercard côté Zandofy, car cette session doit être créée par Keccel/Mastercard.

### 3. Garder le payload Keccel officiel

Ne pas faire de boucle de variantes et ne pas ajouter de champs non validés.

Payload conservé :

```text
merchantcode, reference, amount, currency, description, callbackurl, returnurl
```

Le diagnostic reste côté lecture de réponse, pas côté modification de la requête.

### 4. Améliorer le message d’erreur client

Le toast mobile actuel expose trop de détails techniques (`HTTP 200`, description complète, diagnostic brut). Le remplacer par un message court :

```text
Redirection carte indisponible. Veuillez réessayer ou choisir Mobile Money.
```

Le `diagnostic_id` doit rester dans les logs et détails console pour support/admin, pas dans un gros toast client.

### 5. Sécuriser `PaymentReturnPage`

Corriger le point faible actuel : si aucune transaction n’est trouvée, `status=success` dans l’URL ne doit jamais afficher “Paiement confirmé”.

Règle :

```text
succès affiché uniquement si payment_transactions.status = success
```

Sinon : pending/failed, mais jamais success uniquement sur paramètre URL.

## Tests à faire après implémentation

### Test négatif

Réponse Keccel code 0 sans aucune URL Mastercard ni URL de paiement :

```json
{ "code": "0", "description": "..." }
```

Résultat attendu :

```text
pas de Commande confirmée
commande payment_failed
message client court
logs avec diagnostic_id
```

### Test positif

Réponse Keccel contenant quelque part :

```text
https://ap-gateway.mastercard.com/checkout/pay/SESSION...
```

même si l’URL est imbriquée ou sous une clé inconnue.

Résultat attendu :

```text
redirection immédiate vers Mastercard
commande awaiting_payment
confirmation seulement après webhook/retour confirmé
```

### Non-régression

Ne pas modifier :

```text
Mobile Money
paiement à la livraison
paiement hors plateforme
layout checkout mobile
variables/domaines de production
```

## Déploiement

Aucun changement de domaine, aucun sous-domaine à ajouter, aucune variable d’environnement et aucune migration DB. La correction doit partir par le workflow GitHub normal vers `zandofy.com`.