

# Plan d'implémentation — Fonctionnalités Zandofy (Phase avancée)

Ce plan couvre 15 fonctionnalités regroupées en 5 lots. Les lots sont ordonnés par priorité et dépendances.

---

## Lot 1 — Livraison & Rider (priorité haute)

### 1.1 Chat éphémère livreur-client
Messagerie temporaire liée à une livraison active, détruite 24h après livraison. Aucun numéro de téléphone exposé.

- **Migration SQL** : table `delivery_chats` (delivery_id, sender_id, message, created_at) avec TTL. RLS : seuls rider et client de la commande peuvent lire/écrire. Realtime activé.
- **Frontend** : composant `DeliveryChat.tsx` intégré dans l'onglet Carte du rider + dans la page Tracking du client. Bulle de chat flottante.

### 1.2 Photo obligatoire du client avec colis
Le livreur doit prendre une photo du client tenant le colis pour confirmer la livraison.

- **Migration SQL** : colonne `proof_photo_url` sur `deliveries` (déjà partiellement géré dans le code, on s'assure que c'est obligatoire).
- **Frontend** : rendre `PhotoCapture` obligatoire dans le modal de confirmation (bloquer le bouton "Confirmer livré" si pas de photo). Stocker dans le bucket `delivery-proofs`.

### 1.3 Notation du livreur (étoiles + commentaire)
Après livraison, le client peut noter le livreur (1-5 étoiles + commentaire optionnel).

- **Migration SQL** : table `rider_ratings` (id, delivery_id, order_id, rider_id, user_id, rating 1-5, comment, created_at). RLS : le client crée, tout le monde lit. Trigger de validation rating 1-5.
- **Frontend** : modal de notation affiché automatiquement quand une commande passe à "delivered" (côté client). Affichage note moyenne dans l'onglet Profil du rider.

### 1.4 Photo de profil du livreur visible par le client
Le client voit la photo et le nom du livreur assigné.

- **Frontend** : dans la page Tracking, afficher les infos du livreur (photo de profil depuis `profiles.avatar_url`, prénom) dans un bandeau "Votre livreur". Requête sur `profiles` via `assigned_rider_id`.

### 1.5 Optimisation d'itinéraire multi-stops
Quand le rider a plusieurs livraisons, ordonnancement intelligent par proximité.

- **Frontend** : dans l'onglet "Ma route", trier les livraisons pendantes par distance haversine depuis la position actuelle du rider. Bouton "Optimiser l'itinéraire" qui réordonne la liste. Utilise la fonction `haversineKm` existante dans `DeliveryMap.tsx`.

### 1.6 Tableau de bord livreur enrichi
Graphiques de performance, revenus hebdomadaires, classement.

- **Frontend** : refonte de l'onglet "Profil" du rider → graphiques (revenus par semaine via Recharts), taux de livraison à l'heure, note moyenne, nombre total de livraisons. Données calculées côté client à partir des deliveries + rider_ratings.

### 1.7 Vue admin de tous les livreurs sur la carte
L'admin voit en temps réel tous les riders sur une carte unique.

- **Frontend** : nouvelle section dans `AdminLogisticsPage.tsx` → carte Leaflet avec tous les marqueurs de `rider_locations`. Clic sur un rider = voir ses livraisons en cours. Utilise le realtime existant sur `rider_locations`.

### 1.8 Système de pourboire (désactivé par défaut)
Le client peut laisser un tip après livraison. Activable par l'admin.

- **Migration SQL** : colonne `tip_amount numeric default 0` sur `orders`. Clé `tipping_settings` dans `platform_settings` (`{"enabled": false, "max_amount": 20}`).
- **Frontend** : dans le modal de notation post-livraison, section pourboire (choix rapide $1/$2/$5 ou montant libre). Conditionné par `platform_settings.tipping_settings.enabled`.
- **Admin** : toggle dans `AdminSettingsPage.tsx` section "Pourboire".
- **Emplacement admin** : `AdminSettingsPage.tsx` → nouvelle section "Pourboire".

