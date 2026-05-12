-- Lot R2 : enum app_role canonique (idempotent) + backfill rôles forwarder/operator
-- Sécurise la prod : `ADD VALUE IF NOT EXISTS` ne fait rien si les valeurs existent déjà.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'forwarder';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';

-- Backfill `operator` : tout propriétaire de delivery_operators doit avoir le rôle.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT do_.owner_user_id, 'operator'::public.app_role
FROM public.delivery_operators do_
WHERE do_.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = do_.owner_user_id AND ur.role = 'operator'::public.app_role
  );

-- Backfill `forwarder` : tout owner ou transporteur lié d'un forwarder doit avoir le rôle.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT u_id, 'forwarder'::public.app_role
FROM (
  SELECT owner_user_id AS u_id FROM public.forwarders WHERE owner_user_id IS NOT NULL
  UNION
  SELECT linked_transporter_user_id AS u_id FROM public.forwarders WHERE linked_transporter_user_id IS NOT NULL
) f
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = f.u_id AND ur.role = 'forwarder'::public.app_role
);