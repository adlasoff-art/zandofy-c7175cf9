-- Purpose: Harden cms_homepage_sections RLS for public home rails + admin CMS
-- Tables: cms_homepage_sections
-- Rollback: DROP POLICY IF EXISTS on the policies below (keep table/config)
-- Risk: low if policies already equivalent; staging first — anon must still SELECT active rails

ALTER TABLE public.cms_homepage_sections ENABLE ROW LEVEL SECURITY;

-- Public / authenticated: read active homepage sections only
DROP POLICY IF EXISTS "cms_homepage_sections_public_select_active" ON public.cms_homepage_sections;
CREATE POLICY "cms_homepage_sections_public_select_active"
  ON public.cms_homepage_sections
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff: full read (incl. inactive) for admin CMS
DROP POLICY IF EXISTS "cms_homepage_sections_staff_select" ON public.cms_homepage_sections;
CREATE POLICY "cms_homepage_sections_staff_select"
  ON public.cms_homepage_sections
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

DROP POLICY IF EXISTS "cms_homepage_sections_staff_write" ON public.cms_homepage_sections;
CREATE POLICY "cms_homepage_sections_staff_write"
  ON public.cms_homepage_sections
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

COMMENT ON TABLE public.cms_homepage_sections IS
  'Homepage blocks. category_rail|store_rail use config.entity_id + config.limit; RLS: public reads active only';
