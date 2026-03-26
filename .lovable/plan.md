

# Correction : Commandes invisibles pour l'admin et détails manquants

## Diagnostic

Le problème est identifié : **les politiques RLS (Row Level Security) sur les tables `orders` et `order_items` ne comportent aucune règle permettant aux administrateurs et managers de lire les commandes.**

Actuellement les seules politiques SELECT sont :
- `Users read own orders` → le client voit ses propres commandes
- `Store owners read orders` → le vendeur voit les commandes de sa boutique

Conséquence : l'admin voit un compteur (via des fonctions `SECURITY DEFINER`) mais le listing retourne 0 résultats car la requête directe via Supabase client est bloquée par RLS.

La table `order_status_history` possède déjà une politique admin (`Staff read all order history`), mais `orders` et `order_items` en sont dépourvues.

## Migration SQL requise

Une seule migration ajoutant 4 politiques RLS :

```sql
-- 1. Admin/Manager can read ALL orders
CREATE POLICY "Staff read all orders"
ON public.orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- 2. Admin/Manager can update ALL orders
CREATE POLICY "Staff update all orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- 3. Admin/Manager can read ALL order items
CREATE POLICY "Staff read all order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- 4. Staff can update order items (for corrections)
CREATE POLICY "Staff update all order items"
ON public.order_items FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);
```

## Aucun changement de code frontend

Le code admin (`AdminOrdersPage.tsx`) fait déjà les bonnes requêtes — il interroge `orders` sans filtre `user_id`. Le problème est uniquement que la base de données bloque silencieusement ces requêtes à cause des politiques manquantes.

## Résultat attendu

- L'admin verra la liste complète des commandes avec leurs détails
- Le client continue de voir ses propres commandes normalement
- Le vendeur continue de voir les commandes de sa boutique

