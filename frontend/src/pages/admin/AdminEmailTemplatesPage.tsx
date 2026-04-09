import { AdminLayout } from "@/components/admin/AdminLayout";
import { Mail, Save, Loader2, Eye, RotateCcw, Upload } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  heading: string;
  body: string;
  cta_label: string;
  footer_text: string;
  is_active: boolean;
}

interface EmailBranding {
  logo_url: string;
  primary_color: string;
  text_color: string;
  bg_color: string;
  font_family: string;
  company_name: string;
  support_email: string;
}

const FONT_OPTIONS = [
  { value: "Arial, sans-serif", label: "Arial (par défaut)" },
  { value: "'Outfit', sans-serif", label: "Outfit (police Zandofy)" },
];

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "signup_confirmation",
    name: "Confirmation d'inscription",
    subject: "Bienvenue sur Zandofy ! Confirmez votre email",
    heading: "Bienvenue sur Zandofy 🎉",
    body: "Merci de vous être inscrit(e) sur Zandofy, votre marketplace de mode africaine. Cliquez ci-dessous pour confirmer votre adresse email et accéder à toutes nos fonctionnalités.",
    cta_label: "Confirmer mon email",
    footer_text: "Si vous n'avez pas créé de compte, ignorez cet email.",
    is_active: true,
  },
  {
    id: "password_reset",
    name: "Réinitialisation mot de passe",
    subject: "Réinitialisez votre mot de passe — Zandofy",
    heading: "Réinitialisation du mot de passe",
    body: "Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en créer un nouveau. Ce lien expire dans 60 minutes.",
    cta_label: "Réinitialiser mon mot de passe",
    footer_text: "Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe restera inchangé.",
    is_active: true,
  },
  {
    id: "order_confirmation",
    name: "Confirmation de commande",
    subject: "Commande {{order_ref}} confirmée",
    heading: "Commande confirmée ✓",
    body: "Votre commande {{order_ref}} d'un montant de {{total}} a été reçue et est en cours de traitement. Vous recevrez une notification dès qu'elle sera expédiée.",
    cta_label: "Suivre ma commande",
    footer_text: "Merci pour votre confiance. L'équipe Zandofy.",
    is_active: true,
  },
  {
    id: "order_shipped",
    name: "Commande expédiée",
    subject: "Votre commande {{order_ref}} a été expédiée",
    heading: "Votre colis est en route 🚚",
    body: "Bonne nouvelle ! Votre commande {{order_ref}} a été expédiée. Suivez votre colis en cliquant ci-dessous.",
    cta_label: "Suivre mon colis",
    footer_text: "Merci pour votre achat sur Zandofy.",
    is_active: true,
  },
  {
    id: "order_delivered",
    name: "Commande livrée",
    subject: "Commande {{order_ref}} livrée",
    heading: "Commande livrée avec succès 📦",
    body: "Votre commande {{order_ref}} a été livrée. Nous espérons que vos articles vous plaisent ! N'hésitez pas à laisser un avis.",
    cta_label: "Donner mon avis",
    footer_text: "Merci pour votre confiance. L'équipe Zandofy.",
    is_active: true,
  },
];

const DEFAULT_BRANDING: EmailBranding = {
  logo_url: "",
  primary_color: "#000000",
  text_color: "#333333",
  bg_color: "#f9f9f9",
  font_family: "'Outfit', sans-serif",
  company_name: "Zandofy",
  support_email: "support@zandofy.com",
};

function LogoUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erreur", description: "Fichier image requis", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `email-logo.${ext}`;
    const { error } = await supabase.storage.from("seo-assets").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erreur d'upload", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("seo-assets").getPublicUrl(path);
    onChange(urlData.publicUrl + "?t=" + Date.now());
    setUploading(false);
    toast({ title: "Logo uploadé" });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Logo email</Label>
      {value && (
        <div className="flex items-center gap-3 p-2 border border-border rounded bg-muted/30">
          <img src={value} alt="Logo" className="h-10 max-w-[120px] object-contain" />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Upload size={14} className="mr-1" />}
        {value ? "Changer le logo" : "Uploader un logo"}
      </Button>
    </div>
  );
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [branding, setBranding] = useState<EmailBranding>(DEFAULT_BRANDING);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["email_templates", "email_branding"])
      .then(({ data }) => {
        data?.forEach((row) => {
          if (row.key === "email_templates") {
            const saved = row.value as any;
            if (Array.isArray(saved) && saved.length > 0) {
              setTemplates(saved);
            }
          } else if (row.key === "email_branding") {
            setBranding({ ...DEFAULT_BRANDING, ...(row.value as any) });
          }
        });
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();

    const { error: e1 } = await supabase
      .from("platform_settings")
      .upsert({ key: "email_templates", value: templates as any, updated_at: now }, { onConflict: "key" });

    const { error: e2 } = await supabase
      .from("platform_settings")
      .upsert({ key: "email_branding", value: branding as any, updated_at: now }, { onConflict: "key" });

    setSaving(false);

    if (e1 || e2) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    } else {
      toast({ title: "Sauvegardé", description: "Les templates email ont été mis à jour." });
    }
  };

  const updateTemplate = (id: string, patch: Partial<EmailTemplate>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const resetToDefaults = () => {
    setTemplates(DEFAULT_TEMPLATES);
    setBranding(DEFAULT_BRANDING);
    toast({ title: "Réinitialisé", description: "Templates remis par défaut (non sauvegardé)." });
  };

  const isOutfit = branding.font_family.includes("Outfit");

  const renderPreview = (tpl: EmailTemplate) => (
    <div
      style={{
        fontFamily: branding.font_family,
        backgroundColor: branding.bg_color,
        padding: "32px 16px",
        maxWidth: 600,
        margin: "0 auto",
      }}
    >
      {/* Google Font import for Outfit in preview */}
      {isOutfit && (
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      )}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        {branding.logo_url && (
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <img src={branding.logo_url} alt={branding.company_name} style={{ maxHeight: 48 }} />
          </div>
        )}
        <h1 style={{
          color: branding.text_color,
          fontSize: 22,
          fontWeight: isOutfit ? 600 : 700,
          marginBottom: 16,
          textAlign: "center",
          fontFamily: branding.font_family,
        }}>
          {tpl.heading}
        </h1>
        <p style={{
          color: branding.text_color,
          fontSize: 14,
          lineHeight: 1.6,
          marginBottom: 24,
          fontWeight: isOutfit ? 300 : 400,
          fontFamily: branding.font_family,
        }}>
          {tpl.body}
        </p>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span
            style={{
              display: "inline-block",
              backgroundColor: branding.primary_color,
              color: "#ffffff",
              padding: "12px 32px",
              borderRadius: 6,
              fontWeight: isOutfit ? 500 : 600,
              fontSize: 14,
              textDecoration: "none",
              fontFamily: branding.font_family,
            }}
          >
            {tpl.cta_label}
          </span>
        </div>
        <p style={{
          color: "#999999",
          fontSize: 12,
          textAlign: "center",
          marginTop: 24,
          fontWeight: isOutfit ? 300 : 400,
          fontFamily: branding.font_family,
        }}>
          {tpl.footer_text}
        </p>
        <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "24px 0" }} />
        <p style={{ color: "#999999", fontSize: 11, textAlign: "center", fontFamily: branding.font_family }}>
          © {new Date().getFullYear()} {branding.company_name} · {branding.support_email}
        </p>
      </div>
    </div>
  );

  return (
    <AdminLayout title="Templates Email">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Mail size={24} /> Templates Email
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Personnalisez les emails transactionnels envoyés aux utilisateurs
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetToDefaults}>
              <RotateCcw size={14} className="mr-1" /> Réinitialiser
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
              Sauvegarder
            </Button>
          </div>
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="branding">Style & Marque</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identité visuelle</CardTitle>
                <CardDescription>Personnalisez l'apparence de tous les emails</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom de l'entreprise</Label>
                  <Input value={branding.company_name} onChange={(e) => setBranding({ ...branding, company_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email de support</Label>
                  <Input value={branding.support_email} onChange={(e) => setBranding({ ...branding, support_email: e.target.value })} />
                </div>
                <LogoUploadField
                  value={branding.logo_url}
                  onChange={(url) => setBranding({ ...branding, logo_url: url })}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">Police</Label>
                  <Select
                    value={branding.font_family}
                    onValueChange={(v) => setBranding({ ...branding, font_family: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Outfit : Light pour le texte, Semi Bold pour les titres
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Couleur principale (boutons)</Label>
                  <div className="flex gap-2">
                    <input type="color" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Couleur du texte</Label>
                  <div className="flex gap-2">
                    <input type="color" value={branding.text_color} onChange={(e) => setBranding({ ...branding, text_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={branding.text_color} onChange={(e) => setBranding({ ...branding, text_color: e.target.value })} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Couleur de fond</Label>
                  <div className="flex gap-2">
                    <input type="color" value={branding.bg_color} onChange={(e) => setBranding({ ...branding, bg_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={branding.bg_color} onChange={(e) => setBranding({ ...branding, bg_color: e.target.value })} className="flex-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 mt-4">
            {templates.map((tpl) => (
              <Card key={tpl.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{tpl.name}</CardTitle>
                    <div className="flex items-center gap-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Eye size={14} className="mr-1" /> Aperçu
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Aperçu : {tpl.name}</DialogTitle>
                          </DialogHeader>
                          {renderPreview(tpl)}
                        </DialogContent>
                      </Dialog>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Actif</span>
                        <Switch checked={tpl.is_active} onCheckedChange={(v) => updateTemplate(tpl.id, { is_active: v })} />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sujet de l'email</Label>
                    <Input value={tpl.subject} onChange={(e) => updateTemplate(tpl.id, { subject: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Titre principal</Label>
                    <Input value={tpl.heading} onChange={(e) => updateTemplate(tpl.id, { heading: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contenu du message</Label>
                    <Textarea value={tpl.body} onChange={(e) => updateTemplate(tpl.id, { body: e.target.value })} rows={3} />
                    <p className="text-[11px] text-muted-foreground">Variables : {"{{order_ref}}"}, {"{{total}}"}, {"{{user_name}}"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Texte du bouton (CTA)</Label>
                      <Input value={tpl.cta_label} onChange={(e) => updateTemplate(tpl.id, { cta_label: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Texte de bas de page</Label>
                      <Input value={tpl.footer_text} onChange={(e) => updateTemplate(tpl.id, { footer_text: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
