/**
 * BecomeForwarderPage — Phase 10
 *
 * Parcours d'enregistrement KYB pour devenir transitaire (freight forwarder).
 * Wizard 5 étapes : identité → contact → capacités → documents → récap.
 * Soumission via edge function `become-forwarder-submit`.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GeoFieldsRow } from "@/components/address/GeoFieldsRow";
import { toast } from "sonner";
import { z } from "zod";
import {
  Building2, MapPin, Ship, FileText, CheckCircle2, ArrowRight, ArrowLeft, Loader2,
  Plus, X, Upload, AlertCircle,
} from "lucide-react";

const TRANSPORT_MODES = [
  { value: "air", label: "Aérien" },
  { value: "sea", label: "Maritime" },
  { value: "road", label: "Routier" },
  { value: "rail", label: "Ferroviaire" },
];

const DOC_TYPES = [
  { value: "registre_commerce", label: "Registre du commerce" },
  { value: "agrement", label: "Agrément transitaire" },
  { value: "tva", label: "Attestation TVA" },
  { value: "rib", label: "RIB / Coordonnées bancaires" },
  { value: "autre", label: "Autre" },
];

const RouteSchema = z.object({
  origin_country: z.string().length(2),
  origin_city: z.string().trim().min(1),
  destination_country: z.string().length(2),
  destination_city: z.string().trim().min(1),
});

const DocSchema = z.object({
  type: z.enum(["registre_commerce", "agrement", "tva", "rib", "autre"]),
  storage_path: z.string().min(1),
  filename: z.string().min(1),
});

const formSchema = z.object({
  company_name: z.string().trim().min(2, "Nom obligatoire").max(120),
  legal_name: z.string().trim().max(160).optional(),
  registration_number: z.string().trim().max(60).optional(),
  tax_id: z.string().trim().max(60).optional(),
  contact_email: z.string().trim().email("Email invalide"),
  contact_phone: z.string().trim().min(6, "Téléphone obligatoire").max(30),
  headquarters_country: z.string().length(2),
  headquarters_city: z.string().trim().min(1),
  headquarters_address: z.string().trim().max(240).optional(),
  supported_modes: z.array(z.enum(["air", "sea", "road", "rail"])).min(1, "Choisissez au moins un mode"),
  coverage_routes: z.array(RouteSchema).min(1, "Ajoutez au moins une route"),
  estimated_monthly_volume_kg: z.number().min(0).optional(),
  documents: z.array(DocSchema).min(1, "Téléversez au moins un document"),
  description: z.string().trim().max(1000).optional(),
  website_url: z.string().trim().url("URL invalide").optional().or(z.literal("")),
});

type FormState = z.infer<typeof formSchema>;
type DocItem = z.infer<typeof DocSchema>;

export default function BecomeForwarderPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
    supported_modes: ["air"],
    coverage_routes: [{ origin_country: "CN", origin_city: "Guangzhou", destination_country: "CD", destination_city: "Kinshasa" }],
    estimated_monthly_volume_kg: undefined,
    documents: [],
    description: "",
    website_url: "",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/become-forwarder", { replace: true });
  }, [authLoading, user, navigate]);

  // Vérifie si l'user a déjà un dossier transitaire actif
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("forwarders")
        .select("status")
        .eq("owner_user_id", user.id)
        .in("status", ["pending", "approved", "suspended"])
        .maybeSingle();
      if (data) setExistingStatus(data.status);
    })();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Déjà transitaire
  if (existingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <Ship className="mx-auto mb-3 text-primary" size={48} />
            <h1 className="text-xl font-bold mb-2">Vous avez déjà un dossier transitaire</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Statut actuel : <Badge variant="outline">{existingStatus}</Badge>
            </p>
            <div className="flex gap-2 justify-center">
              <Button asChild variant="outline"><Link to="/">Retour à l'accueil</Link></Button>
              <Button asChild><Link to="/forwarder">Espace transitaire</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Routes
  const addRoute = () =>
    update("coverage_routes", [
      ...form.coverage_routes,
      { origin_country: "CN", origin_city: "", destination_country: "CD", destination_city: "" },
    ]);
  const removeRoute = (i: number) =>
    update("coverage_routes", form.coverage_routes.filter((_, idx) => idx !== i));
  const updateRoute = (i: number, patch: Partial<FormState["coverage_routes"][number]>) =>
    update("coverage_routes", form.coverage_routes.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Modes
  const toggleMode = (mode: "air" | "sea" | "road" | "rail") => {
    const next = form.supported_modes.includes(mode)
      ? form.supported_modes.filter((m) => m !== mode)
      : [...form.supported_modes, mode];
    update("supported_modes", next);
  };

  // Documents — upload Supabase Storage
  const handleDocUpload = async (type: DocItem["type"], file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const safeName = `${type}-${Date.now()}.${ext}`;
      const path = `${user.id}/${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("forwarder-documents")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const newDoc: DocItem = { type, storage_path: path, filename: file.name };
      update("documents", [...form.documents, newDoc]);
      toast.success(`Document "${file.name}" téléversé`);
    } catch (e: any) {
      toast.error(e.message || "Échec du téléversement");
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async (i: number) => {
    const doc = form.documents[i];
    try {
      await supabase.storage.from("forwarder-documents").remove([doc.storage_path]);
    } catch {
      // best effort
    }
    update("documents", form.documents.filter((_, idx) => idx !== i));
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.company_name.trim()) return "Nom de l'entreprise obligatoire";
    }
    if (s === 2) {
      if (!form.contact_email.trim() || !form.contact_email.includes("@")) return "Email invalide";
      if (!form.contact_phone.trim()) return "Téléphone obligatoire";
      if (!form.headquarters_city.trim()) return "Ville du siège obligatoire";
    }
    if (s === 3) {
      if (form.supported_modes.length === 0) return "Choisissez au moins un mode de transport";
      if (form.coverage_routes.some((r) => !r.origin_city.trim() || !r.destination_city.trim()))
        return "Toutes les routes doivent être renseignées";
    }
    if (s === 4) {
      if (form.documents.length === 0) return "Téléversez au moins un document KYB";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(5, s + 1));
  };

  const submit = async () => {
    const payload: FormState = {
      ...form,
      website_url: form.website_url?.trim() || undefined,
      legal_name: form.legal_name?.trim() || undefined,
      registration_number: form.registration_number?.trim() || undefined,
      tax_id: form.tax_id?.trim() || undefined,
      headquarters_address: form.headquarters_address?.trim() || undefined,
      description: form.description?.trim() || undefined,
      estimated_monthly_volume_kg: form.estimated_monthly_volume_kg || undefined,
    };
    const parsed = formSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("become-forwarder-submit", {
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
              Votre dossier KYB transitaire a été reçu. L'équipe Zandofy l'examinera sous 48h ouvrées.
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
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Ship size={12} />
            Programme Transitaire Zandofy
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Devenir transitaire
          </h1>
          <p className="text-sm text-muted-foreground">
            Rejoignez le réseau Zandofy comme commissionnaire de transport international.
            Étape {step}/5
          </p>
        </div>

        {/* Stepper */}
        <div className="flex justify-between mb-6 px-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex-1 flex items-center">
              <div className={`h-2 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
              {n < 5 && <div className="w-2" />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {step === 1 && <><Building2 size={18} />Identité de l'entreprise</>}
              {step === 2 && <><MapPin size={18} />Contact & siège</>}
              {step === 3 && <><Ship size={18} />Capacités & routes</>}
              {step === 4 && <><FileText size={18} />Documents KYB</>}
              {step === 5 && <><CheckCircle2 size={18} />Récapitulatif</>}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Informations légales"}
              {step === 2 && "Coordonnées et adresse"}
              {step === 3 && "Modes de transport et routes desservies"}
              {step === 4 && "Justificatifs (registre commerce, agrément, etc.)"}
              {step === 5 && "Vérifiez avant soumission"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div>
                  <Label htmlFor="company_name">Nom commercial *</Label>
                  <Input id="company_name" value={form.company_name}
                    onChange={(e) => update("company_name", e.target.value)}
                    placeholder="Ex: Global Freight Services" />
                </div>
                <div>
                  <Label htmlFor="legal_name">Raison sociale</Label>
                  <Input id="legal_name" value={form.legal_name ?? ""}
                    onChange={(e) => update("legal_name", e.target.value)}
                    placeholder="Ex: GFS SARL" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="registration_number">N° RCCM / SIRET</Label>
                    <Input id="registration_number" value={form.registration_number ?? ""}
                      onChange={(e) => update("registration_number", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="tax_id">N° TVA / NIF</Label>
                    <Input id="tax_id" value={form.tax_id ?? ""}
                      onChange={(e) => update("tax_id", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="website_url">Site web (optionnel)</Label>
                  <Input id="website_url" type="url" value={form.website_url ?? ""}
                    onChange={(e) => update("website_url", e.target.value)}
                    placeholder="https://..." />
                </div>
                <div>
                  <Label htmlFor="description">Description courte</Label>
                  <Textarea id="description" value={form.description ?? ""}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Présentez votre activité, années d'expérience, spécialisations..." rows={3} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
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
                <GeoFieldsRow
                  value={{ country: form.headquarters_country, city: form.headquarters_city }}
                  onChange={(patch) => {
                    if (patch.country !== undefined) {
                      update("headquarters_country", patch.country);
                      update("headquarters_city", "");
                    }
                    if (patch.city !== undefined) update("headquarters_city", patch.city);
                  }}
                  levels={["country", "city"]}
                  required={["country", "city"]}
                  labels={{ country: "Pays siège", city: "Ville siège" }}
                />
                <div>
                  <Label htmlFor="hq_address">Adresse complète</Label>
                  <Input id="hq_address" value={form.headquarters_address ?? ""}
                    onChange={(e) => update("headquarters_address", e.target.value)} />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <Label className="mb-2 block">Modes de transport supportés *</Label>
                  <div className="flex flex-wrap gap-2">
                    {TRANSPORT_MODES.map((m) => {
                      const active = form.supported_modes.includes(m.value as any);
                      return (
                        <Button
                          key={m.value}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => toggleMode(m.value as any)}
                        >
                          {m.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Routes desservies *</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addRoute}>
                      <Plus size={14} /> Ajouter
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.coverage_routes.map((r, i) => (
                      <div key={i} className="rounded-md border border-border/60 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Route #{i + 1}</span>
                          {form.coverage_routes.length > 1 && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => removeRoute(i)}>
                              <X size={14} />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] text-muted-foreground mb-1">Origine</p>
                            <GeoFieldsRow
                              value={{ country: r.origin_country, city: r.origin_city }}
                              onChange={(patch) => {
                                const next: any = {};
                                if (patch.country !== undefined) { next.origin_country = patch.country; next.origin_city = ""; }
                                if (patch.city !== undefined) next.origin_city = patch.city;
                                updateRoute(i, next);
                              }}
                              levels={["country", "city"]}
                            />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground mb-1">Destination</p>
                            <GeoFieldsRow
                              value={{ country: r.destination_country, city: r.destination_city }}
                              onChange={(patch) => {
                                const next: any = {};
                                if (patch.country !== undefined) { next.destination_country = patch.country; next.destination_city = ""; }
                                if (patch.city !== undefined) next.destination_city = patch.city;
                                updateRoute(i, next);
                              }}
                              levels={["country", "city"]}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="vol_kg">Volume mensuel estimé (kg)</Label>
                  <Input id="vol_kg" type="number" min={0}
                    value={form.estimated_monthly_volume_kg ?? ""}
                    onChange={(e) => update("estimated_monthly_volume_kg",
                      e.target.value ? Math.max(0, parseInt(e.target.value)) : undefined)}
                    placeholder="Ex: 5000" />
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <p className="text-xs text-muted-foreground">
                  Téléversez vos justificatifs (PDF/image, max 10 Mo chacun). Vos documents sont
                  privés et accessibles uniquement par l'équipe Zandofy.
                </p>
                <div className="space-y-2">
                  {DOC_TYPES.map((dt) => {
                    const inputId = `file-${dt.value}`;
                    return (
                      <div key={dt.value} className="flex items-center gap-2 p-2 rounded-md border border-border">
                        <Label htmlFor={inputId} className="flex-1 cursor-pointer text-sm">
                          {dt.label}
                        </Label>
                        <Input id={inputId} type="file" accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleDocUpload(dt.value as any, f);
                            e.target.value = "";
                          }}
                        />
                        <Button type="button" size="sm" variant="outline" disabled={uploading}
                          onClick={() => document.getElementById(inputId)?.click()}>
                          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          Téléverser
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {form.documents.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-medium mb-2">Documents téléversés ({form.documents.length})</p>
                    <div className="space-y-1.5">
                      {form.documents.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
                          <FileText size={12} className="shrink-0" />
                          <span className="flex-1 truncate">
                            <Badge variant="outline" className="text-[10px] mr-1">{d.type}</Badge>
                            {d.filename}
                          </span>
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => removeDoc(i)}>
                            <X size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 5 && (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    En soumettant, vous acceptez les conditions du programme Transitaire Zandofy.
                    Votre dossier sera examiné sous 48h ouvrées.
                  </p>
                </div>
                <Recap label="Entreprise" value={form.company_name} />
                <Recap label="Email / Téléphone" value={`${form.contact_email} · ${form.contact_phone}`} />
                <Recap label="Siège" value={`${form.headquarters_city}, ${form.headquarters_country}`} />
                <Recap label="Modes" value={form.supported_modes.map((m) => TRANSPORT_MODES.find((x) => x.value === m)?.label).join(", ")} />
                <Recap label="Routes" value={form.coverage_routes.map((r) => `${r.origin_city}→${r.destination_city}`).join(", ")} />
                <Recap label="Documents" value={`${form.documents.length} fichier(s)`} />
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-border">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft size={14} /> Précédent
                </Button>
              ) : <div />}
              {step < 5 && (
                <Button onClick={next}>
                  Suivant <ArrowRight size={14} />
                </Button>
              )}
              {step === 5 && (
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
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0 gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}