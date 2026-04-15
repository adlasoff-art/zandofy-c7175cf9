import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Package,
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
import { useCertification } from "@/hooks/use-certification";
import { CertificationBadge } from "@/components/CertificationBadge";

export function MobileAccountMenu() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, isManager, isVendor, isShipper, isRider, isStaff, loading: rolesLoading } = useRoles();
  const { t } = useI18n();
  const [suppliersEnabled, setSuppliersEnabled] = useState(false);

  useEffect(() => {
    if (!user || !isVendor) return;
    const check = async () => {
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!store) return;
      const { data: vpo } = await supabase
        .from("vendor_pricing_overrides")
        .select("suppliers_enabled")
        .eq("store_id", store.id)
        .maybeSingle();
      setSuppliersEnabled(vpo?.suppliers_enabled ?? false);
    };
    check();
  }, [user, isVendor]);


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
        { to: "/dashboard?tab=orders", icon: FileText, label: "Mes commandes" },
        { to: "/dashboard?tab=subscriptions", icon: Award, label: "Mes abonnements" },
        { to: "/wishlist", icon: Heart, label: "Liste de souhaits" },
        { to: "/messages", icon: MessageSquare, label: "Messages" },
        ...(isVendor && suppliersEnabled ? [{ to: "/vendor?tab=suppliers", icon: Package, label: "Fournisseurs" }] : []),
    {
      title: "Fidélité & Parrainage",
      items: [
        { to: "/dashboard?tab=overview", icon: Award, label: "Programme de fidélité" },
        { to: "/dashboard?tab=referral", icon: Users, label: "Parrainage & Affiliation" },
      ],
    },
    {
      title: "Réclamations",
      items: [
        { to: "/dashboard?tab=disputes", icon: AlertTriangle, label: "Litiges" },
        { to: "/dashboard?tab=returns", icon: RotateCcw, label: "Retours" },
      ],
    },
    ...(!isVendor ? [{
      title: "Opportunités",
      items: [
        { to: "/become-vendor", icon: Store, label: "Devenir vendeur" },
      ],
    }] : []),
    {
      title: "Paramètres du compte",
      items: [
        { to: "/dashboard?tab=profile", icon: User, label: "Profil" },
        { to: "/dashboard?tab=addresses", icon: MapPin, label: "Adresses" },
        { to: "/dashboard?tab=notifications", icon: Bell, label: "Notifications" },
        { to: "/dashboard?tab=kyc", icon: BadgeCheck, label: "Vérification KYC" },
        { to: "/dashboard?tab=profile", icon: KeyRound, label: "Sécurité & mot de passe" },
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
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">{displayName}</p>
            {isCertified && <CertificationBadge type="client" variant="icon-only" />}
          </div>
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
