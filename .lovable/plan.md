## Objectif

1. **Graver dans la mémoire projet** les règles officielles Keccel CardPay (confirmées par l'agent Keccel) pour qu'aucune itération future ne reproduise les erreurs.
2. **Remettre `keccel-cardpay/index.ts` dans un état propre** : un seul appel, payload exact, plus de boucle d'essais à 13 variantes.

> Note : tu as déjà mis à jour le secret `KECCEL_CARD_MERCHANT_CODE` = `JAMSIO`. Aucune action secret à demander.

---

## Partie 1 — Documentation immuable (avant tout code)

### 1a. Réécrire `mem://features/keccel-cardpay-constraints`

Règles officielles confirmées par l'agent Keccel (WhatsApp) :

- **`merchantcode`** : valeur fournie par Keccel pour Zandofy = **`JAMSIO`** (stocké dans secret `KECCEL_CARD_MERCHANT_CODE`).
- **Casse des clés** : **TOUS les paramètres en minuscules** — `merchantcode`, `reference`, `amount`, `currency`, `description`, `callbackurl`, `returnurl`. Jamais de camelCase.
- **Champs autorisés** : exactement **7 champs**. **Ne jamais ajouter** `language`, `customerEmail`, `customerName`, `customerPhone`, `notifyUrl`, `country`, `channel`, etc.
- **`amount`** : string entière (`Math.ceil`).
- **`reference`** : ≤ 25 caractères.
- **`Authorization`** : `Bearer <token>` (token brut côté secret).
- **Endpoint** : `POST https://api.keccel.net/cardpay`.

### 1b. Ajouter section « 7. Intégration Keccel CardPay (immuable) » dans `SAFETY_POLICY.md` et `docs/SAFETY_POLICY.md`

Reprend les 7 règles ci-dessus + mention :
> Toute modification du payload Keccel CardPay (ajout de champ, changement de casse, changement du merchantcode) nécessite une confirmation écrite de l'équipe Keccel. Aucun champ « au cas où » pendant le debug.

---

## Partie 2 — Nettoyage de l'edge function

Refactor identique de `supabase/functions/keccel-cardpay/index.ts` ET `frontend/supabase/functions/keccel-cardpay/index.ts`.

### Supprimé

- Boucle `attempts[]` (13 variantes).
- Variantes camelCase (`merchantCode`, `callbackUrl`, `returnUrl`).
- Variantes avec champs extra (`language`, `customerEmail`, `customerName`, `customerPhone`, `notifyUrl`, `country`, `channel`).
- Variante `returnurl + returnUrl` (mode `both`).
- Lecture du profil (email/nom/phone) si plus utilisée ailleurs dans la fonction.

### Conservé

- Auth utilisateur, rate limiting, fetch order, validation montant.
- `reference` ≤ 25 chars, `callbackUrl`, `returnUrl`.
- Pre-flight validation des 7 champs.
- Diagnostic : 1 insert dans `keccel_cardpay_diagnostics` (succès ou échec).
- Création `payment_transactions` + update `orders.status` inchangées.

### Payload final unique

```ts
const payload = {
  merchantcode: keccelMerchantCode, // = "JAMSIO"
  reference,
  amount: String(Math.ceil(amount)),
  currency: "USD",
  description: `Commande ${order.order_ref} - Zandofy`,
  callbackurl: callbackUrl,
  returnurl: returnUrl, // lowercase obligatoire
};

await fetch("https://api.keccel.net/cardpay", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${cleanToken}`,
  },
  body: JSON.stringify(payload),
});
```

### Fichiers touchés

- `mem://features/keccel-cardpay-constraints` (réécriture complète)
- `SAFETY_POLICY.md` (ajout section 7)
- `docs/SAFETY_POLICY.md` (ajout section 7)
- `supabase/functions/keccel-cardpay/index.ts` (refactor)
- `frontend/supabase/functions/keccel-cardpay/index.ts` (refactor identique)
- `.lovable/plan.md` (mise à jour finale)

Pas de migration SQL. Pas de changement frontend.

---

## Validation post-déploiement

1. Commit → GitHub Actions déploie sur la prod (`vpt...yxf`).
2. Test d'un paiement carte réel sur `zandofy.com`.
3. Attendu : Keccel répond `{"code":"0","checkoutUrl":"..."}` → redirection 3DS.

---

**Confirmes-tu que je peux appliquer ce plan ?**
