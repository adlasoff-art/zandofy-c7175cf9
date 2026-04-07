import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fromTable } from "@/lib/supabase-helpers";

export function useUnreadSupport() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    async function fetchCount() {
      try {
        // Get user's open tickets
        const { data: tickets } = await fromTable("support_tickets")
          .select("id")
          .eq("user_id", user!.id)
          .in("status", ["open", "in_progress"]);

        if (!tickets || tickets.length === 0) {
          setCount(0);
          return;
        }

        // Count staff messages that are newer than user's last message per ticket
        let unread = 0;
        for (const ticket of tickets) {
          const { data: msgs } = await fromTable("support_messages")
            .select("id, is_staff, created_at")
            .eq("ticket_id", ticket.id)
            .order("created_at", { ascending: false })
            .limit(10);

          if (!msgs) continue;
          // Find last user message
          const lastUserMsg = msgs.find((m: any) => !m.is_staff);
          const lastUserTime = lastUserMsg?.created_at || "1970-01-01";
          // Count staff messages after last user message
          const staffAfter = msgs.filter((m: any) => m.is_staff && m.created_at > lastUserTime);
          unread += staffAfter.length;
        }
        setCount(unread);
      } catch {
        setCount(0);
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return count;
}
