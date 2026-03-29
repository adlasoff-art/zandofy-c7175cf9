

## Plan : Refonte Impersonation (session réelle) + Pagination globale

### Partie 1 : Impersonation — Architecture

**Problème actuel** : L'impersonation est en "lecture seule" dans un panneau overlay sur le même onglet. Pas de vraie session utilisateur, pas d'actions possibles.

**Nouvelle approche** : Impersonation par session réelle via Edge Function + nouvel onglet.

```text
┌──────────────────────────────────────────────────┐
│  Admin Tab (onglet existant)                     │
│  1. Clic "Se connecter en tant que [User]"       │
│  2. Appel Edge Function "impersonate-user"       │
│     → Génère un token d'impersonation signé      │
│     → Log audit (admin_id, target_id, timestamp) │
│  3. window.open("/impersonate?token=xxx", "_blank")│
│  4. L'onglet admin reste intact (pas de refresh) │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Nouvel onglet (session impersonée)              │
│  1. /impersonate?token=xxx                       │
│  2. Valide le token, signe une session Supabase  │
│     via sign-in custom (Edge Function)           │
│  3. Stocke l'admin_id original en sessionStorage │
│     (pour le bandeau + bouton retour)            │
│  4. Redirige vers le dashboard approprié         │
│     (client/vendeur/rider/etc. selon rôles)      │
│  5. Bandeau fixe : "Session admin — connecté     │
│     en tant que [Nom] · [Revenir admin]"         │
│  6. Bouton "Revenir en tant qu'admin" :          │
│     → Appel Edge Function pour restaurer session │
│     → Redirige vers /admin/users                 │
│  7. Si refresh sans retour → la session active   │
│     est celle de l'utilisateur impersoné         │
└──────────────────────────────────────────────────┘
```

### Fichiers à créer/modifier

#### Edge Function : `supabase/functions/impersonate-user/index.ts`
- Action `start` : Vérifie que l'appelant est admin/manager (via JWT), génère un token d'impersonation court (5 min, usage unique), log dans `admin_audit_logs`
- Action `exchange` : Reçoit le token d'impersonation, crée une session Supabase réelle pour l'utilisateur cible via `supabase.auth.admin.generateLink()` ou `signInWithPassword` admin-side, retourne les tokens de session
- Action `restore` : Reçoit l'admin_id stocké, restaure la session admin, log la fin d'impersonation

#### Table : `impersonation_tokens` (migration)
```sql
CREATE TABLE public.impersonation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  admin_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.impersonation_tokens ENABLE ROW LEVEL SECURITY;
-- Pas de policy publique — accessible uniquement via SECURITY DEFINER / Edge Function
```

#### Frontend

| Fichier | Modification |
|---|---|
| `frontend/src/pages/ImpersonatePage.tsx` | **Nouveau** — Route `/impersonate`, échange le token, établit la session, affiche le bandeau, redirige |
| `frontend/src/components/ImpersonationBanner.tsx` | **Nouveau** — Bandeau fixe en haut avec nom utilisateur + bouton "Revenir en tant qu'admin" |
| `frontend/src/components/admin/UserDetailDrawer.tsx` | Modifier le bouton : texte → "Se connecter en tant que cet utilisateur", action → `window.open(url, "_blank")` |
| `frontend/src/contexts/ImpersonationContext.tsx` | Simplifier : ne gère plus de state overlay, juste un helper pour détecter si on est en session impersonée (via `sessionStorage`) |
| `frontend/src/components/admin/ImpersonationPanel.tsx` | **Supprimer** — Plus nécessaire (remplacé par session réelle) |
| Route config (`App.tsx` ou routeur) | Ajouter `/impersonate` comme route publique |

#### Flux détaillé

1. Admin clique "Se connecter en tant que [User]" dans le drawer
2. Appel Edge Function → crée un `impersonation_token` (expire 5 min)
3. `window.open("/impersonate?token=xxx", "_blank")`
4. La page `/impersonate` appelle l'Edge Function avec le token
5. L'Edge Function valide le token, marque `used=true`, utilise le service_role pour créer un `magic link` ou signer un JWT custom pour l'utilisateur cible
6. Le front reçoit la session, la stocke via `supabase.auth.setSession()`
7. `sessionStorage.setItem("impersonation_admin_id", adminId)`
8. Redirection automatique vers le dashboard approprié selon les rôles
9. Le bandeau persiste tant que `sessionStorage` contient `impersonation_admin_id`
10. "Revenir admin" → supprime sessionStorage, appelle l'Edge Function `restore`, `supabase.auth.setSession(adminTokens)`, redirige `/admin/users`

#### Permissions
- Seuls `admin` et `manager` peuvent déclencher l'impersonation
- Le manager ne peut pas impersoner un admin (vérification côté Edge Function)
- Chaque action est loguée dans `admin_audit_logs`

---

### Partie 2 : Pagination globale

**Constat** : Seul `AdminUsersPage` a une pagination basique (15 items, Précédent/Suivant). Pas de sélecteur de taille de page, pas de numéros de pages.

#### Composant réutilisable : `frontend/src/components/ui/DataTablePagination.tsx`

Props : `totalItems`, `currentPage`, `pageSize`, `onPageChange`, `onPageSizeChange`, `pageSizeOptions` (défaut: [25, 50, 100])

Fonctionnalités :
- Sélecteur de nombre d'items par page (25, 50, 100)
- Numéros de pages cliquables (avec ellipsis pour les grandes listes)
- Boutons Précédent/Suivant
- Texte "Affichage 1-25 sur 342 résultats"

#### Pages à équiper

| Page / Composant | Localisation |
|---|---|
| `AdminUsersPage` | Remplacer la pagination existante par le nouveau composant |
| `VendorOrderManager` | Ajouter pagination aux commandes |
| `VendorProductManager` | Ajouter pagination aux produits |
| `VendorSuppliersTab` | Ajouter pagination aux fournisseurs |
| `AdminOrdersPage` (si existe) | Ajouter pagination |
| Toute liste admin avec `>25` items potentiels | Identifier et équiper |

---

### SQL à exécuter manuellement

```sql
-- Table tokens d'impersonation
CREATE TABLE IF NOT EXISTS public.impersonation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  admin_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.impersonation_tokens ENABLE ROW LEVEL SECURITY;
```

### Ordre d'implémentation

1. Migration SQL + Edge Function `impersonate-user`
2. Page `/impersonate` + bandeau + routing
3. Modifier `UserDetailDrawer` (nouveau bouton)
4. Nettoyer ancien système (ImpersonationPanel, ancien contexte)
5. Composant `DataTablePagination`
6. Appliquer la pagination sur toutes les pages listées

