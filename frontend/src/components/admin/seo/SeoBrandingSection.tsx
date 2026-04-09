import { useState, useRef } from "react";
import { Image, Type, Upload, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SeoBrandingSectionProps {
  brandName: string;
  tagline: string;
  defaultOgImage: string;
  onBrandNameChange: (val: string) => void;
  onTaglineChange: (val: string) => void;
  onOgImageChange: (val: string) => void;
  inputClass: string;
}

export function SeoBrandingSection({
  brandName,
  tagline,
  defaultOgImage,
  onBrandNameChange,
  onTaglineChange,
  onOgImageChange,
  inputClass,
}: SeoBrandingSectionProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Seules les images sont acceptées");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `og-image-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("seo-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Erreur upload : " + error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("seo-assets").getPublicUrl(path);
    onOgImageChange(data.publicUrl);
    toast.success("Image OG uploadée");
    setUploading(false);
  };

  const handleRemove = () => {
    onOgImageChange("");
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Type size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Branding & Image</h2>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Nom de marque (JSON-LD Organization)</label>
          <input
            value={brandName}
            onChange={(e) => onBrandNameChange(e.target.value)}
            placeholder="Zandofy"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Slogan / Tagline</label>
          <input
            value={tagline}
            onChange={(e) => onTaglineChange(e.target.value)}
            placeholder="Première plateforme e-commerce sino-africaine..."
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            <Image size={12} className="inline mr-1" />
            Image OG par défaut
          </label>

          {defaultOgImage ? (
            <div className="mt-1 relative max-w-xs group">
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={defaultOgImage} alt="OG preview" className="w-full h-auto" />
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-1 w-full max-w-xs h-28 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Upload size={20} />
                  <span className="text-xs">Cliquer pour uploader (1200×630 recommandé)</span>
                </>
              )}
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>
    </section>
  );
}
