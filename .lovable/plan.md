

# Plan de correction : Sécurité (72% → 85%+) et Préparation SEO complète

## Contexte

Le site fonctionne à nouveau. Ce plan corrige les vulnérabilités restantes et prépare l'infrastructure SEO complète, le tout sans risquer de casser la plateforme. Chaque lot est indépendant et réversible.

---

## PARTIE A — Corrections de sécurité (5 lots)

### Lot A1 : Sécuriser order_status_history (Critique)

**Problème** : Tout utilisateur authentifié peut insérer dans `order_status_history` via la politique `WITH CHECK (auth.uid() IS NOT NULL)`. Un utilisateur malveillant pourrait falsifier l'historique de n'importe quelle commande.

**Correction** : Remplacer la politique INSERT par une vérification que l'utilisateur est soit admin/manager, soit propriétaire du store de la commande, soit le trigger système. En pratique, les insertions viennent déjà du trigger `log_order_status_change()` (SECURITY DEFINER). On peut donc restreindre l'INSERT aux seuls admin/manager/vendor concerné.

**Risque de casse** : Aucun. Les insertions sont faites par le trigger (SECURITY DEFINER bypass RLS). Le frontend n'insère jamais directement dans cette table.

**Migration SQL** :
- DROP l'ancienne politique INSERT
- Créer une nouvelle politique : `WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR order_id IN (SELECT id FROM orders WHERE can_access_store_orders(auth.uid(), store_id)))`

---

### Lot A2 : Sécuriser error_reports INSERT (Moyenne)

**Problème** : La politique INSERT est `WITH CHECK (true)` — n'importe qui peut soumettre un rapport d'erreur avec un `user_id` et `user_email` arbitraires.

**Correction** : Forcer `user_id = auth.uid()` quand l'utilisateur est connecté, et autoriser l'insertion anonyme sans `user_id`.

**Risque de casse** : Faible. Vérifier que le code frontend qui insère dans `error_reports` passe bien `auth.uid()` comme `user_id`. Si le code passe `null`, l'insertion anonyme reste autorisée.

**Migration SQL** :
- DROP la politique INSERT existante
- Créer : `WITH CHECK ((auth.uid() IS NULL AND user_id IS NULL) OR (auth.uid() IS NOT NULL AND user_id = auth.uid()))`

---

### Lot A3 : Renforcer analytics_events INSERT (Moyenne)

**Problème** : L'insertion est déjà partiellement validée (`length(session_id) > 0 AND length(event_type) > 0`), mais le champ `user_id` peut être arbitraire.

**Correction** : Ajouter la vérification `user_id IS NULL OR user_id = auth.uid()` pour empêcher l'usurpation d'identité dans les analytics.

**Risque de casse** : Très faible. Le hook `use-analytics.ts` passe déjà `user?.id` qui correspond à `auth.uid()`. Le `sendBeacon` pour `session_end` utilise l'API REST sans JWT, donc `user_id` ne sera pas vérifié — mais il est envoyé en best-effort. On s'assure que le `sendBeacon` passe toujours le bon header `apikey`.

**Migration SQL** :
- DROP et recréer la politique INSERT avec : `WITH CHECK (length(session_id) > 0 AND length(event_type) > 0 AND (user_id IS NULL OR user_id = auth.uid()))`

**Point d'attention** : Le `sendBeacon` dans `use-analytics.ts` envoie via REST sans JWT. Ces insertions arriveront en tant que `anon`, donc `auth.uid()` sera NULL. Le `user_id` envoyé dans le payload sera rejeté si non-null. Il faut modifier le code pour envoyer `user_id: null` dans le beacon `session_end`, ou accepter que cet événement perde le `user_id`. C'est un compromis acceptable pour la sécurité.

**Modification code** : Dans `use-analytics.ts`, le `sendBeacon` pour `session_end` devra omettre `user_id` (ou le mettre à null) puisque le beacon n'a pas de JWT.

---

### Lot A4 : Protéger les données sensibles des stores (Haute)

**Problème** : La politique SELECT sur `stores` est `USING (true)` — tout le monde voit `ban_reason`, `suspension_reason`, `whatsapp_number`.

**Solution choisie** : Ne PAS toucher la politique `stores` directement (risque de casse élevé vu les 37 fichiers qui lisent `stores`). À la place :
1. La vue `stores_public` existe déjà et exclut ces champs sensibles
2. Migrer progressivement les lectures publiques (StorePage, StoresPage, ProductCard) vers `stores_public`
3. Les lectures privées (VendorDashboard, Admin) continuent d'utiliser `stores` directement car l'utilisateur est propriétaire ou admin

