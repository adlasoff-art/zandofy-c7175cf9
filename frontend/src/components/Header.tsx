import { Search, ShoppingBag, Heart, User, Menu, X, Headphones, Globe, ChevronRight, LogOut, MessageCircle, ChevronDown, PackageSearch, Sun, Moon, Monitor, Bell } from "lucide-react";
import { useState, useRef, useEffect, Component, lazy, Suspense, type ReactNode, type ErrorInfo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PredictiveSearch } from "@/components/PredictiveSearch";
import { BrandLogo } from "@/components/BrandLogo";
import { MegaMenu } from "@/components/MegaMenu";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";

// Lazy-load NotificationCenter to prevent Radix Popover import failures from crashing the entire Header
const NotificationCenter = lazy(() =>
  import("@/components/NotificationCenter").then((mod) => ({ default: mod.NotificationCenter }))
);
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { useCart } from "@/contexts/CartContext";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { useUnreadSupport } from "@/hooks/use-unread-support";
import { useWishlist } from "@/contexts/WishlistContext";
import { useI18n, LOCALES, CURRENCIES, type CurrencyCode } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useHeaderTheme } from "@/hooks/use-header-theme";

// Mini error boundary to prevent Radix crashes from taking down the whole page
class SafeRadix extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[SafeRadix] Radix component crashed, rendering fallback:", error.message);
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// Fallback static nav items (used if CMS query fails or is loading)
const NAV_LINK_KEYS = [
  { label: "Catégories", href: "#", hasMega: true, highlight: false },
  { label: "Nouveautés", href: "/category/nouveautes", hasMega: false, highlight: false },
  { label: "Soldes", href: "/category/soldes", hasMega: false, highlight: true },
  { label: "Fournisseurs", href: "/stores", hasMega: false, highlight: false },
  { label: "Électronique", href: "/category/electronics", hasMega: false, highlight: false },
  { label: "Maison & Déco", href: "/category/home", hasMega: false, highlight: false },
  { label: "Vêtements Femme", href: "/category/women", hasMega: false, highlight: false },
  { label: "Vêtements Homme", href: "/category/men", hasMega: false, highlight: false },
  { label: "Chaussures", href: "/category/shoes", hasMega: false, highlight: false },
  { label: "Bijoux & Accessoires", href: "/category/accessories", hasMega: false, highlight: false },
  { label: "Beauté & Santé", href: "/search?q=beauté+santé", hasMega: false, highlight: false },
  { label: "Sacs & Bagages", href: "/category/bags", hasMega: false, highlight: false },
  { label: "Sports & Plein air", href: "/search?q=sports", hasMega: false, highlight: false },
  { label: "Enfants", href: "/category/kids", hasMega: false, highlight: false },
];

