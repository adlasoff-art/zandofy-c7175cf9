## Avancement constaté (capture du `/admin/users`)

Les 7 onglets sont visibles avec les libellés canoniques : `Tous (318)`, `Client (310)`, `Admin (1)`, `Manager (0)`, `Vendeur (6)`, **`Transitaire (0)`**, **`Hub local (1)`**, **`Entreprise de livraison (1)`**, `Livreur (1)`. La migration enum `forwarder` + `operator` est donc bien appliquée en prod.

État des lots :

- **R1 audit** — fait
- **R2 migration enum + backfill** — appliquée en prod (capture confirme)
- **R3 source unique des libellés** (`role-labels.ts`) — fait
- **R4.1/4.2 onglets admin + comptes par rôle** — fait (capture)
- **R4.3 garde-fou attribution `operator`** — pas encore : aujourd'hui un admin peut cocher `operator` dans le drawer sans qu'il existe de ligne `delivery_operators` correspondante → utilisateur "fantôme" sans entreprise rattachée
- **R5.1 i18n FR + EN** — fait (16 clés `role.*`)
- **R5.2 mémoire** `mem://auth/logistics-roles-canonical` — fait
- **R5.3 documentation `docs/ARCHITECTURE.md`** — pas encore

## Reste à faire (2 items)

### 1. Garde-fou `operator` dans `UserDetailDrawer` (R4.3)

Dans `frontend/src/components/admin/UserDetailDrawer.tsx`, intercepter le clic "+ Ajouter rôle" pour `operator` et `forwarder` :

- **`operator`** : avant l'`INSERT`, vérifier `SELECT id FROM delivery_operators WHERE owner_user_id = user.id LIMIT 1`. Si absent → toast informatif + bouton "Créer une entreprise de livraison" qui ouvre `/admin/operators` (page existante). Pas de blocage dur si l'admin confirme — confirmation modale courte ("Ce rôle ne donnera accès à `/operator/*` qu'une fois une entreprise rattachée. Continuer ?").
- **`forwarder`** : même logique, vérifier `SELECT id FROM forwarders WHERE owner_user_id = user.id OR linked_transporter_user_id = user.id LIMIT 1`. Lien "Créer un transitaire" → `/admin/forwarders`.
- Pour les 5 autres rôles (`admin`, `manager`, `vendor`, `shipper`, `rider`), comportement actuel inchangé.

Aucune migration DB. Pas de policy à ajouter (lecture déjà autorisée à l'admin sur ces tables).

### 2. Doc `docs/ARCHITECTURE.md` — section Rôles (R5.3)

Ajouter (ou mettre à jour si elle existe) une section concise :

````text
## Rôles applicatifs (app_role)

Chaîne logistique :
  vendor → forwarder → shipper → operator → rider → customer

| Rôle DB    | Libellé UI FR              | Espace dédié          |
|------------|----------------------------|-----------------------|
| admin      | Admin                      | /admin/*              |
| manager    | Manager                    | /admin/*              |
| vendor     | Vendeur                    | /dashboard, /vendor   |
| forwarder  | Transitaire                | /forwarder/*          |
| shipper    | Hub local                  | /shipper-dashboard    |
| operator   | Entreprise de livraison    | /operator/*           |
| rider      | Livreur                    | /rider-dashboard      |
````

+ pointer vers `frontend/src/lib/role-labels.ts` comme source unique et vers `mem://auth/logistics-roles-canonical` pour les règles métier.

## Hors scope

- Pas de refonte des espaces `/forwarder/*` ni `/operator/*`.
- Pas de modification des policies RLS.
- Pas de nouvelle migration SQL — la prod est en phase avec le code.

## Ordre

1. Garde-fou drawer (R4.3) — modif d'un seul fichier `UserDetailDrawer.tsx`.
2. Section `docs/ARCHITECTURE.md` (R5.3).

Estimation : 1 cycle d'implémentation court.
