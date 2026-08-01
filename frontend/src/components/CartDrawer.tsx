import { useCart } from "@/contexts/CartContext";
import { getColorDisplay } from "@/utils/colorName";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Minus, Plus, Trash2, ShoppingBag, CheckSquare, Square, ArrowLeft } from "lucide-react";
import { imgUrl } from "@/lib/image-url";
import { useNavigate } from "react-router-dom";
import { CartItemVariantEditor } from "@/components/CartItemVariantEditor";
import { CartFreightPreview } from "@/components/cart/CartFreightPreview";
import { useEffect, useState } from "react";

function useIsMobileCart() {
  // Sync initial value to avoid side="right" → side="bottom" flip (Radix crash risk).
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export function CartDrawer() {
  const {
    items, drawerOpen, setDrawerOpen, updateQuantity, removeItem,
    itemCount, selectedCount, selectedSubtotal, loading,
    toggleSelected, selectAll, deselectAll,
  } = useCart();
  const { user } = useAuth();
  const { t, formatPrice } = useI18n();
  const isMobile = useIsMobileCart();
  const navigate = useNavigate();

  const allSelected = items.length > 0 && items.every(i => i.selected);
  const noneSelected = items.every(i => !i.selected);

  const goCheckout = () => {
    setDrawerOpen(false);
    // Hard navigation: avoids Sheet/Radix + lazy Checkout race that surfaces as
    // ErrorBoundary "Oups" then works after manual reload.
    window.setTimeout(() => {
      window.location.assign("/checkout");
    }, 0);
  };

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[100dvh] max-h-[100dvh] w-full rounded-none border-0 p-0 flex flex-col gap-0"
            : "w-full sm:max-w-md flex flex-col"
        }
      >
        <SheetHeader className={isMobile ? "px-4 py-3 border-b border-border space-y-0 text-left" : undefined}>
          <SheetTitle className="flex items-center gap-2">
            {isMobile && (
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 text-foreground"
                aria-label={t("general.back") || "Retour"}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <ShoppingBag size={20} /> {t("cart.title")} ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 min-h-[50vh]">
            <ShoppingBag size={48} className="text-muted-foreground" />
            <p className="text-muted-foreground">{t("cart.loginRequired")}</p>
            <Button
              className="min-h-[44px] px-6"
              onClick={() => {
                setDrawerOpen(false);
                navigate("/auth");
              }}
            >
              {t("cart.login")}
            </Button>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 min-h-[50vh]">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">{t("cart.loading") || "Chargement du panier…"}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 min-h-[50vh]">
            <ShoppingBag size={48} className="text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">{t("cart.empty")}</p>
            <Button
              variant="outline"
              className="min-h-[44px] px-6"
              onClick={() => setDrawerOpen(false)}
            >
              {t("cart.continueShopping")}
            </Button>
          </div>
        ) : (
          <>
            <div className={`flex items-center justify-between py-2 border-b border-border ${isMobile ? "px-4" : "px-1"}`}>
              <button
                onClick={() => allSelected ? deselectAll() : selectAll()}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1.5 min-h-[44px]"
              >
                {allSelected ? <Square size={14} /> : <CheckSquare size={14} />}
                {allSelected ? t("cart.deselectAll") : t("cart.selectAll")}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedCount} {t("cart.itemsSelected")}
              </span>
            </div>

            <div className={`flex-1 overflow-y-auto space-y-3 py-4 ${isMobile ? "px-4" : ""}`}>
              {items.map(item => (
                <div key={item.id} className={`flex gap-3 p-3 rounded-sm transition-colors ${item.selected ? "bg-muted/50" : "bg-muted/20 opacity-60"}`}>
                  <div className="flex items-start pt-1">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleSelected(item.id)}
                    />
                  </div>
                  <img src={imgUrl(item.image, { width: 160 })} alt={item.nameFr} className="w-20 h-24 object-cover rounded-sm shrink-0" loading="lazy" decoding="async" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground line-clamp-2">{item.nameFr}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.color && (() => {
                        const cd = getColorDisplay(item.color);
                        return cd ? (
                          <span className="inline-flex items-center gap-1">
                            {cd.hex && <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: cd.hex }} />}
                            <span>{cd.name}</span>
                          </span>
                        ) : null;
                      })()}
                      {item.size && <span>{t("search.size")}: {item.size}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{formatPrice(item.price * item.quantity)}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-11 h-11 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground">
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-11 h-11 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground">
                          <Plus size={14} />
                        </button>
                        <button onClick={() => removeItem(item.id)} className="w-11 h-11 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded ml-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {item.moq > 1 && item.quantity < item.moq && (
                      <p className="text-xs text-sale">{t("cart.minRequired").replace("{min}", String(item.moq))}</p>
                    )}
                    <CartItemVariantEditor
                      cartItemId={item.id}
                      productId={item.productId}
                      currentColor={item.color}
                      currentSize={item.size}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={`border-t border-border pt-4 space-y-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] ${isMobile ? "px-4" : ""}`}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("cart.subtotal")} ({selectedCount} {t("cart.selected")})</span>
                <span className="font-bold text-foreground">{formatPrice(selectedSubtotal)}</span>
              </div>
              {user && selectedCount > 0 && (
                <CartFreightPreview
                  userId={user.id}
                  items={items
                    .filter((i) => i.selected && i.productId)
                    .map((i) => ({ productId: i.productId, quantity: i.quantity }))}
                />
              )}
              <p className="text-xs text-muted-foreground">{t("cart.shippingAtCheckout")}</p>
              {noneSelected ? (
                <Button className="w-full h-12 min-h-[44px] font-bold" disabled>
                  {t("cart.selectItems")}
                </Button>
              ) : (
                <Button
                  className="w-full h-12 min-h-[44px] font-bold active:scale-[0.98] transition-transform"
                  onClick={goCheckout}
                >
                  {t("cart.order")} ({selectedCount}) — {formatPrice(selectedSubtotal)}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
