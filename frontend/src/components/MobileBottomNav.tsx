import { useCallback } from "react";
import { Home, Search, Heart, ShoppingBag, User } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useI18n } from "@/contexts/I18nContext";

const NAV_ITEMS = [
  { icon: Home, labelKey: "bottomNav.home", path: "/" },
  { icon: Search, labelKey: "bottomNav.search", path: "/search" },
  { icon: Heart, labelKey: "bottomNav.wishlist", path: "/wishlist" },
  { icon: ShoppingBag, labelKey: "bottomNav.cart", path: "#cart" },
  { icon: User, labelKey: "bottomNav.account", path: "/account" },
];

// Custom event to toggle search bar on SearchPage
export const TOGGLE_SEARCH_EVENT = "toggle-mobile-search";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setDrawerOpen, itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { t } = useI18n();

  const getBadge = (path: string) => {
    if (path === "#cart") return itemCount;
    if (path === "/wishlist") return wishlistCount;
    return 0;
  };

  const isOnSearchPage = location.pathname === "/search";

  const handleSearchClick = useCallback(() => {
    if (isOnSearchPage) {
      window.dispatchEvent(new CustomEvent(TOGGLE_SEARCH_EVENT));
    } else {
      navigate("/search");
    }
  }, [isOnSearchPage, navigate]);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const href = item.path;
          const isCart = item.path === "#cart";
          const isSearch = item.path === "/search";
          const isAccount = item.path === "/dashboard";
          const isActive = !isCart && (isSearch ? isOnSearchPage : location.pathname === href);
          const badge = getBadge(item.path);
          const label = t(item.labelKey);

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

          if (isCart) {
            return (
              <button
                key={item.path}
                onClick={() => setDrawerOpen(true)}
                className="active:scale-95 transition-transform"
                aria-label={label}
              >
                {content}
              </button>
            );
          }

          if (isSearch) {
            return (
              <button
                key={item.path}
                onClick={handleSearchClick}
                className="active:scale-95 transition-transform"
                aria-label={label}
              >
                {content}
              </button>
            );
          }

          if (isAccount && !user) {
            return (
              <Link
                key={item.path}
                to="/auth"
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
              to={href}
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
