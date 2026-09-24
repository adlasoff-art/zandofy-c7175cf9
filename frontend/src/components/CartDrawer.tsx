import { useCart } from "@/contexts/CartContext";
import { getColorDisplay } from "@/utils/colorName";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, X, Store } from "lucide-react";
import { imgUrl } from "@/lib/image-url";
import { CartItemVariantEditor } from "@/components/CartItemVariantEditor";
import { CartFreightPreview } from "@/components/cart/CartFreightPreview";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import {
  groupCartByStore,
  selectedSpansMultipleStores,
  normalizeCartStoreId,
} from "@/lib/cart-by-store";
import { useCheckoutGroupCompat } from "@/hooks/use-checkout-group-compat";

function prefetchCheckoutChunk() {
  void import("@/pages/CheckoutPage");
}

export function CartDrawer() {
  const {
    items, drawerOpen, setDrawerOpen, updateQuantity, removeItem,
    itemCount, selectedCount, selectedSubtotal, loading,
    toggleSelected, selectStore,
  } = useCart();
  const { user } = useAuth();
  const { t, formatPrice } = useI18n();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const navTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (navTimerRef.current != null) window.clearTimeout(navTimerRef.current);
    };
  }, []);

  const groups = useMemo(
    () =>
      groupCartByStore(
        items.map((i) => ({
          id: i.id,
          productId: i.productId,
          storeId: i.storeId,
          storeName: i.storeName,
          selected: i.selected,
          price: i.price,
          quantity: i.quantity,
        }))
      ),
    [items]
  );

  const multiStoreSelected = useMemo(
    () => selectedSpansMultipleStores(items),
    [items]
  );
  const selectedStoreIds = useMemo(
    () =>
      [
        ...new Set(
          items
            .filter((i) => i.selected)
            .map((i) => normalizeCartStoreId(i.storeId))
            .filter((id) => id !== "__unknown__")
        ),
      ],
    [items]
  );
  const { data: groupCompat, isLoading: groupCompatLoading } = useCheckoutGroupCompat(selectedStoreIds);
  const groupCheckoutBlocked =
    multiStoreSelected && !groupCompatLoading && groupCompat != null && !groupCompat.ok;
  const groupCheckoutPending = multiStoreSelected && groupCompatLoading;
  const noneSelected = selectedCount === 0;

  const goCheckout = () => {
    if (groupCheckoutBlocked || groupCheckoutPending) return;
    setDrawerOpen(false);
    if (navTimerRef.current != null) window.clearTimeout(navTimerRef.current);
    navTimerRef.current = window.setTimeout(() => {
      navigate("/checkout");
    }, 120);
  };

  const goAuthForCheckout = () => {
    if (groupCheckoutBlocked || groupCheckoutPending) return;
    setDrawerOpen(false);
    if (navTimerRef.current != null) window.clearTimeout(navTimerRef.current);
    navTimerRef.current = window.setTimeout(() => {
      navigate("/auth?redirect=" + encodeURIComponent("/checkout"));
    }, 120);
  };

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        hideClose={isMobile}
        className={
          isMobile
            ? "h-[100dvh] max-h-[100dvh] w-full rounded-none border-0 p-0 pt-0 flex flex-col gap-0"
            : "w-full sm:max-w-md flex flex-col"
        }
      >
        <SheetHeader
          className={
            isMobile
              ? "px-4 pb-3 border-b border-border space-y-0 text-left shrink-0"
              : undefined
          }
          style={
            isMobile
              ? { paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }
              : undefined
          }
        >
          <SheetTitle className="flex items-center gap-2 pr-2">
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
            <ShoppingBag size={20} />
            <span className="flex-1 truncate">
              {t("cart.title")} ({itemCount})
            </span>
            {isMobile && (
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-foreground"
                aria-label={t("general.close") || "Fermer"}
              >
                <X size={22} />
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        {user && loading && items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 min-h-[50vh]">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">{t("cart.loading") || "Chargement du panier…"}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 min-h-[50vh]">
            <ShoppingBag size={48} className="text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">{t("cart.empty")}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] px-6"
              onClick={() => setDrawerOpen(false)}
            >
              {t("cart.continueShopping")}
            </Button>
          </div>
        ) : (
          <>
            <div className={`py-2 border-b border-border ${isMobile ? "px-4" : "px-1"}`}>
              <p className="text-[11px] text-muted-foreground">
                {t("cart.oneStorePerOrder") ||
                  "Chaque boutique crée sa propre commande. Vous pouvez commander plusieurs boutiques en un paiement, sauf si un vendeur a désactivé les achats groupés ou si les modes de paiement sont incompatibles."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedCount} {t("cart.itemsSelected")}
              </p>
            </div>

            <div className={`flex-1 overflow-y-auto space-y-4 py-4 ${isMobile ? "px-4" : ""}`}>
              {groups.map((group) => (
                <div key={group.storeId} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/40 border-b border-border">
                    <Checkbox
                      checked={group.allSelected}
                      onCheckedChange={(v) =>
                        selectStore(group.storeId, v === true)
                      }
                    />
                    <Store size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold text-foreground flex-1 truncate">
                      {group.storeName}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatPrice(group.selectedSubtotal)}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {group.items.map((line) => {
                      const item = items.find((i) => i.id === line.id)!;
                      return (
                        <div
                          key={item.id}
                          className={`flex gap-3 p-2 rounded-sm transition-colors ${
                            item.selected ? "bg-muted/50" : "bg-muted/20 opacity-60"
                          }`}
                        >
                          <div className="flex items-start pt-1">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleSelected(item.id)}
                            />
                          </div>
                          <div className="relative w-20 h-20 shrink-0 rounded-sm overflow-hidden bg-muted border border-border">
                            <img
                              src={imgUrl(item.image, { width: 192, height: 192, resize: "cover" })}
                              alt={item.nameFr}
                              className="absolute inset-0 w-full h-full object-cover object-center"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-sm font-medium text-foreground line-clamp-2">
                              {item.nameFr}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {item.color &&
                                (() => {
                                  const cd = getColorDisplay(item.color);
                                  return cd ? (
                                    <span className="inline-flex items-center gap-1">
                                      {cd.hex && (
                                        <span
                                          className="w-3 h-3 rounded-full border border-border"
                                          style={{ backgroundColor: cd.hex }}
                                        />
                                      )}
                                      <span>{cd.name}</span>
                                    </span>
                                  ) : null;
                                })()}
                              {item.size && (
                                <span>
                                  {t("search.size")}: {item.size}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground">
                                {formatPrice(item.price * item.quantity)}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="w-11 h-11 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-8 text-center text-sm font-medium">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="w-11 h-11 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id)}
                                  className="w-11 h-11 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded ml-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {item.moq > 1 && item.quantity < item.moq && (
                              <p className="text-xs text-sale">
                                {t("cart.minRequired").replace("{min}", String(item.moq))}
                              </p>
                            )}
                            <CartItemVariantEditor
                              cartItemId={item.id}
                              productId={item.productId}
                              currentColor={item.color}
                              currentSize={item.size}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div
              className={`border-t border-border pt-4 space-y-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] ${
                isMobile ? "px-4" : ""
              }`}
            >
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("cart.subtotal")} ({selectedCount} {t("cart.selected")})
                </span>
                <span className="font-bold text-foreground">
                  {formatPrice(selectedSubtotal)}
                </span>
              </div>
              {groupCheckoutPending && (
                <p className="text-xs text-muted-foreground text-center">
                  Vérification des achats groupés…
                </p>
              )}
              {groupCheckoutBlocked && (
                <p className="text-xs text-destructive text-center font-medium">
                  {groupCompat?.messageFr ||
                    t("cart.multiStoreBlocked") ||
                    "Achats groupés non disponibles pour ces boutiques."}
                </p>
              )}
              {multiStoreSelected &&
                !groupCheckoutBlocked &&
                !groupCheckoutPending &&
                selectedCount > 0 && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Achats groupés autorisés : 1 paiement pour plusieurs boutiques, sauf si un vendeur
                  a choisi le mode solo ou si les moyens de paiement sont incompatibles.
                </p>
              )}
              {user && selectedCount > 0 && !groupCheckoutBlocked && !groupCheckoutPending && (
                <CartFreightPreview
                  userId={user.id}
                  items={items
                    .filter((i) => i.selected && i.productId)
                    .map((i) => ({ productId: i.productId, quantity: i.quantity }))}
                />
              )}
              <p className="text-xs text-muted-foreground">{t("cart.shippingAtCheckout")}</p>
              {!user && (
                <p className="text-xs text-muted-foreground text-center">
                  {t("cart.loginToCheckout") || "Connectez-vous pour finaliser votre commande."}
                </p>
              )}
              {noneSelected || groupCheckoutBlocked || groupCheckoutPending ? (
                <Button type="button" className="w-full h-12 min-h-[44px] font-bold" disabled>
                  {noneSelected ? t("cart.selectItems") : t("cart.order")}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full h-12 min-h-[44px] font-bold active:scale-[0.98] transition-transform"
                  onClick={user ? goCheckout : goAuthForCheckout}
                  onPointerEnter={prefetchCheckoutChunk}
                  onFocus={prefetchCheckoutChunk}
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
