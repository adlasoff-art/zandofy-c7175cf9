import { useCart } from "@/contexts/CartContext";
import { getColorDisplay } from "@/utils/colorName";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Minus, Plus, Trash2, ShoppingBag, CheckSquare, Square } from "lucide-react";
import { imgUrl } from "@/lib/image-url";
import { Link } from "react-router-dom";
import { CartItemVariantEditor } from "@/components/CartItemVariantEditor";
import { CartFreightPreview } from "@/components/cart/CartFreightPreview";

export function CartDrawer() {
  const {
    items, drawerOpen, setDrawerOpen, updateQuantity, removeItem,
    itemCount, selectedCount, selectedSubtotal,
    toggleSelected, selectAll, deselectAll,
  } = useCart();
  const { user } = useAuth();
  const { t, formatPrice } = useI18n();

  const allSelected = items.length > 0 && items.every(i => i.selected);
  const noneSelected = items.every(i => !i.selected);

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag size={20} /> {t("cart.title")} ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag size={48} className="text-muted-foreground" />
            <p className="text-muted-foreground">{t("cart.loginRequired")}</p>
            <Link to="/auth" onClick={() => setDrawerOpen(false)}>
              <Button>{t("cart.login")}</Button>
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag size={48} className="text-muted-foreground" />
            <p className="text-muted-foreground">{t("cart.empty")}</p>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>{t("cart.continueShopping")}</Button>
          </div>
        ) : (
          <>
            {/* Select all / deselect all */}
            <div className="flex items-center justify-between py-2 px-1 border-b border-border">
              <button
                onClick={() => allSelected ? deselectAll() : selectAll()}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1.5"
              >
                {allSelected ? <Square size={14} /> : <CheckSquare size={14} />}
                {allSelected ? t("cart.deselectAll") : t("cart.selectAll")}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedCount} {t("cart.itemsSelected")}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map(item => (
                <div key={item.id} className={`flex gap-3 p-3 rounded-sm transition-colors ${item.selected ? "bg-muted/50" : "bg-muted/20 opacity-60"}`}>
                  {/* Checkbox */}
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
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground">
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground">
                          <Plus size={14} />
                        </button>
                        <button onClick={() => removeItem(item.id)} className="w-7 h-7 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded ml-1">
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

            {/* Footer */}
            <div className="border-t border-border pt-4 space-y-3">
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
                <Button className="w-full h-12 font-bold" disabled>
                  {t("cart.selectItems")}
                </Button>
              ) : (
                <Link to="/checkout" onClick={() => setDrawerOpen(false)}>
                  <Button className="w-full h-12 font-bold">{t("cart.order")} ({selectedCount}) — {formatPrice(selectedSubtotal)}</Button>
                </Link>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
