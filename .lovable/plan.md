Diagnostic confirmé

Status: hotfix SQL minimal créé (`frontend/supabase/migrations/20260501093000_stores_public_min_hotfix.sql`).
Frontend déjà préparé (`fetchProductBySlug` recharge via `stores_public`).
L'ancienne migration agressive avec `DROP VIEW ... CASCADE` a été supprimée.
À FAIRE PAR L'UTILISATEUR : appliquer le SQL sur PRODUCTION puis STAGING via le SQL Editor de Supabase.com.

1. Correction de contexte d’environnement
- Tu as raison : la base utilisée par staging/production est sur Supabase.com, pas sur un sous-domaine `supabasa.*`.
- Les anciens libellés/documentations internes qui parlent de `supabasa-staging.zandofy.com` / `supabasa.zandofy.com` sont obsolètes et ne doivent plus guider les décisions.
- Je vais traiter `zandofy-production` comme staging et `zandofy-live` comme production, avec leurs URLs Supabase.com natives.

2. Cause réelle du fournisseur absent sur la fiche produit
J’ai vérifié publiquement la page production et les appels REST production.

Constats :
- Le produit de ta capture existe bien en production :
  - `fde87e9a-7c37-48d5-89b0-f1d36ae44309`
  - `ensemble-de-4-sacs-en-nylon-de-qualite`
  - `store_id = f6808c6d-bbd7-49fb-a976-882eecd1b39e`
- La requête publique directe vers `stores` retourne `[]`, ce qui est normal si la table est protégée par RLS.
- La requête publique vers `stores_public` retourne aussi `[]`, ce qui n’est pas normal pour une vue publique.
- L’embed produit vers boutique retourne `stores: null`.
- Le bundle JavaScript actuellement servi en production ne contient pas encore la logique `stores_public` ajoutée précédemment.
- Le workflow GitHub existant ne montre qu’un déploiement des Edge Functions ; il n’applique pas automatiquement les migrations SQL. Donc la phrase précédente disant que la migration SQL serait exécutée automatiquement au merge était incorrecte.

Conclusion : il y a deux blocages réels, pas un problème de cache navigateur :

```text
Produit publié
  -> store_id existe
  -> embed stores bloqué par RLS = stores null
  -> stores_public retourne 0 ligne à cause de security_invoker/RLS
  -> frontend production actuel ne recharge pas encore via stores_public
  -> VendorProfileCard n’est pas rendu
```

3. Correction urgente, minimale, sans ouvrir la table `stores`

Objectif : restaurer l’encart fournisseur sans rendre la table sensible `stores` lisible publiquement.

Je propose une correction en deux parties :

A. Migration SQL minimale et sûre
- Ne pas créer de policy publique sur `stores`.
- Ne pas exposer `owner_id`, `whatsapp_number`, emails, données internes, etc.
- Modifier uniquement la vue `public.stores_public` pour qu’elle redevienne lisible publiquement malgré les RLS strictes de `stores`.
- Éviter si possible un `DROP VIEW ... CASCADE` en urgence, car cela peut impacter des dépendances.

SQL urgent à fournir/appliquer sur production puis staging :

```sql
-- Hotfix minimal : restaurer la visibilité publique des boutiques via la vue sûre.
-- Ne rend PAS public l'accès direct à public.stores.
-- À appliquer sur Supabase.com production puis staging.

ALTER VIEW IF EXISTS public.stores_public
SET (security_invoker = false);

GRANT SELECT ON public.stores_public TO anon, authenticated;
```

Si l’instance refuse `security_invoker = false` ou si la vue n’existe pas dans un environnement, je fournirai une migration de fallback qui recrée la vue explicitement avec uniquement les colonnes publiques, mais je préfère commencer par l’ALTER minimal pour réduire le risque.

B. Correction frontend déjà ciblée mais à redéployer réellement en production
- Garder la logique qui ne dépend plus de l’embed `stores!products_store_id_fkey`.
- Sur la fiche produit, après chargement du produit, recharger systématiquement la boutique via `stores_public` avec `product.store_id`.
- Si certaines colonnes de la vue diffèrent entre staging/prod, garder le fallback de colonnes minimales pour ne pas casser la page.

4. Vérification après application

Après SQL + déploiement frontend, vérifier :

```sql
-- Doit retourner au moins une ligne
select id, name, logo_url, is_verified, is_certified
from public.stores_public
where id = 'f6808c6d-bbd7-49fb-a976-882eecd1b39e';
```

Et côté navigateur public/incognito :
- la fiche produit doit afficher l’encart fournisseur au-dessus de la galerie ;
- le bouton Contacter doit réapparaître ;
- le lien boutique doit fonctionner ;
- `/stores` doit afficher les fournisseurs ;
- la table directe `stores` doit rester protégée côté public.

5. Alerte Disk IO sur staging

L’alerte reçue concerne le projet staging `zandofy-production`, pas nécessairement la production. Mais il faut la traiter sérieusement.

Plan d’audit sans toucher à la prod :
- Identifier les requêtes les plus coûteuses sur staging via statistiques SQL.
- Vérifier les scans séquentiels sur grosses tables : `products`, `product_images`, `product_colors`, `messages`, `orders`, `analytics_events`, `notifications`.
- Vérifier si des jobs staging tournent trop souvent : sitemap, automation, campagnes, healthchecks.
- Vérifier le polling chat : le code actuel interroge les messages toutes les 1,2 s quand un chat est ouvert, ce qui peut devenir coûteux si beaucoup d’onglets/utilisateurs testent.
- Vérifier les endpoints ou fonctions qui font des `.select("*")` sur des tables volumineuses.
- Fournir ensuite un script SQL d’audit en lecture seule pour Supabase.com staging, puis seulement après analyse proposer les indexes ou réductions de polling nécessaires.

6. Nettoyage de la confusion d’environnement

Après approbation, je corrigerai aussi les références obsolètes dans les règles/docs/mémoire du projet pour ne plus raisonner avec les sous-domaines `supabasa.*`. Le modèle retenu sera :
- staging : projet Supabase.com `zandofy-production` ;
- production : projet Supabase.com `zandofy-live` ;
- pas de domaine custom Supabase pour les bases.

Ce que je vais faire après ton approbation

1. Remplacer la migration risquée existante par une migration SQL minimale `ALTER VIEW ... SET (security_invoker = false)` + `GRANT`.
2. Conserver/ajuster le frontend pour utiliser `stores_public` sur la fiche produit.
3. Fournir le fichier SQL exact à appliquer manuellement sur production et staging.
4. Ajouter une note de vérification claire avec les requêtes SQL de contrôle.
5. Corriger les références obsolètes `supabasa.*` dans la mémoire/docs concernées pour éviter que cette erreur revienne.
6. Préparer un script SQL d’audit Disk IO staging en lecture seule, séparé de la correction fournisseur, pour éviter de mélanger urgence client et diagnostic performance.