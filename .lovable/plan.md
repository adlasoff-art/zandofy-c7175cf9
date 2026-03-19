

# Plan : Guides d'utilisation Markdown (3 fichiers)

## Objectif
Générer 3 fichiers Markdown complets dans `/mnt/documents/` couvrant toutes les fonctionnalités implémentées, destinés aux 3 profils d'utilisateurs.

## Fichiers à créer

### 1. `guide-vendeur.md` — Guide Vendeur
- **Inscription & Onboarding** : Créer un compte, postuler comme vendeur (BecomeVendorPage — formulaire multi-étapes : infos perso, boutique, documents KYB)
- **Tableau de bord vendeur** (`/vendor`) : Navigation par onglets (catalogue, commandes, livraisons, promos, coupons, wallet, retours, litiges, featured, stats, équipe, paramètres)
- **Gestion du catalogue** : Ajouter/modifier un produit, variantes (tailles, couleurs), images, statuts de publication (brouillon → en attente → publié/refusé), limites par abonnement
- **Système de tarification intelligent** : Coût d'achat réel vs calcul, calcul automatique prix de vente + ancien prix, marge vendeur (si activée par admin), désactiver le calcul auto
- **Abonnements** : Beginner (10 produits), Pro (100), Grand Supplier (illimité)
- **Gestion des commandes** : Statuts (reçue → confirmée → préparation → expédition → livrée), tracking, numéros Zandofy/fournisseur
- **Promotions & Coupons** : Créer des promos, coupons de réduction, analytics coupons
- **Wallet & Retraits** : Solde en attente (30j rétention), solde disponible, demandes de retrait
- **Retours & Litiges** : Gestion côté vendeur
- **Messagerie** : Chat modéré avec clients
- **Équipe** : Collaborateurs (selon tier)
- **Self-delivery** : Livraison autonome, suivi livreur
- **Mises en avant** : Demander un placement featured

### 2. `guide-client.md` — Guide Client
- **Inscription & Connexion** : Email/mot de passe, Google OAuth, réinitialisation, rate-limiting
- **Navigation** : Recherche prédictive, méga-menu, catégories, filtres, tri
- **Fiche produit** : Variantes, estimateur livraison, avis, boutique
- **Panier & Checkout** : Adresses sauvegardées, calcul frais de port, coupons (global + boutique), modes de paiement (Stripe, Mobile Money, COD), paiement expédition différé, livraison last-mile (en ligne ou cash au livreur)
- **Dashboard client** (`/dashboard`) : Onglets (aperçu, commandes, suivi, retours, litiges, parrainage, affiliation, notifications, messages, profil, vérification KYC, adresses)
- **Suivi de commande** : Stepper visuel, tracking en temps réel, preuve de livraison
- **Retours** : Formulaire de demande de retour
- **Litiges** : Ouverture et suivi de litiges
- **Programme de fidélité** : Tiers (Bronze → Diamant), remises progressives
- **Programme d'affiliation** : Code de parrainage, commission, tiers d'affiliation
- **KYC** : Soumission de documents, statut de vérification
- **Wishlist, Notifications, Messages**

### 3. `guide-administrateur.md` — Guide Administrateur
- **Tableau de bord** (`/admin`) : KPIs temps réel (utilisateurs, commandes, revenus, par statut), graphiques, commandes récentes
- **Gestion des utilisateurs** : Liste, détails, rôles (admin, manager, vendor, shipper, rider)
- **CMS** : Bannières hero, bannières positionnables, pages statiques (FAQ, CGV, Confidentialité, À propos), menus, sections homepage, pied de page, palette couleurs, textes bilingues
- **Catégories & Types de variations** : Arborescence catégories, types de variantes personnalisées
- **Modération produits** : Approuver, refuser (avec raisons), demander révision
- **KYC** : Valider/refuser les documents vendeurs et clients
- **Commandes** : Vue admin complète, historique statuts
- **Support client** : Gestion des tickets
- **Logistique** : Gestion des expéditions, livreurs
- **Tarification fret** : Configuration des frais d'expédition
- **Demandes vendeur** : Approuver/refuser les candidatures
- **Noms de boutique** : Modération des changements de nom
- **Abonnements vendeur** : Gestion des tiers et limites
- **Tarification par boutique** (`/admin/vendor-pricing`) : Marge %, multiplicateur, marge vendeur max, toggle marge vendeur par boutique
- **Tarification intelligente** (dans Paramètres) : Défauts globaux (margin_pct, multiplier, seuils marge parallèle)
- **Fidélité** : Configuration des tiers clients
- **Audit Points** : Suivi des transactions de points
- **Coupons** : Coupons globaux plateforme
- **Retraits** : Validation des demandes de retrait vendeur
- **Retours & Litiges** : Arbitrage admin
- **Taux de change** : Configuration multi-devises
- **Paliers affiliation** : Configuration des tiers et commissions
- **SEO** : Métadonnées par page
- **Pays actifs** : Activation/désactivation des pays
- **Popups & Cookies** : Annonces, consentement cookies
- **Journal d'audit** : Historique des actions admin
- **Notifications** : Diffusion de notifications
- **Paramètres** : Tracking provider, livraison gratuite, parrainage, maintenance, moyens de paiement, durée "nouveau produit"
- **Analytics** : Analyse comportementale
- **Templates Email** : Personnalisation des emails
- **Mises en avant** : Gestion des placements featured

## Approche d'exécution

Par itération comme demandé :
1. **Itération 1** : `guide-vendeur.md`
2. **Itération 2** : `guide-client.md`
3. **Itération 3** : `guide-administrateur.md`

Chaque guide suivra une structure cohérente : introduction, table des matières, puis chaque fonctionnalité avec description, étapes concrètes et captures d'écran textuelles (descriptions des éléments UI). Les guides seront livrés en français et en `.md` dans `/mnt/documents/`.

