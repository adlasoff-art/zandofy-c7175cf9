

# Plan : Correction de l'Edge Function keccel-cardpay selon la doc officielle

## Résumé

Aligner l'edge function `keccel-cardpay` et le webhook `kelpay-webhook` sur les noms de champs exacts de la documentation Keccel CardPay API.

---

## 1. Corriger `keccel-cardpay/index.ts` — Payload API

Remplacer le payload actuel par les 7 champs obligatoires de la doc :

```json
{
  "merchantcode": "jam",
  "reference": "keccel_card_{order_id}_{timestamp}",
  "amount": 100,
  "currency": "USD",
  "description": "Commande ZD-XXXXX - Zandofy",
  "callbackurl": "{SUPABASE_URL}/functions/v1/kelpay-webhook",
  "returnUrl": "{SITE_BASE_URL}/payment/return?ref={reference}&order_id={id}"
}
```

Changements :
- `merchant_code` → `merchantcode`
- `callback_url` → `callbackurl`
- `return_url` → `returnUrl` (case-sensitive !)
- Supprimer : `order_id`, `payment_method`, `cancel_url`, `save_card`
- Ajouter : `reference` et `description` comme champs requis

Extraire `checkoutUrl` de la réponse (au lieu de `payment_url`/`redirect_url`) et `transactionid` (pas `transaction_id`).

Vérifier `code === "0"` pour confirmer que la requête a été acceptée avant de rediriger.

## 2. Ajuster `kelpay-webhook/index.ts` — Callback

Le webhook gère déjà `code`, `reference`, `transactionid`, `transactionstatus`, `description`. Ajustements mineurs :
- S'assurer que `code === "0"` est bien traité comme succès (c'est déjà le cas)
- Ajouter `code === "1"` comme échec explicite (déjà couvert par le fallback)
- Pas de changement structurel majeur nécessaire

## 3. Fichiers impactés

| Fichier | Action |
|---------|--------|
| `frontend/supabase/functions/keccel-cardpay/index.ts` | **Modifier** — corriger les noms de champs API |
| `frontend/supabase/functions/kelpay-webhook/index.ts` | **Vérifier** — ajustements mineurs si nécessaire |

## Ce qui reste à obtenir de Keccel

1. **PayPal** — même endpoint `/cardpay` ou endpoint séparé ?
2. **Tokenisation** — support de sauvegarde de carte pour paiements récurrents ?
3. **Credentials** — confirmer que le token KELPAY_TOKEN et merchantcode `jam` sont les mêmes pour carte et Mobile Money

