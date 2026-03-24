import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { useI18n } from "@/contexts/I18nContext";
import {
  LayoutDashboard,
  Store,
  Truck,
  Bike,
  ShieldCheck,
  LogOut,
  ChevronRight,
  User,
  KeyRound,
  MapPin,
  Bell,
  MessageSquare,
  Heart,
  Award,
  Users,
  BadgeCheck,
  FileText,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function MobileAccountMenu() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, isManager, isVendor, isShipper, isRider, isStaff, loading: rolesLoading } = useRoles();
  const { t } = useI18n();

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) {
    return null; // handled by nav redirect to /auth
  }

  const email = user.email ?? "";
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const firstName = meta.first_name || meta.full_name?.split(" ")[0] || "";
  const lastName = meta.last_name || "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email;
  const initials = (firstName?.[0] ?? email?.[0] ?? "U").toUpperCase();

  const roleLinks: { show: boolean; to: string; icon: React.ElementType; label: string; color: string }[] = [
    { show: isStaff, to: "/admin", icon: ShieldCheck, label: "Administration", color: "text-red-500" },
    { show: isVendor, to: "/vendor", icon: Store, label: "Espace Vendeur", color: "text-emerald-500" },
    { show: isShipper, to: "/shipper", icon: Truck, label: "Espace Expéditeur", color: "text-blue-500" },
    { show: isRider, to: "/rider", icon: Bike, label: "Espace Livreur", color: "text-orange-500" },
  ];

  const visibleRoleLinks = roleLinks.filter((r) => r.show);

  const menuSections = [
    {
      title: "Mon espace",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
        { to: "/dashboard", icon: FileText, label: "Mes commandes", hash: "orders" },
        { to: "/wishlist", icon: Heart, label: "Liste de souhaits" },
        { to: "/messages", icon: MessageSquare, label: "Messages" },
      ],
    },
    {
      title: "Fidélité & Parrainage",
      items: [
        { to: "/loyalty-program", icon: Award, label: "Programme de fidélité" },
        { to: "/affiliate-program", icon: Users, label: "Parrainage & Affiliation" },
      ],
    },
    {
      title: "Paramètres du compte",
      items: [
        { to: "/dashboard", icon: User, label: "Profil", hash: "profile" },
        { to: "/dashboard", icon: MapPin, label: "Adresses", hash: "addresses" },
        { to: "/dashboard", icon: Bell, label: "Notifications", hash: "notifications" },
        { to: "/dashboard", icon: BadgeCheck, label: "Vérification KYC", hash: "verification" },
        { to: "/dashboard", icon: KeyRound, label: "Sécurité & mot de passe", hash: "security" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Profile header */}
      <div className="bg-primary/5 px-4 py-6 flex items-center gap-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
        <Avatar className="h-14 w-14 border-2 border-primary">
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
      </div>

      {/* Role-based quick access */}
      {visibleRoleLinks.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Mes interfaces
          </p>
          <div className="flex flex-col gap-2">
            {visibleRoleLinks.map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="flex items-center gap-3 rounded-xl bg-card border border-border p-3 active:scale-[0.98] transition-transform"
              >
                <r.icon size={22} className={r.color} />
                <span className="flex-1 text-sm font-medium text-foreground">{r.label}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Menu sections */}
      {menuSections.map((section) => (
        <div key={section.title} className="px-4 pt-4 pb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {section.title}
          </p>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {section.items.map((item, idx) => (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-3 active:bg-muted/60 transition-colors ${
                  idx < section.items.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <item.icon size={18} className="text-muted-foreground" />
                <span className="flex-1 text-sm text-foreground">{item.label}</span>
                <ChevronRight size={14} className="text-muted-foreground/60" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <div className="px-4 pt-6 pb-4">
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-destructive font-medium active:scale-[0.98] transition-transform"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </div>
  );
}
