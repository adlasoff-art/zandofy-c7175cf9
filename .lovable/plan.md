
# Plan de changements — Zandofy

## Lot 1 — Titre de page d'accueil configurable par l'admin
- Connecter le champ `site_title` de la page SEO admin (`platform_settings.seo_config`) au composant `SEOHead` de la page d'accueil
- Le titre affiché dans l'onglet du navigateur sera celui défini par l'admin dans **Référencement (SEO) → Métadonnées globales → Titre du site**
- Appliquer aussi la meta description configurée

## Lot 2 — Section "Pour vous" intelligente
- Personnaliser les recommandations selon le profil utilisateur :
  - **Femme** → produits féminins prioritaires
  - **Homme** → produits masculins selon tranche d'âge
  - **Non renseigné** → mix équilibré (femmes, hommes, gadgets)
- Intégrer l'historique de navigation : produits cliqués/vus restent dans "Pour vous" tant qu'ils ne sont pas achetés
- Actualiser dynamiquement selon les interactions récentes
- Limiter à 8 produits (2 lignes de 4)

## Lot 3 — Top Tendances administrables
- Permettre à l'admin de sélectionner manuellement les 12 produits affichés en page d'accueil
- Rendre le titre "Top Tendances >" cliquable → redirige vers une page `/trends` dédiée
- Page `/trends` : afficher plus de produits tendances, filtrables par catégorie, gérés par l'admin

## Lot 4 — Section "Plus populaires" automatisée
- Auto-alimenter avec : 8 produits les plus vendus + 2 les plus mis en favoris + 2 les plus ajoutés au panier
- Créer une page dédiée `/popular` avec tous les produits triés du plus vendu au moins vendu
- Bouton "Voir plus" pour charger progressivement

## Lot 5 — Page Fournisseurs (Stores)
- Limiter l'affichage initial à 10 stores avec bouton "Voir plus"
- Indicateur de présence réel :
  - **Vert animé** = propriétaire ou collaborateur connecté ET toggle activé
  - **Gris statique** = personne connectée OU toggle désactivé
- Ajouter un toggle dans l'espace vendeur pour activer/désactiver la présence en ligne (activé par défaut)

## Lot 6 — Vérification suppression commandes
- Confirmer que la suppression admin cascade bien sur : order_items, order_status_history, deliveries, delivery_chats, notifications, vendor_transactions, point_transactions, statistiques (sales_count sur products et stores)

## Lot 7 — Profil utilisateur — adresse géographique
- Ajouter dans "Mon profil" les champs : pays, province, ville, commune, quartier
- Distinguer clairement "Adresse de résidence" (profil) vs "Adresses de livraison" (section dédiée)
- Renommer la section existante en "Adresses de livraison" pour clarifier

---

**Approche** : Traiter lot par lot, en commençant par le Lot 1 (le plus simple et immédiatement utile).
