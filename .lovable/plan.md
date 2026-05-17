## Objectif

Sur **mobile + tablette uniquement** (`< lg`, soit < 1024px), réorganiser l'ordre d'affichage des sections de la page Checkout pour éviter les va-et-vient. **La version desktop (`≥ lg`) reste strictement identique** : colonne gauche + sidebar récap à droite, aucune modification visuelle ni logique.

Aucun changement métier, aucun changement de flux de paiement, aucune migration DB, aucun edge function. Pur réagencement responsive dans `frontend/src/pages/CheckoutPage.tsx`.

---

## Problème actuel (mobile)

Aujourd'hui la grille `grid lg:grid-cols-5` empile sur mobile dans cet ordre :

```
[Adresses enregistrées / Formulaire adresse]
[Paiement des frais d'expédition (payer maintenant / à l'arrivée)]
[Option de livraison (domicile / hub) + sélecteur opérateur]
[Bouton "Continuer vers le paiement"]
[Récapitulatif commande]            ← contient le choix transitaire !
  ├─ Items
  ├─ Code promo
  ├─ Calculateur shipping + CHOIX TRANSITAIRE
  ├─ ZandoPoints
  └─ Sous-total / frais / Total
```

Le client doit donc **scroller tout en bas** pour choisir le transitaire, **remonter** pour choisir « payer maintenant / à l'arrivée », **remonter encore** pour cocher domicile/hub, puis redescendre cliquer « Continuer ». Même chose à l'étape paiement : le récap est en-dessous des moyens de paiement.

---

## Nouvel ordre demandé (mobile/tablette)

### Étape 1 — Livraison (`step === "shipping"`)

```
1. Adresses enregistrées / Formulaire adresse
2. Récapitulatif commande (haut)
   ├─ Items (×N)
   ├─ Code promo
   ├─ Calculateur shipping (aérien/maritime) + CHOIX TRANSITAIRE
   └─ ZandoPoints
3. Paiement des frais d'expédition (payer maintenant / à l'arrivée au Hub)
4. Option de livraison (domicile / retrait Hub) + sélecteur opérateur
5. Récapitulatif totaux (bas)
   ├─ Sous-total
   ├─ Réductions (promo, fidélité, points)
   ├─ Frais d'expédition
   ├─ Livraison locale
   └─ TOTAL
6. Bouton "Continuer vers le paiement"
```

### Étape 2 — Paiement (`step === "payment"`)

```
1. Récapitulatif commande (haut)  — items + promo + calculateur + points
2. Récapitulatif totaux (bas) — sous-total + Total
3. Mode de paiement
   ├─ Bloc "Livraison à : adresse"
   ├─ Liste des méthodes (Carte, PayPal, Mobile Money, COD, hors plateforme)
   └─ Champs spécifiques + bouton Payer
```

### Desktop (`≥ lg`) — INCHANGÉ

Colonne gauche : adresse → shipping payment → delivery option → bouton.
Sidebar droite sticky : récap complet (items + calculateur + totaux). Identique à aujourd'hui.

---

## Illustration ASCII

```text
─────────────── MOBILE (avant) ───────────────   ─────────────── MOBILE (après) ───────────────
┌───────────────────────────┐                    ┌───────────────────────────┐
│ Adresse enregistrée       │                    │ Adresse enregistrée       │
├───────────────────────────┤                    ├───────────────────────────┤
│ Paiement frais expédition │ ← pas de montant   │ Récap commande (haut)     │
│  ○ Payer maintenant       │   sans transitaire │  • Items                  │
│  ○ Payer à l'arrivée      │                    │  • Code promo             │
├───────────────────────────┤                    │  • Aérien / Maritime      │
│ Option de livraison       │                    │  • CHOIX TRANSITAIRE  ⭐  │
│  ○ Livraison à domicile   │                    │  • ZandoPoints            │
│  ○ Retrait Hub            │                    ├───────────────────────────┤
├───────────────────────────┤                    │ Paiement frais expédition │ ← montant exact
│ [Continuer vers paiement] │ ← clic trop tôt    │  ○ Payer maintenant       │
├───────────────────────────┤                    │  ○ Payer à l'arrivée      │
│ Récap commande            │                    ├───────────────────────────┤
│  • Items                  │                    │ Option de livraison       │
│  • Code promo             │                    │  ○ Domicile (+ opérateur) │
│  • CHOIX TRANSITAIRE  ⭐  │ ← découvert tard  │  ○ Retrait Hub            │
│  • ZandoPoints            │                    ├───────────────────────────┤
│  • Sous-total / TOTAL     │                    │ Récap totaux (bas)        │
└───────────────────────────┘                    │  Sous-total ... TOTAL     │
                                                  ├───────────────────────────┤
                                                  │ [Continuer vers paiement] │
                                                  └───────────────────────────┘

─────────────── DESKTOP (inchangé) ───────────────
┌─────────────────────────────┬───────────────────────────┐
│ Adresse                     │ Récap commande (sticky)   │
│ Paiement frais expédition   │  Items                    │
│ Option de livraison         │  Code promo               │
│ [Continuer vers paiement]   │  Calculateur + transitaire│
│                             │  Sous-total / TOTAL       │
└─────────────────────────────┴───────────────────────────┘
```

