import { useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MaintenancePage } from "@/components/MaintenancePage";
import { useAuth } from "@/contexts/AuthContext";

interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  end_time: string; // ISO
}

export function MaintenanceGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<MaintenanceConfig | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(() => {
    // Use cached maintenance config for instant display
    try {
      const cached = localStorage.getItem("maintenance_config");
      if (cached) {
        const parsed = JSON.parse(cached) as MaintenanceConfig;
        if (parsed.enabled && new Date(parsed.end_time).getTime() > Date.now()) {
          return false; // will use cached config
        }
      }
    } catch {}
    return true; // no active maintenance cached, show app immediately
  });

  useEffect(() => {
    // Fetch maintenance settings in background
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const mc = data.value as unknown as MaintenanceConfig;
          setConfig(mc);
          localStorage.setItem("maintenance_config", JSON.stringify(mc));
        } else {
          localStorage.removeItem("maintenance_config");
        }
        setChecked(true);
      });
  }, []);

  // Check if current user is admin
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data);
      });
  }, [user]);

  // While checking, try cached config; if no active maintenance cached, render children immediately
  if (!checked) {
    try {
      const cached = localStorage.getItem("maintenance_config");
      if (cached) {
        const parsed = JSON.parse(cached) as MaintenanceConfig;
        if (parsed.enabled && new Date(parsed.end_time).getTime() > Date.now()) {
          if (!isAdmin) {
            return <MaintenancePage title={parsed.title} message={parsed.message} endTime={parsed.end_time} />;
          }
        }
      }
    } catch {}
    return <>{children}</>;
  }

  // Check if maintenance is active
  if (config?.enabled) {
    const endTime = new Date(config.end_time).getTime();
    const now = Date.now();
    const isStillActive = endTime > now;

    if (isStillActive) {
      // Admin bypass via role
      if (isAdmin) return <>{children}</>;

      // Session bypass (secret code entered on maintenance page)
      if (sessionStorage.getItem("maintenance_bypass") === "true") {
        return <>{children}</>;
      }

      return (
        <MaintenancePage
          title={config.title}
          message={config.message}
          endTime={config.end_time}
        />
      );
    }
  }

  return <>{children}</>;
}
