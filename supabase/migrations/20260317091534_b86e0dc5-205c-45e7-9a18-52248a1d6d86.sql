
-- Blog categories
CREATE TABLE public.blog_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#10b981',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blog categories are public" ON public.blog_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage blog categories" ON public.blog_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Blog editors (manager access) — must be created BEFORE blog_posts references it
CREATE TABLE public.blog_editors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  permissions TEXT[] DEFAULT ARRAY['write','edit','moderate_comments'],
  is_active BOOLEAN DEFAULT true,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_editors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage blog editors" ON public.blog_editors FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors can see their own record" ON public.blog_editors FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Blog posts
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  author_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  featured BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  reading_time_min INT DEFAULT 1,
  views_count INT DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  seo_keywords TEXT[] DEFAULT '{}',
  og_image_url TEXT,
  canonical_url TEXT,
  schema_type TEXT DEFAULT 'BlogPosting',
  video_embeds JSONB DEFAULT '[]',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published blog posts are public" ON public.blog_posts FOR SELECT USING (status = 'published' OR (auth.uid() IS NOT NULL AND (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Blog editors can insert" ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.blog_editors WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "Blog editors can update" ON public.blog_posts FOR UPDATE TO authenticated USING (
  author_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.blog_editors WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "Admins can delete blog posts" ON public.blog_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON public.blog_posts(published_at DESC);

-- Blog post views tracking
CREATE TABLE public.blog_post_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id UUID,
  session_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert views" ON public.blog_post_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Views are readable by admins" ON public.blog_post_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_blog_post_views_post ON public.blog_post_views(post_id);

-- Blog comments
CREATE TABLE public.blog_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved comments are public" ON public.blog_comments FOR SELECT USING (is_approved = true OR (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Authenticated users can comment" ON public.blog_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.blog_comments FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete comments" ON public.blog_comments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
CREATE INDEX idx_blog_comments_post ON public.blog_comments(post_id);

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_blog_post_views(p_post_id UUID, p_session_id TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_session_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.blog_post_views WHERE post_id = p_post_id AND session_id = p_session_id) THEN
      RETURN;
    END IF;
  END IF;
  INSERT INTO public.blog_post_views (post_id, user_id, session_id)
  VALUES (p_post_id, auth.uid(), p_session_id);
  UPDATE public.blog_posts SET views_count = views_count + 1 WHERE id = p_post_id;
END;
$$;

-- Triggers
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_blog_comments_updated_at BEFORE UPDATE ON public.blog_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
