// Supabase-powered API service layer
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";

export interface Product {
  id: string;
  slug?: string;
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
  careInstructions?: string;
  season?: string;
  salesCount?: number;
  storeId?: string;
  shortDescription?: string;
  description?: string;
  weightGrams?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  trendTagId?: string;
  // Extended properties set by mapProduct
  storeIsVerified?: boolean;
  galleryImages?: Array<{ image_url: string; position: number }>;
  promoEndDate?: string | null;
  promoStartDate?: string | null;
  productColors?: Array<{ hex: string; name: string; imageUrl: string | null }>;
  flashPrice?: number;
  flashEndsAt?: string;
  store?: any;
  sellerRank?: number;
}

export interface TrendTag {
  id: string;
  name: string;
  nameFr: string;
  slug: string;
  sortOrder: number;
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
export function mapProduct(row: any): Product {
  const storeData = row.stores;
  const storeIsVerified = storeData?.is_verified ?? false;
  const storeVerifiedYears = storeData?.verified_years_override ?? storeData?.verified_years ?? 0;

  const realReviewCount = row.review_count_override ?? row.review_count ?? 0;
  const realRating = Number(row.rating) || 0;

  return {
    id: row.id,
    slug: row.slug || row.id,
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
    salesCount: row.sales_count_override ?? row.sales_count ?? 0,
    isNew: row.is_new || false,
    isSale: row.is_sale || false,
    discount: row.discount || 0,
    colors: row.product_colors?.map((c: any) => c.color_hex) || [],
    sizes: row.product_sizes?.map((s: any) => s.size_label) || [],
    moq: row.moq || 1,
    verifiedYears: storeIsVerified ? storeVerifiedYears : 0,
    originCountry: row.origin_country || "",
    sku: row.sku || "",
    material: row.material || "",
    style: row.style || "",
    careInstructions: row.care_instructions || "",
    season: row.season || "",
    storeId: row.store_id || "",
    shortDescription: row.short_description || undefined,
    description: row.description || undefined,
    weightGrams: row.weight_grams || undefined,
    lengthCm: row.length_cm ? Number(row.length_cm) : undefined,
    widthCm: row.width_cm ? Number(row.width_cm) : undefined,
    heightCm: row.height_cm ? Number(row.height_cm) : undefined,
    trendTagId: row.trend_tag_id || undefined,
    storeIsVerified,
    galleryImages: row.product_images || [],
    promoEndDate: row.promo_end_date || null,
    promoStartDate: row.promo_start_date || null,
    productColors: (row.product_colors || []).map((c: any) => ({
      hex: c.color_hex,
      name: c.color_name || "",
      imageUrl: c.image_url || null,
    })),
  };
}

const PRODUCT_SELECT = `
  *,
  categories(name, name_fr),
  product_images(image_url, position),
  product_colors(color_hex, color_name, image_url),
  product_sizes(size_label, region, bust_cm, waist_cm, hips_cm),
  stores!products_store_id_fkey(id, name, is_verified, verified_years, verified_years_override, is_online, sales_count, sales_override, followers_count, followers_override)
`;

export async function fetchProducts(params?: {
  category?: string;
  limit?: number;
  offset?: number;
  sale?: boolean;
  trendTagId?: string;
  categoryId?: string;
  orderBy?: "popular" | "newest" | "default";
}): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("publish_status", "published");

  // Order
  if (params?.orderBy === "popular") {
    query = query.order("review_count", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (params?.category) {
    query = query.eq("categories.name", params.category);
  }
  if (params?.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params?.trendTagId) {
    query = (query as any).eq("trend_tag_id", params.trendTagId);
  }
  if (params?.sale) {
    query = query.eq("is_sale", true);
  }
  if (params?.offset) {
    query = query.range(params.offset, params.offset + (params?.limit || 24) - 1);
  } else if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  let results = (data || []).map(mapProduct);

  if (params?.category) {
    results = results.filter((p) => p.category === params.category);
  }

  return results;
}

export async function fetchTrendTags(): Promise<TrendTag[]> {
  const { data, error } = await fromTable("trend_tags")
    .select("id, name, name_fr, slug, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("Error fetching trend tags:", error);
    return [];
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    nameFr: t.name_fr,
    slug: t.slug,
    sortOrder: t.sort_order,
  }));
}

