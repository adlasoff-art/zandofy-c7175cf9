Constat après lecture du code

Le blocage ne vient plus du poids/CBM. Le message `DEBUG ADMIN — 0 offre retournée` indique que l’offre est rejetée avant le calcul du prix, pendant le filtrage d’éligibilité.

Aujourd’hui le checkout exige simultanément :

```text
profil actif: country_code = CD
mode = air
city_id = 19ca38ca-93a9-4c54-b7ae-1d1fa98e7fcb
transitaire actif + approved
route JSON coverage_routes: origin_country CN -> destination_country CD
supported_modes contient air
puis prix > 0
```

Le point fragile restant est le matching strict des routes JSON et du `city_id` exact. Si la route existe mais sous une forme légèrement différente, ou si le profil tarifaire est pays-large (`city_id IS NULL`) / une ville équivalente, le checkout renvoie 0 au lieu d’utiliser le transitaire plateforme.

Plan de correction

1. Remplacer le filtrage checkout par une version robuste
   - Dans `fetchEligibleFreightOffers`, ne plus faire disparaître un transitaire dès qu’un filtre strict échoue sans diagnostic.
   - Normaliser `country_code`, `origin_country`, `destination_country`, `mode` en majuscules/minuscules côté comparaison.
   - Accepter en priorité le profil ville exacte Kinshasa.
   - Si aucun profil ville exacte n’existe, autoriser un profil pays-large `city_id IS NULL` pour le même pays/mode, afin d’éviter de bloquer toute commande alors qu’un transitaire CD/air existe.
   - Conserver la route CN→CD obligatoire quand `originCountry` est connu, mais rendre la comparaison tolérante aux formats JSON et à la casse.

2. Mettre à jour le RPC SQL `get_eligible_forwarders_v2`
   - Version SQL de même logique :
     - transitaire actif et `status IN ('approved','active')`
     - mode supporté
     - route CN→CD présente
     - profil actif CD/air
     - préférence `city_id = Kinshasa`, sinon fallback `city_id IS NULL`
   - Ajouter un tri pour choisir le profil le plus spécifique d’abord :

```text
city_id exact > city_id NULL
```

3. Ajouter un RPC de diagnostic admin, sans modifier les données
   - Créer `debug_forwarder_checkout_eligibility(...)` qui retourne, pour chaque transitaire/profil candidat :
     - `has_route`
     - `supports_mode`
     - `has_exact_city_profile`
     - `has_country_profile`
     - `has_kg_tier`
     - `has_cbm_tier`
     - `would_be_eligible`
     - `reason_if_rejected`
   - Le but est d’arrêter les suppositions : en prod, une seule requête dira exactement quelle condition rejette VERY SPEED.

4. Corriger l’UI debug admin
   - Dans `FreightSelector`, afficher le détail reçu du diagnostic au lieu du message générique “SQL strict”.
   - Exemple attendu :

```text
VERY SPEED: route OK, mode OK, profil Kinshasa manquant, profil pays CD présent, tarif KG OK -> fallback pays utilisé
```

ou :

```text
VERY SPEED: route manquante CN->CD
```

5. Fournir le SQL directement dans le chat après implémentation
   - Comme le téléchargement ne marche pas chez vous, je fournirai le bloc SQL complet directement dans le message final, prêt à copier-coller en production.
   - Il inclura uniquement les fonctions/RPC nécessaires, pas de modification destructive de données.

6. Corriger aussi l’erreur preview `No QueryClient set`
   - L’erreur visible en preview vient de `Index.tsx` qui appelle `useQueryClient` alors que la page peut être rendue hors provider dans certains cas Lovable.
   - Je déplacerai cette logique dans une zone sûre ou supprimerai cet appel si non indispensable, pour que la preview ne masque plus les tests checkout.

Résultat attendu

- Pour `origin_country=CN`, `country_code=CD`, `city_id=Kinshasa`, `mode=air`, `0.54 kg`, le transitaire plateforme doit apparaître si au moins :
  - il est actif/approuvé,
  - il supporte `air`,
  - il a une route CN→CD,
  - il a un profil tarifaire actif CD/air exact Kinshasa ou pays-large,
  - il a un palier KG/CBM applicable.
- Si une condition manque réellement, le debug admin affichera précisément laquelle, au lieu de “0 offre” générique.