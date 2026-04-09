import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "vendor" | "shipper" | "rider";

export function useRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedUserId = useRef<string | null>(null);

  const fetchRoles = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.warn("[useRoles] Failed to fetch roles:", error.message);
        // Do NOT mark as fetched — allow retry on next render
        setRoles([]);
        setLoading(false);
        return;
      }

      setRoles(data.map((r) => r.role as AppRole));
      fetchedUserId.current = userId;
      setLoading(false);
    } catch (e) {
      console.warn("[useRoles] Unexpected error:", e);
      setRoles([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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

    // Avoid re-fetch if already successfully fetched for this user
    if (fetchedUserId.current === user.id) return;

    fetchRoles(user.id);
  }, [user, authLoading, fetchRoles]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager");
  const isVendor = hasRole("vendor");
  const isShipper = hasRole("shipper");
  const isRider = hasRole("rider");
  const isStaff = isAdmin || isManager;

  return { roles, loading, hasRole, isAdmin, isManager, isVendor, isShipper, isRider, isStaff };
}
