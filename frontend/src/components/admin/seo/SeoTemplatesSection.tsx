import { Layers } from "lucide-react";

interface SeoTemplatesSectionProps {
  categoryTitleTemplate: string;
  categoryDescriptionTemplate: string;
  productTitleTemplate: string;
  productDescriptionTemplate: string;
  storeTitleTemplate: string;
  storeDescriptionTemplate: string;
  onChange: (key: string, value: string) => void;
  inputClass: string;
}

export function SeoTemplatesSection({
  categoryTitleTemplate,
  categoryDescriptionTemplate,
  productTitleTemplate,
  productDescriptionTemplate,
  storeTitleTemplate,
  storeDescriptionTemplate,
  onChange,
  inputClass,
}: SeoTemplatesSectionProps) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Layers size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Templates SEO</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Variables : <code className="text-[10px]">{"{name}"}</code>,{" "}
        <code className="text-[10px]">{"{brand}"}</code>,{" "}
        <code className="text-[10px]">{"{category}"}</code>. Utilisés si aucune meta
        spécifique n&apos;est renseignée.
      </p>
      {(
        [
          ["category_title_template", "Catégorie — titre", categoryTitleTemplate],
          ["category_description_template", "Catégorie — description", categoryDescriptionTemplate],
          ["product_title_template", "Produit — titre", productTitleTemplate],
          ["product_description_template", "Produit — description", productDescriptionTemplate],
          ["store_title_template", "Boutique — titre", storeTitleTemplate],
          ["store_description_template", "Boutique — description", storeDescriptionTemplate],
        ] as const
      ).map(([key, label, value]) => (
        <div key={key}>
          <label className="text-xs text-muted-foreground block mb-1">{label}</label>
          <input
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
            className={inputClass}
          />
          <p className="text-[10px] text-muted-foreground mt-1">{value.length} car.</p>
        </div>
      ))}
    </section>
  );
}
