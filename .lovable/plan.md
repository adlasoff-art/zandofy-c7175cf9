## Diagnostic préalable

**Stack ciblée** : Production = GitHub `main` → Vercel (`zandofy.com`) → Supabase perso (`vpt...yxf`). La preview Lovable Cloud (`uog...zpu`) ne sert qu'à tester l'UI.

**Ce qui existe déjà**
- `openStoreWhatsApp()` (`frontend/src/lib/whatsapp.ts`) appelle l'edge function sécurisée `get-store-whatsapp` qui renvoie le numéro pour les utilisateurs connectés.
- Bucket `chat-media` existe en prod (Supabase perso) avec 3 policies RLS (INSERT auth, SELECT participants, DELETE owner) — vérifié.
- Le `ChatPanel` (`frontend/src/components/messages/ChatPanel.tsx`, lignes 439-449) affiche déjà l'image+nom+prix du produit dans son header — mais seulement si `conversation.product_image` est rempli. À vérifier côté vendeur (vue store-owner).
- Listings produits utilisent déjà `PRODUCT_LIST_SELECT` allégé + `useLazyImage` avec IntersectionObserver.

**Causes probables des 3 problèmes signalés**

1. **Bouton WhatsApp inopérant**  
   Suspects : (a) `window.open` bloqué par le navigateur car appelé après un `await` async (perte du "user gesture"), (b) edge function `get-store-whatsapp` qui renvoie 401 silencieusement si la session JWT est expirée, (c) `whatsapp_number` vide pour la boutique testée.

2. **`Bucket not found` dans le chat interne**  
   Le bucket existe en prod mais pas forcément sur tous les environnements. Symptômes possibles : (a) bucket absent sur l'instance interrogée, (b) policy SELECT trop restrictive bloquant le `getPublicUrl`, (c) requête routée vers la mauvaise instance Supabase. Le bucket est privé (`public=false`) mais le code utilise `getPublicUrl` → URL non signée → renvoie 404 si l'objet n'est pas accessible publiquement.

3. **Lenteur images / pages produits (250 users, 549 produits)**  
   Suspects : (a) pas d'`OptimizedImage` central avec `srcset`/`sizes`/`width`/`height` → CLS + downloads non-responsive, (b) les images `product_images` sont chargées sans transformation (pas de redimensionnement Supabase Storage), (c) pas de `fetchpriority=high` sur les LCP, (d) pas de cache HTTP long sur les médias, (e) preconnect manquant vers le CDN Supabase.

---

## Lot 1 — WhatsApp & bucket chat-media (priorité bloquante)

### 1.1 Bouton WhatsApp
- Modifier `openStoreWhatsApp` pour **ouvrir l'onglet immédiatement** (pendant le user gesture) avec un placeholder, puis rediriger après réception du numéro :
  ```text
  const win = window.open("about:blank", "_blank");
  ... fetch numéro ...
  if (win) win.location = url; else fallback(url);
  ```
