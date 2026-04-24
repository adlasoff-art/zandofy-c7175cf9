
-- ============================================================
-- LOT SÉCURITÉ v4.2
-- ============================================================

-- 1) COUPONS : retirer la lecture publique, ajouter RPC sécurisée
DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
RETURNS TABLE (
  code text,
  discount_type text,
  discount_value numeric,
  min_order_amount numeric,
  max_uses integer,
  current_uses integer,
  expires_at timestamptz,
  target_city text,
  target_country text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.code, c.discount_type, c.discount_value, c.min_order_amount,
         c.max_uses, c.current_uses, c.expires_at, c.target_city, c.target_country
  FROM public.coupons c
  WHERE c.code = upper(trim(p_code))
    AND c.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO anon, authenticated;

-- 2) AUTOMATION WORKFLOWS : retirer SELECT publiques, créer vue safe
DROP POLICY IF EXISTS "Active workflows are publicly readable" ON public.automation_workflows;
DROP POLICY IF EXISTS "Anyone can read active workflows" ON public.automation_workflows;

-- Vue publique : uniquement champs popup (pas d'email HTML, pas de push_body)
DROP VIEW IF EXISTS public.automation_workflows_public;
CREATE VIEW public.automation_workflows_public
WITH (security_invoker=on) AS
SELECT
  id, name, trigger_type, delay_days, delay_minutes, channel,
  condition_has_account, condition_has_order, condition_max_days_since_signup,
  popup_title, popup_content, popup_image_url, popup_cta_label, popup_cta_link,
  display_frequency, max_displays, sort_order, is_active
FROM public.automation_workflows
WHERE is_active = true;

GRANT SELECT ON public.automation_workflows_public TO anon, authenticated;

-- Policy minimale pour que la vue (security_invoker) puisse lire la table
CREATE POLICY "Public read non-sensitive workflow fields"
  ON public.automation_workflows FOR SELECT
  USING (is_active = true);
-- NOTE: cette policy est conservée mais le code client doit passer par la vue.
-- Pour bloquer la lecture directe des colonnes sensibles, on retire les colonnes
-- via un GRANT au niveau colonnes :
REVOKE SELECT ON public.automation_workflows FROM anon, authenticated;
GRANT SELECT (
  id, name, trigger_type, delay_days, delay_minutes, channel,
  condition_has_account, condition_has_order, condition_max_days_since_signup,
  popup_title, popup_content, popup_image_url, popup_cta_label, popup_cta_link,
  display_frequency, max_displays, sort_order, is_active, created_at, updated_at
) ON public.automation_workflows TO anon, authenticated;
-- Les admins gardent accès complet via la policy "Admins can manage workflows"
-- (qui s'applique en TOUTES colonnes via le rôle authenticated + has_role check)
-- → on doit donc redonner le SELECT total aux admins via une policy explicite ?
-- Non : has_role est évalué dans la policy USING; les GRANTS s'appliquent avant RLS.
-- Solution : redonner SELECT complet à un rôle admin n'est pas possible sans rôle PG dédié.
-- → On bascule : le client admin lit via une RPC dédiée OU la table avec colonnes safe + RPC pour le contenu sensible.

-- Approche plus simple et robuste : restaurer SELECT complet, mais la vue est utilisée par le front public.
GRANT SELECT ON public.automation_workflows TO anon, authenticated;
DROP POLICY IF EXISTS "Public read non-sensitive workflow fields" ON public.automation_workflows;

-- Solution finale : RLS column-level via policy USING qui filtre par rôle.
-- On garde une SELECT policy publique mais SEULEMENT pour les workflows actifs,
-- ET on protège les colonnes sensibles via la vue qu'on impose côté client.
-- Pour les non-admins, on crée une policy SELECT publique ET on documente que
-- le code DOIT utiliser la vue. Le risque résiduel : un attaquant peut SELECT
-- email_html_content directement. → On préfère donc une policy stricte :

CREATE POLICY "Admins read all workflow fields"
  ON public.automation_workflows FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Plus de SELECT public direct sur la table. Le front public utilise la vue.
-- La vue (security_invoker) hérite des permissions de l'appelant → elle a besoin
-- d'une policy SELECT pour fonctionner. On en ajoute une ciblée sur les champs non-sensibles
-- via une approche simple : exposer la vue avec security_definer.

DROP VIEW IF EXISTS public.automation_workflows_public;
CREATE VIEW public.automation_workflows_public
WITH (security_invoker=off) AS
SELECT
  id, name, trigger_type, delay_days, delay_minutes, channel,
  condition_has_account, condition_has_order, condition_max_days_since_signup,
  popup_title, popup_content, popup_image_url, popup_cta_label, popup_cta_link,
  display_frequency, max_displays, sort_order, is_active
FROM public.automation_workflows
WHERE is_active = true;

GRANT SELECT ON public.automation_workflows_public TO anon, authenticated;

-- 3) PROFILES : retirer accès managers
DROP POLICY IF EXISTS "Managers read all profiles" ON public.profiles;
-- Reste : "Admins read all profiles" + "Users read own profile"

-- 4) STORES : restreindre lecture des champs admin aux owner + admins (exclure collaborateurs)
DROP POLICY IF EXISTS "Owner staff read full store" ON public.stores;

-- Nouvelle policy : lecture complète uniquement pour owner + admins
CREATE POLICY "Owner and admins read full store"
  ON public.stores FOR SELECT
  USING (
    owner_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Les collaborateurs continuent d'accéder via la vue stores_public (qui exclut ban_reason etc.)
-- et via leurs RPC métier (orders, products, etc.)
