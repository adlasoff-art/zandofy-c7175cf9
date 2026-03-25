import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = (Deno.env.get("SITE_BASE_URL") || "https://zandofy.com").replace(/\/$/, "");

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Static pages
    const staticPages = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/search", changefreq: "daily", priority: "0.8" },
      { loc: "/about", changefreq: "monthly", priority: "0.6" },
      { loc: "/faq", changefreq: "monthly", priority: "0.6" },
      { loc: "/terms", changefreq: "yearly", priority: "0.3" },
      { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
      { loc: "/become-vendor", changefreq: "monthly", priority: "0.5" },
    ];

    // Fetch published products
    const { data: products } = await supabase
      .from("products")
      .select("id, updated_at")
      .eq("publish_status", "published")
      .order("updated_at", { ascending: false })
      .limit(5000);

    // Fetch categories
    const { data: categories } = await supabase
      .from("categories")
      .select("name, created_at")
      .order("name");

    // Fetch stores
    const { data: stores } = await supabase
      .from("stores")
      .select("id, created_at")
      .limit(1000);

    // Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static
    for (const page of staticPages) {
      xml += `  <url><loc>${SITE_URL}${page.loc}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>\n`;
    }

    // Products
    for (const p of products || []) {
      const lastmod = p.updated_at ? p.updated_at.split("T")[0] : "";
      xml += `  <url><loc>${SITE_URL}/product/${p.id}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }

    // Categories
    for (const c of categories || []) {
      xml += `  <url><loc>${SITE_URL}/category/${encodeURIComponent(c.name.toLowerCase())}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
    }

    // Stores
    for (const s of stores || []) {
      xml += `  <url><loc>${SITE_URL}/store/${s.id}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
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
