import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") || "https://zandofy.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get("product");
  const storeId = url.searchParams.get("store");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Load CMS site texts for title/description fallback
  let siteName = "Zandofy";
  let siteDescription = "Découvrez Zandofy : mode premium à prix accessibles. Robes, hauts, accessoires et plus.";
  try {
    const { data: cmsTexts } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "cms_texts")
      .maybeSingle();
    if (cmsTexts?.value && Array.isArray(cmsTexts.value)) {
      const texts = cmsTexts.value as { key: string; fr: string }[];
      const nameEntry = texts.find((t) => t.key === "site.name");
      const descEntry = texts.find((t) => t.key === "site.description");
      if (nameEntry?.fr) siteName = nameEntry.fr;
      if (descEntry?.fr) siteDescription = descEntry.fr;
    }
  } catch {}

  let title = siteName;
  let description = siteDescription;
  let imageUrl = `${SITE_URL}/icons/icon-512.png`;
  let pageUrl = SITE_URL;

  if (productId) {
    const { data: product } = await supabase
      .from("products")
      .select("id, name, name_fr, price, currency, slug, short_description, description, meta_title, meta_description, product_images(image_url, position)")
      .eq("id", productId)
      .maybeSingle();

    if (product) {
      const pName = product.name_fr || product.name || "Produit";
      title = product.meta_title || `${pName} | ${siteName}`;
      description = product.meta_description || product.short_description || (product.description?.substring(0, 155)) || `${pName} sur ${siteName}`;
      const sortedImages = (product.product_images || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
      if (sortedImages.length > 0) {
        imageUrl = sortedImages[0].image_url;
      }
      pageUrl = `${SITE_URL}/product/${product.slug || product.id}`;
    }
  } else if (storeId) {
    const { data: store } = await supabase
      .from("stores")
      .select("id, name, logo_url, meta_title, meta_description")
      .eq("id", storeId)
      .maybeSingle();

    if (store) {
      title = store.meta_title || `${store.name} | ${siteName}`;
      description = store.meta_description || `Découvrez ${store.name} sur ${siteName}`;
      if (store.logo_url) imageUrl = store.logo_url;
      pageUrl = `${SITE_URL}/store/${store.id}`;
    }
  }

  // Check if request is from a social bot/crawler
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const isCrawler = /whatsapp|facebookexternalhit|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|googlebot|bingbot/i.test(ua);

  if (!isCrawler) {
    // Regular user: redirect to the actual page
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: pageUrl },
    });
  }

  // Crawler: serve HTML with proper OG tags
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
});

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
