import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, X, Search } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type ProfileMatch = { id: string; user_id: string; first_name: string | null; last_name: string | null; email: string | null };
type CityRow = { city: string; country_code: string };
type VehicleRow = { type: string; count: number };

const VEHICLES = ["moto", "voiture", "tricycle", "camionnette", "velo"] as const;

export function CreateOperatorDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  // Owner search
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerMatches, setOwnerMatches] = useState<ProfileMatch[]>([]);
  const [ownerSelected, setOwnerSelected] = useState<ProfileMatch | null>(null);
  const [searching, setSearching] = useState(false);

  // Form
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [hqCountry, setHqCountry] = useState("CD");
  const [hqCity, setHqCity] = useState("");
  const [hqAddress, setHqAddress] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [declaredRiders, setDeclaredRiders] = useState(5);
  const [maxRiders, setMaxRiders] = useState(10);
  const [isPlatformOwned, setIsPlatformOwned] = useState(false);
  const [commissionPct, setCommissionPct] = useState("15");
  const [vehicles, setVehicles] = useState<VehicleRow[]>([{ type: "moto", count: 5 }]);
  const [cities, setCities] = useState<CityRow[]>([{ city: "", country_code: "CD" }]);

  const reset = () => {
    setOwnerSearch(""); setOwnerMatches([]); setOwnerSelected(null);
    setCompanyName(""); setLegalName(""); setContactEmail(""); setContactPhone("");
    setHqCountry("CD"); setHqCity(""); setHqAddress("");
    setRegistrationNumber(""); setTaxId("");
    setDeclaredRiders(5); setMaxRiders(10);
    setIsPlatformOwned(false); setCommissionPct("15");
    setVehicles([{ type: "moto", count: 5 }]);
    setCities([{ city: "", country_code: "CD" }]);
  };

  const searchOwner = async () => {
    if (ownerSearch.trim().length < 2) return;
    setSearching(true);
    const term = ownerSearch.trim();
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id, user_id, first_name, last_name, email")
      .or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
      .limit(8);
    setOwnerMatches((data || []) as ProfileMatch[]);
    setSearching(false);
  };

  const submit = useMutation({
    mutationFn: async () => {
      // validations basiques
      if (companyName.trim().length < 2) throw new Error("Nom de société requis.");
      if (!contactEmail.includes("@")) throw new Error("Email invalide.");
      if (contactPhone.trim().length < 6) throw new Error("Téléphone invalide.");
      if (!hqCity.trim()) throw new Error("Ville du siège requise.");
      if (vehicles.length === 0) throw new Error("Au moins un type de véhicule requis.");
      const cleanCities = cities.filter((c) => c.city.trim().length > 0);
      if (cleanCities.length === 0) throw new Error("Au moins une ville couverte requise.");

      const body: Record<string, unknown> = {
        owner_user_id: ownerSelected?.user_id ?? null,
        company_name: companyName.trim(),
        legal_name: legalName.trim() || null,
        registration_number: registrationNumber.trim() || null,
        tax_id: taxId.trim() || null,
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        headquarters_country: hqCountry.trim().toUpperCase(),
        headquarters_city: hqCity.trim(),
        headquarters_address: hqAddress.trim() || null,
        vehicle_types: vehicles,
        declared_riders_count: declaredRiders,
        max_riders: Math.max(maxRiders, declaredRiders),
        cities: cleanCities.map((c) => ({ city: c.city.trim(), country_code: c.country_code.trim().toUpperCase() })),
        is_platform_owned: isPlatformOwned,
      };
      const pct = parseFloat(commissionPct);
      if (!Number.isNaN(pct) && pct >= 0 && pct <= 100) body.platform_commission_pct = pct;

      const { data, error } = await supabase.functions.invoke("admin-create-operator", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Opérateur créé", description: "L'opérateur a été enregistré et activé." });
      qc.invalidateQueries({ queryKey: ["admin-operators"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Création échouée", variant: "destructive" }),
    onSettled: () => setSubmitting(false),
  });

  const handleSubmit = () => {
    setSubmitting(true);
    submit.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un opérateur de livraison</DialogTitle>
          <DialogDescription>
            Création manuelle (sans modération KYB). L'opérateur sera directement activé.
            Si un utilisateur est associé, il recevra le rôle <code>operator</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Owner */}
          <div className="space-y-2">
            <Label>Propriétaire (optionnel)</Label>
            {ownerSelected ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
                <div>
                  <span className="font-medium text-foreground">
                    {[ownerSelected.first_name, ownerSelected.last_name].filter(Boolean).join(" ") || "—"}
                  </span>
                  <span className="text-muted-foreground"> · {ownerSelected.email}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setOwnerSelected(null)}>
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Email, prénom ou nom…"
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchOwner())}
                  />
                  <Button type="button" variant="outline" onClick={searchOwner} disabled={searching}>
                    {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </Button>
                </div>
                {ownerMatches.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                    {ownerMatches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition"
                        onClick={() => { setOwnerSelected(p); setOwnerMatches([]); setOwnerSearch(""); }}
                      >
                        <div className="text-foreground">
                          {[p.first_name, p.last_name].filter(Boolean).join(" ") || "(sans nom)"}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Si vide → opérateur orphelin (administré par la plateforme).
                </p>
              </>
            )}
          </div>

          {/* Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nom commercial *</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Raison sociale</Label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>RCCM / Registre</Label>
              <Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>N° Fiscal</Label>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email contact *</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone *</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>

          {/* HQ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Pays (ISO 2) *</Label>
              <Input maxLength={2} value={hqCountry} onChange={(e) => setHqCountry(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Ville du siège *</Label>
              <Input value={hqCity} onChange={(e) => setHqCity(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label>Adresse</Label>
              <Input value={hqAddress} onChange={(e) => setHqAddress(e.target.value)} />
            </div>
          </div>

          {/* Riders / commission */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Livreurs déclarés</Label>
              <Input type="number" min={1} max={50} value={declaredRiders}
                onChange={(e) => setDeclaredRiders(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1.5">
              <Label>Quota max</Label>
              <Input type="number" min={1} max={100} value={maxRiders}
                onChange={(e) => setMaxRiders(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1.5">
              <Label>Commission plateforme (%)</Label>
              <Input type="number" min={0} max={100} step="0.5" value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label className="cursor-pointer">Opérateur plateforme</Label>
              <p className="text-xs text-muted-foreground">Coché si géré directement par Zandofy.</p>
            </div>
            <Switch checked={isPlatformOwned} onCheckedChange={setIsPlatformOwned} />
          </div>

          {/* Vehicles */}
          <div className="space-y-2">
            <Label>Flotte déclarée *</Label>
            <div className="space-y-2">
              {vehicles.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={v.type}
                    onChange={(e) => setVehicles((prev) => prev.map((p, idx) => idx === i ? { ...p, type: e.target.value } : p))}
                  >
                    {VEHICLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input
                    type="number" min={1} max={50} value={v.count}
                    onChange={(e) => setVehicles((prev) => prev.map((p, idx) => idx === i ? { ...p, count: parseInt(e.target.value) || 1 } : p))}
                  />
                  {vehicles.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => setVehicles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {vehicles.length < 6 && (
                <Button size="sm" variant="outline" onClick={() => setVehicles((p) => [...p, { type: "moto", count: 1 }])}>
                  <Plus size={14} /> Ajouter
                </Button>
              )}
            </div>
          </div>

          {/* Cities */}
          <div className="space-y-2">
            <Label>Villes couvertes *</Label>
            <div className="space-y-2">
              {cities.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Ville"
                    value={c.city}
                    onChange={(e) => setCities((prev) => prev.map((p, idx) => idx === i ? { ...p, city: e.target.value } : p))}
                  />
                  <Input
                    className="w-20"
                    maxLength={2}
                    placeholder="ISO"
                    value={c.country_code}
                    onChange={(e) => setCities((prev) => prev.map((p, idx) => idx === i ? { ...p, country_code: e.target.value.toUpperCase() } : p))}
                  />
                  {cities.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => setCities((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {cities.length < 50 && (
                <Button size="sm" variant="outline" onClick={() => setCities((p) => [...p, { city: "", country_code: "CD" }])}>
                  <Plus size={14} /> Ajouter
                </Button>
              )}
            </div>
          </div>

          {ownerSelected && (
            <Badge variant="secondary" className="text-xs">
              Le rôle <code>operator</code> sera attribué à {ownerSelected.email}
            </Badge>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin mr-2" />}
            Créer & activer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}