- Si l'edge function renvoie 401 → forcer un `supabase.auth.refreshSession()` puis retry une fois.
- Toast clair si `whatsapp_number` est vide (« Cette boutique n'a pas configuré WhatsApp »).
- Ajouter logging structuré dans l'edge function pour traquer les vrais 401/404.

### 1.2 Bucket chat-media
- **Migration SQL idempotente** qui :
  - crée le bucket `chat-media` s'il n'existe pas (privé),
  - rejoue les 3 policies RLS (INSERT auth, SELECT participants conversation, DELETE owner) sur staging + prod.
- **Côté frontend** : remplacer `getPublicUrl` (incompatible bucket privé) par `createSignedUrl(filePath, 60*60*24*7)` au moment de l'envoi du message — le contenu stocké dans `messages.content` deviendra une signed URL longue durée. Pour la rétrocompatibilité, ajouter un helper `resolveChatMediaUrl()` qui détecte les URLs `/object/public/chat-media/...` et les re-signe à la volée à l'affichage.
- Audit similaire sur les autres buckets cités via `getPublicUrl` (`product-media`, `cms-assets`, etc.) — ceux qui sont déjà publics ne sont pas concernés.

---

## Lot 2 — Bandeau produit côté vendeur dans le chat

- Vérifier que `ConversationList.loadConversations` enrichit déjà `product_image`/`product_name`/`product_price` pour les conversations où `is_store_owner=true` (le code actuel le fait : la jointure `products` est commune aux deux cas — à confirmer en lecture).
- S'assurer que le header du `ChatPanel` rend l'image produit même quand `conversation.is_store_owner=true` (suppression d'un éventuel garde conditionnel).
- Ajouter dans le header un petit lien « Voir le produit » qui pointe vers la page produit (utile aux vendeurs pour répondre).
- Ajouter le mini-bandeau produit également dans `ConversationList` (déjà partiellement présent ligne 315-325) pour les conversations vendeur.

---

## Lot 3 — Audit performance & images (sans rien casser)

### 3.1 Composant image central
- Créer `OptimizedImage` (wrapper sur `<img>`) avec :
  - `loading="lazy"` (sauf premier viewport ⇒ `eager` + `fetchpriority="high"`),
  - `decoding="async"`,
  - `width` et `height` explicites pour éviter le CLS,
  - support automatique de `srcset` à partir des transformations Supabase Storage : `?width=400&quality=70` / `?width=800` / `?width=1200`,
  - placeholder couleur dominante / blur-up.
- Migrer `ProductCard`, `HeroBanner`, `CategoryBanner`, `RecommendationsSection`, `FeaturedSidebar`, `BlogPostPage` vers `OptimizedImage` (rétrocompatible : si pas de transformation possible, fallback `<img>` simple).

### 3.2 Listings & requêtes
- Audit des appels `fetchProducts` sans `limit` → forcer une pagination par défaut (24) sur toutes les pages qui n'en demandent pas.
- Vérifier qu'aucune page n'appelle `PRODUCT_SELECT` (lourd) là où `PRODUCT_LIST_SELECT` suffit.
- Ajouter un index composite manquant si nécessaire (`products(publish_status, created_at desc)`) — à valider avec `EXPLAIN ANALYZE` avant migration.

### 3.3 Cache, CDN et preconnect
- Ajouter `<link rel="preconnect">` vers `vpt...supabase.co` dans `frontend/index.html`.
- Vérifier que les images uploadées passent bien par les transformations Storage avec `cacheControl: "31536000"` (déjà présent côté chat-media, à étendre à `product-media` à l'upload).
- Vérifier dans `frontend/public/sw.js` la stratégie de cache des images produits (long-terme, hors `index.html`).

### 3.4 Profilage avant/après
- Lancer `browser--performance_profile` sur la page d'accueil et une page boutique avant et après chaque sous-lot pour mesurer LCP / nombre de requêtes / poids transféré.

---

## Détails techniques

```text
Ordre de déploiement recommandé :
  1. PR Lot 1.1 (WhatsApp)              → frontend only, pas de migration
  2. PR Lot 1.2 (chat-media)            → migration SQL + frontend
  3. PR Lot 2   (bandeau vendeur)       → frontend only
  4. PR Lot 3.1+3.3 (images + preconnect) → frontend only
  5. PR Lot 3.2 (pagination + indexes)  → frontend + éventuelle migration
```

**Garde-fous**
- Aucune modification de `src/integrations/supabase/{client,types}.ts`.
- Toute migration SQL est idempotente (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
- Les anciennes URLs publiques `chat-media` restent affichables grâce au resolver côté lecture.
- Aucune API publique modifiée → pas de régression côté Vercel/edge functions existantes.
- Mesure systématique avant/après via le profileur navigateur.

**Validation**
- Test WhatsApp : connecté + boutique avec numéro → ouvre wa.me. Boutique sans numéro → toast explicite. Anonyme → bouton « Se connecter ».
- Test chat upload : image PNG/JPG/WEBP/PDF jusqu'à 3 Mo, lecture par les deux parties.
- Test bandeau vendeur : ouvrir une conversation côté store-owner, voir nom + image + prix produit.
- Perf : LCP page d'accueil < 2,5 s sur 4G simulée.
