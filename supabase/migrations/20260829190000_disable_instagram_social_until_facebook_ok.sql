-- Purpose: Pause Instagram social enqueue until Facebook Page publishing works.
-- Tables: social_post_settings, social_post_jobs
-- Rollback: UPDATE social_post_settings SET is_enabled = true WHERE platform = 'instagram';

UPDATE public.social_post_settings
SET is_enabled = false,
    updated_at = now()
WHERE platform = 'instagram';

-- Cancel pending/processing Instagram jobs so they no longer surface in admin toasts
UPDATE public.social_post_jobs
SET status = 'skipped',
    last_error = COALESCE(last_error, 'Instagram paused — Facebook-first'),
    updated_at = now()
WHERE platform = 'instagram'
  AND status IN ('pending', 'processing');
