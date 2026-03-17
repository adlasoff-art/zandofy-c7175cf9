
-- Fix the overly permissive INSERT policy on blog_post_views
DROP POLICY "Anyone can insert views" ON public.blog_post_views;
CREATE POLICY "Anyone can insert views" ON public.blog_post_views FOR INSERT WITH CHECK (
  post_id IS NOT NULL AND session_id IS NOT NULL
);
