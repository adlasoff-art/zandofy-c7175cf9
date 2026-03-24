import { useCompare } from "@/contexts/CompareContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Star, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";

export default function ComparePage() {
  const { items, removeFromCompare, clearCompare } = useCompare();
  const { formatPrice } = useI18n();

  const rows: { label: string; render: (p: typeof items[0]) => React.ReactNode }[] = [
    { label: "Image", render: (p) => <img src={p.image} alt={p.nameFr} className="w-24 h-32 object-cover rounded-sm mx-auto" /> },
    { label: "Nom", render: (p) => <Link to={`/product/${p.slug || p.id}`} className="text-sm font-medium text-primary hover:underline">{p.nameFr}</Link> },
    { label: "Prix", render: (p) => (
      <div>
        <span className="font-bold text-foreground">{formatPrice(p.price)}</span>
        {p.originalPrice && <span className="text-xs text-muted-foreground line-through ml-1">{formatPrice(p.originalPrice)}</span>}
      </div>
    )},
    { label: "Note", render: (p) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <Star size={12} className="fill-accent text-accent" /> {p.rating || "—"}
      </span>
    )},
    { label: "Avis", render: (p) => <span className="text-sm">{p.reviewCount}</span> },
    { label: "Catégorie", render: (p) => <span className="text-sm text-muted-foreground">{p.categoryFr}</span> },
    { label: "Origine", render: (p) => <span className="text-sm text-muted-foreground">{p.originCountry || "—"}</span> },
    { label: "Matière", render: (p) => <span className="text-sm text-muted-foreground">{p.material || "—"}</span> },
    { label: "Tailles", render: (p) => <span className="text-xs text-muted-foreground">{p.sizes?.join(", ") || "—"}</span> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-foreground">Comparateur ({items.length})</h1>
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearCompare}>Vider</Button>
          )}
        </div>

        {items.length < 2 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>Ajoutez au moins 2 produits pour comparer.</p>
            <Link to="/" className="text-primary underline mt-2 inline-block">Retour aux produits</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-sm text-muted-foreground p-3 w-28"></th>
                  {items.map((item) => (
                    <th key={item.id} className="p-3 text-center relative min-w-[160px]">
                      <button
                        onClick={() => removeFromCompare(item.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X size={12} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-border">
                    <td className="p-3 text-sm font-medium text-muted-foreground whitespace-nowrap">{row.label}</td>
                    {items.map((item) => (
                      <td key={item.id} className="p-3 text-center">{row.render(item)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
