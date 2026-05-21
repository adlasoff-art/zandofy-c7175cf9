# Lot G4 — Sécurité (notes d’implémentation)

## Fait dans le dépôt

| Item | Action |
|------|--------|
| Analytics INSERT ouvert | Migration [`20260522010000_analytics_insert_hardening.sql`](../supabase/migrations/20260522010000_analytics_insert_hardening.sql) — whitelist `event_type`, longueur `session_id` / `page_path` |
| `ProductGrid` popularité | Suppression des lectures directes `wishlists` / `cart_items` (évite fuite RLS + charge inutile) → `fetchProducts({ orderBy: 'popular' })` |
| Reset password | Déjà `minLength={8}` sur [`ResetPassword.tsx`](../frontend/src/pages/ResetPassword.tsx) |
| X-Frame-Options | `DENY` dans [`vercel.json`](../frontend/vercel.json) ; retiré du HTML (évite conflit) |
| Impersonation | Audit log `impersonation_start` dans [`impersonate-user`](../supabase/functions/impersonate-user/index.ts) |

## À appliquer en base (manuel)

1. Exécuter la migration analytics sur **staging**, puis **production** (SQL Editor).
2. Vérifier que le frontend n’envoie que des `event_type` listés (voir hooks analytics).

## CSP — durcissement progressif (non fait)

La CSP dans [`index.html`](../frontend/index.html) autorise encore `'unsafe-inline'` et `'unsafe-eval'` (legacy Vite/GTM).

**Recommandation** : phase ultérieure avec `Content-Security-Policy-Report-Only` + collecte des violations avant de retirer `unsafe-eval`.

## PWA installs / page_views

Si d’autres tables ont des policies `INSERT` trop ouvertes, auditer de la même façon que `analytics_events` (grep migrations `Anyone can insert`).
