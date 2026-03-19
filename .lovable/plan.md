

# Refonte du tableau de bord admin — Dashboard analytique avancé

## Résumé

Réorganiser le dashboard admin actuel en un système à **onglets** avec des graphiques temporels détaillés, un sélecteur de période, et de nouveaux KPIs (top vendeurs, top clients, top parrains). Le contenu existant est conservé et redistribué dans les onglets.

## Architecture par onglets

```text
┌─────────────┬────────────┬──────────────┬──────────────┬────────────────┐
│  Vue d'ens.  │   Ventes   │  Logistique  │  Vendeurs    │  Clients &     │
│  (Overview)  │            │              │              │  Parrainage    │
└─────────────┴────────────┴──────────────┴──────────────┴────────────────┘
```

### Sélecteur de période (global, en haut)
Options : Aujourd'hui, 7 jours, 14 jours, 30 jours, 3 mois, 6 mois, 9 mois, 1 an.
Toutes les requêtes de tous les onglets filtrent par cette période.

### Onglet 1 — Vue d'ensemble
- KPI cards existants (utilisateurs, commandes, revenu, produits, boutiques)
- KPI santé des commandes (livrées, en attente, annulées, montant perdu)
- KPI après-vente & paiements
- Commandes récentes (tableau existant)
- Répartition des rôles + statuts commandes (sidebar existante)

### Onglet 2 — Ventes
- **Histogramme : Ventes par jour/semaine/mois** (barres groupées avec revenu + nombre de commandes)
- **Courbe d'évolution du CA** (AreaChart cumulatif sur la période)
- **Camembert : Répartition des commandes par statut**
- **Camembert : Répartition des modes de paiement** (Stripe, Mobile Money, COD)

### Onglet 3 — Logistique
- KPI logistique existants (expéditions, livraisons, livrées, en cours)
- **Histogramme : Livraisons par jour** (delivered vs pending vs in_progress) — étendu à la période choisie
- **Camembert : Expéditions par mode** (existant, relocalisé)
- **Histogramme : Statuts des expéditions** (existant, relocalisé)
- **Histogramme : Colis par étape du pipeline** (pending → processing → shipped → in_transit → delivered)

### Onglet 4 — Vendeurs
- **Histogramme : Top 10 vendeurs par CA** sur la période
- **Histogramme : Top 10 vendeurs par nombre de commandes**
- **Tableau : Classement vendeurs** (boutique, CA, commandes, produits, note)
- KPI : nombre de vendeurs, nouvelles boutiques sur la période

### Onglet 5 — Clients & Parrainage
- **Histogramme : Top 10 clients par dépenses**
- **Histogramme : Top 10 parrains** (par nombre de filleuls ou points gagnés)
- **Courbe : Nouveaux inscrits par jour/semaine**
- KPI : nouveaux clients sur la période, taux de conversion (inscrits → acheteurs)

## Plan technique

### Fichiers modifiés
1. **`AdminDashboard.tsx`** — Refonte complète :
   - Ajouter un state `period` (sélecteur de période) et un state `tab`
   - Utiliser `<Tabs>` de shadcn pour la navigation
   - Extraire les requêtes existantes + ajouter les nouvelles (toutes filtrées par période)
   - Nouvelles requêtes Supabase :
     - Ventes par jour : `orders` groupé par `date_trunc` de `created_at`
     - Top vendeurs : `order_items` JOIN `orders` JOIN `stores`, agrégé par store
     - Top clients : `orders` agrégé par `user_id` JOIN `profiles`
     - Top parrains : `referrals` JOIN `profiles`, comptage filleuls
     - Nouveaux inscrits par jour : `profiles` groupé par `created_at`
     - Paiements par méthode : `payment_transactions` groupé par `payment_method`
   - Les agrégations se font côté client (on fetch les données brutes filtrées par période, puis on agrège en JS)

2. **Aucune migration nécessaire** — toutes les données existent déjà dans les tables `orders`, `order_items`, `stores`, `profiles`, `referrals`, `deliveries`, `shipments`, `payment_transactions`

### Composants UI utilisés
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (shadcn)
- `Select` pour le sélecteur de période
- `BarChart`, `AreaChart`, `PieChart` de recharts (déjà importés)
- `Card` pour structurer chaque bloc

### Approche
- Le fichier actuel fait 525 lignes. La refonte sera dans le même fichier mais avec les blocs mieux organisés par onglet.
- Chaque onglet utilise ses propres `useQuery` hooks avec la période en `queryKey` pour le refetch automatique.
- Les graphiques utilisent les mêmes styles visuels que ceux existants (gradients, couleurs `hsl(var(--primary))`).

