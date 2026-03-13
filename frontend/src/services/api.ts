// Supabase-powered API service layer
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  nameFr: string;
  price: number;
  originalPrice?: number;
  currency: string;
  image: string;
  category: string;
  categoryFr: string;
  rating: number;
  reviewCount: number;
  isNew?: boolean;
  isSale?: boolean;
  discount?: number;
  colors?: string[];
  sizes?: string[];
  moq?: number;
  verifiedYears?: number;
  originCountry?: string;
  sku?: string;
  material?: string;
  style?: string;
  storeId?: string;
  shortDescription?: string;
  description?: string;
  weightGrams?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface PricingTierRow {
  id: string;
  tier_label: string;
  min_quantity: number;
  discount_type: string;
  discount_value: number;
}

export interface Category {
  id: string;
  name: string;
  nameFr: string;
  icon: string;
  subcategories: { name: string; nameFr: string }[];
}

// Map Supabase row to Product interface
function mapProduct(row: any): Product {
  // Determine verification from the store (not product's own verified_years)
  const storeData = row.stores;
  const storeIsVerified = storeData?.is_verified ?? false;
  const storeVerifiedYears = storeData?.verified_years_override ?? storeData?.verified_years ?? 0;

  // Use admin overrides for review_count and rating if set, otherwise use real DB values
  const realReviewCount = row.review_count_override ?? row.review_count ?? 0;
  const realRating = Number(row.rating) || 0;
  const realSalesCount = row.sales_count_override ?? 0;

  const p: Product = {
    id: row.id,
    name: row.name,
    nameFr: row.name_fr,
    price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    currency: row.currency,
    image: row.product_images?.[0]?.image_url || "/placeholder.svg",
    category: row.categories?.name || "",
    categoryFr: row.categories?.name_fr || "",
    rating: realRating,
    reviewCount: realReviewCount,
    isNew: row.is_new || false,
    isSale: row.is_sale || false,
    discount: row.discount || 0,
    colors: row.product_colors?.map((c: any) => c.color_hex) || [],
    sizes: row.product_sizes?.map((s: any) => s.size_label) || [],
    moq: row.moq || 1,
    // Verification comes from the STORE, not the product
    verifiedYears: storeIsVerified ? storeVerifiedYears : 0,
    originCountry: row.origin_country || "",
    sku: row.sku || "",
    material: row.material || "",
    style: row.style || "",
    storeId: row.store_id || "",
    shortDescription: row.short_description || undefined,
    description: row.description || undefined,
    weightGrams: row.weight_grams || undefined,
    lengthCm: row.length_cm ? Number(row.length_cm) : undefined,
    widthCm: row.width_cm ? Number(row.width_cm) : undefined,
    heightCm: row.height_cm ? Number(row.height_cm) : undefined,
  };
  // Attach store verification status
  (p as any).storeIsVerified = storeIsVerified;
  // Attach all gallery images for the product page
  (p as any).galleryImages = row.product_images || [];
  // Attach promo dates for flash sales
  (p as any).promoEndDate = row.promo_end_date || null;
  (p as any).promoStartDate = row.promo_start_date || null;
  return p;
}

const PRODUCT_SELECT = `
  *,
  categories(name, name_fr),
  product_images(image_url, position),
  product_colors(color_hex, color_name),
  product_sizes(size_label, region, bust_cm, waist_cm, hips_cm),
  stores!products_store_id_fkey(id, name, is_verified, verified_years, verified_years_override, is_online, sales_count, sales_override, followers_count, followers_override)
`;

export async function fetchProducts(params?: {
  category?: string;
  limit?: number;
  sale?: boolean;
}): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("publish_status", "published")
    .order("created_at", { ascending: false });

  if (params?.category) {
    // Filter by category name (subcategory)
    query = query.eq("categories.name", params.category);
  }
  if (params?.sale) {
    query = query.eq("is_sale", true);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  let results = (data || []).map(mapProduct);

  // Filter out products that didn't match category join
  if (params?.category) {
    results = results.filter((p) => p.category === params.category);
  }

  return results;
}

export async function fetchFlashSaleProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("publish_status", "published")
    .eq("is_sale", true)
    .order("discount", { ascending: false });

  if (error) {
    console.error("Error fetching flash sales:", error);
    return [];
  }

  return (data || []).map(mapProduct);
}

export async function fetchCategories(): Promise<Category[]> {
  // Get parent categories
  const { data: parents, error: pErr } = await supabase
    .from("categories")
    .select("id, name, name_fr, icon")
    .is("parent_id", null)
    .order("name");

  if (pErr || !parents) {
    console.error("Error fetching categories:", pErr);
    return [];
  }

  // Get subcategories
  const { data: subs, error: sErr } = await supabase
    .from("categories")
    .select("name, name_fr, parent_id")
    .not("parent_id", "is", null);

  if (sErr) {
    console.error("Error fetching subcategories:", sErr);
  }

  return parents.map((p) => ({
    id: p.id,
    name: p.name,
    nameFr: p.name_fr,
    icon: p.icon || "",
    subcategories: (subs || [])
      .filter((s) => s.parent_id === p.id)
      .map((s) => ({ name: s.name, nameFr: s.name_fr })),
  }));
}

export async function fetchProductById(
  id: string
): Promise<Product | undefined> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      categories(name, name_fr),
      product_images(image_url, position),
      product_colors(color_hex, color_name),
      product_sizes(size_label, region, bust_cm, waist_cm, hips_cm),
      stores!products_store_id_fkey(id, name, logo_url, is_verified, verified_years, verified_years_override, followers_count, followers_override, products_count, repurchase_rate, sales_count, sales_override, sales_trend, is_online, whatsapp_number, rating, response_rate, response_time)
    `)
    .eq("id", id)
    .eq("publish_status", "published")
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching product:", error);
    return undefined;
  }

  const product = mapProduct(data);
  // Attach store data for PDP
  (product as any).store = (data as any).stores;
  
  // Fetch seller rank for this product's category
  if (data.category_id && data.store_id) {
    try {
      const { data: rankings } = await supabase.rpc("get_category_top_sellers", {
        p_category_id: data.category_id,
        p_limit: 10,
      });
      if (rankings) {
        const storeRank = rankings.find((r: any) => r.store_id === data.store_id);
        if (storeRank) {
          (product as any).sellerRank = Number(storeRank.rank);
        }
      }
    } catch (e) {
      // Silently fail - rank is optional
    }
  }
  
  return product;
}

export async function fetchPricingTiers(productId: string): Promise<PricingTierRow[]> {
  const { data, error } = await supabase
    .from("product_pricing_tiers")
    .select("id, tier_label, min_quantity, discount_type, discount_value")
    .eq("product_id", productId)
    .order("min_quantity", { ascending: true });

  if (error) {
    console.error("Error fetching pricing tiers:", error);
    return [];
  }
  return data || [];
}
