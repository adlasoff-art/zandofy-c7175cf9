# Fix CardPay — Keccel exige un champ supplémentaire

## Ce que le diagnostic prouve (CSV n°5)

- Stack frappée = bonne : `environment = vpttoqojmiqxgudknyxf` (prod), `site_base_url = https://zandofy.com` ✅
- Token et merchantcode présents (`token_length=36`, `JA***IO`) ✅
- `returnUrl` (camelCase) est bien reçu par Keccel : la tentative qui n'envoyait QUE `returnurl` (lowercase) reçoit l'erreur précise « Missing returnUrl parameter » → l'API parse bien le nom camelCase
- Les 3 tentatives qui envoyaient `returnUrl` correctement reçoivent quand même HTTP 400 avec **« Missing&nbsp;&nbsp;parameter »** (nom vide entre deux espaces) → Keccel a un champ requis dont **le template d'erreur n'affiche pas le nom**, donc un champ ajouté récemment et mal documenté
- Historique (CSV n°6) : la dernière transaction `success` date du **31 mars 2026** avec exactement le même format de référence `KC<23 hex>` → notre payload de l'époque marchait, donc **Keccel a ajouté un champ obligatoire entre le 31 mars et aujourd'hui**

## Hypothèses sur le champ manquant (par ordre de probabilité)

1. **`language`** (`fr` / `en`) — très fréquent dans les CardPay africains qui hébergent leur propre page checkout
2. **`customerEmail`** — exigé pour 3DS / reçu
3. **`customerName`** — souvent requis pour MasterCard
4. **`customerPhone`** — exigé pour SMS OTP
5. **`notifyUrl`** (en plus de `callbackurl`)
6. **`country`** (`CD`) ou **`channel`** (`web`)

Le template d'erreur Keccel ne nous le dit pas, donc on va **brute-forcer** intelligemment : au lieu d'ajouter des champs au hasard, on ajoute UNE NOUVELLE série de tentatives qui empile les champs candidats. La table de diagnostic nous dira exactement laquelle débloque.

## Action concrète (ce que je code dès que tu approuves)

### 1. Étendre `frontend/supabase/functions/keccel-cardpay/index.ts`

Ajouter 6 nouvelles tentatives, **dans l'ordre**, qui complètent le payload existant (tout reste : `merchantcode`, `reference`, `amount`, `currency`, `description`, `callbackurl`, `returnUrl`, `Bearer <token>`) :

| Tentative | Champ(s) ajouté(s) |
|---|---|
| 5 | `language: "fr"` |
| 6 | `language: "fr"`, `customerEmail: <email user>` |
| 7 | + `customerName: <prénom + nom>` |
| 8 | + `customerPhone: <phone user>` (E.164) |
| 9 | + `notifyUrl: <même que callbackurl>` |
| 10 | + `country: "CD"`, `channel: "web"` |

À chaque tentative, on persiste comme avant `payload_shape`, `http_status`, `keccel_description`. **Dès qu'une renvoie `code: "0"`, on arrête, on log la combinaison gagnante, et on l'utilisera comme payload de référence.**

Pour récupérer email/nom/phone : déjà lus depuis `profiles` ou `orders` côté edge (ou depuis `auth.users` via le `user.email`). On normalise (regex E.164 pour le phone, fallback `+243000000000` si absent).

### 2. Améliorer le toast côté front

Dans `CheckoutPage.tsx` ligne 1226, ajouter au message d'erreur la `keccel_description` brute (déjà disponible dans `data.details.body`) pour qu'on n'ait plus besoin d'une requête SQL pour comprendre l'échec à la prochaine itération.

### 3. Workflow de validation

1. Push sur `main` → déploiement auto via `deploy-edge-functions.yml` sur prod `vpt...yxf`
2. Tu lances un essai carte → 10 tentatives au lieu de 4
3. Tu me colles le résultat de la **Requête A** (déjà connue)
4. Je lis quelle tentative a renvoyé `code=0` → je supprime les autres, je verrouille le payload gagnant, je nettoie
5. Une fois stable, je propose de purger la table `keccel_cardpay_diagnostics` (garder 30 jours pour audit)

### 4. Ce que je NE fais PAS encore

- Pas de changement de schéma DB (la table est OK)
- Pas de changement de secrets (ils sont OK)
- Pas de modif des autres edge functions (kelpay-webhook, etc.)

## Risque

Très faible : on n'ajoute que des **champs supplémentaires** au payload Keccel ; les 4 anciennes tentatives restent en première ligne donc si Keccel revient à son comportement d'avant, ça marche. Pas de régression possible côté DB ou côté front (on ne touche que le toast d'erreur en lecture seule).

## Estimation

~80 lignes à ajouter dans `index.ts` + ~3 lignes de toast. 1 commit, 1 push, 1 déploiement auto, 1 test, 1 fix final.
