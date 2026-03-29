
-- Add presence tracking columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;

-- RPC: update user presence (heartbeat)
CREATE OR REPLACE FUNCTION public.update_user_presence(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET is_online = true, last_seen_at = now()
  WHERE id = p_user_id AND id = auth.uid();
END;
$$;

-- RPC: set user offline
CREATE OR REPLACE FUNCTION public.set_user_offline(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET is_online = false
  WHERE id = p_user_id AND id = auth.uid();
END;
$$;
