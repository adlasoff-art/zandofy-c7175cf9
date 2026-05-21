import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface RecommendedProduct {
  id: string;
  slug?: string | null;
  name: string;
  price: number;
  image: string;
  rating?: number;
}

export function RecommendationsSection() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let userGender: string | null = null;

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("gender, date_of_birth")
            .eq("id", user.id)
            .maybeSingle();

          if (profile) {
            userGender = (profile as any).gender || null;
          }
        }

        let query = supabase
          .from("products")
          .select("id, slug, name, price, rating, product_images(image_url, position), gender_target")
          .eq("publish_status", "published")
          .order("rating", { ascending: false })
          .limit(30);

        const { data: allProducts } = await query;
        const products_list = (allProducts || []) as any[];

        let filtered: any[];

        if (userGender === "female" || userGender === "femme") {
          const female = products_list.filter(p => p.gender_target === "female" || p.gender_target === "femme");
          const unisex = products_list.filter(p => p.gender_target === "unisex" && !female.includes(p));
          filtered = [...female, ...unisex].slice(0, 8);
        } else if (userGender === "male" || userGender === "homme") {
          const male = products_list.filter(p => p.gender_target === "male" || p.gender_target === "homme");
          const unisex = products_list.filter(p => p.gender_target === "unisex" && !male.includes(p));
          filtered = [...male, ...unisex].slice(0, 8);
        } else {
          const female = products_list.filter(p => p.gender_target === "female" || p.gender_target === "femme");
          const male = products_list.filter(p => p.gender_target === "male" || p.gender_target === "homme");
          const unisex = products_list.filter(p => !["female", "femme", "male", "homme"].includes(p.gender_target || ""));
          filtered = [
            ...female.slice(0, 3),
            ...male.slice(0, 3),
            ...unisex.slice(0, 2),
          ].slice(0, 8);
        }

        if (filtered.length < 8) {
          const existingIds = new Set(filtered.map(p => p.id));
          const remaining = products_list.filter(p => !existingIds.has(p.id));
          filtered = [...filtered, ...remaining].slice(0, 8);
        }

        setProducts(
          filtered.map((p: any) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            price: Number(p.price),
            rating: p.rating,
            image: p.product_images?.[0]?.image_url || "/placeholder.svg",
          }))
        );
      } catch {
        const { data: popular } = await supabase
          .from("products")
          .select("id, slug, name, price, rating, product_images(image_url, position)")
          .eq("publish_status", "published")
          .order("created_at", { ascending: false })
          .limit(8);

        setProducts(
          (popular || []).map((p: any) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            price: Number(p.price),
            rating: p.rating,
            image: p.product_images?.[0]?.image_url || "/placeholder.svg",
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="container py-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!products.length) return null;

  return (
    <section className="container py-6" aria-labelledby="home-recommendations-heading">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={20} className="text-primary" aria-hidden />
        <h2 id="home-recommendations-heading" className="text-lg font-bold text-foreground">
          {user ? t("home.forYou") : t("home.popularProducts")}
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map((product) => (
          <Link
            key={product.id}
            to={`/product/${product.slug || product.id}`}
            className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
            <div className="p-2.5">
              <p className="text-xs font-medium text-foreground line-clamp-2 mb-1">{product.name}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary">${product.price.toFixed(2)}</span>
                {product.rating != null && product.rating > 0 && (
                  <span className="text-[10px] text-primary">★ {product.rating}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
