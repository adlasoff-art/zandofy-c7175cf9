

## Plan: Ajouter "Revenu actuel" au tableau de bord administrateur

### Contexte
- **Revenu réel** (existant) = uniquement les commandes `delivered`
- **Revenu actuel** (à ajouter) = toutes les commandes sauf `awaiting_payment`, `cancelled`, `returned`, `payment_failed` (donc pending, confirmed, preparing, shipped, etc.)

Tu as bien compris : le revenu réel ne compte que les commandes livrées.

### Modification

**Fichier** : `frontend/src/components/admin/dashboard/OverviewTab.tsx`

1. Ajouter le calcul de `currentRevenue` dans la query `orderStats` : on somme les totaux de toutes les commandes qui ne sont PAS dans `NON_REVENUE_ORDER_STATUSES`
2. Ajouter une carte KPI "Revenu actuel" avec l'icône `TrendingUp` (déjà importée) dans la grille Commerce, juste avant "Revenu réel"
3. Passer la grille de `lg:grid-cols-5` à `lg:grid-cols-6` pour accommoder la nouvelle carte

### Pas de migration SQL nécessaire

---

### État de la plateforme - Points d'attention

Voici ce que j'observe qui pourrait nécessiter des ajustements :

1. **Commandes** : visibilité restaurée côté client, vendeur et admin — fonctionnel
2. **Notifications email** : le template `pending` a été ajouté aux Edge Functions, mais il faudrait vérifier qu'un client reçoit bien l'email de confirmation après paiement Mobile Money
3. **Expiration des commandes** : la Edge Function `expire-pending-orders` doit être correctement planifiée (cron) pour expirer les `awaiting_payment` après 30 minutes
4. **Colonnes optionnelles** : le helper `order-query.ts` protège contre les colonnes manquantes, mais idéalement toutes les colonnes listées dans la migration doivent exister dans la base de données Supabase de production

