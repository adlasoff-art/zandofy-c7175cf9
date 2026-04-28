## Diagnostic des 4 problèmes signalés + 1 amélioration UX vendeur

### 1. Poids total ×10 (coque iPhone : 10 pcs = 10 kg) → **Bug vendeur, PAS un bug code**

Le code calcule correctement : `(products.weight_grams × quantity) / 1000` (`freightQuoteCheckout.ts` ligne 491). Donc si l'affichage indique 10 kg pour 10 pcs, c'est que le vendeur a saisi `weight_grams = 1000` (croyant entrer "1 kg") au lieu de `weight_grams ≈ 100` (la coque pèse ~100 g).

**Actions** :

- (a) Vérifier en prod : `SELECT id, name, weight_grams FROM products WHERE name ILIKE '%coque%paille%';`
- (b) **Garde-fou côté formulaire vendeur** : warning si `weight_grams ≥ 1000` ("Êtes-vous sûr ? Vous avez saisi ≥ 1 kg pour cet article. Le champ attend des grammes.").
- (c) Libellé champ rendu plus explicite : `Poids unitaire (en grammes — ex : 100 g = 0,1 kg)`.

### 2. Very speed apparaît avec **prix = 0** côté checkout

Comportement "carte grisée plateforme" codé dans `freightQuoteCheckout.ts` lignes 245-287 : quand aucun profil tarifaire n'existe pour la destination/mode, la carte plateforme est injectée avec `quote.total = 0` et `has_profile_for_zone = false`. Mais l'UI affiche quand même `$0.00`, ce qui est trompeur.

**Cause racine** : Very speed n'a pas de `forwarder_pricing_profile` pour `country_code='CD'` + `mode='air'` (et probablement pas non plus pour `sea`).

**Actions** :

- Vérifier en prod : `SELECT * FROM forwarder_pricing_profiles WHERE forwarder_id = '<verispeed_id>';`
- Si vide → créer en admin (`/admin/forwarders` → Verispeed → ajouter profils CD/air et CD/sea).
- **Code fix UX** : dans `FreightSelector.tsx`, masquer le `$0.00` quand `has_profile_for_zone === false` ; afficher `unavailable_message` à la place ("Service plateforme non disponible dans votre zone" ou "Tarifs en cours de configuration").

### 3. Un seul transitaire affiché alors que 7 existent en base

Logique d'éligibilité (RPC `get_eligible_forwarders` + `get_eligible_forwarders_v2`) — un transitaire apparaît seulement si **TOUS** ces critères sont remplis :

- `forwarders.is_active = true` et `status IN ('approved','active')`
- Possède un `forwarder_pricing_profile` actif avec `country_code = 'CD'`, `mode = 'air'`, et `city_id IS NULL` ou `= <id Kinshasa>`
- `coverage_routes` JSONB contient la route `CN → CD` (origine Chine vers RDC)
- `supported_modes` inclut `air` (ou est `NULL`)

**Cause racine probable** : les 6 autres transitaires n'ont pas configuré leurs profils tarifaires pour CD/air, OU leur `coverage_routes` ne contient pas `CN→CD`.

**Requêtes de diagnostic à exécuter en prod (Supabase Studio)** :

```sql
-- 1) Tous les transitaires actifs et leur statut
SELECT id, name, is_active, is_platform_owned, status, supported_modes,
       jsonb_array_length(COALESCE(coverage_routes,'[]'::jsonb)) AS routes_count
FROM forwarders ORDER BY name;

-- 2) Profils tarifaires pour Kinshasa / RDC / air
SELECT fpp.forwarder_id, f.name, fpp.country_code, fpp.city_id, fpp.mode,
       fpp.service_class, fpp.is_active
FROM forwarder_pricing_profiles fpp
JOIN forwarders f ON f.id = fpp.forwarder_id
WHERE fpp.country_code = 'CD' AND fpp.mode = 'air'
ORDER BY f.name;

-- 3) Test direct du RPC v2 (CN → CD air, sans cityId)
SELECT * FROM get_eligible_forwarders_v2('CN','CD',NULL,'air');

-- 4) Test direct du RPC v1 (legacy, utilisé par ForwarderSelector)
SELECT * FROM get_eligible_forwarders('CD', NULL, 'air');

-- 5) Coverage routes contenant CN→CD
SELECT id, name, coverage_routes
FROM forwarders
WHERE coverage_routes::text ILIKE '%"CN"%' AND coverage_routes::text ILIKE '%"CD"%';
```

