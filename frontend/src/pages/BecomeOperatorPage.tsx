/**
 * BecomeOperatorPage — Lot 11B Phase B2 (refonte 10.2)
 *
 * Wizard 4 étapes : identité → siège+couverture → flotte → récap.
 * Utilise les composants partagés CascadingAddressFields, OperatorCoveragePicker,
 * OperatorFleetEditor pour rester cohérent avec la création admin.
 */
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CascadingAddressFields } from "@/components/address/CascadingAddressFields";
import {
  OperatorCoveragePicker,
  CoverageZone,
  validateCoverage,
} from "@/components/operators/OperatorCoveragePicker";
import {
  OperatorFleetEditor,
  FleetVehicle,
  validateFleet,
  MIN_FLEET,
} from "@/components/operators/OperatorFleetEditor";
import { toast } from "sonner";
import {
  Building2, MapPin, Truck, CheckCircle2, ArrowRight, ArrowLeft, Loader2,
  ShieldCheck, AlertCircle,
} from "lucide-react";

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

export default function BecomeOperatorPage() {
  const { user, loading: authLoading } = useAuth();
  const { operator, loading: opLoading } = useOperatorContext();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Identité
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [contactPhone, setContactPhone] = useState("");

  // Siège (cascade géo)
  const [hq, setHq] = useState({ ...initialAddress });

  // Couverture
  const [coverage, setCoverage] = useState<CoverageZone[]>([]);

  // Flotte
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [declaredRiders, setDeclaredRiders] = useState(MIN_RIDERS);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/become-operator", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!opLoading && operator) navigate("/operator", { replace: true });
  }, [opLoading, operator, navigate]);

  useEffect(() => {
    if (user?.email && !contactEmail) setContactEmail(user.email);
  }, [user]);

  if (authLoading || opLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const updateHq = (field: keyof typeof initialAddress, value: string) =>
    setHq((prev) => ({ ...prev, [field]: value }));

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!companyName.trim()) return "Nom de l'entreprise obligatoire";
      if (!contactEmail.trim() || !contactEmail.includes("@")) return "Email invalide";
      if (!contactPhone.trim() || contactPhone.trim().length < 6) return "Téléphone obligatoire";
    }
    if (s === 2) {
      if (!hq.country) return "Pays du siège obligatoire";
      if (!hq.city) return "Ville du siège obligatoire";
      if (!hq.commune) return "Commune du siège obligatoire";
      const covErr = validateCoverage(coverage);
      if (covErr) return covErr;
    }
    if (s === 3) {
      const fleetErr = validateFleet(fleet);
      if (fleetErr) return fleetErr;
      if (declaredRiders < MIN_RIDERS) return `Minimum ${MIN_RIDERS} livreurs déclarés.`;
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = async () => {
    for (const s of [1, 2, 3]) {
      const err = validateStep(s);
      if (err) { setStep(s); toast.error(err); return; }
    }
    setSubmitting(true);
    try {
      const hqAddressLine = [hq.address, hq.quartier, hq.commune].filter(Boolean).join(", ");
      const body = {
        company_name: companyName.trim(),
        legal_name: legalName.trim() || null,
        registration_number: registrationNumber.trim() || null,
        tax_id: taxId.trim() || null,
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        headquarters_country: hq.country,
        headquarters_city: hq.city,
        headquarters_address: hqAddressLine || null,
        fleet_vehicles: fleet.map((v) => ({
          type: v.type,
          plate_number: v.plate_number.trim().toUpperCase(),
          brand: v.brand?.trim() || undefined,
          model: v.model?.trim() || undefined,
        })),
        declared_riders_count: declaredRiders,
        cities: coverage.map((z) => ({
          country_code: z.country_code,
          city: z.city,
          province_id: z.province_id,
          commune_ids: z.commune_ids,
          quartier_ids: z.quartier_ids,
        })),
      };
      const { data, error } = await supabase.functions.invoke("become-operator-submit", { body });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setSuccess(true);
      toast.success("Demande envoyée avec succès");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={48} />
            <h1 className="text-xl font-bold mb-2">Demande envoyée</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Votre dossier KYB a été reçu. L'équipe Zandofy l'examinera sous 48h ouvrées.
              Vous recevrez un email à <strong>{contactEmail}</strong> dès validation.
            </p>
            <div className="flex gap-2 justify-center">
              <Button asChild variant="outline"><Link to="/">Retour à l'accueil</Link></Button>
              <Button asChild><Link to="/account">Mon compte</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-[hsl(var(--operator-primary))]/10 text-[hsl(var(--operator-primary))] text-xs font-medium">
            <ShieldCheck size={12} />
            Programme Opérateur de Livraison Zandofy
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Devenir opérateur de livraison
          </h1>
          <p className="text-sm text-muted-foreground">
            Rejoignez le réseau Zandofy comme entreprise de livraison du dernier kilomètre.
            Étape {step}/4
          </p>
        </div>

        {/* Stepper */}
        <div className="flex justify-between mb-6 px-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex-1 flex items-center">
              <div className={`h-2 flex-1 rounded-full ${n <= step ? "bg-[hsl(var(--operator-primary))]" : "bg-muted"}`} />
              {n < 4 && <div className="w-2" />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {step === 1 && <><Building2 size={18} />Identité de l'entreprise</>}
              {step === 2 && <><MapPin size={18} />Siège et zones de couverture</>}
              {step === 3 && <><Truck size={18} />Flotte et livreurs</>}
              {step === 4 && <><CheckCircle2 size={18} />Récapitulatif</>}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Informations légales et contact"}
              {step === 2 && "Adresse du siège et zones desservies (cascade géo plateforme)"}
              {step === 3 && `Minimum ${MIN_FLEET} véhicules avec plaque + ${MIN_RIDERS} livreurs`}
              {step === 4 && "Vérifiez avant soumission"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <Field label="Nom commercial *">
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Kinshasa Express Logistics" />
                </Field>
                <Field label="Raison sociale">
                  <Input value={legalName} onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Ex: KEL SARL" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="N° RCCM">
                    <Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
                  </Field>
                  <Field label="N° NIF">
                    <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
                  </Field>
                </div>
                <Field label="Email de contact *">
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </Field>
                <Field label="Téléphone *">
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+243..." />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Building2 size={14} /> Siège social
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Sélectionnez via les listes Pays → Province → Ville → Commune → Quartier.
                    Seul le numéro/avenue reste libre.
                  </p>
                  <CascadingAddressFields data={hq} onChange={updateHq} showPostalCode={false} />
                </div>
                <div className="pt-3 border-t border-border">
                  <OperatorCoveragePicker value={coverage} onChange={setCoverage} restrictToActiveCountries />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <OperatorFleetEditor value={fleet} onChange={setFleet} />
                <div className="pt-3 border-t border-border">
                  <Field label={`Nombre de livreurs prévus * (min ${MIN_RIDERS})`}>
                    <Input type="number" min={MIN_RIDERS} max={30} value={declaredRiders}
                      onChange={(e) => setDeclaredRiders(Math.max(MIN_RIDERS, Math.min(30, parseInt(e.target.value) || MIN_RIDERS)))} />
                    <p className="text-xs text-muted-foreground mt-1">
                      Quota initial accordé après validation. Vous pourrez demander une extension plus tard (jusqu'à 30).
                    </p>
                  </Field>
                </div>
              </>
            )}

            {step === 4 && (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    En soumettant, vous acceptez la commission plateforme par défaut de <strong>25%</strong> sur
                    chaque livraison. Ce taux peut être ajusté par Zandofy après validation.
                  </p>
                </div>
                <Recap label="Entreprise" value={companyName} />
                <Recap label="Email / Téléphone" value={`${contactEmail} · ${contactPhone}`} />
                <Recap label="Siège" value={`${hq.address ? hq.address + ", " : ""}${hq.quartier ? hq.quartier + ", " : ""}${hq.commune}, ${hq.city}, ${hq.country}`} />
                <Recap label="Zones couvertes" value={`${coverage.length} zone(s) · ${coverage.reduce((n, z) => n + z.commune_ids.length, 0)} commune(s)`} />
                <Recap label="Flotte" value={`${fleet.length} véhicule(s) avec plaques`} />
                <Recap label="Livreurs déclarés" value={String(declaredRiders)} />
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-border">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft size={14} /> Précédent
                </Button>
              ) : <div />}
              {step < 4 && (
                <Button onClick={next}>
                  Suivant <ArrowRight size={14} />
                </Button>
              )}
              {step === 4 && (
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  Soumettre la demande
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
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

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0 gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-words">{value}</span>
    </div>
  );
}
