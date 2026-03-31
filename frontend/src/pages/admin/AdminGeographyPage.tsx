import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CountryCombobox, getCountryName } from "@/components/vendor/CountryCombobox";
import { Plus, Trash2, Edit2, X, Save, Loader2, MapPin, Building, Map, Globe } from "lucide-react";
import { toast } from "sonner";

// Types
interface ProvinceRow { id: string; name: string; country_code: string; is_active: boolean }
interface CityRow { id: string; name: string; country_code: string; province_id: string | null; latitude: number; longitude: number; population: number | null }
interface CommuneRow { id: string; city: string; country_code: string; name: string; is_active: boolean }
interface QuartierRow { id: string; commune_id: string; name: string; is_active: boolean; is_restricted: boolean; restriction_reason: string | null }

const selectClass = "mt-1 w-full px-3 py-2 text-sm border border-border rounded-md bg-card";

// ── Provinces Tab ──
function ProvincesTab() {
  const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("CD");
  const [form, setForm] = useState({ name: "", country_code: "CD" });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("provinces").select("*")
      .eq("country_code", filterCountry).order("name").limit(500);
    setProvinces((data || []) as ProvinceRow[]);
    setLoading(false);
  }, [filterCountry]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    if (!form.name) { toast.error("Nom requis"); return; }
    const payload = { name: form.name, country_code: form.country_code };
    if (editId) {
      await (supabase as any).from("provinces").update(payload).eq("id", editId);
    } else {
      await (supabase as any).from("provinces").insert(payload);
    }
    setShowForm(false); setEditId(null);
    setForm({ name: "", country_code: filterCountry });
    fetch();
    toast.success(editId ? "Province modifiée" : "Province ajoutée");
  };

  const handleEdit = (p: ProvinceRow) => {
    setForm({ name: p.name, country_code: p.country_code });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("provinces").delete().eq("id", id);
    fetch();
    toast.success("Province supprimée");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="w-48">
          <CountryCombobox value={filterCountry} onChange={setFilterCountry} label="Filtrer par pays" showNone={false} />
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", country_code: filterCountry }); }}>
          <Plus size={14} className="mr-1" /> Ajouter une province
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold">{editId ? "Modifier" : "Nouvelle province"}</h4>
            <button onClick={() => { setShowForm(false); setEditId(null); }}><X size={16} className="text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Nom *</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><CountryCombobox value={form.country_code} onChange={v => setForm(f => ({ ...f, country_code: v }))} label="Pays" showNone={false} /></div>
          </div>
          <Button size="sm" onClick={handleSave}><Save size={14} className="mr-1" /> {editId ? "Modifier" : "Ajouter"}</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Province / État</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {provinces.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{getCountryName(p.country_code)} ({p.country_code})</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(p)} className="p-1 text-muted-foreground hover:text-primary"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {provinces.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Aucune province</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Cities Tab ── (linked to province)
function CitiesTab() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("CD");
  const [filterProvince, setFilterProvince] = useState("");
  const [form, setForm] = useState({ name: "", country_code: "CD", province_id: "", latitude: "", longitude: "", population: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Load provinces for filter & form
  useEffect(() => {
    (supabase as any).from("provinces").select("id, name, country_code, is_active")
      .eq("country_code", filterCountry).order("name")
      .then(({ data }: any) => setProvinces((data || []) as ProvinceRow[]));
  }, [filterCountry]);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q: any = (supabase as any).from("cities").select("id, name, country_code, province_id, latitude, longitude, population").order("name").limit(500);
    q = q.eq("country_code", filterCountry);
    if (filterProvince) q = q.eq("province_id", filterProvince);
    const { data } = await q;
    setCities((data || []) as CityRow[]);
    setLoading(false);
  }, [filterCountry, filterProvince]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    if (!form.name || !form.country_code) { toast.error("Nom et pays requis"); return; }
    const payload: any = {
      name: form.name,
      country_code: form.country_code,
      province_id: form.province_id || null,
      latitude: parseFloat(form.latitude) || 0,
      longitude: parseFloat(form.longitude) || 0,
      population: form.population ? parseInt(form.population) : null,
    };
    if (editId) {
      await supabase.from("cities").update(payload).eq("id", editId);
    } else {
      await supabase.from("cities").insert(payload as any);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", country_code: filterCountry, province_id: filterProvince, latitude: "", longitude: "", population: "" });
    fetch();
    toast.success(editId ? "Ville modifiée" : "Ville ajoutée");
  };

  const handleEdit = (c: CityRow) => {
    setForm({
      name: c.name,
      country_code: c.country_code,
      province_id: c.province_id || "",
      latitude: String(c.latitude),
      longitude: String(c.longitude),
      population: c.population ? String(c.population) : "",
    });
    setEditId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cities").delete().eq("id", id);
    fetch();
    toast.success("Ville supprimée");
  };

  const getProvinceName = (id: string | null) => provinces.find(p => p.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-48">
          <CountryCombobox value={filterCountry} onChange={v => { setFilterCountry(v); setFilterProvince(""); }} label="Pays" showNone={false} />
        </div>
        <div className="w-48">
          <Label className="text-xs text-muted-foreground">Province</Label>
          <select className={selectClass} value={filterProvince} onChange={e => setFilterProvince(e.target.value)}>
            <option value="">Toutes</option>
            {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Button size="sm" className="mt-5" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", country_code: filterCountry, province_id: filterProvince, latitude: "", longitude: "", population: "" }); }}>
          <Plus size={14} className="mr-1" /> Ajouter une ville
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold">{editId ? "Modifier" : "Nouvelle ville"}</h4>
            <button onClick={() => { setShowForm(false); setEditId(null); }}><X size={16} className="text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Nom *</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><CountryCombobox value={form.country_code} onChange={v => setForm(f => ({ ...f, country_code: v }))} label="Pays *" showNone={false} /></div>
            <div>
              <Label className="text-xs">Province</Label>
              <select className={selectClass} value={form.province_id} onChange={e => setForm(f => ({ ...f, province_id: e.target.value }))}>
                <option value="">— Aucune —</option>
                {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Population</Label><Input className="mt-1" type="number" value={form.population} onChange={e => setForm(f => ({ ...f, population: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div><Label className="text-xs">Latitude</Label><Input className="mt-1" type="number" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} /></div>
            <div><Label className="text-xs">Longitude</Label><Input className="mt-1" type="number" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} /></div>
          </div>
          <Button size="sm" onClick={handleSave}><Save size={14} className="mr-1" /> {editId ? "Modifier" : "Ajouter"}</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ville</TableHead>
              <TableHead>Province</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead>Population</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cities.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{getProvinceName(c.province_id)}</TableCell>
                <TableCell>{getCountryName(c.country_code)}</TableCell>
                <TableCell>{c.population?.toLocaleString() || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(c)} className="p-1 text-muted-foreground hover:text-primary"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {cities.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune ville</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Communes Tab ── (linked to city, cascade: province → city)
function CommunesTab() {
  const [communes, setCommunes] = useState<CommuneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("CD");
  const [filterProvince, setFilterProvince] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
  const [cities, setCities] = useState<{ name: string }[]>([]);
  const [form, setForm] = useState({ name: "", city: "", country_code: "CD" });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Load provinces
  useEffect(() => {
    (supabase as any).from("provinces").select("id, name, country_code, is_active")
      .eq("country_code", filterCountry).order("name")
      .then(({ data }: any) => setProvinces((data || []) as ProvinceRow[]));
  }, [filterCountry]);

  // Load cities (filtered by province if set)
  useEffect(() => {
    let q: any = (supabase as any).from("cities").select("name").eq("country_code", filterCountry).order("name");
    if (filterProvince) q = q.eq("province_id", filterProvince);
    q.then(({ data }: any) => setCities((data || []).map((d: any) => ({ name: d.name }))));
  }, [filterCountry, filterProvince]);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("communes").select("*").eq("country_code", filterCountry).order("name").limit(500);
    if (filterCity) q = q.eq("city", filterCity);
    const { data } = await q;
    setCommunes((data || []) as CommuneRow[]);
    setLoading(false);
  }, [filterCountry, filterCity]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    if (!form.name || !form.city) { toast.error("Nom et ville requis"); return; }
    const payload = { name: form.name, city: form.city, country_code: form.country_code };
    if (editId) {
      await (supabase as any).from("communes").update(payload).eq("id", editId);
    } else {
      await (supabase as any).from("communes").insert(payload);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", city: filterCity || "", country_code: filterCountry });
    fetch();
    toast.success(editId ? "Commune modifiée" : "Commune ajoutée");
  };

  const handleEdit = (c: CommuneRow) => {
    setForm({ name: c.name, city: c.city, country_code: c.country_code });
    setEditId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("communes").delete().eq("id", id);
    fetch();
    toast.success("Commune supprimée");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-44">
          <CountryCombobox value={filterCountry} onChange={v => { setFilterCountry(v); setFilterProvince(""); setFilterCity(""); }} label="Pays" showNone={false} />
        </div>
        <div className="w-44">
          <Label className="text-xs text-muted-foreground">Province</Label>
          <select className={selectClass} value={filterProvince} onChange={e => { setFilterProvince(e.target.value); setFilterCity(""); }}>
            <option value="">Toutes</option>
            {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="w-44">
          <Label className="text-xs text-muted-foreground">Ville</Label>
          <select className={selectClass} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
            <option value="">Toutes</option>
            {cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <Button size="sm" className="mt-5" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", city: filterCity, country_code: filterCountry }); }}>
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold">{editId ? "Modifier" : "Nouvelle commune / département"}</h4>
            <button onClick={() => { setShowForm(false); setEditId(null); }}><X size={16} className="text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Nom *</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label className="text-xs">Ville *</Label>
              <select className={selectClass} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
                <option value="">—</option>
                {cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div><CountryCombobox value={form.country_code} onChange={v => setForm(f => ({ ...f, country_code: v }))} label="Pays" showNone={false} /></div>
          </div>
          <Button size="sm" onClick={handleSave}><Save size={14} className="mr-1" /> {editId ? "Modifier" : "Ajouter"}</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Commune / Département</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {communes.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.city}</TableCell>
                <TableCell>{getCountryName(c.country_code)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(c)} className="p-1 text-muted-foreground hover:text-primary"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {communes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune commune</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Quartiers Tab ── (linked to commune, cascade: province → city → commune)
function QuartiersTab() {
  const [quartiers, setQuartiers] = useState<QuartierRow[]>([]);
  const [communes, setCommunes] = useState<{ id: string; name: string; city: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("CD");
  const [filterProvince, setFilterProvince] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterCommune, setFilterCommune] = useState("");
  const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", commune_id: "", is_restricted: false, restriction_reason: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Load provinces
  useEffect(() => {
    (supabase as any).from("provinces").select("id, name, country_code, is_active")
      .eq("country_code", filterCountry).order("name")
      .then(({ data }: any) => setProvinces((data || []) as ProvinceRow[]));
  }, [filterCountry]);

  // Load cities (filtered by province)
  useEffect(() => {
    let q = supabase.from("cities").select("name").eq("country_code", filterCountry).order("name");
    if (filterProvince) q = q.eq("province_id", filterProvince);
    q.then(({ data }) => setCities((data || []).map((d: any) => d.name)));
  }, [filterCountry, filterProvince]);

  // Load communes (filtered by city)
  useEffect(() => {
    let q = (supabase as any).from("communes").select("id, name, city").eq("country_code", filterCountry).order("name");
    if (filterCity) q = q.eq("city", filterCity);
    q.then(({ data }: any) => setCommunes((data || []) as any));
  }, [filterCountry, filterCity]);

  const fetch = useCallback(async () => {
    if (!filterCommune && communes.length === 0) { setQuartiers([]); setLoading(false); return; }
    setLoading(true);
    const communeIds = filterCommune ? [filterCommune] : communes.map(c => c.id);
    if (communeIds.length === 0) { setQuartiers([]); setLoading(false); return; }
    const { data } = await (supabase as any).from("quartiers").select("*").in("commune_id", communeIds).order("name").limit(500);
    setQuartiers((data || []) as QuartierRow[]);
    setLoading(false);
  }, [filterCommune, communes]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    if (!form.name || !form.commune_id) { toast.error("Nom et commune requis"); return; }
    const payload = { name: form.name, commune_id: form.commune_id, is_restricted: form.is_restricted, restriction_reason: form.restriction_reason || null };
    if (editId) {
      await (supabase as any).from("quartiers").update(payload).eq("id", editId);
    } else {
      await (supabase as any).from("quartiers").insert(payload);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", commune_id: filterCommune, is_restricted: false, restriction_reason: "" });
    fetch();
    toast.success(editId ? "Quartier modifié" : "Quartier ajouté");
  };

  const handleEdit = (q: QuartierRow) => {
    setForm({ name: q.name, commune_id: q.commune_id, is_restricted: q.is_restricted, restriction_reason: q.restriction_reason || "" });
    setEditId(q.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("quartiers").delete().eq("id", id);
    fetch();
    toast.success("Quartier supprimé");
  };

  const getCommuneName = (id: string) => communes.find(c => c.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-40">
          <CountryCombobox value={filterCountry} onChange={v => { setFilterCountry(v); setFilterProvince(""); setFilterCity(""); setFilterCommune(""); }} label="Pays" showNone={false} />
        </div>
        <div className="w-40">
          <Label className="text-xs text-muted-foreground">Province</Label>
          <select className={selectClass} value={filterProvince} onChange={e => { setFilterProvince(e.target.value); setFilterCity(""); setFilterCommune(""); }}>
            <option value="">Toutes</option>
            {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="w-40">
          <Label className="text-xs text-muted-foreground">Ville</Label>
          <select className={selectClass} value={filterCity} onChange={e => { setFilterCity(e.target.value); setFilterCommune(""); }}>
            <option value="">Toutes</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="w-44">
          <Label className="text-xs text-muted-foreground">Commune</Label>
          <select className={selectClass} value={filterCommune} onChange={e => setFilterCommune(e.target.value)}>
            <option value="">Toutes</option>
            {communes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
          </select>
        </div>
        <Button size="sm" className="mt-5" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", commune_id: filterCommune, is_restricted: false, restriction_reason: "" }); }}>
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold">{editId ? "Modifier" : "Nouveau quartier / bloc"}</h4>
            <button onClick={() => { setShowForm(false); setEditId(null); }}><X size={16} className="text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Nom *</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label className="text-xs">Commune *</Label>
              <select className={selectClass} value={form.commune_id} onChange={e => setForm(f => ({ ...f, commune_id: e.target.value }))}>
                <option value="">—</option>
                {communes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_restricted} onChange={e => setForm(f => ({ ...f, is_restricted: e.target.checked }))} className="rounded border-border" />
              Zone restreinte
            </label>
            {form.is_restricted && (
              <Input placeholder="Raison de la restriction" value={form.restriction_reason} onChange={e => setForm(f => ({ ...f, restriction_reason: e.target.value }))} className="flex-1 h-8 text-sm" />
            )}
          </div>
          <Button size="sm" onClick={handleSave}><Save size={14} className="mr-1" /> {editId ? "Modifier" : "Ajouter"}</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quartier / Bloc</TableHead>
              <TableHead>Commune</TableHead>
              <TableHead>Restreint</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quartiers.map(q => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.name}</TableCell>
                <TableCell>{getCommuneName(q.commune_id)}</TableCell>
                <TableCell>
                  {q.is_restricted ? (
                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">{q.restriction_reason || "Oui"}</span>
                  ) : <span className="text-xs text-muted-foreground">Non</span>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(q)} className="p-1 text-muted-foreground hover:text-primary"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(q.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {quartiers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun quartier</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Main Page ──
const AdminGeographyPage: React.FC = () => {
  return (
    <AdminLayout title="Zones géographiques">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Globe size={24} /> Zones géographiques</h1>
          <p className="text-sm text-muted-foreground mt-1">Hiérarchie : Pays → Province → Ville → Commune → Quartier</p>
        </div>

        <Tabs defaultValue="provinces">
          <TabsList>
            <TabsTrigger value="provinces" className="gap-1.5"><Globe size={14} /> Provinces</TabsTrigger>
            <TabsTrigger value="cities" className="gap-1.5"><Map size={14} /> Villes</TabsTrigger>
            <TabsTrigger value="communes" className="gap-1.5"><Building size={14} /> Communes</TabsTrigger>
            <TabsTrigger value="quartiers" className="gap-1.5"><MapPin size={14} /> Quartiers</TabsTrigger>
          </TabsList>
          <TabsContent value="provinces"><ProvincesTab /></TabsContent>
          <TabsContent value="cities"><CitiesTab /></TabsContent>
          <TabsContent value="communes"><CommunesTab /></TabsContent>
          <TabsContent value="quartiers"><QuartiersTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminGeographyPage;
