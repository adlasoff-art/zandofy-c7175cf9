## 🔍 Diagnostic : pourquoi Supabase t'alerte sur le Disk IO (staging `wgidwyrdnboivfphwete`)

J'ai inspecté la base preview (mêmes structures que staging/prod). **Le problème principal n'est PAS la logistique**, c'est l'absence d'index sur des FK très requêtées. Quelques chiffres trouvés via `pg_stat_user_tables` (preview, faible trafic) :

| Table | seq_scan | tuples lus | index ? |
|---|---|---|---|
| `notifications` | 47 625 | **7,5 M lignes** | ❌ aucun sur `user_id`/`is_read`/`created_at` |
| `product_images` | 144 516 | **3,75 M** | ❌ aucun sur `product_id` |
| `product_sizes` | 115 018 | **3,33 M** | ❌ aucun sur `product_id` |
| `product_colors` | 115 018 | **3,21 M** | ❌ aucun sur `product_id` |
| `stores` | 51 983 | 143 k | ⚠️ pas sur les filtres usuels |
| `messages` | 7 370 | 61 k | ❌ aucun sur `conversation_id` |
| `cart_items` | 6 331 | 14 k | ❌ aucun sur `user_id` |
| `orders` | 11 675 | 209 k | ⚠️ pas sur `user_id`/`store_id`/`status` |

➡️ Avec 4 000 utilisateurs/jour en prod, multiplie ces seq_scans par ~100. **Chaque ouverture de fiche produit fait 3 full scans** (images/sizes/colors). C'est exactement le profil "Disk IO épuisé".

À titre de comparaison la **logistique est saine** : `forwarder_handoffs`, `forwarder_handoff_events`, `freight_quotes`, `delivery_chats`, etc. sont à 0–1 ligne et ne sont quasi pas requêtées. Ce n'est PAS la cause.

---

## 🧹 Audit logistique (ce qui est fait / inutile / incohérent)

### ✅ Cohérent et utilisé
- `forwarders`, `forwarder_pricing_profiles`, `forwarder_cbm_tiers/kg_tiers/piece_tiers`, `forwarder_restrictions`, `forwarder_surcharges` → admin forwarders panel ✓
- `forwarder_handoffs` + `forwarder_handoff_events` → Lots 4D→4Q (timeline UI client/transporteur/admin) ✓
- `freight_quotes` → CheckoutPage ✓
- `shipping_routes`, `shipping_zones`, `logistic_zones`, `local_shipping_rates` → moteur shipping ✓
- `rider_locations`, `delivery_chats` → suivi & chat livraison ✓
- `delivery_subscriptions` → abonnements clients ✓
- Edge Functions : `calculate-shipping`, `notify-forwarder-handoff`, `notify-handoff-status-customer`, `expire-pending-orders`, `generate-shipping-labels` ✓

### ⚠️ Incohérences détectées
1. **Doublons de vue forwarders** : `forwarders_public` (table/view) **et** `v_forwarder_profiles_public` coexistent. À unifier sur `forwarders_public` (créée plus récemment, migration `20260421120000_forwarders_public_view.sql`) et supprimer `v_forwarder_profiles_public`.
2. **3 fonctions `quote_forwarder` surchargées** dans le schéma (3 signatures différentes). Risque d'appels ambigus. À auditer et n'en garder qu'une.
3. **`MANUAL_expire-pending-orders-cron-STAGING.sql`** mentionne le ref staging `wgidwyrdnboivfphwete` ✓ mais le cron actif côté preview tourne **toutes les 5 min**. À vérifier en staging : si pas appliqué, le job n'expire jamais les commandes.
4. **`MANUAL_process-automation-cron.sql`** pointe vers l'ancien ref `vpttoqojmiqxgudknyxf` (prod). Vérifier qu'il est bien programmé en staging avec le bon ref.
5. **`HandoffEventsTimeline` côté client** affiche tous les événements y compris internes (changement transitaire, paiement freight). À filtrer côté client pour masquer ce qui n'est pas destiné au client final (cosmétique, pas urgent).

