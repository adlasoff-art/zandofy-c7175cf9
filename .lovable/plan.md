

# Plan : Traductions manquantes + ajustements UX — par lots

## Portée identifiée

Le système i18n existe (`I18nContext.tsx`) avec ~380 clés FR et ~350 clés EN. Le problème : **des dizaines de composants contiennent du texte français hardcodé** au lieu d'utiliser `t("clé")`. De plus, une demande de fonctionnalité distincte (sélection de variantes par image) est incluse.

**Stratégie** : Travailler par lots pour ne rien casser. Chaque lot est testable indépendamment.

---

## Lot 1 — Page d'accueil + composants globaux (priorité haute)

### Fichiers concernés
| Composant | Textes hardcodés FR |
|-----------|-------------------|
| `FlashSales.tsx` | "Se termine dans" |
| `RecommendationsSection.tsx` | "Pour vous", "Produits populaires" |
| `ProductGrid.tsx` | "Les Plus Populaires" |
| `TopTrends.tsx` | "Top Tendances" |
| `CategoryBanner.tsx` | Noms de catégories (Électronique, Hauts, Bas, Robes, etc.) — ces labels viennent probablement de la DB |
| `Footer.tsx` | "Top Tendances", "Plus Populaires", "Tarification" hardcodés |
| `CartDrawer.tsx` | "Panier", "Connectez-vous pour voir votre panier", "Se connecter", "Votre panier est vide", "Continuer mes achats", "Tout sélectionner/désélectionner", "article(s) sélectionné(s)" |

### Actions
- Ajouter ~25 nouvelles clés i18n (FR + EN) dans `I18nContext.tsx`
- Remplacer les strings hardcodées par `t("clé")` dans chaque composant
- Pour les catégories venant de la DB : utiliser `name` (FR) vs `name_en` si la colonne existe, sinon afficher tel quel

---

## Lot 2 — Pages Sales, Category, Store + filtres/tri

### Fichiers concernés
| Composant | Textes hardcodés FR |
|-----------|-------------------|
| `CategoryPage.tsx` | "Filtres", "Plus récents", "Prix croissant", "Prix décroissant", "Mieux notés", "Réinitialiser" |
| `StorePage.tsx` | "Nouveautés", "Prix croissant", "Prix décroissant", "Populaires" |
| `StoresPage.tsx` | "Plus populaires", "Mieux notés", "Plus de ventes", "Plus d'abonnés", "Plus d'articles", "Plus récents" |
| Page Sales (si distincte) | "Solde", "produits", "Filtre", "Plus récent" |

### Actions
- Ajouter ~20 clés i18n pour filtres/tri (réutilisables entre pages)
- Remplacer dans chaque page

---

## Lot 3 — Page produit (Product Detail)

### Fichiers concernés
| Composant | Textes hardcodés FR |
|-----------|-------------------|
| `ProductReviews.tsx` | "Avis clients", "Donner mon avis", "Aucun avis", "Avec photo", "Plus récent", "Plus utile" |
| `ReviewForm.tsx` | "Donner mon avis" |
| `QuantitySelector.tsx` | "Quantité minimale", "pièce(s)" |
| `VendorProfileCard.tsx` | "En ligne", "Hors ligne", "Abonnés", "Vendus", "Articles" |
| `FollowStoreButton.tsx` | "Abonné !", "Désabonné" |
| `PrecisionShippingEstimate.tsx` | "Estimer les frais d'expédition", "Entrez votre ville" |
| Section poids/dimensions | "Poids", "Longueur", "Largeur", "Hauteur" |
| Section matière | "Matière" |
| Section taille/mensurations | "Taille et mensurations", "Le mannequin porte la taille" |
| Section fournisseur | "À propos du fournisseur", "Contactez", "Suivre", "Tous les articles" |
| `VariantOrderDrawer.tsx` | "Sélectionner une couleur", "Sélectionner les options", "Ajouter au panier", "pièce(s)" |

### Actions
- Ajouter ~40 clés i18n
- Remplacer dans chaque composant
- Produits multilingues : afficher `name_en` / `description_en` quand locale = "en" (si colonnes existantes)

---

## Lot 4 — Auth, Checkout, Help Center

### Fichiers concernés
| Composant | Textes hardcodés FR |
|-----------|-------------------|
| `AuthPage.tsx` | "Connexion sécurisée · Données chiffrées" (utiliser `t("checkout.securePayment")` qui existe déjà en EN), placeholder "vous@exemple.com" → "example@mail.com" |
| `CheckoutPage.tsx` | "Paiement 100% sécurisé · Données chiffrées" — déjà une clé `checkout.securePayment` mais pas utilisée |
| `HelpCenterPage.tsx` | "Centre d'aide", "Procédures", "Tickets support", "FAQ opérationnelle", supprimer "modifiables depuis le CMS", "Trouvez les procédures clés..." |

### Actions
- Ajouter ~15 clés i18n
- Corriger le texte "Questions fréquentes modifiables depuis le CMS" → "Questions fréquentes"
- Placeholder email : "example@mail.com" (neutre)

---

## Lot 5 — Réorganisation modes de paiement (product detail)

Dans la section "Paiement sécurisé" de la page produit, réordonner les badges :
1. Orange Money
2. Airtel Money  
3. M-PESA
4. Afric Money
5. Visa
6. Mastercard
7. PayPal
8. Google Pay
9. Apple Pay

---

## Lot 6 — Sélection variantes par image (REPORTÉ)

> **Recommandation** : Cette fonctionnalité (permettre au vendeur de choisir entre afficher des pastilles couleur ou des miniatures produit pour la sélection de variante) est une **fonctionnalité complexe** qui touche :
> - Le formulaire vendeur d'ajout de produit
> - La liaison image ↔ couleur/variante
> - L'affichage sur la page produit, le panier, le checkout, les commandes
>
> **Risque élevé** de régression en production. Je recommande de la planifier après stabilisation du lancement, dans un lot dédié avec tests complets.

---

## Contraintes techniques

- Le système i18n est **centralisé** dans `I18nContext.tsx` — toutes les nouvelles clés y sont ajoutées
- Les CMS overrides (`platform_settings.cms_texts`) permettent de modifier les textes sans redéployer
- Les noms de catégories viennent de la DB — si pas de colonne `name_en`, on affiche le nom FR (pas de casse)
- Accents dans les slugs/catégories : vérifier si c'est un problème de validation côté formulaire vendeur (pas d'action immédiate pour ne rien casser)

## Ordre d'exécution

Lot 1 → Lot 2 → Lot 3 → Lot 4 → Lot 5 → (Lot 6 reporté)

Chaque lot est un commit indépendant, testable, et réversible.

