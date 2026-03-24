import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, MapPin, ToggleLeft, ToggleRight, Search } from "lucide-react";
import { toast } from "sonner";

interface DeliveryZone {
  id: string;
  name: string;
  city: string;
  country: string;
  price: number;
  is_active: boolean;
  created_by_admin: boolean;
  created_at: string;
}

export function DeliveryZonesManager() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("CD");
  const [price, setPrice] = useState(3);

  const db = supabase as any;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from("delivery_zones").select("*").order("city", { ascending: true });
    setZones((data || []) as DeliveryZone[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!name.trim() || !city.trim()) { toast.error("Nom et ville requis"); return; }
    setSaving(true);
    const { error } = await db.from("delivery_zones").insert({
      name: name.trim(), city: city.trim(), country, price, created_by_admin: true,
    });
    if (error) toast.error(error.message);
    else { toast.success("Zone créée"); setShowForm(false); setName(""); setCity(""); setPrice(3); load(); }
    setSaving(false);
  };

  const toggle = async (z: DeliveryZone) => {
    await db.from("delivery_zones").update({ is_active: !z.is_active }).eq("id", z.id);
    setZones(prev => prev.map(x => x.id === z.id ? { ...x, is_active: !x.is_active } : x));
  };

  const remove = async (id: string) => {
    await db.from("delivery_zones").delete().eq("id", id);
    setZones(prev => prev.filter(x => x.id !== id));
    toast.success("Zone supprimée");
  };

  const filtered = zones.filter(z =>
    z.name.toLowerCase().includes(search.toLowerCase()) ||
    z.city.toLowerCase().includes(search.toLowerCase())
  );

  const inputClass = "w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> Zones de livraison dernier kilomètre
        </h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1">
          <Plus size={12} /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-primary/20 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nom de la zone</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Gombe" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ville</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Kinshasa" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Pays</label>
              <input value={country} onChange={e => setCountry(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prix ($)</label>
              <input type="number" min={0} step={0.5} value={price} onChange={e => setPrice(Number(e.target.value))} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-muted-foreground">Annuler</button>
            <button onClick={save} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center gap-1">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Créer
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-md" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Aucune zone de livraison</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(z => (
            <div key={z.id} className={`flex items-center gap-3 p-3 bg-card border rounded-lg ${z.is_active ? "border-primary/20" : "border-border opacity-60"}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{z.name}</p>
                <p className="text-[10px] text-muted-foreground">{z.city}, {z.country} · ${z.price.toFixed(2)}</p>
              </div>
              <button onClick={() => toggle(z)} className="p-1.5 rounded-md hover:bg-muted">
                {z.is_active ? <ToggleRight size={16} className="text-primary" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
              </button>
              <button onClick={() => remove(z.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
