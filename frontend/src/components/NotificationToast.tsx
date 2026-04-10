import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound, setAppBadge } from "@/lib/notification-sounds";

export function NotificationListener() {
  const { user } = useAuth();
  const hasInteracted = useRef(false);
  const lastCountRef = useRef(0);

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

  // Poll for new notifications (replaces Realtime for security)
  useEffect(() => {
    if (!user) return;

    const checkNotifications = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      const newCount = count || 0;
      // Play sound if count increased
      if (newCount > lastCountRef.current && lastCountRef.current > 0 && hasInteracted.current) {
        playNotificationSound();
      }
      lastCountRef.current = newCount;
      setAppBadge(newCount);
    };

    // Initial check
    checkNotifications();

    // Poll every 10s
    const interval = setInterval(checkNotifications, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return null;
}
