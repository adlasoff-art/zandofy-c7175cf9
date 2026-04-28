Tu as raison : le problème n’est pas seulement “un filtre SQL”. J’ai revu la chaîne checkout/transitaire de bout en bout. Le nœud est une combinaison de 3 choses, dont une critique en production.

## Diagnostic ferme

### 1. La migration stricte précédente est au mauvais endroit pour la prod
La correction SQL stricte existe ici :

```text
supabase/migrations/20260428190655_6509aa80-ad58-4788-9f31-aca9f0ccc5c4.sql
```

Mais dans ce projet, la source de vérité DB documentée est :

```text
frontend/supabase/migrations/
```

Donc si votre pipeline prod ne prend que `frontend/supabase/migrations/`, la prod continue probablement avec l’ancien comportement :

- fallback `city_id IS NULL`
- carte plateforme/Very Speed possible même sans vraie couverture
- RPC legacy permissive
- écart entre preview et production

C’est un point bloquant : la correction SQL doit être portée dans `frontend/supabase/migrations/`.

### 2. Le checkout affiche encore un “fret standard” même quand aucun transitaire n’est éligible
Dans `CheckoutShippingCalculator.tsx`, le moteur calcule toujours un prix indicatif via `calculateDynamicQuote()` :

```text
Chongqing (CN) → Kinshasa (CD) · tarif indicatif
```

Puis `FreightSelector` peut retourner 0 offre, mais l’UI affiche quand même :

```text
Aucun transitaire ne dessert encore Kinshasa...
Le tarif standard ci-dessus sera appliqué et un transitaire sera assigné après commande.
```

C’est exactement ce qu’on voit sur ta capture :

```text
DEBUG ADMIN — 0 offre retournée
mais Aérien $10.64 affiché
et checkout continue avec un tarif standard
```

Donc le bug métier principal est là : le prix indicatif est traité comme une option expédiable alors qu’il ne prouve aucune couverture transitaire.

### 3. La logique de disponibilité est incohérente entre mono-colis et multi-colis
Dans `CheckoutPage.tsx` :

- si `freightOffersAvailable > 0`, le client doit choisir un transitaire ;
- si `freightOffersAvailable === 0`, le checkout laisse passer avec le tarif standard.

Pour une marketplace en production, ce comportement est dangereux : si aucun transitaire ne couvre `origine produit -> destination client -> ville`, la commande ne devrait pas continuer comme si elle était livrable.

## Solution production à appliquer

### A. Corriger la source de vérité SQL prod
Créer une migration dans :

```text
frontend/supabase/migrations/YYYYMMDDHHMMSS_checkout_forwarders_strict_prod.sql
```

Elle doit contenir la correction stricte déjà préparée, avec ces règles :

1. `get_eligible_forwarders_v2(origin, destination, city_id, mode)` retourne uniquement les transitaires qui ont :
   - route explicite `coverage_routes.origin_country -> destination_country`
   - mode dans `supported_modes`
   - profil actif dans `forwarder_pricing_profiles`
   - `city_id = destination_city_id` exact
2. supprimer le fallback `city_id IS NULL` au checkout.
3. supprimer l’exception plateforme/Very Speed.
4. remettre aussi `get_eligible_forwarders` legacy en mode strict, ou mieux ne plus l’utiliser au checkout.

### B. Changer le comportement checkout : pas de transitaire = pas de commande internationale
Dans `FreightSelector.tsx`, remplacer le message actuel :

```text
Le tarif standard ci-dessus sera appliqué et un transitaire sera assigné après commande.
```

par un message bloquant :

```text
Aucun transitaire ne couvre actuellement cette route pour cette ville. Vous pouvez demander l’ouverture de couverture ou choisir une autre adresse/mode.
```

Le bouton “Demander couverture” reste utile, mais il ne doit pas permettre de commander immédiatement.

### C. Bloquer la soumission quand aucune offre transitaire n’existe
Dans `CheckoutPage.tsx`, ajouter un état explicite remonté par le calculateur :

```ts
freightStatus = "checking" | "available" | "unavailable"
```

Règle :

```text
Si panier international + freightStatus === unavailable : bloquer Continuer / Commander.
```

Ne plus laisser passer le cas `freightOffersAvailable === 0` comme fallback automatique.

### D. Rendre `freightQuoteCheckout.ts` fermé par défaut
Dans `fetchEligibleFreightOffers()` :

- interroger uniquement les profils ville exacte : `city_id = destinationCityId`
- ne plus démarrer avec `city_id IS NULL OR city_id = ...`
- utiliser `get_eligible_forwarders_v2` comme filtre d’autorité
- si le RPC strict est absent/erreur en production : retourner `[]`, pas un fallback permissif
- garder le filtre anti-0 USD

### E. Corriger la résolution de ville
Actuellement `CheckoutShippingCalculator` fait :

```ts
searchCities(shippingCity, 1)
```

C’est trop fragile en prod, car ça cherche par nom seulement. Il faut résoudre la ville avec :

```text
country_code = shipping.country
name = shipping.city
province si disponible
```

À court terme : résolution stricte pays + ville.
À moyen terme : ajouter `city_id`, `commune_id`, `quartier_id` dans `saved_addresses` pour ne plus dépendre du texte.

## Résultat attendu après correction

Pour le cas de ta capture :

```text
Client : Kinshasa
Origine produit : CN
Mode : air
Offres transitaire : 0
```

Le checkout devra afficher :

```text
Aucun transitaire ne couvre CN -> CD / Kinshasa en aérien.
Demander couverture
```

Et il ne devra plus :

- afficher “tarif standard appliqué” comme solution réelle ;
- afficher Very Speed à 0,00 $ ;
- permettre de continuer la commande internationale sans transitaire ;
- dépendre d’une migration placée hors du dossier prod.

## Ce que je vais modifier si tu valides

1. Créer la migration SQL dans `frontend/supabase/migrations/`.
2. Durcir `frontend/src/services/freightQuoteCheckout.ts`.
3. Modifier `frontend/src/components/checkout/FreightSelector.tsx` pour rendre l’état “aucune couverture” bloquant et non ambigu.
4. Modifier `frontend/src/components/CheckoutShippingCalculator.tsx` pour remonter un vrai statut de disponibilité.
5. Modifier `frontend/src/pages/CheckoutPage.tsx` pour bloquer la progression si aucun transitaire n’est disponible.
6. Nettoyer l’ancien import/état legacy `ForwarderSelector` s’il n’est plus utilisé.

C’est une correction de production : elle ferme le checkout sur les routes non couvertes au lieu de créer des commandes impossibles à exécuter.