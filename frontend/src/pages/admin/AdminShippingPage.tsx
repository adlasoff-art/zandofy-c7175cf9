import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Plane, Ship, TruckIcon, Plus, Trash2, Edit2, Search, Calculator, MapPin,
  Save, X, AlertTriangle, Package, ChevronDown, ChevronUp, Download, Upload, Globe, TrainFront, Loader2,
} from "lucide-react";
import { DynamicShippingCalculator } from "@/components/DynamicShippingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  fetchShippingZones, fetchShippingRoutes, fetchShippingDefaults, fetchCategorySurcharges,
  upsertShippingZone, deleteShippingZone, upsertShippingRoute, deleteShippingRoute,
  upsertShippingDefault, upsertCategorySurcharge, deleteCategorySurcharge,
  calculateShippingQuote,
  type ShippingZone, type ShippingRoute, type ShippingDefault, type CategorySurcharge,
} from "@/services/shipping";
import { fetchCategories, type Category } from "@/services/api";
import { WORLD_CITIES, type WorldCity } from "@/data/world-cities";

const MODE_ICONS: Record<string, React.ReactNode> = {
  air: <Plane size={14} />,
  sea: <Ship size={14} />,
  road: <TruckIcon size={14} />,
  rail: <TruckIcon size={14} />,
};

const MODE_LABELS: Record<string, string> = {
  air: "Aérien",
  sea: "Maritime",
  road: "Routier",
  rail: "Ferroviaire",
};

const UNIT_LABELS: Record<string, string> = {
  kg: "$/kg",
  cbm: "$/CBM",
  fixed: "Fixe",
  km: "$/km",
};

// ── City Search Combobox (supports free-text for any city worldwide) ──
function CitySearchInput({ value, onChange, placeholder }: { value: string; onChange: (city: WorldCity) => void; placeholder?: string }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return WORLD_CITIES.slice(0, 20);
    const q = query.toLowerCase();
    return WORLD_CITIES.filter(c =>
      c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q) || c.countryCode.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [query]);

  // Allow confirming free-text city not in the list
  const handleBlur = () => {
    setTimeout(() => setOpen(false), 200);
    if (query.trim() && !WORLD_CITIES.some(c => `${c.city}, ${c.country}` === query)) {
      // Parse "CityName" or "CityName, CountryCode" format
      const parts = query.split(",").map(s => s.trim());
      const cityName = parts[0] || query.trim();
      const code = (parts[1] || "").toUpperCase().slice(0, 2) || "XX";
      onChange({ city: cityName, country: parts[1]?.trim() || cityName, countryCode: code });
    }
  };

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder || "Tapez n'importe quelle ville..."}
        className="h-9"
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((c, i) => (
            <button
              key={`${c.countryCode}-${c.city}-${i}`}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between"
              onMouseDown={(e) => { e.preventDefault(); onChange(c); setQuery(`${c.city}, ${c.country}`); setOpen(false); }}
            >
              <span>{c.city}</span>
              <span className="text-xs text-muted-foreground">{c.country} ({c.countryCode})</span>
            </button>
          )) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Ville non trouvée dans la liste. Tapez le nom et quittez le champ pour l'utiliser quand même.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Zone Form Dialog ──