Selon les résultats : compléter les profils tarifaires manquants et/ou les `coverage_routes` via l'admin.

### 4. "Option de livraison" (last-mile) ne s'affiche plus à Kinshasa

Indépendant des transitaires : c'est le système multi-operator (Lot 11B). À diagnostiquer :

```sql
-- Opérateurs livraison actifs couvrant Kinshasa
SELECT do_.id, do_.name, do_.is_active, doc.city_id, c.name AS city_name
FROM delivery_operators do_
LEFT JOIN delivery_operator_coverage doc ON doc.operator_id = do_.id
LEFT JOIN cities c ON c.id = doc.city_id
WHERE do_.is_active = true ORDER BY do_.name;

-- Tarifs Kinshasa
SELECT * FROM delivery_operator_rates
WHERE city_id = (SELECT id FROM cities WHERE name ILIKE 'Kinshasa' LIMIT 1);
```

Si vide → données manquantes (aucun opérateur n'a configuré ses tarifs Kinshasa). Pas un bug code.

### 5. **NOUVEAU — Persistance du "Coût d'achat réel" dans la Tarification intelligente**

Aujourd'hui, dans `PricingCalculator.tsx`, quand un vendeur rouvre un produit existant, **les deux champs** "Coût d'achat réel" et "Coût d'achat calcul" sont vides (rien n'est persisté en base). Le vendeur perd la référence pour estimer une marge ou accorder une remise à un client.

**Comportement souhaité** :

- **Coût d'achat réel** → **persisté en base** et **réaffiché** à chaque réouverture du produit (lecture seule par défaut, modifiable si le vendeur veut le mettre à jour).
- **Coût d'achat calcul** → reste éphémère / vide à la réouverture (comportement actuel conservé, c'est juste une base de calcul ponctuelle pour générer un nouveau prix).

**Détails techniques** :

1. **Migration DB** : ajouter `cost_real numeric(12,2) NULL` à la table `products` (nullable, pas de défaut, pas de contrainte).
2. **RLS** : la colonne hérite des policies existantes de `products`. Vérifier qu'elle n'apparaît **pas** dans les vues publiques (`v_products_public` ou équivalent) pour ne pas exposer le coût d'achat aux clients.
3. **Frontend** :
  - `PricingCalculator.tsx` : recevoir `costReal` initial depuis le produit chargé ; afficher le montant existant à la réouverture.
  - Page produit vendeur (formulaire create/edit) : charger `cost_real` depuis le produit, l'envoyer dans l'UPDATE.
  - Petit indicateur visuel "Mémorisé" à côté du champ pour rassurer le vendeur.
4. **Sécurité** : `cost_real` ne doit JAMAIS être renvoyé au client final (vérifier les `select` dans services/products côté boutique publique).

---

## Détails techniques (récap)

### Fichiers concernés

- `frontend/src/services/freightQuoteCheckout.ts` (calcul poids + injection carte grisée)
- `frontend/src/components/checkout/FreightSelector.tsx` (affichage carte grisée à corriger)
- `frontend/src/components/vendor/PricingCalculator.tsx` (persistance cost_real)
- Formulaire produit vendeur (à localiser : `frontend/src/pages/vendor/...ProductForm*`)
- RPC Postgres `get_eligible_forwarders` / `get_eligible_forwarders_v2` (déjà inspectées, OK)

### Actions de code à implémenter (après confirmation données prod)

1. **Migration** : `ALTER TABLE products ADD COLUMN cost_real numeric(12,2);` + audit des vues publiques pour exclure cette colonne.
2. `**PricingCalculator.tsx**` : initialiser `costReal` depuis prop produit, persister en update.
3. `**FreightSelector.tsx**` : remplacer `$0.00` par `unavailable_message` quand `has_profile_for_zone === false`.
4. **Formulaire produit vendeur** : warning sur `weight_grams ≥ 1000` + libellé champ enrichi + binding `cost_real`.

### Pas concerné par ce plan

- RPC SQL : déjà correctes, aucune migration de fonction nécessaire.
- Données transitaires/opérateurs Kinshasa : configuration admin à compléter manuellement après diagnostic.

---

## Prochaine étape

Approuve ce plan pour que je :

1. Te fournisse les requêtes SQL à exécuter en prod (sections 1, 2, 3, 4) — colle-moi les résultats.
2. Implémente les fixes code (sections 1c, 2 UX, 5 persistance cost_real) avec migration DB minimale et sans toucher aux RPC existantes.