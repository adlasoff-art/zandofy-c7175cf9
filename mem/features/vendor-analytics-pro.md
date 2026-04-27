---
name: Vendor Analytics Pro (Lot 16)
description: Dashboard analytics vendeur avancé avec KPIs financiers, cohortes, top produits, funnel, exports CSV/PDF et envoi email automatique
type: feature
---

## Onglet "Analytics Pro" du dashboard vendeur (`VendorAnalyticsProTab`)

Composant : `frontend/src/components/vendor/VendorAnalyticsProTab.tsx`. Hook : `frontend/src/hooks/use-vendor-analytics-pro.ts`. Coexiste avec l'onglet "Statistiques" (`VendorStatsTab`) — ce dernier reste pour la vue rapide.

## Fonctions SQL (toutes SECURITY DEFINER, REVOKE PUBLIC/anon, GRANT authenticated)

- `vendor_analytics_kpis(store_id, start, end, category_id?, city?, payment_method?)` → `{current, previous}` avec CA, marge, AOV, CVR, clients uniques + delta vs période précédente (calculée automatiquement = même durée juste avant)
- `vendor_analytics_timeseries(...)` → courbes journalières CA/marge/commandes
- `vendor_analytics_funnel(store_id, start, end)` → vues → ajouts panier → checkouts → payés (lit `product_views`, `cart_items`, `orders` ; tolère tables manquantes via EXCEPTION undefined_table)
- `vendor_analytics_top_products(...)` → 15 meilleurs produits avec flag `is_low_stock` (≤5 unités)
- `vendor_analytics_cohorts(store_id, months_back)` → cohortes mensuelles avec LTV et rétention J30/J60/J90
- `vendor_analytics_orders_export(...)` → 5000 commandes max, filtrées (catégorie/ville/paiement)

Toutes les fonctions appellent `can_access_store_orders(auth.uid(), store_id)` en garde — un vendeur ne voit jamais les données d'une autre boutique.

## Filtres avancés

- Préset 7/30/90 jours
- Filtre ville client (input texte sur `shipping_city`)
- Filtre méthode paiement (mobile_money, card, cod, off_platform)
- Comparaison automatique vs période équivalente précédente (delta % sur chaque KPI)

## Exports

- **CSV** : génération côté client via `fetchOrdersExport` + `downloadCSV`
- **PDF** : ouverture nouvelle fenêtre avec HTML stylé + `window.print()` (l'utilisateur sauve en PDF)
- **Email programmé** : table `vendor_analytics_email_schedules` (frequency: weekly|monthly, format: csv|pdf, day_of_week, day_of_month)

## Cron envoi automatique

- Edge function : `process-vendor-analytics-emails`
- pg_cron horaire : `process-vendor-analytics-emails-hourly` (0 * * * *)
- Idempotence : chaque planification stocke `last_sent_at` ; ne renvoie que si > 6 jours (weekly) ou 27 jours (monthly) ET le bon jour de semaine/mois
- Délègue l'envoi SMTP à `send-vendor-email` (Hostinger) avec attachment CSV optionnel

## Sécurité

- Table `vendor_analytics_email_schedules` : RLS via `can_access_store_orders` (vendeur/équipe boutique) + policy admin séparée
- Aucune RPC analytics n'est accessible aux anonymes (REVOKE explicite)
- Filtres SQL paramétrés (pas d'injection possible)

## TODO si besoin

- Quand `src/integrations/supabase/types.ts` sera régénéré, retirer les casts `(supabase as any)` du hook
- Ajouter UI plein écran de gestion des planifications (actuellement via `prompt()`)
- Ajouter graphique cohortes en heatmap