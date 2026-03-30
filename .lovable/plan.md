

# Plan : Webhook KelPay — Edge Functions + Admin UI

## Contexte

KelPay demande l'URL webhook pour envoyer les confirmations de paiement. Le frontend appelle déjà `kelpay-payment` et `kelpay-check` via `supabase.functions.invoke()`, mais ces edge functions n'existent pas encore. Il faut les créer, ainsi qu'un endpoint webhook public que KelPay appellera.

## URLs Webhook

Les URLs seront construites automatiquement à partir du project ID Supabase :

- **Staging** : `https://uogkklwfvwoxkifpkzpu.supabase.co/functions/v1/kelpay-webhook`
- **Production** : même format avec le project ref de production

L'admin verra ces URLs dans un panneau dédié avec bouton copier.

---

## Edge Functions à créer

### 1. `kelpay-webhook` (endpoint public, appelé par KelPay)

- Reçoit le callback POST de KelPay (confirmation/échec paiement)
- Vérifie la signature HMAC via le secret `KELPAY_WEBHOOK_SECRET`
- Cherche la `payment_transaction` par `transaction_id` ou `reference`
- Met à jour le statut (`success` / `failed`) + stocke le payload
- Si succès : met à jour `orders.status` → `pending` (commande confirmée)
- Si échec : met à jour `orders.status` → `payment_failed`
- Envoie une notification in-app via insert dans `notifications`
- **Pas de JWT requis** (webhook externe)

### 2. `kelpay-payment` (appelé par le frontend, JWT requis)

- Reçoit `order_id`, `phone_number`, `amount`, `currency`, `provider`
- Vérifie que l'utilisateur est propriétaire de la commande
- Construit le callback_url dynamiquement : `{SUPABASE_URL}/functions/v1/kelpay-webhook`
- Appelle l'API KelPay pour initier le paiement
- Crée une entrée `payment_transactions` avec statut `pending`
- Retourne `{ success, transaction_id, reference }`

### 3. `kelpay-check` (polling, JWT requis)

- Reçoit `transaction_id` ou `reference`
- Appelle l'API KelPay pour vérifier le statut
- Met à jour `payment_transactions` et `orders` en conséquence
- Retourne le statut actuel

## Secrets nécessaires

Les secrets suivants doivent être configurés (via l'outil secrets) :
- `KELPAY_MERCHANT_CODE`
- `KELPAY_TOKEN`
- `KELPAY_WEBHOOK_SECRET`
- `KELPAY_BASE_URL` (défaut : `https://api.kelpay.com`)

## RLS : politique update pour le webhook

Actuellement seuls les admins/managers peuvent mettre à jour `payment_transactions`. Le webhook utilise le `service_role` key donc pas de problème RLS — les edge functions avec `createClient(url, service_role_key)` contournent le RLS.

## Admin UI : Panneau Webhook

Ajouter une section dans `AdminSettingsPage.tsx` ou créer un sous-onglet "Passerelle de paiement" avec :

```text
┌─────────────────────────────────────────────┐
│ 🔗 Webhook KelPay                          │
├─────────────────────────────────────────────┤
│ Staging:                                    │
│ [https://...supabase.co/functions/v1/      │
│  kelpay-webhook]                  [Copier]  │
│                                             │
│ Production:                                 │
│ [https://...supabase.co/functions/v1/      │
│  kelpay-webhook]                  [Copier]  │
├─────────────────────────────────────────────┤
│ Statut: ● Connecté / ○ En attente          │
│ Dernier callback reçu : il y a 2 min       │
│                                             │
│ 📋 Derniers callbacks (5 derniers)          │
│ ┌─────┬──────────┬────────┬───────────┐    │
│ │ Réf │ Statut   │ Montant│ Date      │    │
│ └─────┴──────────┴────────┴───────────┘    │
└─────────────────────────────────────────────┘
```

- URLs webhook copiables en un clic
- Historique des 10 derniers callbacks reçus (depuis `payment_transactions` où `callback_payload` IS NOT NULL)
- Badge de statut basé sur la dernière réception

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `supabase/functions/kelpay-webhook/index.ts` | **Créer** — endpoint webhook public |
| `supabase/functions/kelpay-payment/index.ts` | **Créer** — initiation paiement |
| `supabase/functions/kelpay-check/index.ts` | **Créer** — vérification statut |
| `frontend/src/pages/admin/AdminSettingsPage.tsx` | **Modifier** — ajouter section Webhook KelPay |

## Pas de migration SQL nécessaire

La table `payment_transactions` et les colonnes requises existent déjà. Le `callback_payload` (JSONB) stockera les données du webhook.

## Ordre d'implémentation

1. Configurer les secrets KelPay (demander à l'utilisateur)
2. Créer les 3 edge functions
3. Ajouter le panneau admin Webhook
4. Fournir les URLs webhook à communiquer à KelPay

