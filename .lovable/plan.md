
## SQL Migrations pour Supabase.com (Production)

Voici le script SQL complet et idempotent couvrant **toutes les migrations** depuis la mi-mars (phases récentes). Ce script est safe à re-exécuter.

Il couvre **42 migrations** du dossier `supabase/migrations/` — depuis `20260316` jusqu'à `20260324`.

### Contenu couvert

| Bloc | Tables/Colonnes |
|------|----------------|
| RLS Fix produits | Restrict public read to published only, vendor subscriptions, platform_settings |
| CMS Menu | Colonnes `parent_id`, `highlight`, `has_mega`, `icon`, `open_in_new_tab` + seed data |
| Store Collaborators | Table `store_collaborators`, fonctions `update_store_presence` / `set_store_offline` |
| Blog CMS complet | `blog_categories`, `blog_editors`, `blog_posts`, `blog_post_views`, `blog_comments` |
| Modération produits | Colonnes `moderation_reason`, `moderated_by`, etc. |
| Featured Placements | Tables `featured_placements`, `featured_placement_requests` |
| Job Postings | Table `job_postings` |
| Security RLS Phase 1 | Fix `push_subscriptions`, `products`, `vendor_subscriptions`, `platform_settings` |
| Logistique | Colonnes `supplier_order_number`, `shipping_payment_status`, `last_mile_payment_status`, etc. |
| Product Slugs + Branding | Colonne `slug`, seed `branding` settings |
| Pricing System | Colonnes `cost_real`, `cost_calc`, `auto_pricing_enabled`, table `vendor_pricing_overrides` |
| Platform Ownership | Colonne `is_platform_owned`, table `platform_ownership_claims`, trigger |
| Profiles enrichi | 15+ colonnes profil, tables `payment_methods`, `user_activity_logs`, `customer_ratings` |
| Trend Tags | Table `trend_tags`, colonne `trend_tag_id` sur products |
| Flash Sales | Table `flash_sales`, colonne `is_verified_purchase` sur reviews |
| Bundles | Tables `product_bundles`, `bundle_items` |
| Affiliate Links | Table `affiliate_links` |
| COD vendeur | Colonne `vendor_cod_enabled` |
| Dispute realtime | Publication realtime `dispute_messages` |

### Livrable

Je vais te générer un fichier SQL unique, idempotent, prêt à coller dans le **SQL Editor de Supabase.com**. Le script fait environ 600-800 lignes et regroupe toutes les 42 migrations dans l'ordre chronologique.

### Note importante
- Les `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, et `DROP POLICY IF EXISTS` garantissent l'idempotence
- Les `INSERT ... ON CONFLICT DO NOTHING` pour les seeds
- Aucune modification de schémas réservés (auth, storage, realtime)
