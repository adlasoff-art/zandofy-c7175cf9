import { Image, Type } from "lucide-react";

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
            Image OG par défaut (URL)
          </label>
          <input
            value={defaultOgImage}
            onChange={(e) => onOgImageChange(e.target.value)}
            placeholder="https://zandofy.com/og-image.png"
            className={inputClass}
          />
          {defaultOgImage && (
            <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-xs">
              <img src={defaultOgImage} alt="OG preview" className="w-full h-auto" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
