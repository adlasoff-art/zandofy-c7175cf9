import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

export function CartDrawer() {
  const { items, drawerOpen, setDrawerOpen, updateQuantity, removeItem, itemCount, subtotal } = useCart();
  const { user } = useAuth();

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag size={20} /> Panier ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag size={48} className="text-muted-foreground" />
            <p className="text-muted-foreground">Connectez-vous pour voir votre panier</p>
            <Link to="/auth" onClick={() => setDrawerOpen(false)}>
              <Button>Se connecter</Button>
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag size={48} className="text-muted-foreground" />
            <p className="text-muted-foreground">Votre panier est vide</p>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Continuer mes achats</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map(item => (
                <div key={item.id} className="flex gap-3 p-3 bg-muted/50 rounded-sm">
                  <img src={item.image} alt={item.nameFr} className="w-20 h-24 object-cover rounded-sm shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground line-clamp-2">{item.nameFr}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.color && (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: item.color }} />
                        </span>
                      )}
                      {item.size && <span>Taille: {item.size}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">${(item.price * item.quantity).toFixed(2)}</span>
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
                      <p className="text-xs text-sale">Min. {item.moq} pièces requis</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="font-bold text-foreground">${subtotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Frais de port calculés au checkout</p>
              <Link to="/checkout" onClick={() => setDrawerOpen(false)}>
                <Button className="w-full h-12 font-bold">Commander (${subtotal.toFixed(2)})</Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
