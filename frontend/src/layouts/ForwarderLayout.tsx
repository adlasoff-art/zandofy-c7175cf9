/**
 * ForwarderLayout — Affinage UX /forwarder/* (Phase B2.2)
 *
 * Layout dédié au dashboard transitaire (forwarder).
 * Identité visuelle : palette bleu profond fret international.
 * Tokens : --forwarder-* dans index.css.
 */
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  LayoutDashboard, FileText, Map, ArrowLeftRight, Settings, ChevronRight,
  AlertCircle, Loader2, ShieldAlert, ArrowLeft, Ship, Building2,
} from "lucide-react";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { to: "/forwarder",          label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/forwarder/profiles", label: "Tarifs",          icon: FileText },
  { to: "/forwarder/coverage", label: "Couverture",      icon: Map },
  { to: "/forwarder/handoffs", label: "Handoffs",        icon: ArrowLeftRight },
  { to: "/forwarder/settings", label: "Paramètres",      icon: Settings },
];

function ForwarderSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { forwarder } = useForwarderContext();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r"
      style={{
        ["--sidebar-background" as any]: "var(--forwarder-sidebar-bg)",
        ["--sidebar-foreground" as any]: "var(--forwarder-sidebar-fg)",
        ["--sidebar-primary" as any]: "var(--forwarder-sidebar-active)",
        ["--sidebar-primary-foreground" as any]: "var(--forwarder-primary-foreground)",
        ["--sidebar-accent" as any]: "var(--forwarder-sidebar-active)",
        ["--sidebar-accent-foreground" as any]: "var(--forwarder-primary-foreground)",
        ["--sidebar-border" as any]: "var(--forwarder-sidebar-border)",
        ["--sidebar-ring" as any]: "var(--forwarder-sidebar-active)",
      }}
    >
      <SidebarHeader className="border-b border-[hsl(var(--forwarder-sidebar-border))] p-3">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "var(--forwarder-gradient)" }}
          >
            <Ship size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate text-[hsl(var(--forwarder-sidebar-fg))]">
                {forwarder?.name ?? "Transitaire"}
              </p>
              <p className="text-[10px] text-[hsl(var(--forwarder-muted))] truncate">
                Espace fret international
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2 ${
                          isActive
                            ? "bg-[hsl(var(--forwarder-sidebar-active))]/15 text-[hsl(var(--forwarder-sidebar-active))] font-medium"
                            : "hover:bg-white/5"
                        }`
                      }
                    >
                      <item.icon size={16} />
                      {!collapsed && <span className="text-sm">{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-[hsl(var(--forwarder-sidebar-border))] p-2">
        <NavLink
          to="/"
          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[hsl(var(--forwarder-muted))] hover:bg-white/5 hover:text-[hsl(var(--forwarder-sidebar-fg))]"
        >
          <ArrowLeft size={12} />
          {!collapsed && <span>Retour à Zandofy</span>}
        </NavLink>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function ForwarderLayout() {
  const { forwarder, loading, isApproved, isPending, isRejected, isSuspended } = useForwarderContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !forwarder && location.pathname !== "/become-forwarder") {
      navigate("/become-forwarder", { replace: true });
    }
  }, [loading, forwarder, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!forwarder) return null;

  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-card rounded-lg border border-border p-6 text-center">
          {isPending && (
            <>
              <AlertCircle className="mx-auto mb-3 text-amber-500" size={40} />
              <h1 className="text-lg font-bold text-foreground mb-2">Demande en cours d'examen</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Votre dossier transitaire a été soumis. L'équipe Zandofy l'examinera sous 48-72h ouvrées.
              </p>
            </>
          )}
          {isRejected && (
            <>
              <ShieldAlert className="mx-auto mb-3 text-destructive" size={40} />
              <h1 className="text-lg font-bold text-foreground mb-2">Dossier refusé</h1>
              {forwarder.rejection_reason && (
                <p className="text-xs text-muted-foreground italic mb-4">
                  Motif : {forwarder.rejection_reason}
                </p>
              )}
            </>
          )}
          {isSuspended && (
            <>
              <ShieldAlert className="mx-auto mb-3 text-destructive" size={40} />
              <h1 className="text-lg font-bold text-foreground mb-2">Compte suspendu</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Votre compte transitaire est temporairement suspendu. Contactez le support.
              </p>
            </>
          )}
          <Button variant="outline" onClick={() => navigate("/")}>Retour à l'accueil</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div
        className="min-h-screen flex w-full"
        style={{ background: "hsl(var(--forwarder-bg))" }}
      >
        <ForwarderSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-14 border-b flex items-center justify-between px-4 sticky top-0 z-10"
            style={{
              background: "hsl(var(--forwarder-surface))",
              borderColor: "hsl(var(--forwarder-border))",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-[hsl(var(--forwarder-muted))]" />
              <div className="hidden md:flex items-center gap-2 min-w-0">
                <Building2 size={14} className="text-[hsl(var(--forwarder-primary))] shrink-0" />
                <span className="text-sm font-semibold truncate text-foreground">
                  {forwarder.name}
                </span>
                {forwarder.headquarters_city && (
                  <>
                    <ChevronRight size={12} className="text-[hsl(var(--forwarder-muted))] shrink-0" />
                    <span className="text-xs text-[hsl(var(--forwarder-muted))] truncate">
                      {forwarder.headquarters_city}
                      {forwarder.headquarters_country && `, ${forwarder.headquarters_country}`}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {(forwarder.supported_modes || []).slice(0, 4).map((m) => (
                <span
                  key={m}
                  className="hidden sm:inline px-2 py-0.5 rounded-full bg-[hsl(var(--forwarder-primary))]/10 text-[hsl(var(--forwarder-primary))] font-medium uppercase tracking-wide"
                >
                  {m}
                </span>
              ))}
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>

          <nav
            className="md:hidden border-t fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5"
            style={{
              background: "hsl(var(--forwarder-surface))",
              borderColor: "hsl(var(--forwarder-border))",
            }}
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                    isActive
                      ? "text-[hsl(var(--forwarder-primary))]"
                      : "text-[hsl(var(--forwarder-muted))]"
                  }`
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="h-14 md:hidden" />
        </div>
      </div>
    </SidebarProvider>
  );
}