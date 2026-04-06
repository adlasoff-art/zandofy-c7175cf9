

# Plan d'ameliorations Zandofy - 9 chantiers

## Vue d'ensemble

9 ameliorations regroupees en 4 lots sequentiels pour minimiser les risques de regression.

---

## LOT 1 - Navigation & UX Admin (rapide, UI only)

### 1. Header Admin : menu deroulant de navigation
**Fichiers** : `AdminLayout.tsx`, `AdminSidebar.tsx`

- **Header droit** : Remplacer le bouton "Accueil" + badge par un **DropdownMenu** contenant :
  - Photo + nom + email de l'admin
  - Liens : Accueil, Mon espace (`/dashboard`), Espace vendeur (`/vendor`), Espace livreur (`/driver`), Administration (`/admin`)
  - Separateur + bouton Deconnexion
- **Sidebar haut** : Remplacer la section avatar/nom par le logo Zandofy + version (ex: `v1.0.0-beta`)

### 8. Derniere connexion visible dans le tableau utilisateurs
**Fichier** : `AdminUsersPage.tsx`

- Ajouter une colonne `Derniere connexion` au tableau (entre "Inscrit le" et "Details")
- Afficher `last_login_at` formate (`d MMM yyyy HH:mm`) directement dans le tableau
- La donnee est deja recuperee via `profiles.*`

---

## LOT 2 - Abonnements client & Checkout

### 2. Bouton "Souscrire" fonctionnel pour clients
**Fichiers** : `CustomerPricingTab.tsx`, `SubscriptionCheckoutDialog.tsx`

- Brancher le bouton "Souscrire" au `SubscriptionCheckoutDialog` existant (deja utilise cote vendeur)
- Passer `target="client"`, le `package_id`, le `billing_cycle`, et le `user_id`
- Seuls Mobile Money (KelPay) et Carte (Keccel) sont proposes (deja filtre dans le dialog)
- A la confirmation du paiement, creer/mettre a jour `store_package_subscriptions` avec `user_id` + `is_active=true` + `paid_until`

### 2b. Checkout : livraison gratuite si abonnement actif
**Fichiers** : Composant checkout (section frais de livraison)

- Au checkout, verifier si l'utilisateur a un `store_package_subscriptions` actif avec `target=client` et `paid_until > now()`
- Si oui : mettre `last_mile_fee = 0` et afficher un bandeau :
  > "Votre forfait **[nom]** est actif jusqu'au [date]. Livraison a domicile sans frais supplementaires."
- Les frais d'expedition (shipping_cost) restent inchanges

---

## LOT 3 - Tracking, Commandes & Moderation

### 3. Liens cliquables dans le suivi de commande client
**Fichiers** : Composant de suivi commande dans le dashboard client

- Etape "En livraison" : rendre cliquable → redirection vers `/tracking?order=ORDER_REF` (carte livreur)
- Etape "Expedie" : rendre cliquable → redirection vers `/tracking?ref=TRACKING_NUMBER` (si tracking_number existe) ou `/tracking?ref=ORDER_REF` (sinon)
- Utiliser le `order_ref` Zandofy, jamais le `supplier_order_number`

### 4. Suppression & export de commandes (Admin)
**Fichier** : `AdminOrdersPage.tsx`
**Migration** : Aucune (soft-delete optionnel, sinon DELETE direct)

- Ajouter un bouton "Supprimer" dans la vue detaillee d'une commande (avec confirmation modale)
- Ajouter un bouton "Exporter" (CSV/JSON) pour les commandes filtrees
- Le format JSON inclura toutes les colonnes + `order_items` pour permettre une reimportation
- La suppression effectue un `DELETE` avec cascade sur `order_items` et `order_status_history`

### 5. Moderation des avis : verification operationnelle
**Fichier** : `AdminReviewModerationPage.tsx`, logique de creation d'avis

