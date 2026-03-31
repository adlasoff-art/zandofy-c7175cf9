

# Phase 1: Database + Admin Sidebar Reorganization

## Summary
Create new database tables (store transfers, analytics tracking, provinces), add missing period options to the dashboard selector, reorganize the admin sidebar into grouped sections by functional proximity, and add geographic filters to key admin pages.

---

## Technical Details

### A. SQL Migration (downloadable + Lovable Cloud migration)

**1. `provinces` table** (new level in geography hierarchy)
```sql
CREATE TABLE IF NOT EXISTS public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text NOT NULL DEFAULT 'CD',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```
- Add `province_id` FK to `cities` table
- Update AdminGeographyPage with a Provinces tab

**2. `store_transfer_requests` table**
```sql
CREATE TABLE IF NOT EXISTS public.store_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','under_review','completed','rejected','cancelled')),
  kyc_verified_from boolean DEFAULT false,
  kyc_verified_to boolean DEFAULT false,
  cooldown_until timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```
- RLS: admin-only access + owner read
- 48-72h cooldown enforced via validation trigger

**3. `analytics_sessions` table** (advanced analytics)
```sql
CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  pages_visited text[],
  entry_page text,
  exit_page text,
  device_type text,
  country_code text,
  city text
);
```

**4. `page_views` table** (for heatmap/journey tracking)
```sql
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid,
  page_path text NOT NULL,
  store_id uuid,
  product_id uuid,
  viewed_at timestamptz DEFAULT now(),
  time_on_page_seconds integer
);
```

All migrations will be idempotent (`IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`).

A downloadable `.sql` file will also be generated in `/mnt/documents/` for manual execution on supabase.com staging/production.

---

### B. Period Selector Enhancement

Update `DashboardPeriodSelector.tsx`:
- Add missing periods: `24h`, `48h`, `all-time`
- Full list: Today, 24h, 48h, 7d, 14d, 30d, 3m, 6m, 9m, 12m, All-time
- Reuse across Admin, Vendor, Driver, and Manager dashboards

---

### C. Admin Sidebar Reorganization

Regroup `adminItems` in `AdminSidebar.tsx` into labeled sections with `SidebarGroupLabel`:

```text
CORE OPERATIONS
  Tableau de bord
  Commandes
  Modération produits
  Modération avis

VENTES & MARKETING
  Coupons
  Mises en avant
  Ventes flash
  Popups & Cookies

LOGISTICS
  Logistique
  Tarification Fret
  Zones géographiques
  Pays actifs

USERS & VENDORS
  Utilisateurs
  Demandes Vendeur
  Noms de boutique
  Abonnements
  Tarification boutiques
  Vérification KYC
  Comptabilité vendeurs
  Retraits

FIDÉLITÉ & POINTS
  Fidélité
  Audit Points
  Paliers affiliation

FINANCE
  Taux de change
  Retours
  Litiges

CMS & CONTENU
  Bannières & CMS
  Catégories
  Types de variations
  Templates Email
  Référencement SEO
  Plateformes fournisseurs

SYSTÈME
  Support client
  Journal d'audit
  Notifications
  Analytics
  Paramètres
```

Each group gets a collapsible `SidebarGroup` with `defaultOpen` for the group containing the active route.

---

### D. Geographic Filters on Admin Pages

Add a location hierarchy filter bar (Country > Province > City > Commune > Quartier) as a reusable `<LocationHierarchyFilter />` component. Integrate it into:
- AdminOrdersPage
- AdminKycPage
- AdminVendorSubscriptionsPage
- AdminUsersPage

The filter cascades: selecting a country loads its provinces, selecting a province loads its cities, etc. Queries append `.eq()` filters accordingly.

---

### E. AdminGeographyPage Update

Add a **Provinces** tab alongside Cities, Communes, Quartiers. The Provinces tab allows CRUD operations scoped by country. The Cities tab gets a `province_id` selector.

---

## Files Modified/Created

| File | Action |
|------|--------|
| `frontend/supabase/migrations/[new].sql` | New migration (all 4 tables + columns) |
| `/mnt/documents/phase1_migration.sql` | Downloadable SQL for staging/prod |
| `frontend/src/components/admin/AdminSidebar.tsx` | Reorganize into grouped sections |
| `frontend/src/components/admin/dashboard/DashboardPeriodSelector.tsx` | Add 24h, 48h, all-time |
| `frontend/src/components/admin/LocationHierarchyFilter.tsx` | New reusable filter component |
| `frontend/src/pages/admin/AdminGeographyPage.tsx` | Add Provinces tab, link cities to provinces |
| `frontend/src/pages/admin/AdminOrdersPage.tsx` | Add location filter |
| `frontend/src/pages/admin/AdminKycPage.tsx` | Add location filter |
| `frontend/src/pages/admin/AdminVendorSubscriptionsPage.tsx` | Add location filter |
| `frontend/src/pages/admin/AdminUsersPage.tsx` | Add location filter |

