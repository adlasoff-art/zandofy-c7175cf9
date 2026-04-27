---
name: Lot 17 — Dette technique & perfs
description: Hardening DB conservateur (REVOKE EXECUTE sur ~95 fonctions internes) + 9 indexes de perf sur tables hot. Linter 298→133 warnings.
type: feature
---

## Lot 17 — Dette technique & performances

### Hardening DB
- Approche **conservatrice** : REVOKE EXECUTE FROM PUBLIC, anon, authenticated sur les fonctions SECURITY DEFINER dont le nom matche un préfixe interne (`notify_`, `enforce_`, `auto_`, `log_`, `compute_`, `cleanup_`, `set_`, `refresh_`, `force_`, `prevent_`, `protect_`, `sync_`, `lock_`, `bridge_`, `mark_`, `record_`, `decrement_`, `credit_`, `release_`, `process_`, `handle_`, `generate_`, `products_ensure_`, `enrich_`, `create_pending_`, `create_forwarder_`, `finalize_`, `is_kyc_`, `is_operator_`, `increment_coupon_`).
- **Whitelist explicite** : `release_pending_wallet_funds`, `expire_inactive_points`, `has_role`, `check_kyc_required`, `check_rate_limit`, `increment_blog_post_views`, `increment_helpful` restent EXECUTE pour `authenticated`.
- Cas spéciaux REVOKE additionnels : `apply_dispute_refund`, `add_intermediate_hub_handoff`, `reassign_forwarder`, `quote_forwarder`, `refresh_all_operator_reliability`, `operator_decide_order`.
- **Résultat** : warnings linter `0028`+`0029` passent de 298 → 133 (-55%). Les 133 restants sont les RPC légitimes appelés par le frontend.

### Indexes ajoutés (9)
- `order_items` : `(order_id)`, `(product_id)`
- `payment_transactions` : `(order_id)`, `(user_id)`, `(status, created_at DESC)`
- `products` : `(store_id, publish_status)`, `(publish_status, created_at DESC)`, `(category_id)`
- `reviews` : `(product_id, is_approved)`
- `notifications` : `(created_at DESC)`

### Frontend
- `vite.config.ts` déjà optimisé : 8 vendor chunks (lucide, react, query, supabase, recharts, motion, radix).
- `App.tsx` déjà 100% lazy-loaded via `lazyRetry()` avec auto-reload sur chunk failure.
- Hooks géo (`use-geo-detection`, `useActiveGeo`, `useGeoData`, `useGeoBlocking`) ont des rôles distincts — pas de doublon.

### Fichier de déploiement prod
`zandofy_lot17_tech_debt_perf.sql` — idempotent, à exécuter sur Supabase.com perso (vpt...yxf).