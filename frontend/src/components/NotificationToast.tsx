import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { playNotificationSound, setAppBadge } from "@/lib/notification-sounds";

export function NotificationListener() {
  const { user } = useAuth();
  const hasInteracted = useRef(false);

  // Track first user interaction to unlock audio
  useEffect(() => {
    const unlock = () => { hasInteracted.current = true; };
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Listen for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notif-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { sender_id: string; content: string };
          if (msg.sender_id !== user.id) {
            if (hasInteracted.current) playNotificationSound();
            toast("Nouveau message", {
              description: msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content,
              icon: <MessageCircle size={16} />,
              action: {
                label: "Voir",
                onClick: () => window.location.assign("/messages"),
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Listen for new notifications → play sound + update app badge
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notif-sound-badge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          if (hasInteracted.current) playNotificationSound();
          // Update badge with current unread count
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_read", false)
            .then(({ count }) => {
              setAppBadge(count || 0);
            });
        }
      )
      .subscribe();

    // Set initial badge count
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(({ count }) => {
        setAppBadge(count || 0);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
