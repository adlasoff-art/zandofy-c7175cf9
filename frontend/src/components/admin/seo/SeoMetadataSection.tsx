import { Search, Tag } from "lucide-react";

interface SeoMetadataSectionProps {
  siteTitle: string;
  siteDescription: string;
  keywordsInput: string;
  onTitleChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onKeywordsChange: (val: string) => void;
  inputClass: string;
}

export function SeoMetadataSection({
  siteTitle,
  siteDescription,
  keywordsInput,
  onTitleChange,
  onDescriptionChange,
  onKeywordsChange,
  inputClass,
}: SeoMetadataSectionProps) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Search size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Métadonnées globales</h2>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Titre du site (balise title)</label>
          <input
            value={siteTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            maxLength={60}
            className={inputClass}
          />
          <p className="text-[10px] text-muted-foreground mt-1">{siteTitle.length}/60 caractères</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Description (meta description)</label>
          <textarea
            value={siteDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            maxLength={160}
            rows={3}
            className={inputClass}
          />
          <p className="text-[10px] text-muted-foreground mt-1">{siteDescription.length}/160 caractères</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            <Tag size={12} className="inline mr-1" />
            Mots-clés par défaut (séparés par des virgules)
          </label>
          <input
            value={keywordsInput}
            onChange={(e) => onKeywordsChange(e.target.value)}
            placeholder="marketplace, mode, afrique, shopping"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {keywordsInput
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
              .map((k, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {k}
                </span>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
