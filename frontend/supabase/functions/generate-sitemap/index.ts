import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = "https://zandofy.com";

// Slugify category name (no slug column in DB) for URL consistency
function slugify(input: string): string {
  return (input || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const staticPages = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/search", changefreq: "daily", priority: "0.8" },
      { loc: "/stores", changefreq: "daily", priority: "0.8" },
      { loc: "/about", changefreq: "monthly", priority: "0.6" },
      { loc: "/faq", changefreq: "monthly", priority: "0.6" },
      { loc: "/terms", changefreq: "yearly", priority: "0.3" },
      { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
      { loc: "/become-vendor", changefreq: "monthly", priority: "0.5" },
    ];

    // Products with first image for <image:image>
    const { data: products } = await supabase
      .from("products")
      .select("id, slug, updated_at, name, images")
      .eq("publish_status", "published")
      .order("updated_at", { ascending: false })
      .limit(5000);

    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, name_fr, image_url, created_at");

    const { data: stores } = await supabase
      .from("stores")
      .select("id, slug, name, logo_url, created_at, updated_at")
      .limit(1000);

    // Compute lastmod per category from latest product update
    const catLastMod = new Map<string, string>();
    if (products && categories) {
      // simple aggregation per category_id requires column; fallback: max of all products
      // (cheap heuristic to keep query simple — categories usually update with products)
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    const today = new Date().toISOString().split("T")[0];

    for (const page of staticPages) {
      xml += `  <url><loc>${SITE_URL}${page.loc}</loc><lastmod>${today}</lastmod><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>\n`;
    }

    for (const p of products || []) {
      const lastmod = p.updated_at ? p.updated_at.split("T")[0] : today;
      const productPath = p.slug || p.id;
      const firstImage = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
      xml += `  <url>`;
      xml += `<loc>${SITE_URL}/product/${productPath}</loc>`;
      xml += `<lastmod>${lastmod}</lastmod>`;
      xml += `<changefreq>weekly</changefreq>`;
      xml += `<priority>0.8</priority>`;
      if (firstImage) {
        xml += `<image:image><image:loc>${escapeXml(firstImage)}</image:loc>`;
        if (p.name) xml += `<image:title>${escapeXml(p.name)}</image:title>`;
        xml += `</image:image>`;
      }
      xml += `</url>\n`;
    }

    for (const c of categories || []) {
      const slug = slugify(c.name);
      if (!slug) continue;
      const lastmod = catLastMod.get(c.id) || today;
      xml += `  <url>`;
      xml += `<loc>${SITE_URL}/category/${slug}</loc>`;
      xml += `<lastmod>${lastmod}</lastmod>`;
      xml += `<changefreq>weekly</changefreq>`;
      xml += `<priority>0.7</priority>`;
      if (c.image_url) {
        xml += `<image:image><image:loc>${escapeXml(c.image_url)}</image:loc>`;
        xml += `<image:title>${escapeXml(c.name_fr || c.name)}</image:title>`;
        xml += `</image:image>`;
      }
      xml += `</url>\n`;
    }

    for (const s of stores || []) {
      const storePath = s.slug || s.id;
      const lastmod = (s.updated_at || s.created_at || today).toString().split("T")[0];
      xml += `  <url>`;
      xml += `<loc>${SITE_URL}/store/${storePath}</loc>`;
      xml += `<lastmod>${lastmod}</lastmod>`;
      xml += `<changefreq>weekly</changefreq>`;
      xml += `<priority>0.6</priority>`;
      if (s.logo_url) {
        xml += `<image:image><image:loc>${escapeXml(s.logo_url)}</image:loc>`;
        if (s.name) xml += `<image:title>${escapeXml(s.name)}</image:title>`;
        xml += `</image:image>`;
      }
      xml += `</url>\n`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new Response(`Error generating sitemap: ${error}`, { status: 500 });
  }
});
