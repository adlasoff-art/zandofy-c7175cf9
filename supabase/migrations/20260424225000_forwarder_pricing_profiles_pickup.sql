ALTER TABLE public.forwarder_pricing_profiles
  ADD COLUMN IF NOT EXISTS pickup_address text NULL,
  ADD COLUMN IF NOT EXISTS pickup_email text NULL;

COMMENT ON COLUMN public.forwarder_pricing_profiles.pickup_address IS 'Adresse de retrait/dépôt des colis pour ce profil (ville/pays). Affichée au tooltip côté checkout et dans le panneau logistique.';
COMMENT ON COLUMN public.forwarder_pricing_profiles.pickup_email IS 'Email de contact dédié au pickup (optionnel, fallback sur forwarders.contact_email).';