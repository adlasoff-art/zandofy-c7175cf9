## Lot 3 — Réparer le paiement par carte (Keccel CardPay) — révisé

### Nouveau diagnostic

Tous les secrets Keccel sont configurés en prod (`KECCEL_CARD_MERCHANT_CODE`, `KELPAY_TOKEN`, `KELPAY_MERCHANT_CODE`, `SITE_BASE_URL`). La cause racine est donc ailleurs. Hypothèses restantes par ordre de probabilité :

1. **Format `amount`** : Mobile Money envoie `String(cleanAmount)`, Keccel CardPay envoie `amount: number`. La doc Keccel attend une string `"X.XX"`. Rejet probable côté API.
2. **Token incorrect pour `/cardpay`** : `KELPAY_TOKEN` est valide pour `api.kelpay.com` (Mobile Money). Keccel CardPay (`api.keccel.net/cardpay`) peut exiger un token différent ou un header d'auth différent (ex: `X-API-Key` au lieu de `Bearer`).
3. **Champ `merchantcode` vs `merchantCode`** : casse exacte attendue par l'API.
4. **`currency: "USD"` non supporté** par le merchant code (compte configuré en CDF/EUR ?).
5. **`returnUrl` vs `returnurl`** : incohérence de casse avec les autres champs en lowercase (`callbackurl`).

Sans le message d'erreur exact retourné par Keccel, on tâtonne. Stratégie : **déployer un patch d'observabilité d'abord**, faire un test, lire le vrai code/description Keccel, puis fixer ciblé.

### Étapes d'exécution

#### 1. Patch d'observabilité (les 2 fichiers `keccel-cardpay/index.ts`)

- **Logger le payload envoyé** (sans le token) : `console.log("Keccel cardpay → payload:", JSON.stringify(keccelPayload))`.
- **Logger la réponse brute** (`status`, `body text`) avant le `.json()` pour capturer un éventuel HTML/erreur réseau.
- **Renvoyer au front les détails Keccel** : déjà fait pour `keccelResponse?.code` et `description`, on s'assure qu'ils sont bien transmis.
- **Supprimer le fallback `|| "jam"`** : retour 500 propre si secret absent (hardening, déjà discuté).
- **Garder `amount: number`** pour ce premier patch — on ne change pas la cause potentielle avant d'avoir le log.
- **Unifier les deux fichiers** edge function (déjà quasi identiques, on s'aligne sur la version frontend qui a CORS strict).

#### 2. Améliorer le toast côté `CheckoutPage.tsx`

Afficher `data.code` + `data.description` retournés par l'edge function dans le toast d'erreur (au lieu du message générique). Tu verras directement le motif Keccel.

#### 3. Test prod (toi)

Une fois mergé et déployé via GitHub Actions :
- Tenter un paiement carte de petit montant.
- Copier le toast d'erreur enrichi → me l'envoyer.
- En parallèle je peux lire les logs `keccel-cardpay` côté Lovable Cloud (mais je ne peux pas lire ceux de la prod `vpt...yxf` — il faudra que tu me copies la ligne `Keccel cardpay response: {...}` depuis Supabase prod → Edge Functions → Logs).

#### 4. Fix ciblé (en 2e PR)

Selon ce que dit Keccel, on applique le fix précis :
- `amount` en string → trivial
- token séparé → ajouter `KECCEL_CARD_TOKEN` secret
- casse de champ → renommer
- currency → adapter ou rendre dynamique
- header auth → changer

#### 5. Bump PWA `1.10.2` (patch silencieux) à la fin du cycle.

#### 6. Mémoire

Mettre à jour `mem://features/keccel-cardpay-constraints` avec la cause définitive une fois identifiée (référence pour éviter régression).

### Hors scope

- Pas de migration DB.
- Pas de touche Mobile Money / KelPay.
- Pas de remplacement de Keccel par Stripe.