- Verifier que les avis avec images sont crees avec `is_approved = false` par defaut
- S'assurer que le trigger `credit_review_bonus_points` ne s'active qu'au passage `is_approved: false → true`
- Verifier le parcours complet : soumission → moderation admin → approbation → credit points
- Si le champ `is_approved` n'est pas force a `false` a l'insertion, ajouter un trigger DB `BEFORE INSERT` pour forcer `is_approved = false` quand `images IS NOT NULL`

---

## LOT 4 - Fonctionnalites structurelles

### 6. Historique des courses livreur
**Fichier** : Nouveau composant `RiderDeliveryHistory.tsx`, integration dans le dashboard livreur

- Creer un onglet "Historique" dans l'espace livreur
- Requeter `deliveries` avec jointure `orders` pour chaque livreur
- Afficher par course : duree (created_at → delivered_at), montant, moyen de paiement, statut
- Si le client a un abonnement actif, afficher "Paiement par abonnement"
- Calcul du temps : difference entre `created_at` de la delivery et `delivered_at`

### 7. Pays + villes actifs avec controle au checkout
**Migration DB** : Ajouter la gestion des villes dans `platform_settings` (cle `active_countries` enrichie avec structure `{ disabled: [...], cities: { "CD": ["Kinshasa", ...] } }`)
**Fichiers** : `AdminCountriesPage.tsx`, composant checkout

- **Admin** : Quand un pays est active, permettre de definir les villes eligibles (champ texte ou liste)
- **Checkout** : Valider pays + ville. Si non eligible, afficher :
  > "Ce pays/cette ville n'est pas encore desservi(e). Nous travaillons a etendre notre couverture."
- Bloquer la soumission de commande si pays/ville non active

### 9. Gestion des collaborateurs par palier d'abonnement
**Migration DB** :
- Ajouter `max_collaborators` (int, default 0) a `service_packages`
- Ajouter `collaborator_limit_override` (int, nullable) a `vendor_pricing_overrides`
- Ajouter `sub_role` (text, nullable) a `store_collaborators` pour les sous-roles

**Fichiers** : `VendorTeamTab.tsx`, `AdminServicePackagesPage.tsx`, `AdminVendorPricingPage.tsx`

- **Packages** : L'admin definit le nombre max de collaborateurs par package (ex: Standard=2, Pro=4, Premium=5, Entreprise=10)
- **Override** : L'admin peut definir un override personnalise par boutique
- **Sous-roles disponibles** : `orders` (gestion commandes), `products` (catalogue), `messages` (chat client), `analytics` (stats). Exclusion de `finance` par defaut
- **VendorTeamTab** : Verifier la limite avant ajout. Le vendeur choisit les permissions du collaborateur
- **KYC obligatoire** : Verifier `is_kyc_verified` du collaborateur avant ajout

---

## Resume des migrations DB

```text
1. ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS max_collaborators int DEFAULT 0;
2. ALTER TABLE vendor_pricing_overrides ADD COLUMN IF NOT EXISTS collaborator_limit_override int;
3. ALTER TABLE store_collaborators ADD COLUMN IF NOT EXISTS sub_role text DEFAULT 'orders';
4. ALTER TABLE store_collaborators ADD COLUMN IF NOT EXISTS permissions text[] DEFAULT '{orders}';
5. Trigger BEFORE INSERT on reviews: force is_approved = false when images IS NOT NULL
```

---

## Ordre d'implementation

| Lot | Chantiers | Complexite | Estimation |
|-----|-----------|------------|------------|
| 1   | #1 Header + #8 Derniere connexion | Faible | 1 session |
| 2   | #2 Souscrire + #2b Checkout | Moyenne | 1-2 sessions |
| 3   | #3 Tracking + #4 Export/Delete + #5 Moderation | Moyenne | 2 sessions |
| 4   | #6 Historique livreur + #7 Villes + #9 Collaborateurs | Elevee | 3 sessions |

