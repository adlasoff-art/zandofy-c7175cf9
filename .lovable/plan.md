

# Analyse des secrets et corrections à appliquer

## Bilan des secrets sur supabase.com

| Secret | Statut | Impact |
|--------|--------|--------|
| `SUPABASE_URL` | ✅ Automatique | Fourni par Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Automatique | Fourni par Supabase |
| `KELPAY_TOKEN` | ✅ Déjà configuré | Utilisé par keccel-cardpay, kelpay-payment, kelpay-check |
| `SITE_BASE_URL` | ✅ Vient d'être ajouté | URL de retour après paiement |
| `KECCEL_CARD_MERCHANT_CODE` | ✅ Vient d'être ajouté | Code marchand carte (`jam`) |
| `KELPAY_WEBHOOK_SECRET` | ⚠️ Manquant mais OPTIONNEL | Vérification HMAC des callbacks |

### Le `KELPAY_WEBHOOK_SECRET` n'est PAS bloquant

Le code du webhook (ligne 24) fait : `if (webhookSecret) { ... }` — la vérification HMAC ne s'active **que si** le secret est configuré. Sans lui, le webhook accepte tous les callbacks sans vérifier la signature. Ce n'est pas idéal pour la sécurité en production, mais **ça fonctionne**.

Keccel doit vous fournir ce secret si vous le souhaitez. Ce n'est pas quelque chose que vous générez vous-même.

## Problème restant : le vrai bloqueur

Les secrets sont maintenant en place. L'erreur "Erreur lors de l'initiation du paiement" vient probablement de **deux problèmes dans le code** :

1. **L'edge function `frontend/supabase/functions/kelpay-webhook/index.ts` utilise une librairie incompatible** (`import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts"`) qui peut faire crasher le déploiement sur supabase.com. Il faut la remplacer par l'API Web Crypto native.

2. **L'edge function `keccel-cardpay` retourne des codes HTTP 400/401/502** que le SDK Supabase traite comme des erreurs opaques, masquant le vrai message. Il faut retourner HTTP 200 avec `success: false`.

3. **Le frontend affiche un message générique** au lieu du vrai message d'erreur retourné par Keccel.

## Plan de corrections (3 fichiers dans `frontend/`)

### 1. `frontend/supabase/functions/kelpay-webhook/index.ts`
- Remplacer `import { hmac }` par une fonction native Web Crypto API (comme déjà fait dans `supabase/functions/kelpay-webhook/index.ts`)

### 2. `frontend/supabase/functions/keccel-cardpay/index.ts`
- Changer toutes les réponses d'erreur (status 400, 401, 403, 404, 500, 502) pour retourner `status: 200` avec `{ success: false, error: "..." }`
- Ajouter `success: true` dans la réponse de succès finale

### 3. `frontend/src/pages/CheckoutPage.tsx`
- Remplacer le message générique par `data?.error || error?.message` pour afficher la vraie raison de l'échec

## Résultat attendu

Après ces corrections (poussées vers GitHub → déployées via Vercel + Supabase), le paiement par carte devrait soit fonctionner (redirection vers Keccel), soit afficher le message d'erreur exact de l'API Keccel dans le toast, permettant un diagnostic précis.