interface TopBarConfig {
  enabled: boolean;
  mode: "static" | "slide" | "marquee";
  bg_color: string;
  text_color: string;
  messages: { text_fr: string; text_en: string; visible: boolean }[];
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedMobileCat, setExpandedMobileCat] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const megaTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { isStaff } = useRoles();
  const { setDrawerOpen, itemCount } = useCart();
  const unreadCount = useUnreadMessages();
  const unreadSupportCount = useUnreadSupport();
  const { count: wishlistCount } = useWishlist();
  const { t, locale, currency, setLocale, setCurrency } = useI18n();
  const { theme, setTheme } = useTheme();
  const headerTheme = useHeaderTheme();

  // Top bar config from CMS
  const { data: topBarConfig } = useQuery({
    queryKey: ["topbar-config"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "topbar_config").maybeSingle();
      return (data?.value || null) as unknown as TopBarConfig | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const topBarMessages = (() => {
    if (!topBarConfig?.enabled) return [];
    const msgs = (topBarConfig.messages || []).filter(m => m.visible);
    return msgs.map(m => locale === "fr" ? m.text_fr : m.text_en).filter(Boolean);
  })();

  // Slide mode auto-rotate
  useEffect(() => {
    if (!topBarConfig || topBarConfig.mode !== "slide" || topBarMessages.length <= 1) return;
    const interval = setInterval(() => setSlideIdx(prev => (prev + 1) % topBarMessages.length), 3500);
    return () => clearInterval(interval);
  }, [topBarConfig?.mode, topBarMessages.length]);

  // Dynamic category nav from CMS
  const { data: cmsNavItems } = useQuery({
    queryKey: ["cms-category-nav"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_menu_items")
        .select("*")
        .eq("menu_group", "category_nav")
        .eq("is_visible", true)
        .is("parent_id", null)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Build nav links: CMS data or fallback
  const navLinks = (cmsNavItems && cmsNavItems.length > 0)
    ? cmsNavItems.map((item: any) => ({
        label: item.label,
        href: item.url,
        hasMega: item.has_mega ?? false,
        highlight: item.highlight ?? false,
      }))
    : NAV_LINK_KEYS;


    queryKey: ["mobile-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id, name, name_fr, icon, parent_id, image_url, sort_order")
        .order("sort_order")
        .order("name_fr");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  const handleMegaEnter = () => {
    clearTimeout(megaTimeoutRef.current);
    setMegaOpen(true);
  };
  const handleMegaLeave = () => {
    megaTimeoutRef.current = setTimeout(() => setMegaOpen(false), 200);
  };

  const getCatLabel = (cat: { name: string; name_fr: string }) =>
    locale === "fr" ? cat.name_fr : cat.name;

  return (
    <header className="sticky top-0 z-50 bg-card" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Green promo zone */}
      <div className="bg-foreground md:bg-foreground text-card text-[11px] py-1.5 max-md:bg-primary max-md:text-primary-foreground" style={{ marginTop: "calc(-1 * env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)" }}>
        <div className="container flex items-center justify-center gap-8 overflow-hidden">
          {topBarMessages.map((msg, i) => (
            <span key={i} className="whitespace-nowrap hidden md:inline-flex items-center gap-1.5">
              {msg}
              {i < topBarMessages.length - 1 && <span className="mx-4 text-card/30">|</span>}
            </span>
          ))}
          <span className="md:hidden text-center">{topBarMessages[0]}</span>
        </div>
      </div>

      {/* Main header row */}
      <div className="border-b border-border">
        <div className="container flex items-center h-14 gap-4">
          <button
            className="lg:hidden p-1.5 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <BrandLogo variant="header" />

          <div className="hidden md:flex flex-1 max-w-2xl mx-auto px-6">
            <PredictiveSearch />
          </div>

          <div className="flex items-center gap-0.5 ml-auto">
            <button
              className="hidden md:flex lg:hidden p-2 text-foreground"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label={t("header.search")}
            >
              <Search size={20} />
            </button>

            {user && (
              <SafeRadix fallback={<Link to="/dashboard" className="p-2 text-foreground hover:text-primary"><Bell size={20} /></Link>}>
                <Suspense fallback={<span className="p-2 text-foreground"><Bell size={20} /></span>}>
                  <NotificationCenter />
                </Suspense>
              </SafeRadix>
            )}

            {user && (
              <Link to="/messages" className="p-2 text-foreground hover:text-primary transition-colors relative" aria-label={t("header.messages")} title={t("header.messages")}>
                <MessageCircle size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}

            <Link to="/tracking" className="p-2 text-foreground hover:text-primary transition-colors" aria-label={t("header.tracking") || "Suivi colis"} title={t("header.tracking") || "Suivi colis"}>
              <PackageSearch size={20} />
            </Link>

            <Link to="/help-center" className="flex p-2 text-foreground hover:text-primary transition-colors relative" aria-label={t("header.support")} title={t("header.support")}>
              <Headphones size={20} />
              {unreadSupportCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                  {unreadSupportCount > 9 ? "9+" : unreadSupportCount}
                </span>
              )}
            </Link>

            <div className="relative hidden md:block">
              <button
                className="p-2 text-foreground hover:text-primary transition-colors"
                aria-label={t("header.langCurrency")}
                onClick={() => setCurrencyOpen(!currencyOpen)}
              >
                <Globe size={20} />
              </button>
              {currencyOpen && <CurrencySwitcher onClose={() => setCurrencyOpen(false)} />}
            </div>

            {user ? (
              <div className="relative hidden md:block" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="p-2 text-primary hover:text-primary/80 transition-colors"
                  aria-label={t("header.account")}
                >
                  <User size={20} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 animate-fade-in">
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">{user.email}</div>
                    <Link to="/dashboard" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">{t("header.mySpace")}</Link>
                    <Link to="/messages" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">{t("header.messages")} {unreadCount > 0 && `(${unreadCount})`}</Link>
                    <Link to="/vendor" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">{t("header.vendorSpace")}</Link>
                    <Link to="/become-vendor" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-primary font-medium hover:bg-muted transition-colors">{t("header.becomeVendor")}</Link>
                    {isStaff && <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">{t("header.admin")}</Link>}
                    <button onClick={() => { setUserMenuOpen(false); signOut(); }} className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors flex items-center gap-2">
                      <LogOut size={14} /> {t("header.logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth" className="hidden md:flex p-2 text-foreground hover:text-primary transition-colors" aria-label={t("header.account")}>
                <User size={20} />
              </Link>
            )}
            <Link to="/wishlist" className="hidden md:flex p-2 text-foreground hover:text-primary transition-colors relative" aria-label={t("header.wishlist")}>
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-sale text-sale-foreground text-[10px] font-bold rounded-full flex items-center justify-center">{wishlistCount > 99 ? "99+" : wishlistCount}</span>
              )}
            </Link>
            <button onClick={() => setDrawerOpen(true)} className="hidden md:flex p-2 text-foreground hover:text-primary transition-colors relative" aria-label={t("header.cart")}>
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-sale text-sale-foreground text-[10px] font-bold rounded-full flex items-center justify-center">{itemCount > 99 ? "99+" : itemCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="md:hidden px-4 py-2 border-b border-border bg-card">
          <PredictiveSearch mobile onClose={() => setSearchOpen(false)} />
        </div>
      )}

      <nav className="hidden lg:block border-b border-border bg-card relative"
        onMouseLeave={handleMegaLeave}
      >
        <div className="container">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-thin">
            {navLinks.map((link, idx) => (
              <div
                key={link.label + idx}
                className={`relative ${link.hasMega ? "shrink-0 sticky left-0 z-10 bg-card" : ""}`}
                onMouseEnter={link.hasMega ? handleMegaEnter : undefined}
              >
                <Link
                  to={link.hasMega ? "#" : link.href}
                  className={`flex items-center gap-0.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors hover:text-primary border-b-2 border-transparent hover:border-primary ${
                    link.highlight ? "text-sale font-bold" : "text-foreground"
                  } ${link.hasMega ? "font-bold" : ""}`}
                  onClick={link.hasMega ? (e) => e.preventDefault() : undefined}
                >
                  {link.label}
                  {link.hasMega && <ChevronRight size={12} className="rotate-90" />}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {megaOpen && (
          <div onMouseEnter={handleMegaEnter}>
            <MegaMenu />
          </div>
        )}
      </nav>

      {mobileOpen && (
        <nav className="lg:hidden border-b border-border bg-card animate-fade-in max-h-[70vh] overflow-y-auto">
          <div className="py-2">
            {(() => {
              const parents = (mobileCategories || []).filter((c) => !c.parent_id);
              const getChildren = (pid: string) => (mobileCategories || []).filter((c) => c.parent_id === pid);
              return parents.map((cat) => {
                const subs = getChildren(cat.id);
                const isExpanded = expandedMobileCat === cat.id;
                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => setExpandedMobileCat(isExpanded ? null : cat.id)}
                      className="flex items-center justify-between w-full py-2.5 px-4 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {cat.icon && <span>{cat.icon}</span>}
                        {getCatLabel(cat)}
                      </span>
                      {subs.length > 0 && (
                        <ChevronDown size={14} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      )}
                    </button>
                    {isExpanded && subs.length > 0 && (
                      <div className="bg-muted/30">
                        <Link
                          to={`/category/${cat.name.toLowerCase()}`}
                          onClick={() => setMobileOpen(false)}
                          className="block py-2 px-8 text-sm text-primary font-medium hover:bg-muted transition-colors"
                        >
                          {t("nav.viewAll")}
                        </Link>
                        {subs.map((sub) => (
                          <Link
                            key={sub.id}
                            to={`/category/${sub.name.toLowerCase()}`}
                            onClick={() => setMobileOpen(false)}
                            className="block py-2 px-8 text-sm text-foreground hover:bg-muted hover:text-primary transition-colors"
                          >
                            {getCatLabel(sub)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {/* Special links */}
            <div className="border-t border-border mt-2 pt-2">
              <Link to="/category/nouveautes" onClick={() => setMobileOpen(false)} className="block py-2.5 px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                {t("nav.newArrivals")}
              </Link>
              <Link to="/category/soldes" onClick={() => setMobileOpen(false)} className="block py-2.5 px-4 text-sm font-bold text-sale hover:bg-muted transition-colors">
                {t("nav.sales")}
              </Link>
            </div>

            {/* Mobile language / theme / currency */}
            <div className="border-t border-border mt-2 pt-3 px-4 space-y-3 pb-3">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("switcher.language")}</span>
                <div className="flex gap-2 mt-1.5">
                  {LOCALES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLocale(lang.code)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        locale === lang.code
                          ? "bg-foreground text-card border-foreground"
                          : "bg-card text-foreground border-border hover:border-foreground"
                      }`}
                    >
                      {lang.flag} {lang.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("switcher.currency")}</span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="mt-1.5 w-full px-3 py-1.5 text-xs bg-muted border border-border rounded-md outline-none focus:border-primary text-foreground"
                >
                  {Object.values(CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>{c.symbol} — {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("switcher.theme")}</span>
                <div className="flex gap-2 mt-1.5">
                  {([
                    { value: "light" as const, label: t("switcher.light"), icon: Sun },
                    { value: "dark" as const, label: t("switcher.dark"), icon: Moon },
                    { value: "system" as const, label: t("switcher.system"), icon: Monitor },
                  ]).map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          theme === opt.value
                            ? "bg-foreground text-card border-foreground"
                            : "bg-card text-foreground border-border hover:border-foreground"
                        }`}
                      >
                        <Icon size={12} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
