import { useState, useEffect, useCallback } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Trigger background sync if supported
        if ("serviceWorker" in navigator && "SyncManager" in window) {
          navigator.serviceWorker.ready.then((reg) => {
            (reg as any).sync?.register("sync-cart").catch(() => {});
          });
        }
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [wasOffline]);

  // Queue a failed request for background sync
  const queueForSync = useCallback(async (url: string, body: any) => {
    try {
      const cache = await caches.open("zandofy-pending");
      const response = new Response(JSON.stringify(body));
      await cache.put(new Request(url), response);

      if ("serviceWorker" in navigator && "SyncManager" in window) {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync?.register("sync-cart");
      }
    } catch (e) {
      console.warn("Failed to queue for sync:", e);
    }
  }, []);

  return { isOnline, wasOffline, queueForSync };
}
