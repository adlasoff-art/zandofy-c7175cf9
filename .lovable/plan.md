

## Plan : Fonctionnalites strategiques 6-15

Apres audit complet, voici l'etat actuel et le plan d'implementation pour chaque fonctionnalite.

---

### Etat des lieux rapide

| # | Feature | Etat actuel |
|---|---------|-------------|
| 6 | Wishlist | **Fait** — table `wishlists`, context, page, bouton coeur sur ProductCard |
| 7 | Coupons | **Fait** — tables `coupons` + `store_coupons`, validation checkout, vendeur peut creer ses codes |
| 8 | Flash Sales | **Inexistant** — aucune table ni UI |
| 9 | Comparateur | **Inexistant** |
| 10 | Notifications multi-canal | **Partiel** — in-app + push + email existent mais pas de routage intelligent par preference |
| 11 | Avis verifies photos | **Partiel** — ReviewForm existe avec upload photos, mais pas de verification d'achat |
| 12 | Chat ameliore | **Partiel** — ChatPanel existe avec media/moderation, mais pas de typing indicator ni statut en ligne |
| 13 | Analytics vendeur avance | **Partiel** — VendorStatsTab a revenus/commandes/top produits, manque taux conversion, heures de pointe, taux retour |
| 14 | Litiges structures | **Partiel** — DisputeForm client + AdminDisputesPage + VendorDisputesTab existent, mais pas de messagerie tripartite |
| 15 | Export comptable | **Inexistant** |

**Conclusion : les points 6 et 7 sont deja complets.** Il reste 8 fonctionnalites a implementer.

---

### 8. Flash Sales / Ventes Flash

**Migration SQL** :
```sql
CREATE TABLE public.flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flash_price numeric NOT NULL,
  original_price numeric NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  max_quantity int DEFAULT NULL,
  sold_quantity int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active flash sales" ON public.flash_sales FOR SELECT USING (is_active = true);
CREATE POLICY "Admin manage flash sales" ON public.flash_sales FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
```

**Fichiers a creer/modifier** :
| Fichier | Action |
|---------|--------|
| `frontend/src/components/FlashSalesSection.tsx` | Creer — carrousel page d'accueil avec countdown timer |
| `frontend/src/pages/admin/AdminFlashSalesPage.tsx` | Creer — CRUD flash sales (admin) |
| `frontend/src/pages/Index.tsx` | Modifier — integrer FlashSalesSection |
| `frontend/src/pages/ProductPage.tsx` | Modifier — afficher prix flash + timer si actif |
| `frontend/src/App.tsx` | Ajouter route admin |

---

### 9. Comparateur de produits

**Aucune migration** — tout cote client (localStorage).

| Fichier | Action |
|---------|--------|
| `frontend/src/contexts/CompareContext.tsx` | Creer — context global (max 4 produits) |
| `frontend/src/components/CompareBar.tsx` | Creer — barre flottante en bas avec miniatures |
| `frontend/src/components/CompareTable.tsx` | Creer — tableau comparatif (prix, rating, tailles, vendeur, origine) |
| `frontend/src/pages/ComparePage.tsx` | Creer — page /compare |
| `frontend/src/components/ProductCard.tsx` | Modifier — ajouter bouton "Comparer" |

---

### 10. Notifications multi-canal intelligentes