**Détail des fichiers à modifier** :
- `StorePage.tsx` : la requête SELECT publique charge `whatsapp_number` — à remplacer par un appel séparé conditionnel (charger le numéro uniquement pour construire le lien `wa.me`, sans l'exposer dans le DOM)
- `StoresPage.tsx` : basculer vers `stores_public`
- `VendorProfileCard.tsx` : le `whatsapp_number` est utilisé pour le lien WhatsApp — garder mais ne pas afficher le numéro en clair

**Risque de casse** : Modéré. Chaque fichier sera modifié individuellement. La vue `stores_public` inclut déjà `owner_id`, `is_platform_owned`, etc. Les colonnes manquantes (`whatsapp_number`, `ban_reason`, `suspension_reason`) ne sont pas nécessaires pour l'affichage public.

---

### Lot A5 : Sécuriser Realtime (Critique)

**Problème** : Les tables suivantes sont dans `supabase_realtime` sans filtre côté canal :
- `notifications` — un utilisateur pourrait écouter les notifications d'un autre
- `messages` — idem pour les messages privés
- `orders` — les commandes de tous les utilisateurs
- `payment_transactions`, `customer_locations`, `rider_locations`

**Correction** : Les politiques RLS s'appliquent déjà au Realtime (Supabase filtre par RLS sur les événements postgres_changes). Le risque est donc atténué par les politiques SELECT existantes. Cependant, vérification nécessaire :
- `notifications` : la politique SELECT filtre bien `user_id = auth.uid()` ✓
- `messages` : filtré par conversation membership ✓  
- `orders` : filtré par `user_id = auth.uid()` ou `store_id` du vendeur ✓

**Action** : Retirer de `supabase_realtime` les tables qui n'ont pas besoin de realtime ET qui exposent des données sensibles :
- `payment_transactions` — retirer (les mises à jour de paiement peuvent être gérées par polling)
- `customer_locations` — retirer
- `rider_locations` — retirer

**Risque de casse** : Faible. Ces tables sont utilisées en realtime dans le tracking de livraison. Vérifier que le code utilise un polling fallback ou que le retrait n'impacte pas l'UX critique. Si le tracking temps réel est essentiel, on peut garder ces tables dans realtime mais s'assurer que les politiques SELECT sont strictes (elles le sont déjà, filtrées par `order_id` et rôle).

**Recommandation** : Garder `rider_locations` et `customer_locations` dans realtime (nécessaire pour le tracking en direct) mais confirmer que les RLS SELECT sont bien restrictives. Ne retirer que `payment_transactions`.

---

## PARTIE B — Préparation SEO (6 lots)

### Lot B1 : Corriger index.html — Twitter et OG par défaut

**Modifications** :
- Ligne 35 : `@Lovable` → `@Zandofy`
- Lignes 33, 36 : L'image OG par défaut pointe vers un screenshot Lovable. Remplacer par une URL configurable. En attendant l'upload admin, pointer vers le logo existant `/icons/icon-512.png` ou un asset du bucket storage.

**Risque de casse** : Zéro.

---

### Lot B2 : Ajouter un champ OG image dans l'admin

**Modifications** :
- Ajouter la clé `default_og_image` dans `platform_settings` (via INSERT, pas migration)
- Dans la page admin SEO/Branding existante, ajouter un champ d'upload pour l'image OG par défaut
- Modifier `SEOHead.tsx` pour lire cette image depuis les settings quand aucune `ogImage` spécifique n'est fournie

**Risque de casse** : Zéro (ajout pur).

---

### Lot B3 : Sitemap dynamique

**Modifications** :
- L'edge function `generate-sitemap` existe déjà et génère un sitemap dynamique avec produits, catégories et stores
- Remplacer le `sitemap.xml` statique par un redirect vers l'edge function, ou mieux : mettre à jour `robots.txt` pour pointer vers l'URL de l'edge function
- Ajouter les slugs de produits dans le sitemap (déjà fait dans la function via `p.slug || p.id`)
- Ajouter un slug pour les stores (migration pour ajouter une colonne `slug` à `stores` + auto-génération)

**Risque de casse** : Faible. L'edge function existe, il suffit de la rendre accessible.

---

### Lot B4 : Slugs pour les stores

**Problème** : Les URLs de boutiques utilisent `/store/:id` (UUID). Mauvais pour le SEO.

**Modifications** :
- Migration : ajouter colonne `slug` à `stores` (nullable, unique)
- Migration : trigger pour auto-générer le slug à partir du `name` lors de l'INSERT/UPDATE
- Migration : backfill les stores existants avec un slug
- Modifier `App.tsx` : la route `/store/:id` accepte déjà un paramètre dynamique — modifier `StorePage.tsx` pour chercher par slug OU par UUID
- Modifier les liens dans le frontend pour utiliser `store.slug || store.id`

**Risque de casse** : Modéré. Les anciens liens par UUID doivent continuer à fonctionner (fallback). Le code de StorePage devra tenter slug d'abord, puis UUID.

---

### Lot B5 : Balises hreflang et canonical dynamiques

**Modifications** :
- Dans `SEOHead.tsx` : ajouter injection de `<link rel="alternate" hreflang="fr" href="...">` et `hreflang="x-default"`
- La plateforme est principalement en français avec contenu parfois en anglais. Pour l'instant, un seul hreflang `fr` + `x-default` suffit
- Les canonicals dynamiques sont déjà gérés par `SEOHead.tsx` quand `canonical` est passé en prop — s'assurer que toutes les pages passent bien cette prop

**Risque de casse** : Zéro (ajout de balises `<link>` dans le `<head>`).

---

### Lot B6 : Meta descriptions dynamiques par page

**Modifications** : S'assurer que chaque page utilise `SEOHead` avec des descriptions pertinentes :
- **Accueil** : utilise déjà `useSeoConfig()` → configurable par admin ✓
- **Recherche** : ajouter `SEOHead` si absent, avec description dynamique incluant le terme recherché
- **Catégorie** : description incluant le nom de catégorie
- **Produit** : déjà implémenté avec JSON-LD ✓
- **Boutique** : ajouter description avec nom de boutique et méta du store (`meta_title`, `meta_description`)
- **FAQ, About, Terms, Privacy** : descriptions statiques mais pertinentes

**Risque de casse** : Zéro (ajout/amélioration de meta tags).

---

## PARTIE C — Éléments RLS `USING (true)` (consultation seulement)

**Problème signalé** : Certaines tables ont des politiques SELECT avec `USING (true)`.

**Tables concernées** (vérification nécessaire) : `stores`, `products`, `categories`, `reviews`, etc.

**Analyse** : Pour une marketplace publique, les produits, catégories, stores et avis DOIVENT être lisibles publiquement. Le `USING (true)` sur ces tables est normal et attendu. Le vrai problème n'est pas la permissivité de la lecture, mais les colonnes exposées (résolu par les vues `stores_public` et `products_public`).

**Recommandation** : Ne PAS restreindre le SELECT sur `stores` ou `products` — utiliser les vues publiques pour contrôler les colonnes exposées. C'est l'approche la plus sûre et la plus stable.

---

## Résumé des risques par lot

| Lot | Risque | Impact si erreur |
|-----|--------|-----------------|
| A1 order_status_history | Nul | Trigger SECURITY DEFINER bypass RLS |
| A2 error_reports | Faible | Rapports d'erreur anonymes perdus si mal configuré |
| A3 analytics_events | Faible | sendBeacon perd le user_id (acceptable) |
| A4 stores données sensibles | Modéré | Changement progressif, testable par page |
| A5 Realtime | Faible | RLS filtre déjà, retrait limité |
| B1 Twitter/OG | Nul | Changement de texte statique |
| B2 OG image admin | Nul | Ajout pur |
| B3 Sitemap dynamique | Faible | Edge function existante |
| B4 Slugs stores | Modéré | Fallback UUID préservé |
| B5 hreflang | Nul | Ajout de balises |
| B6 Meta descriptions | Nul | Ajout/amélioration |

---

## Ordre d'exécution recommandé

1. **A1 + A2 + A3** (migrations SQL, risque quasi nul)
2. **B1** (correction Twitter/OG dans index.html)
3. **B5 + B6** (SEO meta tags, risque zéro)
4. **A5** (Realtime — retirer `payment_transactions` de la publication)
5. **B2** (OG image admin)
6. **B3** (Sitemap dynamique)
7. **A4** (Migration progressive stores → stores_public)
8. **B4** (Slugs stores — le plus complexe, en dernier)

Chaque lot peut être déployé et testé indépendamment. Si un lot cause un problème, il est isolé et réversible sans impacter les autres.

