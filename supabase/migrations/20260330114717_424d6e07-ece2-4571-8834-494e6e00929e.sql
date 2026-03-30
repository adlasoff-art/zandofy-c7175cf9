
-- Ajout des champs géographiques sur saved_addresses
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS commune text DEFAULT NULL;
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS quartier text DEFAULT NULL;
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS province text DEFAULT NULL;

-- Ajout des champs géographiques sur orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_province text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_commune text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_quartier text DEFAULT NULL;