**Migration SQL** :
```sql
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  order_updates jsonb NOT NULL DEFAULT '{"in_app":true,"email":true,"push":true}',
  promotions jsonb NOT NULL DEFAULT '{"in_app":true,"email":false,"push":false}',
  messages jsonb NOT NULL DEFAULT '{"in_app":true,"email":false,"push":true}',
  system jsonb NOT NULL DEFAULT '{"in_app":true,"email":true,"push":false}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

| Fichier | Action |
|---------|--------|
| `frontend/src/components/NotificationPreferences.tsx` | Creer — UI toggles par categorie/canal |
| `frontend/src/pages/DashboardPage.tsx` | Integrer dans onglet parametres |
| `frontend/supabase/functions/notify-order-status/index.ts` | Modifier — lire les preferences avant d'envoyer |

---

### 11. Avis avec verification d'achat

**Pas de migration** — la logique utilise les tables `orders` + `order_items` existantes.

| Fichier | Action |
|---------|--------|
| `frontend/src/components/reviews/ReviewForm.tsx` | Modifier — verifier que l'utilisateur a une commande livree pour ce produit avant de permettre l'envoi ; ajouter badge "Achat verifie" ; rendre les photos encouragees (pas obligatoires) pour 4-5 etoiles |
| `frontend/src/components/reviews/ReviewCard.tsx` | Modifier — afficher badge "Achat verifie" |

---

### 12. Chat temps reel ameliore

**Pas de migration** — `stores.is_online` et `stores.last_seen_at` existent deja.

| Fichier | Action |
|---------|--------|
| `frontend/src/components/messages/ChatPanel.tsx` | Modifier — ajouter indicateur "en ligne" (query last_seen_at < 5min), indicateur de frappe (presence channel Supabase), reponses rapides pre-configurees |
| `frontend/src/components/messages/ConversationList.tsx` | Modifier — afficher pastille verte si vendeur en ligne |
| `frontend/src/components/messages/QuickReplies.tsx` | Creer — liste de reponses rapides configurable par le vendeur |

---

### 13. Analytics vendeur avance

**Pas de migration** — donnees dans `orders`, `order_items`, `products`, `returns`.

| Fichier | Action |
|---------|--------|
| `frontend/src/components/vendor/VendorStatsTab.tsx` | Modifier — ajouter : (1) taux de conversion par produit (vues vs achats via `products.views_count`), (2) heures de pointe (histogramme par heure), (3) taux de retour par produit, (4) graphique comparatif vues vs ventes |

---

### 14. Litiges structures — workflow complet

**Migration SQL** :
```sql
CREATE TABLE public.dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'client', -- client, vendor, admin
  content text NOT NULL,
  attachments text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dispute participants read" ON public.dispute_messages FOR SELECT USING (
  sender_id = auth.uid() OR
  dispute_id IN (SELECT id FROM disputes WHERE user_id = auth.uid()) OR
  dispute_id IN (SELECT d.id FROM disputes d JOIN stores s ON s.id = d.store_id WHERE s.owner_id = auth.uid()) OR
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
);
CREATE POLICY "Dispute participants insert" ON public.dispute_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
```

| Fichier | Action |
|---------|--------|
| `frontend/src/components/disputes/DisputeChat.tsx` | Creer — messagerie tripartite (client, vendeur, admin) avec timeline |
| `frontend/src/components/disputes/DisputesList.tsx` | Modifier — ouvrir DisputeChat au clic |
| `frontend/src/components/vendor/VendorDisputesTab.tsx` | Modifier — integrer DisputeChat pour reponse vendeur |
| `frontend/src/pages/admin/AdminDisputesPage.tsx` | Modifier — integrer DisputeChat pour arbitrage admin |

---

### 15. Export comptable CSV/PDF

**Pas de migration** — lecture seule sur tables existantes.

| Fichier | Action |
|---------|--------|
| `frontend/src/components/exports/ExportButton.tsx` | Creer — bouton generique qui genere CSV a partir de donnees |
| `frontend/src/components/vendor/VendorWalletTab.tsx` | Modifier — ajouter bouton export CSV (transactions, commissions) |
| `frontend/src/components/vendor/VendorStatsTab.tsx` | Modifier — ajouter export CSV ventes |
| `frontend/src/pages/admin/AdminVendorAccountingPage.tsx` | Modifier — ajouter export CSV/PDF comptabilite globale |

---

### Ordre d'implementation

1. **Flash Sales** (migration + UI admin + section accueil)
2. **Comparateur** (100% frontend, pas de migration)
3. **Avis verifies** (modification ReviewForm, pas de migration)
4. **Chat ameliore** (presence Supabase, reponses rapides)
5. **Analytics vendeur** (enrichir VendorStatsTab)
6. **Notifications preferences** (migration + UI + edge function)
7. **Litiges structures** (migration + messagerie tripartite)
8. **Export comptable** (CSV generation)

### Resume : ~20 fichiers crees/modifies, 3 migrations SQL

C'est un plan consequent. Je propose de l'implementer par blocs de 2-3 fonctionnalites a la fois pour eviter les erreurs. On commence par les points 8-9-11 (Flash Sales + Comparateur + Avis verifies) ?

