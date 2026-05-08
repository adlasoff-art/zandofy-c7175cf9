import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVisibilityAwareInterval } from "@/hooks/use-visibility-aware-interval";

/**
 * Compteur des messages non lus pour le user connecté.
 *
 * Anciennement basé sur Realtime (`postgres_changes` global sur `messages`),
 * ce qui contribuait massivement à `realtime.list_changes` (≈80 % du temps DB en prod).
 *
 * Maintenant : polling visibility-aware (30 s focus / 90 s hidden) — voir Lot 18C.
 * UX préservée : le badge se rafraîchit au focus de l'onglet et toutes les 30 s.
 */
export function useUnreadMessages() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) setCount(0);
  }, [user?.id]);

  const fetchCount = useCallback(async () => {
    if (!user?.id) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);

    if (!convs || convs.length === 0) {
      setCount(0);
      return;
    }

    const convIds = convs.map((c) => c.id);
    const { count: unread } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("is_read", false)
      .neq("sender_id", user.id);

    setCount(unread || 0);
  }, [user?.id]);

  useVisibilityAwareInterval(fetchCount, {
    activeMs: 30_000,
    hiddenMs: 90_000,
    enabled: !!user?.id,
  });

  return count;
}
