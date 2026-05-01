---
name: Forwarder Shipping Templates
description: Modèles d'expédition par transitaire — adresse entrepôt + gabarit infos colis. Vendeur/admin only, jamais client.
type: feature
---

# Templates d'expédition transitaire (Lot 18C)

## But
Permettre au vendeur (et admin) de copier en 1 clic, depuis la vue commande :
1. Le bloc "infos à coller sur le colis" (gabarit avec placeholders résolus depuis la commande).
2. L'adresse de l'entrepôt du transitaire (Chine, Turquie, etc.).

## Confidentialité (CRITIQUE)
- **Le client ne voit JAMAIS l'adresse entrepôt du transitaire.**
- Composant `ForwarderShippingCopyBlock` monté UNIQUEMENT dans `FreightDetailsPanel` quand `actor === "vendor" | "admin"`.
- `DashboardPage` utilise `FreightDetailsPanel` sans `actor` → le bloc reste masqué côté client.
- RLS `forwarder_shipping_templates` :
  - SELECT : admin + manager + tout user qui possède au moins un `stores` (= vendeur).
  - INSERT/UPDATE/DELETE : admin + manager only.

## Modèle de données
Table `forwarder_shipping_templates` (forwarder_id FK, label, warehouse_address, package_info_template, is_default unique partiel, sort_order).

## Placeholders supportés
`{{customer_name}}`, `{{phone}}`, `{{city}}`, `{{country}}`, `{{order_ref}}` (résolus depuis `orders.shipping_*` + `order_ref`).

## Admin
- `ForwarderShippingTemplatesPanel` intégré dans `ForwarderFormDialog` (visible uniquement en édition d'un transitaire existant).

## Migration
`20260501150000_forwarder_shipping_templates.sql` (appliquée via outil migration Lovable Cloud — à rejouer sur prod via GitHub Actions).