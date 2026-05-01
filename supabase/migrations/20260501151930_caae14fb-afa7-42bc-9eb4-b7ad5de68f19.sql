CREATE TABLE IF NOT EXISTS public.forwarder_shipping_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forwarder_id UUID NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  warehouse_address TEXT NOT NULL,
  package_info_template TEXT NOT NULL DEFAULT '{{customer_name}}
Tel: {{phone}}
{{city}}, {{country}}
Ref: {{order_ref}}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fwd_ship_tpl_forwarder
  ON public.forwarder_shipping_templates(forwarder_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fwd_ship_tpl_default
  ON public.forwarder_shipping_templates(forwarder_id)
  WHERE is_default = true;

ALTER TABLE public.forwarder_shipping_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fwd_ship_tpl_select ON public.forwarder_shipping_templates;
CREATE POLICY fwd_ship_tpl_select
ON public.forwarder_shipping_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS fwd_ship_tpl_insert ON public.forwarder_shipping_templates;
CREATE POLICY fwd_ship_tpl_insert
ON public.forwarder_shipping_templates
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS fwd_ship_tpl_update ON public.forwarder_shipping_templates;
CREATE POLICY fwd_ship_tpl_update
ON public.forwarder_shipping_templates
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS fwd_ship_tpl_delete ON public.forwarder_shipping_templates;
CREATE POLICY fwd_ship_tpl_delete
ON public.forwarder_shipping_templates
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP TRIGGER IF EXISTS trg_fwd_ship_tpl_updated_at ON public.forwarder_shipping_templates;
CREATE TRIGGER trg_fwd_ship_tpl_updated_at
BEFORE UPDATE ON public.forwarder_shipping_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();