

## Plan : Présence réelle, renommage "Fournisseurs" et collaborateurs boutique

### Résumé des changements

Ce plan couvre 4 axes demandés par l'utilisateur :

---

### 1. Renommage "Boutiques" → "Fournisseurs" sur la page `/stores`

Modifications dans `StoresPage.tsx` uniquement (les textes internes comme "Voir la boutique" restent) :

| Texte actuel | Nouveau texte |
|---|---|
| `{totalStores} boutiques sur Zandofy` | `{totalStores} fournisseurs sur Zandofy` |
| `Explorez nos Boutiques` | `Explorez nos Fournisseurs` |
| `Comparez les vendeurs, découvrez leurs produits et trouvez les boutiques qui correspondent à vos besoins.` | `Comparez les fournisseurs, découvrez leurs produits et trouvez ceux qui correspondent à vos besoins.` |
| `Rechercher une boutique...` | `Rechercher un fournisseur...` |
| Filter chip "Toutes" | "Tous" |
| `Aucune boutique trouvée` | `Aucun fournisseur trouvé` |
| `Aucune boutique ne correspond...` | `Aucun fournisseur ne correspond...` |

"Voir la boutique" dans la card reste inchangé.

---

### 2. Indicateur "En ligne" → couleur jaune + terme "Actif maintenant"

Sur `StoresPage.tsx` (StoreCard) :
- Remplacer les couleurs `emerald` par `amber` (jaune) pour le badge online
- Renommer le texte "En ligne" → "Actif maintenant"
- Le filter chip "En ligne" → "Actifs"

Mêmes changements sur `StorePage.tsx`, `ProductPage.tsx` et `VendorProfileCard.tsx` pour cohérence globale.

---

### 3. Présence basée sur la connexion réelle (Supabase Realtime Presence)

Actuellement `is_online` est une colonne statique dans `stores`. Pour refléter la présence réelle :

**Migration SQL :**
- Ajouter colonne `last_seen_at timestamptz` à la table `stores`
- Créer une fonction RPC `update_store_presence(p_store_id uuid)` qui met à jour `last_seen_at = now()` et `is_online = true`
- Créer une fonction RPC `set_store_offline(p_store_id uuid)` qui met `is_online = false`

**Code frontend :**
- Créer un hook `useStorePresence(storeId)` qui :
  - Appelle `update_store_presence` toutes les 60s via `setInterval` quand le vendeur est sur son dashboard `/vendor`
  - Appelle `set_store_offline` sur `beforeunload` / démontage du composant
- Intégrer ce hook dans le layout vendeur (`VendorLayout` ou page `/vendor`)

**Affichage côté public :** Aucun changement — on continue de lire `is_online` depuis la table `stores`, mais maintenant cette valeur reflète la présence réelle.

---

### 4. Système de collaborateurs boutique

**Migration SQL — nouvelle table `store_collaborators` :**
```sql
CREATE TABLE public.store_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, user_id)
);
```

**Ajouter colonnes à `stores` :**
- `max_collaborators integer DEFAULT 2` — limite par défaut
- `max_collaborators_override integer` — override admin (NULL = utilise la limite du tier)

**Limites par tier** (dans `vendor-tiers.ts`) :
- Beginner : 2 collaborateurs
- Pro : 3 collaborateurs  
- Grand Supplier : 5 collaborateurs

**Admin — page Subscriptions existante :**
Ajouter un champ "Max collaborateurs" éditable par boutique dans `AdminVendorSubscriptionsPage.tsx`, qui écrit dans `max_collaborators_override`.

**Vendeur — nouveau sous-onglet "Équipe" :**
Interface simple dans le dashboard vendeur pour inviter/gérer les collaborateurs (email, statut, suppression). Limité par le plafond du tier ou l'override admin.

**Présence étendue aux collaborateurs :**
Le hook `useStorePresence` sera aussi actif pour les collaborateurs connectés — si n'importe quel membre de l'équipe est en ligne, la boutique affiche "Actif maintenant".

---

### Fichiers modifiés

| Fichier | Action |
|---|---|
| `frontend/src/pages/StoresPage.tsx` | Renommage textes + couleurs amber |
| `frontend/src/pages/StorePage.tsx` | Couleurs amber + "Actif maintenant" |
| `frontend/src/pages/ProductPage.tsx` | Couleurs amber + "Actif maintenant" |
| `frontend/src/components/VendorProfileCard.tsx` | Couleurs amber + "Actif maintenant" |
| `frontend/src/lib/vendor-tiers.ts` | Ajouter `maxCollaborators` par tier |
| `frontend/src/hooks/useStorePresence.ts` | Nouveau — heartbeat présence |
| `frontend/src/pages/admin/AdminVendorSubscriptionsPage.tsx` | Champ override collaborateurs |
| **Migration SQL** | Table `store_collaborators`, colonnes `last_seen_at` + `max_collaborators` + `max_collaborators_override` sur `stores` |

