# Project Memory

## Core
- **PROD STACK (priorité absolue, 4000+ users/jour)**: GitHub `main` → Vercel (`zandofy.com`) → Supabase.com perso (`vpt...yxf`). Toute correction cible cette stack. Lovable Cloud (`uog...zpu`) = preview only, JAMAIS source de vérité.
- **Edge Functions / migrations** atteignent la prod via GitHub Actions (`deploy-edge-functions.yml`).
- **Brand**: "Zandofy", marketplace sino-africaine. Terminologie spécifique (ex "frais d'expédition").
- **Styling**: Dark theme 'vert tamisé', `I18nContext.tsx` via `t("key")`. Pas de hardcoded text.
- **DB**: Pas d'`unaccent`, `DROP VIEW IF EXISTS`. Storage upsert nécessite policy UPDATE.
- **Security**: Pas de Realtime sur tables sensibles. PII masquée hors logistics. `verify_jwt=true` Edge Functions.
- **Pricing**: 45% markup + 10% commission. Carts split par store_id. COD = collecte rider obligatoire.
- **Logistics roles** (Phase 10.5 — vérité figée) : forwarder=fret intl, shipper=hub local, operator=entreprise last-mile, rider=livreur (humain).
- **Dual-code security** : pickup_code (hub↔rider) + delivery_code (client↔rider). Voir mem://features/dual-code-pickup-delivery-security.

## Memories

