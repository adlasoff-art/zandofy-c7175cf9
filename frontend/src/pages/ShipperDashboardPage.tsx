import { useState } from "react";
import { Package, Truck, MapPin, Clock, Ship, Plane, TruckIcon, Train, FileText, Search, Bell, User, Home, BarChart3, Loader2, DollarSign, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { Navigate, NavLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const modeIcons: Record<string, React.ElementType> = { air: Plane, sea: Ship, road: TruckIcon, rail: Train };
const modeLabels: Record<string, string> = { air: "Aérien", sea: "Maritime", road: "Routier", rail: "Ferroviaire" };
const statusLabels: Record<string, string> = {
  in_transit: "En transit", customs: "Dédouanement", arrived: "Arrivé au hub", loading: "Chargement", delivered: "Livré",
};
const statusStyles: Record<string, string> = {
  in_transit: "bg-blue-100 text-blue-700", customs: "bg-amber-100 text-amber-700",
  arrived: "bg-primary/10 text-primary", loading: "bg-muted text-muted-foreground", delivered: "bg-primary/10 text-primary",
};

type TabKey = "shipments" | "stats" | "profile";

export default function ShipperDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { isShipper, isAdmin, loading: rolesLoading } = useRoles();
  const [tab, setTab] = useState<TabKey>("shipments");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (s: { awb_bl: string; origin: string; destination: string; mode: string; items_count: number; value: number }) => {
      const { error } = await supabase.from("shipments").insert({ ...s, shipper_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipments"] }); toast.success("Expédition ajoutée"); setShowAdd(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("shipments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipments"] }),
  });

  if (authLoading || rolesLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isShipper && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <Truck size={48} className="text-muted-foreground" />
        <h1 className="text-lg font-bold text-foreground text-center">Accès Transporteur requis</h1>
        <p className="text-sm text-muted-foreground text-center">Contactez l'administrateur pour obtenir le rôle Transporteur.</p>
        <a href="/" className="text-sm text-primary underline">Retour à l'accueil</a>
      </div>
    );
  }

  const filtered = shipments.filter((s: any) => {
    const matchSearch = !search || s.awb_bl.toLowerCase().includes(search.toLowerCase()) || s.destination.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalValue = shipments.reduce((a: number, s: any) => a + Number(s.value), 0);
  const totalItems = shipments.reduce((a: number, s: any) => a + Number(s.items_count), 0);
  const delivered = shipments.filter((s: any) => s.status === "delivered").length;
  const inTransit = shipments.filter((s: any) => s.status === "in_transit").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              <Truck size={20} className="text-primary" /> Hub Transport
            </h1>
            <p className="text-xs text-muted-foreground">Gestion des expéditions internationales</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(true)} className="p-2 rounded-full hover:bg-muted"><Plus size={20} className="text-primary" /></button>
            <button className="p-2 rounded-full hover:bg-muted relative"><Bell size={20} className="text-muted-foreground" /></button>
          </div>
        </div>
      </header>

      {tab === "shipments" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
            {[
              { label: "En transit", value: String(inTransit), icon: Plane },
              { label: "Dédouanement", value: String(shipments.filter((s: any) => s.status === "customs").length), icon: FileText },
              { label: "Livrés", value: String(delivered), icon: CheckCircle },
              { label: "Colis total", value: String(totalItems), icon: Package },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <s.icon size={18} className="text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="px-4 mb-3 space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher AWB / BL..."
                className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["all", "in_transit", "customs", "arrived", "loading", "delivered"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-[11px] rounded-full border whitespace-nowrap transition-colors ${statusFilter === s ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border"}`}>
                  {s === "all" ? "Tous" : statusLabels[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{filtered.length} expédition(s)</h2>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Package size={40} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune expédition trouvée</p>
                <button onClick={() => setShowAdd(true)} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Ajouter une expédition</button>
              </div>
            ) : filtered.map((s: any) => {
              const ModeIcon = modeIcons[s.mode] || Truck;
              return (
                <div key={s.id} className="bg-card border border-border rounded-xl p-4 active:scale-[0.98] transition-transform touch-manipulation">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <ModeIcon size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-foreground font-mono">{s.awb_bl}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[s.status] || ""}`}>
                          {statusLabels[s.status] || s.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <MapPin size={10} /> {s.origin} → {s.destination}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{modeLabels[s.mode] || s.mode} · {s.items_count} colis · ${Number(s.value).toLocaleString()}</span>
                        {s.eta && <span className="flex items-center gap-1 text-muted-foreground"><Clock size={10} /> ETA: {s.eta}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "stats" && (
        <div className="px-4 mt-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Statistiques d'expédition</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <DollarSign size={20} className="text-primary mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">${totalValue.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Valeur totale</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Package size={20} className="text-primary mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{totalItems}</p>
              <p className="text-[10px] text-muted-foreground">Colis traités</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <CheckCircle size={20} className="text-primary mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{delivered}/{shipments.length}</p>
              <p className="text-[10px] text-muted-foreground">Taux livraison</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <AlertTriangle size={20} className="text-amber-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{shipments.filter((s: any) => s.status === "customs").length}</p>
              <p className="text-[10px] text-muted-foreground">En douane</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-foreground mb-3">Par mode de transport</h3>
            {(["air", "sea", "road", "rail"] as const).map((mode) => {
              const ModeIcon = modeIcons[mode];
              const count = shipments.filter((s: any) => s.mode === mode).length;
              const pct = shipments.length ? Math.round((count / shipments.length) * 100) : 0;
              return (
                <div key={mode} className="flex items-center gap-3 py-2">
                  <ModeIcon size={16} className="text-primary shrink-0" />
                  <span className="text-sm text-foreground w-20">{modeLabels[mode]}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={28} className="text-primary" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Profil Transporteur</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Expéditions totales", value: String(shipments.length) },
                { label: "Taux de livraison", value: shipments.length ? `${Math.round((delivered / shipments.length) * 100)}%` : "0%" },
                { label: "Valeur gérée", value: `$${totalValue.toLocaleString()}` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add shipment modal */}
      {showAdd && <AddShipmentModal onClose={() => setShowAdd(false)} onSubmit={(s) => addMutation.mutate(s)} loading={addMutation.isPending} />}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-2 pb-[env(safe-area-inset-bottom)] flex items-center justify-around h-16">
        {([
          { key: "shipments" as TabKey, label: "Expéditions", icon: Package },
          { key: "stats" as TabKey, label: "Statistiques", icon: BarChart3 },
          { key: "profile" as TabKey, label: "Profil", icon: User },
        ]).map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[64px] rounded-lg transition-colors active:scale-95 touch-manipulation ${tab === item.key ? "text-primary" : "text-muted-foreground"}`}>
            <item.icon size={22} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <NavLink to="/" className="flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[64px] rounded-lg text-muted-foreground active:scale-95 touch-manipulation">
          <Home size={22} />
          <span className="text-[10px] font-medium">Accueil</span>
        </NavLink>
      </nav>
    </div>
  );
}

function AddShipmentModal({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (s: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ awb_bl: "", origin: "", destination: "", mode: "air", items_count: 1, value: 0 });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-xl w-full max-w-md p-5 space-y-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-foreground">Nouvelle expédition</h3>
        <input placeholder="N° AWB / BL" value={form.awb_bl} onChange={(e) => setForm({ ...form, awb_bl: e.target.value })}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Origine" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}
            className="px-3 py-2.5 bg-background border border-border rounded-lg text-sm" />
          <input placeholder="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
            className="px-3 py-2.5 bg-background border border-border rounded-lg text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["air", "sea", "road"] as const).map((m) => (
            <button key={m} onClick={() => setForm({ ...form, mode: m })}
              className={`py-2 text-xs rounded-lg border ${form.mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"}`}>
              {modeLabels[m]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" placeholder="Nb colis" value={form.items_count} onChange={(e) => setForm({ ...form, items_count: +e.target.value })}
            className="px-3 py-2.5 bg-background border border-border rounded-lg text-sm" />
          <input type="number" placeholder="Valeur ($)" value={form.value} onChange={(e) => setForm({ ...form, value: +e.target.value })}
            className="px-3 py-2.5 bg-background border border-border rounded-lg text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
          <button onClick={() => onSubmit(form)} disabled={loading || !form.awb_bl || !form.origin || !form.destination}
            className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
