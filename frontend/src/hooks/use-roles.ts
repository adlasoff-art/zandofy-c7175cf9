import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "vendor" | "shipper" | "rider";

export function useRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    // Keep loading true while auth is still resolving
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setRoles([]);
      setLoading(false);
      fetchedUserId.current = null;
      return;
    }

    // Avoid re-fetch if already fetched for this user
    if (fetchedUserId.current === user.id) return;

    setLoading(true);

    async function fetchRoles() {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (!error && data) {
        setRoles(data.map((r) => r.role as AppRole));
      }
      fetchedUserId.current = user!.id;
      setLoading(false);
    }

    fetchRoles();
  }, [user, authLoading]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager");
  const isVendor = hasRole("vendor");
  const isShipper = hasRole("shipper");
  const isRider = hasRole("rider");
  const isStaff = isAdmin || isManager;

  return { roles, loading, hasRole, isAdmin, isManager, isVendor, isShipper, isRider, isStaff };
}
