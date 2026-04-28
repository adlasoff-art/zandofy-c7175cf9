## Diagnostic — pourquoi ça reste bloqué malgré CN/Guangdong/Shenzhen

Après le refactor d'hier, `VendorDashboardPage.handleSave` écrit dans `stores` :
- `country_code = "CN"` ✅ (nouveau, structuré)
- `country = "Chine"` (nom complet, pour l'affichage / étiquettes)
- `city_id = <uuid Shenzhen>` ✅
- `city = "Shenzhen"`

**Mais** `freightQuoteCheckout.ts` (ligne 462) résout encore l'origine du produit ainsi :
```ts
const originISO = (p.origin_country ?? p.store?.country ?? "").toUpperCase()
```

Donc si `products.origin_country` est NULL, il prend `stores.country` = `"CHINE"` et l'envoie au RPC `get_eligible_forwarders_v2` comme `p_origin_country`. Le RPC compare alors `"CHINE"` à `coverage_routes.origin_country` (qui contient `"CN"`) → **0 transitaire éligible** → message "Aucun transitaire ne dessert Kinshasa".

C'est exactement ce que tu vois : la boutique est bien configurée, le code ISO est bien enregistré dans `country_code`, mais le checkout lit la mauvaise colonne.

## Correction (3 fichiers, aucune migration SQL)

### 1. `frontend/src/services/freightQuoteCheckout.ts`
- Sélectionner aussi `stores.country_code` dans la query produits :
  ```
  store:stores(id, name, country, country_code)
  ```
- Étendre le type `Row.store` pour inclure `country_code`.
- Changer la résolution de l'origine pour privilégier l'ISO :
  ```ts
  const originISO = (
    p.origin_country
    ?? p.store?.country_code        // ← nouveau, priorité ISO
    ?? p.store?.country              // fallback texte (legacy)
    ?? ""
  ).toUpperCase().trim();
  ```
- Garde-fou : si `originISO.length !== 2`, on log un warning et on met `"UNKNOWN"` (évite d'envoyer "CHINE" au RPC).

### 2. `frontend/src/services/forwarders.ts` (legacy)
- Idem : si du code appelle encore `fetchEligibleForwarders` avec `params.country` non-ISO, normaliser en amont. Vérifier les appels et corriger le résolveur d'origine au même endroit.

### 3. Backfill ponctuel des produits existants (facultatif mais recommandé)
- Pour les produits dont `origin_country` est NULL alors que leur boutique a maintenant `country_code` rempli, propager :
  ```sql
  UPDATE public.products p
     SET origin_country = s.country_code
    FROM public.stores s
   WHERE p.store_id = s.id
     AND p.origin_country IS NULL
     AND s.country_code IS NOT NULL;
  ```
- Fourni en fichier téléchargeable `/mnt/documents/products_origin_backfill.sql` + déposé dans `frontend/supabase/migrations/`.

## Vérification après déploiement

1. Recharger la page checkout du produit chinois → `FreightSelector` doit appeler le RPC avec `p_origin_country: "CN"` (visible dans Network).
2. Si un transitaire a `coverage_routes` contenant `{origin_country:"CN", destination_country:"CD"}` + un `forwarder_pricing_profiles` actif sur `city_id` Kinshasa en mode `air` → il s'affiche.
3. Si toujours bloqué après ça, le problème devient un manque de couverture transitaire réel (et non plus un bug de matching) → on te montrera quels transitaires sont configurés et tu pourras compléter leurs routes / profils tarifaires Kinshasa.

## Hors scope

- Pas de nouvelle migration de schéma (la précédente a déjà ajouté les colonnes).
- Pas de changement UI du dashboard vendeur (déjà conforme).
- Pas de changement du RPC `get_eligible_forwarders_v2` (déjà strict et correct).
