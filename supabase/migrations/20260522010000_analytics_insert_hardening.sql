-- Lot G4: tighten public analytics INSERT (anti-spam) without breaking page_view tracking.

DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IN (
    'page_view',
    'page_view_end',
    'product_click',
    'product_view',
    'store_view',
    'pwa_install',
    'session_start',
    'session_end',
    'search',
    'add_to_cart',
    'checkout_start',
    'purchase'
  )
  AND char_length(session_id) BETWEEN 8 AND 128
  AND (page_path IS NULL OR char_length(page_path) <= 500)
  AND (referrer IS NULL OR char_length(referrer) <= 2000)
);
