/**
 * Generate a unique slug for a product, derived from its French name (preferred)
 * or English name. Checks the products table for collisions and appends a short
 * suffix when the base slug is already taken.
 *
 * Used by VendorProductManager when creating/updating products so URLs always
 * look like /product/blouse-en-soie-elegante instead of /product/<uuid>.
 */
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/utils/slugify";

const MAX_BASE_LENGTH = 80;

function trimToMaxLength(slug: string, max = MAX_BASE_LENGTH): string {
  if (slug.length <= max) return slug;
  return slug.slice(0, max).replace(/-+$/, "");
}

export async function generateProductSlug(
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = trimToMaxLength(slugify(name)) || "produit";

  // Probe for collisions; we add a 5-char hex suffix when needed.
  let candidate = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let query: any = (supabase as any)
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);

    const { count, error } = await query;
    if (error) {
      // On error, fall back to suffixed slug to be safe.
      return `${base}-${Math.random().toString(36).slice(2, 7)}`;
    }
    if (!count) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
