DROP VIEW IF EXISTS public.automation_workflows_public CASCADE;

CREATE VIEW public.automation_workflows_public
WITH (security_invoker = true) AS
SELECT
  id, name, trigger_type, delay_days, delay_minutes, channel,
  condition_has_account, condition_has_order, condition_max_days_since_signup,
  condition_countries, condition_cities, condition_roles,
  ab_test_enabled, ab_split_percent,
  popup_title, popup_content, popup_image_url, popup_cta_label, popup_cta_link,
  display_frequency, max_displays, sort_order, is_active
FROM public.automation_workflows
WHERE is_active = true;

GRANT SELECT ON public.automation_workflows_public TO anon, authenticated;