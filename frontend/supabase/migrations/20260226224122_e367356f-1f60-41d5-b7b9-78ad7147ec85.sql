
-- Create admin audit log table
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL, -- 'ban', 'unban', 'add_role', 'remove_role', 'warning', 'reset_password'
  target_user_id uuid NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only staff can read audit logs
CREATE POLICY "Staff read audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Only admins can insert audit logs
CREATE POLICY "Staff insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
