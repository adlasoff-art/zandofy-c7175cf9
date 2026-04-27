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
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { CascadingAddressFields } from "@/components/address/CascadingAddressFields";
import { toast } from "@/hooks/use-toast";
import { Loader2, Building2, MapPin, Settings2 } from "lucide-react";
import { OperatorOwnerSearch, OwnerProfile } from "./OperatorOwnerSearch";
import { OperatorFleetEditor, FleetVehicle, validateFleet, deriveVehicleTypes, MIN_FLEET } from "@/components/operators/OperatorFleetEditor";
import { OperatorCoveragePicker, CoverageZone, validateCoverage } from "@/components/operators/OperatorCoveragePicker";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const MIN_RIDERS = 3;

const initialAddress = {
  country: "CD",
  province: "",
  province_id: "",
  city: "",
  commune: "",
  quartier: "",
  address: "",
  postal_code: "",
};

export function CreateOperatorDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  // Owner
  const [orphan, setOrphan] = useState(false);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);

  // Identité
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Siège (cascade géo réelle)
  const [hq, setHq] = useState({ ...initialAddress });

  // Couverture multi-zones
  const [coverage, setCoverage] = useState<CoverageZone[]>([]);

  // Flotte
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);

  // Paramètres
  const [declaredRiders, setDeclaredRiders] = useState(MIN_RIDERS);
  const [maxRiders, setMaxRiders] = useState(10);
  const [isPlatformOwned, setIsPlatformOwned] = useState(false);
  const [commissionPct, setCommissionPct] = useState("15");

  const reset = () => {
    setOrphan(false); setOwner(null);
    setCompanyName(""); setLegalName(""); setRegistrationNumber(""); setTaxId("");
    setContactEmail(""); setContactPhone("");
    setHq({ ...initialAddress });
    setCoverage([]); setFleet([]);
    setDeclaredRiders(MIN_RIDERS); setMaxRiders(10);
    setIsPlatformOwned(false); setCommissionPct("15");
  };

  const updateHq = (field: keyof typeof initialAddress, value: string) =>
    setHq((prev) => ({ ...prev, [field]: value }));

  const submit = useMutation({
    mutationFn: async () => {
      // Validations
      if (!orphan && !owner) throw new Error("Sélectionnez un propriétaire ou cochez 'Aucun propriétaire'.");
      if (companyName.trim().length < 2) throw new Error("Nom commercial requis.");
      if (!contactEmail.includes("@")) throw new Error("Email de contact invalide.");
      if (contactPhone.trim().length < 6) throw new Error("Téléphone invalide.");
      if (!hq.country) throw new Error("Pays du siège requis.");
      if (!hq.city) throw new Error("Ville du siège requise.");
      if (!hq.commune) throw new Error("Commune du siège requise.");

      const covErr = validateCoverage(coverage);
      if (covErr) throw new Error(covErr);

      const fleetErr = validateFleet(fleet);
      if (fleetErr) throw new Error(fleetErr);

      if (declaredRiders < MIN_RIDERS) throw new Error(`Minimum ${MIN_RIDERS} livreurs déclarés.`);

      const hqAddressLine = [hq.address, hq.quartier, hq.commune].filter(Boolean).join(", ");

      const body: Record<string, unknown> = {
        owner_user_id: orphan ? null : owner?.user_id ?? null,
        company_name: companyName.trim(),
        legal_name: legalName.trim() || null,
        registration_number: registrationNumber.trim() || null,
        tax_id: taxId.trim() || null,
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        headquarters_country: hq.country,
        headquarters_city: hq.city,
        headquarters_address: hqAddressLine || null,
        fleet_vehicles: fleet.map(v => ({
          type: v.type,
          plate_number: v.plate_number.trim().toUpperCase(),
          brand: v.brand?.trim() || undefined,
          model: v.model?.trim() || undefined,
        })),
        vehicle_types: deriveVehicleTypes(fleet),
        declared_riders_count: declaredRiders,
        max_riders: Math.max(maxRiders, declaredRiders),
        cities: coverage.map(z => ({
          country_code: z.country_code,
          city: z.city,
          province_id: z.province_id,
          commune_ids: z.commune_ids,
          quartier_ids: z.quartier_ids,
        })),
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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un opérateur de livraison</DialogTitle>
          <DialogDescription>
            Création manuelle (sans modération KYB). L'opérateur sera directement activé.
            Si un utilisateur est associé, il recevra le rôle <code>operator</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Propriétaire */}
          <Section icon={<Building2 size={14} />} title="1. Propriétaire">
            <OperatorOwnerSearch value={owner} onChange={setOwner} orphan={orphan} onOrphanChange={setOrphan} />
            {owner && (
              <Badge variant="secondary" className="text-xs mt-1">
                Le rôle <code className="mx-1">operator</code> sera attribué à {[owner.first_name, owner.last_name].filter(Boolean).join(" ") || "cet utilisateur"}.
              </Badge>
            )}
          </Section>

          {/* 2. Identité */}
          <Section icon={<Building2 size={14} />} title="2. Identité de l'entreprise">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nom commercial *">
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </Field>
              <Field label="Raison sociale">
                <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
              </Field>
              <Field label="RCCM / Registre">
                <Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
              </Field>
              <Field label="N° Fiscal">
                <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </Field>
              <Field label="Email contact *">
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </Field>
              <Field label="Téléphone *">
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* 3. Siège (cascade) */}
          <Section icon={<MapPin size={14} />} title="3. Siège social">
            <p className="text-xs text-muted-foreground mb-2">
              Sélectionnez via les listes Pays → Province → Ville → Commune → Quartier. Seul le numéro/avenue reste libre.
            </p>
            <CascadingAddressFields data={hq} onChange={updateHq} showPostalCode={false} />
          </Section>

          {/* 4. Couverture */}
          <Section icon={<MapPin size={14} />} title="4. Zones de couverture">
            <OperatorCoveragePicker value={coverage} onChange={setCoverage} restrictToActiveCountries />
          </Section>

          {/* 5. Flotte */}
          <Section icon={<Settings2 size={14} />} title="5. Flotte">
            <OperatorFleetEditor value={fleet} onChange={setFleet} />
          </Section>

          {/* 6. Paramètres */}
          <Section icon={<Settings2 size={14} />} title="6. Paramètres">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label={`Livreurs déclarés (min ${MIN_RIDERS})`}>
                <Input
                  type="number" min={MIN_RIDERS} max={50} value={declaredRiders}
                  onChange={(e) => setDeclaredRiders(Math.max(MIN_RIDERS, parseInt(e.target.value) || MIN_RIDERS))}
                />
              </Field>
              <Field label="Quota max">
                <Input
                  type="number" min={MIN_RIDERS} max={100} value={maxRiders}
                  onChange={(e) => setMaxRiders(parseInt(e.target.value) || MIN_RIDERS)}
                />
              </Field>
              <Field label="Commission plateforme (%)">
                <Input
                  type="number" min={0} max={100} step="0.5" value={commissionPct}
                  onChange={(e) => setCommissionPct(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3 mt-3">
              <div>
                <Label className="cursor-pointer">Opérateur plateforme</Label>
                <p className="text-xs text-muted-foreground">Coché si géré directement par Zandofy.</p>
              </div>
              <Switch checked={isPlatformOwned} onCheckedChange={setIsPlatformOwned} />
            </div>
          </Section>
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

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pb-1 border-b border-border">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}