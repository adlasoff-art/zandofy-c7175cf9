

# Plan Complet : Tracking GPS Bidirectionnel, Gestion de Flotte & PWA

---

## Etat des lieux

### Ce qui est FAIT
| Fonctionnalité | Statut |
|---|---|
| **Rider Dashboard** (`/rider`) | Complet -- onglets Route, Commandes, Carte, Historique, Profil |
| **GPS Rider → DB** | Complet -- `useRiderLocationBroadcast` upsert dans `rider_locations` via watchPosition |
| **Carte Leaflet/OSM** | Complet -- `DeliveryMap` avec icônes rider (vert) et client (rouge) |
| **Subscription Realtime** | Complet -- `useRiderLocationSubscription` écoute `postgres_changes` |
| **Admin Logistics** (`/admin/logistics`) | Partiel -- Vue d'ensemble, assignation riders, liste livraisons, carte 1 seul rider |
| **Shipper Dashboard** (`/shipper`) | Complet -- CRUD expéditions (Air/Mer/Route), statuts, stats |
| **Tracking Client** (`/tracking`) | Complet -- 9 étapes, onglets Ma Commande/Expédition/Livraison, carte rider |
| **Preuve de livraison** | Complet -- signature canvas + photo, upload storage |
| **Self-delivery vendeur** | Complet -- toggle, frais livraison, code confirmation |
| **Statuts commande** | 11 statuts (pending → delivered/cancelled/returned) |

### Ce qui MANQUE
1. **GPS Client** : le client ne broadcast pas sa position → le rider ne le voit pas sur la carte
2. **Carte multi-riders Admin** : la carte admin n'affiche qu'un seul rider, pas la flotte complète
3. **Fleet Management Admin/Manager** : pas de vue centralisée par commande avec suivi en temps réel
4. **Vendor Tracking Riders** : le vendeur self-delivery ne peut pas tracker ses riders
5. **Transport routier/ferroviaire** : les modes `road` et `rail` existent dans le schema mais pas d'UI dédiée
6. **PWA Rider optimisée** : pas de manifest/install dédié pour les livreurs

---

## Architecture PWA

**1 seule PWA, multi-rôle** -- C'est l'architecture actuelle et recommandée. Le même build Vite/React sert toutes les audiences. Le rôle de l'utilisateur détermine sa vue :

| Acteur | Point d'entrée | PWA séparée ? |
|---|---|---|
| **Client** | `/` → dashboard `/dashboard` | Non -- app principale |
| **Vendeur** | `/vendor` | Non -- même PWA |
| **Livreur** | `/driver` → `/rider` | Non -- même PWA, optimisée mobile |
| **Transporteur** | `/shipper` | Non -- même PWA |
| **Admin/Manager** | `/admin/*` | Non -- même PWA |

> **Conclusion : 1 seule PWA suffit.** Les points d'entrée `/driver` et `/shipper` sont déjà des raccourcis PWA-friendly. Si nécessaire à l'avenir, on peut créer des manifests alternatifs pour brandiser l'icône d'installation différemment, mais ce n'est pas bloquant.

---

## Plan d'implémentation (6 taches)

### Tache 1 -- GPS bidirectionnel Client ↔ Rider

**Objectif** : Le client broadcast sa position quand sa commande est `out_for_delivery`, le rider voit le client sur la carte, et vice versa.

- Créer une table `customer_locations` (ou réutiliser un channel Realtime broadcast sans persistance pour la privacy)
- Hook `useCustomerLocationBroadcast(userId, orderId, enabled)` -- même pattern que `useRiderLocationBroadcast`
- Hook `useCustomerLocationSubscription(orderId, onUpdate)` 
- Sur `TrackingPage` : activer le broadcast GPS client quand statut = `out_for_delivery` ou `rider_assigned`
- Sur `RiderDashboardPage` : subscribe à la position du client et l'afficher sur `DeliveryMap`
- Sur `TrackingPage` côté client : afficher la carte avec les 2 marqueurs (rider + client)

