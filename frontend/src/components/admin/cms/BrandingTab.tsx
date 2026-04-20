import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Image, Monitor, Smartphone, Info, Mail, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORM_FONTS } from "@/hooks/usePlatformFont";
import { sanitizeExtension } from "@/utils/sanitize-filename";

interface BrandingConfig {
  header_logo_url: string | null;
  footer_logo_url: string | null;
  logo_mode: "text" | "logo_only" | "logo_and_text";
  favicon_url: string | null;
  pwa_icon_192_url: string | null;
  pwa_icon_512_url: string | null;
  email_logo_url: string | null;
  email_signature_name: string;
  email_signature_address: string;
  email_signature_phone: string;
  email_signature_email: string;
  email_signature_website: string;
  email_signature_extra: string;
  primary_font: string;
}

const DEFAULT: BrandingConfig = {
  header_logo_url: null,
  footer_logo_url: null,
  logo_mode: "text",
  favicon_url: null,
  pwa_icon_192_url: null,
  pwa_icon_512_url: null,
  email_logo_url: null,
  email_signature_name: "Zandofy",
  email_signature_address: "",
  email_signature_phone: "",
  email_signature_email: "",
  email_signature_website: "https://zandofy.com",
  email_signature_extra: "",
  primary_font: PLATFORM_FONTS[0].value,
};

