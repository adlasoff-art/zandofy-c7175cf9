import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/services/api";

const SEARCH_SELECT = `
  *,
  categories(name, name_fr),
  product_images(image_url, position),
  product_colors(color_hex, color_name),
  product_sizes(size_label, region, bust_cm, waist_cm, hips_cm)
`;

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    nameFr: row.name_fr,
    price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    currency: row.currency,
    image: row.product_images?.[0]?.image_url || "/placeholder.svg",
    category: row.categories?.name || "",
    categoryFr: row.categories?.name_fr || "",
    rating: Number(row.rating) || 0,
    reviewCount: row.review_count || 0,
    isNew: row.is_new || false,
    isSale: row.is_sale || false,
    discount: row.discount || 0,
    colors: row.product_colors?.map((c: any) => c.color_hex) || [],
    sizes: row.product_sizes?.map((s: any) => s.size_label) || [],
    moq: row.moq || 1,
    verifiedYears: row.verified_years || 0,
    originCountry: row.origin_country || "",
    sku: row.sku || "",
    material: row.material || "",
    style: row.style || "",
    storeId: row.store_id || "",
    shortDescription: row.short_description || undefined,
  };
}

export interface SearchFilters {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  colors?: string[];
  sortBy?: "relevance" | "price_asc" | "price_desc" | "newest" | "rating";
}

export async function searchProducts(filters: SearchFilters): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select(SEARCH_SELECT);

  // Text search on name / name_fr
  if (filters.query) {
    query = query.or(`name.ilike.%${filters.query}%,name_fr.ilike.%${filters.query}%`);
  }

  // Price range
  if (filters.minPrice !== undefined) {
    query = query.gte("price", filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte("price", filters.maxPrice);
  }

  // Sorting
  switch (filters.sortBy) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "rating":
      query = query.order("rating", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    console.error("Search error:", error);
    return [];
  }

  let results = (data || []).map(mapProduct);

  // Client-side filter by category (join filter)
  if (filters.category) {
    results = results.filter(
      (p) => p.category === filters.category || p.categoryFr === filters.category
    );
  }

  // Client-side filter by sizes
  if (filters.sizes && filters.sizes.length > 0) {
    results = results.filter((p) =>
      p.sizes?.some((s) => filters.sizes!.includes(s))
    );
  }

  // Client-side filter by colors
  if (filters.colors && filters.colors.length > 0) {
    results = results.filter((p) =>
      p.colors?.some((c) => filters.colors!.includes(c))
    );
  }

  return results;
}

/** Lightweight autocomplete: returns top 6 matching products */
export async function autocompleteProducts(query: string): Promise<Product[]> {
  if (!query || query.length < 2) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id, name, name_fr, price, currency, product_images(image_url, position)")
    .or(`name.ilike.%${query}%,name_fr.ilike.%${query}%`)
    .limit(6);

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    nameFr: row.name_fr,
    price: Number(row.price),
    currency: row.currency,
    image: row.product_images?.[0]?.image_url || "/placeholder.svg",
    category: "",
    categoryFr: "",
    rating: 0,
    reviewCount: 0,
  }));
}

/** Get all distinct colors from DB for filter sidebar */
export async function fetchAllColors(): Promise<{ hex: string; name: string }[]> {
  const { data } = await supabase
    .from("product_colors")
    .select("color_hex, color_name");
  if (!data) return [];
  const seen = new Set<string>();
  return data.filter((c) => {
    if (seen.has(c.color_hex)) return false;
    seen.add(c.color_hex);
    return true;
  }).map((c) => ({ hex: c.color_hex, name: c.color_name }));
}

/** Get all distinct sizes from DB for filter sidebar */
export async function fetchAllSizes(): Promise<string[]> {
  const { data } = await supabase
    .from("product_sizes")
    .select("size_label");
  if (!data) return [];
  return [...new Set(data.map((s) => s.size_label))];
}
