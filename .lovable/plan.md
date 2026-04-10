

# Plan : Corriger les 3 vulnérabilités critiques (sans casse)

## Contexte

Les vues `products_public` et `stores_public` existent déjà et masquent les colonnes sensibles. Le problème : le code frontend et le Realtime ne les utilisent pas systématiquement.

## Approche conservative

Aucune suppression de politique RLS, aucun changement de structure de table. On agit uniquement sur deux axes : (1) retirer des tables sensibles du Realtime, (2) migrer les requêtes frontend publiques vers les vues existantes.

---

## Correction 1 — Realtime : retirer les tables qui exposent des données sensibles

**Migration SQL** :

Retirer `products` et `stores` de la publication `supabase_realtime`. Ces tables diffusent leurs lignes complètes (y compris `cost_real`, `cost_calc`, `whatsapp_number`) à tout abonné authentifié.

Tables conservées dans Realtime (aucun changement) : `orders`, `messages`, `notifications`, `order_status_history`, `deliveries`, `shipments`, `support_messages`, `dispute_messages`, `delivery_chats`.

**Impact frontend** : Seuls 2 fichiers utilisent le Realtime sur `products`/`stores` :
- `AdminDashboard.tsx` — écoute `orders` (pas affecté), mais aussi `products` et `stores` pour invalider des compteurs admin. On remplacera par un polling toutes les 30 secondes sur ces compteurs, ou on ajoutera un channel Realtime sur `orders` uniquement (déjà en place).
- Aucun composant public n'écoute `products` ou `stores` en Realtime.

**Risque de casse** : Très faible. Les admins verront un léger délai de rafraîchissement sur les compteurs produits/boutiques (30s au lieu d'instantané). Tout le reste fonctionne identiquement.

---

## Correction 2 — Masquer `cost_real` / `cost_calc` pour les requêtes publiques

Les vues `products_public` existent et excluent ces colonnes. Le frontend public query déjà `products` directement mais ne sélectionne jamais `cost_real`/`cost_calc` dans les pages publiques (seuls `OrdersTab` et `AdminVendorAccountingPage` le font, et ils sont admin-only).

**Action** : Aucune modification de code nécessaire côté public. Les pages admin continueront à lire `cost_real`/`cost_calc` via la table `products` (RLS "Admins and managers read all products" les y autorise).

**Protection supplémentaire** : Le retrait de `products` du Realtime (Correction 1) empêche la diffusion de ces colonnes via les WebSockets. C'était le vrai vecteur d'exposition.

---

## Correction 3 — Masquer `whatsapp_number` des requêtes publiques sur `stores`

La vue `stores_public` existe et exclut `whatsapp_number`. Le fichier `StoresPage.tsx` utilise déjà `stores_public`.

**Action** : Vérifier et migrer tout composant public qui query `stores` directement et qui pourrait recevoir `whatsapp_number`. Les pages produit et boutique publiques qui affichent le bouton WhatsApp doivent conditionner l'affichage à l'utilisateur authentifié (déjà le cas puisque le bouton WhatsApp n'est visible que pour les clients connectés qui consultent une boutique).

**Protection supplémentaire** : Le retrait de `stores` du Realtime (Correction 1) empêche la diffusion de `whatsapp_number` via WebSockets.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| Migration SQL | `DROP TABLE public.products, public.stores` de `supabase_realtime` |
| `frontend/src/pages/admin/AdminDashboard.tsx` | Remplacer le channel Realtime `products`/`stores` par un polling 30s ou supprimer (le channel `orders` reste) |

## Score estimé après corrections

68 → ~80/100. Les trois vecteurs d'exposition (Realtime broadcast, coûts, WhatsApp) sont neutralisés sans toucher aux RLS policies ni à la structure des tables.

## Fichier SQL téléchargeable

Conformément à SAFETY_POLICY, un fichier SQL sera généré et fourni pour synchronisation manuelle staging/production.

