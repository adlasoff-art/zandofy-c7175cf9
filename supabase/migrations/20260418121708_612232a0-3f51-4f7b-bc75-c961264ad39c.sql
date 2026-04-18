-- Idempotent setup for automation system

-- Ensure user progress table exists
CREATE TABLE IF NOT EXISTS public.automation_user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  user_id uuid,
  anon_id text,
  display_count int NOT NULL DEFAULT 0,
  last_displayed_at timestamptz,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_aup_user_workflow ON public.automation_user_progress(user_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_aup_anon_workflow ON public.automation_user_progress(anon_id, workflow_id);

ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_user_progress ENABLE ROW LEVEL SECURITY;

-- Reset and recreate workflow policies
DROP POLICY IF EXISTS "Active workflows are publicly readable" ON public.automation_workflows;
DROP POLICY IF EXISTS "Admins can manage workflows" ON public.automation_workflows;

CREATE POLICY "Active workflows are publicly readable"
ON public.automation_workflows FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage workflows"
ON public.automation_workflows FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Reset and recreate progress policies
DROP POLICY IF EXISTS "Users read own progress" ON public.automation_user_progress;
DROP POLICY IF EXISTS "Users insert own progress" ON public.automation_user_progress;
DROP POLICY IF EXISTS "Users update own progress" ON public.automation_user_progress;
DROP POLICY IF EXISTS "Admins manage all progress" ON public.automation_user_progress;

CREATE POLICY "Users read own progress"
ON public.automation_user_progress FOR SELECT
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR (user_id IS NULL AND anon_id IS NOT NULL)
);

CREATE POLICY "Users insert own progress"
ON public.automation_user_progress FOR INSERT
WITH CHECK (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR (user_id IS NULL AND anon_id IS NOT NULL)
);

CREATE POLICY "Users update own progress"
ON public.automation_user_progress FOR UPDATE
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR (user_id IS NULL AND anon_id IS NOT NULL)
);

CREATE POLICY "Admins manage all progress"
ON public.automation_user_progress FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));