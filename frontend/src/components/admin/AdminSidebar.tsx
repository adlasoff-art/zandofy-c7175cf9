import {
  LayoutDashboard, Users, Image, FolderTree, Bell, Settings, ShieldCheck, Truck, Package, DollarSign, Store, PenLine, Crown, ScrollText, Heart, Coins, Ticket, Banknote, RotateCcw, AlertTriangle, ArrowLeftRight, Globe, Megaphone, Headphones, Layers, BarChart3, Mail, User, Receipt, Star, MapPin, Zap, Bug, PackageSearch,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useRoles } from "@/hooks/use-roles";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

interface SidebarItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

interface SidebarSection {
  label: string;
  icon: React.ElementType;
  items: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
  {
    label: "Opérations",
    icon: Package,
    items: [
      { title: "Tableau de bord", url: "/admin", icon: LayoutDashboard },
      { title: "Commandes", url: "/admin/orders", icon: Package },
      { title: "Modération produits", url: "/admin/product-moderation", icon: ShieldCheck },
      { title: "Modération avis", url: "/admin/review-moderation", icon: Star },
      { title: "Demandes produits", url: "/admin/sourcing", icon: PackageSearch },
    ],
  },
  {
    label: "Ventes & Marketing",
    icon: Megaphone,
    items: [
      { title: "Coupons", url: "/admin/coupons", icon: Ticket },
      { title: "Mises en avant", url: "/admin/featured-placements", icon: Megaphone },
      { title: "Popups & Cookies", url: "/admin/popups", icon: Megaphone },
    ],
  },
  {
    label: "Logistique",
    icon: Truck,
    items: [
      { title: "Logistique", url: "/admin/logistics", icon: Truck },
      { title: "Transitaires", url: "/admin/forwarders", icon: Truck },
      { title: "Opérateurs livraison", url: "/admin/operators", icon: Truck },
      { title: "Performance opérateurs", url: "/admin/operators-performance", icon: Truck },
      { title: "Quotas opérateurs", url: "/admin/operator-quota-requests", icon: Users },
      { title: "Plafonds tarifaires", url: "/admin/operator-rate-caps", icon: DollarSign },
      { title: "Tarifs à modérer", url: "/admin/operator-rates-pending", icon: DollarSign },
      { title: "Tarification Fret", url: "/admin/shipping", icon: DollarSign },
      { title: "Plans de livraison", url: "/admin/delivery-plans", icon: Truck },
      { title: "Zones géographiques", url: "/admin/geography", icon: MapPin },
      { title: "Pays actifs", url: "/admin/countries", icon: Globe },
    ],
  },
  {
    label: "Utilisateurs & Vendeurs",
    icon: Users,
    items: [
      { title: "Utilisateurs", url: "/admin/users", icon: Users },
      { title: "Demandes Vendeur", url: "/admin/vendor-applications", icon: Store },
      { title: "Noms de boutique", url: "/admin/store-names", icon: PenLine },
      { title: "Modération boutiques", url: "/admin/store-moderation", icon: ShieldCheck },
      { title: "Transferts boutiques", url: "/admin/store-transfers", icon: ArrowLeftRight },
      { title: "Modifications boutiques", url: "/admin/store-change-requests", icon: PenLine },
      { title: "Abonnements", url: "/admin/vendor-subscriptions", icon: Crown },
      { title: "Plans de services", url: "/admin/service-plans", icon: DollarSign },
      { title: "Packages services", url: "/admin/service-packages", icon: Package },
      { title: "Tarification boutiques", url: "/admin/vendor-pricing", icon: DollarSign },
      { title: "Vérification KYC", url: "/admin/kyc", icon: ShieldCheck },
      { title: "Comptabilité vendeurs", url: "/admin/vendor-accounting", icon: Receipt },
      { title: "Retraits", url: "/admin/withdrawals", icon: Banknote },
    ],
  },
  {
    label: "Fidélité & Points",
    icon: Heart,
    items: [
      { title: "Fidélité", url: "/admin/loyalty", icon: Heart },
      { title: "Audit Points", url: "/admin/points", icon: Coins },
      { title: "Paliers affiliation", url: "/admin/affiliate-tiers", icon: Crown },
    ],
  },
  {
    label: "Finance",
    icon: DollarSign,
    items: [
      { title: "Taux de change", url: "/admin/exchange-rates", icon: ArrowLeftRight },
      { title: "Retours", url: "/admin/returns", icon: RotateCcw },
      { title: "Litiges", url: "/admin/disputes", icon: AlertTriangle },
    ],
  },
  {
    label: "CMS & Contenu",
    icon: Image,
    items: [
      { title: "Bannières & CMS", url: "/admin/cms", icon: Image },
      { title: "Catégories", url: "/admin/categories", icon: FolderTree },
      { title: "Types de variations", url: "/admin/variant-types", icon: Layers },
      { title: "Templates Email", url: "/admin/email-templates", icon: Mail },
      { title: "Référencement SEO", url: "/admin/seo", icon: Globe },
      { title: "Plateformes fournisseurs", url: "/admin/supplier-platforms", icon: Globe },
    ],
  },
  {
    label: "Système",
    icon: Settings,
    items: [
      { title: "Support client", url: "/admin/support", icon: Headphones },
      { title: "Rapports d'erreurs", url: "/admin/error-reports", icon: Bug },
      { title: "Journal d'audit", url: "/admin/audit", icon: ScrollText },
      { title: "Notifications", url: "/admin/notifications", icon: Bell },
      { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
      { title: "Paramètres", url: "/admin/settings", icon: Settings },
    ],
  },
];

function isActiveInSection(section: SidebarSection, pathname: string): boolean {
  return section.items.some((item) =>
    item.url === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(item.url)
  );
}

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin } = useRoles();
  const { user } = useAuth();
  const location = useLocation();

  const { data: profile } = useQuery({
    queryKey: ["admin-sidebar-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url, email")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const displayName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "Administrateur";

  // Track which sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Initialize open state based on active route
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    sidebarSections.forEach((section) => {
      initial[section.label] = isActiveInSection(section, location.pathname);
    });
    setOpenSections(initial);
  }, []); // Only on mount

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        {/* Logo + version */}
        <div className={cn("flex items-center gap-2.5 px-3 py-3 border-b border-border", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">Z</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Zandofy</p>
              <p className="text-[10px] text-muted-foreground">v1.0.0-beta</p>
            </div>
          )}
        </div>

        {sidebarSections.map((section) => {
          const isOpen = openSections[section.label] ?? false;
          const hasActive = isActiveInSection(section, location.pathname);

          if (collapsed) {
            // In collapsed mode, just show icons
            return (
              <SidebarGroup key={section.label}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const isActive = item.url === "/admin"
                        ? location.pathname === "/admin"
                        : location.pathname.startsWith(item.url);
                      return (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild>
                            <Link
                              to={item.url}
                              className={cn(
                                "flex items-center justify-center px-2 py-2 rounded-md text-muted-foreground hover:bg-muted/50 transition-colors",
                                isActive && "bg-primary/10 text-primary"
                              )}
                              title={item.title}
                            >
                              <item.icon size={18} />
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <Collapsible key={section.label} open={isOpen} onOpenChange={() => toggleSection(section.label)}>
              <CollapsibleTrigger className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none",
                hasActive && "text-primary"
              )}>
                <section.icon size={14} />
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronRight size={12} className={cn("transition-transform", isOpen && "rotate-90")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenu className="pl-2">
                  {section.items.map((item) => {
                    const isActive = item.url === "/admin"
                      ? location.pathname === "/admin"
                      : location.pathname.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <Link
                            to={item.url}
                            className={cn(
                              "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors",
                              isActive && "bg-primary/10 text-primary font-medium"
                            )}
                          >
                            <item.icon size={16} />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
