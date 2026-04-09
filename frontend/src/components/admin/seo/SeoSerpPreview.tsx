import { Eye } from "lucide-react";

interface SeoSerpPreviewProps {
  title: string;
  description: string;
  url?: string;
}

export function SeoSerpPreview({ title, description, url = "https://zandofy.com" }: SeoSerpPreviewProps) {
  const truncatedTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
  const truncatedDesc = description.length > 160 ? description.slice(0, 157) + "..." : description;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Eye size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Aperçu Google (SERP)</h2>
      </div>
      <div className="bg-white dark:bg-muted/30 rounded-lg p-4 border border-border">
        <p className="text-xs text-muted-foreground mb-1 truncate">{url}</p>
        <p className="text-[#1a0dab] dark:text-blue-400 text-base font-medium leading-snug hover:underline cursor-default">
          {truncatedTitle || "Titre du site"}
        </p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {truncatedDesc || "Description du site..."}
        </p>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Simulation approximative — l'affichage réel peut varier selon Google.
      </p>
    </section>
  );
}