function ZoneDialog({ open, onClose, zone, onSave }: {
  open: boolean; onClose: () => void; zone: Partial<ShippingZone> | null; onSave: (z: any) => void;
}) {
  const [form, setForm] = useState({ name: "", zone_type: "city" as string, country_code: "", city: "" });
  useEffect(() => {
    if (zone) setForm({ name: zone.name || "", zone_type: zone.zone_type || "city", country_code: zone.country_code || "", city: zone.city || "" });
    else setForm({ name: "", zone_type: "city", country_code: "", city: "" });
  }, [zone, open]);

  const handleCitySelect = (c: WorldCity) => {
    setForm(f => ({
      ...f,
      name: `${c.city} (${c.countryCode})`,
      city: c.city,
      country_code: c.countryCode,
      zone_type: "city",
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{zone?.id ? "Modifier" : "Nouvelle"} zone</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Rechercher une ville</Label>
            <CitySearchInput
              value={form.city ? `${form.city}, ${form.country_code}` : ""}
              onChange={handleCitySelect}
              placeholder="Ex: Guangzhou, Kinshasa, Paris..."
            />
          </div>
          <div><Label>Nom de la zone</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Guangzhou (CN)" /></div>
          <div><Label>Type</Label>
            <Select value={form.zone_type} onValueChange={v => setForm(f => ({ ...f, zone_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="city">Ville</SelectItem>
                <SelectItem value="country">Pays</SelectItem>
                <SelectItem value="region">Région</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code pays (ISO)</Label><Input value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))} placeholder="CN, CD, US" maxLength={3} /></div>
            <div><Label>Ville</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Kinshasa" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => { if (!form.name.trim()) { toast.error("Nom requis"); return; } onSave({ ...zone, ...form }); }}>
            <Save size={14} className="mr-1" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Route Form Dialog ──
function RouteDialog({ open, onClose, route, zones, onSave }: {
  open: boolean; onClose: () => void; route: Partial<ShippingRoute> | null; zones: ShippingZone[]; onSave: (r: any) => void;
}) {
  const [form, setForm] = useState<any>({
    origin_zone_id: "", destination_zone_id: "", transport_mode: "air",
    rate_unit: "kg", rate_price: 0, min_charge: 0, fuel_surcharge_pct: 0,
    transit_days_min: 1, transit_days_max: 30, is_active: true, notes: "",
  });

  useEffect(() => {
    if (route) setForm({ ...form, ...route });
    else setForm({
      origin_zone_id: "", destination_zone_id: "", transport_mode: "air",
      rate_unit: "kg", rate_price: 0, min_charge: 0, fuel_surcharge_pct: 0,
      transit_days_min: 1, transit_days_max: 30, is_active: true, notes: "",
    });
  }, [route, open]);

  const modeUnits: Record<string, string> = { air: "kg", sea: "cbm", road: "fixed", rail: "kg" };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{route?.id ? "Modifier" : "Nouveau"} tarif</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Label>Origine</Label>
            <Select value={form.origin_zone_id} onValueChange={v => setForm((f: any) => ({ ...f, origin_zone_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Zone d'origine" /></SelectTrigger>
              <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Destination</Label>
            <Select value={form.destination_zone_id} onValueChange={v => setForm((f: any) => ({ ...f, destination_zone_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Zone de destination" /></SelectTrigger>
              <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={form.transport_mode} onValueChange={v => setForm((f: any) => ({ ...f, transport_mode: v, rate_unit: modeUnits[v] || "kg" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="air">✈️ Aérien</SelectItem>
                <SelectItem value="sea">🚢 Maritime</SelectItem>
                <SelectItem value="road">🚛 Routier</SelectItem>
                <SelectItem value="rail">🚂 Ferroviaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unité</Label>
            <Select value={form.rate_unit} onValueChange={v => setForm((f: any) => ({ ...f, rate_unit: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Par kg</SelectItem>
                <SelectItem value="cbm">Par CBM</SelectItem>
                <SelectItem value="fixed">Fixe</SelectItem>
                <SelectItem value="km">Par km</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Prix (USD)</Label><Input type="number" step="0.01" min="0" value={form.rate_price} onChange={e => setForm((f: any) => ({ ...f, rate_price: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label>Minimum ($)</Label><Input type="number" step="0.01" min="0" value={form.min_charge} onChange={e => setForm((f: any) => ({ ...f, min_charge: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label>Surcharge carburant (%)</Label><Input type="number" step="0.1" min="0" value={form.fuel_surcharge_pct} onChange={e => setForm((f: any) => ({ ...f, fuel_surcharge_pct: parseFloat(e.target.value) || 0 }))} /></div>
          <div className="flex gap-2">
            <div className="flex-1"><Label>Transit min (j)</Label><Input type="number" min="1" value={form.transit_days_min} onChange={e => setForm((f: any) => ({ ...f, transit_days_min: parseInt(e.target.value) || 1 }))} /></div>
            <div className="flex-1"><Label>max</Label><Input type="number" min="1" value={form.transit_days_max} onChange={e => setForm((f: any) => ({ ...f, transit_days_max: parseInt(e.target.value) || 30 }))} /></div>
          </div>
          <div className="col-span-2"><Label>Notes</Label><Input value={form.notes || ""} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="Notes internes..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => {
            if (!form.origin_zone_id || !form.destination_zone_id) { toast.error("Sélectionner origine et destination"); return; }
            onSave(form);
          }}>
            <Save size={14} className="mr-1" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Calculator Sidebar ──
function QuoteCalculator({ zones, routes, defaults }: {
  zones: ShippingZone[]; routes: ShippingRoute[]; defaults: ShippingDefault[];
}) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [mode, setMode] = useState("air");
  const [weightKg, setWeightKg] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [lengthCm, setLengthCm] = useState(0);
  const [widthCm, setWidthCm] = useState(0);
  const [heightCm, setHeightCm] = useState(0);
  const [distance, setDistance] = useState(100);
  const [quote, setQuote] = useState<ReturnType<typeof calculateShippingQuote> | null>(null);

  const computedCbm = useMemo(() => {
    if (lengthCm > 0 && widthCm > 0 && heightCm > 0) {
      return (lengthCm * widthCm * heightCm) / 1_000_000;
    }
    return 0;
  }, [lengthCm, widthCm, heightCm]);

  const calculate = () => {
    const matchedRoute = routes.find(r =>
      r.origin_zone_id === origin && r.destination_zone_id === dest && r.transport_mode === mode && r.is_active
    );

    let effectiveRoute: ShippingRoute;
    if (matchedRoute) {
      effectiveRoute = matchedRoute;
    } else {
      const def = defaults.find(d => d.mode === mode);
      if (!def) { toast.error("Aucun tarif par défaut pour ce mode"); return; }
      effectiveRoute = {
        id: "default", origin_zone_id: origin, destination_zone_id: dest,
        transport_mode: mode, rate_unit: def.rate_unit, rate_price: def.default_rate,
        min_charge: 0, fuel_surcharge_pct: 0, transit_days_min: null, transit_days_max: null,
        is_active: true, notes: "Tarif par défaut", created_at: "", updated_at: "",
      };
    }

    const totalWeightGrams = Math.round(weightKg * 1000 * quantity);
    const totalCbm = computedCbm * Math.max(quantity, 1);

    setQuote(calculateShippingQuote({
      route: effectiveRoute,
      weightGrams: totalWeightGrams,
      volumeCBM: totalCbm,
      distanceKm: distance,
    }));
  };

  const isSea = mode === "sea";

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2"><Calculator size={16} className="text-primary" /> Simulateur de devis</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Origine</Label>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
            <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Destination</Label>
          <Select value={dest} onValueChange={setDest}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
            <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Mode</Label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="air">✈️ Aérien</SelectItem>
            <SelectItem value="sea">🚢 Maritime</SelectItem>
            <SelectItem value="road">🚛 Routier</SelectItem>
            <SelectItem value="rail">🚂 Ferroviaire</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Weight in KG (always shown except road) */}
      {mode !== "road" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Poids (kg)</Label>
            <Input type="number" min="0.01" step="0.01" value={weightKg} onChange={e => setWeightKg(parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
            <p className="text-[10px] text-muted-foreground">{Math.round(weightKg * 1000)} g</p>
          </div>
          <div>
            <Label className="text-xs">Quantité</Label>
            <Input type="number" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="h-8 text-xs" />
            <p className="text-[10px] text-muted-foreground">Total: {(weightKg * quantity).toFixed(2)} kg</p>
          </div>
        </div>
      )}
      {/* Dimensions for maritime */}
      {isSea && (
        <div className="space-y-2">
          <Label className="text-xs">Dimensions (cm) — L × l × H</Label>
          <div className="grid grid-cols-3 gap-1">
            <Input type="number" min="0" placeholder="L" value={lengthCm || ""} onChange={e => setLengthCm(parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
            <Input type="number" min="0" placeholder="l" value={widthCm || ""} onChange={e => setWidthCm(parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
            <Input type="number" min="0" placeholder="H" value={heightCm || ""} onChange={e => setHeightCm(parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
          </div>
          {computedCbm > 0 && <p className="text-[10px] text-muted-foreground">Volume: {computedCbm.toFixed(4)} CBM{quantity > 1 ? ` × ${quantity} = ${(computedCbm * quantity).toFixed(4)} CBM` : ""}</p>}
        </div>
      )}
      {mode === "road" && <div><Label className="text-xs">Distance (km)</Label><Input type="number" min="1" value={distance} onChange={e => setDistance(parseInt(e.target.value) || 0)} className="h-8 text-xs" /></div>}
      <Button size="sm" className="w-full" onClick={calculate} disabled={!origin || !dest}>
        <Calculator size={14} className="mr-1" /> Calculer
      </Button>
      {quote && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Tarif de base</span><span className="font-medium">${quote.baseRate.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Surcharge carburant</span><span>${quote.fuelSurcharge.toFixed(2)}</span></div>
          {quote.categorySurcharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Surcharge catégorie</span><span>${quote.categorySurcharge.toFixed(2)}</span></div>}
          <div className="border-t border-border pt-1 flex justify-between font-semibold text-sm">
            <span>Total</span><span className="text-primary">${quote.totalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground"><span>Transit</span><span>{quote.transitDays}</span></div>
          {quote.packEfficiency && (
            <div className="mt-2 p-2 bg-accent/20 rounded text-xs">
              <Package size={12} className="inline mr-1" />
              <strong>Pack Efficiency:</strong> {quote.packEfficiency.weightGrams}g/unité → {quote.packEfficiency.unitsPerKg} unités/kg
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CSV Utilities ──
function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const cells: string[] = [];
    let current = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { cells.push(current.trim()); current = ""; }
        else { current += ch; }
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

// ── Main Page ──
const AdminShippingPage: React.FC = () => {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [routes, setRoutes] = useState<ShippingRoute[]>([]);
  const [defaults, setDefaults] = useState<ShippingDefault[]>([]);
  const [surcharges, setSurcharges] = useState<(CategorySurcharge & { category_name?: string })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  // Dialogs
  const [zoneDialog, setZoneDialog] = useState<{ open: boolean; zone: Partial<ShippingZone> | null }>({ open: false, zone: null });
  const [routeDialog, setRouteDialog] = useState<{ open: boolean; route: Partial<ShippingRoute> | null }>({ open: false, route: null });
  const routeFileRef = useRef<HTMLInputElement>(null);
  const zoneFileRef = useRef<HTMLInputElement>(null);
  const cityFileRef = useRef<HTMLInputElement>(null);
  const [cityImporting, setCityImporting] = useState(false);
  const [cityImportResult, setCityImportResult] = useState<string | null>(null);

  // Default rates editing
  const [editingDefaults, setEditingDefaults] = useState(false);
  const [defaultForms, setDefaultForms] = useState<Record<string, { rate: number; unit: string; origin_country: string; label: string }>>({});
  const [showAddDefault, setShowAddDefault] = useState(false);
  const [newDefault, setNewDefault] = useState({ mode: "air", rate: 0, unit: "kg", origin_country: "", label: "" });

  const load = async () => {
    setLoading(true);
    const [z, r, d, s, c] = await Promise.all([
      fetchShippingZones(), fetchShippingRoutes(), fetchShippingDefaults(),
      fetchCategorySurcharges(), fetchCategories(),
    ]);
    setZones(z); setRoutes(r); setDefaults(d); setSurcharges(s); setCategories(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    let result = routes;
    if (modeFilter !== "all") result = result.filter(r => r.transport_mode === modeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.origin_zone?.name?.toLowerCase().includes(q) ||
        r.destination_zone?.name?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [routes, modeFilter, search]);

  // Save zone
  const handleSaveZone = async (zone: any) => {
    const { error } = await upsertShippingZone(zone);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Zone enregistrée");
    setZoneDialog({ open: false, zone: null });
    load();
  };

  // Delete zone
  const handleDeleteZone = async (id: string) => {
    if (!confirm("Supprimer cette zone ? Les tarifs liés seront aussi supprimés.")) return;
    const { error } = await deleteShippingZone(id);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Zone supprimée");
    load();
  };

  // Save route
  const handleSaveRoute = async (route: any) => {
    const { error } = await upsertShippingRoute(route);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Tarif enregistré");
    setRouteDialog({ open: false, route: null });
    load();
  };

  // Delete route
  const handleDeleteRoute = async (id: string) => {
    if (!confirm("Supprimer ce tarif ?")) return;
    const { error } = await deleteShippingRoute(id);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Tarif supprimé");
    load();
  };

  // Save defaults
  const handleSaveDefaults = async () => {
    for (const key of Object.keys(defaultForms)) {
      const f = defaultForms[key];
      if (!f) continue;
      const existing = defaults.find(d => `${d.mode}-${d.origin_country || "global"}` === key);
      await upsertShippingDefault({
        id: existing?.id,
        mode: key.split("-")[0],
        default_rate: f.rate,
        rate_unit: f.unit,
        currency: "USD",
        origin_country: f.origin_country || null,
        label: f.label || null,
      } as any);
    }
    toast.success("Tarifs par défaut mis à jour");
    setEditingDefaults(false);
    load();
  };

  const handleAddDefault = async () => {
    await upsertShippingDefault({
      mode: newDefault.mode,
      default_rate: newDefault.rate,
      rate_unit: newDefault.unit,
      currency: "USD",
      origin_country: newDefault.origin_country || null,
      label: newDefault.label || null,
    } as any);
    toast.success("Tarif ajouté");
    setShowAddDefault(false);
    setNewDefault({ mode: "air", rate: 0, unit: "kg", origin_country: "", label: "" });
    load();
  };

  const handleDeleteDefault = async (id: string) => {
    if (!confirm("Supprimer ce tarif par défaut ?")) return;
    const { error } = await supabase.from("shipping_defaults").delete().eq("id", id);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Tarif supprimé");
    load();
  };

  useEffect(() => {
    if (editingDefaults) {
      const forms: Record<string, { rate: number; unit: string; origin_country: string; label: string }> = {};
      for (const d of defaults) {
        const key = `${d.mode}-${d.origin_country || "global"}`;
        forms[key] = { rate: d.default_rate, unit: d.rate_unit, origin_country: d.origin_country || "", label: d.label || "" };
      }
      setDefaultForms(forms);
    }
  }, [editingDefaults, defaults]);
  // ── CSV Import Handlers ──
  const handleImportRoutes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { toast.error("Fichier CSV vide ou invalide"); return; }
    const dataRows = rows.slice(1);
    let imported = 0;
    for (const row of dataRows) {
      const [originName, destName, mode, unit, price, minCharge, fuelPct, tMin, tMax, active, notes] = row;
      const originZone = zones.find(z => z.name.toLowerCase() === originName?.toLowerCase());
      const destZone = zones.find(z => z.name.toLowerCase() === destName?.toLowerCase());
      if (!originZone || !destZone) continue;
      await upsertShippingRoute({
        origin_zone_id: originZone.id, destination_zone_id: destZone.id,
        transport_mode: mode || "air", rate_unit: unit || "kg",
        rate_price: parseFloat(price) || 0, min_charge: parseFloat(minCharge) || 0,
        fuel_surcharge_pct: parseFloat(fuelPct) || 0,
        transit_days_min: parseInt(tMin) || 1, transit_days_max: parseInt(tMax) || 30,
        is_active: (active || "oui").toLowerCase() !== "non", notes: notes || null,
      });
      imported++;
    }
    toast.success(`${imported} tarif(s) importé(s)`);
    load();
  };

  const handleImportZones = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { toast.error("Fichier CSV vide ou invalide"); return; }
    const dataRows = rows.slice(1);
    let imported = 0;
    for (const row of dataRows) {
      const [name, type, countryCode, city] = row;
      if (!name?.trim()) continue;
      await upsertShippingZone({ name: name.trim(), zone_type: type || "city", country_code: countryCode || null, city: city || null });
      imported++;
    }
    toast.success(`${imported} zone(s) importée(s)`);
    load();
  };

  // ── City CSV Import Handler ──
  const handleImportCities = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setCityImporting(true);
    setCityImportResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { toast.error("Fichier CSV vide ou invalide"); setCityImporting(false); return; }
      
      const headers = rows[0].map(h => h.toLowerCase().trim());
      const nameIdx = headers.findIndex(h => h === "name" || h === "nom" || h === "city" || h === "ville");
      const ccIdx = headers.findIndex(h => h === "country_code" || h === "code_pays" || h === "cc" || h === "country");
      const latIdx = headers.findIndex(h => h === "latitude" || h === "lat");
      const lonIdx = headers.findIndex(h => h === "longitude" || h === "lon" || h === "lng");
      const popIdx = headers.findIndex(h => h === "population" || h === "pop");
      
      if (nameIdx === -1 || latIdx === -1 || lonIdx === -1) {
        toast.error("Colonnes requises : name/nom, latitude/lat, longitude/lon");
        setCityImporting(false);
        return;
      }

      const { supabase } = await import("@/integrations/supabase/client");
      const dataRows = rows.slice(1);
      let imported = 0, skipped = 0;
      const batchSize = 50;
      
      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize).map(row => ({
          name: row[nameIdx]?.trim(),
          country_code: (row[ccIdx] || "XX").trim().toUpperCase().slice(0, 3),
          latitude: parseFloat(row[latIdx]) || 0,
          longitude: parseFloat(row[lonIdx]) || 0,
          population: popIdx !== -1 ? (parseInt(row[popIdx]) || 0) : 0,
        })).filter(c => c.name && c.latitude !== 0 && c.longitude !== 0);

        if (batch.length === 0) continue;

        const { error, data } = await supabase
          .from("cities")
          .upsert(batch, { onConflict: "name,country_code", ignoreDuplicates: true });
        
        if (error) {
          // Fallback: insert one by one
          for (const city of batch) {
            const { error: singleErr } = await supabase.from("cities").insert(city);
            if (singleErr) skipped++; else imported++;
          }
        } else {
          imported += batch.length;
        }
      }
      
      setCityImportResult(`${imported} ville(s) importée(s), ${skipped} ignorée(s)`);
      toast.success(`${imported} ville(s) importée(s)`);
    } catch (err) {
      toast.error("Erreur lors de l'import: " + String(err));
    } finally {
      setCityImporting(false);
    }
  };

  return (
    <AdminLayout title="Moteur de Tarification Fret">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          <Tabs defaultValue="calculator">
            <TabsList>
              <TabsTrigger value="calculator"><Globe size={14} className="mr-1" />Calculateur</TabsTrigger>
              <TabsTrigger value="routes">Tarifs & Routes</TabsTrigger>
              <TabsTrigger value="zones">Zones</TabsTrigger>
              <TabsTrigger value="cities"><MapPin size={14} className="mr-1" />Villes</TabsTrigger>
              <TabsTrigger value="defaults">Défauts</TabsTrigger>
              <TabsTrigger value="surcharges">Surcharges</TabsTrigger>
            </TabsList>

            {/* ── Dynamic Calculator Tab ── */}
            <TabsContent value="calculator" className="space-y-4">
              <DynamicShippingCalculator />
            </TabsContent>

            {/* ── Routes Tab ── */}
            <TabsContent value="routes" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher routes..." className="pl-8 h-9" />
                </div>
                <Select value={modeFilter} onValueChange={setModeFilter}>
                  <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les modes</SelectItem>
                    <SelectItem value="air">✈️ Aérien</SelectItem>
                    <SelectItem value="sea">🚢 Maritime</SelectItem>
                    <SelectItem value="road">🚛 Routier</SelectItem>
                    <SelectItem value="rail">🚂 Ferroviaire</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => {
                  const headers = ["Origine", "Destination", "Mode", "Unité", "Prix", "Minimum", "Carburant%", "TransitMin", "TransitMax", "Actif", "Notes"];
                  const rows = routes.map(r => [
                    r.origin_zone?.name || "", r.destination_zone?.name || "", r.transport_mode,
                    r.rate_unit, String(r.rate_price), String(r.min_charge), String(r.fuel_surcharge_pct),
                    String(r.transit_days_min ?? ""), String(r.transit_days_max ?? ""), r.is_active ? "oui" : "non", r.notes || "",
                  ]);
                  downloadCsv("tarifs-fret.csv", headers, rows);
                  toast.success(`${rows.length} tarifs exportés`);
                }}>
                  <Download size={14} className="mr-1" /> Export CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => routeFileRef.current?.click()}>
                  <Upload size={14} className="mr-1" /> Import CSV
                </Button>
                <input ref={routeFileRef} type="file" accept=".csv" className="hidden" onChange={handleImportRoutes} />
                <Button size="sm" onClick={() => setRouteDialog({ open: true, route: null })}>
                  <Plus size={14} className="mr-1" /> Nouveau tarif
                </Button>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origine</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Tarif</TableHead>
                      <TableHead>Min.</TableHead>
                      <TableHead>Carburant</TableHead>
                      <TableHead>Transit</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                    ) : filteredRoutes.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun tarif configuré</TableCell></TableRow>
                    ) : filteredRoutes.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-xs">{r.origin_zone?.name || "—"}</TableCell>
                        <TableCell className="text-xs">{r.destination_zone?.name || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="gap-1 text-xs">{MODE_ICONS[r.transport_mode]} {MODE_LABELS[r.transport_mode]}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">${r.rate_price.toFixed(2)}/{r.rate_unit}</TableCell>
                        <TableCell className="font-mono text-xs">${r.min_charge.toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{r.fuel_surcharge_pct}%</TableCell>
                        <TableCell className="text-xs">{r.transit_days_min}–{r.transit_days_max}j</TableCell>
                        <TableCell><Badge variant={r.is_active ? "default" : "secondary"} className="text-xs">{r.is_active ? "Actif" : "Inactif"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRouteDialog({ open: true, route: r })}><Edit2 size={13} /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteRoute(r.id)}><Trash2 size={13} /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Zones Tab ── */}
            <TabsContent value="zones" className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <p className="text-sm text-muted-foreground">Gérer les zones géographiques utilisées dans les tarifs.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const headers = ["Nom", "Type", "CodePays", "Ville"];
                    const rows = zones.map(z => [z.name, z.zone_type, z.country_code || "", z.city || ""]);
                    downloadCsv("zones-shipping.csv", headers, rows);
                    toast.success(`${rows.length} zones exportées`);
                  }}>
                    <Download size={14} className="mr-1" /> Export CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => zoneFileRef.current?.click()}>
                    <Upload size={14} className="mr-1" /> Import CSV
                  </Button>
                  <input ref={zoneFileRef} type="file" accept=".csv" className="hidden" onChange={handleImportZones} />
                  <Button size="sm" onClick={() => setZoneDialog({ open: true, zone: null })}><Plus size={14} className="mr-1" /> Nouvelle zone</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {zones.map(z => (
                  <div key={z.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-primary" />
                        <span className="font-medium text-sm">{z.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {z.zone_type === "country" ? "Pays" : z.zone_type === "city" ? "Ville" : "Région"}
                        {z.country_code && ` · ${z.country_code}`}
                        {z.city && ` · ${z.city}`}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoneDialog({ open: true, zone: z })}><Edit2 size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteZone(z.id)}><Trash2 size={13} /></Button>
                    </div>
                  </div>
                ))}
                {zones.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Aucune zone. Créez votre première zone pour commencer.</p>}
              </div>
            </TabsContent>

            {/* ── Cities Import Tab ── */}
            <TabsContent value="cities" className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Importez des milliers de villes avec coordonnées GPS via fichier CSV.</p>
                  <p className="text-xs text-muted-foreground mt-1">Format requis : <code className="bg-muted px-1 rounded">name, country_code, latitude, longitude, population</code></p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={async () => {
                    const { supabase } = await import("@/integrations/supabase/client");
                    const { data } = await supabase.from("cities").select("name, country_code, latitude, longitude, population").order("country_code, name");
                    if (!data || data.length === 0) { toast.error("Aucune ville à exporter"); return; }
                    const headers = ["name", "country_code", "latitude", "longitude", "population"];
                    const rows = data.map((c: any) => [c.name, c.country_code, String(c.latitude), String(c.longitude), String(c.population || 0)]);
                    downloadCsv("cities-export.csv", headers, rows);
                    toast.success(`${rows.length} villes exportées`);
                  }}>
                    <Download size={14} className="mr-1" /> Export CSV
                  </Button>
                  <Button size="sm" onClick={() => cityFileRef.current?.click()} disabled={cityImporting}>
                    {cityImporting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Upload size={14} className="mr-1" />}
                    Import CSV massif
                  </Button>
                  <input ref={cityFileRef} type="file" accept=".csv" className="hidden" onChange={handleImportCities} />
                </div>
              </div>

              {cityImportResult && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-primary">
                  ✅ {cityImportResult}
                </div>
              )}

              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-sm">📋 Format CSV attendu</h4>
                <div className="bg-card border border-border rounded-lg p-3 font-mono text-xs overflow-x-auto">
                  <div className="text-muted-foreground">name,country_code,latitude,longitude,population</div>
                  <div>Shanghai,CN,31.2304,121.4737,24281400</div>
                  <div>Lagos,NG,6.5244,3.3792,15388000</div>
                  <div>Kinshasa,CD,-4.4419,15.2663,14970000</div>
                  <div>Dubai,AE,25.2048,55.2708,3400800</div>
                  <div>Paris,FR,48.8566,2.3522,2161000</div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Les colonnes <strong>name</strong>, <strong>latitude</strong> et <strong>longitude</strong> sont obligatoires</p>
                  <p>• <strong>country_code</strong> : code ISO 2-3 lettres (ex: CN, CD, FR). Par défaut : XX</p>
                  <p>• <strong>population</strong> : utilisée pour le tri par priorité (optionnel)</p>
                  <p>• L'import fonctionne par lots de 50 pour supporter des milliers de villes</p>
                  <p>• Les doublons (même nom + pays) sont ignorés automatiquement</p>
                </div>
              </div>
            </TabsContent>

            {/* ── Defaults Tab ── */}
            <TabsContent value="defaults" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Tarifs de repli globaux utilisés quand aucune route spécifique n'est trouvée.</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><AlertTriangle size={12} /> Ex : $19/kg pour l'aérien est un standard industriel.</p>
                </div>
                <Button size="sm" variant={editingDefaults ? "default" : "outline"} onClick={() => editingDefaults ? handleSaveDefaults() : setEditingDefaults(true)}>
                  {editingDefaults ? <><Save size={14} className="mr-1" /> Sauvegarder</> : <><Edit2 size={14} className="mr-1" /> Modifier</>}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {["air", "sea", "road", "rail"].map(mode => {
                  const d = defaults.find(x => x.mode === mode);
                  return (
                    <div key={mode} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        {MODE_ICONS[mode]}
                        <span className="font-semibold text-sm">{MODE_LABELS[mode]}</span>
                      </div>
                      {editingDefaults ? (
                        <div className="space-y-2">
                          <div><Label className="text-xs">Tarif par défaut (USD)</Label>
                            <Input type="number" step="0.01" className="h-8" value={defaultForms[mode]?.rate || 0}
                              onChange={e => setDefaultForms(f => ({ ...f, [mode]: { ...f[mode], rate: parseFloat(e.target.value) || 0 } }))} />
                          </div>
                          <div><Label className="text-xs">Unité</Label>
                            <Select value={defaultForms[mode]?.unit || "kg"} onValueChange={v => setDefaultForms(f => ({ ...f, [mode]: { ...f[mode], unit: v } }))}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">par kg</SelectItem>
                                <SelectItem value="cbm">par CBM</SelectItem>
                                <SelectItem value="fixed">Fixe</SelectItem>
                                <SelectItem value="km">par km</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">${d?.default_rate?.toFixed(2) || "0.00"}</p>
                          <p className="text-xs text-muted-foreground">{UNIT_LABELS[d?.rate_unit || "kg"]}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Surcharges Tab ── */}
            <TabsContent value="surcharges" className="space-y-4">
              <p className="text-sm text-muted-foreground">Surcharges par catégorie de produit (ex : marchandises dangereuses, électronique fragile).</p>
              <div className="border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Valeur</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surcharges.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{s.category_name || "—"}</TableCell>
                        <TableCell className="text-sm">{s.label}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{s.surcharge_type === "percentage" ? "%" : "$"}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{s.surcharge_type === "percentage" ? `${s.surcharge_value}%` : `$${s.surcharge_value.toFixed(2)}`}</TableCell>
                        <TableCell><Badge variant={s.is_active ? "default" : "secondary"} className="text-xs">{s.is_active ? "Actif" : "Inactif"}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                            if (!confirm("Supprimer cette surcharge ?")) return;
                            await deleteCategorySurcharge(s.id);
                            toast.success("Supprimée");
                            load();
                          }}><Trash2 size={13} /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {surcharges.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">Aucune surcharge configurée</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Calculator Sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <QuoteCalculator zones={zones} routes={routes} defaults={defaults} />
        </div>
      </div>

      {/* Dialogs */}
      <ZoneDialog open={zoneDialog.open} onClose={() => setZoneDialog({ open: false, zone: null })} zone={zoneDialog.zone} onSave={handleSaveZone} />
      <RouteDialog open={routeDialog.open} onClose={() => setRouteDialog({ open: false, route: null })} route={routeDialog.route} zones={zones} onSave={handleSaveRoute} />
    </AdminLayout>
  );
};

export default AdminShippingPage;
