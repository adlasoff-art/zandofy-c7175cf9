

## Objectif immédiat

Ajouter le filtre "Client" dans `/admin/users` (logique frontend uniquement, zéro migration).

## Changements

**Fichier unique** : `frontend/src/pages/admin/AdminUsersPage.tsx`

1. Étendre le type `RoleFilter` : `"all" | "customer" | AppRole`
2. Insérer `"customer"` dans la liste des chips entre `"all"` et `ALL_ROLES`
3. Mettre à jour la logique de filtrage :
   ```ts
   const matchesRole =
     roleFilter === "all" ||
     (roleFilter === "customer" && u.roles.length === 0) ||
     (roleFilter !== "customer" && u.roles.includes(roleFilter as AppRole));
   ```
4. Afficher le compteur dans le chip : `Client (X)` où X = `users.filter(u => u.roles.length === 0).length`
5. Le label "Client" est déjà dans `roleLabels` — rien à ajouter côté i18n

## Comportement final

- Nouveau chip "Client (X)" visible juste après "Tous (Y)"
- Clic → table filtrée sur les profils sans rôle staff
- Compatible avec les autres filtres (statut, genre, âge, recherche, localisation)
- Export CSV respecte automatiquement le filtre

## Hors scope (à faire plus tard quand on franchira ~500-600 clients, estimé juillet-août)

- Vue SQL `v_customers`
- Dashboard pilotage croissance (CAC, cohortes, LTV)
- Archivage `automation_events` 90j

