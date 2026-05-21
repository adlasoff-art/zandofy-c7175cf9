-- Hotfix MINIMAL : restaurer la visibilité publique de la vue
-- public.stores_public sans toucher à la table sensible public.stores.
--
-- Contexte (vérifié publiquement le 2026-05-01) :
--   - Le produit `fde87e9a-7c37-48d5-89b0-f1d36ae44309` retourne `stores: null`
--     via l'embed PostgREST.
--   - La table public.stores est protégée par RLS (anon/authenticated → 0 ligne).
--   - La vue public.stores_public renvoie également 0 ligne, parce qu'elle a été
--     créée avec WITH (security_invoker=on) et hérite donc des RLS de stores
--     pour les visiteurs anon/authenticated.
--
-- Correction : désactiver UNIQUEMENT security_invoker sur la vue déjà existante.
-- La vue exécute alors les SELECT avec les privilèges du propriétaire (postgres),
-- ce qui contourne la RLS de stores SANS l'ouvrir directement.
-- La vue ne contient que des colonnes publiques (pas whatsapp_number, owner_id,
-- emails, ni motifs de bannissement).
--
-- À APPLIQUER MANUELLEMENT, dans cet ordre :
--   1. Supabase.com — projet PRODUCTION (zandofy-live), via SQL Editor.
--   2. Supabase.com — projet STAGING (zandofy-production), via SQL Editor.
--
-- Vérification immédiate après exécution :
--   select id, name, logo_url, is_verified, is_certified
--   from public.stores_public
--   where id = 'f6808c6d-bbd7-49fb-a976-882eecd1b39e';
--   -- Doit retourner 1 ligne.
--
--   select id from public.stores
--   where id = 'f6808c6d-bbd7-49fb-a976-882eecd1b39e';
--   -- Doit toujours retourner 0 ligne pour anon/authenticated (RLS conservée).

ALTER VIEW IF EXISTS public.stores_public
  SET (security_invoker = false);

GRANT SELECT ON public.stores_public TO anon, authenticated;