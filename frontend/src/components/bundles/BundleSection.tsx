import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface BundleProduct {
  id: string;
  name: string;
  price: number;
  image: string;
}

interface Bundle {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  products: BundleProduct[];
}

export function BundleSection({ productId }: { productId: string }) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const { addItem } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      // Find bundles that contain this product
      const { data: bundleIds } = await (supabase as any)
        .from("bundle_items")
        .select("bundle_id")
        .eq("product_id", productId);

      if (!bundleIds?.length) return;

      const ids = [...new Set(bundleIds.map((b: any) => b.bundle_id))];

      const { data: bundlesData } = await (supabase as any)
        .from("product_bundles")
        .select("*")
        .in("id", ids)
        .eq("is_active", true);

      if (!bundlesData?.length) return;

      const results: Bundle[] = [];
      for (const bundle of bundlesData) {
        const { data: items } = await (supabase as any)
          .from("bundle_items")
          .select("product_id")
          .eq("bundle_id", bundle.id)
          .order("sort_order");

        if (!items?.length) continue;

        const { data: products } = await supabase
          .from("products")
          .select("id, name, price, product_images(image_url, position)")
          .in("id", items.map((i: any) => i.product_id));

        if (products) {
          results.push({
            id: bundle.id,
            name: bundle.name,
            description: bundle.description,
            discount_type: bundle.discount_type,
            discount_value: bundle.discount_value,
            products: products.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price),
              image: p.product_images?.[0]?.image_url || "/placeholder.svg",
            })),
          });
        }
      }
      setBundles(results);
    }
    load();
  }, [productId]);

  if (!bundles.length) return null;

  const calcBundlePrice = (bundle: Bundle) => {
    const total = bundle.products.reduce((s, p) => s + p.price, 0);
    if (bundle.discount_type === "percentage") {
      return total * (1 - bundle.discount_value / 100);
    }
    return Math.max(0, total - bundle.discount_value);
  };

  const handleAddBundle = (bundle: Bundle) => {
    bundle.products.forEach((p) => {
      addItem({ productId: p.id, name: p.name, nameFr: p.name, price: p.price, image: p.image, quantity: 1 });
    });
    toast({ title: "Bundle ajouté au panier", description: `${bundle.products.length} produits ajoutés` });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <Package size={18} className="text-primary" />
        Acheter ensemble
      </h3>
      {bundles.map((bundle) => {
        const originalTotal = bundle.products.reduce((s, p) => s + p.price, 0);
        const bundlePrice = calcBundlePrice(bundle);
        const savings = originalTotal - bundlePrice;

        return (
          <div key={bundle.id} className="border border-border rounded-xl p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-foreground">{bundle.name}</p>
                {bundle.description && (
                  <p className="text-xs text-muted-foreground">{bundle.description}</p>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
                -{bundle.discount_type === "percentage" ? `${bundle.discount_value}%` : `$${bundle.discount_value}`}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {bundle.products.map((product, i) => (
                <div key={product.id} className="flex items-center gap-2 shrink-0">
                  {i > 0 && <Plus size={14} className="text-muted-foreground" />}
                  <Link to={`/product/${product.id}`} className="flex items-center gap-2 hover:bg-muted rounded-lg p-1.5 transition-colors">
                    <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-lg border border-border" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate max-w-[100px]">{product.name}</p>
                      <p className="text-xs text-muted-foreground">${product.price.toFixed(2)}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground line-through">${originalTotal.toFixed(2)}</span>
                <span className="text-lg font-bold text-primary">${bundlePrice.toFixed(2)}</span>
                <span className="text-xs text-primary font-medium">-${savings.toFixed(2)}</span>
              </div>
              <Button size="sm" onClick={() => handleAddBundle(bundle)} className="gap-1.5">
                <ShoppingCart size={14} />
                Ajouter le bundle
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
