-- ===== Chantier 2: Marketing Automation Tracking =====

-- 1. Events table
CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_workflow ON public.automation_events(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_user ON public.automation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_anon ON public.automation_events(anon_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_type_created ON public.automation_events(event_type, created_at DESC);

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert their own events
CREATE POLICY "anyone_can_insert_automation_events"
ON public.automation_events
FOR INSERT
TO public
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "admins_can_read_automation_events"
ON public.automation_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. KPI RPC
CREATE OR REPLACE FUNCTION public.get_automation_kpis(
  p_workflow_id UUID DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT * FROM public.automation_events
    WHERE (p_workflow_id IS NULL OR workflow_id = p_workflow_id)
      AND (p_since IS NULL OR created_at >= p_since)
  )
  SELECT jsonb_build_object(
    'delivered_popup', (SELECT COUNT(*) FROM base WHERE event_type = 'delivered_popup'),
    'delivered_email', (SELECT COUNT(*) FROM base WHERE event_type = 'delivered_email'),
    'delivered_push', (SELECT COUNT(*) FROM base WHERE event_type = 'delivered_push'),
    'failed_email', (SELECT COUNT(*) FROM base WHERE event_type = 'failed_email'),
    'clicked_popup', (SELECT COUNT(*) FROM base WHERE event_type = 'clicked_popup_cta'),
    'clicked_email', (SELECT COUNT(*) FROM base WHERE event_type = 'clicked_email_link'),
    'dismissed_popup', (SELECT COUNT(*) FROM base WHERE event_type = 'dismissed_popup'),
    'converted_signup', (SELECT COUNT(*) FROM base WHERE event_type = 'converted_signup'),
    'converted_order', (SELECT COUNT(*) FROM base WHERE event_type = 'converted_order'),
    'total_delivered', (SELECT COUNT(*) FROM base WHERE event_type IN ('delivered_popup','delivered_email','delivered_push')),
    'total_clicked', (SELECT COUNT(*) FROM base WHERE event_type IN ('clicked_popup_cta','clicked_email_link')),
    'total_converted', (SELECT COUNT(*) FROM base WHERE event_type IN ('converted_signup','converted_order'))
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_automation_kpis(UUID, TIMESTAMPTZ) TO authenticated;

-- 3. Per-workflow performance RPC
CREATE OR REPLACE FUNCTION public.get_automation_workflow_performance(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  workflow_id UUID,
  workflow_name TEXT,
  delivered BIGINT,
  clicked BIGINT,
  converted BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id,
    w.name,
    COUNT(*) FILTER (WHERE e.event_type IN ('delivered_popup','delivered_email','delivered_push')) AS delivered,
    COUNT(*) FILTER (WHERE e.event_type IN ('clicked_popup_cta','clicked_email_link')) AS clicked,
    COUNT(*) FILTER (WHERE e.event_type IN ('converted_signup','converted_order')) AS converted
  FROM public.automation_workflows w
  LEFT JOIN public.automation_events e
    ON e.workflow_id = w.id
    AND (p_since IS NULL OR e.created_at >= p_since)
  GROUP BY w.id, w.name
  ORDER BY delivered DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_automation_workflow_performance(TIMESTAMPTZ) TO authenticated;

-- 4. User journey RPC
CREATE OR REPLACE FUNCTION public.get_automation_user_journey(
  p_workflow_id UUID DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  workflow_id UUID,
  workflow_name TEXT,
  user_id UUID,
  anon_id TEXT,
  user_email TEXT,
  delivered_at TIMESTAMPTZ,
  clicked BOOLEAN,
  converted_signup BOOLEAN,
  converted_order BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH delivered AS (
    SELECT DISTINCT ON (e.workflow_id, COALESCE(e.user_id::text, e.anon_id))
      e.workflow_id,
      e.user_id,
      e.anon_id,
      e.created_at AS delivered_at
    FROM public.automation_events e
    WHERE e.event_type IN ('delivered_popup','delivered_email','delivered_push')
      AND (p_workflow_id IS NULL OR e.workflow_id = p_workflow_id)
      AND (p_since IS NULL OR e.created_at >= p_since)
    ORDER BY e.workflow_id, COALESCE(e.user_id::text, e.anon_id), e.created_at DESC
  )
  SELECT
    d.workflow_id,
    w.name,
    d.user_id,
    d.anon_id,
    p.email,
    d.delivered_at,
    EXISTS (
      SELECT 1 FROM public.automation_events e2
      WHERE e2.workflow_id = d.workflow_id
        AND (e2.user_id = d.user_id OR e2.anon_id = d.anon_id)
        AND e2.event_type IN ('clicked_popup_cta','clicked_email_link')
        AND e2.created_at >= d.delivered_at
    ) AS clicked,
    EXISTS (
      SELECT 1 FROM public.automation_events e3
      WHERE e3.workflow_id = d.workflow_id
        AND (e3.user_id = d.user_id OR e3.anon_id = d.anon_id)
        AND e3.event_type = 'converted_signup'
        AND e3.created_at >= d.delivered_at
    ) AS converted_signup,
    EXISTS (
      SELECT 1 FROM public.automation_events e4
      WHERE e4.workflow_id = d.workflow_id
        AND (e4.user_id = d.user_id OR e4.anon_id = d.anon_id)
        AND e4.event_type = 'converted_order'
        AND e4.created_at >= d.delivered_at
    ) AS converted_order
  FROM delivered d
  JOIN public.automation_workflows w ON w.id = d.workflow_id
  LEFT JOIN public.profiles p ON p.id = d.user_id
  ORDER BY d.delivered_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_automation_user_journey(UUID, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;

-- 5. Daily timeseries RPC
CREATE OR REPLACE FUNCTION public.get_automation_daily_events(
  p_workflow_id UUID DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  day DATE,
  delivered BIGINT,
  clicked BIGINT,
  converted BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    created_at::date AS day,
    COUNT(*) FILTER (WHERE event_type IN ('delivered_popup','delivered_email','delivered_push')) AS delivered,
    COUNT(*) FILTER (WHERE event_type IN ('clicked_popup_cta','clicked_email_link')) AS clicked,
    COUNT(*) FILTER (WHERE event_type IN ('converted_signup','converted_order')) AS converted
  FROM public.automation_events
  WHERE (p_workflow_id IS NULL OR workflow_id = p_workflow_id)
    AND (p_since IS NULL OR created_at >= p_since)
  GROUP BY created_at::date
  ORDER BY created_at::date;
$$;

GRANT EXECUTE ON FUNCTION public.get_automation_daily_events(UUID, TIMESTAMPTZ) TO authenticated;

-- 6. Conversion triggers (attribution: 7d signup / 14d order)

CREATE OR REPLACE FUNCTION public.track_automation_signup_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workflow_id UUID;
BEGIN
  -- Find any workflow delivered to this user (by user_id or potentially anon_id linked later)
  -- within the last 7 days (signup attribution window)
  FOR v_workflow_id IN
    SELECT DISTINCT workflow_id
    FROM public.automation_events
    WHERE user_id = NEW.id
      AND event_type IN ('delivered_popup','delivered_email','delivered_push')
      AND created_at >= now() - interval '7 days'
  LOOP
    INSERT INTO public.automation_events (workflow_id, user_id, event_type, metadata)
    VALUES (v_workflow_id, NEW.id, 'converted_signup', jsonb_build_object('profile_id', NEW.id));
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_signup_conversion ON public.profiles;
CREATE TRIGGER trg_automation_signup_conversion
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.track_automation_signup_conversion();

CREATE OR REPLACE FUNCTION public.track_automation_order_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workflow_id UUID;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  -- 14d order attribution window
  FOR v_workflow_id IN
    SELECT DISTINCT workflow_id
    FROM public.automation_events
    WHERE user_id = NEW.user_id
      AND event_type IN ('delivered_popup','delivered_email','delivered_push')
      AND created_at >= now() - interval '14 days'
  LOOP
    INSERT INTO public.automation_events (workflow_id, user_id, event_type, metadata)
    VALUES (v_workflow_id, NEW.user_id, 'converted_order', jsonb_build_object('order_id', NEW.id));
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_order_conversion ON public.orders;
CREATE TRIGGER trg_automation_order_conversion
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.track_automation_order_conversion();