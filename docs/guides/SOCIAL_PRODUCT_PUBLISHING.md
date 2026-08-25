# Social product publishing — ops checklist (Zandofy)

## Secrets (Supabase Dashboard → Edge Functions → Secrets)

Set on **staging** first, then **production** (never in `VITE_*`):

| Secret | Description |
|--------|-------------|
| `META_PAGE_ID` | Facebook Page ID |
| `META_PAGE_ACCESS_TOKEN` | Long-lived **Page** access token |
| `META_IG_BUSINESS_ID` | Instagram Business account ID linked to the Page |
| `SOCIAL_PUBLISH_ENABLED` | `true` / `false` kill-switch |
| `SOCIAL_PUBLISH_CRON_SECRET` | Optional shared secret for cron/`pg_net` invokes (`Authorization: Bearer …` or `x-cron-secret`) |

## Auth Edge Function

Even if deployed with `--no-verify-jwt`, the function **rejects** anonymous callers:

1. Admin/manager user JWT (from the admin UI `functions.invoke`), or  
2. `SOCIAL_PUBLISH_CRON_SECRET` matching Bearer / `x-cron-secret`

## Meta app prerequisites

1. Meta Business + Facebook Page + Instagram Business linked to the Page
2. App permissions: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
3. App in **Live** mode for production

## Database

1. Run migration `supabase/migrations/20260825120000_social_product_posts.sql` in **staging** SQL Editor
2. Smoke: auth login, product list, approve one test product with social unchecked
3. Same SQL on **production** after validation

## Deploy Edge Function

Push `supabase/functions/publish-social-product/` via develop/main (GitHub Actions) or:

```bash
npx supabase functions deploy publish-social-product --project-ref <STAGING_OR_PROD_REF>
```

## Smoke test (1 product)

1. Admin → Modération produits → Approuver (case post cochée, 1 image)
2. Or on a already-published product → **Réseaux**
3. `SELECT platform, status, left(caption_snapshot,200), last_error FROM social_post_jobs ORDER BY created_at DESC LIMIT 6;`
4. Confirm Facebook job before Instagram; IG caption ends with product URL
5. Optional cron: see `MANUAL_publish-social-product-cron.sql`

## Kill-switch

- Env: `SOCIAL_PUBLISH_ENABLED=false`
- Or SQL: `UPDATE social_post_settings SET is_enabled = false WHERE platform = 'instagram';`
