import { Store, Package } from "lucide-react";

export function SeoStoresSection() {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Store size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">SEO des boutiques & produits</h2>
      </div>
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
          <Store size={16} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Boutiques</p>
            <p className="text-xs">
              Les vendeurs peuvent définir un titre SEO, une meta description et des mots-clés pour leur boutique depuis
              leur tableau de bord.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
          <Package size={16} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Produits</p>
            <p className="text-xs">
              Chaque produit dispose de champs SEO (titre, description, mots-clés) éditables par le vendeur lors de la
              création ou modification du produit.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
