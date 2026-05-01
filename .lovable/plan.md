Diagnostic confirmé : ce n’est pas un problème de cache ni de délai Vercel.

Ce que j’ai vérifié côté production :
- Le domaine `zandofy.com` sert bien le nouveau bundle frontend qui contient le fallback `stores_public`.
- L’API publique de production retourne bien des produits publiés avec `store_id`.
- Mais pour ce même `store_id`, `stores_public` retourne `[]`, et l’embed `products -> stores` retourne `stores: null`.

Cause réelle : la vue `stores_public` a été créée avec `security_invoker=on`. Comme la table privée `stores` est maintenant protégée par RLS et lisible seulement par owner/staff/admin, la vue publique hérite de ce blocage. Résultat : les clients anonymes/connectés non-staff voient zéro boutique/fournisseur, même si la vue existe et même si le frontend est bien déployé.

Plan de correction en une seule itération :

1. Ajouter une migration SQL de hotfix dans `frontend/supabase/migrations/`
   - Recréer `public.stores_public` comme vue publique filtrée/sanitisée, sans `security_invoker=on`, pour qu’elle expose uniquement les colonnes publiques nécessaires.
   - Conserver la table `public.stores` protégée par RLS : pas de retour à une lecture directe publique de `stores`, donc pas d’exposition de `whatsapp_number`, `owner_id`, raisons de bannissement, données internes, etc.
   - Redonner explicitement `SELECT` sur la vue à `anon` et `authenticated`.

   Migration proposée :

   ```sql
   -- Hotfix: restore public supplier/store visibility without exposing private store columns
   -- Root cause: stores_public used security_invoker=on, so anon/authenticated users inherited
   -- the restrictive RLS from public.stores and received zero rows.

   DROP VIEW IF EXISTS public.stores_public;

   CREATE VIEW public.stores_public AS
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
     flash_timer_enabled,
     flash_timer_duration_hours,
     chat_media_enabled,
     chat_links_allowed,
     chat_phone_allowed,
     meta_title,
     meta_description,
     seo_keywords,
     default_transit_days_min,
     default_transit_days_max,
     returns_enabled,
     created_at
   FROM public.stores;

   GRANT SELECT ON public.stores_public TO anon, authenticated;
   ```

2. Ajuster le frontend pour éviter de dépendre d’un embed RLS fragile
   - Dans `frontend/src/services/api.ts`, ne pas faire dépendre l’affichage fournisseur de `stores!products_store_id_fkey`.
   - Charger la boutique publique via `stores_public` dès qu’on a `product.store_id`.
   - Garder le fallback existant minimal si une colonne diffère entre staging/prod.
   - Ajouter un log d’erreur non bloquant uniquement si `stores_public` échoue vraiment, pour éviter que le problème soit silencieux à l’avenir.

3. Sécurité à préserver
   - Ne pas réouvrir `public.stores` en lecture publique.
   - Ne pas exposer `whatsapp_number` dans `stores_public`.
   - Le bouton WhatsApp continue de passer par la fonction sécurisée existante `get-store-whatsapp`, uniquement pour les utilisateurs autorisés/connectés.

4. Vérifications après application
   - Tester en navigation privée : `/stores` doit afficher les fournisseurs.
   - Tester une fiche produit : l’encart fournisseur doit apparaître avec logo, nom, badges et bouton de contact.
   - Vérifier via API publique que :
     - `stores_public?select=id,name&limit=1` retourne au moins une ligne.
     - `stores?select=id,name&limit=1` reste vide pour anon si l’utilisateur n’est pas staff/owner/admin.
   - Confirmer que `whatsapp_number` n’est pas sélectionnable depuis `stores_public`.

Impact attendu : correction ciblée sur la visibilité publique des fournisseurs/boutiques, sans changement de tarifs, sans changement checkout, sans modification infrastructure, et sans exposition des données sensibles.