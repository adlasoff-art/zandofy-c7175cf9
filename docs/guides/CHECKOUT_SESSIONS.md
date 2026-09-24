# Checkout sessions — 1 paiement / N commandes boutique

## Modèle

- Table `checkout_sessions` : 1 charge gateway (MoMo / carte).
- Table `orders` : **1 row par boutique** (et éventuellement par origine) avec `checkout_session_id`.
- `payment_transactions.order_id` = ancre ; `checkout_session_id` pour fan-out.
- Confirmer via RPC `confirm_checkout_session_payment` (idempotent).

## Politique vendeur (`stores.group_checkout_policy`)

| Valeur | Défaut | Effet |
|--------|--------|-------|
| `multi_vendor_ok` | **oui** | Groupable avec d’autres boutiques aussi multi / compatibles |
| `own_stores_only` | | Groupable seulement avec les autres magasins du même owner |
| `solo_only` | opt-out | Pas de panier multi-boutiques avec cette boutique |

Migration : `20260924180000_group_checkout_default_multi_vendor.sql` (DEFAULT + backfill `solo_only` → `multi_vendor_ok`).

## Remboursements / litiges (ops)

- Toujours traiter **par `order_ref`** (ex. `ZND-XXXX-A`), jamais « la session entière » sauf remboursement total volontaire de toutes les sous-commandes.
- Commission / wallet vendeur : par `store_id` / order.
- Tracking : par order (local vs international restent séparés).

## Staging → production

1. Appliquer `20260924160000_checkout_sessions_and_group_policy.sql` (si pas déjà fait).
2. Appliquer `20260924170000_checkout_sessions_no_client_update.sql` (confirm/fail = `service_role` only).
3. Appliquer `20260924180000_group_checkout_default_multi_vendor.sql`.
4. Vérifier : `SELECT group_checkout_policy, count(*) FROM stores GROUP BY 1;` → quasi tout `multi_vendor_ok`.
5. Smoke QA (tableau ci-dessous).
6. Redeploy Edge **uniquement si** non déjà déployés après le lot sessions : `kelpay-payment`, `kelpay-webhook`, `kelpay-check`, `keccel-cardpay`.
7. Même SQL + smoke court en **production**.

## QA runbook (I4)

| Check | Attendu |
|-------|---------|
| Mono-store MoMo | 1 order, inchangé |
| 2 stores (défaut) + MoMo | 1 charge, 2 orders `pending` → session `paid` |
| Vendeur passe en `solo_only` | CTA panier rebloqué avec ce magasin + un autre |
| Mix WA-only + MoMo | Bloqué `MIXED_PAYMENT_MODEL` |
| Approve nouveau vendeur | Store créé avec `group_checkout_policy = multi_vendor_ok` |
| Retry session | Montant = somme des orders de la session |
| Checkout récap | Sous-totaux par boutique + badge Local/Intl + « 1 paiement · N commandes » |

Opt-out vendeur : Settings → Modes de paiement → « Solo — pas d’achats groupés ».

## WhatsApp / off_platform

Inchangé (fail-closed). Mix différé + online dans le même panier = bloqué (`MIXED_PAYMENT_MODEL`).
