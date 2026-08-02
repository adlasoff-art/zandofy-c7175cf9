import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Canonical host MUST match live redirect (www → apex).
 * Redeploy trigger: 2026-08-02 — align apex + hubs + catalogue.
 */
const SITE_URL = "https://zandofy.com";

/** Match frontend `slugify()` for category URLs. */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Hub pages — sitelinks candidates + trust pages
    const staticPages = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/stores", changefreq: "daily", priority: "0.9" },
      { loc: "/popular", changefreq: "daily", priority: "0.9" },
      { loc: "/trends", changefreq: "daily", priority: "0.9" },
      { loc: "/search", changefreq: "daily", priority: "0.8" },
      { loc: "/blog", changefreq: "weekly", priority: "0.8" },
      { loc: "/help-center", changefreq: "weekly", priority: "0.8" },
      { loc: "/become-vendor", changefreq: "monthly", priority: "0.8" },
      { loc: "/affiliate-program", changefreq: "monthly", priority: "0.7" },
      { loc: "/loyalty-program", changefreq: "monthly", priority: "0.6" },
      { loc: "/about", changefreq: "monthly", priority: "0.7" },
      { loc: "/faq", changefreq: "monthly", priority: "0.7" },
      { loc: "/pricing", changefreq: "monthly", priority: "0.6" },
      { loc: "/careers", changefreq: "monthly", priority: "0.5" },
      { loc: "/social-responsibility", changefreq: "monthly", priority: "0.5" },
      { loc: "/terms", changefreq: "yearly", priority: "0.3" },
      { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
    ];

    const { data: products } = await supabase
      .from("products")
      .select("id, slug, updated_at")
      .eq("publish_status", "published")
      .order("updated_at", { ascending: false })
      .limit(5000);

    const { data: categories } = await supabase
      .from("categories")
      .select("name, name_fr, created_at")
      .order("name");

    const { data: stores } = await supabase
      .from("stores")
      .select("id, slug, name, created_at")
      .eq("is_banned", false)
      .eq("is_suspended", false)
      .limit(1000);

    const { data: blogPosts } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(500);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const page of staticPages) {
      xml += `  <url><loc>${SITE_URL}${page.loc}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>\n`;
    }

    for (const p of products || []) {
      const lastmod = p.updated_at ? p.updated_at.split("T")[0] : "";
      const productPath = p.slug || p.id;
      xml += `  <url><loc>${SITE_URL}/product/${productPath}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }

    const seenCat = new Set<string>();
    for (const c of categories || []) {
      for (const raw of [c.name_fr, c.name]) {
        const catSlug = slugify(raw || "");
        if (!catSlug || seenCat.has(catSlug)) continue;
        seenCat.add(catSlug);
        xml += `  <url><loc>${SITE_URL}/category/${catSlug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
      }
    }

    for (const s of stores || []) {
      const storePath = s.slug || s.id;
      xml += `  <url><loc>${SITE_URL}/store/${storePath}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
    }

    for (const b of blogPosts || []) {
      if (!b.slug) continue;
      const lastmod = (b.updated_at || b.published_at || "").split("T")[0];
      xml += `  <url><loc>${SITE_URL}/blog/${b.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new Response(`Error generating sitemap: ${error}`, { status: 500 });
  }
});
