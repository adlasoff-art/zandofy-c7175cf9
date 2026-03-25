import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  User, Store, FileCheck, Send, CheckCircle2, Upload, Trash2, Loader2, AlertCircle,
} from "lucide-react";

interface ApplicationData {
  id?: string;
  full_name: string;
  phone: string;
  business_type: string;
  store_name: string;
  store_description: string;
  store_logo_url: string;
  store_banner_url: string;
  company_name: string;
  company_address: string;
  company_city: string;
  company_country: string;
  current_step: number;
  status: string;
}

interface DocFile {
  type: string;
  url: string;
  file_name: string;
  id?: string;
}

const initialData: ApplicationData = {
  full_name: "",
  phone: "",
  business_type: "",
  store_name: "",
  store_description: "",
  store_logo_url: "",
  store_banner_url: "",
  company_name: "",
  company_address: "",
  company_city: "",
  company_country: "Sénégal",
  current_step: 1,
  status: "draft",
};

interface VendorApplicationLocalDraft {
  savedAt: number;
  step: number;
  form: ApplicationData;
  docs: DocFile[];
}

const LOCAL_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export default function BecomeVendorPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ApplicationData>(initialData);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [existingApp, setExistingApp] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const localDraftKey = useMemo(() => (user ? `zandofy_vendor_application_draft:${user.id}` : null), [user?.id]);
  const hasRestoredLocalDraftRef = useRef(false);

  // Load existing application
  useEffect(() => {
    hasRestoredLocalDraftRef.current = false;
    if (!user) { setAppLoading(false); return; }

    (async () => {
      const { data } = await supabase
        .from("vendor_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setForm({
          id: data.id,
          full_name: data.full_name || "",
          phone: data.phone || "",
          business_type: data.business_type || "",
          store_name: data.store_name || "",
          store_description: data.store_description || "",
          store_logo_url: data.store_logo_url || "",
          store_banner_url: data.store_banner_url || "",
          company_name: data.company_name || "",
          company_address: data.company_address || "",
          company_city: data.company_city || "",
          company_country: data.company_country || "Sénégal",
          current_step: data.current_step || 1,
          status: data.status || "draft",
        });
        setStep(data.current_step || 1);
        setExistingApp(true);

        if (localDraftKey && typeof localStorage !== "undefined") {
          localStorage.removeItem(localDraftKey);
        }

        // Load docs
        const { data: docData } = await supabase
          .from("vendor_documents")
          .select("*")
          .eq("application_id", data.id);
        if (docData) {
          setDocs(docData.map((d: any) => ({ type: d.document_type, url: d.document_url, file_name: d.file_name, id: d.id })));
        }
      }

      setAppLoading(false);
    })();
  }, [localDraftKey, user]);

  useEffect(() => {
    if (hasRestoredLocalDraftRef.current || appLoading || existingApp || form.id || !localDraftKey || typeof localStorage === "undefined") {
      return;
    }
    hasRestoredLocalDraftRef.current = true;

    try {
      const raw = localStorage.getItem(localDraftKey);
      if (!raw) return;

      const draft = JSON.parse(raw) as VendorApplicationLocalDraft;
      if (!draft?.savedAt || Date.now() - draft.savedAt > LOCAL_DRAFT_TTL_MS) {
        localStorage.removeItem(localDraftKey);
        return;
      }

      if (draft.form) {
        setForm((prev) => ({ ...prev, ...draft.form }));
      }
      if (typeof draft.step === "number" && draft.step >= 1 && draft.step <= 4) {
        setStep(draft.step);
      }
      if (Array.isArray(draft.docs)) {
        setDocs(draft.docs);
      }

      toast({ title: "Brouillon restauré", description: "Votre progression locale a été récupérée." });
    } catch {
      localStorage.removeItem(localDraftKey);
    }
  }, [appLoading, existingApp, form.id, localDraftKey]);

  useEffect(() => {
    if (appLoading || !localDraftKey || typeof localStorage === "undefined") return;
    if (!user || !["draft", "revision_requested"].includes(form.status)) return;

    const timeout = window.setTimeout(() => {
      const payload: VendorApplicationLocalDraft = {
        savedAt: Date.now(),
        step,
        form,
        docs,
      };
      localStorage.setItem(localDraftKey, JSON.stringify(payload));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [appLoading, docs, form, localDraftKey, step, user]);

  const hasUnsavedDraft =
    ["draft", "revision_requested"].includes(form.status) &&
    (!!form.full_name || !!form.store_name || docs.length > 0);

  useEffect(() => {
    if (!hasUnsavedDraft) return;

    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [hasUnsavedDraft]);

  if (authLoading || appLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-lg py-20 text-center space-y-4">
          <AlertCircle size={48} className="mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">{t("vendor.loginRequired")}</h1>
          <p className="text-muted-foreground">{t("vendor.loginRequiredDesc")}</p>
          <Button onClick={() => navigate("/auth")}>{t("general.loginButton")}</Button>
        </div>
        <Footer />
      </div>
    );
  }

  // Already submitted — but allow creating a NEW application if approved/rejected (multi-store)
  const isTerminalStatus = ["submitted", "approved", "rejected", "revision_requested"].includes(form.status);
  if (isTerminalStatus && form.status !== "revision_requested") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-lg py-20 text-center space-y-4">
          {form.status === "submitted" && (
            <>
              <CheckCircle2 size={48} className="mx-auto text-amber-500" />
              <h1 className="text-2xl font-bold">{t("vendor.underReview")}</h1>
              <p className="text-muted-foreground">{t("vendor.underReviewDesc")}</p>
            </>
          )}
          {form.status === "approved" && (
            <>
              <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
              <h1 className="text-2xl font-bold">{t("vendor.approved")}</h1>
              <p className="text-muted-foreground">{t("vendor.approvedDesc")}</p>
              <Button onClick={() => navigate("/vendor")}>{t("vendor.goToVendor")}</Button>
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Vous souhaitez ouvrir une nouvelle boutique ?</p>
                <Button variant="outline" onClick={() => {
                  setForm(initialData);
                  setDocs([]);
                  setStep(1);
                  setExistingApp(false);
                }}>
                  <Store size={14} className="mr-2" /> Nouvelle demande de boutique
                </Button>
              </div>
            </>
          )}
          {form.status === "rejected" && (
            <>
              <AlertCircle size={48} className="mx-auto text-destructive" />
              <h1 className="text-2xl font-bold">{t("vendor.rejected")}</h1>
              <p className="text-muted-foreground">{t("vendor.rejectedDesc")}</p>
              <Button variant="outline" onClick={() => {
                setForm(initialData);
                setDocs([]);
                setStep(1);
                setExistingApp(false);
              }}>
                Soumettre une nouvelle demande
              </Button>
            </>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const saveProgress = async (nextStep?: number) => {
    setSaving(true);
    const payload = {
      user_id: user.id,
      full_name: form.full_name,
      phone: form.phone,
      business_type: form.business_type,
      store_name: form.store_name,
      store_description: form.store_description,
      store_logo_url: form.store_logo_url,
      store_banner_url: form.store_banner_url,
      company_name: form.company_name,
      company_address: form.company_address,
      company_city: form.company_city,
      company_country: form.company_country,
      current_step: nextStep || step,
      status: form.status,
    };

    let appId = form.id;
    if (existingApp && form.id) {
      await supabase.from("vendor_applications").update(payload).eq("id", form.id);
    } else {
      const { data } = await supabase.from("vendor_applications").insert(payload).select("id").single();
      if (data) {
        appId = data.id;
        setForm((prev) => ({ ...prev, id: data.id }));
        setExistingApp(true);
      }
    }
    setSaving(false);
    return appId;
  };

  const handleNext = async () => {
    const nextStep = step + 1;
    await saveProgress(nextStep);
    setStep(nextStep);
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    setSaving(true);
    if (form.id) {
      const { error } = await supabase
        .from("vendor_applications")
        .update({ status: "submitted", submitted_at: new Date().toISOString(), current_step: 4 })
        .eq("id", form.id);
      if (error) {
        console.error("Submit error:", error);
        setSaving(false);
        toast({ title: "Erreur", description: "Impossible de soumettre la demande. Veuillez réessayer.", variant: "destructive" });
        return;
      }
    }
    if (localDraftKey && typeof localStorage !== "undefined") {
      localStorage.removeItem(localDraftKey);
    }
    setForm((prev) => ({ ...prev, status: "submitted" }));
    setSaving(false);
    toast({ title: t("vendor.submitted"), description: t("vendor.submittedDesc") });
  };

  const uploadDoc = async (docType: string, file: File) => {
    setUploading(docType);
    let appId = form.id;
    if (!appId) appId = await saveProgress();
    if (!appId) { setUploading(null); return; }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${docType}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("vendor-documents").upload(path, file);
    if (upErr) {
      toast({ title: t("auth.error"), description: upErr.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    // Store the relative path (bucket is private, signed URLs generated on demand)
    const docUrl = path;

    const { data: docRow } = await supabase
      .from("vendor_documents")
      .insert({ application_id: appId, user_id: user.id, document_type: docType, document_url: docUrl, file_name: file.name })
      .select("id")
      .single();

    setDocs((prev) => [...prev.filter((d) => d.type !== docType), { type: docType, url: docUrl, file_name: file.name, id: docRow?.id }]);
    setUploading(null);
    toast({ title: t("vendor.uploaded") });
  };

  const removeDoc = async (docType: string) => {
    const doc = docs.find((d) => d.type === docType);
    if (doc?.id) {
      await supabase.from("vendor_documents").delete().eq("id", doc.id);
    }
    setDocs((prev) => prev.filter((d) => d.type !== docType));
  };

  const canProceed = (s: number) => {
    switch (s) {
      case 1: return !!form.full_name && !!form.phone && !!form.business_type;
      case 2: return !!form.store_name;
      case 3: return docs.length >= 2;
      default: return true;
    }
  };

  const STEPS = [
    { id: 1, label: t("vendor.step1"), icon: User, description: t("vendor.step1Desc") },
    { id: 2, label: t("vendor.step2"), icon: Store, description: t("vendor.step2Desc") },
    { id: 3, label: t("vendor.step3"), icon: FileCheck, description: t("vendor.step3Desc") },
    { id: 4, label: t("vendor.step4"), icon: Send, description: t("vendor.step4Desc") },
  ];

  const BUSINESS_TYPES = [
    { value: "retailer", label: t("vendor.retailer") },
    { value: "wholesaler", label: t("vendor.wholesaler") },
    { value: "manufacturer", label: t("vendor.manufacturer") },
    { value: "artisan", label: t("vendor.artisan") },
  ];

  const REQUIRED_DOCS = [
    { type: "id_card", label: t("vendor.docId"), description: t("vendor.docIdDesc") },
    { type: "rccm", label: t("vendor.docRccm"), description: t("vendor.docRccmDesc") },
    { type: "proof_address", label: t("vendor.docAddress"), description: t("vendor.docAddressDesc") },
    { type: "logo", label: t("vendor.docLogo"), description: t("vendor.docLogoDesc") },
  ];

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-2xl py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("vendor.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("vendor.subtitle")}</p>
        </div>

        <div className="space-y-3">
          <Progress value={progressPct} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => s.id <= step && setStep(s.id)}
                  className={`flex flex-col items-center gap-1 text-center transition-colors ${
                    isActive ? "text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isActive ? "border-primary bg-primary/10" : isDone ? "border-emerald-500 bg-emerald-500/10" : "border-muted-foreground/30"
                  }`}>
                    {isDone ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Icon size={18} />}
                  </div>
                  <span className="text-[10px] md:text-xs font-medium hidden sm:block">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{STEPS[step - 1].label}</CardTitle>
            <CardDescription>{STEPS[step - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>{t("vendor.fullName")} *</Label>
                  <Input value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Jean Dupont" />
                </div>
                <div className="space-y-2">
                  <Label>{t("vendor.phone")} *</Label>
                  <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+221 77 123 45 67" />
                </div>
                <div className="space-y-2">
                  <Label>{t("vendor.businessType")} *</Label>
                  <Select value={form.business_type} onValueChange={(v) => updateField("business_type", v)}>
                    <SelectTrigger><SelectValue placeholder={t("vendor.select")} /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((bt) => (
                        <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>{t("vendor.storeName")} *</Label>
                  <Input value={form.store_name} onChange={(e) => updateField("store_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("vendor.storeDesc")}</Label>
                  <Textarea value={form.store_description} onChange={(e) => updateField("store_description", e.target.value)} rows={4} />
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("vendor.uploadDocs")}</p>
                {REQUIRED_DOCS.map((doc) => {
                  const uploaded = docs.find((d) => d.type === doc.type);
                  return (
                    <div key={doc.type} className="border border-border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{doc.label}</p>
                          <p className="text-xs text-muted-foreground">{doc.description}</p>
                        </div>
                        {uploaded && (
                          <Button variant="ghost" size="icon" onClick={() => removeDoc(doc.type)} className="h-7 w-7 text-destructive">
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                      {uploaded ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-600">
                          <CheckCircle2 size={14} />
                          <span className="truncate">{uploaded.file_name}</span>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-primary hover:underline">
                          {uploading === doc.type ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          <span>{uploading === doc.type ? t("vendor.uploading") : t("vendor.download")}</span>
                          <input type="file" className="hidden" accept="image/*,.pdf" disabled={uploading === doc.type} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(doc.type, f); }} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("vendor.reviewSummary")}</p>
                <div className="grid gap-3 text-sm">
                  <div className="border border-border rounded-md p-3">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2"><User size={14} /> {t("vendor.personalInfo")}</h4>
                    <p><strong>{t("vendor.fullName")}:</strong> {form.full_name}</p>
                    <p><strong>{t("vendor.phone")}:</strong> {form.phone}</p>
                    <p><strong>{t("vendor.businessType")}:</strong> {BUSINESS_TYPES.find((bt) => bt.value === form.business_type)?.label || form.business_type}</p>
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2"><Store size={14} /> {t("vendor.shop")}</h4>
                    <p><strong>{t("vendor.storeName")}:</strong> {form.store_name}</p>
                    {form.store_description && <p><strong>{t("vendor.storeDesc")}:</strong> {form.store_description}</p>}
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2"><FileCheck size={14} /> {t("vendor.kybDocs")}</h4>
                    {docs.length === 0 ? (
                      <p className="text-muted-foreground">{t("vendor.noDocs")}</p>
                    ) : (
                      <ul className="space-y-1">
                        {docs.map((d) => (
                          <li key={d.type} className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 size={12} />
                            <span>{REQUIRED_DOCS.find((r) => r.type === d.type)?.label || d.type}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>{t("vendor.back")}</Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={handleNext} disabled={!canProceed(step) || saving}>
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                {t("vendor.next")}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving || docs.length < 2} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                {t("vendor.submit")}
              </Button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
