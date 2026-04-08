
-- Function: is any member (owner or active collaborator) online?
CREATE OR REPLACE FUNCTION public.compute_store_online_status(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.is_online = true
      AND p.last_seen_at > now() - interval '2 minutes'
      AND (
        -- Owner
        p.id = (SELECT owner_id FROM public.stores WHERE id = p_store_id)
        OR
        -- Active collaborator
        p.id IN (
          SELECT sc.user_id FROM public.store_collaborators sc
          WHERE sc.store_id = p_store_id AND sc.status = 'active'
        )
      )
  );
$$;

-- Function to refresh a store's online status from member presence
CREATE OR REPLACE FUNCTION public.refresh_store_online_status(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visible boolean;
  v_member_online boolean;
BEGIN
  SELECT COALESCE(presence_visible, true) INTO v_visible
  FROM public.stores WHERE id = p_store_id;

  IF v_visible = false THEN
    UPDATE public.stores SET is_online = false WHERE id = p_store_id;
    RETURN;
  END IF;

  SELECT public.compute_store_online_status(p_store_id) INTO v_member_online;
  
  UPDATE public.stores
  SET is_online = v_member_online,
      last_seen_at = CASE WHEN v_member_online THEN now() ELSE last_seen_at END
  WHERE id = p_store_id;
END;
$$;

-- Rewrite update_store_presence to refresh from member status
CREATE OR REPLACE FUNCTION public.update_store_presence(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First ensure the calling user's own presence is fresh
  UPDATE public.profiles
  SET is_online = true, last_seen_at = now()
  WHERE id = auth.uid();

  -- Then refresh the store status from all members
  PERFORM public.refresh_store_online_status(p_store_id);
END;
$$;

-- Rewrite set_store_offline to recalculate
CREATE OR REPLACE FUNCTION public.set_store_offline(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark calling user offline
  UPDATE public.profiles
  SET is_online = false
  WHERE id = auth.uid();

  -- Recalculate store status (another member may still be online)
  PERFORM public.refresh_store_online_status(p_store_id);
END;
$$;