---

## Détails techniques (pour l'agent / Cursor)

Fichier unique modifié : **`frontend/src/pages/CheckoutPage.tsx`** (aucun autre fichier).

1. **Extraire 2 sous-blocs JSX** déjà présents dans la sidebar actuelle (lignes ~2055–2244) en fonctions locales internes au composant (pas de nouveaux fichiers, pour minimiser le diff) :
   - `renderSummaryTop()` → titre, items, code promo, `CheckoutShippingCalculator` (qui porte le choix transitaire), ZandoPoints, notice de plafond de réductions.
   - `renderSummaryTotals()` → bloc sous-total / réductions / shipping / livraison locale / Total + bandeau « Paiement sécurisé ».

2. **Sidebar desktop** (`lg:col-span-2`) : devient `hidden lg:block`. Contient `renderSummaryTop()` + `renderSummaryTotals()` exactement comme aujourd'hui (sticky, même styles).

3. **Colonne principale, étape `shipping`** : insérer, **uniquement en mobile (`lg:hidden`)**, dans cet ordre :
   - juste après le bloc adresses/formulaire → `renderSummaryTop()` dans une `Card` identique (`bg-card rounded-lg p-5 shadow-card space-y-4`).
   - le bloc "Paiement des frais d'expédition" et "Option de livraison" restent à leur place actuelle.
   - juste avant le `<Button type="submit">Continuer vers le paiement` → `renderSummaryTotals()`.

4. **Colonne principale, étape `payment`** : insérer en haut du bloc, **uniquement en mobile (`lg:hidden`)** :
   - `renderSummaryTop()` puis `renderSummaryTotals()` AVANT le titre "Mode de paiement".

5. **Pas de duplication d'état** : les deux rendus pointent vers les mêmes setters/handlers (`appliedCoupon`, `handleApplyCoupon`, `handleForwarderChange`, `setUsePoints`, etc.). Le `CheckoutShippingCalculator` n'est instancié **qu'une seule fois** par viewport grâce au `hidden lg:block` / `lg:hidden` mutuellement exclusifs → pas de double fetch des offres transitaires.

6. **Breakpoint** : `lg` (1024px). Comme `useIsMobile` est à 768px, on n'utilise pas ce hook pour éviter un seuil divergent ; on reste en pur CSS Tailwind responsive. Tablettes < 1024px bénéficient donc du nouvel ordre (cohérent avec le besoin exprimé).

7. **Sticky** : seul le récap desktop reste `sticky top-24`. Les blocs mobile ne sont pas sticky (sinon problème d'empilement).

8. **Aucune modification** des conditions de validation (`handleProceedToPayment`), du calcul de `total`, du flux paiement, du choix transitaire, des règles RLS, des migrations, des Edge Functions, des memories.

9. **i18n** : aucune nouvelle clé `t(...)` nécessaire, tout est déjà traduit.

10. **QA après implémentation** :
    - Mobile (375px) : vérifier ordre exact des sections étapes 1 & 2, vérifier que le choix transitaire met bien à jour le montant affiché juste en-dessous, que le bouton « Continuer » apparaît bien tout en bas après le Total.
    - Tablette (820px) : même comportement mobile attendu.
    - Desktop (≥1024px) : strictement identique à aujourd'hui (capture avant/après sidebar).
    - Vérifier qu'il n'y a **qu'un seul** `CheckoutShippingCalculator` monté (devtools React) pour ne pas dupliquer les requêtes.

---

## Hors scope (explicite)

- Pas de refonte visuelle des cartes.
- Pas de changement desktop.
- Pas de changement du parcours étape 2 → 3 (confirmation).
- Pas de touche aux composants `ForwarderSelector`, `OperatorSelector`, `CheckoutShippingCalculator`.
- Pas de nouveau hook, pas de nouveau contexte.
