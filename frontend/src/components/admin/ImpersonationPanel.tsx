import { useImpersonation } from "@/contexts/ImpersonationContext";
import { X, Package, MapPin, CreditCard, Wallet } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { STATUS_CONFIG } from "@/lib/order-status";

export function ImpersonationPanel() {
  const { impersonatedUser, stopImpersonation, isImpersonating } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) return null;

  const { stats, orders, addresses, wallet, payment_methods } = impersonatedUser;
  const name = [impersonatedUser.first_name, impersonatedUser.last_name].filter(Boolean).join(" ") || impersonatedUser.email;

  return (
    <div className="fixed inset-0 bg-black/50 z-[90] flex items-start justify-center pt-16 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl mx-4 mb-8 mt-4">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">Vue utilisateur : {name}</h2>
            <p className="text-xs text-muted-foreground">{impersonatedUser.email} · Rôles : {impersonatedUser.roles.length > 0 ? impersonatedUser.roles.join(", ") : "Client"}</p>
          </div>
          <button onClick={stopImpersonation} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total_orders}</p>
              <p className="text-xs text-muted-foreground">Commandes</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">${stats.total_spent.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total dépensé</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total_delivered}</p>
              <p className="text-xs text-muted-foreground">Livrées</p>
            </div>
          </div>

          {/* Wallet */}
          {wallet && (
            <div className="bg-muted/20 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Wallet size={14} /> Portefeuille vendeur</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Disponible</span>
                  <p className="font-bold text-primary">${Number(wallet.available_balance || 0).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">En attente</span>
                  <p className="font-bold text-foreground">${Number(wallet.pending_balance || 0).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Total gagné</span>
                  <p className="font-bold text-foreground">${Number(wallet.total_earned || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Payment methods */}
          {payment_methods.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><CreditCard size={14} /> Méthodes de paiement</h3>
              <div className="space-y-1">
                {payment_methods.map((pm: any) => (
                  <div key={pm.id} className="flex items-center gap-2 text-xs bg-muted/20 rounded-lg p-2.5">
                    <span className="font-medium text-foreground">{pm.provider}</span>
                    <span className="text-muted-foreground">{pm.phone_number}</span>
                    {pm.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Par défaut</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Package size={14} /> Commandes récentes ({orders.length})</h3>
            {orders.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">Aucune commande</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {orders.map((order: any) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={order.id} className="flex items-center gap-3 p-2.5 bg-muted/10 rounded-lg border border-border/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{order.order_ref}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.badgeClass}`}>{cfg.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })} · ${Number(order.total).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Addresses */}
          {addresses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><MapPin size={14} /> Adresses ({addresses.length})</h3>
              <div className="space-y-1">
                {addresses.map((addr: any) => (
                  <div key={addr.id} className="text-xs bg-muted/20 rounded-lg p-2.5">
                    <p className="font-medium text-foreground">{addr.label || "Adresse"} {addr.is_default && "⭐"}</p>
                    <p className="text-muted-foreground">{[addr.address, addr.city, addr.country].filter(Boolean).join(", ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
