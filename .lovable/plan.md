
# Polissage UX du checkout

Toutes les modifications sont front uniquement (présentation + petits comportements). Aucune logique métier, aucune migration.

## 1. Étape "Livraison" — Paiement des frais d'expédition
Fichier : `frontend/src/pages/CheckoutPage.tsx` (≈ ligne 1796).

- Remplacer le libellé « Payer à l'arrivée au Hub » par **« Payer à l'arrivée à l'agence du transitaire (hub) »**.
- Mettre à jour le sous-texte : « Régler {montant} à l'arrivée du colis à l'agence du transitaire (hub), avant la livraison ».
- L'option **« Payer maintenant »** reste sélectionnée par défaut (déjà le cas via `shippingPaymentChoice` initial — vérifier et le forcer si besoin).

## 2. Étape "Livraison" — Option de livraison (≈ ligne 1825)
- **Inverser l'ordre** : afficher d'abord **« 🏪 Retrait à l'agence (hub) »**, puis **« 🚚 Livraison à domicile »**.
- Sous-texte de l'option agence : « Récupérez votre colis au point de collecte, à l'agence du transitaire (gratuit) ».
- Mettre à jour les textes connexes qui parlent encore de « Retrait au Hub » :
  - bannière "zone non desservie" (≈ 1875),
  - bloc "Aucun livreur ne dessert…" (≈ 1887, 1891),
  - récap totaux ligne `hub_pickup` (≈ 1588) → afficher **« Retrait à l'agence (gratuit) »**.

## 3. Onglets Aérien / Maritime — notice "tarif indicatif"
Fichier : `frontend/src/components/CheckoutShippingCalculator.tsx` (≈ ligne 583-604).

- Ajouter, **juste après la rangée d'onglets de modes**, une petite notice info (icône `Info`, texte muted, marges aérées) :
  > « Les tarifs Aérien et Maritime affichés ici sont **indicatifs**, calculés sur le poids/CBM réel des produits sélectionnés. Le **tarif réel facturé** est celui défini par le transitaire que vous choisirez plus bas (section "Choisissez un transitaire"). »
- Ajouter un `mt-3` au bloc « 🚢 Maritime indisponible — seuil de fret non atteint » pour qu'il descende légèrement et laisse respirer la nouvelle notice.
- Renommer partout dans ce composant et dans les libellés `MODE_META` les occurrences de « Sea » restantes en **« Maritime »** (vérifier `freight.panel.mode.sea`, `shipping.mode.sea`, etc. dans `I18nContext.tsx` — déjà OK pour FR, juste s'assurer qu'aucun "Sea" anglais ne fuit dans l'UI FR).

## 4. FreightSelector — pré-sélection + radio + adresse cliquable mobile
Fichier : `frontend/src/components/checkout/FreightSelector.tsx`.

### 4a. Sélection par défaut du transitaire le moins cher
- Dans `useEffect` de chargement (ligne 156-159), au lieu de `setSelectedId(null)` + `onChange(null)`, **pré-sélectionner `cheapestSelectableId`** quand au moins une offre est éligible, et appeler `onChange(cheapestOffer, "split")`.
- Conserver la logique "Required" si jamais aucune offre sélectionnable.

### 4b. Radio button visible à gauche du logo
Dans `OfferCard` (Cas 2 et Cas 3) :
- Ajouter, **à gauche du logo**, un cercle radio identique à celui de l'option "Payer maintenant" :
  ```tsx
  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
    isSelected ? "border-primary" : "border-border"
  }`}>
    {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
  </div>
  ```
- Réajuster les `gap-` pour conserver la lisibilité.
- Conserver `BadgeCheck` ou le retirer s'il devient redondant (à garder pour cohérence visuelle, c'est ok).

### 4c. Adresse de récupération — accessible au tap (mobile)
- Remplacer le `Tooltip` actuel (qui ne s'ouvre qu'au hover) par un **`Popover`** Radix (`@/components/ui/popover`) avec le pin `MapPin` comme trigger.
- Le `PopoverTrigger` reste un bouton rond, **agrandi** : `h-6 w-6` (vs `h-4 w-4`), icône `MapPin size={12}`.
- `onClick={(e) => e.stopPropagation()}` pour ne pas re-sélectionner la carte involontairement.
- Le `Popover` s'ouvre au tap mobile **et** au clic desktop ; l'adresse reste affichée jusqu'au clic extérieur.

## 5. Récap totaux — terminologie expédition
Fichier : `frontend/src/pages/CheckoutPage.tsx` (≈ ligne 1558).

- Remplacer `{t("checkout.shipping")} ({shippingMode})` par un libellé qui mappe :
  - `air` → « Expédition (Aérien) »
  - `sea` → « Expédition (Maritime) »
  - autre → label depuis `MODE_META`.
- Ligne `hub_pickup` (1588) : utiliser **« Retrait à l'agence (gratuit) »** (cohérent avec point 2).

## 6. Étape "Paiement" — ordre des méthodes
Fichier : `frontend/src/pages/CheckoutPage.tsx` (≈ ligne 2004-2010).

- Réordonner le tableau de méthodes pour que **Mobile Money** soit **en première position**, puis **Carte bancaire**, puis PayPal, COD, off-platform.
- `paymentMethod` reste initialisé à `"mobile_money"` (déjà le cas ligne 121).
- Vérifier que la transition vers l'étape paiement scrolle bien en haut (déjà fait via `window.scrollTo({ top: 0 })` ligne 119).

## Hors-scope
- Aucune modification backend / RPC / migration.
- Aucun changement de logique pricing, eligibility, ni du moteur transitaires.
- Pas de retouche aux pages admin / vendeur.

## Vérifications de fin
- Build TS clean.
- Vue checkout mobile (375px) : radio + pin agrandi visibles, popover s'ouvre au tap.
- Vue desktop : popover s'ouvre au clic ; le hover précédent n'est plus requis.
- L'ordre des moyens de paiement affiche Mobile Money en premier, sélectionné.
