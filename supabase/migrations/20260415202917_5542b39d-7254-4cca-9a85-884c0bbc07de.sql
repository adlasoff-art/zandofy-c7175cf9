
-- Enum for trigger types
CREATE TYPE public.automation_trigger_type AS ENUM (
  'visit_no_account',
  'account_created',
  'visit_no_order',
  'product_viewed_no_order',
  'no_order_delay',
  'referral_prompt',
  'custom'
);

-- Enum for channels
CREATE TYPE public.automation_channel AS ENUM (
  'popup',
  'push',
  'email',
  'popup_push',
  'push_email',
  'all'
);

-- Enum for display frequency
CREATE TYPE public.automation_display_frequency AS ENUM (
  'every_visit',
  'once',
  'daily',
  'once_per_session'
);

-- Main workflows table
CREATE TABLE public.automation_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  trigger_type public.automation_trigger_type NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  channel public.automation_channel NOT NULL DEFAULT 'popup',
  condition_has_account BOOLEAN DEFAULT NULL,
  condition_has_order BOOLEAN DEFAULT NULL,
  condition_max_days_since_signup INTEGER DEFAULT NULL,
  popup_title TEXT,
  popup_content TEXT,
  popup_image_url TEXT,
  popup_cta_label TEXT DEFAULT 'En savoir plus',
  popup_cta_link TEXT,
  push_title TEXT,
  push_body TEXT,
  email_subject TEXT,
  email_html_content TEXT,
  display_frequency public.automation_display_frequency NOT NULL DEFAULT 'once',
  max_displays INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User progress tracking
CREATE TABLE public.automation_user_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT NULL,
  anon_id TEXT DEFAULT NULL,
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  display_count INTEGER NOT NULL DEFAULT 0,
  last_displayed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_automation_workflows_active ON public.automation_workflows (is_active) WHERE is_active = true;
CREATE INDEX idx_automation_progress_user ON public.automation_user_progress (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_automation_progress_anon ON public.automation_user_progress (anon_id) WHERE anon_id IS NOT NULL;
CREATE INDEX idx_automation_progress_workflow ON public.automation_user_progress (workflow_id);

-- Updated_at trigger
CREATE TRIGGER update_automation_workflows_updated_at
  BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_user_progress ENABLE ROW LEVEL SECURITY;

-- Workflows: admin full CRUD
CREATE POLICY "Admins can manage workflows"
  ON public.automation_workflows FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Workflows: public read for active ones (needed for popup display)
CREATE POLICY "Anyone can read active workflows"
  ON public.automation_workflows FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Progress: users see their own
CREATE POLICY "Users can view own progress"
  ON public.automation_user_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Progress: users can insert their own
CREATE POLICY "Users can insert own progress"
  ON public.automation_user_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Progress: users can update their own
CREATE POLICY "Users can update own progress"
  ON public.automation_user_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Progress: anon can insert (for anonymous visitor tracking)
CREATE POLICY "Anon can insert progress"
  ON public.automation_user_progress FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL AND anon_id IS NOT NULL);

-- Progress: anon can read own by anon_id (not enforceable strictly, but low risk)
CREATE POLICY "Anon can read own progress"
  ON public.automation_user_progress FOR SELECT
  TO anon
  USING (user_id IS NULL AND anon_id IS NOT NULL);

-- Progress: admin can see all
CREATE POLICY "Admins can view all progress"
  ON public.automation_user_progress FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
