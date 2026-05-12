## Contexte

Aujourd'hui en prod, l'admin ne voit que 5 onglets de rôles : `Client / Admin / Manager / Vendeur / Transporteur / Livreur`. Le label « Transporteur » est en réalité le rôle DB `shipper` (hub local). Les 2 rôles métier critiques pour la chaîne logistique — **`forwarder`** (transitaire international Chine→RDC) et **`operator`** (entreprise de livraison last-mile) — sont **inexistants à l'écran**, et probablement absents de l'enum `app_role` en prod.

Résultat : impossible d'attribuer le rôle `forwarder` à un utilisateur, donc les espaces `/forwarder/*` et `/operator/*` ne servent à personne en production.

## Vérité des 7 rôles (cible)

| Rôle DB | Libellé UI cible (FR / EN) | Métier |
|---|---|---|
| `admin` | Admin / Admin | Staff plateforme |
| `manager` | Manager / Manager | Staff plateforme |
| `vendor` | Vendeur / Vendor | Propriétaire boutique |
| `forwarder` | **Transitaire** / Forwarder | Fret international (DHL, agences sino-congolaises) |
| `shipper` | **Hub local** / Hub agent | Réception conteneur, photo, dispatch |
| `operator` | **Entreprise de livraison** / Delivery operator | Société last-mile avec flotte + tarifs quartier |
| `rider` | Livreur / Rider | Personne physique qui livre |

Plus jamais le mot « Transporteur » tout court.

## Plan d'exécution

### Lot R1 — Audit base prod (lecture seule, 10 min)

Avant tout, exécuter ces 2 requêtes sur la prod (`vpt…yxf`) via Supabase SQL Editor :

```sql
-- 1. Liste des valeurs enum
SELECT unnest(enum_range(NULL::public.app_role))::text AS role;

-- 2. Comptage des assignations existantes
SELECT role, count(*) FROM public.user_roles GROUP BY role ORDER BY 2 DESC;
```

→ Détermine si la migration R2 doit créer les enum values ou juste vérifier.

### Lot R2 — Migration idempotente enum + backfill

Une migration unique `*_logistics_roles_canonical.sql` qui :

1. `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'forwarder';`
2. `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';`
3. Backfill : pour chaque `delivery_operators.owner_user_id` existant, insère `user_roles(user_id, role='operator')` `ON CONFLICT DO NOTHING`.
4. Backfill : pour chaque `forwarders.linked_transporter_user_id` (ou équivalent), insère `user_roles(user_id, role='forwarder')` `ON CONFLICT DO NOTHING`.
5. Pas de policy à rajouter (RLS user_roles existe déjà).

Déploiement : commit sur `develop` → PR → `main` → GitHub Actions pousse en prod.

### Lot R3 — Source de vérité unique des libellés (frontend)

Créer `frontend/src/lib/role-labels.ts` :

```ts
export const ROLE_LABELS_FR: Record<AppRole | "customer", string> = {
  admin: "Admin",
  manager: "Manager",
  vendor: "Vendeur",
  forwarder: "Transitaire",
  shipper: "Hub local",
  operator: "Entreprise de livraison",
  rider: "Livreur",
  customer: "Client",
};
export const ROLE_LABELS_EN: Record<...> = { ... };
export function roleLabel(role, lang): string { ... }
```

Puis remplacer les mappings dispersés dans :

- `frontend/src/pages/admin/AdminUsersPage.tsx`
- `frontend/src/components/admin/UserDetailDrawer.tsx`
- `frontend/src/components/admin/dashboard/OverviewTab.tsx`
- `frontend/src/pages/admin/AdminLogisticsPage.tsx`
- `frontend/src/pages/admin/AdminNotificationsPage.tsx`

### Lot R4 — Admin Users : 2 onglets + drawer d'attribution

Dans `AdminUsersPage.tsx` :

1. Ajouter onglets `Transitaire` + `Entreprise livraison` à la barre de filtres.
2. Compter via `user_roles` (count par rôle).
3. Dans `UserDetailDrawer`, exposer les 7 cases à cocher de rôles (admin only) avec garde-fous (ne pas pouvoir cocher `operator` sans qu'il y ait une ligne `delivery_operators` correspondante — proposer un lien direct vers la page de création).

### Lot R5 — i18n + documentation

1. Ajouter ~20 clés dans `I18nContext.tsx` (`role.forwarder`, `role.shipper`, `role.operator`, etc.) FR + EN.
2. Mettre à jour `mem://auth/logistics-roles-canonical` avec les libellés UI définitifs.
3. Court paragraphe dans `docs/ARCHITECTURE.md` section « Rôles ».

## Ce qui n'est PAS dans ce plan (volontairement)

- Pas de refonte des espaces `/forwarder/*` ni `/operator/*` — c'était le sujet précédent (lots F1→F5 sur les dates d'expédition côté transitaire).
- Pas de migration des données `forwarder_handoffs` (intacte).
- Pas de changement de policies RLS existantes.

## Ordre recommandé

R1 (audit) → R2 (migration) → R3 (labels) → R4 (admin UI) → R5 (i18n + docs).

R1 doit être fait avant R2 pour décider si on déclenche réellement la migration ou si elle sera un no-op. Les 4 lots suivants peuvent s'enchaîner sans pause.