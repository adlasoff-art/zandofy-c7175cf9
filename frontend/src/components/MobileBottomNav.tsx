import { useCallback, useEffect, useState } from "react";
import { Home, LayoutGrid, MessageCircle, ShoppingBag, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { useI18n } from "@/contexts/I18nContext";
import type { MouseEvent } from "react";
import { shouldHideMobileBottomNav } from "@/lib/mobile-chrome";
import { requestHomeReshuffle } from "@/lib/home-session-shuffle";

/** Open/close the same mobile categories panel as former hamburger (Header listens). */
export const TOGGLE_CATEGORIES_EVENT = "toggle-mobile-categories";
export const CATEGORIES_PANEL_STATE_EVENT = "mobile-categories-panel-state";

/** @deprecated Search lives in sticky header; kept for SearchPage listeners if any. */
export const TOGGLE_SEARCH_EVENT = "toggle-mobile-search";

type NavItem = {
  icon: typeof Home;
  labelKey: string;
  path: string;
  kind: "link" | "categories" | "cart" | "messages" | "account";
};

const NAV_ITEMS: NavItem[] = [
  { icon: Home, labelKey: "bottomNav.home", path: "/", kind: "link" },
  { icon: LayoutGrid, labelKey: "bottomNav.categories", path: "#categories", kind: "categories" },
  { icon: MessageCircle, labelKey: "bottomNav.messages", path: "/messages", kind: "messages" },
  { icon: ShoppingBag, labelKey: "bottomNav.cart", path: "#cart", kind: "cart" },
  { icon: User, labelKey: "bottomNav.account", path: "/account", kind: "account" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { setDrawerOpen, itemCount } = useCart();
  const unreadCount = useUnreadMessages();
  const { t } = useI18n();
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const hideNav = shouldHideMobileBottomNav(location.pathname);

  useEffect(() => {
    const onState = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      if (detail && typeof detail.open === "boolean") setCategoriesOpen(detail.open);
    };
    window.addEventListener(CATEGORIES_PANEL_STATE_EVENT, onState);
    return () => window.removeEventListener(CATEGORIES_PANEL_STATE_EVENT, onState);
  }, []);

  // Close active highlight when navigating away
  useEffect(() => {
    setCategoriesOpen(false);
  }, [location.pathname]);

  const handleCategoriesClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent(TOGGLE_CATEGORIES_EVENT));
  }, []);

  if (hideNav) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          let isActive = false;
          if (item.kind === "categories") isActive = categoriesOpen;
          else if (item.kind === "account") {
            isActive =
              location.pathname === "/account" || location.pathname.startsWith("/dashboard");
          } else if (item.kind === "messages") {
            isActive = location.pathname.startsWith("/messages");
          } else if (item.kind === "link") {
            isActive = location.pathname === item.path;
          }

          let badge = 0;
          if (item.kind === "cart") badge = itemCount;
          if (item.kind === "messages") badge = unreadCount;

          const content = (
            <div className="flex flex-col items-center gap-0.5 relative min-w-[44px] min-h-[44px] justify-center touch-manipulation">
              <Icon
                size={20}
                className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {badge > 0 && (
                <span className="absolute -top-0.5 right-0 w-4 h-4 bg-sale text-sale-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
          );

          if (item.kind === "cart") {
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="active:scale-95 transition-transform"
                aria-label={label}
              >
                {content}
              </button>
            );
          }

          if (item.kind === "categories") {
            return (
              <button
                key={item.path}
                type="button"
                onClick={handleCategoriesClick}
                className="active:scale-95 transition-transform"
                aria-label={label}
                aria-expanded={categoriesOpen}
              >
                {content}
              </button>
            );
          }

          if (item.kind === "messages" && !user) {
            return (
              <Link
                key={item.path}
                to="/auth?redirect=%2Fmessages"
                className="active:scale-95 transition-transform"
                aria-label={label}
              >
                {content}
              </Link>
            );
          }

          if (item.kind === "account" && !user) {
            return (
              <Link
                key={item.path}
                to="/auth?redirect=%2Faccount"
                className="active:scale-95 transition-transform"
                aria-label={label}
              >
                {content}
              </Link>
            );
          }

          if (item.kind === "link" && item.path === "/") {
            const goHome = (e: MouseEvent) => {
              if (location.pathname === "/") {
                e.preventDefault();
                requestHomeReshuffle();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            };
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={goHome}
                className="active:scale-95 transition-transform"
                aria-label={label}
              >
                {content}
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className="active:scale-95 transition-transform"
              aria-label={label}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
