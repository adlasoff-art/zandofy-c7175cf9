
-- Job postings table for careers page
CREATE TABLE public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  contract_type text NOT NULL DEFAULT 'CDI',
  posting_type text NOT NULL DEFAULT 'job_offer',
  description text NOT NULL DEFAULT '',
  requirements text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  education_level text NOT NULL DEFAULT '',
  experience_years text NOT NULL DEFAULT '',
  salary_range text,
  deadline date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Public can read active postings
CREATE POLICY "Anyone can read active job postings"
ON public.job_postings FOR SELECT
USING (is_active = true);

-- Admins full access
CREATE POLICY "Admins can manage job postings"
ON public.job_postings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Managers full access
CREATE POLICY "Managers can manage job postings"
ON public.job_postings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'manager'));
