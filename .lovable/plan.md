

## Plan : Seuil minimum de commande pour le mode Maritime

### Contexte du problème

Actuellement, le mode maritime est proposé même pour des commandes très petites (1 pièce à $0.55 de fret), ce qui est commercialement absurde. Le maritime est pertinent uniquement pour des volumes/montants significatifs.

### Approche

Ajouter un **seuil minimum de sous-total panier** (configurable par l'admin, défaut : $29) en dessous duquel le bouton Maritime n'apparaît pas dans le sélecteur de mode au checkout. Le client voit un petit message explicatif s'il n'atteint pas le seuil.

### Changements

**1. Paramètre admin (`platform_settings`)**

Ajouter une clé `sea_mode_min_order` dans `platform_settings` (JSONB) avec valeur par défaut `{ "enabled": true, "min_subtotal": 29 }`. Pas de migration nécessaire — c'est un simple `INSERT ... ON CONFLICT DO NOTHING` dans le code ou via seed.

**2. `AdminShippingPage.tsx`** — Section paramètres

Ajouter un bloc dans la page Shipping admin :
- Toggle « Seuil minimum pour le Maritime »
- Input numérique « Montant minimum ($) » (défaut 29)
- Auto-save dans `platform_settings` clé `sea_mode_min_order`

**3. `CheckoutShippingCalculator.tsx`** — Filtrage du mode maritime

- Recevoir le sous-total du panier via une nouvelle prop `cartSubtotal: number`
- Charger le paramètre `sea_mode_min_order` depuis `platform_settings`
- Dans le rendu des boutons de mode (ligne 304), si `mode === "sea"` et `cartSubtotal < min_subtotal`, ne pas afficher le bouton
- Afficher un petit texte informatif sous les boutons : « 🚢 Maritime disponible à partir de $29 de commande » si le seuil n'est pas atteint mais que des quotes maritime existent

**4. `CheckoutPage.tsx`** — Passer le sous-total

- Calculer le sous-total du panier (déjà disponible dans la variable `subtotal`)
- Passer `cartSubtotal={subtotal}` au composant `CheckoutShippingCalculator`

### Détails techniques

- Le paramètre est lu une seule fois au mount du composant via `supabase.from("platform_settings").select("value").eq("key", "sea_mode_min_order").maybeSingle()`
- Si le paramètre n'existe pas ou `enabled === false`, aucun filtrage n'est appliqué (rétrocompatible)
- Si l'utilisateur avait sélectionné `sea` et que le sous-total descend sous le seuil (ex: retrait d'un produit), le mode bascule automatiquement vers `air`

