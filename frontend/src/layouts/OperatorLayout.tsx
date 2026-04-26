/**
 * OperatorLayout — Lot 11B Phase B2
 *
 * Layout dédié au dashboard opérateur (entreprise de livraison).
 * Identité visuelle distincte : palette froide bleu/cyan logistique,
 * sidebar "centre de contrôle flotte", header avec quota riders.
 *
 * Tokens : --operator-* dans index.css.
 */
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  LayoutDashboard, Truck, Users, MapPin, Banknote, Settings, ChevronRight,
  AlertCircle, Loader2, ShieldAlert, ArrowLeft, Building2,
} from "lucide-react";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { to: "/operator",          label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/operator/orders",   label: "Courses",         icon: Truck },
  { to: "/operator/fleet",    label: "Flotte",          icon: Users },
  { to: "/operator/coverage", label: "Couverture",      icon: MapPin },
  { to: "/operator/rates",    label: "Tarifs",          icon: Banknote },
  { to: "/operator/billing",  label: "Facturation",     icon: Banknote },
  { to: "/operator/settings", label: "Paramètres",      icon: Settings },
];

function OperatorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { operator } = useOperatorContext();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r"
      style={{
        // Inject operator palette into sidebar tokens for this scope
        ["--sidebar-background" as any]: "var(--operator-sidebar-bg)",
        ["--sidebar-foreground" as any]: "var(--operator-sidebar-fg)",
        ["--sidebar-primary" as any]: "var(--operator-sidebar-active)",
        ["--sidebar-primary-foreground" as any]: "var(--operator-primary-foreground)",
        ["--sidebar-accent" as any]: "var(--operator-sidebar-active)",
        ["--sidebar-accent-foreground" as any]: "var(--operator-primary-foreground)",
        ["--sidebar-border" as any]: "var(--operator-sidebar-border)",
        ["--sidebar-ring" as any]: "var(--operator-sidebar-active)",
      }}
    >
      <SidebarHeader className="border-b border-[hsl(var(--operator-sidebar-border))] p-3">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "var(--operator-gradient)" }}
          >
            <Truck size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate text-[hsl(var(--operator-sidebar-fg))]">
                {operator?.company_name ?? "Opérateur"}
              </p>
              <p className="text-[10px] text-[hsl(var(--operator-muted))] truncate">
                Centre de contrôle flotte
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
                            ? "bg-[hsl(var(--operator-sidebar-active))]/15 text-[hsl(var(--operator-sidebar-active))] font-medium"
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

      <SidebarFooter className="border-t border-[hsl(var(--operator-sidebar-border))] p-2">
        <NavLink
          to="/"
          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[hsl(var(--operator-muted))] hover:bg-white/5 hover:text-[hsl(var(--operator-sidebar-fg))]"
        >
          <ArrowLeft size={12} />
          {!collapsed && <span>Retour à Zandofy</span>}
        </NavLink>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function OperatorLayout() {
  const { operator, loading, isApproved, isPending, isRejected, isSuspended } = useOperatorContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect non-operators (no row) to onboarding
  useEffect(() => {
    if (!loading && !operator && location.pathname !== "/become-operator") {
      navigate("/become-operator", { replace: true });
    }
  }, [loading, operator, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!operator) return null;

  // Status gating
  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-card rounded-lg border border-border p-6 text-center">
          {isPending && (
            <>
              <AlertCircle className="mx-auto mb-3 text-amber-500" size={40} />
              <h1 className="text-lg font-bold text-foreground mb-2">Demande en cours d'examen</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Votre demande d'enregistrement comme opérateur de livraison a été reçue.
                L'équipe Zandofy l'examinera sous 48h ouvrées.
              </p>
            </>
          )}
          {isRejected && (
            <>
              <ShieldAlert className="mx-auto mb-3 text-destructive" size={40} />
              <h1 className="text-lg font-bold text-foreground mb-2">Demande refusée</h1>
              <p className="text-sm text-muted-foreground mb-2">
                Votre demande n'a pas été acceptée.
              </p>
              {operator.rejection_reason && (
                <p className="text-xs text-muted-foreground italic mb-4">
                  Motif : {operator.rejection_reason}
                </p>
              )}
            </>
          )}
          {isSuspended && (
            <>
              <ShieldAlert className="mx-auto mb-3 text-destructive" size={40} />
              <h1 className="text-lg font-bold text-foreground mb-2">Compte suspendu</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Votre compte opérateur est temporairement suspendu.
                Contactez le support pour plus d'informations.
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
        style={{ background: "hsl(var(--operator-bg))" }}
      >
        <OperatorSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header
            className="h-14 border-b flex items-center justify-between px-4 sticky top-0 z-10"
            style={{
              background: "hsl(var(--operator-surface))",
              borderColor: "hsl(var(--operator-border))",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-[hsl(var(--operator-muted))]" />
              <div className="hidden md:flex items-center gap-2 min-w-0">
                <Building2 size={14} className="text-[hsl(var(--operator-primary))] shrink-0" />
                <span className="text-sm font-semibold truncate text-foreground">
                  {operator.company_name}
                </span>
                <ChevronRight size={12} className="text-[hsl(var(--operator-muted))] shrink-0" />
                <span className="text-xs text-[hsl(var(--operator-muted))] truncate">
                  {operator.headquarters_city}, {operator.headquarters_country}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--operator-primary))]/10 text-[hsl(var(--operator-primary))] font-medium">
                <Users size={11} />
                <span>Quota : {operator.max_riders} rider{operator.max_riders > 1 ? "s" : ""}</span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--operator-success))]/10 text-[hsl(var(--operator-success))] font-medium">
                <span>{operator.platform_commission_pct}% commission</span>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>

          {/* Mobile bottom nav (5 items) */}
          <nav
            className="md:hidden border-t fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5"
            style={{
              background: "hsl(var(--operator-surface))",
              borderColor: "hsl(var(--operator-border))",
            }}
          >
            {NAV_ITEMS.slice(0, 5).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                    isActive
                      ? "text-[hsl(var(--operator-primary))]"
                      : "text-[hsl(var(--operator-muted))]"
                  }`
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          {/* Spacer for mobile bottom nav */}
          <div className="h-14 md:hidden" />
        </div>
      </div>
    </SidebarProvider>
  );
}