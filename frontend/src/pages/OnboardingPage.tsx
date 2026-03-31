import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { useGeoDetection } from "@/hooks/use-geo-detection";
import { toast } from "sonner";
import {
  MapPin, ShieldCheck, ChevronRight, ChevronLeft, Check, Loader2, Upload, Camera, User,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Step = "welcome" | "address" | "kyc" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "welcome", label: "Bienvenue" },
  { key: "address", label: "Adresse" },
  { key: "kyc", label: "Vérification" },
  { key: "done", label: "Terminé" },
];

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const geo = useGeoDetection();
  const [step, setStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);

  // Address form
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("+243 ");
  const [addressLabel, setAddressLabel] = useState("Domicile");

  // Cities/communes from DB
  const [cities, setCities] = useState<string[]>([]);
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [quartiers, setQuartiers] = useState<{ id: string; name: string }[]>([]);

  // KYC
  const [kycNeeded, setKycNeeded] = useState(false);
  const [kycExists, setKycExists] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  // Pre-fill country from geo
  useEffect(() => {
    if (!country && geo.country_code) setCountry(geo.country_code);
  }, [geo.country_code]);

  // Load cities for country
  useEffect(() => {
    if (!country) return;
    supabase.from("cities").select("name").eq("country_code", country).order("name").limit(500)
      .then(({ data }) => setCities((data || []).map((d: any) => d.name)));
  }, [country]);

  // Load communes for city
  useEffect(() => {
    if (!city || !country) { setCommunes([]); return; }
    (supabase as any).from("communes").select("id, name").eq("city", city).eq("country_code", country).order("name")
      .then(({ data }: any) => setCommunes((data || []) as any));
  }, [city, country]);

  // Load quartiers for commune
  useEffect(() => {
    if (!commune) { setQuartiers([]); return; }
    (supabase as any).from("quartiers").select("id, name").eq("commune_id", commune).order("name")
      .then(({ data }: any) => setQuartiers((data || []) as any));
  }, [commune]);

  // Check KYC status
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("kyc_verifications").select("id, status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setKycExists(true);
        // Check if KYC is required
        supabase.rpc("check_kyc_required", { p_user_id: user.id })
          .then(({ data: needed }) => setKycNeeded(!!needed));
      });
  }, [user?.id]);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const handleSaveAddress = async () => {
    if (!user?.id || !city || !address) {
      toast.error("Ville et adresse sont requis");
      return;
    }
    setSaving(true);
    try {
      const communeName = communes.find((c) => c.id === commune)?.name || "";
      const quartierName = quartiers.find((q) => q.id === quartier)?.name || "";

      const { error } = await (supabase as any).from("delivery_addresses").insert({
        user_id: user.id,
        label: addressLabel,
        country,
        city,
        commune: communeName,
        quartier: quartierName,
        address,
        phone,
        is_default: true,
      });

      if (error) throw error;

      // Also update profile country if empty
      await supabase.from("profiles").update({ country }).eq("id", user.id);

      toast.success("Adresse enregistrée !");
      setStep(kycNeeded && !kycExists ? "kyc" : "done");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-14">
          <a href="/" className="text-xl font-bold tracking-[0.18em] uppercase text-foreground" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800 }}>
            ZANDOFY
          </a>
          <button onClick={() => navigate("/")} className="text-sm text-muted-foreground hover:text-foreground">
            Passer ›
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="w-full px-4 pt-4">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between mt-2">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`text-[10px] font-medium ${i <= stepIndex ? "text-primary" : "text-muted-foreground"}`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Step: Welcome */}
          {step === "welcome" && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <User size={32} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Bienvenue sur Zandofy ! 🎉</h1>
                <p className="text-muted-foreground mt-2">
                  Complétez votre profil en quelques étapes pour une meilleure expérience d'achat.
                </p>
              </div>
              <div className="space-y-3 text-left bg-card border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Adresse de livraison</p>
                    <p className="text-xs text-muted-foreground">Pour des livraisons rapides et précises</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Vérification d'identité</p>
                    <p className="text-xs text-muted-foreground">Débloque les paiements avancés et la livraison à domicile</p>
                  </div>
                </div>
              </div>
              <Button className="w-full h-12 font-bold gap-2" onClick={() => setStep("address")}>
                Commencer <ChevronRight size={16} />
              </Button>
            </div>
          )}

          {/* Step: Address */}
          {step === "address" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <MapPin size={20} className="text-primary" /> Adresse de livraison
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Ajoutez votre adresse principale pour recevoir vos commandes</p>
              </div>

              <div className="space-y-4 bg-card border border-border rounded-xl p-4">
                <div>
                  <Label className="text-xs">Libellé</Label>
                  <Input className="mt-1" value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)} placeholder="Domicile, Bureau..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <CountryCombobox value={country} onChange={setCountry} label="Pays *" showNone={false} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Ville *</Label>
                    <select className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-md bg-background" value={city} onChange={(e) => { setCity(e.target.value); setCommune(""); setQuartier(""); }}>
                      <option value="">Sélectionner</option>
                      {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {city && communes.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Commune</Label>
                      <select className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-md bg-background" value={commune} onChange={(e) => { setCommune(e.target.value); setQuartier(""); }}>
                        <option value="">—</option>
                        {communes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    {commune && quartiers.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Quartier</Label>
                        <select className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-md bg-background" value={quartier} onChange={(e) => setQuartier(e.target.value)}>
                          <option value="">—</option>
                          {quartiers.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-xs">Adresse complète *</Label>
                  <Input className="mt-1" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="N° parcelle, Avenue/Rue..." />
                </div>

                <div>
                  <Label className="text-xs">Téléphone</Label>
                  <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+243 ..." />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("welcome")} className="gap-1">
                  <ChevronLeft size={14} /> Retour
                </Button>
                <Button className="flex-1 font-bold gap-2" onClick={handleSaveAddress} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  Enregistrer
                </Button>
              </div>
            </div>
          )}

          {/* Step: KYC */}
          {step === "kyc" && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck size={32} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Vérification d'identité</h2>
                <p className="text-muted-foreground mt-2">
                  La vérification KYC débloque les paiements avancés et la livraison à domicile.
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-left">
                <p className="text-sm text-foreground font-medium">Documents nécessaires :</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2"><Camera size={14} className="text-primary" /> Photo d'une pièce d'identité (recto/verso)</li>
                  <li className="flex items-center gap-2"><User size={14} className="text-primary" /> Selfie avec la pièce d'identité visible</li>
                  <li className="flex items-center gap-2"><MapPin size={14} className="text-primary" /> Adresse de résidence</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep("done")}>
                  Plus tard
                </Button>
                <Button className="flex-1 font-bold gap-2" onClick={() => { navigate("/dashboard"); }}>
                  <Upload size={16} /> Commencer la vérification
                </Button>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Check size={32} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Vous êtes prêt ! 🚀</h2>
                <p className="text-muted-foreground mt-2">
                  Votre profil est configuré. Découvrez les meilleurs produits sur Zandofy.
                </p>
              </div>
              <Button className="w-full h-12 font-bold" onClick={() => navigate("/")}>
                Explorer la boutique
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