### 🗑️ Inutilisé / candidats au retrait (à valider avec toi avant suppression)
- **Aucune table logistique vraiment morte** : toutes ont une UI ou un service qui les référence. Les tables vides (`hub_storage_tracking`, `vendor_delivery_zones`, `delivery_zones`, `rider_ratings`, `local_shipping_rates`) sont **prêtes pour la prod** mais pas encore utilisées.
- À noter : `delivery_zones` ET `vendor_delivery_zones` ET `logistic_zones` ET `shipping_zones` = 4 notions de zones. Confusion possible. À documenter dans `mem://features/shipping-engine-logic` ou consolider à terme (gros chantier — pas dans ce lot).

---

## 🛠️ Plan d'action (Lot Performance v1 — anti Disk IO)

### Étape 1 : créer les index manquants (impact direct Disk IO, ~80 % du gain attendu)
Migration `20260424_perf_indexes.sql` :
```sql
-- Notifications (7,5 M lignes lues en preview !)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);

-- Produits : images / sizes / colors (chargées sur chaque fiche)
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sizes_product_id  ON product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_colors_product_id ON product_colors(product_id);

-- Orders (dashboard client + vendor)
CREATE INDEX IF NOT EXISTS idx_orders_user_created    ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status    ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created  ON orders(status, created_at DESC);

-- Messages / cart
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

-- Stores (filtres slug + statut)
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- Logistique (pour la suite)
CREATE INDEX IF NOT EXISTS idx_forwarder_handoffs_order   ON forwarder_handoffs(order_id);
CREATE INDEX IF NOT EXISTS idx_forwarder_handoff_events_handoff
  ON forwarder_handoff_events(handoff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_order_status ON freight_quotes(order_id, status);
```
**Effet attendu** : Disk IO réduit de **70–90 %** sur staging et prod après quelques heures de chauffe.

### Étape 2 : housekeeping des tables qui grossissent (rétention)
- `analytics_events` : 2 757 lignes en preview, ça va exploser. Ajouter un cron mensuel `DELETE FROM analytics_events WHERE created_at < now() - interval '90 days'` (équivalent à `cleanup-old-activity-logs` qui existe déjà pour `user_activity_logs`).
- `notifications` : trigger d'archivage des notifs lues > 60 jours.
- `error_reports` : déjà 175 lignes en preview — purge des résolues > 30 jours.

### Étape 3 : nettoyage logistique léger (zéro casse)
- Supprimer la vue `v_forwarder_profiles_public` (remplacée par `forwarders_public`) → migration + remplacement des références si elles existent.
- Auditer les 3 surcharges `quote_forwarder` et garder la signature canonique.
- Documenter clairement les 4 notions de zones dans `mem://`.

### Étape 4 : appliquer les crons MANUEL en staging
- Vérifier que `MANUAL_expire-pending-orders-cron-STAGING.sql` et `MANUAL_process-automation-cron.sql` sont bien programmés sur `wgidwyrdnboivfphwete` avec l'anon key staging.

### Étape 5 (optionnel — éviter de faire sauter le budget)
Si après index + housekeeping le Disk IO reste tendu (pic > 60 % du budget) → upgrade compute Supabase d'un cran (Small → Medium ~+25 $/mois). **À ne déclencher que si Étapes 1–2 ne suffisent pas**, ce qui serait surprenant vu les chiffres.

---

## 📊 Score sécurité maintenu : 96/100, 0 warning linter
Aucun de ces changements ne dégrade la sécurité (pas de touche RLS, pas de touche storage, juste des index et de la rétention).

## ⚠️ Rappels stack
- Migrations livrées via `frontend/supabase/migrations/` puis GitHub Actions → staging puis prod.
- **Aucune** modification directe sur `wgidwyrdnboivfphwete` ou `vpt...yxf`.
- Lovable Cloud (`uog...zpu`) ne sert que de preview ; les chiffres ci-dessus le prouvent (déjà 47k seq_scans avec un trafic ridicule).

---

**Prochaine étape proposée** : tu approuves → je crée la migration d'index + le cron de rétention `analytics_events` + le cleanup des doublons forwarders. Ordre d'exécution sécurisé, zéro casse, déployable via ton pipeline GitHub habituel.