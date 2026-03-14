import {
  LayoutDashboard, Users, Image, FolderTree, Bell, Settings, ShieldCheck, Truck, Package, DollarSign, Store, PenLine, Crown, ScrollText, Heart, Coins, Ticket, Banknote, RotateCcw, AlertTriangle, ArrowLeftRight, Globe, Megaphone, Headphones, Layers, BarChart3, Mail,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useRoles } from "@/hooks/use-roles";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const adminItems = [
  { title: "Tableau de bord", url: "/admin", icon: LayoutDashboard },
  { title: "Utilisateurs", url: "/admin/users", icon: Users },
  { title: "Bannières & CMS", url: "/admin/cms", icon: Image },
  { title: "Catégories", url: "/admin/categories", icon: FolderTree },
  { title: "Types de variations", url: "/admin/variant-types", icon: Layers },
  { title: "Modération produits", url: "/admin/product-moderation", icon: ShieldCheck },
  { title: "Commandes", url: "/admin/orders", icon: Package },
  { title: "Support client", url: "/admin/support", icon: Headphones },
  { title: "Logistique", url: "/admin/logistics", icon: Truck },
  { title: "Tarification Fret", url: "/admin/shipping", icon: DollarSign },
  { title: "Demandes Vendeur", url: "/admin/vendor-applications", icon: Store },
  { title: "Noms de boutique", url: "/admin/store-names", icon: PenLine },
  { title: "Abonnements", url: "/admin/vendor-subscriptions", icon: Crown },
  { title: "Fidélité", url: "/admin/loyalty", icon: Heart },
  { title: "Audit Points", url: "/admin/points", icon: Coins },
  { title: "Coupons", url: "/admin/coupons", icon: Ticket },
  { title: "Retraits", url: "/admin/withdrawals", icon: Banknote },
  { title: "Retours", url: "/admin/returns", icon: RotateCcw },
  { title: "Litiges", url: "/admin/disputes", icon: AlertTriangle },
  { title: "Taux de change", url: "/admin/exchange-rates", icon: ArrowLeftRight },
  { title: "Paliers affiliation", url: "/admin/affiliate-tiers", icon: Crown },
  { title: "Référencement SEO", url: "/admin/seo", icon: Globe },
  { title: "Pays actifs", url: "/admin/countries", icon: Globe },
  { title: "Popups & Cookies", url: "/admin/popups", icon: Megaphone },
  { title: "Journal d'audit", url: "/admin/audit", icon: ScrollText },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
  { title: "Paramètres", url: "/admin/settings", icon: Settings },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin } = useRoles();
  const location = useLocation();

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="gap-2">
            <ShieldCheck size={16} className="text-primary" />
            {!collapsed && <span>{isAdmin ? "Administration" : "Gestion"}</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => {
                const isActive = item.url === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors",
                          isActive && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        <item.icon size={18} />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