### Authentication & Security
- [Logistics Roles Canonical](mem://auth/logistics-roles-canonical) — Vérité officielle des 7 rôles app_role + chaîne logistique
- [RBAC Implementation](mem://auth/rbac-implementation)
- [Secret Management](mem://auth/secret-management)
- [Admin Store Permissions](mem://auth/admin-store-permissions)
- [Admin Session Refresh](mem://auth/admin-session-refresh-logic)
- [Collaborator PII Masking](mem://auth/collaborator-pii-masking-logic)
- [Profile Sync & Security](mem://auth/profile-security-and-synchronization-logic)
- [Impersonation Security](mem://auth/impersonation-security-hardening-logic)

### E-commerce Features & Logistics
- [Multi-Operator Delivery](mem://features/multi-operator-delivery-system) — Lot 11B last-mile par entreprises
- [Dual-Code Security](mem://features/dual-code-pickup-delivery-security) — pickup_code + delivery_code (Phase 10.5)
- [Forwarders & Logistics](mem://features/forwarders-and-logistics-system)
- [Order Workflow](mem://features/order-workflow)
- [Order Status Rules](mem://features/order-status-progression-permissions)
- [Shipping Engine](mem://features/shipping-engine-logic)
- [Last Mile Pricing](mem://features/last-mile-pricing-logic)
- [Delivery Workflow](mem://features/delivery-and-hub-logistics-workflow)
- [COD Settlement](mem://features/cod-settlement-logic)
- [Order Segmentation](mem://features/order-segmentation)
- [Maritime Constraints](mem://features/maritime-shipping-constraint)
- [Stores Segmentation](mem://features/stores-segmentation)
- [Dispute Resolution](mem://features/dispute-resolution)
- [Product Variants](mem://features/product-variants)
- [Wholesale Variants](mem://features/wholesale-variant-selection-logic)
- [Thermal Shipping Labels](mem://features/thermal-shipping-labels-system)
- [Vendor Accounting](mem://features/vendor-accounting-ledger)

### Architecture & Infrastructure
- [Production Priority Rule](mem://constraint/production-priority-rule)
- [Env DB Separation](mem://architecture/environment-database-separation)
- [Deployment Workflow SOP](mem://architecture/deployment-workflow-sop)
- [Edge Functions Security](mem://architecture/edge-functions-security)
- [Edge Functions Deno Deps](mem://architecture/edge-functions-dependency-management)
- [Supabase PG Constraints](mem://architecture/postgresql-migration-constraints-supabase)
- [Storage Access Control](mem://architecture/storage-access-control-v2-0-rules)
- [Storage Upsert Policy](mem://architecture/supabase-storage-upsert-policy-constraint-logic)
- [Service Worker Config](mem://architecture/service-worker-config-injection-logic)
- [Cache Management Strategy](mem://architecture/cache-management-strategy)
- [Playwright E2E Setup](mem://architecture/playwright-e2e-setup) — Specs `frontend/e2e/`, CI GH Actions. Sandbox Lovable ne peut PAS lancer Chromium.
- [Data Privacy Views](mem://architecture/data-privacy-views-config)
- [Environment CSP Strategy](mem://architecture/environment-aware-csp-strategy)
- [Security Hardening V4](mem://architecture/advanced-security-hardening-v4-0)
- [RLS Staging/Prod Divergence](mem://architecture/rls-staging-prod-divergence)
- [Payment Transaction Types](mem://architecture/payment-transaction-classification)
- [Product Badges DB Deps](mem://architecture/product-badges-dependencies)
- [PWA Manifest Rules](mem://architecture/pwa-manifest-optimization)
- [PWA Optimization](mem://architecture/pwa-optimization-and-installation)

### Vendor & User Management
- [Pricing Engine](mem://features/pricing-engine-logic)
- [Vendor Payment Config](mem://features/vendor-payment-config)
- [Vendor Certification](mem://features/vendor-certification-dependency)
- [Currency Conversion](mem://features/currency-conversion-engine)
- [Checkout Transactional](mem://features/checkout-transactional-logic)
- [KelPay Lifecycle](mem://features/kelpay-lifecycle-management)
- [Off-platform Payments](mem://features/off-platform-payment-workflow)
- [Payment Method Gating](mem://features/payment-method-gating)
- [Subscription Limits](mem://features/subscription-payment-constraints)
- [Customer Subscription Benefits](mem://features/customer-subscription-benefits)
- [Affiliate Program](mem://features/affiliate-program)
- [Multi-Store Rules](mem://features/multi-store-management-logic)
- [Store Moderation](mem://features/store-moderation-system)
- [Ownership Transfer](mem://features/store-ownership-transfer-logic)
- [Sensitive Changes](mem://features/sensitive-change-request-management)
- [Service Packages](mem://features/billing-service-package-system)
- [Autonomous Vendor](mem://features/autonomous-vendor-package-logic)
- [Collaborator Rules](mem://features/collaborator-management-rules)
- [Reviews Moderation](mem://features/verified-reviews-moderation-workflow)
- [Supplier Management](mem://features/supplier-management-system)
- [Notification Campaigns](mem://features/notification-segmentation-and-campaigns)
- [Address Rules](mem://features/user-profile-geographic-logic)
- [Store Presence](mem://features/real-time-store-presence-indicators)
- [Store Location & Navigation](mem://features/store-location-and-navigation)
- [Payment Card Tokenization](mem://features/payment-card-tokenization-and-masking-logic)
- [Keccel CardPay](mem://features/keccel-cardpay-constraints)
- [Payment Badge Priority](mem://features/payment-badge-ordering-logic-rdc-priority)

### Core Services & UI Systems
- [Notifications System](mem://features/notifications-system)
- [Logistics Tracking](mem://features/logistics-tracking)
- [Blog CMS](mem://features/blog-cms)
- [Error Capture](mem://features/error-capture-system-architecture)
- [Admin Branding](mem://features/admin-branding-and-emails-config)
- [SEO Sitemap](mem://features/sitemap-and-robots-configuration-logic)
- [Pre-launch SEO](mem://features/pre-launch-seo-indexation-config-logic)
- [I18n Refactor](mem://features/centralized-i18n-refactor-logic)
- [Analytics Dashboard V2](mem://features/analytics-dashboard-v2)
- [Instant Chat & Media](mem://features/instant-chat-and-media-logic)
- [Marketing Automation](mem://features/marketing-automation-onboarding)
- [Store Products Performance](mem://features/store-products-performance-logic)
- [Global Fonts](mem://style/global-font-selection-logic)
- [Dark Mode Aesthetic](mem://style/dark-mode-aesthetic-refinement-logic)
- [Terminology](mem://style/terminology-standardization-intent)
- [Branding Identity](mem://project/branding-identity)
- [Market Positioning](mem://project/market-positioning-intent)
- [Technical IDs](mem://project/technical-identifiers)
- [Geo Fields Combobox Standard](mem://preference/geo-fields-combobox-standard)
- [Forwarder Origin Filtering](mem://features/forwarder-origin-filtering) — Lot 11C P1 : checkout filtre transitaires par `products.origin_country` via `coverage_routes` ; P2 = split panier multi-origines
