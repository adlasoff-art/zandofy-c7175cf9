
-- 1. Add new vendor_tier enum values: intermediate and factory
ALTER TYPE public.vendor_tier ADD VALUE IF NOT EXISTS 'intermediate' AFTER 'beginner';
ALTER TYPE public.vendor_tier ADD VALUE IF NOT EXISTS 'factory' AFTER 'grand_supplier';
