## Contexte

La commande **ZND-MO5HHBED** affichée dans la capture est une commande **production** (Supabase.com perso `vpt...yxf`). Le composant `OrderItemsPanel` est correctement implémenté — j'ai vérifié sur 10 commandes Lovable Cloud que chacune affiche bien ses items.

Le message "Aucun produit lié" apparaît car cette commande spécifique **n'a aucune ligne dans `order_items`** (commande historique antérieure à la stabilisation du checkout, ou insertion partielle). Les totaux ($1.99/$1.33/$0.00) s'affichent car ils sont sur la ligne `orders` directement.

## Ce qui est déjà OK
- Code de récupération `order_items` correct (jointure sur `products` pour slug + image)
- Éclatement Sous-total / Expédition / Last-mile / Total
- Lien cliquable vers `/products/{slug}` + thumbnail

## Lot 7 — Robustesse affichage produits commandés

### Frontend `OrderItemsPanel` (AdminOrdersPage.tsx)
1. **Message plus informatif** quand `items.length === 0` : remplacer "Aucun produit lié." par un encart explicite indiquant "Commande historique sans détail d'articles enregistré (sous-total $X.XX préservé)" — pour distinguer une vraie absence d'un bug.
2. **Fallback de récupération** : si `order_items` vide, tenter de lire `payment_transactions` ou `cart_snapshots` (selon ce qui existe en prod) pour retrouver la composition d'origine.

### Audit SQL en prod (script à fournir, à exécuter sur `vpt...yxf`)
Compter combien de commandes prod ont `subtotal > 0` mais 0 `order_items`. Si le volume est faible (< 1%), pas d'action. Si élevé, investiguer le checkout historique.

```sql
SELECT COUNT(*) AS orphan_orders
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE oi.id IS NULL AND o.subtotal > 0;
```

## Lot 8 — Vérification graphiques (sera traité quand tu auras regardé)

Tu indiques vouloir d'abord vérifier les graphiques toi-même. J'attends ton retour pour ajuster `SalesTab.tsx` si besoin (couleurs, séries, légendes).

## Hors scope (pas de migration nécessaire)
Aucune modification DB requise pour Lot 7 — c'est uniquement de l'UX défensive côté admin.
