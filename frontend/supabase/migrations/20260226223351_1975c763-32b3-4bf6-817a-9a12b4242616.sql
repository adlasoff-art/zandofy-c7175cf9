
-- Add ban fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ban_reason text,
ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS banned_by uuid;

-- Create user_warnings table
CREATE TABLE public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  warned_by uuid NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'warning', -- 'warning', 'final_warning'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- Only admins/managers can manage warnings
CREATE POLICY "Staff read all warnings"
  ON public.user_warnings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff insert warnings"
  ON public.user_warnings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff delete warnings"
  ON public.user_warnings FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can see their own warnings
CREATE POLICY "Users read own warnings"
  ON public.user_warnings FOR SELECT
  USING (user_id = auth.uid());

-- Allow staff to update ban fields on profiles
-- (already covered by existing admin/manager SELECT policies)
-- Add staff update policy for profiles
CREATE POLICY "Staff update profiles"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
