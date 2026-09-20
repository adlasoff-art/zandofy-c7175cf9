# I9 — sync schéma marketplace (mobile Flutter)

N’écarte aucune table, RPC, edge ou écran. Ajoute : sample_offers/sample_requests + RLS ; RFQ B2B par product_id (table séparée, en plus de product_sourcing_requests) ; CMS buyer_protection ; RPC get_customer_order_shortcut_counts ; events analytics featured_placements ; optionnellement manufacturer_rankings. Réutilise cms_banners, cms_homepage_sections, featured_placements, products_public, stores_public, customer_wallets, generate-invoice, validate_coupon, get_category_top_sellers, user_product_views. Branche CustomerWalletCard au dashboard. Pas de service_role client. Contrats JSON stables documentés pour Flutter. FR/EN. Tests + migrations root supabase only.

## Contrats Flutter déjà branchés (hide-if-empty)

| Flag / table | Mobile |
|---|---|
| `platform_settings.samples_enabled` + `sample_offers` | rail accueil échantillons |
| `platform_settings.rfq_enabled` + `product_rfq_requests` | bouton PDP + rail |
| `cms_pages.slug=buyer_protection` | copy protection panier |
| `product_sourcing_requests` | `/sourcing` (max 5/j) |
| `customer_wallets` / `customer_wallet_transactions` | `/wallet` |
| `service_packages` target=client | `/subscriptions` |
| `payment_methods` | `/payment-methods` |
| edge `generate-invoice` | bouton détail commande livrée |
| `get_category_top_sellers` | section stores (hide si RPC échoue) |

Migration : `supabase/migrations/20260903120000_marketplace_i9_samples_rfq_protection.sql`.

**Human checklist :** run this SQL on **staging** then **production** Supabase SQL Editor (additive; flags default `samples_enabled`/`rfq_enabled` = false). Web hide-if-empty: `HomeSamplesRail`, `ProductRfqButton`, `CustomerWalletCard`.