**Migration SQL** :
```sql
CREATE TABLE public.customer_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  latitude double precision NOT NULL DEFAULT 0,
  longitude double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customer_locations_user_order ON customer_locations(user_id, order_id);
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;
-- RLS policies similaires à rider_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_locations;
```

### Tache 2 -- Fleet Management Admin (carte multi-riders + tableau de bord)

**Objectif** : Admin et Manager voient TOUS les riders actifs sur une carte unique, avec les commandes associées.

- Refactorer `AdminLogisticsPage` onglet "overview" :
  - Carte Leaflet affichant TOUS les `rider_locations` (pas juste le premier)
  - Chaque marqueur rider cliquable → popup avec nom, commande en cours, statut
  - Marqueurs clients (depuis `customer_locations`) sur la même carte
  - Lignes de liaison rider→client pour chaque livraison active
- Ajouter un onglet **"Flotte"** avec :
  - Liste de tous les riders avec statut (en ligne/hors ligne/en livraison)
  - Pour chaque rider : commande assignée, destination, temps estimé
  - Filtres par statut, par ville
- Refetch toutes les 10s (déjà en place) + Realtime subscription

### Tache 3 -- Expédition : modes Routier et Ferroviaire

**Objectif** : Ajouter les modes `road` et `rail` dans les interfaces existantes.

- `ShipperDashboardPage` : ajouter icônes et labels pour `road` (Routier) et `rail` (Ferroviaire)  
- `TrackingPage` : ajouter icône `Train` pour mode rail
- `AdminShippingPage` / `shipping_defaults` : supporter les tarifs route/rail
- Formulaire de création d'expédition : ajouter les options dans le select `mode`
- Statuts spécifiques route/rail dans le stepper si nécessaire (ex: "En chargement", "En route", "Checkpoint douane", "Arrivé")

### Tache 4 -- Vendor Rider Tracking (Self-Delivery)

**Objectif** : Le vendeur avec self-delivery activé voit la position GPS de ses riders assignés.

- Dans `VendorOrderManager` ou un nouvel onglet "Livraisons" du dashboard vendeur :
  - Lister les commandes avec `assigned_rider_id` pour les commandes du store
  - Pour chaque commande en livraison, afficher `DeliveryMap` avec le rider + la destination client
  - Utiliser `useRiderLocationSubscription` filtré par `delivery_id`
- RLS existante couvre déjà ce cas ("Vendors read delivery locations")

### Tache 5 -- Enrichir la carte DeliveryMap

**Objectif** : Rendre `DeliveryMap` multi-marqueurs et plus riche.

- Refactorer `DeliveryMap` pour accepter un tableau de marqueurs (`markers: { lat, lng, type, label }[]`)
- Ajouter un mode "fleet" (zoom auto pour contenir tous les marqueurs)
- Ajouter des polylines rider→client
- Ajouter la distance estimée et l'ETA (calcul Haversine côté client)
- Animation fluide du déplacement des marqueurs

### Tache 6 -- Optimisations PWA Livreur

**Objectif** : S'assurer que l'expérience mobile livreur est optimale.

- Vérifier que le `manifest.json` et le service worker couvrent `/rider` et `/driver`
- Background GPS : ajouter un message clair si la permission geolocation est refusée
- Notification vibration/son lors de nouvelle assignation
- Mode hors-ligne basique : afficher les dernières livraisons en cache
- Bouton "Naviguer" qui ouvre Google Maps/Waze avec l'adresse du client

---

## Résumé des migrations nécessaires

1. **Table `customer_locations`** -- pour le GPS client bidirectionnel
2. Pas d'autre migration majeure -- les tables `rider_locations`, `deliveries`, `orders`, `shipments` couvrent déjà les besoins

## Aucune Edge Function additionnelle requise

Toute la logique est côté client (GPS → Supabase → Realtime → Leaflet).

