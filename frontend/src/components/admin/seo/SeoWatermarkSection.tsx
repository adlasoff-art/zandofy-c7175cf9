import { useEffect, useRef, useState } from "react";
import { Droplets, Upload, Loader2, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

interface WatermarkConfig {
  enabled: boolean;
  logo_url: string;
  position: Position;
  opacity: number;
  size_ratio: number;
  margin_ratio: number;
}

const DEFAULT: WatermarkConfig = {
  enabled: false,
  logo_url: "",
  position: "bottom-right",
  opacity: 0.5,
  size_ratio: 0.12,
  margin_ratio: 0.02,
};

export function SeoWatermarkSection() {
  const [config, setConfig] = useState<WatermarkConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "watermark_config")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          setConfig({ ...DEFAULT, ...(data.value as Partial<WatermarkConfig>) });
        }
        setLoading(false);
      });
  }, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Seules les images sont acceptées");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `watermark-logo-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("seo-assets")
      .upload(path, file, { upsert: true, cacheControl: "31536000" });
    if (error) {
      toast.error("Erreur upload : " + error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("seo-assets").getPublicUrl(path);
    setConfig((p) => ({ ...p, logo_url: data.publicUrl }));
    toast.success("Logo filigrane uploadé");
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      { key: "watermark_config", value: config as any, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success("Filigrane enregistré");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="border border-border rounded-lg p-6 flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Droplets size={18} className="text-primary" />
        <h3 className="text-sm font-semibold">Filigrane sur images produits</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Incruste automatiquement le logo dans chaque nouvelle image produit uploadée par les
        vendeurs. Une seule version est stockée (l'original est remplacé).
      </p>

      {/* Toggle */}
      <label className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer">
        <div>
          <div className="text-sm font-medium">Activer le filigrane</div>
          <div className="text-xs text-muted-foreground">
            S'applique uniquement aux uploads futurs.
          </div>
        </div>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
          className="w-5 h-5 accent-primary"
        />
      </label>

      {/* Logo upload */}
      <div>
        <label className="text-xs text-muted-foreground">Logo (PNG transparent recommandé)</label>
        <div className="mt-1 flex items-center gap-3">
          {config.logo_url ? (
            <div className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-checkered">
              <img src={config.logo_url} alt="Filigrane" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, logo_url: "" }))}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-20 h-20 rounded-md border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center text-muted-foreground"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span className="text-[9px] mt-1">Logo</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Position */}
      <div>
        <label className="text-xs text-muted-foreground">Position</label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {([
            ["top-left", "Haut gauche"],
            ["top-right", "Haut droite"],
            ["center", "Centre"],
            ["bottom-left", "Bas gauche"],
            ["bottom-right", "Bas droite"],
          ] as [Position, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setConfig((p) => ({ ...p, position: val }))}
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                config.position === val
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className="text-xs text-muted-foreground">
          Opacité : {Math.round(config.opacity * 100)}%
        </label>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={Math.round(config.opacity * 100)}
          onChange={(e) =>
            setConfig((p) => ({ ...p, opacity: Number(e.target.value) / 100 }))
          }
          className="w-full mt-1 accent-primary"
        />
      </div>

      {/* Size */}
      <div>
        <label className="text-xs text-muted-foreground">
          Taille du logo : {Math.round(config.size_ratio * 100)}% de la largeur de l'image
        </label>
        <input
          type="range"
          min={5}
          max={30}
          step={1}
          value={Math.round(config.size_ratio * 100)}
          onChange={(e) =>
            setConfig((p) => ({ ...p, size_ratio: Number(e.target.value) / 100 }))
          }
          className="w-full mt-1 accent-primary"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Enregistrer le filigrane
      </button>
    </div>
  );
}
