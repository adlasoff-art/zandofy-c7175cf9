
-- Add gender and date_of_birth columns to profiles
ALTER TABLE public.profiles
ADD COLUMN gender text DEFAULT NULL,
ADD COLUMN date_of_birth date DEFAULT NULL;
