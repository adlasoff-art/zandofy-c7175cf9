

## Problème

Dans l'onglet Analytics Automation > "Parcours utilisateur", la colonne **Utilisateur** affiche `anon-05c29311` (techniquement laid) même quand un compte existe sans email résolu. Pas adapté pour démos investisseurs.

## Diagnostic rapide

La RPC `get_automation_user_journey` retourne `user_email` (parfois null pour utilisateurs connectés si jointure imparfaite) et `anon_id`. Le frontend (`AdminAutomationAnalyticsTab.tsx`) fait :
```ts
{j.user_email || (j.anon_id ? `anon-${j.anon_id.slice(0, 8)}` : "—")}
```

Deux problèmes :
1. Quand `user_id` existe mais `user_email` est null → on ne fallback pas sur le nom du profil
2. Le label `anon-xxxx` n'est pas présentable

## Solution

### Backend — enrichir la RPC `get_automation_user_journey`

Modifier la fonction SQL pour retourner aussi :
- `user_full_name` (depuis `profiles.full_name` ou `first_name + last_name`)
- garder `user_email` et `anon_id`

Migration SQL à appliquer sur **prod (Supabase.com perso `vpt...yxf`)** via `frontend/supabase/migrations/`.

### Frontend — `AdminAutomationAnalyticsTab.tsx`

Nouvelle logique d'affichage dans la colonne Utilisateur :

```text
Si user_full_name existe          → "Marie Kabongo"  (texte foreground)
Sinon si user_email existe        → "marie@gmail.com" (texte foreground)
Sinon si user_id existe (compte)  → "Client #A4F2" + sous-titre "compte sans nom" (muted)
Sinon (anonyme)                   → "Visiteur #A4F2" + sous-titre "non inscrit" (muted)
```

- Le `#A4F2` = 4 derniers caractères de l'UUID en majuscules (court, lisible, unique en pratique)
- Affichage sur 2 lignes : identité principale + label discret en dessous
- Update aussi l'interface TypeScript `JourneyRow`

## Fichiers touchés

1. `frontend/supabase/migrations/<timestamp>_enrich_automation_journey_user_name.sql` — nouveau, drop+recreate de la fonction
2. `frontend/src/components/admin/AdminAutomationAnalyticsTab.tsx` — interface + rendu colonne

## Hors scope

- Pas de changement sur les autres tableaux/KPIs
- Pas de tracking côté capture d'événements (déjà OK)

