# Roadmap hors-scope — épiques post I0–I5

Ces épiques sont documentées pour le backlog produit. Elles **ne bloquent pas** I0–I5 (UX polish + TMS MVP). Chaque epic = chantier séparé avec PR dédié, smoke staging → prod.

## E1 — SEO organique (post-snippet)

- Snippet geo / bot UA déjà traité (Mois du CA W0).
- Suite : templates CMS catégories, FAQ top catégories, GSC monitoring.
- Risque : moyen.
- Fichiers typiques : `AdminSEOPage`, `docs/SEO_*`, meta-injector.

## E2 — Supply deep (`active_services`)

- Brancher un par un les services historiques utiles encore dormants.
- Risque : moyen (surface feature flags).
- Ne pas activer en masse sans smoke par service.

## E3 — GMV multi-devise

- Normaliser `store_delivered_gmv` via table FX / équivalent USD.
- Risque data élevé (~4000+ boutiques).
- Prérequis : audit des devises présentes sur `orders` + stratégie de conversion historique.

## E4 — Alibaba parity

- Messages avancés, RFQ, trade assurance — lots produits.
- Risque très élevé ; découper en MVP RFQ puis messaging puis assurance.
- Ne pas mélanger avec wallet vendeur / KYB dans le même PR.

## E5 — Hard-delete boutiques

- Soft-archive déjà en place.
- Hard-delete = plan 2 phases + légal (rétention commandes, factures).
- Interdit sans validation humaine explicite (voir `.cursor/rules/05-database-safety.mdc`).

## E6 — Mobile native

- Flutter / Next **non bloqueur**.
- Priorité : PWA (`frontend/public/sw.js`) + readiness mobile web.
- Voir `docs/I9_MARKETPLACE_MOBILE_SYNC.md`, `docs/QA_LIVE_MOBILE_READINESS.md`.

## Ordre suggéré

1. E1 SEO (si croissance organique prioritaire)
2. E3 GMV FX (si seuils KYB multi-devise bloquent)
3. E2 supply deep
4. E4 Alibaba parity (par lots)
5. E5 hard-delete (légal)
6. E6 native (stratégique)

## Ops

Après merge I0–I5, appliquer en SQL Editor staging puis prod :

- `supabase/migrations/20260916170000_ensure_orders_shipping_mode.sql`
- `supabase/migrations/20260916180000_external_shipments_forwarder_tms.sql`
- `supabase/migrations/20260916181000_external_shipment_token_harden.sql` (si 180000 déjà appliqué sans kill switch)

## Admin spaces & monitoring (ops)

- **Multi-rôles** : un compte `admin` peut aussi avoir `vendor` / `operator` / `forwarder` (+ entité liée approuvée) pour exploiter ses propres espaces.
- **Dropdown admin** (`AdminLayout`) : Accueil, Mon espace, vendeur, **opérateur**, **transitaire**, livreur, Administration.
- **Menu compte site** (Header / mobile) : « Espace transitaire » si rôle `forwarder` ; sinon « Devenir transitaire ».
- **Monitoring d’un autre compte** : pas de bypass RLS. Utiliser **Ouvrir l’espace** sur `/admin/forwarders` ou `/admin/operators` (impersonation Edge `impersonate-user`, nouvel onglet avec `redirect=/forwarder` ou `/operator`), ou Impersonner depuis la fiche Utilisateur.
- Après exchange, landing par défaut inclut `operator` et `forwarder` (plus seulement vendor/rider/shipper).
- Smoke : dropdown → `/operator` `/forwarder` ; Ouvrir espace → bandeau impersonation + **dashboard métier ciblé** ; quitter impersonation restaure l’admin.
