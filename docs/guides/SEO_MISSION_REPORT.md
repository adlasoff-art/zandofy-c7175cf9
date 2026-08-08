# SEO Mission Report — Zandofy Titan Plan

**Date:** 2026-08-08  
**Branch:** `develop` (commits P0a → P5)  
**Scope:** Bot-visible HTML, noindex transactional noise, segmented sitemaps, human analytics, mobile LCP hygiene, category/blog content hooks.  
**Out of scope:** LocalBusiness / city pages (`/kinshasa` etc.) until NAP provided. No Next.js migration.

---

## 1. Witness URLs (post-deploy verification)

Run after Vercel production deploy + edge `generate-sitemap` redeploy:

```bash
# Body crawlers — H1 + price
curl -sA "Googlebot" "https://zandofy.com/product/<SLUG>" | grep -E "<h1|class=\"price\"|application/ld\+json"

# Removed product → 410
curl -sI -A "Googlebot" "https://zandofy.com/product/this-slug-does-not-exist-xyz" | head -5

# noindex search
curl -sA "Googlebot" "https://zandofy.com/search" | grep -i "noindex"

# Sitemap index (no /search)
curl -sL "https://zandofy.com/sitemap.xml" | head -30
curl -sL "https://zandofy.com/sitemap.xml" | grep -c search || true
```

| Check | Expected | Measured (fill after prod) |
|-------|----------|----------------------------|
| Product bot HTML has `<h1>` | yes | _TBD_ |
| Product bot HTML has `.price` | yes | _TBD_ |
| Missing product HTTP status | **410** | _TBD_ |
| `/search` robots | `noindex` | _TBD_ |
| `sitemap.xml` | `<sitemapindex>` | _TBD_ |
| `/search` in sitemaps | **0** | _TBD_ |

---

## 2. Rich Results Test (manual)

Test 3 live product URLs in [Google Rich Results Test](https://search.google.com/test/rich-results):

| URL | Product | Breadcrumb | Pass/Fail |
|-----|---------|------------|-----------|
| 1. | | | _TBD post-deploy_ |
| 2. | | | _TBD_ |
| 3. | | | _TBD_ |

Notes: `aggregateRating` only when `review_count > 0`. No invented `shippingDetails`. Currency = product DB currency (not forced CDF).

---

## 3. Lighthouse mobile (measure — do not invent)

Targets: LCP &lt; 2.5s, CLS &lt; 0.1, INP &lt; 200ms.

| URL | LCP before | LCP after | CLS | INP | Date |
|-----|------------|-----------|-----|-----|------|
| `/` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| Product | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| Category | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |

Code shipped for LCP: PDP `fetchPriority=high` + dimensions; hero preload without `/render/image`; Inter non-blocking + `display=swap`; GA deferred to idle. Image transforms remain **off**.

---

## 4. Paths now `noindex` (or Disallow)

| Path / area | Mechanism |
|-------------|-----------|
| `/search` | robots.txt Disallow + SEOHead/injector `noindex,follow` |
| `/account`, `/messages` | robots.txt Disallow |
| `/auth`, `/checkout`, `/cart` | robots.txt and/or SEOHead `noindex` |
| Dashboard / vendor private | robots.txt Disallow (existing) |
| Unpublished / missing `/product/*` | HTTP **410** + `noindex` (bots) |

**Never Disallow:** `/category`, `/product`, `/store`, `/blog`.

---

## 5. Admin checklist — Google Search Console (domaine `zandofy.com`)

1. [ ] Confirm single 301 `www` → `https://zandofy.com` (Cloudflare / Vercel Domains).
2. [ ] Deploy frontend (`develop` → production merge).
3. [ ] Deploy edge `generate-sitemap` (staging then prod) with `SITE_URL=https://zandofy.com`.
4. [ ] Run SQL staging → prod:
   - `supabase/migrations/20260808180000_analytics_human_sessions.sql`
   - `supabase/migrations/20260808181000_categories_seo_body_faq.sql`
5. [ ] GSC → Sitemaps: submit **`https://zandofy.com/sitemap.xml`** (index).
6. [ ] Remove obsolete sitemap entries (`sitemap-dynamic.xml` if listed).
7. [ ] GSC → Pages → validate non-indexing patterns for search/checkout/account.
8. [ ] Optional: daily cron = hit `generate-sitemap` + Vercel Deploy Hook (see playbook).
9. [ ] Wait **2–4 weeks** of crawl before judging Semrush / GSC rankings.

---

## 6. Commits (this mission)

| Commit | Message |
|--------|---------|
| P0a | `fix(seo): P0a robots noindex search/checkout/account and clean canonicals` |
| P0b | `fix(seo): P0b bot body HTML with H1/price and HTTP 410 for removed products` |
| P1 | `fix(seo): P1 Kinshasa titles, Product JSON-LD, hreflang fr-CD for bots` |
| P2 | `feat(seo): P2 segmented sitemap index excluding /search` |
| P4 | `feat(analytics): P4 human sessions gate, bot filter, CF geo` |
| P3 | `fix(perf): P3 LCP PDP fetchpriority, non-blocking fonts, idle GA` |
| P5 | `feat(seo): P5 blog bot body, category seo_body/FAQ, product desc warning` |

---

## 7. Ops notes

- **Cloaking:** bot `<main id="zandofy-seo-main">` uses the same catalogue fields as the SPA.
- **Analytics:** Admin shows **Sessions humaines** (interaction gate) vs **Sessions brutes**. Expect lower “human” counts after deploy — intended.
- **Geo:** `/api/geo` reads `CF-IPCountry` / Vercel country; do not treat default RDC as truth.
- **Editorial:** 12 blog articles remain human CMS work (`BlogTab`); code only provides injector body + BlogPosting + sitemap-blog.
- **City / LocalBusiness:** deferred until NAP Kinshasa provided.
