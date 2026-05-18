import { useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { playNotificationSound, playFailureSound, setAppBadge } from "@/lib/notification-sounds";

/**
 * Joue un son et met à jour le badge OS quand le compteur non-lu augmente.
 * Réutilise le poller centralisé `useNotifications` (10s focus / 30s hidden) au lieu
 * de lancer un second polling indépendant — réduction du Disk IO sur la table notifications.
 */
export function NotificationListener() {
  const { unreadCount, notifications } = useNotifications();
  const hasInteracted = useRef(false);
  const lastCountRef = useRef<number | null>(null);

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

  useEffect(() => {
    const prev = lastCountRef.current;
    if (prev !== null && unreadCount > prev && hasInteracted.current) {
      // Choisir le son selon la nouvelle notification la plus récente :
      //  - "Paiement échoué" / "Paiement expiré" -> son d'échec (court, descendant)
      //  - tout le reste -> son neutre (chime ascendant)
      const latest = notifications[0];
      const t = (latest?.title || "").toLowerCase();
      const isFailure =
        t.includes("échoué") ||
        t.includes("expir") ||
        t.includes("failed") ||
        t.includes("annul");
      if (isFailure) playFailureSound();
      else playNotificationSound();
    }
    lastCountRef.current = unreadCount;
    setAppBadge(unreadCount);
  }, [unreadCount, notifications]);

  return null;
}
