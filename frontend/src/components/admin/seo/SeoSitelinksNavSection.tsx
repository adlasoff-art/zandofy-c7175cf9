import { GripVertical, Plus, Trash2, Navigation } from "lucide-react";
import { DEFAULT_SITELINKS_NAV } from "@/hooks/use-seo-config";

export type SitelinkNavItem = { name: string; url: string };

interface SeoSitelinksNavSectionProps {
  items: SitelinkNavItem[];
  onChange: (items: SitelinkNavItem[]) => void;
  inputClass: string;
}

export function SeoSitelinksNavSection({
  items,
  onChange,
  inputClass,
}: SeoSitelinksNavSectionProps) {
  const list = items?.length ? items : DEFAULT_SITELINKS_NAV;

  const update = (index: number, patch: Partial<SitelinkNavItem>) => {
    const next = list.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };

  const remove = (index: number) => onChange(list.filter((_, i) => i !== index));

  const add = () => onChange([...list, { name: "", url: "/" }]);

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Navigation size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Navigation sitelinks (JSON-LD)</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Candidats pour les sous-liens Google sous le résultat marque. Google décide seuls
        lesquels afficher — cette liste maximise les chances.
      </p>
      <div className="space-y-2">
        {list.map((item, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <button
              type="button"
              className="p-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => move(i, -1)}
              aria-label="Monter"
            >
              <GripVertical size={14} />
            </button>
            <input
              value={item.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Libellé"
              className={`${inputClass} flex-1`}
            />
            <input
              value={item.url}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="/chemin"
              className={`${inputClass} flex-1`}
            />
            <div className="flex gap-1">
              <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => move(i, 1)}>
                ↓
              </button>
              <button
                type="button"
                className="p-1.5 text-destructive"
                onClick={() => remove(i)}
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <Plus size={14} /> Ajouter un lien
      </button>
    </section>
  );
}
