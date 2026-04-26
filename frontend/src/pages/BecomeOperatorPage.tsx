/**
 * BecomeOperatorPage — Lot 11B Phase B2
 *
 * Parcours d'enregistrement KYB pour devenir opérateur de livraison.
 * Wizard 4 étapes : identité → couverture → flotte → quota & récap.
 * Soumission via edge function `become-operator-submit`.
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
import { toast } from "sonner";
import { z } from "zod";
import {
  Building2, MapPin, Truck, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Plus, X,
  ShieldCheck, AlertCircle,
} from "lucide-react";

const VEHICLE_TYPES = [
  { value: "moto", label: "Moto" },
  { value: "voiture", label: "Voiture" },
  { value: "tricycle", label: "Tricycle" },
  { value: "camionnette", label: "Camionnette" },
];

const formSchema = z.object({
  company_name: z.string().trim().min(2, "Nom obligatoire").max(120),
  legal_name: z.string().trim().max(160).optional(),
  registration_number: z.string().trim().max(60).optional(),
  tax_id: z.string().trim().max(60).optional(),
  contact_email: z.string().trim().email("Email invalide"),
  contact_phone: z.string().trim().min(6, "Téléphone obligatoire").max(30),
  headquarters_country: z.string().min(2),
  headquarters_city: z.string().trim().min(1, "Ville obligatoire"),
  headquarters_address: z.string().trim().max(240).optional(),
  cities: z.array(z.object({
    country_code: z.string().min(2),
    city: z.string().trim().min(1),
  })).min(1, "Au moins une ville de couverture"),
  vehicle_types: z.array(z.object({
    type: z.string(),
    count: z.number().int().min(1).max(50),
  })).min(1, "Déclarez au moins un véhicule"),
  declared_riders_count: z.number().int().min(1).max(30),
});

type FormState = z.infer<typeof formSchema>;

export default function BecomeOperatorPage() {
  const { user, loading: authLoading } = useAuth();
  const { operator, loading: opLoading } = useOperatorContext();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<FormState>({
    company_name: "",
    legal_name: "",
    registration_number: "",
    tax_id: "",
    contact_email: user?.email ?? "",
    contact_phone: "",
    headquarters_country: "CD",
    headquarters_city: "",
    headquarters_address: "",
    cities: [{ country_code: "CD", city: "" }],
    vehicle_types: [{ type: "moto", count: 1 }],
    declared_riders_count: 1,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/become-operator", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!opLoading && operator) {
      // User est déjà opérateur → redirige vers dashboard
      navigate("/operator", { replace: true });
    }
  }, [opLoading, operator, navigate]);

  if (authLoading || opLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addCity = () =>
    update("cities", [...form.cities, { country_code: "CD", city: "" }]);
  const removeCity = (i: number) =>
    update("cities", form.cities.filter((_, idx) => idx !== i));
  const updateCity = (i: number, patch: Partial<{ country_code: string; city: string }>) =>
    update("cities", form.cities.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  const addVehicle = () => {
    const used = new Set(form.vehicle_types.map((v) => v.type));
    const next = VEHICLE_TYPES.find((v) => !used.has(v.value));
    if (next) update("vehicle_types", [...form.vehicle_types, { type: next.value, count: 1 }]);
  };
  const removeVehicle = (i: number) =>
    update("vehicle_types", form.vehicle_types.filter((_, idx) => idx !== i));
  const updateVehicle = (i: number, patch: Partial<{ type: string; count: number }>) =>
    update("vehicle_types", form.vehicle_types.map((v, idx) => idx === i ? { ...v, ...patch } : v));

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.company_name.trim()) return "Nom de l'entreprise obligatoire";
      if (!form.contact_email.trim() || !form.contact_email.includes("@")) return "Email invalide";
      if (!form.contact_phone.trim()) return "Téléphone obligatoire";
    }
    if (s === 2) {
      if (!form.headquarters_city.trim()) return "Ville du siège obligatoire";
      if (form.cities.some((c) => !c.city.trim())) return "Toutes les villes doivent être renseignées";
    }
    if (s === 3) {
      if (form.vehicle_types.some((v) => v.count < 1)) return "Quantité minimale : 1";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = async () => {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("become-operator-submit", {
        body: parsed.data,
      });
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
              Vous recevrez un email à <strong>{form.contact_email}</strong> dès validation.
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
        {/* Header */}
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
              {step === 2 && <><MapPin size={18} />Couverture géographique</>}
              {step === 3 && <><Truck size={18} />Flotte déclarée</>}
              {step === 4 && <><CheckCircle2 size={18} />Récapitulatif</>}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Informations légales et contact"}
              {step === 2 && "Adresse du siège et villes desservies"}
              {step === 3 && "Types et quantité de véhicules"}
              {step === 4 && "Vérifiez avant soumission"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div>
                  <Label htmlFor="company_name">Nom commercial *</Label>
                  <Input id="company_name" value={form.company_name}
                    onChange={(e) => update("company_name", e.target.value)}
                    placeholder="Ex: Kinshasa Express Logistics" />
                </div>
                <div>
                  <Label htmlFor="legal_name">Raison sociale</Label>
                  <Input id="legal_name" value={form.legal_name ?? ""}
                    onChange={(e) => update("legal_name", e.target.value)}
                    placeholder="Ex: KEL SARL" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="registration_number">N° RCCM</Label>
                    <Input id="registration_number" value={form.registration_number ?? ""}
                      onChange={(e) => update("registration_number", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="tax_id">N° NIF</Label>
                    <Input id="tax_id" value={form.tax_id ?? ""}
                      onChange={(e) => update("tax_id", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="contact_email">Email de contact *</Label>
                  <Input id="contact_email" type="email" value={form.contact_email}
                    onChange={(e) => update("contact_email", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="contact_phone">Téléphone *</Label>
                  <Input id="contact_phone" value={form.contact_phone}
                    onChange={(e) => update("contact_phone", e.target.value)}
                    placeholder="+243..." />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="hq_country">Pays siège *</Label>
                    <Input id="hq_country" value={form.headquarters_country} maxLength={3}
                      onChange={(e) => update("headquarters_country", e.target.value.toUpperCase())} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="hq_city">Ville siège *</Label>
                    <Input id="hq_city" value={form.headquarters_city}
                      onChange={(e) => update("headquarters_city", e.target.value)}
                      placeholder="Ex: Kinshasa" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="hq_address">Adresse complète</Label>
                  <Input id="hq_address" value={form.headquarters_address ?? ""}
                    onChange={(e) => update("headquarters_address", e.target.value)} />
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Villes desservies *</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addCity}>
                      <Plus size={14} /> Ajouter
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.cities.map((c, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input value={c.country_code} maxLength={3} className="w-20"
                          onChange={(e) => updateCity(i, { country_code: e.target.value.toUpperCase() })}
                          placeholder="Pays" />
                        <Input value={c.city} className="flex-1"
                          onChange={(e) => updateCity(i, { city: e.target.value })}
                          placeholder="Ville" />
                        {form.cities.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeCity(i)}>
                            <X size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Véhicules déclarés *</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addVehicle}
                      disabled={form.vehicle_types.length >= VEHICLE_TYPES.length}>
                      <Plus size={14} /> Ajouter
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.vehicle_types.map((v, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <select value={v.type} className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                          onChange={(e) => updateVehicle(i, { type: e.target.value })}>
                          {VEHICLE_TYPES.map((vt) => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
                        </select>
                        <Input type="number" min={1} max={50} value={v.count} className="w-24"
                          onChange={(e) => updateVehicle(i, { count: Math.max(1, parseInt(e.target.value) || 1) })} />
                        {form.vehicle_types.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeVehicle(i)}>
                            <X size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <Label htmlFor="declared_riders">Nombre de livreurs prévus *</Label>
                  <Input id="declared_riders" type="number" min={1} max={30} value={form.declared_riders_count}
                    onChange={(e) => update("declared_riders_count", Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quota initial accordé : 1 livreur. Vous pourrez demander plus après validation (jusqu'à 30).
                  </p>
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
                <Recap label="Entreprise" value={form.company_name} />
                <Recap label="Email / Téléphone" value={`${form.contact_email} · ${form.contact_phone}`} />
                <Recap label="Siège" value={`${form.headquarters_city}, ${form.headquarters_country}`} />
                <Recap label="Villes desservies" value={form.cities.map((c) => `${c.city} (${c.country_code})`).join(", ")} />
                <Recap label="Flotte" value={form.vehicle_types.map((v) => `${v.count} ${v.type}`).join(", ")} />
                <Recap label="Livreurs déclarés" value={String(form.declared_riders_count)} />
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

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}