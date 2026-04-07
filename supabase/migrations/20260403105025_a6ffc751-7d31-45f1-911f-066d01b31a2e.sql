
-- Fix: Set SECURITY INVOKER on the view to respect RLS of the querying user
ALTER VIEW public.products_public SET (security_invoker = on);
