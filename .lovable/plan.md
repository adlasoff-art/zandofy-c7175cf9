Oui, j’ai compris le problème, et ta frustration est légitime : en production, le checkout mélange actuellement plusieurs couches de logique qui ne devraient pas se mélanger.

Le comportement observé vient très probablement de trois incohérences combinées :

1. Le nouveau sélecteur `FreightSelector` filtre partiellement par origine produit et ville, mais il laisse toujours passer le transitaire plateforme (`is_platform_owned`, Very Speed) même si la route/ville ne correspond pas.
2. Quand le nouveau sélecteur dit “aucune offre réellement disponible”, le checkout affiche encore l’ancien `ForwarderSelector` legacy en fallback, qui ne connaît pas l’origine produit et utilise un ancien RPC. Cela peut faire réapparaître des transitaires qui ne devraient plus être là.
3. La règle `city_id IS NULL OR city_id = ville_client` autorise des profils “pays entier” à apparaître dans toutes les villes. Or pour votre modèle métier, un transitaire doit être affiché au checkout seulement s’il a un profil ville correspondant, sauf si vous avez explicitement créé un vrai profil national.

La nouvelle règle métier doit être stricte :

```text
Origine effective du produit
= products.origin_country si renseigné
= sinon stores.country

Puis filtrage checkout :
1. origine effective produit -> pays destination
2. mode de transport sélectionné
3. profil tarifaire actif pour la ville client
4. grille tarifaire applicable donnant un montant > 0
5. aucune carte sélectionnable si ces conditions ne sont pas toutes vraies
```

## Solution proposée

### 1. Faire du profil ville la source de vérité de la desserte
Au checkout, un transitaire ne sera sélectionnable que s’il possède un `forwarder_pricing_profiles` actif pour :

- `country_code = pays destination`, ex. `CD`
- `city_id = ville client`, ex. Kinshasa ou Lubumbashi
- `mode = air/sea/...`
- `is_active = true`

Conséquence :
- Very Speed configuré seulement Kinshasa n’apparaîtra plus comme offre sélectionnable à Lubumbashi.
- Congo Queen Lubumbashi apparaîtra à Lubumbashi si son profil Lubumbashi existe.
- JH / Saidi / Very Speed Kinshasa apparaîtront à Kinshasa si leurs profils Kinshasa existent.

### 2. Utiliser l’origine produit comme priorité absolue
La logique restera :

```text
si products.origin_country existe -> utiliser ce pays
sinon -> utiliser stores.country
```

Donc une boutique basée en Chine avec un produit d’origine Turquie affichera les transitaires Turquie -> RDC, pas Chine -> RDC.

### 3. Corriger le RPC `get_eligible_forwarders_v2`
Je propose une migration SQL qui remplacera `get_eligible_forwarders_v2` pour qu’il retourne uniquement les profils réellement éligibles :

- route `coverage_routes` contenant `origin_country -> destination_country`
- mode inclus dans `supported_modes`
- profil tarifaire actif pour la ville exacte demandée
- plus de logique permissive qui laisse passer un profil national sauf règle explicitement prévue

La version actuelle du RPC autorise `fpp.city_id IS NULL OR fpp.city_id = p_destination_city_id`. Je la remplacerai par une condition stricte sur `city_id = p_destination_city_id` pour le checkout.

### 4. Corriger `fetchEligibleFreightOffers`
Dans `frontend/src/services/freightQuoteCheckout.ts`, je vais :

- supprimer l’exception qui garde toujours `is_platform_owned` visible comme offre sélectionnable ;
- ne garder Very Speed que si son profil correspond vraiment à la ville et à l’origine ;
- ignorer toute offre dont le calcul donne `quote.total <= 0` ou “sur devis” dans le checkout client ;
- afficher l’état “aucun transitaire ne dessert cette route/ville” au lieu d’un transitaire à USD 0.00.

### 5. Supprimer le fallback legacy contradictoire au checkout
Dans `CheckoutShippingCalculator.tsx`, je vais empêcher l’ancien `ForwarderSelector` de s’afficher pour le flux international quand le nouveau moteur freight est actif.

Aujourd’hui, c’est ce fallback qui peut expliquer :

- les offres qui apparaissent puis disparaissent ;
- Very Speed affiché deux fois ou contradictoirement ;
- “Service plateforme non disponible dans votre zone” en haut, puis Very Speed sélectionnable en bas.

Après correction : une seule source d’affichage au checkout pour les transitaires internationaux.

### 6. Nettoyer l’affichage Very Speed indisponible
Je propose de ne plus afficher une carte Very Speed grisée dans la liste “Choisissez un transitaire”.

À la place :

- si aucun transitaire réel ne couvre la route/ville, afficher un message clair + bouton “Demander une couverture” ;
- si Very Speed est indisponible dans la zone, cela ne doit jamais apparaître comme une option sélectionnable.

### 7. Ajouter un diagnostic admin utile
Le bloc debug admin sera amélioré pour montrer :

```text
origine utilisée: CN / TR / AE
pays destination: CD
ville destination: Kinshasa / Lubumbashi
mode: air / sea
profils retenus: uniquement ceux passés par les 3 filtres
raison d’exclusion: route, ville, mode ou tarif absent
```

Cela permettra de vérifier immédiatement pourquoi JH, Saidi, Congo Queen ou Very Speed apparaissent ou non.

## Migration SQL à fournir

Je fournirai un fichier SQL de migration, par exemple :

```text
frontend/supabase/migrations/YYYYMMDDHHMMSS_strict_forwarder_checkout_filtering.sql
```

Il contiendra principalement :

- remplacement de `public.get_eligible_forwarders_v2(...)` ;
- éventuellement remplacement de `public.get_eligible_forwarders(...)` legacy pour éviter qu’il continue à retourner des résultats incohérents s’il est encore appelé ;
- commentaires explicites documentant la règle : origine produit > origine boutique, puis destination, puis ville exacte.

## Résultat attendu

Pour ton cas de test :

- Produit origine Chine + adresse Kinshasa + aérien : seuls les transitaires Chine -> CD avec profil Kinshasa actif apparaissent.
- Produit origine Chine + adresse Lubumbashi + aérien : Congo Queen apparaît si son profil Lubumbashi est actif ; Very Speed n’apparaît pas s’il n’a pas de profil Lubumbashi.
- Produit origine Turquie + adresse Kinshasa/Lubumbashi : seuls les transitaires Turquie -> CD avec profil de la ville choisie apparaissent.
- Aucun transitaire à `USD 0.00` ne sera sélectionnable.
- Plus de double affichage “indisponible” + “sélectionnable”.
- Plus d’apparition pendant une seconde puis disparition causée par le mélange nouveau moteur / fallback legacy.

## Fichiers à modifier après validation

- `frontend/src/services/freightQuoteCheckout.ts`
- `frontend/src/components/CheckoutShippingCalculator.tsx`
- `frontend/src/components/checkout/FreightSelector.tsx`
- `frontend/src/services/forwarders.ts` si le legacy doit être durci
- nouvelle migration SQL dans `frontend/supabase/migrations/`
- idéalement un test unitaire ciblé sur le filtrage route + ville

Je recommande de traiter ça comme hotfix production : corriger d’abord le filtrage strict et supprimer le fallback contradictoire, puis ajuster l’admin ensuite si nécessaire.