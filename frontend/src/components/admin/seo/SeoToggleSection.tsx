import { Globe, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SeoToggleSectionProps {
  seoEnabled: boolean;
  onToggle: (val: boolean) => void;
}

export function SeoToggleSection({ seoEnabled, onToggle }: SeoToggleSectionProps) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Contrôle global du SEO</h2>
      </div>

      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="text-sm font-medium text-foreground">Activer le référencement</p>
          <p className="text-xs text-muted-foreground">
            {seoEnabled
              ? "Le site est indexable par les moteurs de recherche"
              : "Le site est masqué des moteurs de recherche (noindex, nofollow)"}
          </p>
        </div>
        <Switch checked={seoEnabled} onCheckedChange={onToggle} />
      </div>

      {!seoEnabled && (
        <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Mode privé actif</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Les moteurs de recherche ne peuvent pas indexer le site. Activez le SEO quand vous êtes prêt pour le lancement.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
