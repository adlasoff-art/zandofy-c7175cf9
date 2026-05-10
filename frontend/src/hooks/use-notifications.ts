import { useState, useCallback, useEffect } from "react";
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
    // Liste limitée à 50 pour le panneau, mais COUNT exact pour le badge
    // (sinon le compteur plafonne et reste figé quand >50 non-lues existent).
    const [list, countRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, type, title, message, link, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
    ]);
    setNotifications((list.data || []) as Notification[]);
    setUnreadCount(countRes.count ?? 0);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Initial fetch + polling adaptatif (10s focus / 30s hors focus).
  useVisibilityAwareInterval(fetchNotifications, {
    activeMs: 10_000,
    hiddenMs: 30_000,
    enabled: !!user,
  });

  // Keep PWA app icon badge in sync with unread count (Android Chrome,
  // iOS 16.4+ installed PWA, Windows). Falls back silently on browsers
  // that don't support the Badging API.
  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (!nav) return;
    try {
      if ("setAppBadge" in nav) {
        if (unreadCount > 0) nav.setAppBadge(unreadCount);
        else nav.clearAppBadge?.();
      }
      if ("serviceWorker" in nav && nav.serviceWorker?.controller) {
        nav.serviceWorker.controller.postMessage({
          type: "ZANDOFY_SET_BADGE",
          count: unreadCount,
        });
      }
    } catch {
      // ignore — Badging API is best-effort
    }
  }, [unreadCount]);

  // Listen for push events from the SW so we refresh the unread count
  // immediately instead of waiting for the next polling tick.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "ZANDOFY_PUSH_RECEIVED") {
        fetchNotifications();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    setUnreadCount((c) => Math.max(0, c - 1));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    setUnreadCount(0);
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    await supabase.from("notifications").delete().eq("id", id);
    fetchNotifications();
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification };
}
