import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Extend ServiceWorkerRegistration for Push API
interface PushServiceWorkerRegistration extends ServiceWorkerRegistration {
  pushManager: PushManager;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
  }, []);

  // Check existing subscription
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then((registration) => {
      const reg = registration as any;
      if (reg.pushManager) {
        reg.pushManager.getSubscription().then((sub: any) => {
          setIsSubscribed(!!sub);
        });
      }
    });
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!user || !supported) return false;
    setLoading(true);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLoading(false);
        return false;
      }

      // Get VAPID public key from edge function
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/push-notifications?action=vapid-public-key`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const { publicKey } = await res.json();
      if (!publicKey) {
        console.warn("VAPID public key not configured");
        setLoading(false);
        return false;
      }

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const reg = registration as any;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to backend
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/push-notifications?action=subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        }
      );

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Push subscription error:", err);
      setLoading(false);
      return false;
    }
  }, [user, supported]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const reg = registration as any;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe error:", err);
    }
  }, []);

  return { supported, permission, isSubscribed, loading, subscribe, unsubscribe };
}