---

## Lot 2 — Tarification & Zones (priorité haute)

### 2.1 Zones de livraison avec tarification dynamique
Prix variable par quartier/commune, géré par l'admin et optionnellement par les vendeurs (self-delivery).

- **Migration SQL** : table `delivery_zones` (id, name, city, country, price, is_active, created_by_admin bool). La table `vendor_delivery_zones` existe déjà.
- **Frontend admin** : page de gestion des zones dans `AdminShippingPage.tsx` ou `AdminLogisticsPage.tsx`. CRUD zones + prix.
- **Frontend vendeur** : dans le dashboard vendeur, onglet existant pour les zones de livraison (utilise `vendor_delivery_zones` existant).
- **Checkout** : le calcul du frais de livraison utilise la zone du client (basée sur la ville/quartier) au lieu d'un montant forfaitaire.
- **Emplacement admin** : `AdminShippingPage.tsx` → section "Zones de livraison dernier kilomètre".

---

## Lot 3 — Monétisation (désactivables par défaut)

### 3.1 Abonnement premium client (désactivé par défaut)
Livraison gratuite illimitée moyennant forfait mensuel.

- **Migration SQL** : table `premium_subscriptions` (id, user_id, plan_name, price, start_date, end_date, is_active). Clé `premium_settings` dans `platform_settings` (`{"enabled": false, "monthly_price": 9.99, "plan_name": "Zandofy Premium"}`).
- **Frontend** : page `/premium` affichée uniquement si activé. Badge "Premium" sur le profil. Au checkout, frais de livraison = 0 si abonné actif.
- **Admin** : toggle + config prix dans `AdminSettingsPage.tsx`.
- **Emplacement admin** : `AdminSettingsPage.tsx` → nouvelle section "Abonnement Premium".

### 3.2 Programme vendeur Boost (désactivé par défaut)
Le vendeur paye pour apparaître en tête des résultats.

- **Migration SQL** : table `vendor_boosts` (id, store_id, start_date, end_date, amount_paid, is_active). Clé `boost_settings` dans `platform_settings` (`{"enabled": false, "daily_price": 5, "max_days": 30}`).
- **Frontend vendeur** : bouton "Booster ma boutique" dans le dashboard vendeur (conditionné par `boost_settings.enabled`).
- **Frontend catalogue** : les produits de boutiques boostées apparaissent en premier (tri par `vendor_boosts.is_active`).
- **Admin** : toggle + prix dans `AdminSettingsPage.tsx`.
- **Emplacement admin** : `AdminSettingsPage.tsx` → nouvelle section "Boost Vendeur".

### 3.3 Wallet vendeur — demande de retrait (sans paiement auto)
Le vendeur fait une demande de retrait. L'admin traite manuellement hors plateforme.

- **Existant** : `vendor_wallets` et `vendor_transactions` existent déjà, ainsi que `VendorWalletTab.tsx` et `AdminWithdrawalsPage.tsx`.
- **À ajouter** : s'assurer que le bouton "Demander un retrait" fonctionne bien, que la demande crée une entrée de type `withdrawal_request` dans `vendor_transactions`, et que l'admin peut changer le statut (pending → processed → paid) dans `AdminWithdrawalsPage.tsx`.

---

## Lot 4 — Expérience client

### 4.1 Wishlist partageable
Lien de liste de souhaits à envoyer (cadeau).

- **Frontend** : bouton "Partager ma liste" dans `WishlistPage.tsx` → génère un lien `/wishlist/shared/{userId}`. Page publique qui affiche les produits sans prix d'achat, avec bouton "Offrir" (ajoute au panier du visiteur).
- **Pas de migration** : utilise la table `wishlists` existante + route publique.

### 4.2 Estimation de livraison dynamique
Calcul basé sur la distance réelle (haversine) + facteur de trafic configurable.

