## Objectif

Sur **mobile/tablette uniquement** (`< lg`), à l'étape 2 du checkout (`step === "payment"`), remettre le bloc « Mode de paiement » EN PREMIER, et déplacer le récapitulatif complet (items + calculateur + totaux) en BAS. En plus, insérer une **mini-doublure des totaux** (sous-total, expédition, livraison, total + bandeau « Paiement 100% sécurisé ») juste entre le récap d'adresse d'expédition et la liste des moyens de paiement, pour que le client voie le montant à payer sans scroller.

Desktop (`≥ lg`) strictement inchangé. Aucun changement métier, aucune migration DB.

---

## Ordre mobile actuel (étape paiement)

```text
┌──────────────────────────────────────┐
│ [Récap commande complet]             │ ← items, promo, calculateur, points
│ [Récap totaux + sécurisé]            │ ← sous-total, frais, total
├──────────────────────────────────────┤
│ Mode de paiement (titre + retour)    │
│ Récap adresse expédition             │
│ Liste méthodes (Carte, MoMo, …)      │
│ Champs spécifiques + bouton Payer    │
└──────────────────────────────────────┘
```

## Nouvel ordre mobile (étape paiement)

```text
┌──────────────────────────────────────┐
│ Mode de paiement (titre + retour)    │
│ Récap adresse expédition             │
│ ⭐ MINI-TOTAUX (doublure)            │
│    • Sous-total                      │
│    • Frais d'expédition              │
│    • Livraison locale                │
│    • TOTAL                           │
│    • « Paiement 100% sécurisé »      │
│ Liste méthodes (Carte, MoMo, …)      │
│ Champs spécifiques + bouton Payer    │
├──────────────────────────────────────┤
│ [Récap commande complet]             │ ← inchangé, descend en bas
│ [Récap totaux + sécurisé]            │ ← inchangé, descend en bas
└──────────────────────────────────────┘
```

Desktop : sidebar sticky inchangée.

---

## Détails techniques

Fichier unique modifié : **`frontend/src/pages/CheckoutPage.tsx`**.

1. **Bloc actuel lignes 1951–1956** (`{!isDesktop && (<div>{renderSummaryTop()}{renderSummaryTotals()}</div>)}` placé en HAUT de la carte payment) → **déplacé tout en bas** de ce même `<div className="bg-card …">` (juste avant la balise fermante ligne ~2253, après le bouton Payer).

2. **Insertion d'une mini-doublure** entre le bloc « Shipping summary » (ligne 1968–1973) et `<div className="space-y-3">` (ligne 1975, début de la liste des méthodes). Cette doublure réutilise **exactement** `renderSummaryTotals()` (qui contient déjà sous-total, frais d'expédition, livraison, total et la bannière « Paiement sécurisé / données chiffrées »). Wrapper : `{!isDesktop && (<div className="pt-3 pb-2 border-t border-b border-border">{renderSummaryTotals()}</div>)}`.

3. **Aucune duplication d'état** : `renderSummaryTotals()` est une fonction pure du state — l'appeler deux fois en JSX est sans effet sur les setters/fetches. `CheckoutShippingCalculator` n'est pas dans `renderSummaryTotals` (il est dans `renderSummaryTop`), donc pas de risque de double instanciation.

4. **Desktop (`isDesktop === true`)** : tous les ajouts sont gardés par `!isDesktop` → 0 changement visuel sur la sidebar sticky.

5. **Étape 1 (`step === "shipping"`)** : aucun changement.

6. Pas de nouvelle clé i18n, pas de hook, pas de contexte, pas d'edge function, pas de migration.

---

## QA

- Mobile 375px, étape paiement : vérifier ordre exact (titre paiement → adresse → mini-totaux → méthodes → bouton Payer → récap complet en bas).
- Vérifier que le mini-bloc reflète bien le `total` courant (changement de méthode COD ↔ Card recompute).
- Vérifier qu'il n'y a qu'**un seul** `CheckoutShippingCalculator` monté.
- Desktop ≥1024px : capture sidebar identique à avant.
- Étape 1 (shipping) : aucun changement visuel.

## Hors scope

- Pas de touche au flux de validation / paiement.
- Pas de modification desktop.
- Pas de refonte des cartes ni des composants enfants.
