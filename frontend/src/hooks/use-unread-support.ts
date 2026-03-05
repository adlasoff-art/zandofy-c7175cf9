import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/services/api-client";

export function useUnreadSupport() {
  const { user, session } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    async function fetchCount() {
      try {
        const data = await apiFetch<{ count: number }>("/api/support/unread-count", {
          token: session?.access_token ?? undefined,
        });
        setCount(data.count);
      } catch {
        setCount(0);
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [user, session?.access_token]);

  return count;
}
