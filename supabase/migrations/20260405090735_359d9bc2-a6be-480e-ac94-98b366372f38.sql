
-- SMS provider configuration table
CREATE TABLE public.sms_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'twilio',
  is_active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage SMS config"
  ON public.sms_provider_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Scheduled email campaigns (birthday, holidays)
CREATE TABLE public.scheduled_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_type TEXT NOT NULL, -- 'birthday', 'christmas', 'new_year', 'custom'
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL DEFAULT '',
  promo_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  schedule_month INT, -- 1-12 for holidays
  schedule_day INT,   -- 1-31 for holidays
  days_before INT DEFAULT 0, -- send X days before
  batch_size INT NOT NULL DEFAULT 10,
  batch_interval_minutes INT NOT NULL DEFAULT 20,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage campaigns"
  ON public.scheduled_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Campaign send log to track per-user sends
CREATE TABLE public.campaign_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.scheduled_campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT
);

ALTER TABLE public.campaign_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view campaign logs"
  ON public.campaign_send_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert campaign logs"
  ON public.campaign_send_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add geo fields to profiles if not present
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'residence_country') THEN
    ALTER TABLE public.profiles ADD COLUMN residence_country TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'residence_province') THEN
    ALTER TABLE public.profiles ADD COLUMN residence_province TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'residence_city') THEN
    ALTER TABLE public.profiles ADD COLUMN residence_city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'residence_commune') THEN
    ALTER TABLE public.profiles ADD COLUMN residence_commune TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'residence_quartier') THEN
    ALTER TABLE public.profiles ADD COLUMN residence_quartier TEXT;
  END IF;
END $$;
