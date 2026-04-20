import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { Camera, Upload, Loader2, FileImage, X, ChevronRight, ChevronLeft, ShieldCheck } from "lucide-react";
import type { KycVerification } from "@/hooks/use-kyc";
import { sanitizeExtension } from "@/utils/sanitize-filename";

interface Props {
  existingKyc?: KycVerification | null;
  onSuccess: () => void;
}

type DocType = "national_id" | "voter_card" | "passport" | "drivers_license";

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "national_id", label: "Carte d'identité nationale" },
  { value: "voter_card", label: "Carte d'électeur (RDC)" },
  { value: "passport", label: "Passeport" },
  { value: "drivers_license", label: "Permis de conduire" },
];

type Step = "document" | "selfie" | "address" | "review";

export function KycSubmissionForm({ existingKyc, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("document");
  const [submitting, setSubmitting] = useState(false);

  const [docType, setDocType] = useState<DocType>(
    (existingKyc?.document_type as DocType) || "national_id"
  );
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [country, setCountry] = useState(existingKyc?.address_country || "CD");
  const [city, setCity] = useState(existingKyc?.address_city || "");
  const [street, setStreet] = useState(existingKyc?.address_street || "");
  const [district, setDistrict] = useState(existingKyc?.address_district || "");
  const [postalCode, setPostalCode] = useState(existingKyc?.address_postal_code || "");

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File, setter: (f: File | null) => void, previewSetter: (s: string | null) => void) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", description: "Maximum 5 Mo par fichier.", variant: "destructive" });
      return;
    }
    setter(file);
    const url = URL.createObjectURL(file);
    previewSetter(url);
  }, [toast]);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = sanitizeExtension(file.name, "jpg");
    const path = `${user!.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw new Error(`Upload échoué: ${error.message}`);
    return path;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!frontFile && !existingKyc) {
      toast({ title: "Document requis", description: "Veuillez uploader le recto de votre document.", variant: "destructive" });
      return;
    }
    if (!selfieFile && !existingKyc) {
      toast({ title: "Selfie requis", description: "Veuillez prendre un selfie avec votre document.", variant: "destructive" });
      return;
    }
    if (!city.trim() || !street.trim()) {
      toast({ title: "Adresse incomplète", description: "Ville et rue sont obligatoires.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let frontUrl = existingKyc?.document_front_url || "";
      let backUrl = existingKyc?.document_back_url || null;
      let selfieUrl = existingKyc?.selfie_url || "";

      if (frontFile) frontUrl = await uploadFile(frontFile, "front");
      if (backFile) backUrl = await uploadFile(backFile, "back");
      if (selfieFile) selfieUrl = await uploadFile(selfieFile, "selfie");

      const payload = {
        user_id: user.id,
        status: "pending",
        document_type: docType,
        document_front_url: frontUrl,
        document_back_url: backUrl,
        selfie_url: selfieUrl,
        address_country: country,
        address_city: city,
        address_street: street,
        address_district: district || null,
        address_postal_code: postalCode || null,
        rejection_reason: null,
      };

      if (existingKyc && (existingKyc.status === "rejected" || existingKyc.status === "resubmission_required")) {
        const { error } = await (supabase as any)
          .from("kyc_verifications")
          .update(payload)
          .eq("id", existingKyc.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("kyc_verifications")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "Vérification soumise", description: "Votre demande sera examinée sous 24-48h." });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const steps: { key: Step; label: string; num: number }[] = [
    { key: "document", label: "Document", num: 1 },
    { key: "selfie", label: "Selfie", num: 2 },
    { key: "address", label: "Adresse", num: 3 },
    { key: "review", label: "Confirmer", num: 4 },
  ];

  const currentIdx = steps.findIndex(s => s.key === step);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => i < currentIdx ? setStep(s.key) : undefined}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i <= currentIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              } ${i < currentIdx ? "cursor-pointer" : "cursor-default"}`}
            >
              {s.num}
            </button>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${i < currentIdx ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-sm font-medium text-foreground">{steps[currentIdx]?.label}</p>

      {step === "document" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type de document</Label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as DocType)}
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-md text-foreground"
            >
              {DOC_TYPES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Recto du document *</Label>
            <input ref={frontInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f, setFrontFile, setFrontPreview);
            }} />
            {frontPreview ? (
              <div className="relative">
                <img src={frontPreview} alt="Recto" className="w-full h-48 object-contain rounded-lg border border-border bg-muted" />
                <button onClick={() => { setFrontFile(null); setFrontPreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-destructive/10">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-24 flex-col gap-2" onClick={() => frontInputRef.current?.click()}>
                  <Upload size={20} />
                  <span className="text-xs">Uploader</span>
                </Button>
                <Button variant="outline" className="flex-1 h-24 flex-col gap-2" onClick={() => {
                  const inp = frontInputRef.current;
                  if (inp) { inp.setAttribute("capture", "environment"); inp.click(); inp.removeAttribute("capture"); }
                }}>
                  <Camera size={20} />
                  <span className="text-xs">Caméra</span>
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Verso du document (optionnel)</Label>
            <input ref={backInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f, setBackFile, setBackPreview);
            }} />
            {backPreview ? (
              <div className="relative">
                <img src={backPreview} alt="Verso" className="w-full h-48 object-contain rounded-lg border border-border bg-muted" />
                <button onClick={() => { setBackFile(null); setBackPreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-destructive/10">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <Button variant="outline" className="w-full h-16 gap-2" onClick={() => backInputRef.current?.click()}>
                <FileImage size={16} />
                Ajouter le verso
              </Button>
            )}
          </div>

          <Button className="w-full" onClick={() => {
            if (!frontFile && !existingKyc?.document_front_url) {
              toast({ title: "Requis", description: "Veuillez uploader le recto du document.", variant: "destructive" });
              return;
            }
            setStep("selfie");
          }}>
            Suivant <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {step === "selfie" && (
        <div className="space-y-5">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Selfie avec document</p>
            <p>Prenez une photo de vous en tenant votre document d'identité à côté de votre visage. Assurez-vous que le document et votre visage sont clairement visibles.</p>
          </div>

          <input ref={selfieInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f, setSelfieFile, setSelfiePreview);
          }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f, setSelfieFile, setSelfiePreview);
          }} />

          {selfiePreview ? (
            <div className="relative">
              <img src={selfiePreview} alt="Selfie" className="w-full h-64 object-contain rounded-lg border border-border bg-muted" />
              <button onClick={() => { setSelfieFile(null); setSelfiePreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-destructive/10">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-24 flex-col gap-2" onClick={() => selfieInputRef.current?.click()}>
                <Upload size={20} />
                <span className="text-xs">Uploader</span>
              </Button>
              <Button variant="outline" className="flex-1 h-24 flex-col gap-2" onClick={() => cameraInputRef.current?.click()}>
                <Camera size={20} />
                <span className="text-xs">Prendre un selfie</span>
              </Button>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("document")}>
              <ChevronLeft size={16} /> Retour
            </Button>
            <Button className="flex-1" onClick={() => {
              if (!selfieFile && !existingKyc?.selfie_url) {
                toast({ title: "Requis", description: "Veuillez ajouter votre selfie.", variant: "destructive" });
                return;
              }
              setStep("address");
            }}>
              Suivant <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {step === "address" && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>Entrez l'adresse figurant sur votre document d'identité.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Pays *</Label>
            <CountryCombobox value={country} onChange={setCountry} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ville *</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Kinshasa" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rue / Avenue *</Label>
            <Input value={street} onChange={e => setStreet(e.target.value)} placeholder="Avenue de la Libération, 45" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Quartier / District</Label>
              <Input value={district} onChange={e => setDistrict(e.target.value)} placeholder="Gombe" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Code postal</Label>
              <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="" />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("selfie")}>
              <ChevronLeft size={16} /> Retour
            </Button>
            <Button className="flex-1" onClick={() => {
              if (!city.trim() || !street.trim()) {
                toast({ title: "Requis", description: "Ville et rue sont obligatoires.", variant: "destructive" });
                return;
              }
              setStep("review");
            }}>
              Suivant <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-5">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
            <h4 className="font-medium text-foreground">Récapitulatif</h4>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <span className="text-muted-foreground">Document</span>
              <span className="text-foreground font-medium">{DOC_TYPES.find(d => d.value === docType)?.label}</span>
              <span className="text-muted-foreground">Recto</span>
              <span className="text-foreground">{frontFile ? "✅ Uploadé" : existingKyc?.document_front_url ? "✅ Existant" : "❌ Manquant"}</span>
              <span className="text-muted-foreground">Verso</span>
              <span className="text-foreground">{backFile ? "✅ Uploadé" : existingKyc?.document_back_url ? "✅ Existant" : "— Optionnel"}</span>
              <span className="text-muted-foreground">Selfie</span>
              <span className="text-foreground">{selfieFile ? "✅ Uploadé" : existingKyc?.selfie_url ? "✅ Existant" : "❌ Manquant"}</span>
              <span className="text-muted-foreground">Adresse</span>
              <span className="text-foreground">{street}, {city}, {country}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("address")}>
              <ChevronLeft size={16} /> Modifier
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> Envoi...</>
              ) : (
                <><ShieldCheck size={16} className="mr-2" /> Soumettre</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
