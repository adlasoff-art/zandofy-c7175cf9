DROP POLICY IF EXISTS anyone_can_insert_automation_events ON public.automation_events;

CREATE POLICY "Validated insert automation events"
ON public.automation_events FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- workflow must exist and be active
  EXISTS (
    SELECT 1 FROM public.automation_workflows w
    WHERE w.id = workflow_id AND w.is_active = true
  )
  AND (
    -- authenticated: user_id must match auth.uid() (or be NULL with anon_id set)
    (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR (user_id IS NULL AND anon_id IS NOT NULL)))
    -- anonymous: must provide anon_id and no user_id
    OR (auth.uid() IS NULL AND user_id IS NULL AND anon_id IS NOT NULL)
  )
);