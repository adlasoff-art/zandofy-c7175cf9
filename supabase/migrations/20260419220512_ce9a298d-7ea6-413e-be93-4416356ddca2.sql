-- Drop existing function (signature change: new column added)
DROP FUNCTION IF EXISTS public.get_automation_user_journey(uuid, timestamptz, integer, integer);

CREATE OR REPLACE FUNCTION public.get_automation_user_journey(
  p_workflow_id uuid DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  workflow_id uuid,
  workflow_name text,
  user_id uuid,
  anon_id text,
  user_email text,
  user_full_name text,
  delivered_at timestamptz,
  clicked boolean,
  converted_signup boolean,
  converted_order boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH delivered AS (
    SELECT
      e.workflow_id,
      e.user_id,
      e.anon_id,
      MIN(e.created_at) AS delivered_at
    FROM public.automation_events e
    WHERE e.event_type IN ('delivered_popup','delivered_email','delivered_push')
      AND (p_workflow_id IS NULL OR e.workflow_id = p_workflow_id)
      AND (p_since IS NULL OR e.created_at >= p_since)
    GROUP BY e.workflow_id, e.user_id, e.anon_id
  ),
  enriched AS (
    SELECT
      d.workflow_id,
      d.user_id,
      d.anon_id,
      d.delivered_at,
      EXISTS (
        SELECT 1 FROM public.automation_events e2
        WHERE e2.workflow_id = d.workflow_id
          AND ((d.user_id IS NOT NULL AND e2.user_id = d.user_id)
               OR (d.anon_id IS NOT NULL AND e2.anon_id = d.anon_id))
          AND e2.event_type IN ('clicked_popup_cta','clicked_email_link')
      ) AS clicked,
      EXISTS (
        SELECT 1 FROM public.automation_events e3
        WHERE e3.workflow_id = d.workflow_id
          AND d.user_id IS NOT NULL AND e3.user_id = d.user_id
          AND e3.event_type = 'converted_signup'
      ) AS converted_signup,
      EXISTS (
        SELECT 1 FROM public.automation_events e4
        WHERE e4.workflow_id = d.workflow_id
          AND d.user_id IS NOT NULL AND e4.user_id = d.user_id
          AND e4.event_type = 'converted_order'
      ) AS converted_order
    FROM delivered d
  )
  SELECT
    en.workflow_id,
    w.name AS workflow_name,
    en.user_id,
    en.anon_id,
    p.email AS user_email,
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '') AS user_full_name,
    en.delivered_at,
    en.clicked,
    en.converted_signup,
    en.converted_order
  FROM enriched en
  JOIN public.automation_workflows w ON w.id = en.workflow_id
  LEFT JOIN public.profiles p ON p.id = en.user_id
  ORDER BY en.delivered_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;