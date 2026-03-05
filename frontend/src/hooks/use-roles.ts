import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "vendor" | "shipper" | "rider";

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    async function fetchRoles() {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (!error && data) {
        setRoles(data.map((r) => r.role as AppRole));
      }
      setLoading(false);
    }

    fetchRoles();
  }, [user]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager");
  const isVendor = hasRole("vendor");
  const isShipper = hasRole("shipper");
  const isRider = hasRole("rider");
  const isStaff = isAdmin || isManager;

  return { roles, loading, hasRole, isAdmin, isManager, isVendor, isShipper, isRider, isStaff };
}
