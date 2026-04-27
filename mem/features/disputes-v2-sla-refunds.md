---
name: Disputes v2 — SLA, Refunds, Wallet, Evidence
description: Lot 13 — SLA 48h/7j auto-escalade, remboursements (cash/wallet/négociation), preuves photo, portefeuille client crédit
type: feature
---

# Lot 13 — Disputes v2

## SLA automatiques
- À l'ouverture d'un litige, trigger `compute_dispute_sla()` calcule :
  - `sla_response_due_at = created_at + 48h` (réponse vendeur)
  - `sla_resolution_due_at = created_at + 7j` (résolution totale)
- Trigger `mark_vendor_first_response()` capture `vendor_first_response_at`
  dès qu'un message du propriétaire de la boutique est inséré dans `dispute_messages`.
- Cron horaire (`process-dispute-sla` edge fn, planifié via pg_cron job
  `process-dispute-sla-hourly` à `0 * * * *`) appelle la RPC `process_dispute_sla()` :
  - Escalade vers admin si pas de réponse vendeur après 48h →
    `escalated_at`, `escalated_reason='sla_no_vendor_response_48h'`,
    `priority='high'`, `status='escalated'`.
  - Marque `is_overdue=true` si pas résolu après 7j.
  - Crée des notifs in-app pour le client (best-effort).
- ⚠️ **Prod** : recréer le cron sur Supabase perso `vpt...yxf` avec l'URL et
  l'anon key prod (le job `process-dispute-sla-hourly` créé sur Lovable Cloud
  ne migre pas tout seul).

## Remboursements
- Quatre flux supportés via Edge Function `apply-dispute-refund` :
  - `propose` (vendeur ou admin) → enregistre `proposed_refund_*` + notifie le client
  - `accept` (client uniquement, si `proposed_refund_status='pending'`) → applique
  - `reject` (client uniquement) → marque `proposed_refund_status='rejected'`
  - `apply` (admin uniquement) → applique directement sans négociation
- Méthodes : `wallet` (crédit dans `customer_wallets`), `cash`, `original_method`
  (les deux derniers créent une ligne `payment_transactions` négative type `refund`).
- Presets %: 25 / 50 / 75 / 100 du total commande dans le panneau UI.
- Garde-fous SQL (`apply_dispute_refund` RPC) : montant > 0, ≤ order.total,
  méthode dans whitelist. `SECURITY DEFINER`, GRANT `authenticated`.

## Portefeuille client (`customer_wallets`)
- Table séparée des `vendor_wallets`. Une ligne par `user_id` (UNIQUE).
- `customer_wallet_transactions` : historique credit_refund / debit_purchase / adjustment.
- RLS : owner SELECT seulement, admin ALL. Aucune écriture client directe (passe
  toujours par RPC ou Edge Function avec service_role).
- Composant UI : `CustomerWalletCard` (à intégrer dans dashboard client si besoin).

## Preuves visuelles
- Bucket `dispute-evidence` (privé), images JPEG/PNG/WEBP/HEIC, max 10 Mo.
- Path : `<dispute_id>/<uploader_user_id>/<uuid>.<ext>`.
- RLS storage.objects : SELECT/INSERT autorisé au client du litige, vendeur de la
  boutique, admin. DELETE par l'uploader ou l'admin.
- Composant `DisputeEvidenceUpload` : signed URLs 1h, max 5 fichiers par uploader.

## Composants UI livrés
- `DisputeSLABadge` : badge contextuel (escaladé / en retard / N heures restantes / N jours).
- `DisputeRefundPanel` : panneau négociation/application avec presets %.
- `DisputeEvidenceUpload` : upload + galerie thumbnails avec signed URLs.
- `CustomerWalletCard` : solde + 5 dernières opérations.
- Intégrés dans `DisputesList` (vue client). À intégrer aussi dans
  `VendorDisputesTab` et `AdminDisputesPage` si UX souhaitée (Lot futur).

## i18n
- Clés `disputes.sla.*`, `disputes.refund.*`, `disputes.evidence.*`, `wallet.*`
  ajoutées en FR + EN dans `I18nContext.tsx`.

## Sécurité (rappels Core rules)
- `process_dispute_sla` et `apply_dispute_refund` sont `SECURITY DEFINER`,
  REVOKE PUBLIC, GRANT ciblé.
- Pas de Realtime sur `disputes` (table sensible) — polling/refetch à la place.
  `dispute_messages` reste en Realtime (DisputeChat) car nécessaire pour l'UX
  tripartite et pas de PII bancaire dedans.
- Edge Function `process-dispute-sla` accepte un secret partagé optionnel
  `DISPUTE_SLA_CRON_SECRET` (Vault) pour blinder l'appel cron.

## Migration
- Fichier : `supabase/migrations/20260427224734_*.sql`
- Export prod : `/mnt/documents/zandofy_lot13_disputes_v2.sql`
- À rejouer sur staging ET prod (cf. core rule RLS Staging/Prod Divergence).