export async function fetchFlashSaleProducts(): Promise<(Product & { flashPrice?: number; flashEndsAt?: string })[]> {
  const now = new Date().toISOString();

  // First try real flash_sales table
  const { data: flashData } = await fromTable("flash_sales")
    .select("product_id, flash_price, ends_at")
    .eq("is_active", true)
    .gte("ends_at", now)
    .lte("starts_at", now);

  if (flashData && flashData.length > 0) {
    const productIds = flashData.map((f: any) => f.product_id);
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("publish_status", "published")
      .in("id", productIds);

    if (error || !data) return [];

    const flashMap = new Map(flashData.map((f: any) => [f.product_id, f]));
    return data.map((row: any) => {
      const p = mapProduct(row);
      const flash: any = flashMap.get(row.id);
      if (flash) {
        p.flashPrice = Number(flash.flash_price);
        p.flashEndsAt = flash.ends_at;
        p.promoEndDate = flash.ends_at;
      }
      return p;
    });
  }

  // Fallback: products with is_sale
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
  const { data: parents, error: pErr } = await (supabase as any)
    .from("categories")
    .select("id, name, name_fr, icon")
    .is("parent_id", null)
    .order("name_fr");

  if (pErr || !parents) {
    console.error("Error fetching categories:", pErr);
    return [];
  }

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

export async function fetchProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const productSelect = `
    *,
    categories(name, name_fr),
    product_images(image_url, position),
    product_colors(color_hex, color_name, image_url),
    product_sizes(size_label, region, bust_cm, waist_cm, hips_cm),
    stores!products_store_id_fkey(id, name, logo_url, is_verified, verified_years, verified_years_override, followers_count, followers_override, products_count, repurchase_rate, sales_count, sales_override, sales_trend, is_online, whatsapp_number, rating, response_rate, response_time)
  `;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const { data, error } = await (supabase
    .from("products")
    .select(productSelect)
    .eq("publish_status", "published") as any)
    .eq(isUuid ? "id" : "slug", slug)
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching product:", error);
    return undefined;
  }

  const product = mapProduct(data);
  product.store = data.stores;

  // Load dynamic variant selections with type info
  try {
    const { data: selections } = await (supabase as any)
      .from("product_variant_selections")
      .select("variant_type_id, variant_option_id")
      .eq("product_id", data.id);

    if (selections && selections.length > 0) {
      const typeIds = [...new Set(selections.map((s: any) => s.variant_type_id))];
      const optionIds = selections.map((s: any) => s.variant_option_id);

      const [typesRes, optionsRes] = await Promise.all([
        (supabase as any).from("variant_types").select("id, name, unit, icon").in("id", typeIds),
        (supabase as any).from("variant_type_options").select("id, variant_type_id, label, sort_order").in("id", optionIds).order("sort_order"),
      ]);

      const typesMap = new Map((typesRes.data || []).map((t: any) => [t.id, t]));
      const dynamicVariants: any[] = [];

      for (const typeId of typeIds) {
        const type = typesMap.get(typeId) as any;
        if (!type) continue;
        const typeOptions = (optionsRes.data || []).filter((o: any) => o.variant_type_id === typeId);
        dynamicVariants.push({
          typeId: type.id,
          typeName: type.name,
          unit: type.unit,
          icon: type.icon,
          options: typeOptions.map((o: any) => ({ id: o.id, label: o.label })),
        });
      }

      (product as any).dynamicVariants = dynamicVariants;
    }
  } catch (e) {
    // Silently fail - variants are optional
  }
  
  if (data.category_id && data.store_id) {
    try {
      const { data: rankings } = await supabase.rpc("get_category_top_sellers", {
        p_category_id: data.category_id,
        p_limit: 10,
      });
      if (rankings) {
        const storeRank = rankings.find((r: any) => r.store_id === data.store_id);
        if (storeRank) {
          product.sellerRank = Number(storeRank.rank);
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
