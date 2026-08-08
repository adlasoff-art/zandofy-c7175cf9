/**
 * Vercel Edge — proxy sitemap XML from Supabase generate-sitemap.
 * External rewrites to Supabase were falling through to the SPA (404 / index.html).
 * Prefer static public/sitemap*.xml from build (fetch-sitemap.mjs); this is a fallback.
 *
 * Query: ?part=index|products|categories|vendors|pages|blog
 * Products: optional &page=N (1000 URLs per page)
 */
export const config = { runtime: "edge" };

function resolveSitemapUrl(part: string, page: string | null): string {
  let base: string;
  if (process.env.SITEMAP_FUNCTION_URL?.trim()) {
    base = process.env.SITEMAP_FUNCTION_URL.trim().replace(/\/$/, "");
  } else {
    const sb = (
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "https://vpttoqojmiqxgudknyxf.supabase.co"
    ).replace(/\/$/, "");
    base = `${sb}/functions/v1/generate-sitemap`;
  }
  const u = new URL(base);
  u.searchParams.set("part", part);
  if (page) u.searchParams.set("page", page);
  return u.toString();
}

export default async function handler(req: Request): Promise<Response> {
  const reqUrl = new URL(req.url);
  const part = reqUrl.searchParams.get("part") || "index";
  const page = reqUrl.searchParams.get("page");
  const url = resolveSitemapUrl(part, page);
  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/xml,text/xml,*/*" },
    });
    const body = await upstream.text();
    const ok =
      upstream.ok && (body.includes("<urlset") || body.includes("<sitemapindex"));
    if (!ok) {
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
