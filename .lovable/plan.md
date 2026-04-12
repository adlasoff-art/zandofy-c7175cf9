

# Plan : Corrections du mode sombre + vérification traductions

## Problèmes identifiés

Le site utilise les CSS variables Tailwind (`bg-card`, `text-foreground`, etc.) qui sont correctement définis dans `.dark` dans `index.css`. Cependant, plusieurs zones ont des problèmes de contraste ou de couleur en mode sombre :

---

## Lot A — Corrections couleurs mode sombre

### 1. ProductCard.tsx — Badge origine pays
- Le badge `originCountry` utilise `bg-muted text-muted-foreground` — peu visible en dark
- **Fix** : Remplacer par `bg-primary/15 text-primary` pour le point rond et le texte pays, rendant visible sur fond sombre

### 2. ProductCard.tsx — Icônes favori et comparaison
- Les boutons utilisent `bg-card/80` et `text-foreground` — peu visibles en dark
- **Fix** : Ajouter `dark:bg-card dark:text-primary/80` pour les rendre plus lumineux

### 3. FlashSales.tsx — Countdown et texte "Se termine dans"
- Le countdown utilise `bg-foreground text-card` — inversé correctement via variables, mais le texte "Se termine dans" est `text-muted-foreground` qui est trop sombre en dark mode
- **Fix** : Changer en `text-sale` pour harmoniser avec l'icône Clock

### 4. ProductGrid.tsx — Section bg-muted/30
- La section Tendances utilise `bg-muted/30` — trop léger en dark mode, apparaît presque noir sur noir
- **Fix** : Changer en `bg-muted/40 dark:bg-muted/20` pour un contraste subtil

### 5. ProductGrid.tsx — Onglets tendances
- L'onglet non sélectionné utilise `bg-card text-foreground border-border` — peut apparaître blanc sur fond sombre
- **Fix** : Pas de problème réel, `bg-card` est `120 20% 9%` en dark. Les tabs devraient fonctionner. Vérifier visuellement.

### 6. CategoryBanner.tsx — Noms de catégories
- Les textes utilisent `text-foreground` qui est `120 10% 90%` en dark — devrait être OK
- Le texte "Voir tout" et "Réduire" utilise `text-muted-foreground` — pourrait être trop sombre
- **Fix** : Ajouter `dark:text-muted-foreground/80` ou laisser tel quel (le `--muted-foreground` dark est `120 10% 60%`)

### 7. MegaMenu.tsx — Fond et textes
- Utilise `bg-card` — en dark c'est `120 20% 9%`, correct
- L'élément actif `bg-primary/10 text-primary` — OK en dark
- Le lien "Tout voir" `text-primary` — OK
- **Pas de changement nécessaire** pour le mega menu

### 8. HeroBanner.tsx — Textes sur la bannière
- Les textes utilisent `text-card` sur un overlay `bg-foreground/50` — en dark, `foreground` est clair et `card` est sombre, ce qui **inverse** le rendu !
- **Fix critique** : Les textes du titre/sous-titre doivent rester blancs : remplacer `text-card` par `text-white` et `bg-foreground/50` par `bg-black/50`
- Le CTA `bg-card text-foreground` doit devenir `bg-white text-gray-900` ou utiliser des couleurs fixes

### 9. HeroBanner.tsx — Boutons navigation carousel
- `bg-card/80` et `text-foreground` — même inversion en dark
- **Fix** : Utiliser `bg-white/80 text-gray-900 dark:bg-white/80 dark:text-gray-900` pour les garder fixes

### 10. Footer.tsx — Adaptation dark mode
- Le footer utilise `useFooterTheme()` avec des styles inline — déjà configurable via admin
- Si les couleurs admin ne sont pas définies, il retombe sur les CSS variables qui fonctionnent en dark
- **Fix minimal** : S'assurer que le fallback `text-foreground` et `bg-card` sont utilisés quand pas de config admin

### 11. FlashSales.tsx — "Super Promos" texte couleur
- Le titre "Super Promos" / flash sales est en `text-foreground` — en dark, c'est clair, OK
- Le `text-sale` pour l'icône flamme est rouge — visible en dark

### 12. ProductCard.tsx — Prix et texte produit
- `text-foreground` pour le prix = `120 10% 90%` en dark — OK, mais pourrait être légèrement plus lumineux
- **Fix optionnel** : Ajouter `dark:text-primary` sur le prix pour le rendre vert clair en dark

---

## Lot B — Vérification traductions (Lots 1-5 précédents)

Vérifier dans chaque fichier modifié que `t("key")` est bien appelé et que les clés existent en FR et EN dans `I18nContext.tsx`.

### Fichiers à vérifier :
| Composant | Clés ajoutées |
|-----------|--------------|
| FlashSales.tsx | `home.flashSales`, `home.endsIn` |
| TopTrends.tsx | `home.topTrends` |
| ProductGrid.tsx | `home.mostPopular`, `home.trends`, `home.all` |
| Footer.tsx | `footer.topTrends`, `footer.mostPopular`, `footer.pricing` |
| CartDrawer.tsx | `cart.title`, `cart.loginPrompt`, `cart.login`, `cart.empty`, etc. |
| CategoryPage.tsx | Filtres/tri traduits |
| ProductReviews.tsx | Avis traduits |
| AuthPage.tsx | Placeholder email neutre |
| ProductPage.tsx | Badges paiement réordonnés |

---

## Résumé des fichiers modifiés

| Fichier | Changements |
|---------|------------|
| `frontend/src/components/ProductCard.tsx` | Dark mode : badge origine, icônes favori/compare plus visibles, prix en `dark:text-primary` |
| `frontend/src/components/FlashSales.tsx` | "Se termine dans" en `text-sale` au lieu de `text-muted-foreground` |
| `frontend/src/components/HeroBanner.tsx` | Textes bannière en `text-white` fixe, overlay en `bg-black/50`, CTA et boutons navigation en couleurs fixes |
| `frontend/src/components/ProductGrid.tsx` | Fond section ajusté pour dark mode |
| `frontend/src/components/CategoryBanner.tsx` | Texte "Voir tout" plus visible en dark |

Aucune migration SQL nécessaire. Aucun risque de régression — les couleurs light mode ne sont pas modifiées.

