
# Plan d'implémentation — Lots pré-lancement (8-12 avril)

## Lot 1 — Vendeur Autonome & Webhook API
- Bloquer l'activation du mode autonome pour les boutiques `is_platform_owned = true`
- Quand une boutique quitte le mode plateforme → attribution automatique du package "Beginner"
- Configuration paiement par défaut : **off_platform = ON**, **custom_numbers = ON**, Mobile Money/Carte/COD = **OFF**
- Webhook API : transformer en système de **demande/approbation** (table `webhook_api_requests`) au lieu du self-service actuel
- Le vendeur remplit l'URL dans sa demande → admin valide → URL pré-remplie mais inactive tant que non approuvée

## Lot 2 — Profil géographique (combo boxes)
- Remplacer les champs texte libres (Pays, Province, Ville, Commune, Quartier) par des **combo boxes chaînées** alimentées depuis les tables géographiques existantes (`cities`, `provinces`, `communes`)
- Seul le champ "Adresse de résidence" (avenue, numéro, appartement) reste en saisie libre
- Verrouillage de l'adresse de résidence si commandes en cours → nécessite une demande de modification
- Adresses de livraison modifiables seulement si aucune commande en cours
- L'adresse par défaut ne peut pas être supprimée (modifiable uniquement)

## Lot 3 — Canal de contact & Mot de passe
- Canal de contact préféré → **multi-sélection** : Chat interne (obligatoire), Email (obligatoire), WhatsApp (optionnel), SMS (optionnel)
- Modification de mot de passe → exiger le **mot de passe actuel** + nouveau + confirmation

## Lot 4 — Présence boutique (voyants en ligne)
- Corriger le système de présence pour refléter la **connexion réelle** du propriétaire OU d'un collaborateur actif
- Voyant vert animé = au moins un membre connecté + `presence_visible = true`
- Voyant gris = personne connecté ou masqué
- Appliquer partout : page Stores, cartes boutique, chat, profil boutique

## Lot 5 — Articles similaires
- Filtrer par **sous-catégorie** du produit actuel, puis catégorie parente en repli
- Afficher 6 produits max
- Ajouter le **nombre de ventes** à côté du prix dans les cartes produit de cette section

## Lot 6 — Restrictions géographiques (Checkout & Inscription)
- Inscription : détecter le pays sélectionné → si non actif, bloquer avec message + option "notifiez-moi" (email envoyé à notification@zandofy.com)
- Profil & Adresses : n'afficher que les **pays actifs** et **villes actives** dans les sélecteurs
- Checkout : idem, seuls pays/villes actifs disponibles
- Message d'indisponibilité si ville non éligible

## Lot 7 — Variations produit
- Afficher **toutes** les variations (pointures, volumes, écrans, etc.) dans la modération admin
- Permettre aux vendeurs d'ajouter des **valeurs personnalisées** pour chaque type de variation (au-delà des options admin par défaut)
- Les options par défaut de l'admin ne sont pas supprimables par le vendeur

## Lot 8 — Branding emails & Notifications commandes
- Section admin pour uploader le **logo PNG** de l'entreprise (avec taille recommandée)
- Section admin pour la **signature email** (adresse, contact, etc.)
- Intégrer logo + signature dans **tous** les emails transactionnels
- Email de confirmation de commande détaillé (articles, frais, total, n° commande)
- Email envoyé aussi lors de la validation d'un paiement hors plateforme

---

**Rappel** : Audit complet prévu après tous les lots, avant le 12 avril.