- **Frontend** : enrichir `DynamicShippingCalculator.tsx` pour utiliser `haversine_distance` (fonction SQL existante) entre le hub/vendeur et l'adresse client. Afficher un ETA plus précis au checkout.
- **Admin** : facteur multiplicateur de trafic dans `AdminSettingsPage.tsx` (ex: 1.3 pour heures de pointe).
- **Emplacement admin** : `AdminSettingsPage.tsx` → section "Estimation livraison".

---

## Lot 5 — Technique & PWA

### 5.1 Coupons géo-ciblés (désactivé par défaut)
Promotions par ville/quartier.

- **Migration SQL** : colonnes `target_city text`, `target_country text` sur la table `coupons` existante. Clé `geo_coupons_enabled` dans `platform_settings` (`false`).
- **Frontend** : au checkout, filtrer les coupons applicables selon la ville de livraison du client.
- **Admin** : dans `AdminCouponsPage.tsx`, champs ville/pays sur le formulaire de coupon. Toggle global dans `AdminSettingsPage.tsx`.
- **Emplacement admin** : `AdminCouponsPage.tsx` → champs géo + `AdminSettingsPage.tsx` → toggle "Coupons géo-ciblés".

### 5.2 Dashboard analytics vendeur avancé
Conversion, panier moyen, heure de pointe, produit star.

- **Existant** : `VendorStatsTab.tsx` existe déjà avec des métriques de base.
- **À enrichir** : ajouter taux de conversion (vues vs ventes via `analytics_events`), panier moyen, histogramme heures de pointe, top 5 produits star. Utiliser Recharts (déjà installé).
- **Emplacement** : `VendorStatsTab.tsx` dans le dashboard vendeur.

### 5.3 Mode hors-ligne PWA amélioré
Cache des produits consultés récemment.

- **Existant** : SW v8 avec pré-cache des 50 produits populaires.
- **À enrichir** : cacher aussi les produits récemment consultés par l'utilisateur (stockage IndexedDB côté client). Afficher une section "Consultés récemment" en mode offline.
- **Emplacement** : `frontend/public/sw.js` + nouveau composant `RecentlyViewedOffline.tsx`.

---

## Résumé des migrations SQL nécessaires

| Migration | Tables/Colonnes |
|---|---|
| 1 | `delivery_chats` (nouveau) |
| 2 | `rider_ratings` (nouveau) |
| 3 | `orders.tip_amount`, `platform_settings` seed tipping |
| 4 | `delivery_zones` (nouveau), admin-level zones |
| 5 | `premium_subscriptions` (nouveau), `platform_settings` seed premium |
| 6 | `vendor_boosts` (nouveau), `platform_settings` seed boost |
| 7 | `coupons.target_city`, `coupons.target_country`, `platform_settings` seed geo_coupons |

---

## Récapitulatif des emplacements admin pour chaque fonctionnalité désactivable

| Fonctionnalité | Emplacement admin | État par défaut |
|---|---|---|
| Pourboire | `AdminSettingsPage.tsx` → section "Pourboire" | Désactivé |
| Abonnement Premium | `AdminSettingsPage.tsx` → section "Abonnement Premium" | Désactivé |
| Boost Vendeur | `AdminSettingsPage.tsx` → section "Boost Vendeur" | Désactivé |
| Coupons géo-ciblés | `AdminSettingsPage.tsx` → toggle + `AdminCouponsPage.tsx` → champs géo | Désactivé |

---

## Ordre d'implémentation recommandé

1. **Lot 1** (Livraison) — le plus impactant pour l'expérience utilisateur actuelle
2. **Lot 2** (Tarification) — critique pour la logistique du dernier kilomètre
3. **Lot 4** (Expérience client) — amélioration directe de la conversion
4. **Lot 3** (Monétisation) — features désactivables, peuvent attendre
5. **Lot 5** (Technique) — optimisations et enrichissements

Total estimé : ~15 fichiers modifiés, ~8 fichiers créés, 7 migrations SQL.

