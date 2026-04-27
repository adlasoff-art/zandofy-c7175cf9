-- ============================================
-- LOT 14 — Marketing Automation v2
-- ============================================
-- 1. Targeting géo + rôle sur workflows
ALTER TABLE public.automation_workflows
  ADD COLUMN IF NOT EXISTS condition_countries text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS condition_cities text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS condition_roles text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ab_test_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_split_percent integer NOT NULL DEFAULT 50
    CHECK (ab_split_percent BETWEEN 0 AND 100);

-- 2. Variants A/B (max 2 par workflow : variant 'A' implicite = workflow base, variant 'B' override)
CREATE TABLE IF NOT EXISTS public.automation_workflow_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  variant_label text NOT NULL CHECK (variant_label IN ('A','B')),
  popup_title text,
  popup_content text,
  popup_image_url text,
  popup_cta_label text,
  popup_cta_link text,
  push_title text,
  push_body text,
  email_subject text,
  email_html_content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, variant_label)
);

ALTER TABLE public.automation_workflow_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage variants" ON public.automation_workflow_variants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Public read variants of active workflows" ON public.automation_workflow_variants
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.automation_workflows w
    WHERE w.id = automation_workflow_variants.workflow_id AND w.is_active = true));

DROP TRIGGER IF EXISTS update_automation_variants_updated_at ON public.automation_workflow_variants;
CREATE TRIGGER update_automation_variants_updated_at
  BEFORE UPDATE ON public.automation_workflow_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tracking variant assigné par user/workflow
ALTER TABLE public.automation_user_progress
  ADD COLUMN IF NOT EXISTS assigned_variant text CHECK (assigned_variant IN ('A','B'));

ALTER TABLE public.automation_events
  ADD COLUMN IF NOT EXISTS variant_label text CHECK (variant_label IN ('A','B'));

CREATE INDEX IF NOT EXISTS idx_automation_events_variant
  ON public.automation_events(workflow_id, variant_label, event_type);

-- 4. Vue métriques de conversion
DROP VIEW IF EXISTS public.v_automation_metrics CASCADE;
CREATE VIEW public.v_automation_metrics
WITH (security_invoker = true) AS
SELECT
  w.id AS workflow_id,
  w.name,
  w.is_active,
  w.channel,
  COALESCE(e.variant_label, 'A') AS variant_label,
  COUNT(*) FILTER (WHERE e.event_type = 'displayed') AS displays,
  COUNT(*) FILTER (WHERE e.event_type = 'clicked')   AS clicks,
  COUNT(*) FILTER (WHERE e.event_type = 'dismissed') AS dismissals,
  COUNT(*) FILTER (WHERE e.event_type = 'converted') AS conversions,
  CASE WHEN COUNT(*) FILTER (WHERE e.event_type='displayed') > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE e.event_type='clicked')
                  / COUNT(*) FILTER (WHERE e.event_type='displayed'), 2)
       ELSE 0 END AS ctr_percent,
  CASE WHEN COUNT(*) FILTER (WHERE e.event_type='displayed') > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE e.event_type='converted')
                  / COUNT(*) FILTER (WHERE e.event_type='displayed'), 2)
       ELSE 0 END AS conversion_percent
FROM public.automation_workflows w
LEFT JOIN public.automation_events e ON e.workflow_id = w.id
GROUP BY w.id, w.name, w.is_active, w.channel, e.variant_label;

GRANT SELECT ON public.v_automation_metrics TO authenticated;

-- 5. Fonction d'attribution déterministe du variant (50/50 par défaut)
CREATE OR REPLACE FUNCTION public.assign_automation_variant(
  p_workflow_id uuid,
  p_user_id uuid,
  p_anon_id text
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_split int;
  v_seed text;
  v_hash int;
BEGIN
  SELECT ab_test_enabled, ab_split_percent
    INTO v_enabled, v_split
    FROM public.automation_workflows WHERE id = p_workflow_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN 'A';
  END IF;

  v_seed := COALESCE(p_user_id::text, p_anon_id, 'anon') || '|' || p_workflow_id::text;
  v_hash := abs(hashtext(v_seed)) % 100;
  RETURN CASE WHEN v_hash < v_split THEN 'A' ELSE 'B' END;
END $$;

REVOKE ALL ON FUNCTION public.assign_automation_variant(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_automation_variant(uuid, uuid, text) TO authenticated, anon;

-- 6. Helper RPC : récupérer le contenu effectif (workflow + variant override)
CREATE OR REPLACE FUNCTION public.get_automation_content(
  p_workflow_id uuid,
  p_variant text DEFAULT 'A'
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'variant_label', COALESCE(v.variant_label, 'A'),
    'popup_title',        COALESCE(v.popup_title,        w.popup_title),
    'popup_content',      COALESCE(v.popup_content,      w.popup_content),
    'popup_image_url',    COALESCE(v.popup_image_url,    w.popup_image_url),
    'popup_cta_label',    COALESCE(v.popup_cta_label,    w.popup_cta_label),
    'popup_cta_link',     COALESCE(v.popup_cta_link,     w.popup_cta_link),
    'push_title',         COALESCE(v.push_title,         w.push_title),
    'push_body',          COALESCE(v.push_body,          w.push_body),
    'email_subject',      COALESCE(v.email_subject,      w.email_subject),
    'email_html_content', COALESCE(v.email_html_content, w.email_html_content)
  )
  FROM public.automation_workflows w
  LEFT JOIN public.automation_workflow_variants v
    ON v.workflow_id = w.id AND v.variant_label = p_variant
  WHERE w.id = p_workflow_id;
$$;

REVOKE ALL ON FUNCTION public.get_automation_content(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_automation_content(uuid, text) TO authenticated, anon;

-- 7. Cron horaire pour process-automation (extension pg_cron déjà active)
DO $$
DECLARE v_jobid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname='process-automation-hourly';
    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_jobid);
    END IF;
    PERFORM cron.schedule(
      'process-automation-hourly',
      '5 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://uogkklwfvwoxkifpkzpu.supabase.co/functions/v1/process-automation',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2trbHdmdndveGtpZnBrenB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODY0MzcsImV4cCI6MjA4NzQ2MjQzN30.9NhIOytfsQ7Gdufs0goV6Lk97IyMkda362jh3IGMVi4'
        ),
        body := jsonb_build_object('source','cron','at', now())
      );
      $cron$
    );
  END IF;
END $$;