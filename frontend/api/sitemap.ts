/**
 * Vercel Edge — proxy sitemap XML from Supabase generate-sitemap.
 * External rewrites to Supabase were falling through to the SPA (404 / index.html).
 */
export const config = { runtime: "edge" };

function resolveSitemapUrl(): string {
  if (process.env.SITEMAP_FUNCTION_URL?.trim()) {
    return process.env.SITEMAP_FUNCTION_URL.trim().replace(/\/$/, "");
  }
  const base = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://vpttoqojmiqxgudknyxf.supabase.co"
  ).replace(/\/$/, "");
  return `${base}/functions/v1/generate-sitemap`;
}

export default async function handler(): Promise<Response> {
  const url = resolveSitemapUrl();
  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/xml,text/xml,*/*" },
    });
    const body = await upstream.text();
    if (!upstream.ok || !body.includes("<urlset")) {
      console.error("[api/sitemap] upstream failed", upstream.status, body.slice(0, 200));
      return new Response("Sitemap temporarily unavailable", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Sitemap-Proxy": "1",
      },
    });
  } catch (err) {
    console.error("[api/sitemap] fetch error", err);
    return new Response("Sitemap proxy error", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
