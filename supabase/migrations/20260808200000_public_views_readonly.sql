-- Purpose: audit v8 P0 — views products_public / stores_public were auto-updatable;
--   anon could PATCH price / rename stores via REST (204). SELECT-only for public roles.
-- Affected: products_public, stores_public.
-- Rollback: GRANT INSERT, UPDATE, DELETE ON those views TO authenticated (not recommended
--   for anon). Vendors must keep writing to base tables products / stores.
-- Risk: none for catalog read; blocks anonymous catalog vandalism.
-- Staging → production: run immediately on both projects, then verify with PATCH curl → 401/403.

-- Strip all privileges, then re-grant SELECT only (catalogue public).
REVOKE ALL ON TABLE public.products_public FROM PUBLIC;
REVOKE ALL ON TABLE public.products_public FROM anon;
REVOKE ALL ON TABLE public.products_public FROM authenticated;
GRANT SELECT ON TABLE public.products_public TO anon, authenticated;
GRANT SELECT ON TABLE public.products_public TO service_role;

REVOKE ALL ON TABLE public.stores_public FROM PUBLIC;
REVOKE ALL ON TABLE public.stores_public FROM anon;
REVOKE ALL ON TABLE public.stores_public FROM authenticated;
GRANT SELECT ON TABLE public.stores_public TO anon, authenticated;
GRANT SELECT ON TABLE public.stores_public TO service_role;

-- Belt-and-suspenders: reject writes through the views even if grants are mis-set later.
CREATE OR REPLACE FUNCTION public.reject_public_view_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'public catalog views are read-only; mutate base table products/stores with RLS'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_products_public_no_insert ON public.products_public;
DROP TRIGGER IF EXISTS trg_products_public_no_update ON public.products_public;
DROP TRIGGER IF EXISTS trg_products_public_no_delete ON public.products_public;
CREATE TRIGGER trg_products_public_no_insert
  INSTEAD OF INSERT ON public.products_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_products_public_no_update
  INSTEAD OF UPDATE ON public.products_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_products_public_no_delete
  INSTEAD OF DELETE ON public.products_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();

DROP TRIGGER IF EXISTS trg_stores_public_no_insert ON public.stores_public;
DROP TRIGGER IF EXISTS trg_stores_public_no_update ON public.stores_public;
DROP TRIGGER IF EXISTS trg_stores_public_no_delete ON public.stores_public;
CREATE TRIGGER trg_stores_public_no_insert
  INSTEAD OF INSERT ON public.stores_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_stores_public_no_update
  INSTEAD OF UPDATE ON public.stores_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_stores_public_no_delete
  INSTEAD OF DELETE ON public.stores_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
