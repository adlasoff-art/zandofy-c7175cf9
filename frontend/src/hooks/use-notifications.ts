import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVisibilityAwareInterval } from "@/hooks/use-visibility-aware-interval";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    // Colonnes ciblées (au lieu de select *) pour réduire le Disk IO sur la table notifications.
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, message, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const items = (data || []) as Notification[];
    setNotifications(items);
    setUnreadCount(items.filter((n) => !n.is_read).length);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Initial fetch + polling adaptatif (10s focus / 30s hors focus).
  useVisibilityAwareInterval(fetchNotifications, {
    activeMs: 10_000,
    hiddenMs: 30_000,
    enabled: !!user,
  });

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    fetchNotifications();
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification };
}
