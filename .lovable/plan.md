Diagnostic

Le problème n’est très probablement pas un simple cache client.

Ce que j’ai confirmé dans le code :

1. La fiche produit affiche l’encart fournisseur uniquement si `product.store` existe :

```tsx
{(product as any).store && (
  <VendorProfileCard ... />
)}
```

2. `product.store` est alimenté par `fetchProductBySlug()` dans `frontend/src/services/api.ts` via un embed direct de la table `stores` :

```ts
products
  .select(`..., stores!products_store_id_fkey(...)`)
```

3. Une migration de hardening sécurité a ensuite changé l’accès à `stores` :
- suppression des policies publiques directes sur `stores`
- création de la vue publique `stores_public`
- accès complet à `stores` réservé au propriétaire/collaborateur/staff

Migration concernée :
`supabase/migrations/20260424012442_4f6dd65d-55e7-4692-87b9-9689054e3c87.sql`

4. Conséquence : sur une vraie session client qui n’est pas propriétaire/collaborateur/admin de la boutique, l’embed `stores!products_store_id_fkey(...)` peut revenir vide/null selon les policies en prod. Donc la fiche produit charge bien le produit, mais n’a plus `product.store`, et l’encart fournisseur n’est pas rendu.

5. Cela explique pourquoi toi tu pouvais encore voir l’encart dans ton navigateur habituel :
- soit ancienne version JS/React Query/service worker encore en cache,
- soit session/admin/staff avec droits différents,
- soit données déjà en mémoire.
Mais les nouveaux navigateurs / profils / clients voient l’état réel actuel.

6. La page `/stores` utilise déjà `stores_public`, donc elle peut fonctionner même quand la fiche produit est cassée. Le bug est donc surtout dans la fiche produit : elle continue à dépendre de `stores` au lieu de la vue publique prévue.

Solution unique à appliquer

Objectif : remettre l’encart fournisseur exactement au bon endroit, sans réouvrir publiquement toute la table `stores` et sans exposer `whatsapp_number`.

1. Modifier `frontend/src/services/api.ts`

Dans `fetchProductBySlug()`, remplacer l’embed direct `stores!products_store_id_fkey(...)` par une logique robuste :

- charger d’abord le produit avec ses données publiques produit/catégorie/images/variantes, sans dépendre de l’embed `stores` ;
- ensuite charger la boutique publique associée via `stores_public`, en utilisant `data.store_id` ;
- assigner ce résultat à `product.store`.

Pseudo-structure :

```ts
const product = mapProduct(data);

const { data: publicStore } = await supabase
  .from("stores_public" as any)
  .select("id, name, slug, logo_url, is_verified, is_certified, verified_years, verified_years_override, created_at, followers_count, followers_override, products_count, repurchase_rate, sales_count, sales_override, sales_trend, is_online, rating, response_rate, response_time")
  .eq("id", data.store_id)
  .maybeSingle();

product.store = publicStore ?? data.stores ?? null;
```

Points importants :
- garder un fallback `data.stores` au cas où l’environnement preview/staging n’est pas exactement au même niveau ;
- ne pas sélectionner `whatsapp_number` côté public ;
- continuer à utiliser `openStoreWhatsApp(store.id, ...)`, qui récupère le numéro côté backend sécurisé au clic.

2. Modifier `PRODUCT_SELECT` / `PRODUCT_LIST_SELECT` uniquement si nécessaire

Pour éviter de casser d’autres listes, je ne vais pas réécrire tout le service produit.
La correction prioritaire sera ciblée sur `fetchProductBySlug()` parce que c’est elle qui contrôle l’encart fournisseur de la fiche produit.

Si je constate que `mapProduct()` dépend trop de `row.stores`, je ferai seulement un ajustement minimal :
- permettre à `mapProduct()` d’utiliser `row.stores_public` ou `row.publicStore` si présent ;
- garder la compatibilité avec `row.stores` pour toutes les listes existantes.

3. Rendre l’UI plus résistante

Dans `ProductPage.tsx`, ne pas afficher silencieusement rien si le produit a un `store_id` mais que la boutique publique n’a pas encore chargé.

Option propre : `fetchProductBySlug()` doit déjà retourner `product.store`, donc `ProductPage` n’a normalement pas besoin d’une deuxième requête.
Mais j’ajouterai une sécurité minimale si nécessaire :
- si `product.storeId` existe mais `product.store` est absent, afficher une petite zone skeleton/fallback plutôt que supprimer toute la barre ;
- l’objectif reste que l’encart revienne comme dans ta capture : logo, nom, origine, statut, badges, stats, bouton Contacter, bouton WhatsApp.

4. Corriger/renforcer la page fournisseurs si l’état vide vient du même sujet

La page `/stores` utilise déjà `stores_public`. Je vérifierai que la vue contient bien les colonnes utilisées :
- `slug`
- `logo_url`
- `banner_url`
- `description`
- `is_verified`
- `verified_years`
- `followers_count`
- `products_count`
- `sales_count`
- `rating`
- `is_online`
- `last_seen_at`
- `created_at`
- overrides

Si une colonne utilisée côté front manque dans certaines bases, je fournirai aussi une migration SQL idempotente pour recréer `stores_public` avec toutes les colonnes publiques attendues.

5. Migration SQL à prévoir pour prod si nécessaire

Si la prod n’a pas la bonne vue publique, fournir/appliquer une migration du type :

```sql
DROP VIEW IF EXISTS public.stores_public CASCADE;

CREATE VIEW public.stores_public
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  slug,
  logo_url,
  banner_url,
  description,
  country,
  city,
  address,
  is_verified,
  is_certified,
  verified_years,
  verified_years_override,
  is_online,
  last_seen_at,
  presence_visible,
  sales_count,
  sales_override,
  followers_count,
  followers_override,
  products_count,
  repurchase_rate,
  sales_trend,
  rating,
  response_rate,
  response_time,
  review_count_override,
  shop_type,
  fulfillment_type,
  is_platform_owned,
  is_banned,
  is_suspended,
  suspended_activities,
  default_transit_days_min,
  default_transit_days_max,
  returns_enabled,
  created_at
FROM public.stores;

GRANT SELECT ON public.stores_public TO anon, authenticated;
```

Important : cette vue ne doit pas inclure `whatsapp_number`, ni `owner_id`, ni données sensibles.

6. Tests / vérification

Je vérifierai :

- fiche produit en mode non-admin/non-propriétaire : l’encart fournisseur apparaît ;
- bouton `Contacter` ouvre le chat interne ;
- bouton `WhatsApp` reste sécurisé et appelle `openStoreWhatsApp()` ;
- page `/stores` affiche les fournisseurs ;
- pas de réouverture publique directe de `stores` ;
- pas de régression sur les listes produits.

Ce que je ne recommande pas

- Ne pas remettre une policy `Anon read stores USING (true)` sur toute la table `stores`. Cela ferait revenir l’affichage, mais réouvrirait des colonnes sensibles comme le numéro WhatsApp ou autres données internes.
- Ne pas compter uniquement sur le bouton de purge cache. Le cache peut expliquer pourquoi toi tu vois encore l’ancien état, mais il ne réparera pas la dépendance actuelle du front à la table `stores` directe.

Conclusion

La correction propre est :

- la fiche produit doit lire les infos fournisseur publiques depuis `stores_public`,
- la table `stores` reste protégée,
- WhatsApp reste récupéré à la demande via la fonction sécurisée,
- l’encart fournisseur revient pour tous les clients, connectés ou non, sans exposer de données sensibles.