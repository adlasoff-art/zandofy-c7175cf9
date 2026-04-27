
# Filtrage des transitaires par origine produit + commandes multi-origines

## Contexte / problème

Aujourd'hui le checkout affiche **tous les transitaires actifs pour la destination + mode**, sans tenir compte du pays d'origine du produit. Quand on ouvrira Zandofy aux boutiques Turquie/Dubaï, un client commandant un produit turc verra des transitaires Chine→RDC dans la liste — incohérent et risque opérationnel majeur (le colis ne pourra pas être pris en charge).

Bonne nouvelle : la donnée existe déjà côté DB.
- `products.origin_country` (ISO2) → champ déjà éditable dans le formulaire produit (`CountryCombobox`).
- `forwarders.coverage_routes` jsonb : tableau de `{origin_country, origin_city, destination_country, destination_city}` déjà saisi par chaque transitaire à l'inscription (`BecomeForwarderPage`).
- `forwarders.supported_modes` (text[]) : air/sea/road/rail.
- `products.can_ship_air` / `can_ship_sea` : déjà utilisés dans le formulaire produit (capture d'écran).

Ce qui manque : **utiliser `coverage_routes` au moment de filtrer les transitaires éligibles**, et **segmenter les commandes par pays d'origine** (en plus de la segmentation par `store_id` déjà en place).

## Stratégie produit

### Règle 1 — Origine produit > Origine boutique
L'origine effective d'un produit est `products.origin_country` si renseigné, sinon fallback sur `stores.country` (origine boutique). Une boutique chinoise peut donc vendre un article dont l'origine est Turquie ; le transitaire affiché sera celui qui couvre TR→destination.

### Règle 2 — Filtrage transitaire au checkout
Pour chaque produit du panier, ne proposer que les transitaires dont `coverage_routes` contient au moins une route `origin_country = origine_produit` ET `destination_country = pays_client` ET dont `supported_modes` couvre le mode demandé. Si un transitaire couvre la ville exacte d'origine (origine_city), il est priorisé/marqué "express collecte directe", sinon il est listé en "collecte pays".

### Règle 3 — Panier multi-origines = sous-commandes par origine
Aujourd'hui le panier se split par `store_id` (mémoire `order-segmentation`). On ajoute une **deuxième dimension de split : `origin_country`**.

Exemple concret :
- Boutique A (Chine) vend produit X (origine CN) + produit Y (origine TR).
- Boutique B (Dubaï) vend produit Z (origine AE).
- Panier = X + Y + Z.
- Génération : **3 sous-commandes** = (A·CN), (A·TR), (B·AE). Chacune avec son propre transitaire, son propre devis, son propre lock `freight_quotes.quoted_price`.

Le client choisit donc jusqu'à N transitaires au checkout (un par groupe origine×boutique). UI : un bloc `FreightSelector` par groupe, libellé "Colis depuis 🇨🇳 Chine — Boutique A (1 article)".

### Règle 4 — Mode d'expédition par groupe
Le mode (air/sea) est aussi calculé par groupe : intersection des `can_ship_air/sea` de tous les produits du groupe. Si le groupe contient 1 article air-only et 1 article sea-only → conflit, on affiche un warning et on force le mode commun (ou on demande au client de retirer un article).

### Règle 5 — Notifications & cloisonnement
Chaque sous-commande générée alimente un `freight_quote` distinct → seul le transitaire choisi pour ce groupe reçoit la notification de prise en charge et voit la commande dans son dashboard. Aucun changement nécessaire côté notifications : le découpage actuel par `freight_quote_id` suffira automatiquement une fois le split en place.

## Implémentation technique

### Backend (1 migration SQL)

**Fichier** : `frontend/supabase/migrations/<timestamp>_forwarder_origin_filter.sql`

1. RPC `get_eligible_forwarders_v2(p_origin_country text, p_destination_country text, p_destination_city_id uuid, p_mode text)` :
   - JOIN `forwarders` × `forwarder_pricing_profiles`.
   - Filtre `coverage_routes @> '[{"origin_country":"<X>","destination_country":"<Y>"}]'::jsonb` (jsonb containment).
   - Filtre `supported_modes @> ARRAY[p_mode]`.
   - Filtre profil tarifaire actif sur destination + mode.
   - Retourne en plus : `covers_origin_city boolean` (true si le transitaire couvre aussi la ville exacte de l'origine produit/boutique).
2. Index GIN sur `forwarders.coverage_routes` pour perf : `CREATE INDEX IF NOT EXISTS idx_forwarders_coverage_routes_gin ON forwarders USING GIN (coverage_routes);`.
3. Vue `v_product_effective_origin` : `SELECT p.id, COALESCE(p.origin_country, s.country) AS effective_origin_country FROM products p LEFT JOIN stores s ON s.id = p.store_id;`. Permet de remonter l'origine effective sans dupliquer la logique en TS.

### Frontend

**1. Service `freightQuoteCheckout.ts`** :
   - Nouvelle fonction `groupCartByOriginAndStore(items)` : retourne `Array<{ store_id, origin_country, items, mode_intersection: ('air'|'sea')[] }>`.
   - `fetchEligibleFreightOffers` accepte un `originCountry` et le passe à la nouvelle RPC.
   - `lockFreightQuote` est appelé une fois par groupe.

**2. `CheckoutPage.tsx`** :
   - Remplace le bloc `FreightSelector` unique par une boucle sur les groupes.
   - Pour chaque groupe : badge "Origine 🇨🇳 / Boutique X / Mode ✈️", liste des transitaires éligibles, bouton de validation indépendant.
   - Empêche `Confirmer la commande` tant qu'un transitaire n'est pas choisi pour chaque groupe.

**3. `freightQuoteCheckout.ts → orders insert`** :
   - L'insertion des `orders` se fait déjà par `store_id` ; on ajoute la dimension `origin_country` pour générer une `order` par couple (store, origin). Champ `orders.origin_country` à ajouter (migration).

**4. `VendorProductManager.tsx`** :
   - Aucune nouvelle UI, mais ajouter un texte d'aide sous "Origine du pays" : *"Détermine quel transitaire prendra en charge ce produit. Laissez vide pour utiliser l'origine de la boutique."*
   - Validation à la sauvegarde : si la boutique vend des produits multi-origines, on n'impose rien — c'est volontaire.

**5. `BecomeForwarderPage.tsx`** :
   - Aucun changement structurel : le formulaire collecte déjà les `coverage_routes` correctement. On vérifie juste que le standard `GeoFieldsRow` est utilisé (déjà conforme).

### Cas limites gérés

- **Aucun transitaire ne couvre une route** (ex : nouveau pays d'origine sans transitaire enregistré) → on affiche un encart "Aucun transitaire ne dessert encore 🇹🇷 Turquie → 🇨🇩 RDC" + bouton **Demander la couverture** (réutilise l'EF `request-delivery-coverage` ou crée un équivalent `request-forwarder-coverage`).
- **Conflit air/sea dans un groupe** : warning bloquant, suggestion de scinder la commande.
- **Origine produit non renseignée ET boutique sans country** : fallback sur `headquarters_country` du forwarder ou warning admin.
- **Devis multiples = paiement** : le total `shipping_cost` à régler au checkout = somme des `quoted_price` lockés des N freight_quotes.

## Étapes de livraison

1. **Lot A — DB & RPC** : migration `get_eligible_forwarders_v2` + index GIN + vue origine effective + ajout colonne `orders.origin_country`.
2. **Lot B — Service de groupage** : `groupCartByOriginAndStore` + tests unitaires (panier mono-origine, multi-origine, conflit modes).
3. **Lot C — Checkout UI** : multi-`FreightSelector`, validation par groupe, total agrégé.
4. **Lot D — UX vide** : encart "aucune couverture" + bouton demande de couverture transitaire.
5. **Lot E — QA** : test E2E (panier 3 articles 2 origines 2 boutiques → 3 commandes générées avec 3 transitaires).

## Hors scope (à confirmer en validation)

- Pas de changement du modèle de pricing (markup 45 % + commission 10 %) ni du moteur last-mile (opérateurs livraison reste indépendant).
- Pas de modification des règles d'opérateur de livraison (déjà filtré par ville client, ok).
- Pas d'unification des paiements en une seule transaction si ça doit rester N transactions (à confirmer — par défaut on garde le comportement actuel : 1 paiement par order).
