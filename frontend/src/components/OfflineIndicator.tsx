import { useNetworkStatus } from "@/hooks/use-network-status";
import { WifiOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all duration-300 ${
        isOnline
          ? "bg-primary text-primary-foreground"
          : "bg-destructive text-destructive-foreground"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi size={14} />
          <span>Connexion rétablie — synchronisation en cours…</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Hors ligne — certaines fonctionnalités sont limitées</span>
        </>
      )}
    </div>
  );
}
