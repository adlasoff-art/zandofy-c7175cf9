# SEO baseline snapshot — 2026-10-03

Measured before Phase 1 deploy (PowerShell `curl.exe`).

| Check | Result |
|-------|--------|
| Googlebot `/` title | Present — « Zandofy — Achetez en Chine, livré en Afrique \| Prix usine » |
| Googlebot `/` robots | `index, follow` |
| Googlebot `/` H1 | Present (commercial homepage copy) |
| GPTBot `/` | Receives title/H1 today via SPA/static shell; **Vercel UA allowlist lacked gptbot** — Phase 1 adds prerender parity |
| Missing product | **HTTP 410 Gone** + `x-robots-tag: noindex, nofollow` |
| Sitemap | `https://zandofy.com/sitemap.xml` → **200** `application/xml` |

## GSC (from product owner screenshots, Sep 2026)

- Indexed ~1.08k / Non-indexed ~2.18k
- Alert 16 Aug 2026: **Introuvable (404)**
- 90d: clicks −78%, impressions −69%
- Traffic almost entirely brand / homepage

## Ops still required (human GSC)

1. Export all non-index reasons + 404 URL list
2. Confirm Admin SEO global toggle ON
3. After deploy Phase 1–2: re-request indexing for hubs listed in playbook