function BrandingTab() {
  const { toast } = useToast();
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "branding")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setConfig({ ...DEFAULT, ...(data.value as any) });
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "branding", value: config as any, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Branding sauvegardé ✓" });
    }
  };

  const uploadFile = async (file: File, field: keyof BrandingConfig) => {
    setUploading(field);
    const ext = sanitizeExtension(file.name, "png");
    const path = `branding/${field}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("cms-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) {
      toast({ title: "Erreur upload", description: error.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("cms-assets").getPublicUrl(path);
    setConfig((prev) => ({ ...prev, [field]: urlData.publicUrl }));
    setUploading(null);
  };

  const handleDrop = (field: keyof BrandingConfig) => (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file, field);
  };

  const updateField = (field: keyof BrandingConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const FileUploadZone = ({
    field,
    label,
    hint,
    accept,
  }: {
    field: keyof BrandingConfig;
    label: string;
    hint: string;
    accept: string;
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const currentUrl = config[field] as string | null;

    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">{label}</h4>
          {currentUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfig((prev) => ({ ...prev, [field]: null }))}
              className="text-destructive h-7"
            >
              <Trash2 size={14} className="mr-1" /> Supprimer
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Info size={10} />
          <span>{hint}</span>
        </div>

        {currentUrl ? (
          <div className="flex items-center gap-4">
            <div className="border border-border rounded-lg p-2 bg-muted/30">
              <img src={currentUrl} alt={label} className="h-12 w-auto object-contain" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading === field}
            >
              <Upload size={14} className="mr-1.5" />
              {uploading === field ? "Upload…" : "Remplacer"}
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop(field)}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload size={20} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {uploading === field ? "Upload en cours…" : "Glissez-déposez ou cliquez pour importer"}
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file, field);
            e.target.value = "";
          }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Branding & Identité visuelle</h2>
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>

      {/* Logo mode */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Image size={16} /> Mode d'affichage du logo
        </h3>
        <Select
          value={config.logo_mode}
          onValueChange={(v) => setConfig((prev) => ({ ...prev, logo_mode: v as any }))}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Texte uniquement (Zandofy)</SelectItem>
            <SelectItem value="logo_only">Logo image uniquement</SelectItem>
            <SelectItem value="logo_and_text">Logo image avec texte intégré</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          « Texte » = le mot Zandofy en police Outfit · « Logo seul » = image importée sans texte ·
          « Logo + texte intégré » = image horizontale contenant le logo et le nom
        </p>
      </div>

      {/* ═══════════════ TYPOGRAPHY SECTION ═══════════════ */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Type size={16} /> Typographie de la plateforme
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Choisissez la police principale utilisée sur l'ensemble du site. Le changement s'applique immédiatement aux titres, textes et boutons.
        </p>

        <Select
          value={config.primary_font}
          onValueChange={(v) => setConfig((prev) => ({ ...prev, primary_font: v }))}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_FONTS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                <span style={{ fontFamily: f.value }}>{f.label}</span>
                <span className="text-muted-foreground ml-2 text-[10px]">— {f.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Live Preview */}
        <div className="border border-border rounded-lg p-5 space-y-4 bg-muted/20" style={{ fontFamily: config.primary_font }}>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Aperçu en direct</p>
          <h1 className="text-2xl font-bold text-foreground">Titre principal (H1 · Bold 700)</h1>
          <h2 className="text-xl font-semibold text-foreground">Sous-titre (H2 · Semi-Bold 600)</h2>
          <h3 className="text-lg font-medium text-foreground">Section (H3 · Medium 500)</h3>
          <p className="text-sm text-foreground">
            Ceci est un paragraphe de texte en taille normale (Regular 400). La plateforme Zandofy offre une expérience
            d'achat moderne et intuitive pour tous ses utilisateurs.
          </p>
          <p className="text-xs text-muted-foreground font-light">
            Texte secondaire en Light 300 — utilisé pour les descriptions courtes et les légendes.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold" style={{ fontFamily: config.primary_font }}>
              Bouton principal
            </span>
            <span className="border border-border px-4 py-2 rounded-lg text-sm font-medium text-foreground" style={{ fontFamily: config.primary_font }}>
              Bouton secondaire
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2 border-t border-border">
            {[
              { w: 300, l: "Light" },
              { w: 400, l: "Regular" },
              { w: 500, l: "Medium" },
              { w: 600, l: "Semi-Bold" },
              { w: 700, l: "Bold" },
            ].map(({ w, l }) => (
              <div key={w} className="text-center">
                <p className="text-lg text-foreground" style={{ fontWeight: w }}>Aa</p>
                <p className="text-[9px] text-muted-foreground">{l} ({w})</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Header Logo */}
      <FileUploadZone
        field="header_logo_url"
        label="Logo Header (Navigation)"
        hint="Format SVG ou WebP recommandé · Taille conseillée : 200×50 px (ratio ~4:1) · Max 2 Mo"
        accept=".svg,.webp,.png,.jpg,.jpeg"
      />

      {/* Footer Logo */}
      <FileUploadZone
        field="footer_logo_url"
        label="Logo Footer (Pied de page)"
        hint="Format SVG ou WebP recommandé · Taille conseillée : 180×45 px · Si vide, le logo header sera utilisé"
        accept=".svg,.webp,.png,.jpg,.jpeg"
      />

      {/* Separator */}
      <div className="border-t border-border" />

      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <Monitor size={16} /> Favicon & Icônes PWA
      </h3>

      {/* Favicon */}
      <FileUploadZone
        field="favicon_url"
        label="Favicon (onglet navigateur)"
        hint="Format PNG ou ICO · Taille recommandée : 32×32 px ou 64×64 px · Max 500 Ko"
        accept=".png,.ico,.svg"
      />

      {/* PWA Icons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FileUploadZone
          field="pwa_icon_192_url"
          label="Icône PWA 192×192"
          hint="Format PNG obligatoire · Exactement 192×192 px · Utilisée pour l'écran d'accueil Android"
          accept=".png"
        />
        <FileUploadZone
          field="pwa_icon_512_url"
          label="Icône PWA 512×512"
          hint="Format PNG obligatoire · Exactement 512×512 px · Utilisée pour le splash screen"
          accept=".png"
        />
      </div>

      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Smartphone size={14} /> Guide des tailles recommandées
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px] text-muted-foreground">
          <div><strong>Logo header :</strong> 200×50 px</div>
          <div><strong>Logo footer :</strong> 180×45 px</div>
          <div><strong>Favicon :</strong> 32×32 ou 64×64 px</div>
          <div><strong>PWA petite :</strong> 192×192 px (PNG)</div>
          <div><strong>PWA grande :</strong> 512×512 px (PNG)</div>
          <div><strong>Formats :</strong> SVG, WebP, PNG</div>
        </div>
      </div>

      {/* ═══════════════ EMAIL BRANDING SECTION ═══════════════ */}
      <div className="border-t border-border" />

      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <Mail size={16} /> Branding Emails
      </h3>
      <p className="text-xs text-muted-foreground -mt-4">
        Logo et signature intégrés dans tous les emails transactionnels (confirmations de commande, notifications, etc.)
      </p>

      {/* Email Logo */}
      <FileUploadZone
        field="email_logo_url"
        label="Logo Email (PNG)"
        hint="Format PNG recommandé · Taille conseillée : 200×60 px · Affiché en en-tête de chaque email · Max 500 Ko"
        accept=".png,.jpg,.jpeg,.webp"
      />

      {/* Email Signature */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Signature Email</h4>
        <p className="text-[10px] text-muted-foreground">
          Ces informations apparaissent en pied de page de chaque email envoyé par la plateforme.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom de l'entreprise</Label>
            <Input
              value={config.email_signature_name}
              onChange={(e) => updateField("email_signature_name", e.target.value)}
              placeholder="Zandofy"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email de contact</Label>
            <Input
              value={config.email_signature_email}
              onChange={(e) => updateField("email_signature_email", e.target.value)}
              placeholder="support@zandofy.com"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Téléphone</Label>
            <Input
              value={config.email_signature_phone}
              onChange={(e) => updateField("email_signature_phone", e.target.value)}
              placeholder="+243 XXX XXX XXX"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Site web</Label>
            <Input
              value={config.email_signature_website}
              onChange={(e) => updateField("email_signature_website", e.target.value)}
              placeholder="https://zandofy.com"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Adresse postale</Label>
          <Input
            value={config.email_signature_address}
            onChange={(e) => updateField("email_signature_address", e.target.value)}
            placeholder="123 Avenue de la Paix, Kinshasa, RDC"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Informations supplémentaires</Label>
          <Textarea
            value={config.email_signature_extra}
            onChange={(e) => updateField("email_signature_extra", e.target.value)}
            placeholder="Ex: RCCM, numéro d'identification fiscale, slogan…"
            rows={2}
            className="text-sm"
          />
        </div>
      </div>

      {/* Preview */}
      {(config.email_logo_url || config.email_signature_name) && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Aperçu signature email</h4>
          <div className="bg-muted/20 rounded-lg p-4 text-center space-y-2">
            {config.email_logo_url && (
              <img src={config.email_logo_url} alt="Logo email" className="h-10 mx-auto object-contain" />
            )}
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              {config.email_signature_name && <p className="font-semibold text-foreground text-xs">{config.email_signature_name}</p>}
              {config.email_signature_address && <p>{config.email_signature_address}</p>}
              {config.email_signature_phone && <p>Tél : {config.email_signature_phone}</p>}
              {config.email_signature_email && <p>{config.email_signature_email}</p>}
              {config.email_signature_website && <p>{config.email_signature_website}</p>}
              {config.email_signature_extra && <p className="italic">{config.email_signature_extra}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BrandingTab;
