## Affinage UX `/forwarder/*` — espace transitaire complet

Aujourd'hui `/forwarder` = une seule page « passive » (lecture KYB + docs). Objectif : transformer en vrai espace de travail aligné sur `/operator/*` et `/admin/forwarders`, avec **tarifs auto-éditables**.

### Pré-requis DB (1 migration)

`forwarder_pricing_profiles`, `forwarder_kg_tiers`, `forwarder_cbm_tiers`, `forwarder_piece_tiers`, `forwarder_surcharges` n'autorisent en écriture que les admins. Ajouter des policies "owner peut gérer ses propres profils + tiers + surcharges, uniquement si forwarder approuvé".

```sql
-- Policy : un forwarder approuvé peut SELECT/INSERT/UPDATE/DELETE
-- ses profils. Helper has_forwarder_access(profile_id, auth.uid()).
CREATE OR REPLACE FUNCTION public.user_owns_forwarder_profile(_profile_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM forwarder_pricing_profiles p
    JOIN forwarders f ON f.id = p.forwarder_id
    WHERE p.id = _profile_id
      AND f.status = 'approved'
      AND (f.owner_user_id = _user_id OR f.linked_transporter_user_id = _user_id)
  )
$$;
-- + policy équivalente sur forwarders.id pour la création de profils.
```

Livré comme fichier SQL téléchargeable pour exécution en production.

### Layout & routes

- `frontend/src/layouts/ForwarderLayout.tsx` : sidebar + header + statut badges, palette froide bleue dédiée (tokens `--forwarder-*` dans `index.css`, copiés du modèle opérateur).
- Routes ajoutées dans `App.tsx` :
  - `/forwarder` → tableau de bord
  - `/forwarder/profiles` → tarifs (CRUD)
  - `/forwarder/coverage` → routes & restrictions
  - `/forwarder/handoffs` → handoffs reçus / émis (lecture)
  - `/forwarder/settings` → profil + KYB

### Pages

1. **ForwarderDashboardPage (refactor)**
   - KPI : profils actifs, routes couvertes, handoffs 30j, statut KYB, score d'acceptation handoffs.
   - Checklist « mise en route » (au moins 1 profil, 1 route, 1 tier).
   - Statut KYB conservé.

2. **ForwarderProfilesPage (nouveau)**
   - Liste des `forwarder_pricing_profiles` du forwarder courant (filter via `forwarders.owner_user_id = auth.uid()`).
   - Bouton « Nouveau profil » → dialog avec mode (`air | sea | road | rail`), pays/ville origine via `GeoFieldsRow`, transit min/max, devise, deposit %.
   - Drawer d'édition : onglets « Général », « Tiers KG », « Tiers CBM », « Tiers à la pièce », « Surcharges ».
   - Inline CRUD sur tiers + surcharges (CRUD direct sur tables, RLS gère l'accès).
   - Badge `is_active` togglable + soft delete.

3. **ForwarderCoveragePage (nouveau)** — Édite `coverage_routes jsonb` sur la ligne `forwarders` du compte (origin/destination/mode), via un éditeur de lignes simple. Liens vers `forwarder_restrictions` en lecture (admin-managed).

4. **ForwarderHandoffsPage (nouveau)** — Lecture `forwarder_handoffs` filtrée sur `from_forwarder_id` ou `to_forwarder_id` égaux aux ids du transitaire courant. Affiche statut, contrepartie, order_ref, date.

5. **ForwarderSettingsPage (nouveau)** — Identité : `contact_email`, `contact_phone`, `headquarters_address`, `logo_url`, `description`. RCCM/NIF/raison sociale en read-only avec bandeau « contactez le support ». Réutilise les docs KYB de l'ancien dashboard.

### Composant partagé

`ForwarderOnboardingChecklist.tsx` : même pattern que `OperatorOnboardingChecklist`, étapes (KYB approuvé, ≥1 profil, ≥1 tier KG/CBM/piece, ≥1 route).

### Hors scope (à faire après)

- Édition `forwarder_restrictions` (sensibilités douanières — admin-only).
- Édition `forwarder_shipping_templates` (réservée aux profils légués).
- Score d'acceptation détaillé (besoin métrique handoffs déclinés).
- Tableau commission/facturation transitaire (pas de ledger dédié pour l'instant).

### Livrables

- 1 fichier SQL `add_forwarder_self_service_rls.sql` à exécuter en prod.
- `ForwarderLayout.tsx` + 4 nouvelles pages + checklist + ajout des tokens CSS.
- Mise à jour `App.tsx` (routes nested) et `MobileAccountMenu` / `Header` pour exposer le menu transitaire quand le rôle est `forwarder`.
- Mémoire mise à jour : `mem/features/forwarder-self-service-space.md`.
