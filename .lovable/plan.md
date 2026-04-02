

# Plan : Résolution du paiement Mobile Money qui tourne indéfiniment

## Diagnostic

L'analyse du code révèle **3 causes combinées** pour le spinning infini après annulation USSD :

### Cause 1 — `kelpay-check` ne reconnaît pas les statuts d'annulation
Dans `kelpay-check/index.ts` (lignes 140-148), seuls ces statuts sont détectés :
- **Succès** : `code "0"`, `transactionstatus "SUCCESS"` ou `"Successful"`
- **Échec** : `code "1" + transactionstatus "FAILED"` ou `"Failed"`

Les statuts comme **`"Cancelled"`, `"CANCELLED"`, `"Expired"`, `"EXPIRED"`, `"Declined"`** ne sont pas reconnus → la fonction retourne `"pending"` éternellement.

### Cause 2 — Le webhook (`kelpay-webhook`) a le même problème
Lignes 105-112 : même logique restrictive. Si KelPay envoie un callback avec `transactionstatus: "Cancelled"`, il est ignoré comme "non-définitif".

### Cause 3 — Le polling checkout n'a pas de timeout
Dans `CheckoutPage.tsx`, le realtime channel + le bouton "Vérifier le statut" sont les seuls mécanismes. Il n'y a **aucun timer d'expiration automatique** pour arrêter l'attente après un délai raisonnable (contrairement à `RetryPaymentModal` qui a un timeout de 60 tentatives / 5 minutes).

### Cause 4 — `handleCheckPaymentStatus` vérifie `transactionstatus` au lieu de `status`
Ligne 797 : `data?.transactionstatus === "SUCCESS"` alors que `kelpay-check` retourne `data.status` (normalisé). Le check manuel ne détecte donc jamais les échecs non plus.

---

## Corrections proposées

### 1. `kelpay-check/index.ts` — Élargir la détection des statuts terminaux

Ajouter les statuts `Cancelled`, `CANCELLED`, `Expired`, `EXPIRED`, `Declined`, `DECLINED`, `Rejected` à la condition `isFailed`. Tout statut qui n'est pas explicitement `pending/Sent/Processing` devrait être considéré comme un résultat définitif après un certain nombre de checks.

### 2. `kelpay-webhook/index.ts` — Même élargissement

Même correction pour les callbacks webhook entrants.

### 3. `CheckoutPage.tsx` — Ajouter un timeout automatique au polling

Ajouter un `setTimeout` de 3 minutes qui :
- Appelle `kelpay-check` une dernière fois
- Si toujours `pending`, affiche un message d'expiration et libère l'UI
- Marque le paiement comme `failed` si le timeout est atteint

### 4. `CheckoutPage.tsx` — Corriger `handleCheckPaymentStatus`

Remplacer `data?.transactionstatus` par `data?.status` pour aligner avec le format de retour normalisé de `kelpay-check`.

### 5. Ajouter un bouton "Annuler" explicite

Dans la section `paymentPending`, ajouter un bouton permettant à l'utilisateur d'annuler manuellement l'attente, ce qui :
- Arrête le polling/realtime
- Met à jour la transaction en `failed`
- Met à jour la commande en `payment_failed`
- Réaffiche le formulaire de paiement

---

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `frontend/supabase/functions/kelpay-check/index.ts` | Élargir les statuts terminaux (Cancelled, Expired, Declined, etc.) |
| `frontend/supabase/functions/kelpay-webhook/index.ts` | Même élargissement côté webhook |
| `frontend/src/pages/CheckoutPage.tsx` | Timeout auto 3min + fix `handleCheckPaymentStatus` + bouton Annuler |
| `frontend/src/components/payments/RetryPaymentModal.tsx` | Même élargissement des statuts détectés dans le polling |

---

## Concernant le sous-domaine `studio.zandofy.com`

Le callback URL KelPay n'est **pas** affecté par le sous-domaine car `callbackurl` dans `kelpay-payment` utilise `${supabaseUrl}/functions/v1/kelpay-webhook` (l'URL Supabase, pas le domaine du site). Le problème de sous-domaine ne concerne que **Keccel CardPay** (pour la `returnUrl` de redirection navigateur), qui a déjà été corrigé dans le plan précédent.

