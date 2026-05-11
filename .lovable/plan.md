## Hypothèse confirmée à 90 %

Keccel attend toutes les clés du payload en **camelCase**, pas en minuscules :

- `merchantCode` (pas `merchantcode`)
- `callbackUrl` (pas `callbackurl`)
- `returnUrl` ✓ (déjà bon)

**Preuve** : l'attempt #3 (qui envoie `returnurl` lowercase) reçoit `Missing returnUrl parameter` — Keccel cite le nom attendu en camelCase. Pour les autres attempts, le nom est vide (double espace) parce que Keccel ne parvient pas à reformater nos clés lowercase.

Notre merchant code `jam` est bien envoyé (`ja***am` confirmé), mais Keccel ne le voit pas parce qu'il cherche la clé `merchantCode` qui n'existe pas dans le JSON.

## Plan d'action — Étape unique

Modifier `frontend/supabase/functions/keccel-cardpay/index.ts` pour ajouter **3 nouvelles variantes camelCase** (attempts 11-13) en gardant les 10 existantes (au cas où l'hypothèse serait fausse) :

### Variantes à ajouter

```ts
// Attempt 11 : tout en camelCase strict
{ attempt_index: 11, label: "camelCase_full",
  payload_keys: { merchantCode, reference, amount, currency, description, callbackUrl, returnUrl }
}

// Attempt 12 : camelCase + champs client (au cas où)
{ attempt_index: 12, label: "camelCase+customer",
  payload_keys: { merchantCode, reference, amount, currency, description, callbackUrl, returnUrl,
                  customerEmail, customerName, customerPhone }
}

// Attempt 13 : camelCase + language
{ attempt_index: 13, label: "camelCase+lang",
  payload_keys: { merchantCode, reference, amount, currency, description, callbackUrl, returnUrl,
                  language: "fr" }
}
```

Implémentation : refactor mineur du builder de payload pour basculer entre `lowercase` / `camelCase` selon l'attempt.

## Étape de validation post-déploiement

1. GitHub Actions déploie automatiquement la fonction sur prod (5 min).
2. Tu fais **un seul** test carte sur `zandofy.com`.
3. Tu lances le SQL du dernier plan (mêmes 2 requêtes).
4. Lecture :

| Cas | Verdict |
|---|---|
| Attempt 11/12/13 a `keccel_code = "0"` + checkoutUrl | **GAGNÉ** — Keccel attend bien camelCase. On nettoie ensuite et on retire les 10 anciennes variantes. |
| Toujours `Missing parameter` même en camelCase | L'hypothèse était fausse — on regarde la doc Keccel ou on contacte le support avec preuve à l'appui. |
| Nouvelle erreur (genre `Invalid amount`, `Unauthorized`...) | On progresse — le format des clés était bon, il manque juste un champ ou un format précis. |

## Ce que je ne touche PAS

- Aucun changement de logique business (montant, reference, transaction record, ordre status).
- Le merchant code reste à `jam` (à ne PAS revenir à JAMSIO).
- Les 10 anciennes variantes lowercase restent en place tant qu'on n'a pas confirmé.

## Fichier impacté

- `frontend/supabase/functions/keccel-cardpay/index.ts` : ajout d'un flag `key_case: "lowercase" | "camelCase"` dans le type `Attempt`, et logique pour construire le payload selon le case choisi. ~30 lignes ajoutées.

Pas de migration DB (la table `keccel_cardpay_diagnostics` accepte déjà des `attempt_label` libres).

Approuve et j'implémente immédiatement.
