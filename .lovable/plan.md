# Diagnostic complet et solution unique — Paiement carte Keccel

## Diagnostic franc

Le bug critique n’est pas un problème de secret, ni de domaine public, ni de configuration `SITE_BASE_URL` d’après ce que tu confirmes. Le défaut principal est dans le code applicatif : le checkout accepte un paiement carte comme “commande confirmée” même quand aucune redirection vers Keccel n’a eu lieu.

### Le flux cassé actuel

Dans `frontend/src/pages/CheckoutPage.tsx`, branche carte :

```text
Client clique Valider
  -> création commande
  -> appel keccel-cardpay
  -> si redirect_url existe : redirection Keccel
  -> sinon : afficher Commande confirmée
```

Le dernier cas est inacceptable pour un paiement carte. Pour une carte bancaire, il n’y a que deux états valides à ce moment-là :

```text
URL Keccel reçue -> redirection obligatoire
URL Keccel absente -> échec d'initiation du paiement
```

Il ne doit jamais y avoir :

```text
URL Keccel absente -> Commande confirmée
```

C’est exactement ce qui a créé le cas que tu as vu : côté client la commande paraît validée, alors que côté admin elle reste en attente de paiement puis finit échouée après expiration.

## Ce qui a changé il y a 7 jours

Le commit `f71ab0f9` a remplacé une ancienne fonction Keccel longue, expérimentale, avec plusieurs tentatives de payload, par une fonction plus courte et conforme à la règle officielle du projet :

```text
merchantcode, reference, amount, currency, description, callbackurl, returnurl
```

Cette partie “payload unique lowercase” est cohérente avec `SAFETY_POLICY.md` section 7. Je ne propose donc pas de revenir à des variantes dangereuses ou non confirmées par Keccel.

Le vrai problème senior est ailleurs : même si la fonction Keccel renvoie `success: true` sans URL exploitable, ou si la réponse contient une URL sous une clé inattendue, le frontend ne doit jamais transformer ça en confirmation client.

## Solution unique proposée

Mettre en place un contrat strict “carte = redirection obligatoire + confirmation uniquement après paiement”.

```text
Checkout carte
  -> créer commande en attente de paiement
  -> appeler keccel-cardpay
  -> si URL Keccel valide : rediriger immédiatement
  -> sinon : marquer la commande payment_failed et afficher erreur

Retour / webhook Keccel
  -> seul le webhook ou la page retour peut confirmer le paiement
  -> jamais la page checkout avant redirection
```

## Changements à appliquer

### 1. Frontend checkout : supprimer le fallback dangereux

Fichier : `frontend/src/pages/CheckoutPage.tsx`

Remplacer la branche actuelle :

```text
pas de redirect_url -> goToStep("confirmation")
```

par :

```text
pas de redirect_url -> marquer orderIds en payment_failed -> afficher erreur paiement
```

Effet immédiat : même si Keccel répond mal, le client ne verra plus jamais “Commande confirmée” sans redirection carte.

### 2. Edge function Keccel : rendre l’absence d’URL terminale

Fichiers :
- `supabase/functions/keccel-cardpay/index.ts`
- `frontend/supabase/functions/keccel-cardpay/index.ts` miroir du projet

Garder le payload officiel en 7 champs lowercase, mais renforcer la validation de réponse :

```text
Keccel code != 0 -> success:false
Keccel code == 0 + URL présente -> success:true + redirect_url
Keccel code == 0 + URL absente -> success:false + diagnostic clair
```

Je ne réintroduis pas les anciennes variantes `returnUrl`, champs client, `language`, `customerEmail`, etc., car elles sont explicitement interdites par la politique Keccel actuelle du projet.

### 3. Extraction robuste de l’URL sans modifier le payload envoyé

Toujours envoyer le payload officiel, mais accepter plusieurs noms de champ en réponse si Keccel varie son JSON :

```text
checkoutUrl
checkout_url
paymentUrl
payment_url
redirectUrl
redirect_url
url
```

C’est sans risque côté contrat Keccel, car on ne change pas la requête envoyée ; on rend seulement la lecture de réponse plus tolérante.

### 4. Page retour paiement : ne confirmer que si transaction payée

Fichier : `frontend/src/pages/PaymentReturnPage.tsx`

Garder le comportement actuel de vérification/polling, mais vérifier qu’aucun paramètre d’URL ne suffit à afficher un succès sans transaction réellement `success`.

Objectif : éviter un second point faible où une URL de retour pourrait afficher un succès trop tôt.

## Contrôle après correction

### Test négatif obligatoire

Simuler une réponse Keccel sans URL :

```json
{ "success": true, "redirect_url": null }
```

Résultat attendu :

```text
pas de page Commande confirmée
commande marquée payment_failed
message d’erreur paiement affiché au client
```

### Test positif obligatoire

Réponse Keccel avec URL :

```json
{ "success": true, "redirect_url": "https://..." }
```

Résultat attendu :

```text
redirection immédiate vers la passerelle Keccel
commande reste awaiting_payment jusqu'au webhook/retour
confirmation uniquement après paiement confirmé
```

### Test de non-régression

Vérifier que ces flux ne changent pas :

```text
Mobile Money
paiement à la livraison
paiement hors plateforme
layout checkout mobile
```

## Déploiement attendu

Ce correctif doit partir via le workflow normal GitHub, puis être déployé sur la production publique `zandofy.com`. Aucun changement de domaine, aucun changement de variable d’environnement, aucune migration base de données n’est nécessaire.

## Résultat attendu

Après ce correctif, il devient impossible qu’un paiement carte affiche “Commande confirmée” tant que le client n’a pas été redirigé vers Keccel puis confirmé par le retour/webhook de paiement.