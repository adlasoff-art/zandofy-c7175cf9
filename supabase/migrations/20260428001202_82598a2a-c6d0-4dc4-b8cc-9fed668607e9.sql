-- ============================================================
-- LOT 18 — OBSERVABILITÉ & MONITORING
-- Tables : health_checks, health_incidents, cron_heartbeats, monitoring_settings
-- ============================================================

-- 1. health_checks : historique des pings
CREATE TABLE IF NOT EXISTS public.health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('edge_function','payment_gateway','smtp','cron','database','external_api')),
  status text NOT NULL CHECK (status IN ('ok','warn','down')),
  latency_ms integer,
  http_status integer,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_component_time ON public.health_checks(component, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_status_time ON public.health_checks(status, checked_at DESC) WHERE status <> 'ok';
CREATE INDEX IF NOT EXISTS idx_health_checks_recent ON public.health_checks(checked_at DESC);

ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view health checks"
  ON public.health_checks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Service role can insert health checks"
  ON public.health_checks FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. health_incidents : incidents agrégés
CREATE TABLE IF NOT EXISTS public.health_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  component_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','critical')),
  title text NOT NULL,
  description text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  is_open boolean GENERATED ALWAYS AS (closed_at IS NULL) STORED,
  alert_channels_sent text[] DEFAULT ARRAY[]::text[],
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  occurrences_count integer DEFAULT 1,
  last_occurrence_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_incident_per_component
  ON public.health_incidents(component) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_health_incidents_open ON public.health_incidents(is_open, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_incidents_severity ON public.health_incidents(severity, opened_at DESC);

ALTER TABLE public.health_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view incidents"
  ON public.health_incidents FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can manage incidents"
  ON public.health_incidents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. cron_heartbeats : un tick par job cron
CREATE TABLE IF NOT EXISTS public.cron_heartbeats (
  job_name text PRIMARY KEY,
  last_tick_at timestamptz NOT NULL DEFAULT now(),
  expected_interval_minutes integer NOT NULL DEFAULT 60,
  last_status text DEFAULT 'ok' CHECK (last_status IN ('ok','warn','down')),
  last_error text,
  total_runs bigint DEFAULT 0,
  failed_runs bigint DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.cron_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cron heartbeats"
  ON public.cron_heartbeats FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can manage cron heartbeats"
  ON public.cron_heartbeats FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. monitoring_settings : config singleton
CREATE TABLE IF NOT EXISTS public.monitoring_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  alert_email_enabled boolean DEFAULT true,
  alert_push_enabled boolean DEFAULT true,
  alert_banner_enabled boolean DEFAULT true,
  alert_emails text[] DEFAULT ARRAY[]::text[],
  kelpay_latency_threshold_ms integer DEFAULT 8000,
  ef_latency_threshold_ms integer DEFAULT 5000,
  failure_rate_threshold_pct numeric DEFAULT 10.0,
  smtp_test_recipient text,
  enabled boolean DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.monitoring_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.monitoring_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view monitoring settings"
  ON public.monitoring_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can update monitoring settings"
  ON public.monitoring_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. RPC : record_cron_heartbeat (appelé par chaque cron job)
CREATE OR REPLACE FUNCTION public.record_cron_heartbeat(
  _job_name text,
  _status text DEFAULT 'ok',
  _error text DEFAULT NULL,
  _expected_interval_minutes integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cron_heartbeats (job_name, last_tick_at, last_status, last_error, total_runs, failed_runs, expected_interval_minutes)
  VALUES (
    _job_name, now(), _status, _error, 1,
    CASE WHEN _status <> 'ok' THEN 1 ELSE 0 END,
    COALESCE(_expected_interval_minutes, 60)
  )
  ON CONFLICT (job_name) DO UPDATE SET
    last_tick_at = now(),
    last_status = EXCLUDED.last_status,
    last_error = EXCLUDED.last_error,
    total_runs = public.cron_heartbeats.total_runs + 1,
    failed_runs = public.cron_heartbeats.failed_runs + CASE WHEN _status <> 'ok' THEN 1 ELSE 0 END,
    expected_interval_minutes = COALESCE(_expected_interval_minutes, public.cron_heartbeats.expected_interval_minutes);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_cron_heartbeat(text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_cron_heartbeat(text, text, text, integer) TO authenticated, service_role;

-- 6. Vue agrégée v_system_health (24h)
DROP VIEW IF EXISTS public.v_system_health;
CREATE VIEW public.v_system_health
WITH (security_invoker = true)
AS
WITH recent AS (
  SELECT component, component_type, status, latency_ms, checked_at
  FROM public.health_checks
  WHERE checked_at >= now() - interval '24 hours'
),
agg AS (
  SELECT
    component,
    component_type,
    count(*) AS total_checks,
    count(*) FILTER (WHERE status = 'ok') AS ok_checks,
    count(*) FILTER (WHERE status = 'down') AS down_checks,
    round(avg(latency_ms) FILTER (WHERE status = 'ok')::numeric, 0) AS avg_latency_ok,
    max(checked_at) AS last_check_at,
    (SELECT status FROM recent r2 WHERE r2.component = r.component ORDER BY checked_at DESC LIMIT 1) AS last_status
  FROM recent r
  GROUP BY component, component_type
)
SELECT
  a.*,
  CASE WHEN total_checks > 0 THEN round(100.0 * ok_checks / total_checks, 2) ELSE 100 END AS uptime_pct_24h,
  EXISTS (SELECT 1 FROM public.health_incidents i WHERE i.component = a.component AND i.closed_at IS NULL) AS has_open_incident
FROM agg a;

-- 7. Trigger updated_at sur health_incidents
CREATE OR REPLACE FUNCTION public.update_health_incidents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL AND NEW.resolved_by IS NULL THEN
    NEW.resolved_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_health_incidents_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_health_incidents_updated ON public.health_incidents;
CREATE TRIGGER trg_health_incidents_updated
  BEFORE UPDATE ON public.health_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_health_incidents_updated_at();