
-- Fix: Allow users to update their own vendor applications status to 'submitted'
-- The current policy blocks this because the implicit WITH CHECK requires the NEW status to also be in ('draft','revision_requested')

DROP POLICY "Users update own applications" ON public.vendor_applications;

CREATE POLICY "Users update own applications"
ON public.vendor_applications FOR UPDATE
USING (user_id = auth.uid() AND status IN ('draft', 'revision_requested'))
WITH CHECK (user_id = auth.uid() AND status IN ('draft', 'revision_requested', 'submitted'));
