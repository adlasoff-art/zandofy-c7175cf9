
-- Repasser la vue en security_invoker (résout le warning linter)
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

-- Policy SELECT publique sur la table mère (la vue en security_invoker
-- s'exécute avec les droits du caller). On la limite aux workflows actifs.
-- Les colonnes sensibles (email_html_content, email_subject, push_title, push_body)
-- restent inaccessibles côté client grâce au REVOKE/GRANT colonne déjà appliqué.
DROP POLICY IF EXISTS "Public read active workflows safe" ON public.automation_workflows;
CREATE POLICY "Public read active workflows safe"
  ON public.automation_workflows FOR SELECT
  USING (is_active = true);
