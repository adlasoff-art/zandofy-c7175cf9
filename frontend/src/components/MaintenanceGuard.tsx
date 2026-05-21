import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MaintenancePage } from "@/components/MaintenancePage";
import { useAuth } from "@/contexts/AuthContext";
import { useMaintenanceMode } from "@/hooks/use-maintenance-mode";

/**
 * MaintenanceGuard
 *
 * Source unique de vérité : `platform_settings.maintenance_mode` chargé via le
 * bootstrap (1 requête CDN-cachée pour toute l'app). Plus de localStorage (qui
 * cassait en navigation privée selon les navigateurs), plus de requête dupliquée.
 *
 * Si le bootstrap n'a pas encore répondu, on affiche un skeleton vide pendant
 * un court instant plutôt que de flasher l'app puis basculer sur la page
 * maintenance — sinon l'utilisateur peut cliquer un lien avant le 2e render.
 */
export function MaintenanceGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: config, isLoading } = useMaintenanceMode();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  // Check admin role for bypass
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsAdmin(!!data);
        setAdminChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isMaintenanceActive =
    !!config?.enabled &&
    !!config.end_time &&
    new Date(config.end_time).getTime() > Date.now();

  // While bootstrap is in-flight, hold rendering briefly to avoid flashing the
  // app then switching to the maintenance page. We only block on the first
  // load (isLoading=true & no data yet) — subsequent refetches don't gate UI.
  if (isLoading && config == null) {
    return <div aria-hidden="true" style={{ minHeight: "100vh", background: "hsl(var(--background))" }} />;
  }

  // Maintenance OFF or expired → render the app
  if (!isMaintenanceActive) {
    return <>{children}</>;
  }

  // Maintenance ON: admins bypass (wait for the role check to complete to
  // avoid kicking an admin out for one frame)
  if (user && !adminChecked) {
    return <div aria-hidden="true" style={{ minHeight: "100vh", background: "hsl(var(--background))" }} />;
  }
  if (isAdmin) return <>{children}</>;

  return (
    <MaintenancePage
      title={config!.title}
      message={config!.message}
      endTime={config!.end_time}
    />
  );
}
