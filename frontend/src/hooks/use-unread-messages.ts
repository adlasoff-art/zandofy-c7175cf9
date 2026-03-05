import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    async function fetchCount() {
      // Get user's conversation ids
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user!.id);

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
        .neq("sender_id", user!.id);

      setCount(unread || 0);
    }

    fetchCount();

    // Subscribe to new messages for realtime count
    const channel = supabase
      .channel("unread-counter")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => fetchCount()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}
