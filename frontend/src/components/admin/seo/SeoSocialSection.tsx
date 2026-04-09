import { Share2 } from "lucide-react";

interface SeoSocialSectionProps {
  facebook: string;
  instagram: string;
  twitter: string;
  onFacebookChange: (val: string) => void;
  onInstagramChange: (val: string) => void;
  onTwitterChange: (val: string) => void;
  inputClass: string;
}

export function SeoSocialSection({
  facebook,
  instagram,
  twitter,
  onFacebookChange,
  onInstagramChange,
  onTwitterChange,
  inputClass,
}: SeoSocialSectionProps) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Share2 size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Réseaux sociaux</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Injectés dans le JSON-LD Organization (sameAs) pour le référencement.
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Facebook (URL)</label>
          <input
            value={facebook}
            onChange={(e) => onFacebookChange(e.target.value)}
            placeholder="https://facebook.com/zandofy"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Instagram (URL)</label>
          <input
            value={instagram}
            onChange={(e) => onInstagramChange(e.target.value)}
            placeholder="https://instagram.com/zandofy"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Twitter / X (URL)</label>
          <input
            value={twitter}
            onChange={(e) => onTwitterChange(e.target.value)}
            placeholder="https://twitter.com/zandofy"
            className={inputClass}
          />
        </div>
      </div>
    </section>
  );
}
